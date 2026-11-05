const { store } = require('../../utils/store');
const toast = require('../../utils/toast');
const { pointsOf } = require('../../utils/config');
const { deadlineText } = require('../../utils/format');
const api = require('../../utils/api');

Page({
  data: {
    assignmentId: '',
    detail: null,
    ranking: null,
    loading: true,
    showMenu: false,
    showConfirmDelete: false,
    isCreator: false
  },

  _watcher: null,
  _debounceTimer: null,

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

    if (detail.myStatus === 'expired') {
      const confirmed = await toast.modal('已截止', '作业已截止，仍要记录完成吗？');
      if (!confirmed) return;
    }

    try {
      await store.actions.completeAssignment(this.data.assignmentId);

      const ranking = await store.loadRanking(this.data.assignmentId, true);
      const myRank = ranking.myRank;
      const rank = myRank?.rank;
      const points = myRank?.overdue ? 0 : (rank ? pointsOf(rank) : 0);

      toast.honestReminder(rank, points);
      await this.loadAll();
    } catch (e) {
      console.error('complete error', e);
    }
  },

  onScrollToRanking() {
    wx.pageScrollTo({ selector: '.ranking-section', smooth: true });
  },

  onCompleteBtnTap() {
    const { detail } = this.data;
    if (!detail) return;

    if (detail.myCompleted) {
      this.onScrollToRanking();
    } else {
      this.onComplete();
    }
  },

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
    this._watcher = db.collection('assignment_stats')
      .doc(this.data.assignmentId)
      .watch({
        onChange: () => {
          if (this._debounceTimer) clearTimeout(this._debounceTimer);
          this._debounceTimer = setTimeout(() => {
            this.loadRanking(true);
          }, 300);
        },
        onError: (err) => console.error('watch error', err)
      });
  },

  unwatchStats() {
    if (this._watcher) {
      this._watcher.close();
      this._watcher = null;
    }
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = null;
    }
  }
});
