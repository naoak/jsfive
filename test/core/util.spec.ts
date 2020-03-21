import { assert } from '../../src/core/util';

describe('core/util', () => {
  describe('assert()', () => {
    test('should throw an error if a specified argument is falsy', () => {
      expect(() => assert(false)).toThrow();
    });
  });
});
