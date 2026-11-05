/**
 * 轻提示 — 含「诚实的小朋友」卡片
 */

function show(text, icon = 'none', duration = 2000) {
  wx.showToast({ title: text, icon, duration });
}

function loading(text = '加载中') {
  wx.showLoading({ title: text, mask: true });
}

function hideLoading() {
  wx.hideLoading();
}

function modal(title, content) {
  return new Promise(resolve => {
    wx.showModal({
      title,
      content,
      success: res => resolve(res.confirm)
    });
  });
}

/**
 * 完成作业后的「诚实的小朋友」提示卡
 * 先显示主标题 1.5s，结束后显示得分详情 2s
 * @param {number} rank - 名次
 * @param {number} points - 得分
 */
function honestReminder(rank, points) {
  const title = '你是一个诚实的小朋友 🌟';
  let content = '';
  if (rank && rank > 0) {
    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '';
    content = `${medal} 第 ${rank} 名完成，获得 ${points} 分`;
  } else {
    content = '已记录完成 ✅';
  }

  // 先显示主标题，结束后再显示详情，避免 toast 覆盖闪烁
  wx.showToast({ title, icon: 'none', duration: 1500 });
  setTimeout(() => {
    wx.showToast({ title: content, icon: 'none', duration: 2000 });
  }, 1600);
}

module.exports = { show, loading, hideLoading, modal, honestReminder };
