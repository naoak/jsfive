import { TextEncoder } from 'util';
import { isSystemBigEndian, struct } from '../../src/core/struct';
import { unpackStructFrom } from '../../src/core';

describe('struct', () => {
  describe('isSystemBigEndian()', () => {
    it('would be false on almost all cpu', () => {
      expect(isSystemBigEndian()).toBe(false);
    });
  });

  describe('calcSize()', () => {
    test('s => 1', () => {
      expect(struct.calcSize('s')).toBe(1);
    });

    test('b => 1', () => {
      expect(struct.calcSize('b')).toBe(1);
    });

    test('B => 1', () => {
      expect(struct.calcSize('B')).toBe(1);
    });

    test('h => 2', () => {
      expect(struct.calcSize('h')).toBe(2);
    });

    test('H => 2', () => {
      expect(struct.calcSize('H')).toBe(2);
    });

    test('i => 4', () => {
      expect(struct.calcSize('i')).toBe(4);
    });

    test('I => 4', () => {
      expect(struct.calcSize('I')).toBe(4);
    });

    test('l => 4', () => {
      expect(struct.calcSize('l')).toBe(4);
    });

    test('L => 4', () => {
      expect(struct.calcSize('L')).toBe(4);
    });

    test('q => 8', () => {
      expect(struct.calcSize('q')).toBe(8);
    });

    test('Q => 8', () => {
      expect(struct.calcSize('Q')).toBe(8);
    });

    test('f => 4', () => {
      expect(struct.calcSize('f')).toBe(4);
    });

    test('d => 8', () => {
      expect(struct.calcSize('d')).toBe(8);
    });

    test('8f4bf => 40', () => {
      expect(struct.calcSize('8f4bf')).toBe(40);
    });

    test('sbBhHiIlLqQfd => 51', () => {
      expect(struct.calcSize('sbBhHiIlLqQfd')).toBe(51);
    });

    test('<sbBhHiIlLqQfd => 51', () => {
      expect(struct.calcSize('<sbBhHiIlLqQfd')).toBe(51);
    });

    test('>sbBhHiIlLqQfd => 51', () => {
      expect(struct.calcSize('>sbBhHiIlLqQfd')).toBe(51);
    });

    test('!sbBhHiIlLqQfd => 51', () => {
      expect(struct.calcSize('!sbBhHiIlLqQfd')).toBe(51);
    });
  });

  describe('isBigEndian()', () => {
    test('<i => false', () => {
      expect(struct.isBigEndian('<i')).toBe(false);
    });

    test('>i => true', () => {
      expect(struct.isBigEndian('>i')).toBe(true);
    });

    test('!i => true', () => {
      expect(struct.isBigEndian('>i')).toBe(true);
    });

    test('i => system endian', () => {
      expect(struct.isBigEndian('i')).toBe(isSystemBigEndian());
    });
  });

  describe('unpackFrom()', () => {
    test('3s => ["abc"] (ascii)', () => {
      const text = 'abc';
      const buf = new Uint8Array(text.length);
      for (let i = 0; i < text.length; i++) {
        buf[i] = text.charCodeAt(i);
      }
      expect(struct.unpackFrom('3s', buf.buffer)).toEqual(['abc']);
    });

    test('15s => ["こんにちは"] (utf8)', () => {
      const text = 'こんにちは';
      const enc = new TextEncoder();
      const buf = enc.encode(text);
      expect(buf.byteLength).toBe(15);
      expect(struct.unpackFrom('15s', buf.buffer)).toEqual([text]);
    });

    /*
    test('b => 1', () => {
      expect(struct.calcSize('b')).toBe(1);
    });

    test('B => 1', () => {
      expect(struct.calcSize('B')).toBe(1);
    });

    test('h => 2', () => {
      expect(struct.calcSize('h')).toBe(2);
    });

    test('H => 2', () => {
      expect(struct.calcSize('H')).toBe(2);
    });

    test('i => 4', () => {
      expect(struct.calcSize('i')).toBe(4);
    });

    test('I => 4', () => {
      expect(struct.calcSize('I')).toBe(4);
    });

    test('l => 4', () => {
      expect(struct.calcSize('l')).toBe(4);
    });

    test('L => 4', () => {
      expect(struct.calcSize('L')).toBe(4);
    });

    test('q => 8', () => {
      expect(struct.calcSize('q')).toBe(8);
    });

    test('Q => 8', () => {
      expect(struct.calcSize('Q')).toBe(8);
    });

    test('f => 4', () => {
      expect(struct.calcSize('f')).toBe(4);
    });

    test('d => 8', () => {
      expect(struct.calcSize('d')).toBe(8);
    });
    */
  });
});
