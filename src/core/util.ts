import { struct } from './struct';

export function assert(thing: any) {
  if (!thing) {
    thing();
  }
}

export function unpackStructFrom<V>(
  structure: Map<string, V>,
  buf: ArrayBuffer | SharedArrayBuffer,
  offset = 0
) {
  const fmt = '<' + Array.from(structure.values()).join('');
  const values = struct.unpackFrom(fmt, buf, offset);
  const keys = Array.from(structure.keys());
  const output = new Map<string, any>();
  for (var i = 0; i < keys.length; i++) {
    output.set(keys[i], values[i]);
  }
  return output;
}

export function structureSize(structure: Map<any, any>) {
  //""" Return the size of a structure in bytes. """
  var fmt = '<' + Array.from(structure.values()).join('');
  return struct.calcSize(fmt);
}

export function paddedSize(size: number, padding_multiple = 8) {
  //""" Return the size of a field padded to be a multiple a given value. """
  return Math.ceil(size / padding_multiple) * padding_multiple;
}

const dtype_to_format = {
  u: 'Uint',
  i: 'Int',
  f: 'Float'
};

export function dtype_getter(dtype_str: string): [string, boolean, number] {
  let big_endian = struct.isBigEndian(dtype_str);
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
