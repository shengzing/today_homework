const { store } = require('../../utils/store');
const toast = require('../../utils/toast');
const { pointsOf } = require('../../utils/config');
const { deadlineText } = require('../../utils/format');

Page({
  data: {
    assignmentId: '',
    detail: null,
    ranking: null,
    loading: true,
    showMenu: false,
    showConfirmDelete: false,
    isCreator: false,
    _watcher: null,
    _debounceTimer: null
  },

  async onLoad(query) {
    if (!query.assignmentId) {
      wx.showToast({ title: '参数错误', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1000);
      return;
    }
    this.setData({ assignmentId: query.assignmentId });
    await this.loadAll();
    this.watchStats();
  },

  async onShow() {
    if (this.data.assignmentId && this.data.detail) {
      await this.loadRanking(true);
    }
  },

  onUnload() {
    this.unwatchStats();
  },

  async loadAll() {
    this.setData({ loading: true });
    try {
      const api = require('../../utils/api');
      const [detail, ranking] = await Promise.all([
        api.getAssignmentDetail({ assignmentId: this.data.assignmentId }),
        store.loadRanking(this.data.assignmentId)
      ]);

      const isCreator = detail.creatorId === store.state.user?.userId;

      this.setData({
        detail: {
          ...detail,
          deadlineText: detail.deadline ? deadlineText(detail.deadline) : ''
        },
        ranking,
        isCreator,
        loading: false
      });
    } catch (e) {
      this.setData({ loading: false });
    }
  },

  async loadRanking(force) {
    try {
      const ranking = await store.loadRanking(this.data.assignmentId, force);
      this.setData({ ranking });
    } catch (e) {
      console.error('load ranking', e);
    }
  },

  async onComplete() {
    const { detail } = this.data;
    if (!detail) return;

    // 如果是过期作业，二次确认
    if (detail.myStatus === 'expired') {
      const confirmed = await toast.modal('已截止', '作业已截止，仍要记录完成吗？');
      if (!confirmed) return;
    }

    try {
      await store.actions.completeAssignment(this.data.assignmentId);

      // 计算名次与得分
      const ranking = await store.loadRanking(this.data.assignmentId, true);
      const myRank = ranking.myRank;
      const rank = myRank?.rank;
      const points = myRank?.overdue ? 0 : (rank ? pointsOf(rank) : 0);

      // 弹出「诚实的小朋友」提示卡
      toast.honestReminder(rank, points);

      // 重新加载详情
      await this.loadAll();
    } catch (e) {
      console.error('complete error', e);
    }
  },

  onScrollToRanking() {
    // 滚动到排行榜区域
    wx.pageScrollTo({ selector: '.ranking-section', smooth: true });
  },

  onCompleteBtnTap() {
    const { detail } = this.data;
    if (!detail) return;

    if (detail.myCompleted) {
      // 已完成，点击滚动到排行榜
      this.onScrollToRanking();
    } else {
      this.onComplete();
    }
  },

  // 菜单
  openMenu() { this.setData({ showMenu: true }); },
  closeMenu() { this.setData({ showMenu: false }); },

  onMenuEdit() {
    this.setData({ showMenu: false });
    wx.navigateTo({ url: `/pages/publish/publish?assignmentId=${this.data.assignmentId}` });
  },

  onMenuDelete() {
    this.setData({ showMenu: false, showConfirmDelete: true });
  },

  async onConfirmDelete() {
    this.setData({ showConfirmDelete: false });
    try {
      await store.actions.deleteAssignment({ assignmentId: this.data.assignmentId });
      toast.show('已删除');
      setTimeout(() => wx.navigateBack(), 500);
    } catch (e) {}
  },

  onCancelDelete() {
    this.setData({ showConfirmDelete: false });
  },

  onMenuShare() {
    this.setData({ showMenu: false });
    // 分享由 onShareAppMessage 处理
  },

  onMenuCopy() {
    this.setData({ showMenu: false });
    wx.setClipboardData({ data: this.data.assignmentId });
  },

  onShareAppMessage() {
    return {
      title: this.data.detail?.title || '今日作业',
      path: `/pages/detail/detail?assignmentId=${this.data.assignmentId}`
    };
  },

  watchStats() {
    const db = wx.cloud.database();
    this.data._watcher = db.collection('assignment_stats')
      .doc(this.data.assignmentId)
      .watch({
        onChange: () => {
          if (this.data._debounceTimer) clearTimeout(this.data._debounceTimer);
          this.data._debounceTimer = setTimeout(() => {
            this.loadRanking(true);
          }, 300);
        },
        onError: (err) => console.error('watch error', err)
      });
  },

  unwatchStats() {
    if (this.data._watcher) {
      this.data._watcher.close();
      this.data._watcher = null;
    }
    if (this.data._debounceTimer) {
      clearTimeout(this.data._debounceTimer);
      this.data._debounceTimer = null;
    }
  }
});
