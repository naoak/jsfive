import { _structure_size, _unpack_struct_from } from './core';

enum DataTypeClass {
  FIXED_POINT = 0,
  FLOATING_POINT = 1,
  TIME = 2,
  STRING = 3,
  BITFIELD = 4,
  OPAQUE = 5,
  COMPOUND = 6,
  REFERENCE = 7,
  ENUMERATED = 8,
  VARIABLE_LENGTH = 9,
  ARRAY = 10
}

const DATATYPE_MSG = new Map([
  ['class_and_version', 'B'],
  ['class_bit_field_0', 'B'],
  ['class_bit_field_1', 'B'],
  ['class_bit_field_2', 'B'],
  ['size', 'I']
]);
const DATATYPE_MSG_SIZE = _structure_size(DATATYPE_MSG);

/**
 * HDF5 DataType Message
 * Contents and layout defined in IV.A.2.d.
 */
export class DataTypeMessage {
  dtype: string | any[];

  constructor(public buf: ArrayBufferLike, public offset: number) {
    this.dtype = this._readDataType();
  }

  private _readDataType(): string | any[] {
    const msg = _unpack_struct_from(DATATYPE_MSG, this.buf, this.offset);
    this.offset += DATATYPE_MSG_SIZE;
    const classAndVersion = msg.get('class_and_version');
    const version = classAndVersion >> 4;
    const dataTypeClass = classAndVersion & 0x0f;

    switch (dataTypeClass) {
      case DataTypeClass.FIXED_POINT:
        return this._readDataTypeFixedPoint(msg);
      case DataTypeClass.FLOATING_POINT:
        return this._readDataTypeFloatingPoint(msg);
      case DataTypeClass.TIME:
        throw 'Time datatype class not supported.';
      case DataTypeClass.STRING:
        return this._readDataTypeString(msg);
      case DataTypeClass.BITFIELD:
        throw 'Bitfield datatype class not supported.';
      case DataTypeClass.OPAQUE:
        throw 'Opaque datatype class not supported.';
      case DataTypeClass.COMPOUND:
        return this._readDataTypeCompound(msg);
      case DataTypeClass.REFERENCE:
        return ['REFERENCE', msg.get('size')];
      case DataTypeClass.ENUMERATED:
        throw 'Enumerated datatype class not supported.';
      case DataTypeClass.VARIABLE_LENGTH:
        const vlenType = this._readDataTypeVLen(msg);
        if (vlenType[0] == 'VLEN_SEQUENCE') {
          const baseType = this._readDataType();
          return ['VLEN_SEQUENCE', baseType];
        } else {
          return vlenType;
        }
      case DataTypeClass.ARRAY:
        throw 'Array datatype class not supported.';
      default:
        throw 'Invalid datatype class ' + dataTypeClass;
    }
  }

  /**
   * Return the NumPy dtype for a fixed point class.
   * fixed-point types are assumed to follow IEEE standard format
   * @param msg
   */
  private _readDataTypeFixedPoint(msg: Map<string, number>) {
    let byteLength: number = msg.get('size');
    if (![1, 2, 4, 8].includes(byteLength)) {
      throw 'Unsupported datatype size';
    }
    const bitField0 = msg.get('class_bit_field_0');
    const signed = bitField0 & 0x08;
    const dtypeChar = signed > 0 ? 'i' : 'u';
    const byteOrder = bitField0 & 0x01;
    const byteOrderChar = byteOrder === 0 ? '<' : '>';

    //# 4-byte fixed-point property description
    //# not read, assumed to be IEEE standard format
    this.offset += 4;

    return byteOrderChar + dtypeChar + byteLength.toFixed();
  }

  /**
   * Return the NumPy dtype for a floating point class.
   * Floating point types are assumed to follow IEEE standard formats
   * @param msg
   */
  _readDataTypeFloatingPoint(msg: Map<string, number>) {
    let byteLength: number = msg.get('size');
    if (![1, 2, 4, 8].includes(byteLength)) {
      throw 'Unsupported datatype size';
    }
    const dtypeChar = 'f';
    const byteOrder = msg.get('class_bit_field_0') & 0x01;
    const byteOrderChar = byteOrder === 0 ? '<' : '>';

    //# 12-bytes floating-point property description
    //# not read, assumed to be IEEE standard format
    this.offset += 12;

    return byteOrderChar + dtypeChar + byteLength.toFixed();
  }

  _readDataTypeString(msg: Map<string, number>) {
    return 'S' + msg.get('size').toFixed();
  }

  _readDataTypeVLen(msg): [string, number, number] {
    const vlenType = msg.get('class_bit_field_0') & 0x01;
    switch (vlenType) {
      case 0:
        return ['VLEN_SEQUENCE', 0, 0];
      case 1: {
        const paddingType = msg.get('class_bit_field_0') >> 4; //# bits 4-7
        const characterSet = msg.get('class_bit_field_1') & 0x01;
        return ['VLEN_STRING', paddingType, characterSet];
      }
      default:
        throw `Unsupported vlentype: ${vlenType}`;
    }
  }

  _readDataTypeCompound(msg): any {
    throw 'not yet implemented!';
  }
}
