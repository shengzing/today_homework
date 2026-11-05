Component({
  properties: {
    visible: { type: Boolean, value: false },
    title: { type: String, value: '确认' },
    content: { type: String, value: '' }
  },
  methods: {
    onConfirm() { this.triggerEvent('confirm'); },
    onCancel() { this.triggerEvent('cancel'); }
  }
});
