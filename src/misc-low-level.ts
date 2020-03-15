import {_structure_size, _padded_size, _unpack_struct_from, struct, assert} from './core';
import type { Node } from './btree';

export class SuperBlock {
  version: number;
  _end_of_sblock: number;
  _contents: Map<string, any>;
  _fh: ArrayBufferLike;
  _root_symbol_table: SymbolTable;

  constructor(fh: ArrayBufferLike, offset: number) {
    let version_hint: number = struct.unpack_from('<B', fh, offset + 8)[0];
    let contents: Map<string, any>;
    if (version_hint == 0) {
      contents = _unpack_struct_from(SUPERBLOCK_V0, fh, offset);
      this._end_of_sblock = offset + SUPERBLOCK_V0_SIZE;
    }
    else if (version_hint == 2 || version_hint == 3) {
      contents = _unpack_struct_from(SUPERBLOCK_V2_V3, fh, offset);
      this._end_of_sblock = offset + SUPERBLOCK_V2_V3_SIZE;
    } else {
      throw ("unsupported superblock version: " + version_hint.toFixed())
    }
    // verify contents
    if (contents.get('format_signature') != FORMAT_SIGNATURE) {
      throw 'Incorrect file signature: ' + contents.get('format_signature');
    }
    if (contents.get('offset_size') != 8 || contents.get('length_size') != 8) {
      throw 'File uses non-64-bit addressing';
    }
    this.version = contents.get('superblock_version');
    this._contents = contents
    this._root_symbol_table = null;
    this._fh = fh;
  }
  get offset_to_dataobjects() {
    //""" The offset to the data objects collection for the superblock. """
    if (this.version == 0) {
      let sym_table = new SymbolTable(this._fh, this._end_of_sblock, true);
      this._root_symbol_table = sym_table
      return sym_table.group_offset;
    }
    else if (this.version == 2 || this.version == 3) {
      return this._contents.get('root_group_address');
    }
    else {
      throw("Not implemented version = " + this.version.toFixed());
    }
  }
}

export class Heap {
  /*
  """
  HDF5 local heap.
  """
  */
  _contents: Map<string, any>;
  data: ArrayBuffer;

  constructor(fh: ArrayBufferLike, offset: number) {
    //""" initalize. """

    //fh.seek(offset)
    let local_heap = _unpack_struct_from(LOCAL_HEAP, fh, offset);
    assert(local_heap.get('signature') == 'HEAP');
    assert(local_heap.get('version') == 0);
    let data_offset = local_heap.get('address_of_data_segment');
    let heap_data = fh.slice(data_offset, data_offset + local_heap.get('data_segment_size'));
    local_heap.set('heap_data',  heap_data);
    this._contents = local_heap;
    this.data = heap_data;
  }

  get_object_name(offset) {
    //""" Return the name of the object indicated by the given offset. """
    let end = new Uint8Array(this.data).indexOf(0, offset);
    let name_size = end - offset;
    let name = struct.unpack_from('<' + name_size.toFixed() + 's', this.data, offset)[0];
    return name
  } 
}

export class SymbolTable {
  /*
  """
  HDF5 Symbol Table.
  """
  */
  group_offset: number;
  entries: Map<string, any>[];
  _contents: Node;

  constructor(fh: ArrayBufferLike, offset: number, root=false) {
    //""" initialize, root=True for the root group, False otherwise. """
    let node: Node;
    if (root) {
      //# The root symbol table has no Symbol table node header
      //# and contains only a single entry
      node = new Map([['symbols', 1]]);
    }
    else {
      node = _unpack_struct_from(SYMBOL_TABLE_NODE, fh, offset);
      if (node.get('signature') != 'SNOD') { throw "incorrect node type" }
      offset += SYMBOL_TABLE_NODE_SIZE;
    }  
    let entries: Map<string, any>[] = [];
    var n_symbols = node.get('symbols');
    for (var i=0; i<n_symbols; i++) {
      entries.push(_unpack_struct_from(SYMBOL_TABLE_ENTRY, fh, offset))
      offset += SYMBOL_TABLE_ENTRY_SIZE;
    }
    if (root) {
      this.group_offset = entries[0].get('object_header_address');
    }
    this.entries = entries
    this._contents = node
  }

  assign_name(heap) {
    //""" Assign link names to all entries in the symbol table. """
    this.entries.forEach(function(entry) {
      let offset = entry.get('link_name_offset');
      let link_name = heap.get_object_name(offset);
      entry.set('link_name', link_name);
    });
  }

  get_links() {
    //""" Return a dictionary of links (dataset/group) and offsets. """
    let links: {[key: string]: number} = {}
    this.entries.forEach(function(e) {
      links[e.get('link_name')] = e.get('object_header_address');
    });
    return links
  }
}

export class GlobalHeap {
  /*
  HDF5 Global Heap collection.
  */
  heap_data: ArrayBuffer;
  _header: Map<string, any>;
  _objects: Map<number, ArrayBuffer>;

  constructor(fh: ArrayBufferLike, offset: number) {
    let header = _unpack_struct_from(GLOBAL_HEAP_HEADER, fh, offset);
    offset += GLOBAL_HEAP_HEADER_SIZE;
    //assert(header.get('signature') == 'GCOL');
    //assert(header.get('version') == 1);
    let heap_data_size = header.get('collection_size') - GLOBAL_HEAP_HEADER_SIZE;
    let heap_data = fh.slice(offset, offset + heap_data_size);
    //assert(heap_data.byteLength == heap_data_size); //# check for early end of file

    this.heap_data = heap_data;
    this._header = header;
    this._objects = null;
  }

  get objects() {
    //""" Dictionary of objects in the heap. """
    if (this._objects == null) {
      this._objects = new Map();
      let offset = 0;
      while (offset <= this.heap_data.byteLength - GLOBAL_HEAP_OBJECT_SIZE) {
        let info = _unpack_struct_from(
          GLOBAL_HEAP_OBJECT, this.heap_data, offset);
        if (info.get('object_index') == 0) {
          break
        }
        offset += GLOBAL_HEAP_OBJECT_SIZE;
        let obj_data = this.heap_data.slice(offset, offset + info.get('object_size'));
        this._objects.set(info.get('object_index'), obj_data);
        offset += _padded_size(info.get('object_size'));
      }
    }
    return this._objects
  }
}

var FORMAT_SIGNATURE = struct.unpack_from('8s', new Uint8Array([137, 72, 68, 70, 13, 10, 26, 10]).buffer)[0];

// Version 0 SUPERBLOCK
var SUPERBLOCK_V0 = new Map([
    ['format_signature', '8s'],

    ['superblock_version', 'B'],
    ['free_storage_version', 'B'],
    ['root_group_version', 'B'],
    ['reserved_0', 'B'],

    ['shared_header_version', 'B'],
    ['offset_size', 'B'],            // assume 8
    ['length_size', 'B'],            // assume 8
    ['reserved_1', 'B'],

    ['group_leaf_node_k', 'H'],
    ['group_internal_node_k', 'H'],

    ['file_consistency_flags', 'L'],

    ['base_address_lower', 'Q'],                  // assume 8 byte addressing
    ['free_space_address', 'Q'],            // assume 8 byte addressing
    ['end_of_file_address', 'Q'],
    ['driver_information_address', 'Q']     // assume 8 byte addressing
]);
var SUPERBLOCK_V0_SIZE = _structure_size(SUPERBLOCK_V0);

var SUPERBLOCK_V2_V3 = new Map([
    ['format_signature', '8s'],

    ['superblock_version', 'B'],
    ['offset_size', 'B'],
    ['length_size', 'B'],
    ['file_consistency_flags', 'B'],

    ['base_address', 'Q'],                  // assume 8 byte addressing
    ['superblock_extension_address', 'Q'],  // assume 8 byte addressing
    ['end_of_file_address', 'Q'],           // assume 8 byte addressing
    ['root_group_address', 'Q'],            // assume 8 byte addressing

    ['superblock_checksum', 'I']
]);
var SUPERBLOCK_V2_V3_SIZE = _structure_size(SUPERBLOCK_V2_V3);

var SYMBOL_TABLE_ENTRY = new Map([
    ['link_name_offset', 'Q'],     // 8 byte address
    ['object_header_address', 'Q'],
    ['cache_type', 'I'],
    ['reserved', 'I'],
    ['scratch', '16s'],
]);
var SYMBOL_TABLE_ENTRY_SIZE = _structure_size(SYMBOL_TABLE_ENTRY);

var SYMBOL_TABLE_NODE = new Map([
    ['signature', '4s'],
    ['version', 'B'],
    ['reserved_0', 'B'],
    ['symbols', 'H'],
]);
var SYMBOL_TABLE_NODE_SIZE = _structure_size(SYMBOL_TABLE_NODE);

// III.D Disk Format: Level 1D - Local Heaps
var LOCAL_HEAP = new Map([
    ['signature', '4s'],
    ['version', 'B'],
    ['reserved', '3s'],
    ['data_segment_size', 'Q'],         // 8 byte size of lengths
    ['offset_to_free_list', 'Q'],       // 8 bytes size of lengths
    ['address_of_data_segment', 'Q']   // 8 byte addressing
]);

// III.E Disk Format: Level 1E - Global Heap
var GLOBAL_HEAP_HEADER = new Map([
    ['signature', '4s'],
    ['version', 'B'],
    ['reserved', '3s'],
    ['collection_size', 'Q']
])
var GLOBAL_HEAP_HEADER_SIZE = _structure_size(GLOBAL_HEAP_HEADER);

var GLOBAL_HEAP_OBJECT = new Map([
    ['object_index', 'H'],
    ['reference_count', 'H'],
    ['reserved', 'I'],
    ['object_size', 'Q']   // 8 byte addressing,
])
var GLOBAL_HEAP_OBJECT_SIZE = _structure_size(GLOBAL_HEAP_OBJECT);