/**
 * 邀请码生成与查重 — 后端服务设计 §6.3
 */
const { db } = require('./db');
const { INVITE_CHARS, INVITE_LENGTH, INVITE_MAX_RETRY } = require('../config');
const { bizError, CODES } = require('./errcode');

/**
 * 从字符集中随机取 n 位
 */
function randomCode(length) {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += INVITE_CHARS[Math.floor(Math.random() * INVITE_CHARS.length)];
  }
  return code;
}

/**
 * 生成唯一邀请码（查重最多 INVITE_MAX_RETRY 次）
 * @returns {Promise<string>}
 */
async function generateInviteCode() {
  for (let i = 0; i < INVITE_MAX_RETRY; i++) {
    const code = randomCode(INVITE_LENGTH);
    const hit = await db.collection('classes').where({ inviteCode: code }).count();
    if (hit.total === 0) return code;
  }
  throw bizError(CODES.SERVER_ERROR, '邀请码生成失败，请重试');
}

module.exports = { generateInviteCode, randomCode };
