/**
require("./testHelper");

 * index.js 入口测试 — 后端服务设计 §12.4 index.test.js
 */
const cloud = require('wx-server-sdk');
const db = cloud.database();
const { main } = require('../index');
const { CODES } = require('../utils/errcode');

async function registerUser(openid, nickname) {
  cloud.__setOpenid(openid);
  await db.collection('users').add({
    data: { openid, nickname: nickname || '测试', avatarColor: '#FF6B6B', createdAt: new Date() }
  });
}

describe('index.js — 入口路由', () => {
  test('未知 action → 40000', async () => {
    const res = await main({ action: 'nonexistent', payload: {} });
    expect(res.code).toBe(CODES.UNKNOWN_ACTION);
  });

  test('未获取到微信身份 → 40100', async () => {
    cloud.__setOpenid(null);
    const origGetWX = cloud.getWXContext;
    cloud.getWXContext = () => ({ OPENID: null });
    const res = await main({ action: 'login', payload: {} });
    expect(res.code).toBe(CODES.NO_WX_IDENTITY);
    cloud.getWXContext = origGetWX;
  });

  test('未注册用户 → 40101', async () => {
    cloud.__setOpenid('openid_not_registered');
    const res = await main({ action: 'getMyClasses', payload: {} });
    expect(res.code).toBe(CODES.NOT_LOGGED_IN);
  });

  test('成功返回 { code: 0, message: ok, data }', async () => {
    await registerUser('openid_idx1', '测试用户');
    const res = await main({ action: 'getMyClasses', payload: {} });
    expect(res.code).toBe('0');
    expect(res.message).toBe('ok');
    expect(res.data).toEqual([]);
  });

  test('业务错误返回正确 code', async () => {
    await registerUser('openid_idx2', '测试用户');
    const res = await main({ action: 'joinClass', payload: { inviteCode: 'WRONG0' } });
    expect(res.code).toBe(CODES.INVITE_INVALID);
    expect(res.message).toBeTruthy();
  });
});
