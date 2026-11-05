/**
 * 云函数统一入口 — action 路由 + 鉴权 + 错误包装
 * 文档引用：后端服务设计 §4.2
 */
const cloud = require('wx-server-sdk');
const errcode = require('./utils/errcode');
const auth = require('./utils/auth');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const routes = {
  // 用户
  login: require('./services/user').login,
  updateNickname: require('./services/user').updateNickname,
  // 班级
  createClass: require('./services/class').createClass,
  joinClass: require('./services/class').joinClass,
  getMyClasses: require('./services/class').getMyClasses,
  getClassDetail: require('./services/class').getClassDetail,
  getClassMembers: require('./services/class').getClassMembers,
  updateClass: require('./services/class').updateClass,
  removeMember: require('./services/class').removeMember,
  leaveClass: require('./services/class').leaveClass,
  transferOwner: require('./services/class').transferOwner,
  dissolveClass: require('./services/class').dissolveClass,
  regenerateInviteCode: require('./services/class').regenerateInviteCode,
  // 作业
  createAssignment: require('./services/assignment').createAssignment,
  updateAssignment: require('./services/assignment').updateAssignment,
  deleteAssignment: require('./services/assignment').deleteAssignment,
  getAssignments: require('./services/assignment').getAssignments,
  getAssignmentDetail: require('./services/assignment').getAssignmentDetail,
  // 完成与排名
  completeAssignment: require('./services/completion').completeAssignment,
  getAssignmentRanking: require('./services/rank').getAssignmentRanking,
  getAchievement: require('./services/rank').getAchievement
};

exports.main = async (event) => {
  const { action, payload = {} } = event || {};
  const fn = routes[action];
  if (!fn) return errcode.fail(errcode.CODES.UNKNOWN_ACTION, '未知接口');

  try {
    const ctx = await auth.buildContext();
    const data = await fn(payload, ctx);
    return errcode.ok(data);
  } catch (e) {
    if (e && e.bizCode) {
      return errcode.fail(e.bizCode, e.message);
    }
    console.error('[api]', action, e);
    return errcode.fail(errcode.CODES.SERVER_ERROR, '服务异常，请稍后再试');
  }
};

// 导出 routes 供测试使用
exports.routes = routes;
