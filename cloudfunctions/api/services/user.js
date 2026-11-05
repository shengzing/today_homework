/**
 * 用户服务 — login / updateNickname
 * 文档引用：后端服务设计 §5 接口清单
 */
const { db } = require('../utils/db');
const { bizError, CODES } = require('../utils/errcode');
const { validate } = require('../utils/validate');
const { nickname } = require('../utils/validate');
const { randomAvatarColor } = require('../config');

/**
 * 登录/注册
 * @param {object} payload - { nickname?, avatarUrl?, avatarColor? }
 * @param {object} ctx
 * @returns {Promise<{userId, nickname, avatarUrl, avatarColor, isNew}>}
 */
async function login(payload = {}, ctx) {
  const nicknameVal = payload.nickname ? nickname(payload.nickname) : '';
  const avatarUrl = payload.avatarUrl || '';
  const avatarColor = payload.avatarColor || randomAvatarColor();

  // 查是否已注册
  const existing = await db.collection('users')
    .where({ openid: ctx.openid }).limit(1).get();

  if (existing.data.length) {
    const user = existing.data[0];
    // 如果传了新昵称则更新
    if (nicknameVal && nicknameVal !== user.nickname) {
      await db.collection('users').doc(user._id).update({
        data: { nickname: nicknameVal }
      });
      user.nickname = nicknameVal;
    }
    return {
      userId: user._id,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl || '',
      avatarColor: user.avatarColor || avatarColor,
      isNew: false
    };
  }

  // 新用户注册
  const now = new Date();
  const addRes = await db.collection('users').add({
    data: {
      openid: ctx.openid,
      nickname: nicknameVal || '微信用户',
      avatarUrl: avatarUrl,
      avatarColor: avatarColor,
      createdAt: now
    }
  });

  return {
    userId: addRes._id,
    nickname: nicknameVal || '微信用户',
    avatarUrl: avatarUrl,
    avatarColor: avatarColor,
    isNew: true
  };
}

/**
 * 修改昵称
 * @param {object} payload - { nickname }
 * @param {object} ctx
 */
async function updateNickname(payload = {}, ctx) {
  const nicknameVal = nickname(payload.nickname);

  await db.collection('users').doc(ctx.userId).update({
    data: { nickname: nicknameVal }
  });

  return { nickname: nicknameVal };
}

module.exports = { login, updateNickname };
