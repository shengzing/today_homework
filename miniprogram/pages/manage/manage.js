const { store } = require('../../utils/store');
const { validate } = require('../../utils/validate');
const toast = require('../../utils/toast');

Page({
  data: {
    classId: '',
    classInfo: null,
    members: [],
    loading: true,
    isOwner: false,
    showEdit: false,
    editForm: { name: '', description: '' },
    showTransfer: false,
    transferTarget: '',
    showConfirmDissolve: false
  },

  async onLoad(query) {
    if (!query.classId) {
      wx.showToast({ title: '参数错误', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1000);
      return;
    }
    this.setData({ classId: query.classId });
    await this.loadAll();
  },

  async loadAll() {
    this.setData({ loading: true });
    try {
      const api = require('../../utils/api');
      const [classInfo, members] = await Promise.all([
        store.loadClass(this.data.classId, true),
        api.getClassMembers({ classId: this.data.classId })
      ]);
      this.setData({
        classInfo,
        members,
        isOwner: classInfo.role === 'owner',
        loading: false
      });
    } catch (e) {
      this.setData({ loading: false });
    }
  },

  // 复制邀请码
  onCopyCode() {
    wx.setClipboardData({ data: this.data.classInfo.inviteCode });
  },

  // 重新生成邀请码
  async onRegenerateCode() {
    const confirmed = await toast.modal('重新生成', '旧邀请码将失效，确定吗？');
    if (!confirmed) return;
    try {
      const api = require('../../utils/api');
      const res = await api.regenerateInviteCode({ classId: this.data.classId });
      toast.show('已生成新邀请码');
      await this.loadAll();
    } catch (e) {}
  },

  // 编辑班级
  openEdit() {
    this.setData({
      showEdit: true,
      editForm: { name: this.data.classInfo.name, description: this.data.classInfo.description || '' }
    });
  },
  closeEdit() { this.setData({ showEdit: false }); },
  onEditName(e) { this.setData({ 'editForm.name': e.detail.value }); },
  onEditDesc(e) { this.setData({ 'editForm.description': e.detail.value }); },

  async onEditSubmit() {
    const { name, description } = this.data.editForm;
    const nameErr = validate.className(name);
    if (nameErr) { toast.show(nameErr); return; }
    try {
      const api = require('../../utils/api');
      await api.updateClass({ classId: this.data.classId, name, description });
      toast.show('修改成功');
      this.closeEdit();
      await this.loadAll();
    } catch (e) {}
  },

  // 移除成员
  async onRemoveMember(e) {
    const userId = e.currentTarget.dataset.userid;
    const nickname = e.currentTarget.dataset.name;
    const confirmed = await toast.modal('移除成员', `确定移除 ${nickname} 吗？\n该成员的历史完成记录将保留。`);
    if (!confirmed) return;
    try {
      const api = require('../../utils/api');
      await api.removeMember({ classId: this.data.classId, userId });
      toast.show('已移除');
      await this.loadAll();
    } catch (e) {}
  },

  // 退出班级
  async onLeave() {
    const confirmed = await toast.modal('退出班级', '确定退出此班级吗？');
    if (!confirmed) return;
    try {
      const api = require('../../utils/api');
      await api.leaveClass({ classId: this.data.classId });
      toast.show('已退出');
      setTimeout(() => wx.navigateBack(), 500);
    } catch (e) {}
  },

  // 转让管理员
  openTransfer() { this.setData({ showTransfer: true }); },
  closeTransfer() { this.setData({ showTransfer: false, transferTarget: '' }); },
  onTransferPick(e) {
    this.setData({ transferTarget: e.currentTarget.dataset.userid });
  },
  async onTransferConfirm() {
    if (!this.data.transferTarget) { toast.show('请选择新管理员'); return; }
    const confirmed = await toast.modal('转让管理员', '确定转让吗？你将变为普通成员');
    if (!confirmed) return;
    try {
      const api = require('../../utils/api');
      await api.transferOwner({ classId: this.data.classId, userId: this.data.transferTarget });
      toast.show('已转让');
      this.closeTransfer();
      await this.loadAll();
    } catch (e) {}
  },

  // 解散班级
  onDissolve() {
    this.setData({ showConfirmDissolve: true });
  },
  async onConfirmDissolve() {
    this.setData({ showConfirmDissolve: false });
    try {
      const api = require('../../utils/api');
      await api.dissolveClass({ classId: this.data.classId });
      toast.show('已解散');
      setTimeout(() => wx.navigateBack(), 500);
    } catch (e) {}
  },
  onCancelDissolve() {
    this.setData({ showConfirmDissolve: false });
  },

  onShareAppMessage() {
    return {
      title: `来一起做作业吧 — ${this.data.classInfo?.name || ''}`,
      path: `/pages/class/class?classId=${this.data.classId}`
    };
  }
});
