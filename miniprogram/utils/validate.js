/**
 * 表单校验（客户端即时反馈）— 小程序详细设计 §13.3 validate
 * 与后端 config.js 保持同步
 * 返回空字符串表示通过，非空字符串为错误文案
 */
const { LIMITS } = require('./config');

function str(v, { min = 0, max = 999, required = false, name = '字段' }) {
  if (v === undefined || v === null) {
    if (required) return `${name}不能为空`;
    return '';
  }
  const s = String(v).trim();
  if (s === '') {
    if (required) return `${name}不能为空`;
    return '';
  }
  if (s.length < min) return `${name}至少 ${min} 字`;
  if (s.length > max) return `${name}不能超过 ${max} 字`;
  return '';
}

function title(v) {
  return str(v, { min: LIMITS.TITLE_MIN, max: LIMITS.TITLE_MAX, required: true, name: '标题' });
}

function content(v) {
  return str(v, { min: LIMITS.CONTENT_MIN, max: LIMITS.CONTENT_MAX, required: true, name: '内容' });
}

function className(v) {
  return str(v, { min: LIMITS.CLASS_NAME_MIN, max: LIMITS.CLASS_NAME_MAX, required: true, name: '班级名称' });
}

function classDesc(v) {
  return str(v, { min: LIMITS.CLASS_DESC_MIN, max: LIMITS.CLASS_DESC_MAX, required: false, name: '班级简介' });
}

function inviteCode(v) {
  if (!v) return '请输入邀请码';
  const s = String(v).trim().toUpperCase();
  if (s.length !== 6) return '邀请码为 6 位';
  if (!/^[A-HJ-NP-Z2-9]+$/.test(s)) return '邀请码格式不正确';
  return '';
}

const validate = { str, title, content, className, classDesc, inviteCode };

module.exports = { validate, str, title, content, className, classDesc, inviteCode };
