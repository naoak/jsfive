import { DataView64 } from './dataview64';

export function isSystemBigEndian() {
  const array = new Uint8Array(4);
  const view = new Uint32Array(array.buffer);
  return !((view[0] = 1) & array[0]);
}

interface StructGetters {
  readonly s: 'getUint8';
  readonly b: 'getInt8';
  readonly B: 'getUint8';
  readonly h: 'getInt16';
  readonly H: 'getUint16';
  readonly i: 'getInt32';
  readonly I: 'getUint32';
  readonly l: 'getInt32';
  readonly L: 'getUint32';
  readonly q: 'getInt64';
  readonly Q: 'getUint64';
  readonly f: 'getFloat32';
  readonly d: 'getFloat64';
}

type StructGetterKey = keyof StructGetters;
type StructGetterName = StructGetters[StructGetterKey];

class Struct {
  bigEndian = isSystemBigEndian();

  structGetters: StructGetters = {
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

  structByteLengths: { [key in StructGetterKey]: number } = {
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

  reFmtSize = '(\\d*)([' + Object.keys(this.structByteLengths).join('') + '])';

  calcSize(fmt: string) {
    let size = 0;
    let match: RegExpExecArray;
    const regex = new RegExp(this.reFmtSize, 'g');
    while ((match = regex.exec(fmt))) {
      const n = parseInt(match[1] || '1', 10);
      const f = match[2] as StructGetterKey;
      const subsize = this.structByteLengths[f];
      size += n * subsize;
    }
    return size;
  }

  isBigEndian(fmt: string) {
    let bigEndian: boolean;
    if (/^</.test(fmt)) {
      bigEndian = false;
    } else if (/^(!|>)/.test(fmt)) {
      bigEndian = true;
    } else {
      bigEndian = this.bigEndian;
    }
    return bigEndian;
  }

  unpackFrom(
    fmt: string,
    buffer: ArrayBuffer | SharedArrayBuffer,
    offset: number = 0
  ) {
    const view = new DataView64(buffer, 0);
    const bigEndian = this.isBigEndian(fmt);
    let match: RegExpExecArray;
    const regex = new RegExp(this.reFmtSize, 'g');
    const output = [];
    while ((match = regex.exec(fmt)) !== null) {
      const n = parseInt(match[1] || '1', 10);
      const f = match[2] as StructGetterKey;
      const getter = this.structGetters[f];
      const size = this.structByteLengths[f];
      var append_target;
      if (f == 's') {
        var sarray = new Array();
        append_target = sarray;
      } else {
        append_target = output;
      }
      for (let i = 0; i < n; i++) {
        append_target.push(view[getter](offset, !bigEndian));
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
