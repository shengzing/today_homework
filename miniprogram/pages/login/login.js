const { store } = require('../../utils/store');

Page({
  data: {
    loading: false
  },

  onLoad() {
    // 检查登录态
    if (store.state.user) {
      wx.redirectTo({ url: '/pages/home/home' });
    }
  },

  async onAuthorize(e) {
    if (this.data.loading) return;
    this.setData({ loading: true });

    try {
      // 获取用户信息（wx.getUserProfile 已废弃，用 button open-type）
      let nickname = '微信用户';
      let avatarColor = '';

      if (e.detail.userInfo) {
        nickname = e.detail.userInfo.nickName || '微信用户';
        // avatarUrl 不持久化（临时 URL），仅保存 avatarColor
        avatarColor = '';
      }

      const res = await store.login({ nickname, avatarColor });
      wx.showToast({ title: '欢迎' + (res.nickname || ''), icon: 'none' });
      setTimeout(() => {
        wx.redirectTo({ url: '/pages/home/home' });
      }, 500);
    } catch (e) {
      console.error('login error', e);
    } finally {
      this.setData({ loading: false });
    }
  }
});
