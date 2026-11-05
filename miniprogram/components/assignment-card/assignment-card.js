Component({
  properties: {
    item: { type: Object, value: {} },
    userId: { type: String, value: '' }
  },
  methods: {
    onTap() {
      this.triggerEvent('tap', { assignmentId: this.data.item.assignmentId });
    }
  }
});
