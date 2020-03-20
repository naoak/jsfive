import { assert } from '../src/core';

describe('core', () => {
  describe('assert()', () => {
    test('should throw an error if a specified argument is falsy', () => {
      expect(() => assert(false)).toThrow();
    });
  });
});
