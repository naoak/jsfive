import { TextDecoder, TextEncoder } from 'util';

export interface DataView64Options {
  // The length (in bytes) of this view from the start of its ArrayBuffer.
  // Fixed at construction time and thus read only.
  readonly byteOffset?: number;

  // The offset (in bytes) of this view from the start of its ArrayBuffer.
  // Fixed at construction time and thus read only.
  readonly byteLength?: number;

  // If true, warn 64bit integer value when it is not safe integer
  readonly warnOverflow?: boolean;
}

export class DataView64 extends DataView {
  warnOverflow: boolean;

  constructor(buffer: ArrayBufferLike, options: DataView64Options = {}) {
    super(buffer, options.byteOffset, options.byteLength);
    this.warnOverflow = !!options.warnOverflow;
  }

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

    if (this.warnOverflow && !Number.isSafeInteger(combined)) {
      console.warn(combined, 'exceeds MAX_SAFE_INTEGER. Precision may be lost');
    }
    return combined;
  }

  /**
   * Stores an Uint64 value at the specified byte offset from the start of the view.
   * @param byteOffset
   * @param value
   * @param littleEndian
   */
  setUint64(byteOffset: number, value: number, littleEndian?: boolean) {
    if (this.warnOverflow && !Number.isSafeInteger(value)) {
      console.warn(value, 'exceeds MAX_SAFE_INTEGER. Precision may be lost');
    }
    let low: number = value & 0x00000000ffffffff;
    low = low < 0 ? 0x100000000 + low : low;
    const high: number = (value - low) / 2 ** 32;

    if (littleEndian) {
      this.setUint32(byteOffset, low, true);
      this.setUint32(byteOffset + 4, high, true);
    } else {
      this.setUint32(byteOffset, high, false);
      this.setUint32(byteOffset + 4, low, false);
    }
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

    if (this.warnOverflow && !Number.isSafeInteger(combined)) {
      console.warn(
        combined,
        'exceeds MAX_SAFE_INTEGER or MIN_SAFE_INTEGER. Precision may be lost'
      );
    }
    return combined;
  }

  /**
   * Stores an Int64 value at the specified byte offset from the start of the view.
   * @param byteOffset
   * @param value
   * @param littleEndian
   */
  setInt64(byteOffset: number, value: number, littleEndian?: boolean) {
    if (this.warnOverflow && !Number.isSafeInteger(value)) {
      console.warn(value, 'exceeds MAX_SAFE_INTEGER. Precision may be lost');
    }

    let low: number = value & 0x00000000ffffffff;
    low = low < 0 ? 0x100000000 + low : low;
    const high: number = (value - low) / 2 ** 32;

    if (littleEndian) {
      this.setInt32(byteOffset, low, true);
      this.setInt32(byteOffset + 4, high, true);
    } else {
      this.setInt32(byteOffset, high, false);
      this.setUint32(byteOffset + 4, low, false);
    }
  }

  /**
   * Get string from buffer
   * @param byteOffset
   * @param length
   */
  getString(byteOffset: number, length: number) {
    const decoder = new TextDecoder();
    const textBuffer = this.buffer.slice(byteOffset, length);
    return decoder.decode(textBuffer);
  }

  /**
   * Stores a string at the specified byte offset from the start of the view.
   * @param byteOffset
   * @param text
   * @return text buffer length
   */
  setString(byteOffset: number, text: string): number {
    const encoder = new TextEncoder();
    const buf = encoder.encode(text);
    const length = buf.length;
    for (let i = 0; i < length; i++) {
      this.setUint8(byteOffset + i, buf[i]);
    }
    return length;
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
