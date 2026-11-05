/**
 * 入参校验 — 后端服务设计 §4.5
 */
const { bizError, CODES } = require('./errcode');
const { LIMITS } = require('../config');

/**
 * 校验字符串
 * @param {*} v - 值
 * @param {object} opts - { min, max, required, name }
 * @returns {string} 去空格后的字符串
 */
function str(v, opts = {}) {
  const { min = 0, max = 999, required = false, name = '字段' } = opts;
  if (v === undefined || v === null) {
    if (required) throw bizError(CODES.PARAM_INVALID, `请填写${name}`);
    return '';
  }
  const s = String(v).trim();
  if (s === '') {
    if (required) throw bizError(CODES.PARAM_INVALID, `请填写${name}`);
    return '';
  }
  if (s.length < min || s.length > max) {
    throw bizError(CODES.PARAM_INVALID, `${name}长度需在 ${min}-${max} 字之间`);
  }
  return s;
}

/**
 * 校验 ID（非空字符串）
 * @param {*} v - 值
 * @param {string} name - 字段名
 * @returns {string}
 */
function id(v, name = 'ID') {
  if (!v || typeof v !== 'string') {
    throw bizError(CODES.PARAM_INVALID, `缺少${name}`);
  }
  return v;
}

/**
 * 校验可选时间戳（number 或 Date 或 null）
 * @param {*} v
 * @returns {number|null} UTC 时间戳
 */
function optionalTimestamp(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return v;
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'string') {
    const d = new Date(v);
    if (isNaN(d.getTime())) throw bizError(CODES.PARAM_INVALID, '时间格式非法');
    return d.getTime();
  }
  throw bizError(CODES.PARAM_INVALID, '时间格式非法');
}

// ---- 便捷校验器 ----

function nickname(v) {
  return str(v, { min: LIMITS.NICKNAME_MIN, max: LIMITS.NICKNAME_MAX, required: true, name: '昵称' });
}

function title(v) {
  return str(v, { min: LIMITS.TITLE_MIN, max: LIMITS.TITLE_MAX, required: true, name: '作业标题' });
}

function content(v) {
  return str(v, { min: LIMITS.CONTENT_MIN, max: LIMITS.CONTENT_MAX, required: true, name: '作业内容' });
}

function className(v) {
  return str(v, { min: LIMITS.CLASS_NAME_MIN, max: LIMITS.CLASS_NAME_MAX, required: true, name: '班级名称' });
}

function classDesc(v) {
  return str(v, { min: LIMITS.CLASS_DESC_MIN, max: LIMITS.CLASS_DESC_MAX, required: false, name: '班级简介' });
}

module.exports = { str, id, optionalTimestamp, nickname, title, content, className, classDesc };
