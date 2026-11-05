/**
 * 鉴权工具 — 后端服务设计 §4.3
 */
const { db } = require('./db');
const { bizError, CODES } = require('./errcode');
const cloud = require('wx-server-sdk');

/**
 * 构建上下文：openid → userId
 * 未获取到微信身份 → 40100
 * openid 在 users 中不存在 → 40101
 * @returns {Promise<{openid: string, userId: string, nickname: string}>}
 */
async function buildContext() {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) throw bizError(CODES.NO_WX_IDENTITY, '未获取到微信身份');

  const res = await db.collection('users').where({ openid: OPENID }).limit(1).get();
  if (!res.data.length) throw bizError(CODES.NOT_LOGGED_IN, '请先完成授权登录');

  const user = res.data[0];
  return {
    openid: OPENID,
    userId: user._id,
    nickname: user.nickname
  };
}

/**
 * 校验是班级成员，返回成员记录
 * @param {string} classId
 * @param {object} ctx - buildContext 返回值
 * @returns {Promise<{_id: string, classId: string, userId: string, role: string, joinedAt: Date}>}
 */
async function requireMember(classId, ctx) {
  const res = await db.collection('class_members')
    .where({ classId, userId: ctx.userId }).limit(1).get();
  if (!res.data.length) throw bizError(CODES.NOT_MEMBER, '你不在该班级中');
  return res.data[0];
}

/**
 * 校验是班级管理员
 * @param {string} classId
 * @param {object} ctx
 * @returns {Promise<object>} 成员记录（role='owner'）
 */
async function requireOwner(classId, ctx) {
  const member = await requireMember(classId, ctx);
  if (member.role !== 'owner') throw bizError(CODES.NOT_OWNER, '只有管理员可以执行此操作');
  return member;
}

/**
 * 批量获取用户昵称（减少重复查询）
 * @param {string[]} userIds
 * @returns {Promise<Map<string, {nickname: string, avatarUrl: string, avatarColor: string}>>}
 */
async function batchGetUsers(userIds) {
  if (!userIds.length) return new Map();
  const unique = [...new Set(userIds)];
  const res = await db.collection('users')
    .where({ _id: db.command.in(unique) }).limit(unique.length).get();
  const map = new Map();
  res.data.forEach(u => {
    map.set(u._id, {
      nickname: u.nickname,
      avatarUrl: u.avatarUrl || '',
      avatarColor: u.avatarColor || '#FF6B6B'
    });
  });
  return map;
}

module.exports = { buildContext, requireMember, requireOwner, batchGetUsers };
