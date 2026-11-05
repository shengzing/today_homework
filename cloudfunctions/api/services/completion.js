/**
 * 完成作业服务
 * 文档引用：后端服务设计 §5 接口清单、§12.4 completion 测试用例、§3.7 stats 维护
 */
const { db, _ } = require('../utils/db');
const { bizError, CODES } = require('../utils/errcode');
const { requireMember } = require('../utils/auth');
const { id } = require('../utils/validate');

/**
 * 完成作业
 * 权限：班级成员
 * 幂等：已存在返回既有记录（code 0）
 * completedAt 由服务端生成
 */
async function completeAssignment(payload = {}, ctx) {
  const assignmentId = id(payload.assignmentId);

  // 获取作业（不存在 → 40401）
  const assignRes = await db.collection('assignments').doc(assignmentId).get();
  if (!assignRes.data || assignRes.data.status === 'deleted') {
    throw bizError(CODES.NOT_FOUND, '作业不存在或已删除');
  }
  const assignment = assignRes.data;

  // 校验班级成员
  await requireMember(assignment.classId, ctx);

  // 幂等检查：是否已完成
  const existing = await db.collection('assignment_completions')
    .where({ assignmentId, userId: ctx.userId }).limit(1).get();
  if (existing.data.length) {
    return {
      completedAt: existing.data[0].completedAt,
      assignmentId
    };
  }

  const now = new Date();

  // 防篡改：completedAt 不能早于作业创建时间
  if (now.getTime() < new Date(assignment.createdAt).getTime()) {
    throw bizError(CODES.PARAM_INVALID, '完成时间异常');
  }

  await db.collection('assignment_completions').add({
    data: {
      assignmentId,
      classId: assignment.classId, // 冗余字段
      userId: ctx.userId,
      completedAt: now
    }
  });

  // 更新 stats.doneCount +1
  await db.collection('assignment_stats').doc(assignmentId).update({
    data: { doneCount: _.inc(1), updatedAt: now }
  });

  return {
    completedAt: now,
    assignmentId
  };
}

module.exports = { completeAssignment };
