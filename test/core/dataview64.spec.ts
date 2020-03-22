import { DataView64 } from '../../src/core/dataview64';

describe('DataView64', () => {
  describe('getUint64()', () => {
    test('should get an Uint64 (little endian)', () => {
      const buf = new Uint8Array(8);
      const view = new DataView64(buf.buffer, 0);
      expect(view.getUint64(0, true)).toBe(0);
      buf[0] = 0xff;
      buf[1] = 0x00;
      buf[2] = 0x00;
      buf[3] = 0x00;
      buf[4] = 0x00;
      buf[5] = 0x00;
      buf[6] = 0x00;
      buf[7] = 0x00;
      expect(view.getUint64(0, true)).toBe(255);
      buf[0] = 0xff;
      buf[1] = 0xff;
      buf[2] = 0xff;
      buf[3] = 0xff;
      buf[4] = 0xff;
      buf[5] = 0xff;
      buf[6] = 0x1f;
      buf[7] = 0x00;
      expect(Number.isSafeInteger(view.getUint64(0, true))).toBe(true);
      expect(view.getUint64(0, true)).toBe(Number.MAX_SAFE_INTEGER);
      buf[0] = 0x00;
      buf[1] = 0x00;
      buf[2] = 0x00;
      buf[3] = 0x00;
      buf[4] = 0x00;
      buf[5] = 0x00;
      buf[6] = 0x20;
      buf[7] = 0x00;
      expect(Number.isSafeInteger(view.getUint64(0, true))).toBe(false);
    });

    test('should get an Uint64 value from array buffer (big endian)', () => {
      const buf = new Uint8Array(8);
      const view = new DataView64(buf.buffer, 0);
      expect(view.getUint64(0, false)).toBe(0);
      buf[7] = 0xff;
      buf[6] = 0x00;
      buf[5] = 0x00;
      buf[4] = 0x00;
      buf[3] = 0x00;
      buf[2] = 0x00;
      buf[1] = 0x00;
      buf[0] = 0x00;
      expect(view.getUint64(0, false)).toBe(255);
      buf[7] = 0xff;
      buf[6] = 0xff;
      buf[5] = 0xff;
      buf[4] = 0xff;
      buf[3] = 0xff;
      buf[2] = 0xff;
      buf[1] = 0x1f;
      buf[0] = 0x00;
      expect(Number.isSafeInteger(view.getUint64(0, false))).toBe(true);
      expect(view.getUint64(0, false)).toBe(Number.MAX_SAFE_INTEGER);
      buf[7] = 0x00;
      buf[6] = 0x00;
      buf[5] = 0x00;
      buf[4] = 0x00;
      buf[3] = 0x00;
      buf[2] = 0x00;
      buf[1] = 0x20;
      buf[0] = 0x00;
      expect(Number.isSafeInteger(view.getUint64(0, false))).toBe(false);
    });
  });

  describe('setUint64()', () => {
    test('should store an Uint64 (little endian)', () => {
      const buf = new Uint8Array(8);
      const view = new DataView64(buf.buffer, 0);
      view.setUint64(0, 255, true);
      expect(view.getUint64(0, true)).toBe(255);
      view.setUint64(0, Number.MAX_SAFE_INTEGER, true);
      expect(Number.isSafeInteger(view.getUint64(0, true))).toBe(true);
      expect(view.getUint64(0, true)).toBe(Number.MAX_SAFE_INTEGER);
      view.setUint64(0, 9007199254740992, true);
      expect(Number.isSafeInteger(view.getUint64(0, true))).toBe(false);
      expect(view.getUint64(0, true)).toBe(9007199254740992);
    });

    test('should store an Uint64 (big endian).', () => {
      const buf = new Uint8Array(8);
      const view = new DataView64(buf.buffer, 0);
      view.setUint64(0, 255, false);
      expect(view.getUint64(0, false)).toBe(255);
      view.setUint64(0, Number.MAX_SAFE_INTEGER, false);
      expect(Number.isSafeInteger(view.getUint64(0, false))).toBe(true);
      expect(view.getUint64(0, false)).toBe(Number.MAX_SAFE_INTEGER);
      view.setUint64(0, 9007199254740992, false);
      expect(Number.isSafeInteger(view.getUint64(0, false))).toBe(false);
      expect(view.getUint64(0, false)).toBe(9007199254740992);
    });
  });

  describe('getInt64()', () => {
    test('should get an Uint64 value (little endian, positive)', () => {
      const buf = new Uint8Array(8);
      const view = new DataView64(buf.buffer, 0);
      expect(view.getUint64(0, true)).toBe(0);
      buf[0] = 0xff;
      buf[1] = 0x00;
      buf[2] = 0x00;
      buf[3] = 0x00;
      buf[4] = 0x00;
      buf[5] = 0x00;
      buf[6] = 0x00;
      buf[7] = 0x00;
      expect(view.getUint64(0, true)).toBe(255);
      buf[0] = 0xff;
      buf[1] = 0xff;
      buf[2] = 0xff;
      buf[3] = 0xff;
      buf[4] = 0xff;
      buf[5] = 0xff;
      buf[6] = 0x1f;
      buf[7] = 0x00;
      expect(Number.isSafeInteger(view.getUint64(0, true))).toBe(true);
      expect(view.getUint64(0, true)).toBe(Number.MAX_SAFE_INTEGER);
      buf[0] = 0x00;
      buf[1] = 0x00;
      buf[2] = 0x00;
      buf[3] = 0x00;
      buf[4] = 0x00;
      buf[5] = 0x00;
      buf[6] = 0x20;
      buf[7] = 0x00;
      expect(Number.isSafeInteger(view.getUint64(0, true))).toBe(false);
    });

    test('should get an Int64 value (little endian, negative)', () => {
      const buf = new Uint8Array(8);
      const view = new DataView64(buf.buffer, 0);
      expect(view.getInt64(0, true)).toBe(0);
      buf[0] = 0xff;
      buf[1] = 0xff;
      buf[2] = 0xff;
      buf[3] = 0xff;
      buf[4] = 0xff;
      buf[5] = 0xff;
      buf[6] = 0xff;
      buf[7] = 0xff;
      expect(view.getInt64(0, true)).toBe(-1);
      buf[0] = 0x00;
      buf[1] = 0xff;
      buf[2] = 0xff;
      buf[3] = 0xff;
      buf[4] = 0xff;
      buf[5] = 0xff;
      buf[6] = 0xff;
      buf[7] = 0xff;
      expect(view.getInt64(0, true)).toBe(-256);
      buf[0] = 0x01;
      buf[1] = 0x00;
      buf[2] = 0x00;
      buf[3] = 0x00;
      buf[4] = 0x00;
      buf[5] = 0x00;
      buf[6] = 0xe0;
      buf[7] = 0xff;
      expect(Number.isSafeInteger(view.getInt64(0, true))).toBe(true);
      expect(view.getInt64(0, true)).toBe(Number.MIN_SAFE_INTEGER);
      buf[0] = 0x00;
      buf[1] = 0x00;
      buf[2] = 0x00;
      buf[3] = 0x00;
      buf[4] = 0x00;
      buf[5] = 0x00;
      buf[6] = 0xe0;
      buf[7] = 0xff;
      expect(Number.isSafeInteger(view.getInt64(0, true))).toBe(false);
    });

    test('should get an Uint64 value (big endian, positive)', () => {
      const buf = new Uint8Array(8);
      const view = new DataView64(buf.buffer, 0);
      expect(view.getUint64(0, false)).toBe(0);
      buf[7] = 0xff;
      buf[6] = 0x00;
      buf[5] = 0x00;
      buf[4] = 0x00;
      buf[3] = 0x00;
      buf[2] = 0x00;
      buf[1] = 0x00;
      buf[0] = 0x00;
      expect(view.getUint64(0, false)).toBe(255);
      buf[7] = 0xff;
      buf[6] = 0xff;
      buf[5] = 0xff;
      buf[4] = 0xff;
      buf[3] = 0xff;
      buf[2] = 0xff;
      buf[1] = 0x1f;
      buf[0] = 0x00;
      expect(Number.isSafeInteger(view.getUint64(0, false))).toBe(true);
      expect(view.getUint64(0, false)).toBe(Number.MAX_SAFE_INTEGER);
      buf[7] = 0x00;
      buf[6] = 0x00;
      buf[5] = 0x00;
      buf[4] = 0x00;
      buf[3] = 0x00;
      buf[2] = 0x00;
      buf[1] = 0x20;
      buf[0] = 0x00;
      expect(Number.isSafeInteger(view.getUint64(0, false))).toBe(false);
    });

    test('should get an Int64 value (big endian, negative)', () => {
      const buf = new Uint8Array(8);
      const view = new DataView64(buf.buffer, 0);
      expect(view.getInt64(0, false)).toBe(0);
      buf[7] = 0xff;
      buf[6] = 0xff;
      buf[5] = 0xff;
      buf[4] = 0xff;
      buf[3] = 0xff;
      buf[2] = 0xff;
      buf[1] = 0xff;
      buf[0] = 0xff;
      expect(view.getInt64(0, false)).toBe(-1);
      buf[7] = 0x00;
      buf[6] = 0xff;
      buf[5] = 0xff;
      buf[4] = 0xff;
      buf[3] = 0xff;
      buf[2] = 0xff;
      buf[1] = 0xff;
      buf[0] = 0xff;
      expect(view.getInt64(0, false)).toBe(-256);
      buf[7] = 0x01;
      buf[6] = 0x00;
      buf[5] = 0x00;
      buf[4] = 0x00;
      buf[3] = 0x00;
      buf[2] = 0x00;
      buf[1] = 0xe0;
      buf[0] = 0xff;
      expect(Number.isSafeInteger(view.getInt64(0, false))).toBe(true);
      expect(view.getInt64(0, false)).toBe(Number.MIN_SAFE_INTEGER);
      buf[7] = 0x00;
      buf[6] = 0x00;
      buf[5] = 0x00;
      buf[4] = 0x00;
      buf[3] = 0x00;
      buf[2] = 0x00;
      buf[1] = 0xe0;
      buf[0] = 0xff;
      expect(Number.isSafeInteger(view.getInt64(0, false))).toBe(false);
    });
  });

  describe('setInt64()', () => {
    test('should store an Int64 value (little endian, positive)', () => {
      const buf = new Uint8Array(8);
      const view = new DataView64(buf.buffer, 0);
      view.setInt64(0, 255, true);
      expect(view.getUint64(0, true)).toBe(255);
      view.setInt64(0, Number.MAX_SAFE_INTEGER, true);
      expect(Number.isSafeInteger(view.getUint64(0, true))).toBe(true);
      expect(view.getUint64(0, true)).toBe(Number.MAX_SAFE_INTEGER);
      view.setInt64(0, 9007199254740992, true);
      expect(Number.isSafeInteger(view.getInt64(0, true))).toBe(false);
      expect(view.getInt64(0, true)).toBe(9007199254740992);
    });

    test('should store an Int64 value (little endian, negative).', () => {
      const buf = new Uint8Array(8);
      const view = new DataView64(buf.buffer, 0);
      view.setInt64(0, -1, true);
      expect(view.getInt64(0, true)).toBe(-1);
      view.setInt64(0, -256, true);
      expect(view.getInt64(0, true)).toBe(-256);
      view.setInt64(0, Number.MIN_SAFE_INTEGER, true);
      expect(Number.isSafeInteger(view.getInt64(0, true))).toBe(true);
      expect(view.getInt64(0, true)).toBe(Number.MIN_SAFE_INTEGER);
      view.setInt64(0, -9007199254740992, true);
      expect(Number.isSafeInteger(view.getInt64(0, true))).toBe(false);
      expect(view.getInt64(0, true)).toBe(-9007199254740992);
    });

    test('should store an Int64 value (big endian, positive).', () => {
      const buf = new Uint8Array(8);
      const view = new DataView64(buf.buffer, 0);
      view.setInt64(0, 255, false);
      expect(view.getUint64(0, false)).toBe(255);
      view.setInt64(0, Number.MAX_SAFE_INTEGER, false);
      expect(Number.isSafeInteger(view.getUint64(0, false))).toBe(true);
      expect(view.getUint64(0, false)).toBe(Number.MAX_SAFE_INTEGER);
      view.setInt64(0, 9007199254740992, false);
      expect(Number.isSafeInteger(view.getInt64(0, false))).toBe(false);
      expect(view.getInt64(0, false)).toBe(9007199254740992);
    });

    test('should store an Int64 value (big endian, negative)', () => {
      const buf = new Uint8Array(8);
      const view = new DataView64(buf.buffer, 0);
      view.setInt64(0, -1, false);
      expect(view.getInt64(0, false)).toBe(-1);
      view.setInt64(0, -256, false);
      expect(view.getInt64(0, false)).toBe(-256);
      view.setInt64(0, Number.MIN_SAFE_INTEGER, false);
      expect(Number.isSafeInteger(view.getInt64(0, false))).toBe(true);
      expect(view.getInt64(0, false)).toBe(Number.MIN_SAFE_INTEGER);
      view.setInt64(0, -9007199254740992, false);
      expect(Number.isSafeInteger(view.getInt64(0, false))).toBe(false);
      expect(view.getInt64(0, false)).toBe(-9007199254740992);
    });
  });

  describe('getString()', () => {
    test('should get string from array buffer', () => {
      const text = 'abcdefgh';
      const buf = new Uint8Array(8);
      const view = new DataView64(buf.buffer, 0);
      for (let i = 0; i < 8; i++) {
        buf[i] = text.charCodeAt(i);
      }
      expect(view.getString(0, false, 8)).toBe(text);
      expect(view.getString(0, true, 8)).toBe(text);
    });

    test('should ignore zero char', () => {
      const text = 'abcdefgh';
      const buf = new Uint8Array(9);
      const view = new DataView64(buf.buffer, 0);
      for (let i = 0; i < 8; i++) {
        buf[i] = text.charCodeAt(i);
      }
      buf[8] = 0;
      expect(view.getString(0, false, 9)).toBe(text);
      expect(view.getString(0, true, 9)).toBe(text);
    });
  });

  describe('getVLENString()', () => {
    test('should get the addressing information for VLEN data (little endian)', () => {
      const buf = new Uint8Array(16);
      const view = new DataView64(buf.buffer, 0);
      view.setUint32(0, 1, false);
      view.setUint64(4, 2, false);
      view.setUint32(12, 3, false);
      expect(view.getVLENStruct(0, false)).toEqual([1, 2, 3]);
    });

    test('should get the addressing information for VLEN data (big endian)', () => {
      const buf = new Uint8Array(16);
      const view = new DataView64(buf.buffer, 0);
      view.setUint32(0, 1, true);
      view.setUint64(4, 2, true);
      view.setUint32(12, 3, true);
      expect(view.getVLENStruct(0, true)).toEqual([1, 2, 3]);
    });
  });
});
