const { store } = require('../../utils/store');
const { validate } = require('../../utils/validate');
const toast = require('../../utils/toast');
const { deadlineText } = require('../../utils/format');

Page({
  data: {
    mode: 'create', // create | edit
    classId: '',
    assignmentId: '',
    form: {
      title: '',
      content: '',
      deadline: null
    },
    deadlineOptions: [],
    deadlineIndex: 0,
    errors: {},
    submitting: false
  },

  async onLoad(query) {
    if (query.assignmentId) {
      // 编辑模式
      this.setData({ mode: 'edit', assignmentId: query.assignmentId });
      await this.loadAssignment();
    } else if (query.classId) {
      // 新建模式
      const { endOfDay } = this._getEndOfDay();
      this.setData({
        classId: query.classId,
        'form.deadline': endOfDay
      });
      this.buildDeadlineOptions(endOfDay);
    } else {
      wx.showToast({ title: '参数错误', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1000);
    }
  },

  _getEndOfDay() {
    // 东八区当天 24:00
    const now = new Date();
    const tzOffset = 8 * 60 * 60 * 1000;
    const shifted = new Date(now.getTime() + tzOffset);
    const dayStart = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
    const endOfDay = dayStart - tzOffset + 24 * 60 * 60 * 1000;
    return { endOfDay, now };
  },

  buildDeadlineOptions(currentDeadline) {
    const { now } = this._getEndOfDay();
    const oneDay = 24 * 60 * 60 * 1000;
    const tzOffset = 8 * 60 * 60 * 1000;

    const todayEnd = this._getEndOfDay().endOfDay;
    const tomorrowEnd = todayEnd + oneDay;
    const dayAfterEnd = todayEnd + 2 * oneDay;

    const options = [
      { label: '今天 24:00', value: todayEnd },
      { label: '明天 24:00', value: tomorrowEnd },
      { label: '后天 24:00', value: dayAfterEnd }
    ];

    if (this.data.mode === 'edit') {
      options.push({ label: '不设置', value: null });
    }

    // 找到匹配的 index
    let deadlineIndex = 0;
    for (let i = 0; i < options.length; i++) {
      if (currentDeadline === null && options[i].value === null) { deadlineIndex = i; break; }
      if (currentDeadline && options[i].value === currentDeadline) { deadlineIndex = i; break; }
    }

    this.setData({ deadlineOptions: options, deadlineIndex });
  },

  async loadAssignment() {
    try {
      const detail = await store.actions.loadAssignmentDetail?.(this.data.assignmentId);
      // 通过 api 获取详情
      const api = require('../../utils/api');
      const res = await api.getAssignmentDetail({ assignmentId: this.data.assignmentId });
      this.setData({
        classId: res.classId,
        'form.title': res.title,
        'form.content': res.content,
        'form.deadline': res.deadline
      });
      this.buildDeadlineOptions(res.deadline);
    } catch (e) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  onTitleInput(e) {
    this.setData({ 'form.title': e.detail.value, 'errors.title': '' });
  },

  onContentInput(e) {
    this.setData({ 'form.content': e.detail.value, 'errors.content': '' });
  },

  onDeadlineChange(e) {
    const index = e.detail.value;
    const option = this.data.deadlineOptions[index];
    this.setData({
      deadlineIndex: index,
      'form.deadline': option.value
    });
  },

  async onSubmit() {
    const { title: titleVal, content: contentVal, deadline } = this.data.form;

    const titleErr = validate.title(titleVal);
    const contentErr = validate.content(contentVal);
    if (titleErr || contentErr) {
      this.setData({ 'errors.title': titleErr, 'errors.content': contentErr });
      return;
    }

    if (this.data.submitting) return;
    this.setData({ submitting: true });

    try {
      if (this.data.mode === 'create') {
        await store.createAssignment({
          classId: this.data.classId,
          title: titleVal,
          content: contentVal,
          deadline
        });
        toast.show('发布成功');
      } else {
        // 编辑模式：deadline 三态
        const payload = { assignmentId: this.data.assignmentId, title: titleVal, content: contentVal };
        // 当前选择的 deadline 值
        const selectedOption = this.data.deadlineOptions[this.data.deadlineIndex];
        if (selectedOption.label === '不设置') {
          payload.deadline = null; // 显式传 null 清除
        } else {
          payload.deadline = deadline;
        }
        await store.actions.updateAssignment(payload);
        toast.show('修改成功');
      }
      setTimeout(() => wx.navigateBack(), 500);
    } catch (e) {
      // error already toasted
    } finally {
      this.setData({ submitting: false });
    }
  }
});
