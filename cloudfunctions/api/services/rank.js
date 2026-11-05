/**
 * 排名与学期成就 — 核心算法
 * 文档引用：后端服务设计 §6.1 排名算法、§6.2 学期成就积分
 */
const { db, _ } = require('../utils/db');
const { bizError, CODES } = require('../utils/errcode');
const { requireMember, batchGetUsers } = require('../utils/auth');
const { id } = require('../utils/validate');
const { pointsOf, PAGE_LIMITS } = require('../config');

/**
 * 获取排名原始数据（内部函数，供 getAssignmentDetail 复用）
 * @returns {Promise<{normal: array, overdue: array}>}
 */
async function _getRankingData(assignmentId, ctx) {
  const assignment = await require('../services/assignment').getAssignment(assignmentId);
  await requireMember(assignment.classId, ctx);

  const all = await db.collection('assignment_completions')
    .where({ assignmentId })
    .orderBy('completedAt', 'asc')
    .limit(PAGE_LIMITS.RANKING)
    .get();

  // 批量获取用户信息
  const userIds = all.data.map(c => c.userId);
  const userMap = await batchGetUsers(userIds);

  const normal = [];
  const overdue = [];

  all.data.forEach(c => {
    const u = userMap.get(c.userId) || { nickname: '未知用户', avatarUrl: '', avatarColor: '#FF6B6B' };
    const row = {
      userId: c.userId,
      nickname: u.nickname,
      avatarUrl: u.avatarUrl,
      avatarColor: u.avatarColor,
      completedAt: c.completedAt,
      overdue: !!(assignment.deadline && new Date(c.completedAt).getTime() > assignment.deadline)
    };
    if (row.overdue) {
      overdue.push(row);
    } else {
      normal.push(row);
    }
  });

  // 正常组分配名次（1-based）
  normal.forEach((r, i) => { r.rank = i + 1; });

  return { normal, overdue, assignment };
}

/**
 * 获取作业排名
 * 权限：班级成员
 */
async function getAssignmentRanking(payload = {}, ctx) {
  const assignmentId = id(payload.assignmentId);
  const { normal, overdue, assignment } = await _getRankingData(assignmentId, ctx);

  // 成员总数
  const memCount = await db.collection('class_members')
    .where({ classId: assignment.classId }).count();

  // 我的排名
  const allRows = [...normal, ...overdue];
  const myRow = allRows.find(r => r.userId === ctx.userId) || null;

  return {
    normal,
    overdue,
    doneCount: normal.length + overdue.length,
    totalCount: memCount.total,
    myRank: myRow ? { rank: myRow.rank || null, overdue: myRow.overdue, completedAt: myRow.completedAt } : null
  };
}

/**
 * 获取学期成就排行
 * 权限：成员
 * MVP：学期 = 该班全部已发布作业
 */
async function getAchievement(payload = {}, ctx) {
  const classId = id(payload.classId);
  await requireMember(classId, ctx);

  // 全部已发布作业（含历史）
  const assignRes = await db.collection('assignments')
    .where({ classId, status: 'published' })
    .limit(PAGE_LIMITS.ASSIGNMENTS)
    .get();

  // 全部成员
  const memberRes = await db.collection('class_members')
    .where({ classId }).limit(PAGE_LIMITS.MEMBERS).get();
  const userIds = memberRes.data.map(m => m.userId);
  const userMap = await batchGetUsers(userIds);

  // 初始化积分板
  const board = new Map();
  memberRes.data.forEach(m => {
    const u = userMap.get(m.userId) || { nickname: '未知用户', avatarUrl: '', avatarColor: '#FF6B6B' };
    board.set(m.userId, {
      userId: m.userId,
      nickname: u.nickname,
      avatarUrl: u.avatarUrl,
      avatarColor: u.avatarColor,
      points: 0,
      done: 0,
      overdue: 0,
      total: assignRes.data.length
    });
  });

  // 遍历每个作业，累加积分
  for (const a of assignRes.data) {
    const ranking = await _getRankingData(a._id, ctx);

    ranking.normal.forEach(r => {
      const row = board.get(r.userId);
      if (row) {
        row.points += pointsOf(r.rank);
        row.done += 1;
      }
    });

    ranking.overdue.forEach(r => {
      const row = board.get(r.userId);
      if (row) {
        row.done += 1;
        row.overdue += 1; // 逾期完成不计分
      }
    });
  }

  // 排序：总分 → 完成数 → userId（稳定可复现）
  const rows = [...board.values()].sort((a, b) =>
    b.points - a.points ||
    b.done - a.done ||
    (a.userId < b.userId ? -1 : 1)
  );
  rows.forEach((r, i) => { r.rank = i + 1; });

  const myRow = rows.find(r => r.userId === ctx.userId) || null;

  return {
    rows,
    myRow,
    assignmentCount: assignRes.data.length
  };
}

module.exports = { getAssignmentRanking, getAchievement, _getRankingData, pointsOf };
