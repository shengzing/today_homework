/**
 * 前端配置 — 与 cloudfunctions/api/config.js 保持同步
 * 两端的字数上限必须由同一份常量驱动
 */

const LIMITS = {
  NICKNAME_MAX: 12,
  NICKNAME_MIN: 1,
  TITLE_MAX: 20,
  TITLE_MIN: 1,
  CONTENT_MAX: 200,
  CONTENT_MIN: 1,
  CLASS_NAME_MAX: 20,
  CLASS_NAME_MIN: 1,
  CLASS_DESC_MAX: 40,
  CLASS_DESC_MIN: 0
};

const INVITE_LENGTH = 6;

module.exports = {
  LIMITS,
  INVITE_LENGTH
};
