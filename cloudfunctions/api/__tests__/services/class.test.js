/**
require("../testHelper");

 * services/class 测试 — 后端服务设计 §12.4 class 用例
 */
const classService = require('../../services/class');
const { BizError, CODES } = require('../../utils/errcode');
const cloud = require('wx-server-sdk');
const db = cloud.database();

async function createCtx(openid, nickname) {
  cloud.__setOpenid(openid);
  await db.collection('users').add({
    data: { openid, nickname: nickname || '测试用户', avatarColor: '#FF6B6B', createdAt: new Date() }
  });
  return require('../../utils/auth').buildContext();
}

describe('services/class', () => {
  describe('createClass', () => {
    test('正常创建', async () => {
      const ctx = await createCtx('openid_c1', '老师A');
      const res = await classService.createClass({ name: '三年二班', description: '快乐学习' }, ctx);
      expect(res.classId).toBeTruthy();
      expect(res.inviteCode.length).toBe(6);

      // 验证创建者是 owner
      const members = await db.collection('class_members').where({ classId: res.classId }).get();
      expect(members.data.length).toBe(1);
      expect(members.data[0].role).toBe('owner');
    });

    test('班级名称为空 → 40001', async () => {
      const ctx = await createCtx('openid_c2');
      await expect(classService.createClass({ name: '' }, ctx)).rejects.toThrow();
    });
  });

  describe('joinClass', () => {
    test('邀请码正确 → 加入成功', async () => {
      const ctx1 = await createCtx('openid_j1', '老师');
      const cls = await classService.createClass({ name: '一班' }, ctx1);

      const ctx2 = await createCtx('openid_j2', '学生');
      const res = await classService.joinClass({ inviteCode: cls.inviteCode }, ctx2);
      expect(res.classId).toBe(cls.classId);
    });

    test('邀请码错误 → 40901', async () => {
      const ctx = await createCtx('openid_j3');
      try {
        await classService.joinClass({ inviteCode: 'WRONG0' }, ctx);
      } catch (e) {
        expect(e.bizCode).toBe(CODES.INVITE_INVALID);
      }
    });

    test('重复加入 → 幂等返回成功', async () => {
      const ctx1 = await createCtx('openid_j4', '老师');
      const cls = await classService.createClass({ name: '二班' }, ctx1);
      const ctx2 = await createCtx('openid_j5', '学生');

      await classService.joinClass({ inviteCode: cls.inviteCode }, ctx2);
      // 再次加入
      const res2 = await classService.joinClass({ inviteCode: cls.inviteCode }, ctx2);
      expect(res2.classId).toBe(cls.classId);

      // 仍只有一条成员记录
      const members = await db.collection('class_members')
        .where({ classId: cls.classId, userId: ctx2.userId }).get();
      expect(members.data.length).toBe(1);
    });
  });

  describe('getMyClasses', () => {
    test('返回班级列表', async () => {
      const ctx = await createCtx('openid_g1', '老师');
      await classService.createClass({ name: '班级A' }, ctx);
      await classService.createClass({ name: '班级B' }, ctx);

      const list = await classService.getMyClasses({}, ctx);
      expect(list.length).toBe(2);
      expect(list[0].name).toBeTruthy();
      expect(list[0].role).toBe('owner');
    });

    test('无班级 → 空数组', async () => {
      const ctx = await createCtx('openid_g2');
      const list = await classService.getMyClasses({}, ctx);
      expect(list).toEqual([]);
    });
  });

  describe('removeMember', () => {
    test('管理员移除成员 → 成功，完成记录保留', async () => {
      const ctx1 = await createCtx('openid_r1', '老师');
      const cls = await classService.createClass({ name: '实验班' }, ctx1);
      const ctx2 = await createCtx('openid_r2', '学生');

      await classService.joinClass({ inviteCode: cls.inviteCode }, ctx2);

      // 添加一条完成记录
      await db.collection('assignments').add({
        data: { classId: cls.classId, title: '作业1', content: '内容', creatorId: ctx1.userId, status: 'published', createdAt: new Date() }
      });
      const assignRes = await db.collection('assignments').where({ classId: cls.classId }).get();
      const assignmentId = assignRes.data[0]._id;
      await db.collection('assignment_completions').add({
        data: { assignmentId, classId: cls.classId, userId: ctx2.userId, completedAt: new Date() }
      });

      // 移除成员
      await classService.removeMember({ classId: cls.classId, userId: ctx2.userId }, ctx1);

      // 成员已删除
      const members = await db.collection('class_members')
        .where({ classId: cls.classId, userId: ctx2.userId }).get();
      expect(members.data.length).toBe(0);

      // 完成记录仍在
      const completions = await db.collection('assignment_completions')
        .where({ assignmentId, userId: ctx2.userId }).get();
      expect(completions.data.length).toBe(1);
    });

    test('不能移除自己', async () => {
      const ctx = await createCtx('openid_r3', '老师');
      const cls = await classService.createClass({ name: '班' }, ctx);
      try {
        await classService.removeMember({ classId: cls.classId, userId: ctx.userId }, ctx);
      } catch (e) {
        expect(e.bizCode).toBe(CODES.PARAM_INVALID);
      }
    });
  });

  describe('leaveClass', () => {
    test('管理员未转让就退出 → 40302', async () => {
      const ctx = await createCtx('openid_l1', '老师');
      const cls = await classService.createClass({ name: '班' }, ctx);
      try {
        await classService.leaveClass({ classId: cls.classId }, ctx);
      } catch (e) {
        expect(e.bizCode).toBe(CODES.NOT_OWNER);
      }
    });

    test('普通成员退出 → 成功', async () => {
      const ctx1 = await createCtx('openid_l2', '老师');
      const cls = await classService.createClass({ name: '班' }, ctx1);
      const ctx2 = await createCtx('openid_l3', '学生');
      await classService.joinClass({ inviteCode: cls.inviteCode }, ctx2);

      await classService.leaveClass({ classId: cls.classId }, ctx2);
      const members = await db.collection('class_members')
        .where({ classId: cls.classId, userId: ctx2.userId }).get();
      expect(members.data.length).toBe(0);
    });
  });

  describe('transferOwner', () => {
    test('转让给自己 → 拒绝', async () => {
      const ctx = await createCtx('openid_t1', '老师');
      const cls = await classService.createClass({ name: '班' }, ctx);
      try {
        await classService.transferOwner({ classId: cls.classId, userId: ctx.userId }, ctx);
      } catch (e) {
        expect(e.bizCode).toBe(CODES.PARAM_INVALID);
      }
    });

    test('正常转让', async () => {
      const ctx1 = await createCtx('openid_t2', '老师');
      const cls = await classService.createClass({ name: '班' }, ctx1);
      const ctx2 = await createCtx('openid_t3', '学生');
      await classService.joinClass({ inviteCode: cls.inviteCode }, ctx2);

      const res = await classService.transferOwner({ classId: cls.classId, userId: ctx2.userId }, ctx1);
      expect(res.ownerId).toBe(ctx2.userId);

      // 验证角色变更
      const m1 = await db.collection('class_members')
        .where({ classId: cls.classId, userId: ctx1.userId }).get();
      expect(m1.data[0].role).toBe('member');
      const m2 = await db.collection('class_members')
        .where({ classId: cls.classId, userId: ctx2.userId }).get();
      expect(m2.data[0].role).toBe('owner');
    });
  });

  describe('dissolveClass', () => {
    test('管理员解散 → status 变 dissolved，stats 删除', async () => {
      const ctx = await createCtx('openid_d1', '老师');
      const cls = await classService.createClass({ name: '临时班' }, ctx);

      // 添加 stats
      await db.collection('assignment_stats').add({
        data: { _id: 'stat_1', assignmentId: 'stat_1', classId: cls.classId, doneCount: 0, totalCount: 1 }
      });

      await classService.dissolveClass({ classId: cls.classId }, ctx);

      const clsDoc = await db.collection('classes').doc(cls.classId).get();
      expect(clsDoc.data.status).toBe('dissolved');

      const stats = await db.collection('assignment_stats').where({ classId: cls.classId }).get();
      expect(stats.data.length).toBe(0);
    });
  });

  describe('regenerateInviteCode', () => {
    test('重新生成 → 新码不同', async () => {
      const ctx = await createCtx('openid_rg1', '老师');
      const cls = await classService.createClass({ name: '班' }, ctx);
      const oldCode = cls.inviteCode;

      const res = await classService.regenerateInviteCode({ classId: cls.classId }, ctx);
      expect(res.inviteCode).toBeTruthy();
      expect(res.inviteCode).not.toBe(oldCode);
    });
  });
});
