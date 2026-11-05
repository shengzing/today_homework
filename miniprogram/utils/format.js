/**
 * 时间文案格式化 — 小程序详细设计 §13.3 format 测试用例
 * 客户端时间仅用于展示文案，排名与状态以服务端为准
 * 所有显示使用 UTC+8 计算，不依赖手机本地时区
 */

const TZ_OFFSET_MS = 8 * 60 * 60 * 1000;

function _startOfDay(now) {
  const d = now instanceof Date ? now : new Date(now);
  const shifted = new Date(d.getTime() + TZ_OFFSET_MS);
  return Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - TZ_OFFSET_MS;
}

function relativeDay(target, now) {
  if (!target) return null;
  const t = new Date(target);
  const n = now || new Date();
  const diff = Math.round((_startOfDay(t) - _startOfDay(n)) / 86400000);
  if (diff === 0) return '今天';
  if (diff === -1) return '昨天';
  if (diff === 1) return '明天';
  if (diff === 2) return '后天';
  if (diff === -2) return '前天';
  return null;
}

function _formatTime(ts) {
  // 转 UTC+8 后用 getUTCHours/getUTCMinutes 显示
  const d = new Date(ts + TZ_OFFSET_MS);
  const h = String(d.getUTCHours()).padStart(2, '0');
  const m = String(d.getUTCMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function _formatDate(ts) {
  const d = new Date(ts + TZ_OFFSET_MS);
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${mo}月${day}日`;
}

function deadlineText(deadline, now) {
  if (!deadline) return null;
  const n = now || new Date();
  const rel = relativeDay(deadline, n);
  const time = _formatTime(deadline);

  if (n.getTime() > deadline) {
    if (rel) return `已于 ${rel} ${time} 截止`;
    return `已于 ${_formatDate(deadline)} ${time} 截止`;
  }

  if (rel) return `${rel} ${time} 截止`;
  return `${_formatDate(deadline)} ${time} 截止`;
}

function percent(done, total) {
  if (!total || total === 0) return 0;
  return Math.round(done / total * 100);
}

module.exports = { relativeDay, deadlineText, percent };
