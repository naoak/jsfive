import {DatatypeMessage} from './datatype-msg.js';
import {_structure_size, _padded_size, _unpack_struct_from, struct, dtype_getter, DataView64, assert} from './core.js';
import {BTree, BTreeRawDataChunks, GZIP_DEFLATE_FILTER, SHUFFLE_FILTER, FLETCH32_FILTER} from './btree.js';
import {Heap, SymbolTable, GlobalHeap} from './misc-low-level.js';

export class DataObjects {
  /*
  """
  HDF5 DataObjects.
  """
  */
  constructor(fh, offset) {
    //""" initalize. """
    //fh.seek(offset)
    let version_hint = struct.unpack_from('<B', fh, offset)[0]
    //fh.seek(offset)
    if (version_hint == 1) {
        var [msgs, msg_data, header] = this._parse_v1_objects(fh, offset);
    }
    else if (version_hint == 'O'.charCodeAt(0)) {  //# first character of v2 signature
        var [msgs, msg_data, header] = this._parse_v2_objects(fh, offset);
    }
    else {
        throw "InvalidHDF5File('unknown Data Object Header')";
    }
    this.fh = fh
    this.msgs = msgs
    this.msg_data = msg_data
    this.offset = offset
    this._global_heaps = {}
    this._header = header

    //# cached attributes
    this._filter_pipeline = null;
    this._chunk_params_set = false;
    this._chunks = null;
    this._chunk_dims = null;
    this._chunk_address = null;
  }
  get dtype() {
    //""" Datatype of the dataset. """
    let msg = this.find_msg_type(DATATYPE_MSG_TYPE)[0];
    let msg_offset = msg.get('offset_to_message');
    return (new DatatypeMessage(this.fh, msg_offset)).dtype
  }

  get chunks() {
    //""" Tuple describing the chunk size, None if not chunked. """
    this._get_chunk_params();
    return this._chunks;
  }

  get shape() {
    //""" Shape of the dataset. """
    let msg = this.find_msg_type(DATASPACE_MSG_TYPE)[0];
    let msg_offset = msg.get('offset_to_message');
    return determine_data_shape(this.fh, msg_offset)
  }

  get filter_pipeline() {
    //""" Dict describing filter pipeline, None if no pipeline. """
    if (this._filter_pipeline != null) {
      return this._filter_pipeline  //# use cached value
    }

    let filter_msgs = this.find_msg_type(DATA_STORAGE_FILTER_PIPELINE_MSG_TYPE);
    if (!filter_msgs.length) {
      this._filter_pipeline = null;
      return this._filter_pipeline
    }

    var offset = filter_msgs[0].get('offset_to_message');
    let [version, nfilters] = struct.unpack_from('<BB', this.fh, offset);
    offset += struct.calcsize('<BB');
    if (version != 1) {
        throw 'NotImplementedError("only version 1 filters supported. ")';
    }
    let [res0, res1] = struct.unpack_from('<HI', this.fh, offset);
    offset += struct.calcsize('<HI');

    var filters = []
    for (var _=0; _<nfilters; _++) {

      let filter_info = _unpack_struct_from(
          FILTER_PIPELINE_DESCR_V1, this.fh, offset);
      offset += FILTER_PIPELINE_DESCR_V1_SIZE;

      let padded_name_length = _padded_size(filter_info.get('name_length'), 8);
      let fmt = '<' + padded_name_length.toFixed() + 's';
      let filter_name = struct.unpack_from(fmt, this.fh, offset)[0];
      filter_info.set('filter_name', filter_name);
      offset += padded_name_length;

      fmt = '<' + filter_info.get('client_data_values').toFixed() + 'I';
      let client_data = struct.unpack_from(fmt, this.fh, offset);
      filter_info.set('client_data', client_data);
      offset += 4 * filter_info.get('client_data_values');

      if (filter_info.get('client_data_values') % 2) {
        offset += 4;  //# odd number of client data values padded
      }

      filters.push(filter_info);
    }
    this._filter_pipeline = filters;
    return this._filter_pipeline;
  }

  find_msg_type(msg_type) {
    //""" Return a list of all messages of a given type. """
    return this.msgs.filter(function(m) { return m.get('type') == msg_type });
  }

  get_attributes() {
    //""" Return a dictionary of all attributes. """
    let attrs = {};
    let attr_msgs = this.find_msg_type(ATTRIBUTE_MSG_TYPE);
    for (var msg of attr_msgs) {
      let offset = msg.get('offset_to_message');
      let [name, value] = this.unpack_attribute(offset);
      attrs[name] = value;
    }
    //# TODO attributes may also be stored in objects reference in the
    //# Attribute Info Message (0x0015, 21).
    return attrs
  }

  get fillvalue() {
    /* Fillvalue of the dataset. */
    let msg = this.find_msg_type(FILLVALUE_MSG_TYPE)[0];
    var offset = msg.get('offset_to_message');
    var is_defined;
    let version = struct.unpack_from('<B', this.fh, offset)[0];
    var info, size, fillvalue;
    if (version == 1 || version == 2) {
      info = _unpack_struct_from(FILLVAL_MSG_V1V2, this.fh, offset);
      offset += FILLVAL_MSG_V1V2_SIZE;
      is_defined = info.get('fillvalue_defined');
    }
    else if (version == 3) {
      info = _unpack_struct_from(FILLVAL_MSG_V3, this.fh, offset);
      offset += FILLVAL_MSG_V3_SIZE
      is_defined = info.get('flags') & 0b00100000;
    } else {
      throw 'InvalidHDF5File("Unknown fillvalue msg version: "' + String(version);
    }
    if (is_defined) {
      size = struct.unpack_from('<I', this.fh, offset)[0];
      offset += 4;
    }
    else {
      size = 0;
    }

    if (size) {
      let [getter, big_endian, size] = dtype_getter(this.dtype);
      let payload_view = new DataView64(this.fh);
      fillvalue = payload_view[getter](offset, !big_endian, size);
    }
    else {
      fillvalue = 0;
    }
    return fillvalue
  }

  unpack_attribute(offset) {
    //""" Return the attribute name and value. """

    //# read in the attribute message header
    //# See section IV.A.2.m. The Attribute Message for details
    let version = struct.unpack_from('<B', this.fh, offset)[0];
    var attr_map, padding_multiple;
    if (version == 1) {
      attr_map = _unpack_struct_from(
          ATTR_MSG_HEADER_V1, this.fh, offset);
      assert(attr_map.get('version') == 1);
      offset += ATTR_MSG_HEADER_V1_SIZE;
      padding_multiple = 8;
    }
    else if (version == 3) {
      attr_map = _unpack_struct_from(
          ATTR_MSG_HEADER_V3, this.fh, offset)
      assert(attr_map.get('version') == 3);
      offset += ATTR_MSG_HEADER_V3_SIZE;
      padding_multiple = 1    //# no padding
    }
    else {
      throw ("unsupported attribute message version: " + version);
    }

    //# read in the attribute name
    let name_size = attr_map.get('name_size');
    let name = struct.unpack_from('<' + name_size.toFixed() + 's', this.fh, offset)[0];
    name = name.replace(/\x00$/, '');
    //name = name.strip(b'\x00').decode('utf-8')
    offset += _padded_size(name_size, padding_multiple);

    //# read in the datatype information
    var dtype;
    try {
      dtype = new DatatypeMessage(this.fh, offset).dtype;
    }
    catch(e) {
      console.log('Attribute ' + name + ' type not implemented, set to null.');
      return [name, null];
    }
    
    offset += _padded_size(attr_map.get('datatype_size'), padding_multiple);

    //# read in the dataspace information
    let shape = this.determine_data_shape(this.fh, offset);
    let items = shape.reduce(function(a,b) { return a * b }, 1); // int(np.product(shape))
    offset += _padded_size(attr_map.get('dataspace_size'), padding_multiple)

    //# read in the value(s)
    var value = this._attr_value(dtype, this.fh, items, offset);
    //let value = [42];

    if (shape.length == 0) { // == ():
      value = value[0];
    }
    else {
      //value = value.reshape(shape)
    }
    return [name, value];
  }

  determine_data_shape(buf, offset) {
    //""" Return the shape of the dataset pointed to in a Dataspace message. """
    let version = struct.unpack_from('<B', buf, offset)[0];
    var header;
    if (version == 1) {
      header = _unpack_struct_from(DATASPACE_MSG_HEADER_V1, buf, offset);
      assert(header.get('version') == 1);
      offset += DATASPACE_MSG_HEADER_V1_SIZE;
    }
    else if (version == 2) {
      header = _unpack_struct_from(DATASPACE_MSG_HEADER_V2, buf, offset)
      assert( header.get('version') == 2);
      offset += DATASPACE_MSG_HEADER_V2_SIZE;
    }
    else {
      throw 'unknown dataspace message version';
    }

    let ndims = header.get('dimensionality');
    let dim_sizes = struct.unpack_from('<' + (ndims).toFixed() + 'Q', buf, offset);
    
    //# Dimension maximum size follows if header['flags'] bit 0 set
    //# Permutation index follows if header['flags'] bit 1 set
    return dim_sizes
  }

  _attr_value(dtype, buf, count, offset) {
    //""" Retrieve an HDF5 attribute value from a buffer. """
    var value = new Array(count);
    if (dtype instanceof Array) {
      let dtype_class = dtype[0]
      for (var i=0; i<count; i++) {
        if (dtype_class == 'VLEN_STRING') {
          var [_0, _1, character_set] = dtype;
          var [vlen, vlen_data] = this._vlen_size_and_data(buf, offset);
          let fmt = '<' + vlen.toFixed() + 's';
          let str_data = struct.unpack_from(fmt, vlen_data, 0)[0];
          if (character_set == 0) {
            //# ascii character set, return as bytes
            value[i] = str_data;
          }
          else {
            value[i] = decodeURIComponent(escape(str_data));
          }
          offset += 16
        }
        else if (dtype_class == 'REFERENCE') {
          var address = struct.unpack_from('<Q', buf, offset);
          value[i] = address;
          offset += 8;
        }
        else if (dtype_class == "VLEN_SEQUENCE") {
          let base_dtype = dtype[1];
          var [vlen, vlen_data] = this._vlen_size_and_data(buf, offset);
          value[i] = this._attr_value(base_dtype, vlen_data, vlen, 0);
          offset += 16
        }
        else {
          throw "NotImplementedError";
        }
      }
    }
    else {
      let [getter, big_endian, size] = dtype_getter(dtype);
      let view = new DataView64(buf, 0);
      for (var i=0; i<count; i++) {
        value[i] = view[getter](offset, !big_endian, size);
        offset += size;
      }
    }
    return value
  }

  _vlen_size_and_data(buf, offset) {
    //""" Extract the length and data of a variables length attr. """
    //# offset should be incremented by 16 after calling this method
    let vlen_size = struct.unpack_from('<I', buf, offset)[0];
    //# section IV.B
    //# Data with a variable-length datatype is stored in the
    //# global heap of the HDF5 file. Global heap identifiers are
    //# stored in the data object storage.
    let gheap_id = _unpack_struct_from(GLOBAL_HEAP_ID, buf, offset+4)
    let gheap_address = gheap_id.get('collection_address');
    assert(gheap_id.get("collection_address") < Number.MAX_SAFE_INTEGER);
    var gheap;
    if (!(gheap_address in this._global_heaps)) {
      //# load the global heap and cache the instance
      gheap = new GlobalHeap(this.fh, gheap_address);
      this._global_heaps[gheap_address] = gheap;
    }
    gheap = this._global_heaps[gheap_address];
    let vlen_data = gheap.objects.get(gheap_id.get('object_index'));
    return [vlen_size, vlen_data];
  }

  _parse_v1_objects(buf, offset) {
    //""" Parse a collection of version 1 Data Objects. """
    let header = _unpack_struct_from(OBJECT_HEADER_V1, buf, offset)
    assert(header.get('version') == 1);
    let total_header_messages = header.get('total_header_messages');

    var block_size = header.get('object_header_size');
    var block_offset = offset + _structure_size(OBJECT_HEADER_V1);
    var msg_data = buf.slice(block_offset, block_offset + block_size);
    var object_header_blocks = [[block_offset, block_size]];
    var current_block = 0;
    var local_offset = 0;
    var msgs = new Array(total_header_messages);
    for (var i=0; i<total_header_messages; i++) {
      if (local_offset >= block_size) {
        [block_offset, block_size] = object_header_blocks[++current_block];
        local_offset = 0;
      }
      let msg = _unpack_struct_from(HEADER_MSG_INFO_V1, buf, block_offset + local_offset);
      let offset_to_message = block_offset + local_offset + HEADER_MSG_INFO_V1_SIZE;
      msg.set('offset_to_message', offset_to_message);
      if (msg.get('type') == OBJECT_CONTINUATION_MSG_TYPE) {
        var [fh_off, size] = struct.unpack_from('<QQ', buf, offset_to_message);
        object_header_blocks.push([fh_off, size]);
      }
      local_offset += HEADER_MSG_INFO_V1_SIZE + msg.get('size');
      msgs[i] = msg;
    }
    return [msgs, msg_data, header];
  }

  _parse_v2_objects(buf, offset) {
    /* Parse a collection of version 2 Data Objects. */

    var [header, creation_order_size, block_offset] = this._parse_v2_header(buf, offset);
    offset = block_offset;
    var msgs = [];
    var block_size = header.get('size_of_chunk_0');
    var msg_data = buf.slice(offset, offset += block_size);

    var object_header_blocks = [[block_offset, block_size]];
    var current_block = 0;
    var local_offset = 0;

    while (true) {
      if (local_offset >= block_size) {
        let next_block = object_header_blocks[++current_block];
        if (next_block == null) {
          break
        }
        [block_offset, block_size] = next_block;
        local_offset = 0;
      }
      let msg = _unpack_struct_from(HEADER_MSG_INFO_V2, buf, block_offset + local_offset);
      let offset_to_message = block_offset + local_offset + HEADER_MSG_INFO_V2_SIZE + creation_order_size;
      msg.set('offset_to_message', offset_to_message);
      if (msg.get('type') == OBJECT_CONTINUATION_MSG_TYPE) {
        var [fh_off, size] = struct.unpack_from('<QQ', buf, offset_to_message);
        object_header_blocks.push([fh_off, size]);
      }
      local_offset += HEADER_MSG_INFO_V2_SIZE + msg.get('size') + creation_order_size;
      msgs.push(msg);
    }

    return [msgs, msg_data, header];
  }

  _parse_v2_header(buf, offset) {
    /* Parse a version 2 data object header. */
    let header = _unpack_struct_from(OBJECT_HEADER_V2, buf, offset);
    var creation_order_size;
    offset += _structure_size(OBJECT_HEADER_V2);
    assert(header.get('version') == 2);
    if (header.get('flags') & 0b00000100) {
      creation_order_size = 2;
    }
    else {
      creation_order_size = 0;
    }
    assert((header.get('flags') & 0b00010000) == 0);
    if (header.get('flags') & 0b00100000) {
      let times = struct.unpack_from('<4I', buf, offset);
      offset += 16;
      header.set('access_time', times[0]);
      header.set('modification_time', times[1]);
      header.set('change_time', times[2]);
      header.set('birth_time', times[3]);
    }
    let chunk_fmt = ['<B', '<H', '<I', '<Q'][(header.get('flags') & 0b00000011)];
    header.set('size_of_chunk_0', struct.unpack_from(chunk_fmt, buf, offset)[0]);
    offset += struct.calcsize(chunk_fmt);
    return [header, creation_order_size, offset];
  }

  get_links() {
    //""" Return a dictionary of link_name: offset """
    let sym_tbl_msgs = this.find_msg_type(SYMBOL_TABLE_MSG_TYPE)
    if (sym_tbl_msgs.length > 0) {
      return this._get_links_from_symbol_tables(sym_tbl_msgs);
    }
    return this._get_links_from_link_msgs()
  }

  _get_links_from_symbol_tables(sym_tbl_msgs) {
    //""" Return a dict of link_name: offset from a symbol table. """
    assert(sym_tbl_msgs.length == 1);
    assert(sym_tbl_msgs[0].get('size') == 16);
    let symbol_table_message = _unpack_struct_from(
      SYMBOL_TABLE_MSG, this.fh,
      sym_tbl_msgs[0].get('offset_to_message'));

    var btree = new BTree(this.fh, symbol_table_message.get('btree_address'));
    var heap = new Heap(this.fh, symbol_table_message.get('heap_address'));
    var links = {};
    for (var symbol_table_address of btree.symbol_table_addresses()) {
      let table = new SymbolTable(this.fh, symbol_table_address);
      table.assign_name(heap);
      let new_links = table.get_links();
      for (var lk in new_links) {
        links[lk] = new_links[lk];
      }
      //links.update(table.get_links())
    }
    return links
  }

  _get_links_from_link_msgs() {
    //""" Retrieve links from link messages. """
    var links = {}
    var link_msgs = this.find_msg_type(LINK_MSG_TYPE);
    for (var link_msg of link_msgs) {
      let offset = link_msg.get('offset_to_message');
      var [version, flags] = struct.unpack_from('<BB', this.fh, offset);
      offset += 2
      assert(version == 1);
      assert((flags & 0b00000001) == 0);
      assert((flags & 0b00000010) == 0);
      assert((flags & 0b00001000) == 0);
      assert((flags & 0b00010000) == 0);
      if (flags & 0b00000100) {
        //# creation order present
        offset += 8;
      }

      var encoding = 'ascii';

      let name_size = struct.unpack_from('<B', this.fh, offset)[0];
      offset += 1;
      //let name = this.fh.slice(offset, offset + name_size).decode(encoding)
      let name = struct.unpack_from('<' + name_size.toFixed() + 's', this.fh, offset);
      offset += name_size;

      let address = struct.unpack_from('<Q', this.fh, offset)[0];
      links[name] = address;
    }
    return links
  }

  get is_dataset() {
    //""" True when DataObjects points to a dataset, False for a group. """
    return ((this.find_msg_type(DATASPACE_MSG_TYPE)).length > 0);
  }

  get_data() {
    //""" Return the data pointed to in the DataObject. """

    //# offset and size from data storage message
    let msg = this.find_msg_type(DATA_STORAGE_MSG_TYPE)[0];
    let msg_offset = msg.get('offset_to_message');
    var [version, dims, layout_class, property_offset] = (
      this._get_data_message_properties(msg_offset));

    if (layout_class == 2) { //  # chunked storage
      return this._get_chunked_data(msg_offset);
    }

    assert(layout_class == 1);
    //var [data_offset, data_offset_higher] = struct.unpack_from('<II', this.fh, property_offset);
    var [data_offset] = struct.unpack_from('<Q', this.fh, property_offset);
    let full_address = struct.unpack_from('<II', this.fh, property_offset);

    if (full_address[0] == UNDEFINED_ADDRESS[0] && full_address[1] == UNDEFINED_ADDRESS[1]) {
      //# no storage is backing array, return empty array
      let size = this.shape.reduce(function(a,b) { return a * b }, 1); // int(np.product(shape))
      return new Array(size);
    }
    var fullsize = this.shape.reduce(function(a,b) { return a * b }, 1);
    if (!(this.dtype instanceof Array)) {
      //# return a memory-map to the stored array with copy-on-write
      //return np.memmap(self.fh, dtype=self.dtype, mode='c',
      //                 offset=data_offset, shape=self.shape, order='C')
      let dtype = this.dtype;
      if (/[<>=!@\|]?(i|u|f|S)(\d*)/.test(dtype)) {
        let [item_getter, item_is_big_endian, item_size] = dtype_getter(dtype);
        let output = new Array(fullsize);
        let view = new DataView64(this.fh);
        for (var i=0; i<fullsize; i++) {
          output[i] = view[item_getter](data_offset + i*item_size, !item_is_big_endian, item_size);
        }
        return output
      }
      else {
        throw "not Implemented - no proper dtype defined";
      }
    }
    else {
      let dtype_class = this.dtype[0];
      if (dtype_class == 'REFERENCE') {
        let size = this.dtype[1];
        if (size != 8) {
            throw "NotImplementedError('Unsupported Reference type')";
        }
        let ref_addresses = this.fh.slice(data_offset, data_offset + fullsize);

        //ref_addresses = np.memmap(
        //    self.fh, dtype=('<u8'), mode='c', offset=data_offset,
        //    shape=self.shape, order='C')
        //return np.array([Reference(addr) for addr in ref_addresses])
        return ref_addresses;
      }
      else if (dtype_class == 'VLEN_STRING') {
        var [_0, _1, character_set] = this.dtype;
        var value = [];
        for (var i=0; i<fullsize; i++) {
          var [vlen, vlen_data] = this._vlen_size_and_data(this.fh, data_offset);
          let fmt = '<' + vlen.toFixed() + 's';
          let str_data = struct.unpack_from(fmt, vlen_data, 0)[0];
          if (character_set == 0) {
            //# ascii character set, return as bytes
            value[i] = str_data;
          }
          else {
            value[i] = decodeURIComponent(escape(str_data));
          }
          data_offset += 16;
        }
        return value;
      }
      else {
        throw "NotImplementedError('datatype not implemented')";
      }
    }
  }

  _get_chunked_data(offset) {
    //""" Return data which is chunked. """
    this._get_chunk_params();
    var chunk_btree = new BTreeRawDataChunks(
      this.fh, this._chunk_address, this._chunk_dims);
    let data = chunk_btree.construct_data_from_chunks(
      this.chunks, this.shape, this.dtype, this.filter_pipeline);
    if (this.dtype instanceof Array && /^VLEN/.test(this.dtype[0])) {
      // VLEN data
      let dtype_class = this.dtype[0];
      for (var i=0; i<data.length; i++) {
        let [item_size, gheap_address, object_index] = data[i];
        var gheap;
        if (!(gheap_address in this._global_heaps)) {
          //# load the global heap and cache the instance
          gheap = new GlobalHeap(this.fh, gheap_address);
          this._global_heaps[gheap_address] = gheap;
        }
        else {
          gheap = this._global_heaps[gheap_address];
        }
        let vlen_data = gheap.objects.get(object_index);
        if (dtype_class == 'VLEN_STRING') {
          let character_set = this.dtype[2];
          let fmt = '<' + item_size.toFixed() + 's';
          let str_data = struct.unpack_from(fmt, vlen_data, 0)[0];
          if (character_set == 0) {
            //# ascii character set, return as bytes
            data[i] = str_data;
          }
          else {
            data[i] = decodeURIComponent(escape(str_data));
          }
        }
      }
    }
    return data;
  }

  _get_chunk_params() {
    /*
    Get and cache chunked data storage parameters.
    This method should be called prior to accessing any _chunk_*
    attributes. Calling this method multiple times is fine, it will not
    re-read the parameters.
    */
    if (this._chunk_params_set)  { //# parameter have already need retrieved
      return
    }
    this._chunk_params_set = true;
    var msg = this.find_msg_type(DATA_STORAGE_MSG_TYPE)[0];
    var offset = msg.get('offset_to_message');
    var [version, dims, layout_class, property_offset] = (
        this._get_data_message_properties(offset));

    if (layout_class != 2) { //# not chunked storage
      return
    }

    var data_offset;
    if ((version == 1) || (version == 2)) {
      var address = struct.unpack_from('<Q', this.fh, property_offset)[0];
      data_offset = property_offset + struct.calcsize('<Q');
    }
    else if (version == 3) {
      var [dims, address] = struct.unpack_from(
            '<BQ', this.fh, property_offset);
      data_offset = property_offset + struct.calcsize('<BQ');
    }
    assert((version >= 1) && (version <= 3));

    var fmt = '<' + (dims-1).toFixed() + 'I';
    var chunk_shape = struct.unpack_from(fmt, this.fh, data_offset);
    this._chunks = chunk_shape;
    this._chunk_dims = dims;
    this._chunk_address = address;
    return
  }

  _get_data_message_properties(msg_offset) {
    //""" Return the message properties of the DataObject. """
    var [dims, layout_class, property_offset] = [null, null, null];
    var [version, arg1, arg2] = struct.unpack_from('<BBB', this.fh, msg_offset);
    if ((version == 1) || (version == 2)) {
      dims = arg1;
      layout_class = arg2;
      // 4 bytes for version, dims, layout class and reserved
      // then another 4 bytes reserved...
      property_offset = msg_offset + 8; 
      assert( (layout_class == 1) || (layout_class == 2));
    }
    else if ((version == 3) || (version == 4)) {
      layout_class = arg1;
      property_offset = msg_offset;
      property_offset += struct.calcsize('<BB');
    }
    assert((version >= 1) && (version <= 4));
    return [version, dims, layout_class, property_offset];
  }

}

function determine_data_shape(buf, offset) {
  //""" Return the shape of the dataset pointed to in a Dataspace message. """
  let version = struct.unpack_from('<B', buf, offset)[0];
  var header;
  if (version == 1) {
    header = _unpack_struct_from(DATASPACE_MSG_HEADER_V1, buf, offset)
    assert(header.get('version') == 1);
    offset += DATASPACE_MSG_HEADER_V1_SIZE;
  }
  else if (version == 2) {
    header = _unpack_struct_from(DATASPACE_MSG_HEADER_V2, buf, offset);
    assert(header.get('version') == 2);
    offset += DATASPACE_MSG_HEADER_V2_SIZE;
  }
  else {
    throw "InvalidHDF5File('unknown dataspace message version')";
  }

  let ndims = header.get('dimensionality');
  let dim_sizes = struct.unpack_from('<' + (ndims * 2).toFixed() + 'I', buf, offset);
  //# Dimension maximum size follows if header['flags'] bit 0 set
  //# Permutation index follows if header['flags'] bit 1 set
  return dim_sizes.filter(function(s, i) { return i%2 == 0 });
}

var UNDEFINED_ADDRESS = struct.unpack_from('<II', new Uint8Array([255, 255, 255, 255, 255, 255, 255, 255]).buffer);

var GLOBAL_HEAP_ID = new Map([
  ['collection_address', 'Q'],  //# 8 byte addressing,
  ['object_index', 'I'],
]);
var GLOBAL_HEAP_ID_SIZE = _structure_size(GLOBAL_HEAP_ID);

//# IV.A.2.m The Attribute Message
var ATTR_MSG_HEADER_V1 = new Map([
    ['version', 'B'],
    ['reserved', 'B'],
    ['name_size', 'H'],
    ['datatype_size', 'H'],
    ['dataspace_size', 'H'],
]);
var ATTR_MSG_HEADER_V1_SIZE = _structure_size(ATTR_MSG_HEADER_V1);

var ATTR_MSG_HEADER_V3 = new Map([
    ['version', 'B'],
    ['flags', 'B'],
    ['name_size', 'H'],
    ['datatype_size', 'H'],
    ['dataspace_size', 'H'],
    ['character_set_encoding', 'B'],
]);
var ATTR_MSG_HEADER_V3_SIZE = _structure_size(ATTR_MSG_HEADER_V3);

// IV.A.1.a Version 1 Data Object Header Prefix
var OBJECT_HEADER_V1 = new Map([
  ['version', 'B'],
  ['reserved', 'B'],
  ['total_header_messages', 'H'],
  ['object_reference_count', 'I'],
  ['object_header_size', 'I'],
  ['padding', 'I'],
]);

// IV.A.1.b Version 2 Data Object Header Prefix
var OBJECT_HEADER_V2 = new Map([
  ['signature', '4s'],
  ['version', 'B'],
  ['flags', 'B'],
  //# Access time (optional)
  //# Modification time (optional)
  //# Change time (optional)
  //# Birth time (optional)
  //# Maximum # of compact attributes
  //# Maximum # of dense attributes
  //# Size of Chunk #0
])

// IV.A.2.b The Dataspace Message
var DATASPACE_MSG_HEADER_V1 = new Map([
  ['version', 'B'],
  ['dimensionality', 'B'],
  ['flags', 'B'],
  ['reserved_0', 'B'],
  ['reserved_1', 'I'],
]);
var DATASPACE_MSG_HEADER_V1_SIZE = _structure_size(DATASPACE_MSG_HEADER_V1);

var DATASPACE_MSG_HEADER_V2 = new Map([
  ['version', 'B'],
  ['dimensionality', 'B'],
  ['flags', 'B'],
  ['type', 'B'],
]);
var DATASPACE_MSG_HEADER_V2_SIZE = _structure_size(DATASPACE_MSG_HEADER_V2);

var HEADER_MSG_INFO_V1 = new Map([
  ['type', 'H'],
  ['size', 'H'],
  ['flags', 'B'],
  ['reserved', '3s']
]);
var HEADER_MSG_INFO_V1_SIZE = _structure_size(HEADER_MSG_INFO_V1);

var HEADER_MSG_INFO_V2 = new Map([
  ['type', 'B'],
  ['size', 'H'],
  ['flags', 'B'],
]);
var HEADER_MSG_INFO_V2_SIZE = _structure_size(HEADER_MSG_INFO_V2);

var SYMBOL_TABLE_MSG = new Map([
  ['btree_address', 'Q'],     //# 8 bytes addressing
  ['heap_address', 'Q'],      //# 8 byte addressing
]);

// IV.A.2.f. The Data Storage - Fill Value Message
var FILLVAL_MSG_V1V2 = new Map([
    ['version', 'B'],
    ['space_allocation_time', 'B'],
    ['fillvalue_write_time', 'B'],
    ['fillvalue_defined', 'B']
]);
var FILLVAL_MSG_V1V2_SIZE = _structure_size(FILLVAL_MSG_V1V2);

var FILLVAL_MSG_V3 = new Map([
    ['version', 'B'],
    ['flags', 'B']
]);
var FILLVAL_MSG_V3_SIZE = _structure_size(FILLVAL_MSG_V3);

//# IV.A.2.l The Data Storage - Filter Pipeline message
var FILTER_PIPELINE_DESCR_V1 = new Map([
  ['filter_id', 'H'],
  ['name_length', 'H'],
  ['flags', 'H'],
  ['client_data_values', 'H'],
]);
var FILTER_PIPELINE_DESCR_V1_SIZE = _structure_size(FILTER_PIPELINE_DESCR_V1);

//# Data Object Message types
//# Section IV.A.2.a - IV.A.2.x
var NIL_MSG_TYPE = 0x0000;
var DATASPACE_MSG_TYPE = 0x0001;
var LINK_INFO_MSG_TYPE = 0x0002;
var DATATYPE_MSG_TYPE = 0x0003;
var FILLVALUE_OLD_MSG_TYPE = 0x0004;
var FILLVALUE_MSG_TYPE = 0x0005;
var LINK_MSG_TYPE = 0x0006;
var EXTERNAL_DATA_FILES_MSG_TYPE = 0x0007;
var DATA_STORAGE_MSG_TYPE = 0x0008;
var BOGUS_MSG_TYPE = 0x0009;
var GROUP_INFO_MSG_TYPE = 0x000A;
var DATA_STORAGE_FILTER_PIPELINE_MSG_TYPE = 0x000B;
var ATTRIBUTE_MSG_TYPE = 0x000C;
var OBJECT_COMMENT_MSG_TYPE = 0x000D;
var OBJECT_MODIFICATION_TIME_OLD_MSG_TYPE = 0x000E;
var SHARED_MSG_TABLE_MSG_TYPE = 0x000F;
var OBJECT_CONTINUATION_MSG_TYPE = 0x0010;
var SYMBOL_TABLE_MSG_TYPE = 0x0011;
var OBJECT_MODIFICATION_TIME_MSG_TYPE = 0x0012;
var BTREE_K_VALUE_MSG_TYPE = 0x0013;
var DRIVER_INFO_MSG_TYPE = 0x0014;
var ATTRIBUTE_INFO_MSG_TYPE = 0x0015;
var OBJECT_REFERENCE_COUNT_MSG_TYPE = 0x0016;
var FILE_SPACE_INFO_MSG_TYPE = 0x0018;