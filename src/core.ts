export function _unpack_struct_from<V>(
  structure: Map<string, V>,
  buf: ArrayBuffer | SharedArrayBuffer,
  offset = 0
) {
  const fmt = '<' + Array.from(structure.values()).join('');
  const values = struct.unpack_from(fmt, buf, offset);
  const keys = Array.from(structure.keys());
  const output = new Map<string, any>();
  for (var i = 0; i < keys.length; i++) {
    output.set(keys[i], values[i]);
  }
  return output;
}

export function assert(thing: any) {
  if (!thing) {
    thing();
  }
}

export function _structure_size(structure: Map<any, any>) {
  //""" Return the size of a structure in bytes. """
  var fmt = '<' + Array.from(structure.values()).join('');
  return struct.calcsize(fmt);
}

export function _padded_size(size: number, padding_multiple = 8) {
  //""" Return the size of a field padded to be a multiple a given value. """
  return Math.ceil(size / padding_multiple) * padding_multiple;
}

const dtype_to_format = {
  u: 'Uint',
  i: 'Int',
  f: 'Float'
};

export function dtype_getter(dtype_str: string): [string, boolean, number] {
  let big_endian = struct._is_big_endian(dtype_str);
  let getter: string;
  let nbytes: number;
  if (/S/.test(dtype_str)) {
    // string type
    getter = 'getString';
    nbytes = parseInt((dtype_str.match(/S(\d*)/) || [])[1] || '1', 10);
  } else {
    let [_, fstr, bytestr] = dtype_str.match(/[<>=!@]?(i|u|f)(\d*)/);
    nbytes = parseInt(bytestr || '4', 10);
    let nbits = nbytes * 8;
    getter = 'get' + dtype_to_format[fstr] + nbits.toFixed();
  }
  return [getter, big_endian, nbytes];
}

// Pretty sure we can just use a number for this...
export class Reference {
  /*
  """
  HDF5 Reference.
  """
  */
  constructor(public address_of_reference: any) {}

  __bool__() {
    return this.address_of_reference != 0;
  }
}

class Struct {
  big_endian = isBigEndian();

  getters = {
    s: 'getUint8',
    b: 'getInt8',
    B: 'getUint8',
    h: 'getInt16',
    H: 'getUint16',
    i: 'getInt32',
    I: 'getUint32',
    l: 'getInt32',
    L: 'getUint32',
    q: 'getInt64',
    Q: 'getUint64',
    f: 'getFloat32',
    d: 'getFloat64'
  };

  byte_lengths = {
    s: 1,
    b: 1,
    B: 1,
    h: 2,
    H: 2,
    i: 4,
    I: 4,
    l: 4,
    L: 4,
    q: 8,
    Q: 8,
    f: 4,
    d: 8
  };

  fmt_size_regex = '(\\d*)([' + Object.keys(this.byte_lengths).join('') + '])';

  calcsize(fmt: string) {
    let size = 0;
    let match: RegExpExecArray;
    const regex = new RegExp(this.fmt_size_regex, 'g');
    const m = regex.exec('');
    while ((match = regex.exec(fmt)) !== null) {
      const n = parseInt(match[1] || '1', 10);
      const f = match[2];
      const subsize = this.byte_lengths[f];
      size += n * subsize;
    }
    return size;
  }

  _is_big_endian(fmt: string) {
    let big_endian: boolean;
    if (/^</.test(fmt)) {
      big_endian = false;
    } else if (/^(!|>)/.test(fmt)) {
      big_endian = true;
    } else {
      big_endian = this.big_endian;
    }
    return big_endian;
  }

  unpack_from(
    fmt: string,
    buffer: ArrayBuffer | SharedArrayBuffer,
    offset: number = 0
  ) {
    const view = new DataView64(buffer, 0);
    var output = [];
    const big_endian = this._is_big_endian(fmt);
    let match: RegExpExecArray;
    const regex = new RegExp(this.fmt_size_regex, 'g');
    while ((match = regex.exec(fmt)) !== null) {
      let n = parseInt(match[1] || '1', 10);
      let f = match[2];
      let getter = this.getters[f];
      const size = this.byte_lengths[f];
      var append_target;
      if (f == 's') {
        var sarray = new Array();
        append_target = sarray;
      } else {
        append_target = output;
      }
      for (let i = 0; i < n; i++) {
        append_target.push(view[getter](offset, !big_endian));
        offset += size;
      }
      if (f == 's') {
        output.push(
          sarray.reduce(function(a, b) {
            return a + String.fromCharCode(b);
          }, '')
        );
      }
    }
    return output;
  }
}

export const struct = new Struct();

function isBigEndian() {
  const array = new Uint8Array(4);
  const view = new Uint32Array(array.buffer);
  return !((view[0] = 1) & array[0]);
}

const WARN_OVERFLOW = false;

export class DataView64 extends DataView {
  getUint64(byteOffset, littleEndian) {
    // split 64-bit number into two 32-bit (4-byte) parts
    const left = this.getUint32(byteOffset, littleEndian);
    const right = this.getUint32(byteOffset + 4, littleEndian);

    // combine the two 32-bit values
    const combined = littleEndian
      ? left + 2 ** 32 * right
      : 2 ** 32 * left + right;

    if (WARN_OVERFLOW && !Number.isSafeInteger(combined))
      console.warn(combined, 'exceeds MAX_SAFE_INTEGER. Precision may be lost');

    return combined;
  }

  getInt64(byteOffset, littleEndian) {
    // split 64-bit number into two 32-bit (4-byte) parts
    // untested!!
    var low, high;
    if (littleEndian) {
      low = this.getUint32(byteOffset, true);
      high = this.getInt32(byteOffset + 4, true);
    } else {
      high = this.getInt32(byteOffset, false);
      low = this.getUint32(byteOffset + 4, false);
    }

    const combined = low + high * 4294967296;

    if (WARN_OVERFLOW && !Number.isSafeInteger(combined))
      console.warn(
        combined,
        'exceeds MAX_SAFE_INTEGER or MIN_SAFE_INTEGER. Precision may be lost'
      );

    return combined;
  }

  getString(byteOffset, littleEndian, length) {
    var output = '';
    for (var i = 0; i < length; i++) {
      let c = this.getUint8(byteOffset + i);
      if (c) {
        // filter out zero character codes (padding)
        output += String.fromCharCode(c);
      }
    }
    return decodeURIComponent(escape(output));
  }

  getVLENStruct(byteOffset, littleEndian, length) {
    // get the addressing information for VLEN data
    let item_size = this.getUint32(byteOffset, littleEndian);
    let collection_address = this.getUint64(byteOffset + 4, littleEndian);
    let object_index = this.getUint32(byteOffset + 12, littleEndian);
    return [item_size, collection_address, object_index];
  }

  /*
  generate_getFixedString(length: number) {
    var getter = function(byteoffset, littleEndian) {
      var output = "";
      for (var i=0; i<length; i++) {
        output += String.fromCharCode(this.getUint8(offset));
      }
      return output;
    }
    return getter.bind(this);
  }
  */
}

function getUint64(dataview, byteOffset, littleEndian) {
  // split 64-bit number into two 32-bit (4-byte) parts
  const left = dataview.getUint32(byteOffset, littleEndian);
  const right = dataview.getUint32(byteOffset + 4, littleEndian);

  // combine the two 32-bit values
  const combined = littleEndian
    ? left + 2 ** 32 * right
    : 2 ** 32 * left + right;

  if (!Number.isSafeInteger(combined))
    console.warn(combined, 'exceeds MAX_SAFE_INTEGER. Precision may be lost');

  return combined;
}

const VLEN_ADDRESS = new Map([
  ['item_size', 'I'],
  ['collection_address', 'Q'], //# 8 byte addressing,
  ['object_index', 'I']
]);
