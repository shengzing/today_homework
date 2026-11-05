/**
 * utils/validate 测试 — 后端服务设计 §12.4
 */
const { str, id, optionalTimestamp } = require('../../utils/validate');
const { BizError, CODES } = require('../../utils/errcode');

describe('utils/validate', () => {
  describe('str', () => {
    test('正常字符串', () => {
      expect(str('hello', { min: 1, max: 20 })).toBe('hello');
    });

    test('去空格', () => {
      expect(str('  a  ', { min: 1, max: 20 })).toBe('a');
    });

    test('空串 + required → 抛 40001', () => {
      expect(() => str('', { required: true, name: '昵称' })).toThrow(BizError);
      try {
        str('', { required: true, name: '昵称' });
      } catch (e) {
        expect(e.bizCode).toBe(CODES.PARAM_INVALID);
      }
    });

    test('undefined + required → 抛 40001', () => {
      expect(() => str(undefined, { required: true })).toThrow(BizError);
    });

    test('空白串 + required → 抛 40001', () => {
      expect(() => str('   ', { required: true })).toThrow(BizError);
    });

    test('空串 + 非必填 → 返回空串', () => {
      expect(str('', { min: 0, max: 40 })).toBe('');
    });

    test('undefined + 非必填 → 返回空串', () => {
      expect(str(undefined)).toBe('');
    });

    test('恰好等于 min', () => {
      expect(str('ab', { min: 2, max: 5 })).toBe('ab');
    });

    test('min-1 → 抛 40001', () => {
      expect(() => str('a', { min: 2, max: 5 })).toThrow(BizError);
    });

    test('恰好等于 max', () => {
      expect(str('abcde', { min: 1, max: 5 })).toBe('abcde');
    });

    test('max+1 → 抛 40001', () => {
      expect(() => str('abcdef', { min: 1, max: 5 })).toThrow(BizError);
    });
  });

  describe('id', () => {
    test('正常 ID', () => {
      expect(id('abc123', '作业ID')).toBe('abc123');
    });

    test('空串 → 抛 40001', () => {
      expect(() => id('', 'ID')).toThrow(BizError);
    });

    test('数字 → 抛 40001', () => {
      expect(() => id(123, 'ID')).toThrow(BizError);
    });

    test('undefined → 抛 40001', () => {
      expect(() => id(undefined, 'ID')).toThrow(BizError);
    });

    test('对象 → 抛 40001', () => {
      expect(() => id({ foo: 1 }, 'ID')).toThrow(BizError);
    });
  });

  describe('optionalTimestamp', () => {
    test('null → null', () => {
      expect(optionalTimestamp(null)).toBeNull();
    });

    test('undefined → null', () => {
      expect(optionalTimestamp(undefined)).toBeNull();
    });

    test('number → 原值', () => {
      expect(optionalTimestamp(1700000000000)).toBe(1700000000000);
    });

    test('Date → getTime()', () => {
      const d = new Date('2026-11-05T16:00:00Z');
      expect(optionalTimestamp(d)).toBe(d.getTime());
    });

    test('合法字符串 → 时间戳', () => {
      expect(optionalTimestamp('2026-11-05T16:00:00Z')).toBe(Date.parse('2026-11-05T16:00:00Z'));
    });

    test('非法字符串 → 抛 40001', () => {
      expect(() => optionalTimestamp('not-a-date')).toThrow(BizError);
    });

    test('对象 → 抛 40001', () => {
      expect(() => optionalTimestamp({ foo: 1 })).toThrow(BizError);
    });
  });
});
