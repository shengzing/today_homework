/**
 * 全局状态管理 — 小程序详细设计 §4
 */
const api = require('./api');

const state = {
  user: null,
  classes: [],
  classMap: {},
  assignments: {},
  completions: {},
  achievements: {},
  currentClassId: null,
  loading: {}
};

const _lastFetchAt = {};

function _isExpired(key, ttl = 60000) {
  const ts = _lastFetchAt[key];
  return !ts || Date.now() - ts > ttl;
}

function _setFetched(key) {
  _lastFetchAt[key] = Date.now();
}

const actions = {
  async login(data) {
    const res = await api.login(data);
    state.user = res;
    return res;
  },

  async updateNickname(nickname) {
    const res = await api.updateNickname({ nickname });
    if (state.user) state.user.nickname = res.nickname;
    return res;
  },

  async loadMyClasses(force) {
    if (!force && state.classes.length && !_isExpired('classes')) return state.classes;
    const list = await api.getMyClasses();
    state.classes = list;
    _setFetched('classes');
    return list;
  },

  async createClass(data) {
    const res = await api.createClass(data);
    state.classes = []; // 清空让下次刷新
    return res;
  },

  async joinClass(inviteCode) {
    const res = await api.joinClass({ inviteCode });
    state.classes = [];
    return res;
  },

  async loadClass(classId, force) {
    const key = 'class_' + classId;
    if (!force && state.classMap[classId] && !_isExpired(key)) return state.classMap[classId];
    const detail = await api.getClassDetail({ classId });
    state.classMap[classId] = detail;
    state.currentClassId = classId;
    _setFetched(key);
    return detail;
  },

  async loadAssignments(classId, scope, force) {
    const key = 'assignments_' + classId + '_' + scope;
    if (!force && state.assignments[classId] && state.assignments[classId][scope] && !_isExpired(key)) {
      return state.assignments[classId][scope];
    }
    const list = await api.getAssignments({ classId, scope });
    if (!state.assignments[classId]) state.assignments[classId] = {};
    state.assignments[classId][scope] = list;
    _setFetched(key);
    return list;
  },

  async createAssignment(data) {
    const res = await api.createAssignment(data);
    if (state.assignments[data.classId]) {
      delete state.assignments[data.classId]; // 清空缓存
    }
    return res;
  },

  async updateAssignment(data) {
    const res = await api.updateAssignment(data);
    // 清空相关缓存
    Object.keys(state.assignments).forEach(k => delete state.assignments[k]);
    return res;
  },

  async deleteAssignment(data) {
    await api.deleteAssignment(data);
    Object.keys(state.assignments).forEach(k => delete state.assignments[k]);
  },

  async completeAssignment(assignmentId) {
    // 乐观更新
    const local = state.completions[assignmentId] || [];
    if (local.some(c => c.userId === state.user?.userId)) return;

    state.completions[assignmentId] = [
      ...local,
      { userId: state.user?.userId, completedAt: null, pending: true }
    ];

    try {
      const res = await api.completeAssignment({ assignmentId });
      // 用服务端数据替换
      state.completions[assignmentId] = [
        ...local,
        { userId: state.user?.userId, completedAt: res.completedAt, pending: false }
      ];
      // 清空成就缓存
      state.achievements = {};
      return res;
    } catch (e) {
      // 回滚
      state.completions[assignmentId] = local;
      throw e;
    }
  },

  async loadRanking(assignmentId, force) {
    const key = 'ranking_' + assignmentId;
    if (!force && state.completions[assignmentId] && !_isExpired(key)) {
      return state.completions[assignmentId];
    }
    const res = await api.getAssignmentRanking({ assignmentId });
    state.completions[assignmentId] = res;
    _setFetched(key);
    return res;
  },

  async loadAchievement(classId, force) {
    const key = 'achievement_' + classId;
    if (!force && state.achievements[classId] && !_isExpired(key)) {
      return state.achievements[classId];
    }
    const res = await api.getAchievement({ classId });
    state.achievements[classId] = res;
    _setFetched(key);
    return res;
  }
};

const selectors = {
  classStats(classId) {
    const cls = state.classMap[classId];
    if (!cls) return { memberCount: 0, todayCount: 0, todayRate: 0 };
    const today = (state.assignments[classId]?.today) || [];
    const doneCount = today.reduce((s, a) => s + (a.doneCount || 0), 0);
    const totalPossible = today.length * (cls.memberCount || 0);
    const todayRate = totalPossible ? Math.round(doneCount / totalPossible * 100) : 0;
    return {
      memberCount: cls.memberCount || 0,
      todayCount: today.length,
      todayRate
    };
  },

  assignmentList(classId, scope) {
    return (state.assignments[classId]?.[scope]) || [];
  },

  myRank(assignmentId) {
    const ranking = state.completions[assignmentId];
    if (!ranking) return null;
    return ranking.myRank || null;
  },

  myAchievement(classId) {
    return state.achievements[classId]?.myRow || null;
  }
};

const store = { state, actions, selectors };
module.exports = { store };
