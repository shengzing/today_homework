/**
 * 作业服务 — 5 个接口
 * 文档引用：后端服务设计 §5 接口清单 assignment 部分、§5 deadline 三态语义
 */
const { db, _ } = require('../utils/db');
const { bizError, CODES } = require('../utils/errcode');
const { requireMember, requireOwner, batchGetUsers } = require('../utils/auth');
const { id, title, content, optionalTimestamp } = require('../utils/validate');
const { endOfDay } = require('../utils/time');
const { PAGE_LIMITS } = require('../config');

/**
 * 获取作业（内部辅助），不存在 → 40401
 */
async function getAssignment(assignmentId) {
  const res = await db.collection('assignments').doc(assignmentId).get();
  if (!res.data || res.data.status === 'deleted') {
    throw bizError(CODES.NOT_FOUND, '作业不存在或已删除');
  }
  return res.data;
}

/**
 * 创建作业
 * 权限：管理员
 * deadline 省略时默认当天 24:00（东八区）
 */
async function createAssignment(payload = {}, ctx) {
  const classId = id(payload.classId);
  await requireOwner(classId, ctx);

  const titleVal = title(payload.title);
  const contentVal = content(payload.content);
  const deadline = payload.deadline !== undefined
    ? optionalTimestamp(payload.deadline)
    : endOfDay(new Date());
  const now = new Date();

  const addRes = await db.collection('assignments').add({
    data: {
      classId,
      title: titleVal,
      content: contentVal,
      creatorId: ctx.userId,
      deadline,
      status: 'published',
      createdAt: now,
      updatedAt: now
    }
  });

  const assignmentId = addRes._id;

  // 初始化 assignment_stats（成员数快照）
  const memCount = await db.collection('class_members').where({ classId }).count();
  await db.collection('assignment_stats').add({
    data: {
      _id: assignmentId, // 与 assignmentId 相同
      assignmentId,
      classId,
      doneCount: 0,
      totalCount: memCount.total,
      updatedAt: now
    }
  });

  return { assignmentId, createdAt: now };
}

/**
 * 修改作业
 * 权限：发布者（creatorId === ctx.userId，不是管理员角色）
 * deadline 三态：undefined=保留, null=清除, timestamp=设置
 */
async function updateAssignment(payload = {}, ctx) {
  const assignmentId = id(payload.assignmentId);
  const assignment = await getAssignment(assignmentId);

  if (assignment.creatorId !== ctx.userId) {
    throw bizError(CODES.NOT_CREATOR, '只有发布者可以修改作业');
  }

  const data = { updatedAt: new Date() };

  if (payload.title !== undefined) data.title = title(payload.title);
  if (payload.content !== undefined) data.content = content(payload.content);

  // deadline 三态：必须用 hasOwnProperty 判断
  if (Object.prototype.hasOwnProperty.call(payload, 'deadline')) {
    if (payload.deadline === null) {
      data.deadline = null; // 清除
    } else {
      data.deadline = optionalTimestamp(payload.deadline);
    }
  }
  // undefined → 保留原值，不写入 data

  await db.collection('assignments').doc(assignmentId).update({ data });

  return {
    title: data.title || assignment.title,
    content: data.content || assignment.content,
    deadline: data.deadline !== undefined ? data.deadline : assignment.deadline,
    updatedAt: data.updatedAt
  };
}

/**
 * 删除作业（软删除）
 * 权限：发布者
 */
async function deleteAssignment(payload = {}, ctx) {
  const assignmentId = id(payload.assignmentId);
  const assignment = await getAssignment(assignmentId);

  if (assignment.creatorId !== ctx.userId) {
    throw bizError(CODES.NOT_CREATOR, '只有发布者可以删除作业');
  }

  await db.collection('assignments').doc(assignmentId).update({
    data: { status: 'deleted', updatedAt: new Date() }
  });

  return null;
}

/**
 * 获取作业列表
 * 权限：成员
 * scope: 'today' | 'history'
 */
async function getAssignments(payload = {}, ctx) {
  const classId = id(payload.classId);
  await requireMember(classId, ctx);

  const scope = payload.scope === 'history' ? 'history' : 'today';
  const todayStart = require('../utils/time').startOfDay(new Date());

  let query = { classId, status: 'published' };
  if (scope === 'today') {
    query.createdAt = _.gte(todayStart);
  }

  const res = await db.collection('assignments')
    .where(query).limit(PAGE_LIMITS.ASSIGNMENTS).get();

  if (!res.data.length) return [];

  // 获取该用户在所有这些作业中的完成记录
  const assignmentIds = res.data.map(a => a._id);
  const completionRes = await db.collection('assignment_completions')
    .where({ assignmentId: _.in(assignmentIds), userId: ctx.userId }).get();
  const completionMap = new Map(completionRes.data.map(c => [c.assignmentId, c]));

  // 批量获取 stats
  const statsRes = await db.collection('assignment_stats')
    .where({ assignmentId: _.in(assignmentIds) }).get();
  const statsMap = new Map(statsRes.data.map(s => [s.assignmentId, s]));

  const now = Date.now();
  return res.data.map(a => {
    const stats = statsMap.get(a._id) || { doneCount: 0, totalCount: 0 };
    const completion = completionMap.get(a._id);
    const myCompleted = !!completion;
    const myCompletedAt = completion ? completion.completedAt : null;

    // 服务端判定 myStatus
    let myStatus = 'todo';
    if (myCompleted) {
      myStatus = 'done';
    } else if (a.deadline && now > a.deadline) {
      myStatus = 'expired';
    }

    return {
      assignmentId: a._id,
      title: a.title,
      content: a.content,
      creatorId: a.creatorId,
      deadline: a.deadline,
      createdAt: a.createdAt,
      doneCount: stats.doneCount || 0,
      totalCount: stats.totalCount || 0,
      myCompleted,
      myCompletedAt,
      myStatus
    };
  });
}

/**
 * 获取作业详情
 * 权限：成员
 */
async function getAssignmentDetail(payload = {}, ctx) {
  const assignmentId = id(payload.assignmentId);
  const assignment = await getAssignment(assignmentId);
  await requireMember(assignment.classId, ctx);

  // 该用户的完成记录
  const compRes = await db.collection('assignment_completions')
    .where({ assignmentId, userId: ctx.userId }).limit(1).get();
  const completion = compRes.data[0] || null;

  // stats
  const statsRes = await db.collection('assignment_stats').doc(assignmentId).get();
  const stats = statsRes.data || { doneCount: 0, totalCount: 0 };

  // 计算我的排名（只在已完成时）
  let myRank = null;
  if (completion) {
    const rankModule = require('./rank');
    const ranking = await rankModule._getRankingData(assignmentId, ctx);
    const allRows = [...ranking.normal, ...ranking.overdue];
    const myRow = allRows.find(r => r.userId === ctx.userId);
    myRank = myRow ? (myRow.rank || null) : null;
  }

  const now = Date.now();
  let myStatus = 'todo';
  if (completion) {
    myStatus = 'done';
  } else if (assignment.deadline && now > assignment.deadline) {
    myStatus = 'expired';
  }

  return {
    assignmentId: assignment._id,
    classId: assignment.classId,
    title: assignment.title,
    content: assignment.content,
    creatorId: assignment.creatorId,
    deadline: assignment.deadline,
    createdAt: assignment.createdAt,
    doneCount: stats.doneCount || 0,
    totalCount: stats.totalCount || 0,
    myCompleted: !!completion,
    myCompletedAt: completion ? completion.completedAt : null,
    myRank,
    myStatus
  };
}

module.exports = {
  createAssignment,
  updateAssignment,
  deleteAssignment,
  getAssignments,
  getAssignmentDetail,
  getAssignment // 内部导出供 rank.js 使用
};
