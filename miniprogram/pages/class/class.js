const { store } = require('../../utils/store');
const { deadlineText } = require('../../utils/format');

Page({
  data: {
    classId: '',
    classInfo: null,
    activeTab: 'today',
    todayList: [],
    historyList: [],
    achievement: null,
    loading: true,
    isOwner: false
  },

  _watcher: null,
  _debounceTimer: null,

  async onLoad(query) {
    if (!query.classId) {
      wx.showToast({ title: '参数错误', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1000);
      return;
    }
    this.setData({ classId: query.classId });
    await this.loadAll();
    this.watchStats();
  },

  async onShow() {
    if (this.data.classId && this.data.classInfo) {
      await this.loadAll(true);
    }
  },

  onUnload() {
    this.unwatchStats();
  },

  async loadAll(force) {
    this.setData({ loading: true });
    try {
      const classInfo = await store.loadClass(this.data.classId, force);
      const isOwner = classInfo.role === 'owner';

      const [todayList, historyList] = await Promise.all([
        store.loadAssignments(this.data.classId, 'today', force),
        store.loadAssignments(this.data.classId, 'history', force)
      ]);

      const fmtList = (list) => list.map(a => ({
        ...a,
        deadlineText: a.deadline ? deadlineText(a.deadline) : ''
      }));

      this.setData({
        classInfo,
        isOwner,
        todayList: fmtList(todayList),
        historyList: fmtList(historyList),
        loading: false
      });

      if (this.data.activeTab === 'achievement') {
        this.loadAchievement(force);
      }
    } catch (e) {
      this.setData({ loading: false });
    }
  },

  async loadAchievement(force) {
    try {
      const ach = await store.loadAchievement(this.data.classId, force);
      this.setData({ achievement: ach });
    } catch (e) {
      console.error('load achievement', e);
    }
  },

  onTabChange(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab });
    if (tab === 'achievement' && !this.data.achievement) {
      this.loadAchievement();
    }
  },

  onAssignmentTap(e) {
    const assignmentId = e.detail.assignmentId;
    wx.navigateTo({ url: `/pages/detail/detail?assignmentId=${assignmentId}` });
  },

  onPublish() {
    wx.navigateTo({ url: `/pages/publish/publish?classId=${this.data.classId}` });
  },

  onManage() {
    wx.navigateTo({ url: `/pages/manage/manage?classId=${this.data.classId}` });
  },

  watchStats() {
    const db = wx.cloud.database();
    this._watcher = db.collection('assignment_stats')
      .where({ classId: this.data.classId })
      .watch({
        onChange: () => {
          if (this._debounceTimer) clearTimeout(this._debounceTimer);
          this._debounceTimer = setTimeout(() => {
            this.loadAll(true);
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
