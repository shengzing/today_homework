/**
 * 时区工具 — 全系统正确性的地基
 * 统一使用 Asia/Shanghai (UTC+8)，云函数运行时为 UTC
 * 文档引用：后端服务设计 §1.4
 */

const TZ_OFFSET_MIN = 8 * 60; // Asia/Shanghai, MVP 无夏令时

/**
 * 返回东八区当天 00:00:00 的 UTC 时间戳
 * @param {Date|number} now - 当前时间，默认 new Date()
 * @returns {number} UTC 时间戳（毫秒）
 */
function startOfDay(now) {
  const d = now instanceof Date ? now : new Date(now || Date.now());
  // 东八区当前日期（把 UTC 时间 +8h 后取年月日）
  const shifted = new Date(d.getTime() + TZ_OFFSET_MIN * 60 * 1000);
  const dayStartShifted = Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate()
  );
  // 转回真实 UTC 时间戳（减去偏移）
  return dayStartShifted - TZ_OFFSET_MIN * 60 * 1000;
}

/**
 * 返回东八区当天 24:00:00（即次日 00:00）的 UTC 时间戳
 * @param {Date|number} now
 * @returns {number}
 */
function endOfDay(now) {
  return startOfDay(now) + 24 * 60 * 60 * 1000;
}

/**
 * 返回东八区日期 key，格式 'YYYY-MM-DD'
 * @param {Date|number} now
 * @returns {string}
 */
function dayKey(now) {
  const d = now instanceof Date ? now : new Date(now || Date.now());
  const shifted = new Date(d.getTime() + TZ_OFFSET_MIN * 60 * 1000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const day = String(shifted.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * 返回相对日期文案（仅今天/昨天/明天/后天/前天）
 * @param {Date|number} target - 目标时间
 * @param {Date|number} now - 当前时间，默认 new Date()
 * @returns {string|null} '今天'|'昨天'|'明天'|'后天'|'前天'|null
 */
function relativeDay(target, now) {
  if (!target) return null;
  const t = target instanceof Date ? target : new Date(target);
  const n = now instanceof Date ? now : new Date(now || Date.now());
  const diff = Math.round(
    (startOfDay(t) - startOfDay(n)) / (24 * 60 * 60 * 1000)
  );
  if (diff === 0) return '今天';
  if (diff === -1) return '昨天';
  if (diff === 1) return '明天';
  if (diff === 2) return '后天';
  if (diff === -2) return '前天';
  return null;
}

module.exports = { startOfDay, endOfDay, dayKey, relativeDay, TZ_OFFSET_MIN };
