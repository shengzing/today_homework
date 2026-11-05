/**
require("../testHelper");

 * services/rank 测试 — 后端服务设计 §12.4 rank 用例
 */
const rankService = require('../../services/rank');
const completionService = require('../../services/completion');
const assignmentService = require('../../services/assignment');
const classService = require('../../services/class');
const { pointsOf } = require('../../config');
const cloud = require('wx-server-sdk');
const db = cloud.database();

async function createCtx(openid, nickname) {
  cloud.__setOpenid(openid);
  await db.collection('users').add({
    data: { openid, nickname: nickname || '测试用户', avatarColor: '#FF6B6B', createdAt: new Date() }
  });
  return require('../../utils/auth').buildContext();
}

async function setupClassWithStudents() {
  const teacherCtx = await createCtx('openid_rk1', '老师');
  const cls = await classService.createClass({ name: '排名测试班' }, teacherCtx);

  const s1 = await createCtx('openid_rk2', '学生甲');
  const s2 = await createCtx('openid_rk3', '学生乙');
  const s3 = await createCtx('openid_rk4', '学生丙');
  await classService.joinClass({ inviteCode: cls.inviteCode }, s1);
  await classService.joinClass({ inviteCode: cls.inviteCode }, s2);
  await classService.joinClass({ inviteCode: cls.inviteCode }, s3);

  return { teacherCtx, students: [s1, s2, s3], classId: cls.classId };
}

describe('services/rank', () => {
  describe('pointsOf', () => {
    test('rank=1 → 3', () => expect(pointsOf(1)).toBe(3));
    test('rank=2 → 2', () => expect(pointsOf(2)).toBe(2));
    test('rank=3 → 1', () => expect(pointsOf(3)).toBe(1));
    test('rank=100 → 1', () => expect(pointsOf(100)).toBe(1));
    test('rank=null → 0', () => expect(pointsOf(null)).toBe(0));
    test('rank=0 → 0', () => expect(pointsOf(0)).toBe(0));
    test('rank=-1 → 0', () => expect(pointsOf(-1)).toBe(0));
  });

  describe('getAssignmentRanking', () => {
    test('按完成时间升序排名', async () => {
      const { teacherCtx, students, classId } = await setupClassWithStudents();
      const assign = await assignmentService.createAssignment({
        classId, title: '作业', content: '内容'
      }, teacherCtx);

      // 按顺序完成
      await completionService.completeAssignment({ assignmentId: assign.assignmentId }, students[0]);
      // 微小延迟确保时间不同
      await new Promise(r => setTimeout(r, 10));
      await completionService.completeAssignment({ assignmentId: assign.assignmentId }, students[1]);
      await new Promise(r => setTimeout(r, 10));
      await completionService.completeAssignment({ assignmentId: assign.assignmentId }, students[2]);

      const ranking = await rankService.getAssignmentRanking({ assignmentId: assign.assignmentId }, students[0]);
      expect(ranking.normal.length).toBe(3);
      expect(ranking.normal[0].rank).toBe(1);
      expect(ranking.normal[1].rank).toBe(2);
      expect(ranking.normal[2].rank).toBe(3);
      expect(ranking.normal[0].userId).toBe(students[0].userId);
      expect(ranking.doneCount).toBe(3);
    });

    test('未完成成员不在名单中', async () => {
      const { teacherCtx, students, classId } = await setupClassWithStudents();
      const assign = await assignmentService.createAssignment({
        classId, title: '作业', content: '内容'
      }, teacherCtx);

      await completionService.completeAssignment({ assignmentId: assign.assignmentId }, students[0]);

      const ranking = await rankService.getAssignmentRanking({ assignmentId: assign.assignmentId }, students[0]);
      expect(ranking.normal.length).toBe(1);
      expect(ranking.overdue.length).toBe(0);
    });

    test('逾期完成进 overdue 组，不占正常名次', async () => {
      const { teacherCtx, students, classId } = await setupClassWithStudents();
      // 创建一个已过期作业
      const pastDeadline = Date.now() - 24 * 60 * 60 * 1000;
      const assign = await assignmentService.createAssignment({
        classId, title: '过期作业', content: '内容', deadline: pastDeadline
      }, teacherCtx);

      // 手动修改 createdAt 为过去以确保不触发防篡改
      await db.collection('assignments').doc(assign.assignmentId).update({
        data: { createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000) }
      });

      await completionService.completeAssignment({ assignmentId: assign.assignmentId }, students[0]);

      const ranking = await rankService.getAssignmentRanking({ assignmentId: assign.assignmentId }, students[0]);
      expect(ranking.normal.length).toBe(0);
      expect(ranking.overdue.length).toBe(1);
      expect(ranking.overdue[0].overdue).toBe(true);
    });
  });

  describe('getAchievement', () => {
    test('积分累加正确', async () => {
      const { teacherCtx, students, classId } = await setupClassWithStudents();

      // 作业1：三人按序完成
      const a1 = await assignmentService.createAssignment({ classId, title: '作业1', content: '内容' }, teacherCtx);
      await db.collection('assignments').doc(a1.assignmentId).update({ data: { createdAt: new Date(Date.now() - 10000) } });
      await completionService.completeAssignment({ assignmentId: a1.assignmentId }, students[0]);
      await new Promise(r => setTimeout(r, 10));
      await completionService.completeAssignment({ assignmentId: a1.assignmentId }, students[1]);
      await new Promise(r => setTimeout(r, 10));
      await completionService.completeAssignment({ assignmentId: a1.assignmentId }, students[2]);

      // 作业2：只有学生乙完成
      const a2 = await assignmentService.createAssignment({ classId, title: '作业2', content: '内容' }, teacherCtx);
      await db.collection('assignments').doc(a2.assignmentId).update({ data: { createdAt: new Date(Date.now() - 10000) } });
      await completionService.completeAssignment({ assignmentId: a2.assignmentId }, students[1]);

      const ach = await rankService.getAchievement({ classId }, students[0]);

      expect(ach.assignmentCount).toBe(2);
      // 学生甲：作业1 rank=1 (3分) + 作业2 未完成 (0分) = 3分
      const s0 = ach.rows.find(r => r.userId === students[0].userId);
      expect(s0.points).toBe(3);
      expect(s0.done).toBe(1);
      // 学生乙：作业1 rank=2 (2分) + 作业2 rank=1 (3分) = 5分
      const s1 = ach.rows.find(r => r.userId === students[1].userId);
      expect(s1.points).toBe(5);
      expect(s1.done).toBe(2);
      // 学生丙：作业1 rank=3 (1分) + 作业2 未完成 (0分) = 1分
      const s2 = ach.rows.find(r => r.userId === students[2].userId);
      expect(s2.points).toBe(1);
      expect(s2.done).toBe(1);
    });

    test('排序稳定：两次调用顺序一致', async () => {
      const { teacherCtx, students, classId } = await setupClassWithStudents();
      const a1 = await assignmentService.createAssignment({ classId, title: '作业', content: '内容' }, teacherCtx);
      await db.collection('assignments').doc(a1.assignmentId).update({ data: { createdAt: new Date(Date.now() - 10000) } });
      await completionService.completeAssignment({ assignmentId: a1.assignmentId }, students[0]);

      const ach1 = await rankService.getAchievement({ classId }, students[0]);
      const ach2 = await rankService.getAchievement({ classId }, students[0]);

      expect(ach1.rows.map(r => r.userId)).toEqual(ach2.rows.map(r => r.userId));
    });

    test('已删除作业不参与积分', async () => {
      const { teacherCtx, students, classId } = await setupClassWithStudents();
      const a1 = await assignmentService.createAssignment({ classId, title: '作业', content: '内容' }, teacherCtx);
      await db.collection('assignments').doc(a1.assignmentId).update({ data: { createdAt: new Date(Date.now() - 10000) } });
      await completionService.completeAssignment({ assignmentId: a1.assignmentId }, students[0]);

      // 删除作业
      await assignmentService.deleteAssignment({ assignmentId: a1.assignmentId }, teacherCtx);

      const ach = await rankService.getAchievement({ classId }, students[0]);
      expect(ach.assignmentCount).toBe(0);
    });
  });
});
