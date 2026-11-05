/**
require("../testHelper");

 * services/assignment 测试 — 后端服务设计 §12.4 assignment 用例
 */
const assignmentService = require('../../services/assignment');
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

async function setupClassWithAssignment(ownerCtx) {
  const cls = await classService.createClass({ name: '测试班' }, ownerCtx);
  const assign = await assignmentService.createAssignment({
    classId: cls.classId,
    title: '第一课作业',
    content: '请完成练习题'
  }, ownerCtx);
  return { classId: cls.classId, assignmentId: assign.assignmentId, inviteCode: cls.inviteCode };
}

describe('services/assignment', () => {
  describe('createAssignment', () => {
    test('正常创建', async () => {
      const ctx = await createCtx('openid_a1', '老师');
      const cls = await classService.createClass({ name: '班' }, ctx);
      const res = await assignmentService.createAssignment({
        classId: cls.classId, title: '作业', content: '内容'
      }, ctx);
      expect(res.assignmentId).toBeTruthy();

      // stats 已初始化
      const stats = await db.collection('assignment_stats').doc(res.assignmentId).get();
      expect(stats.data).toBeTruthy();
      expect(stats.data.doneCount).toBe(0);
      expect(stats.data.totalCount).toBe(1); // 只有创建者
    });

    test('非管理员创建 → 40302', async () => {
      const ctx1 = await createCtx('openid_a2', '老师');
      const cls = await classService.createClass({ name: '班' }, ctx1);
      const ctx2 = await createCtx('openid_a3', '学生');
      await classService.joinClass({ inviteCode: cls.inviteCode }, ctx2);

      try {
        await assignmentService.createAssignment({ classId: cls.classId, title: '作业', content: '内容' }, ctx2);
      } catch (e) {
        expect(e.bizCode).toBe(CODES.NOT_OWNER);
      }
    });

    test('deadline 省略 → 默认当天 24:00', async () => {
      const ctx = await createCtx('openid_a4', '老师');
      const cls = await classService.createClass({ name: '班' }, ctx);
      const res = await assignmentService.createAssignment({
        classId: cls.classId, title: '作业', content: '内容'
      }, ctx);

      const assign = await db.collection('assignments').doc(res.assignmentId).get();
      expect(assign.data.deadline).toBeTruthy();
      // deadline 应该是当天 24:00 东八区
      const { endOfDay } = require('../../utils/time');
      const expected = endOfDay(new Date());
      expect(assign.data.deadline).toBe(expected);
    });
  });

  describe('updateAssignment — deadline 三态', () => {
    test('省略 deadline → 保留原值', async () => {
      const ctx = await createCtx('openid_a5', '老师');
      const { assignmentId } = await setupClassWithAssignment(ctx);
      const orig = await db.collection('assignments').doc(assignmentId).get();
      const origDeadline = orig.data.deadline;

      await assignmentService.updateAssignment({
        assignmentId, title: '修改标题'
      }, ctx);

      const updated = await db.collection('assignments').doc(assignmentId).get();
      expect(updated.data.deadline).toBe(origDeadline);
    });

    test('显式传 null → 清除', async () => {
      const ctx = await createCtx('openid_a6', '老师');
      const { assignmentId } = await setupClassWithAssignment(ctx);

      await assignmentService.updateAssignment({
        assignmentId, deadline: null
      }, ctx);

      const updated = await db.collection('assignments').doc(assignmentId).get();
      expect(updated.data.deadline).toBeNull();
    });

    test('传时间戳 → 设置', async () => {
      const ctx = await createCtx('openid_a7', '老师');
      const { assignmentId } = await setupClassWithAssignment(ctx);
      const newDeadline = Date.now() + 3 * 24 * 60 * 60 * 1000;

      await assignmentService.updateAssignment({
        assignmentId, deadline: newDeadline
      }, ctx);

      const updated = await db.collection('assignments').doc(assignmentId).get();
      expect(updated.data.deadline).toBe(newDeadline);
    });

    test('非发布者修改 → 40303', async () => {
      const ctx1 = await createCtx('openid_a8', '老师');
      const { assignmentId, inviteCode } = await setupClassWithAssignment(ctx1);
      const ctx2 = await createCtx('openid_a9', '学生');
      await classService.joinClass({ inviteCode }, ctx2);

      try {
        await assignmentService.updateAssignment({ assignmentId, title: '篡改' }, ctx2);
      } catch (e) {
        expect(e.bizCode).toBe(CODES.NOT_CREATOR);
      }
    });

    test('修改后完成记录与名次不变', async () => {
      const ctx1 = await createCtx('openid_a10', '老师');
      const { classId, assignmentId, inviteCode } = await setupClassWithAssignment(ctx1);
      const ctx2 = await createCtx('openid_a11', '学生');
      await classService.joinClass({ inviteCode }, ctx2);

      // 学生完成作业
      const completionService = require('../../services/completion');
      await completionService.completeAssignment({ assignmentId }, ctx2);

      // 修改作业标题
      await assignmentService.updateAssignment({ assignmentId, title: '新标题' }, ctx1);

      // 完成记录仍然存在
      const completions = await db.collection('assignment_completions')
        .where({ assignmentId, userId: ctx2.userId }).get();
      expect(completions.data.length).toBe(1);
    });
  });

  describe('deleteAssignment', () => {
    test('软删除后列表不出现', async () => {
      const ctx = await createCtx('openid_a12', '老师');
      const { classId, assignmentId } = await setupClassWithAssignment(ctx);

      await assignmentService.deleteAssignment({ assignmentId }, ctx);

      // status = deleted
      const doc = await db.collection('assignments').doc(assignmentId).get();
      expect(doc.data.status).toBe('deleted');

      // 列表中不出现
      const list = await assignmentService.getAssignments({ classId }, ctx);
      expect(list.find(a => a.assignmentId === assignmentId)).toBeUndefined();
    });

    test('非发布者删除 → 40303', async () => {
      const ctx1 = await createCtx('openid_a13', '老师');
      const cls = await classService.createClass({ name: '班' }, ctx1);
      const assign = await assignmentService.createAssignment({
        classId: cls.classId, title: '作业', content: '内容'
      }, ctx1);
      const ctx2 = await createCtx('openid_a14', '学生');
      await classService.joinClass({ inviteCode: cls.inviteCode }, ctx2);

      try {
        await assignmentService.deleteAssignment({ assignmentId: assign.assignmentId }, ctx2);
      } catch (e) {
        expect(e.bizCode).toBe(CODES.NOT_CREATOR);
      }
    });
  });

  describe('getAssignments', () => {
    test('myStatus 服务端判定', async () => {
      const ctx1 = await createCtx('openid_a15', '老师');
      const cls = await classService.createClass({ name: '班' }, ctx1);
      const ctx2 = await createCtx('openid_a16', '学生');
      await classService.joinClass({ inviteCode: cls.inviteCode }, ctx2);

      const assign = await assignmentService.createAssignment({
        classId: cls.classId, title: '作业', content: '内容'
      }, ctx1);

      // 未完成 → todo
      const list = await assignmentService.getAssignments({ classId: cls.classId }, ctx2);
      const item = list.find(a => a.assignmentId === assign.assignmentId);
      expect(item.myStatus).toBe('todo');

      // 完成后 → done
      const completionService = require('../../services/completion');
      await completionService.completeAssignment({ assignmentId: assign.assignmentId }, ctx2);
      const list2 = await assignmentService.getAssignments({ classId: cls.classId }, ctx2);
      const item2 = list2.find(a => a.assignmentId === assign.assignmentId);
      expect(item2.myStatus).toBe('done');
    });
  });
});
