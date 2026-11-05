/**
 * 共享配置 — 前后端字数限制、邀请码字符集、计分规则、分页上限
 * 前端 miniprogram/utils/config.js 手动同步此文件
 */

// ---- 字数限制 ----
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

// ---- 邀请码 ----
const INVITE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 去掉易混淆的 I O 0 1
const INVITE_LENGTH = 6;
const INVITE_MAX_RETRY = 10;

// ---- 计分规则 ----
const POINTS = {
  FIRST: 3,
  SECOND: 2,
  OTHER: 1
};

function pointsOf(rank) {
  if (!rank || rank <= 0) return 0;
  if (rank === 1) return POINTS.FIRST;
  if (rank === 2) return POINTS.SECOND;
  return POINTS.OTHER;
}

// ---- 分页上限 ----
const PAGE_LIMITS = {
  MEMBERS: 100,
  ASSIGNMENTS: 200,
  CLASSES: 50,
  RANKING: 100,
  ACHIEVEMENT: 100
};

// ---- 头像色板 ----
const AVATAR_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A',
  '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
  '#F8B739', '#52BE80', '#EC7063', '#5DADE2'
];

function randomAvatarColor() {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

module.exports = {
  LIMITS,
  INVITE_CHARS,
  INVITE_LENGTH,
  INVITE_MAX_RETRY,
  POINTS,
  pointsOf,
  PAGE_LIMITS,
  AVATAR_COLORS,
  randomAvatarColor
};
