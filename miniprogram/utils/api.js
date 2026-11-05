/**
 * 云函数调用封装 — 小程序详细设计 §5
 */
const ERR_MSG = {
  '40000': '功能异常',
  '40001': '参数错误',
  '40100': '请重新授权',
  '40101': '请先登录',
  '40301': '你不在该班级中',
  '40302': '只有管理员可以执行此操作',
  '40303': '只有发布者可以执行此操作',
  '40401': '内容不存在',
  '40901': '邀请码无效或已失效',
  '50000': '服务异常，请稍后再试'
};

function call(action, payload = {}, options = {}) {
  const { showLoading = true, loadingText = '加载中' } = options;
  if (showLoading) wx.showLoading({ title: loadingText, mask: true });

  return wx.cloud.callFunction({
    name: 'api',
    data: { action, payload }
  }).then(res => {
    if (showLoading) wx.hideLoading();
    const result = res.result;
    if (result.code === '0') return result.data;

    // 业务错误
    const msg = ERR_MSG[result.code] || result.message || '未知错误';
    if (result.code === '40101') {
      wx.redirectTo({ url: '/pages/login/login' });
    }
    if (showLoading !== false) wx.showToast({ title: msg, icon: 'none' });
    const err = new Error(msg);
    err.bizCode = result.code;
    throw err;
  }).catch(e => {
    if (showLoading) wx.hideLoading();
    if (e.bizCode) throw e; // 已处理过的业务错误
    wx.showToast({ title: '网络异常', icon: 'none' });
    throw e;
  });
}

module.exports = {
  // 用户
  login: (data) => call('login', data, { showLoading: false }),
  updateNickname: (data) => call('updateNickname', data),
  // 班级
  createClass: (data) => call('createClass', data),
  joinClass: (data) => call('joinClass', data),
  getMyClasses: () => call('getMyClasses', {}, { showLoading: false }),
  getClassDetail: (data) => call('getClassDetail', data, { showLoading: false }),
  getClassMembers: (data) => call('getClassMembers', data),
  updateClass: (data) => call('updateClass', data),
  removeMember: (data) => call('removeMember', data),
  leaveClass: (data) => call('leaveClass', data),
  transferOwner: (data) => call('transferOwner', data),
  dissolveClass: (data) => call('dissolveClass', data),
  regenerateInviteCode: (data) => call('regenerateInviteCode', data),
  // 作业
  createAssignment: (data) => call('createAssignment', data),
  updateAssignment: (data) => call('updateAssignment', data),
  deleteAssignment: (data) => call('deleteAssignment', data),
  getAssignments: (data) => call('getAssignments', data, { showLoading: false }),
  getAssignmentDetail: (data) => call('getAssignmentDetail', data, { showLoading: false }),
  // 完成与排名
  completeAssignment: (data) => call('completeAssignment', data),
  getAssignmentRanking: (data) => call('getAssignmentRanking', data, { showLoading: false }),
  getAchievement: (data) => call('getAchievement', data, { showLoading: false })
};
