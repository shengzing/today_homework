/* ==========================================================================
   今日作业 · 路由与交互
   ========================================================================== */
(function (global) {
  'use strict';

  var viewport, navbar, actionbar;
  var CAPSULE = '<div class="capsule">' +
    '<button data-action="capsule-more" aria-label="更多">' + UI.icon('dots', 16) + '</button>' +
    '<span class="capsule__div"></span>' +
    '<button data-action="capsule-target" aria-label="关闭">' + UI.icon('target', 16) + '</button>' +
    '</div>';

  var CLASS_ID_SCREENS = ['classDetail', 'manage', 'publish'];

  var App = {
    stack: [],
    currentClassId: 'c_classA',
    transition: 'fade',
    initialized: false,

    /* ---------- 路由 ---------- */
    init: function () {
      if (this.initialized) return;
      this.initialized = true;
      viewport = document.getElementById('viewport');
      navbar = document.getElementById('navbar');
      actionbar = document.getElementById('actionbar');
      Store.init();
      this.stack = Store.state.loggedIn ? [{ name: 'home', params: {} }] : [{ name: 'login', params: {} }];
      this.bind();
      this.render();
      this.buildSidebar();
      document.getElementById('statusTime').textContent = Store.fmt.time(Store.now());
    },
    go: function (name, params, transition) {
      this.stack.push({ name: name, params: params || {} });
      this.transition = transition || 'push';
      this.render();
    },
    replace: function (name, params, transition) {
      this.stack.pop();
      this.stack.push({ name: name, params: params || {} });
      this.transition = transition || 'fade';
      this.render();
    },
    back: function () {
      if (this.stack.length > 1) { this.stack.pop(); this.transition = 'back'; this.render(); }
    },
    resetTo: function (name, params) {
      this.stack = [{ name: name, params: params || {} }];
      this.transition = 'fade';
      this.render();
    },
    top: function () { return this.stack[this.stack.length - 1]; },

    /* ---------- 渲染 ---------- */
    render: function () {
      var cur = this.top();
      var def = Screens[cur.name];
      if (!def) { this.resetTo('home'); return; }
      if (cur.params && cur.params.classId) {
        this.currentClassId = cur.params.classId;
      } else if (cur.params && cur.params.id && CLASS_ID_SCREENS.indexOf(cur.name) >= 0) {
        this.currentClassId = cur.params.id;
      } else if (cur.params && cur.params.id) {
        var a = Store.assignment(cur.params.id);
        if (a) this.currentClassId = a.classId;
      }

      var cfg = def.nav ? def.nav(cur.params) : null;
      if (!cfg) { navbar.innerHTML = ''; navbar.style.display = 'none'; }
      else {
        navbar.style.display = '';
        var left = cfg.back ? '<button class="navbar__btn" data-action="back" aria-label="返回">' + UI.icon('back', 22) + '</button>' : '';
        var right = cfg.right ? '<div class="navbar__side navbar__side--right">' + (cfg.right.html || '') + '</div>' : CAPSULE;
        navbar.innerHTML =
          '<div class="navbar__side">' + left + '</div>' +
          '<div class="navbar__title">' + UI.esc(cfg.title || '') + '</div>' +
          right;
      }

      var body = def.body ? def.body(cur.params) : '';
      body = String(body).replace('screen--fade', 'screen--' + this.transition);
      viewport.innerHTML = body;
      viewport.scrollTop = 0;

      actionbar.innerHTML = def.action ? (def.action(cur.params) || '') : '';
      actionbar.style.display = actionbar.innerHTML ? '' : 'none';

      if (def.mounted) def.mounted(cur.params);
      this.refreshActive();
    },
    /* 局部刷新（保持滚动位置） */
    refresh: function () {
      var cur = this.top();
      var def = Screens[cur.name];
      if (!def) return;
      var body = def.body ? def.body(cur.params) : '';
      var y = viewport.scrollTop;
      viewport.innerHTML = body;
      viewport.scrollTop = y;
      actionbar.innerHTML = def.action ? (def.action(cur.params) || '') : '';
      if (def.mounted) def.mounted(cur.params);
      this.refreshActive();
    },
    refreshActive: function () {
      var def = Screens[this.top().name];
      if (!def) return;
      var cfg = def.nav ? def.nav(this.top().params) : null;
      if (cfg && cfg.right && cfg.right.html && cfg.right.html.indexOf('avatar') >= 0) {
        var b = navbar.querySelector('.navbar__side--right button');
        if (b) b.innerHTML = H.avatar(Store.me().nickname, 'avatar--sm');
      }
    },

    /* ---------- 事件绑定 ---------- */
    bind: function () {
      document.addEventListener('click', function (e) {
        var t = e.target.closest('[data-action]');
        if (!t) return;
        var fn = Actions[t.dataset.action];
        if (fn) { e.stopPropagation(); fn(t.dataset, t, e); }
      });

      document.addEventListener('input', function (e) {
        var t = e.target;
        if (t.id === 'inp_title') {
          var c1 = document.getElementById('cnt_title'); if (c1) c1.textContent = t.value.length + '/20';
          clearErr(t);
        }
        if (t.id === 'inp_content') {
          var c2 = document.getElementById('cnt_content'); if (c2) c2.textContent = t.value.length + '/200';
          clearErr(t);
        }
      });
    },

    /* ---------- 侧边栏 ---------- */
    buildSidebar: function () {
      var FLOW = [
        { t: '微信授权登录', s: '仅昵称与头像，直接进入首页' },
        { t: '我的班级（首页）', s: '班级卡片 · 创建 / 加入（弹窗）' },
        { t: '班级详情', s: '今日作业 / 历史作业' },
        { t: '发布作业', s: '标题、内容、截止时间（默认 24:00）' },
        { t: '作业详情 + 排行榜', s: '一屏看完内容、状态与实时排名' },
        { t: '我已完成', s: '写入服务器时间并回报名次' },
        { t: '修改 / 删除作业', s: '仅发布者可见' },
        { t: '班级管理', s: '邀请码 / 二维码 / 成员 / 转让 / 解散' }
      ];
      document.getElementById('flowList').innerHTML = FLOW.map(function (f) {
        return '<li><b>' + f.t + '</b><span>' + f.s + '</span></li>';
      }).join('');

      var JUMPS = [
        { n: 'home', l: '首页', s: '我的班级' },
        { n: 'classDetail', l: '班级详情', s: '管理员视角', p: { id: 'c_classA' } },
        { n: 'publish', l: '发布作业', s: '表单页', p: { id: 'c_classA' } },
        { n: 'assignmentDetail', l: '作业详情', s: '含排行榜', p: { id: 'a_math' } },
        { n: 'manage', l: '班级管理', s: '邀请与成员', p: { id: 'c_classA' } }
      ];
      document.getElementById('jumpGrid').innerHTML = JUMPS.map(function (j, i) {
        return '<button class="jump-btn" data-jump="' + i + '">' + j.l + '<small>' + j.s + '</small></button>';
      }).join('');
      document.getElementById('jumpGrid').addEventListener('click', function (e) {
        var b = e.target.closest('[data-jump]');
        if (!b) return;
        var j = JUMPS[parseInt(b.dataset.jump, 10)];
        App.resetTo(j.n, j.p || {});
      });
      document.querySelector('.dev-tools').addEventListener('click', function (e) {
        var b = e.target.closest('[data-dev]');
        if (!b) return;
        Dev[b.dataset.dev]();
      });
    }
  };

  /* 回到栈中已存在的目标页；不存在则重建（避免删除后返回键失效） */
  function goBackTo(name, params) {
    var prev = App.stack[App.stack.length - 2];
    if (prev && prev.name === name) {
      App.stack.pop();
      App.top().params = params;
      App.transition = 'back';
      App.render();
    } else {
      App.resetTo(name, params);
    }
  }
  function clearErr(input) {
    var f = input.closest('.field');
    if (f) f.classList.remove('is-error');
  }
  function markErr(fieldId) {
    var f = document.getElementById(fieldId);
    if (f) f.classList.add('is-error');
  }

  /* ==================== 交互动作 ==================== */
  var Actions = {
    'back': function () { App.back(); },
    'capsule-more': function () {
      UI.actionSheet({
        title: '今日作业',
        items: [{ label: '分享给微信好友', icon: 'share' }, { label: '关于本原型', icon: 'info' }]
      }).then(function (i) {
        if (i === 0) UI.toast('已唤起分享（原型演示）');
        if (i === 1) showAbout();
      });
    },
    'capsule-target': function () { UI.toast('原型演示中已忽略'); },

    /* --- 登录 --- */
    'do-login': function () {
      UI.loading('正在授权…');
      setTimeout(function () {
        UI.hideLoading();
        Store.login();
        App.resetTo('home', {});
      }, 520);
    },

    /* --- 首页 · 个人面板 --- */
    'open-profile': function () {
      UI.actionSheet({
        title: Store.me().nickname,
        items: [
          { label: '修改昵称', icon: 'edit' },
          { label: '关于本原型', icon: 'info' },
          { label: '重置演示数据', icon: 'refresh', danger: true }
        ]
      }).then(function (i) {
        if (i === 0) editNickname();
        if (i === 1) showAbout();
        if (i === 2) resetDemo();
      });
    },

    /* --- 创建 / 加入班级（弹窗） --- */
    'create-class': function () {
      UI.formDialog({
        title: '创建班级',
        confirmText: '创建',
        fields: [
          { label: '班级名称', required: true, placeholder: '例如：三年级二班', maxlength: 20 },
          { label: '班级简介（选填）', placeholder: '例如：每日作业同步打卡', maxlength: 40 }
        ]
      }).then(function (v) {
        if (!v) return;
        if (!v[0]) { UI.toast('请填写班级名称'); return; }
        var c = Store.createClass(v[0], v[1]);
        UI.toast('班级创建成功');
        App.resetTo('classDetail', { id: c.id, tab: 'today' });
      });
    },
    'join-class': function () {
      UI.formDialog({
        title: '加入班级',
        confirmText: '加入',
        fields: [{ label: '邀请码', required: true, placeholder: '6 位邀请码', maxlength: 6, uppercase: true }]
      }).then(function (v) {
        if (!v) return;
        if (!v[0] || v[0].length !== 6) { UI.toast('请输入 6 位邀请码'); return; }
        var r = Store.joinClass(v[0]);
        if (!r.ok) { UI.toast(r.msg); return; }
        UI.toast('已加入「' + r.klass.name + '」');
        App.resetTo('classDetail', { id: r.klass.id, tab: 'today' });
      });
    },

    /* --- 班级详情 --- */
    'switch-tab': function (d) {
      App.top().params.tab = d.tab;
      App.transition = 'fade';
      App.render();
    },
    'goto-manage': function (d) { App.go('manage', { id: d.id }); },
    'goto-publish': function (d) { App.go('publish', { id: d.id, deadline: null }); },
    'goto-assignment': function (d) { App.go('assignmentDetail', { id: d.id }); },
    'goto-class': function (d) { App.go('classDetail', { id: d.id, tab: 'today' }); },

    /* --- 发布作业 --- */
    'pick-deadline': function () {
      var editing = !!App.top().params.editId;
      var items = [
        { label: '今天 24:00', icon: 'clock' },
        { label: '明天 24:00', icon: 'clock' },
        { label: '后天 24:00', icon: 'clock' }
      ];
      if (editing) items.unshift({ label: '不设置截止时间', icon: 'trash' });
      UI.actionSheet({ title: '截止时间', items: items }).then(function (i) {
        if (i === null || i === undefined) return;
        App.top().params.deadline = editing && i === 0 ? null : Store.util.endOfDay(editing ? i - 1 : i);
        App.refresh();
      });
    },
    'submit-assignment': function () {
      var title = (document.getElementById('inp_title').value || '').trim();
      var content = (document.getElementById('inp_content').value || '').trim();
      var ok = true;
      if (!title) { markErr('f_title'); ok = false; }
      if (!content) { markErr('f_content'); ok = false; }
      if (!ok) return;

      var params = App.top().params;
      var editId = params.editId;
      var classId = params.id;
      /* 语义：省略 = 保留原值；null = 清除；时间戳 = 设置 */
      var deadline = params.editId
        ? (params.deadline === undefined ? (Store.assignment(params.editId) || {}).deadline : params.deadline)
        : (params.deadline || Store.util.endOfDay(0));

      UI.loading(editId ? '保存中…' : '发布中…');
      setTimeout(function () {
        UI.hideLoading();
        if (editId) {
          Store.updateAssignment(editId, title, content, deadline);
          UI.toast('已保存修改');
          goBackTo('assignmentDetail', { id: editId });
        } else {
          Store.createAssignment(classId, title, content, deadline);
          UI.toast('作业已发布');
          App.replace('classDetail', { id: classId, tab: 'today' });
        }
      }, 640);
    },

    /* ---------- 修改 / 删除作业（仅发布者） ---------- */
    'edit-assignment': function (d) {
      var a = Store.assignment(d.id);
      if (!a || !Store.canManageAssignment(d.id)) { UI.toast('只有发布者可以修改作业'); return; }
      App.go('publish', { id: a.classId, editId: a.id, deadline: a.deadline });
    },
    'delete-assignment': function (d) {
      var a = Store.assignment(d.id);
      if (!a || !Store.canManageAssignment(d.id)) { UI.toast('只有发布者可以删除作业'); return; }
      UI.confirm({
        title: '删除「' + a.title + '」',
        content: '删除后该作业不再出现在列表和统计中，此前的完成记录也会一并移除，且不可恢复。',
        confirmText: '删除', danger: true
      }).then(function (ok) {
        if (!ok) return;
        var classId = a.classId;
        Store.deleteAssignment(d.id);
        UI.toast('作业已删除');
        goBackTo('classDetail', { id: classId, tab: 'today' });
      });
    },

    /* --- 完成作业 --- */
    'do-complete': function (d) {
      UI.loading('正在记录…');
      setTimeout(function () {
        UI.hideLoading();
        var r = Store.complete(d.id);
        if (!r.ok) { UI.toast(r.msg); return; }
        var a = Store.assignment(d.id);
        var late = a.deadline && r.record.completedAt > a.deadline;

        /* 小提示：提醒不要为了刷分乱点完成 */
        var ach = Store.achievementOf(a.classId);
        var meRow = null;
        for (var i = 0; i < ach.rows.length; i++) if (ach.rows[i].userId === Store.me().id) meRow = ach.rows[i];
        var pts = Store.rankPoints(r.rank && r.rank.rank);
        var sub = late
          ? '本次逾期完成，不计积分 · 已完成 ' + (meRow ? meRow.done : 0) + ' 项作业'
          : '本次 +' + pts + ' 分 · 学期成就 ' + (meRow ? meRow.points : 0) + ' 分 · 班级第 ' + (meRow ? meRow.rank : '-') + ' 名';
        UI.hint('你是一个诚实的小朋友', sub);

        App.refresh();
      }, 700);
    },
    'already-done': function () {
      var el = document.getElementById('rankSection');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    'late-complete': function () {
      UI.confirm({
        title: '已过截止时间',
        content: '仍要记录完成吗？将标记为「逾期完成」，不参与正常排名。',
        confirmText: '仍要记录'
      }).then(function (ok) {
        if (!ok) return;
        UI.loading('正在记录…');
        setTimeout(function () {
          UI.hideLoading();
          var r = Store.complete(App.top().params.id);
          UI.toast(r.ok ? '已记录（逾期完成）' : r.msg);
          App.refresh();
        }, 640);
      });
    },
    'assign-more': function () {
      var id = App.top().params.id;
      var canManage = Store.canManageAssignment(id);
      var items = [];
      if (canManage) {
        items.push({ label: '修改作业', icon: 'edit' });
        items.push({ label: '删除作业', icon: 'trash', danger: true });
      }
      items.push({ label: '复制作业链接', icon: 'copy' });
      items.push({ label: '分享给微信好友', icon: 'share' });
      UI.actionSheet({ title: canManage ? '作业管理' : '作业操作', items: items }).then(function (i) {
        if (i === null || i === undefined) return;
        if (canManage && i === 0) { Actions['edit-assignment']({ id: id }); return; }
        if (canManage && i === 1) { Actions['delete-assignment']({ id: id }); return; }
        var idx = canManage ? i - 2 : i;
        if (idx === 0) UI.copy('today-homework://assignment/' + id);
        if (idx === 1) UI.toast('已唤起分享（原型演示）');
      });
    },

    /* --- 班级管理 --- */
    'edit-class': function (d) {
      var c = Store.klass(d.id);
      UI.formDialog({
        title: '修改班级信息',
        confirmText: '保存',
        fields: [
          { label: '班级名称', required: true, value: c.name, maxlength: 20 },
          { label: '班级简介（选填）', value: c.description, maxlength: 40 }
        ]
      }).then(function (v) {
        if (!v) return;
        if (!v[0]) { UI.toast('班级名称不能为空'); return; }
        Store.renameClass(d.id, v[0], v[1]);
        UI.toast('已保存');
        App.refresh();
      });
    },
    'regen-code': function (d) {
      UI.confirm({
        title: '重新生成邀请码',
        content: '生成后旧邀请码立即失效，已加入的成员不受影响。',
        confirmText: '重新生成'
      }).then(function (ok) {
        if (!ok) return;
        var code = Store.regenerateCode(d.id);
        UI.toast('新邀请码：' + code);
        App.refresh();
      });
    },
    'remove-member': function (d) {
      UI.confirm({
        title: '移除「' + d.name + '」',
        content: '该成员将退出班级。历史作业中的完成记录会保留。',
        confirmText: '移除', danger: true
      }).then(function (ok) {
        if (!ok) return;
        Store.removeMember(d.id, d.uid);
        UI.toast('已移除 ' + d.name);
        App.refresh();
      });
    },
    'transfer-owner': function (d) {
      var c = Store.klass(d.id);
      var members = Store.membersOf(d.id).filter(function (m) { return m.id !== c.ownerId; });
      var items = members.map(function (m) { return { label: m.nickname, icon: 'users' }; });
      UI.actionSheet({ title: '选择新的管理员', items: items }).then(function (i) {
        if (i === null || i === undefined) return;
        var target = members[i];
        UI.confirm({
          title: '转让给「' + target.nickname + '」？',
          content: '转让后你将变成普通成员，不能再发布作业。',
          confirmText: '确认转让'
        }).then(function (ok) {
          if (!ok) return;
          Store.transferOwner(d.id, target.id);
          UI.toast('已转让给 ' + target.nickname);
          App.refresh();
        });
      });
    },
    'dissolve': function (d) {
      UI.confirm({
        title: '解散班级',
        content: '解散后班级、作业与完成记录全部移除，且不可恢复。',
        confirmText: '解散班级', danger: true
      }).then(function (ok) {
        if (!ok) return;
        Store.dissolveClass(d.id);
        UI.toast('班级已解散');
        App.resetTo('home', {});
      });
    },
    'leave': function (d) {
      UI.confirm({
        title: '退出班级',
        content: '退出后将看不到该班级的作业与排名，历史完成记录仍会保留。',
        confirmText: '退出', danger: true
      }).then(function (ok) {
        if (!ok) return;
        Store.leaveClass(d.id);
        UI.toast('已退出班级');
        App.resetTo('home', {});
      });
    },
    'copy-code': function (d) { UI.copy(d.code); },
    'share-to-friend': function () { UI.toast('已唤起分享面板（原型演示）'); }
  };

  /* ---------- 公共弹窗 ---------- */
  function editNickname() {
    UI.formDialog({
      title: '修改昵称',
      confirmText: '保存',
      fields: [{ label: '昵称', required: true, value: Store.me().nickname, maxlength: 12 }]
    }).then(function (v) {
      if (!v) return;
      if (!v[0]) { UI.toast('昵称不能为空'); return; }
      Store.login(v[0]);
      UI.toast('已修改');
      App.refresh();
    });
  }
  function showAbout() {
    UI.confirm({
      title: '今日作业 v1.0 MVP',
      content: '极简班级作业发布与完成排名工具。\n\n排名规则：\n1. 以服务器记录的完成时间为准\n2. 只对已完成的成员排名\n3. 同一成员每项作业只产生一条记录\n4. 截止后完成的标记为「逾期完成」\n\n当前为静态交互原型，数据保存在浏览器本地。',
      confirmText: '知道了', cancelText: null
    });
  }
  function resetDemo() {
    UI.confirm({
      title: '重置演示数据', content: '所有班级、作业与完成记录将恢复到初始状态。',
      confirmText: '重置', danger: true
    }).then(function (ok) {
      if (!ok) return;
      Store.reset();
      UI.toast('已重置');
      App.resetTo('home', {});
    });
  }

  /* ==================== 演示工具 ==================== */
  var Dev = {
    'simulate-complete': function () {
      var classId = App.currentClassId;
      var list = Store.todayAssignments(classId);
      if (!list.length) list = Store.assignmentsOf(classId);
      if (!list.length) { UI.toast('当前班级没有作业'); return; }
      var a = list[0];
      var r = Store.simulateComplete(a.id);
      if (!r) { UI.toast('全班都已完成这项作业'); return; }
      UI.toast('📢 ' + r.name + ' 刚刚完成了《' + a.title + '》');
      App.refresh();
    },
    'reset': function () { resetDemo(); }
  };

  global.App = App;
  global.Actions = Actions;
  global.Dev = Dev;

  document.addEventListener('DOMContentLoaded', function () { App.init(); });
  if (document.readyState !== 'loading') App.init();
})(window);
