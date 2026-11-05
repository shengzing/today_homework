/**
require("../testHelper");

 * services/completion 测试 — 后端服务设计 §12.4 completion 用例
 */
const completionService = require('../../services/completion');
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

async function setupFullScenario() {
  const teacherCtx = await createCtx('openid_cm1', '老师');
  const cls = await classService.createClass({ name: '完成测试班' }, teacherCtx);
  const studentCtx = await createCtx('openid_cm2', '小明');
  await classService.joinClass({ inviteCode: cls.inviteCode }, studentCtx);
  const assign = await assignmentService.createAssignment({
    classId: cls.classId, title: '作业', content: '内容'
  }, teacherCtx);
  return { teacherCtx, studentCtx, classId: cls.classId, assignmentId: assign.assignmentId };
}

describe('services/completion', () => {
  test('正常完成', async () => {
    const { studentCtx, assignmentId } = await setupFullScenario();
    const res = await completionService.completeAssignment({ assignmentId }, studentCtx);
    expect(res.completedAt).toBeTruthy();
    expect(res.assignmentId).toBe(assignmentId);
  });

  test('重复完成 → 幂等返回，不新增', async () => {
    const { studentCtx, assignmentId } = await setupFullScenario();
    const res1 = await completionService.completeAssignment({ assignmentId }, studentCtx);
    const res2 = await completionService.completeAssignment({ assignmentId }, studentCtx);

    // 仍只有一条记录
    const completions = await db.collection('assignment_completions')
      .where({ assignmentId, userId: studentCtx.userId }).get();
    expect(completions.data.length).toBe(1);
  });

  test('非成员 → 40301', async () => {
    const { assignmentId } = await setupFullScenario();
    const outsiderCtx = await createCtx('openid_cm3', '外人');

    try {
      await completionService.completeAssignment({ assignmentId }, outsiderCtx);
    } catch (e) {
      expect(e.bizCode).toBe(CODES.NOT_MEMBER);
    }
  });

  test('作业已删除 → 40401', async () => {
    const { teacherCtx, studentCtx, assignmentId } = await setupFullScenario();
    await assignmentService.deleteAssignment({ assignmentId }, teacherCtx);

    try {
      await completionService.completeAssignment({ assignmentId }, studentCtx);
    } catch (e) {
      expect(e.bizCode).toBe(CODES.NOT_FOUND);
    }
  });

  test('完成后 stats.doneCount +1', async () => {
    const { studentCtx, assignmentId } = await setupFullScenario();
    await completionService.completeAssignment({ assignmentId }, studentCtx);

    const stats = await db.collection('assignment_stats').doc(assignmentId).get();
    expect(stats.data.doneCount).toBe(1);
  });

  test('completedAt 由服务端生成', async () => {
    const { studentCtx, assignmentId } = await setupFullScenario();
    const before = Date.now();
    const res = await completionService.completeAssignment({ assignmentId }, studentCtx);
    const after = Date.now();

    const completedAt = new Date(res.completedAt).getTime();
    expect(completedAt).toBeGreaterThanOrEqual(before - 1000);
    expect(completedAt).toBeLessThanOrEqual(after + 1000);
  });
});
