const { store } = require('../../utils/store');
const { validate } = require('../../utils/validate');
const toast = require('../../utils/toast');

Page({
  data: {
    classes: [],
    loading: true,
    showCreate: false,
    showJoin: false,
    createForm: { name: '', description: '' },
    joinForm: { code: '' },
    createErrors: {},
    joinError: ''
  },

  async onLoad() {
    await this.loadClasses();
  },

  async onShow() {
    if (store.state.classes.length) {
      await this.loadClasses(true);
    }
  },

  async loadClasses(force) {
    this.setData({ loading: true });
    try {
      const list = await store.loadMyClasses(force);
      this.setData({ classes: list, loading: false });
    } catch (e) {
      this.setData({ loading: false });
    }
  },

  onClassTap(e) {
    const classId = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/class/class?classId=${classId}` });
  },

  // 创建班级弹窗
  openCreate() { this.setData({ showCreate: true }); },
  closeCreate() { this.setData({ showCreate: false, createForm: { name: '', description: '' }, createErrors: {} }); },
  onCreateName(e) { this.setData({ 'createForm.name': e.detail.value }); },
  onCreateDesc(e) { this.setData({ 'createForm.description': e.detail.value }); },

  async onCreateSubmit() {
    const { name, description } = this.data.createForm;
    const nameErr = validate.className(name);
    if (nameErr) { this.setData({ 'createErrors.name': nameErr }); return; }

    try {
      await store.createClass({ name, description });
      toast.show('创建成功');
      this.closeCreate();
      await this.loadClasses(true);
    } catch (e) {
      // error already toasted by api.js
    }
  },

  // 加入班级弹窗
  openJoin() { this.setData({ showJoin: true }); },
  closeJoin() { this.setData({ showJoin: false, joinForm: { code: '' }, joinError: '' }); },
  onJoinCode(e) {
    const code = e.detail.value.toUpperCase();
    this.setData({ 'joinForm.code': code, joinError: '' });
  },

  async onJoinSubmit() {
    const { code } = this.data.joinForm;
    const err = validate.inviteCode(code);
    if (err) { this.setData({ joinError: err }); return; }

    try {
      await store.joinClass(code);
      toast.show('加入成功');
      this.closeJoin();
      await this.loadClasses(true);
    } catch (e) {
      this.setData({ joinError: e.message || '邀请码无效' });
    }
  }
});
