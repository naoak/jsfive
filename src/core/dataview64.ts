const WARN_OVERFLOW = true;

export class DataView64 extends DataView {
  /**
   * Get Uint64 value by splitting 64-bit number into two 32-bit (4-byte) parts
   * @param byteOffset
   * @param littleEndian
   */
  getUint64(byteOffset: number, littleEndian?: boolean) {
    const left = this.getUint32(byteOffset, littleEndian);
    const right = this.getUint32(byteOffset + 4, littleEndian);

    const combined = littleEndian
      ? left + 2 ** 32 * right
      : 2 ** 32 * left + right;

    if (WARN_OVERFLOW && !Number.isSafeInteger(combined)) {
      console.warn(combined, 'exceeds MAX_SAFE_INTEGER. Precision may be lost');
    }
    return combined;
  }

  /**
   * Get Int64 value by splitting 64-bit number into two 32-bit (4-byte) parts
   * (untested!!)
   * @param byteOffset
   * @param littleEndian
   */
  getInt64(byteOffset: number, littleEndian?: boolean) {
    let low: number;
    let high: number;

    if (littleEndian) {
      low = this.getUint32(byteOffset, true);
      high = this.getInt32(byteOffset + 4, true);
    } else {
      high = this.getInt32(byteOffset, false);
      low = this.getUint32(byteOffset + 4, false);
    }

    const combined = low + high * 2 ** 32;

    if (WARN_OVERFLOW && !Number.isSafeInteger(combined)) {
      console.warn(
        combined,
        'exceeds MAX_SAFE_INTEGER or MIN_SAFE_INTEGER. Precision may be lost'
      );
    }
    return combined;
  }

  getString(byteOffset: number, _littleEndian: boolean, length: number) {
    let output = '';
    for (var i = 0; i < length; i++) {
      const c = this.getUint8(byteOffset + i);
      // filter out zero character codes (padding)
      if (c) {
        output += String.fromCharCode(c);
      }
    }
    return decodeURIComponent(escape(output));
  }

  /**
   * Get the addressing information for VLEN data
   * @param byteOffset
   * @param littleEndian
   */
  getVLENStruct(
    byteOffset: number,
    littleEndian: boolean
  ): [number, number, number] {
    const item_size = this.getUint32(byteOffset, littleEndian);
    const collection_address = this.getUint64(byteOffset + 4, littleEndian);
    const object_index = this.getUint32(byteOffset + 12, littleEndian);
    return [item_size, collection_address, object_index];
  }
}
