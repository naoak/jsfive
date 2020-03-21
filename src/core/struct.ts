import { DataView64 } from './dataview64';

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
