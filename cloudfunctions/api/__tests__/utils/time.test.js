/**
 * utils/time 测试 — 后端服务设计 §12.4
 * 时区是全系统正确性的地基，覆盖率要求 100%
 */
const { startOfDay, endOfDay, dayKey, relativeDay } = require('../../utils/time');

describe('utils/time', () => {
  describe('startOfDay', () => {
    test('东八区 23:59:59 → 当天 00:00', () => {
      // 2026-11-05T15:59:59Z = 东八区 2026-11-05 23:59:59
      const ts = Date.UTC(2026, 10, 5, 15, 59, 59);
      const start = startOfDay(ts);
      // 东八区 11/5 00:00 = UTC 11/4 16:00
      expect(start).toBe(Date.UTC(2026, 10, 4, 16, 0, 0));
    });

    test('日界前一毫秒 → 仍属于当天', () => {
      // 2026-11-04T16:00:00Z = 东八区 11/5 00:00:00
      const ts = Date.UTC(2026, 10, 4, 16, 0, 0);
      const start = startOfDay(ts);
      expect(start).toBe(Date.UTC(2026, 10, 4, 16, 0, 0));
    });

    test('东八区 00:00:01 → 当天 00:00', () => {
      // 2026-11-04T16:00:01Z = 东八区 11/5 00:00:01
      const ts = Date.UTC(2026, 10, 4, 16, 0, 1);
      const start = startOfDay(ts);
      expect(start).toBe(Date.UTC(2026, 10, 4, 16, 0, 0));
    });

    test('东八区 12:00 → 当天 00:00', () => {
      // 2026-11-05T04:00:00Z = 东八区 11/5 12:00
      const ts = Date.UTC(2026, 10, 5, 4, 0, 0);
      expect(startOfDay(ts)).toBe(Date.UTC(2026, 10, 4, 16, 0, 0));
    });
  });

  describe('endOfDay', () => {
    test('等于 startOfDay + 24h', () => {
      const ts = Date.UTC(2026, 10, 5, 4, 0, 0); // 东八区 11/5 12:00
      expect(endOfDay(ts)).toBe(startOfDay(ts) + 24 * 60 * 60 * 1000);
    });
  });

  describe('dayKey', () => {
    test('东八区 23:59:59 → 当天日期', () => {
      const ts = Date.UTC(2026, 10, 5, 15, 59, 59);
      expect(dayKey(ts)).toBe('2026-11-05');
    });

    test('日界前一毫秒 → 下一天', () => {
      const ts = Date.UTC(2026, 10, 4, 16, 0, 0); // 东八区 11/5 00:00
      expect(dayKey(ts)).toBe('2026-11-05');
    });

    test('日界后一毫秒 → 仍是当天', () => {
      const ts = Date.UTC(2026, 10, 4, 15, 59, 59); // 东八区 11/4 23:59:59
      expect(dayKey(ts)).toBe('2026-11-04');
    });
  });

  describe('relativeDay', () => {
    const now = Date.UTC(2026, 10, 5, 4, 0, 0); // 东八区 11/5 12:00

    test('今天', () => {
      expect(relativeDay(now, now)).toBe('今天');
    });

    test('昨天', () => {
      const yesterday = now - 24 * 60 * 60 * 1000;
      expect(relativeDay(yesterday, now)).toBe('昨天');
    });

    test('明天', () => {
      const tomorrow = now + 24 * 60 * 60 * 1000;
      expect(relativeDay(tomorrow, now)).toBe('明天');
    });

    test('后天', () => {
      const dayAfter = now + 2 * 24 * 60 * 60 * 1000;
      expect(relativeDay(dayAfter, now)).toBe('后天');
    });

    test('前天', () => {
      const dayBefore = now - 2 * 24 * 60 * 60 * 1000;
      expect(relativeDay(dayBefore, now)).toBe('前天');
    });

    test('3 天后 → null', () => {
      const future = now + 3 * 24 * 60 * 60 * 1000;
      expect(relativeDay(future, now)).toBeNull();
    });

    test('null 输入 → null', () => {
      expect(relativeDay(null, now)).toBeNull();
    });
  });

  describe('回归用例', () => {
    test('若用 UTC 计算，11/5 作业会被划到 11/4', () => {
      // 东八区 11/5 00:30 = UTC 11/4 16:30
      const ts = Date.UTC(2026, 10, 4, 16, 30, 0);
      // dayKey 必须返回东八区日期
      expect(dayKey(ts)).toBe('2026-11-05');
      // 不能返回 2026-11-04
      expect(dayKey(ts)).not.toBe('2026-11-04');
    });
  });
});
