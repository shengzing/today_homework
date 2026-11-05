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
 * @param {number} rank - 名次
 * @param {number} points - 得分
 */
function honestReminder(rank, points) {
  let title = '你是一个诚实的小朋友';
  let content = '';
  if (rank && rank > 0) {
    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '';
    content = `${medal} 第 ${rank} 名完成，获得 ${points} 分`;
  } else {
    content = '已记录完成';
  }
  wx.showToast({ title, icon: 'none', duration: 2500 });
  setTimeout(() => {
    wx.showToast({ title: content, icon: 'none', duration: 2000 });
  }, 500);
}

module.exports = { show, loading, hideLoading, modal, honestReminder };
