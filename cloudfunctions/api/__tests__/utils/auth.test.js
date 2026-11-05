require("../testHelper");
/**

 * utils/auth 测试 — 后端服务设计 §12.4 index.test.js 中的鉴权用例
 */
const { buildContext, requireMember, requireOwner } = require('../../utils/auth');
const { BizError, CODES } = require('../../utils/errcode');
const cloud = require('wx-server-sdk');
const db = cloud.database();

describe('utils/auth', () => {
  describe('buildContext', () => {
    test('未获取到微信身份 → 40100', async () => {
      cloud.__setOpenid(null);
      // mock getWXContext 返回空 OPENID
      const origGetWX = cloud.getWXContext;
      cloud.getWXContext = () => ({ OPENID: null });
      await expect(buildContext()).rejects.toThrow(BizError);
      try {
        await buildContext();
      } catch (e) {
        expect(e.bizCode).toBe(CODES.NO_WX_IDENTITY);
      }
      cloud.getWXContext = origGetWX;
    });

    test('未注册 → 40101', async () => {
      cloud.__setOpenid('openid_new');
      await expect(buildContext()).rejects.toThrow(BizError);
      try {
        await buildContext();
      } catch (e) {
        expect(e.bizCode).toBe(CODES.NOT_LOGGED_IN);
      }
    });

    test('已注册 → 返回上下文', async () => {
      cloud.__setOpenid('openid_001');
      await db.collection('users').add({
        data: { openid: 'openid_001', nickname: '小明', avatarColor: '#FF6B6B', createdAt: new Date() }
      });

      const ctx = await buildContext();
      expect(ctx.openid).toBe('openid_001');
      expect(ctx.nickname).toBe('小明');
      expect(ctx.userId).toBeTruthy();
    });
  });

  describe('requireMember', () => {
    test('非成员 → 40301', async () => {
      cloud.__setOpenid('openid_001');
      await db.collection('users').add({
        data: { openid: 'openid_001', nickname: '小明', createdAt: new Date() }
      });
      const ctx = await buildContext();

      await expect(requireMember('class_001', ctx)).rejects.toThrow(BizError);
      try {
        await requireMember('class_001', ctx);
      } catch (e) {
        expect(e.bizCode).toBe(CODES.NOT_MEMBER);
      }
    });

    test('是成员 → 返回成员记录', async () => {
      cloud.__setOpenid('openid_001');
      await db.collection('users').add({
        data: { openid: 'openid_001', nickname: '小明', createdAt: new Date() }
      });
      const ctx = await buildContext();
      await db.collection('class_members').add({
        data: { classId: 'class_001', userId: ctx.userId, role: 'member', joinedAt: new Date() }
      });

      const member = await requireMember('class_001', ctx);
      expect(member.classId).toBe('class_001');
      expect(member.role).toBe('member');
    });
  });

  describe('requireOwner', () => {
    test('非管理员 → 40302', async () => {
      cloud.__setOpenid('openid_001');
      await db.collection('users').add({
        data: { openid: 'openid_001', nickname: '小明', createdAt: new Date() }
      });
      const ctx = await buildContext();
      await db.collection('class_members').add({
        data: { classId: 'class_001', userId: ctx.userId, role: 'member', joinedAt: new Date() }
      });

      await expect(requireOwner('class_001', ctx)).rejects.toThrow(BizError);
      try {
        await requireOwner('class_001', ctx);
      } catch (e) {
        expect(e.bizCode).toBe(CODES.NOT_OWNER);
      }
    });

    test('是管理员 → 返回成员记录', async () => {
      cloud.__setOpenid('openid_001');
      await db.collection('users').add({
        data: { openid: 'openid_001', nickname: '小明', createdAt: new Date() }
      });
      const ctx = await buildContext();
      await db.collection('class_members').add({
        data: { classId: 'class_001', userId: ctx.userId, role: 'owner', joinedAt: new Date() }
      });

      const member = await requireOwner('class_001', ctx);
      expect(member.role).toBe('owner');
    });
  });
});
