/**
 * 班级服务 — 10 个接口
 * 文档引用：后端服务设计 §5 接口清单 class 部分、§6.3 邀请码、§3.7 stats 维护
 */
const { db, _ } = require('../utils/db');
const { bizError, CODES } = require('../utils/errcode');
const { requireMember, requireOwner } = require('../utils/auth');
const { generateInviteCode } = require('../utils/invite');
const { className, classDesc, id } = require('../utils/validate');
const { randomAvatarColor, PAGE_LIMITS } = require('../config');
const { startOfDay } = require('../utils/time');

/**
 * 创建班级
 * 权限：登录用户
 */
async function createClass(payload = {}, ctx) {
  const name = className(payload.name);
  const description = classDesc(payload.description);
  const inviteCode = await generateInviteCode();
  const now = new Date();

  const addRes = await db.collection('classes').add({
    data: {
      name,
      description,
      ownerId: ctx.userId,
      inviteCode,
      inviteCodeVersion: 1,
      status: 'active',
      badgeColor: randomAvatarColor(),
      createdAt: now,
      updatedAt: now
    }
  });

  const classId = addRes._id;

  // 创建者自动成为 owner 成员
  await db.collection('class_members').add({
    data: {
      classId,
      userId: ctx.userId,
      role: 'owner',
      joinedAt: now
    }
  });

  return { classId, inviteCode };
}

/**
 * 加入班级
 * 权限：登录用户；幂等（已是成员返回成功）
 */
async function joinClass(payload = {}, ctx) {
  const code = id(payload.inviteCode, '邀请码');

  const clsRes = await db.collection('classes')
    .where({ inviteCode: code, status: 'active' }).limit(1).get();
  if (!clsRes.data.length) throw bizError(CODES.INVITE_INVALID, '邀请码无效或已失效');

  const cls = clsRes.data[0];
  const classId = cls._id;

  // 检查是否已是成员
  const existing = await db.collection('class_members')
    .where({ classId, userId: ctx.userId }).limit(1).get();
  if (existing.data.length) {
    return { classId }; // 幂等返回
  }

  await db.collection('class_members').add({
    data: {
      classId,
      userId: ctx.userId,
      role: 'member',
      joinedAt: new Date()
    }
  });

  // 刷新该班全部作业的 stats.totalCount +1
  const statsRes = await db.collection('assignment_stats')
    .where({ classId }).get();
  for (const stat of statsRes.data) {
    await db.collection('assignment_stats').doc(stat._id).update({
      data: { totalCount: _.inc(1), updatedAt: new Date() }
    });
  }

  return { classId };
}

/**
 * 获取我加入的班级列表
 * 权限：登录用户
 */
async function getMyClasses(payload = {}, ctx) {
  const memberRes = await db.collection('class_members')
    .where({ userId: ctx.userId })
    .limit(PAGE_LIMITS.CLASSES).get();

  if (!memberRes.data.length) return [];

  const classIds = memberRes.data.map(m => m.classId);
  const classRes = await db.collection('classes')
    .where({ _id: _.in(classIds), status: 'active' }).get();

  const todayStart = startOfDay(new Date());

  // 并行查询每个班级的统计数据（避免 N*3 串行查询）
  const result = await Promise.all(classRes.data.map(async cls => {
    const member = memberRes.data.find(m => m.classId === cls._id);

    const [todayAssign, todayDone, memCount] = await Promise.all([
      db.collection('assignments')
        .where({ classId: cls._id, status: 'published', createdAt: _.gte(todayStart) }).count(),
      db.collection('assignment_completions')
        .where({ classId: cls._id, completedAt: _.gte(todayStart) }).count(),
      db.collection('class_members')
        .where({ classId: cls._id }).count()
    ]);

    const todayCount = todayAssign.total;
    const doneCount = todayDone.total;
    const totalPossible = todayCount * memCount.total;
    const todayRate = totalPossible ? Math.round(doneCount / totalPossible * 100) : 0;

    return {
      classId: cls._id,
      name: cls.name,
      description: cls.description,
      role: member.role,
      memberCount: memCount.total,
      todayCount,
      todayRate,
      badgeColor: cls.badgeColor || '#FF6B6B'
    };
  }));

  return result;
}

/**
 * 获取班级详情
 * 权限：成员
 */
async function getClassDetail(payload = {}, ctx) {
  const classId = id(payload.classId);
  const member = await requireMember(classId, ctx);

  const res = await db.collection('classes').doc(classId).get();
  if (!res.data || res.data.status === 'dissolved') {
    throw bizError(CODES.NOT_FOUND, '班级不存在或已解散');
  }

  const cls = res.data;
  const memCount = await db.collection('class_members')
    .where({ classId }).count();

  return {
    classId: cls._id,
    name: cls.name,
    description: cls.description,
    ownerId: cls.ownerId,
    role: member.role,
    memberCount: memCount.total,
    inviteCode: cls.inviteCode
  };
}

/**
 * 获取班级成员列表
 * 权限：成员
 */
async function getClassMembers(payload = {}, ctx) {
  const classId = id(payload.classId);
  await requireMember(classId, ctx);

  const memberRes = await db.collection('class_members')
    .where({ classId }).limit(PAGE_LIMITS.MEMBERS).get();

  if (!memberRes.data.length) return [];

  const userIds = memberRes.data.map(m => m.userId);
  const userRes = await db.collection('users')
    .where({ _id: _.in(userIds) }).limit(userIds.length).get();
  const userMap = new Map(userRes.data.map(u => [u._id, u]));

  return memberRes.data.map(m => {
    const u = userMap.get(m.userId) || {};
    return {
      userId: m.userId,
      nickname: u.nickname || '未知用户',
      avatarUrl: u.avatarUrl || '',
      avatarColor: u.avatarColor || '#FF6B6B',
      role: m.role,
      joinedAt: m.joinedAt
    };
  });
}

/**
 * 修改班级信息
 * 权限：管理员
 */
async function updateClass(payload = {}, ctx) {
  const classId = id(payload.classId);
  await requireOwner(classId, ctx);

  const data = { updatedAt: new Date() };
  if (payload.name !== undefined) data.name = className(payload.name);
  if (payload.description !== undefined) data.description = classDesc(payload.description);

  await db.collection('classes').doc(classId).update({ data });

  return { name: data.name, description: data.description };
}

/**
 * 移除成员（不能移除自己）
 * 权限：管理员
 */
async function removeMember(payload = {}, ctx) {
  const classId = id(payload.classId);
  const targetUserId = id(payload.userId, '用户ID');
  await requireOwner(classId, ctx);

  if (targetUserId === ctx.userId) {
    throw bizError(CODES.PARAM_INVALID, '不能移除自己，请使用退出班级或转让管理员');
  }

  const memberRes = await db.collection('class_members')
    .where({ classId, userId: targetUserId }).limit(1).get();
  if (!memberRes.data.length) throw bizError(CODES.NOT_MEMBER, '该用户不在班级中');

  await db.collection('class_members')
    .where({ classId, userId: targetUserId }).remove();

  // 刷新该班全部作业 stats.totalCount -1（完成记录保留）
  const statsRes = await db.collection('assignment_stats').where({ classId }).get();
  for (const stat of statsRes.data) {
    await db.collection('assignment_stats').doc(stat._id).update({
      data: { totalCount: _.inc(-1), updatedAt: new Date() }
    });
  }

  return null;
}

/**
 * 退出班级（管理员须先转让）
 * 权限：成员
 */
async function leaveClass(payload = {}, ctx) {
  const classId = id(payload.classId);
  const member = await requireMember(classId, ctx);

  if (member.role === 'owner') {
    throw bizError(CODES.NOT_OWNER, '管理员请先转让后再退出');
  }

  await db.collection('class_members')
    .where({ classId, userId: ctx.userId }).remove();

  // 刷新 stats.totalCount -1
  const statsRes = await db.collection('assignment_stats').where({ classId }).get();
  for (const stat of statsRes.data) {
    await db.collection('assignment_stats').doc(stat._id).update({
      data: { totalCount: _.inc(-1), updatedAt: new Date() }
    });
  }

  return null;
}

/**
 * 转让管理员
 * 权限：管理员；不能转让给自己
 */
async function transferOwner(payload = {}, ctx) {
  const classId = id(payload.classId);
  const newOwnerId = id(payload.userId, '新管理员ID');
  await requireOwner(classId, ctx);

  if (newOwnerId === ctx.userId) {
    throw bizError(CODES.PARAM_INVALID, '不能转让给自己');
  }

  // 验证目标是否是成员
  const targetMember = await db.collection('class_members')
    .where({ classId, userId: newOwnerId }).limit(1).get();
  if (!targetMember.data.length) throw bizError(CODES.NOT_MEMBER, '该用户不在班级中');

  const now = new Date();
  // 当前管理员降级
  await db.collection('class_members')
    .where({ classId, userId: ctx.userId }).update({ data: { role: 'member' } });
  // 目标升级
  await db.collection('class_members')
    .where({ classId, userId: newOwnerId }).update({ data: { role: 'owner' } });
  // 更新班级 ownerId
  await db.collection('classes').doc(classId).update({
    data: { ownerId: newOwnerId, updatedAt: now }
  });

  return { ownerId: newOwnerId };
}

/**
 * 解散班级
 * 权限：管理员
 */
async function dissolveClass(payload = {}, ctx) {
  const classId = id(payload.classId);
  await requireOwner(classId, ctx);

  const now = new Date();
  // 班级标记为 dissolved
  await db.collection('classes').doc(classId).update({
    data: { status: 'dissolved', updatedAt: now }
  });
  // 删除全部成员关系
  await db.collection('class_members').where({ classId }).remove();
  // 删除全部 stats 文档
  await db.collection('assignment_stats').where({ classId }).remove();

  return null;
}

/**
 * 重新生成邀请码
 * 权限：管理员
 */
async function regenerateInviteCode(payload = {}, ctx) {
  const classId = id(payload.classId);
  await requireOwner(classId, ctx);

  const newCode = await generateInviteCode();
  const clsRes = await db.collection('classes').doc(classId).get();
  const currentVersion = (clsRes.data && clsRes.data.inviteCodeVersion) || 1;

  await db.collection('classes').doc(classId).update({
    data: {
      inviteCode: newCode,
      inviteCodeVersion: currentVersion + 1,
      updatedAt: new Date()
    }
  });

  return { inviteCode: newCode };
}

module.exports = {
  createClass,
  joinClass,
  getMyClasses,
  getClassDetail,
  getClassMembers,
  updateClass,
  removeMember,
  leaveClass,
  transferOwner,
  dissolveClass,
  regenerateInviteCode
};
