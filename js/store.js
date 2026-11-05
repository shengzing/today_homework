/* ==========================================================================
   今日作业 · 数据层（静态原型）
   模拟：小程序本地缓存 + 服务端计时 + 唯一约束 + 权限校验
   ========================================================================== */
(function (global) {
  'use strict';

  var KEY = 'today_homework_prototype_v7';

  /* ---------------- 工具 ---------------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function atDay(offset, h, m) {
    var d = new Date();
    d.setDate(d.getDate() + offset);
    d.setHours(h, m || 0, 0, 0);
    return d.getTime();
  }
  function endOfDay(offset) {
    var d = new Date();
    d.setDate(d.getDate() + offset);
    d.setHours(23, 59, 59, 0);
    return d.getTime();
  }
  function dayKey(ts) {
    var d = new Date(ts);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function uid(prefix) {
    return prefix + '_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
  }
  var AVATAR_COLORS = ['#5B8DEF', '#E08A3C', '#2E9E5B', '#E05555', '#8E55D0',
                       '#2D9CDB', '#C8921B', '#2FA8C4', '#A855C7', '#3FAE6A', '#D26070', '#5E6AD2'];
  function colorOf(name) {
    var h = 0;
    for (var i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    return AVATAR_COLORS[h % AVATAR_COLORS.length];
  }
  function pickCode() {
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var s = '';
    for (var i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }

  /* ---------------- 时间格式 ---------------- */
  function fmtTime(ts) { var d = new Date(ts); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function fmtDate(ts) { var d = new Date(ts); return (d.getMonth() + 1) + '月' + d.getDate() + '日'; }
  function fmtDateTime(ts) { return fmtDate(ts) + ' ' + fmtTime(ts); }
  var WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  function fmtDayLabel(ts) {
    var d = new Date(ts), t = new Date(); t.setHours(0, 0, 0, 0);
    var diff = Math.round((new Date(d).setHours(0, 0, 0, 0) - t.getTime()) / 86400000);
    var rel = diff === 0 ? '今天'
      : diff === -1 ? '昨天'
      : diff === 1 ? '明天'
      : diff === 2 ? '后天'
      : diff === -2 ? '前天'
      : fmtDate(ts);
    return { rel: rel, date: fmtDate(ts), week: WEEK[d.getDay()] };
  }

  /* ---------------- 种子数据 ---------------- */
  var NAMES_A = ['王一鸣', '李欣怡', '张浩然', '刘思远', '陈梓涵', '杨梦琪', '黄俊杰', '赵嘉豪',
    '周诗涵', '吴天佑', '徐佳怡', '孙宇轩', '朱若曦', '胡晨曦', '郭浩宇', '何雅静',
    '高铭轩', '林子豪', '罗静怡', '梁沐辰', '宋语彤', '郑泽楷', '谢一诺', '唐语嫣',
    '韩逸凡', '曹可欣', '许皓轩', '邓芷晴', '冯乐瑶', '曾书豪', '彭嘉怡'];
  var NAMES_B = ['王老师', '李欣怡', '陈子墨', '张语彤', '刘沐阳', '周欣然', '吴俊豪',
    '赵一鸣', '孙雨萌', '钱思睿', '郑好'];

  function seed() {
    var rnd = mulberry32(20261105);

    var me = { id: 'u_me', nickname: '林小满', isMe: true, joinedAt: atDay(-120, 9, 0) };

    /* 班级 A：三年级二班（我为管理员） */
    var membersA = [me];
    for (var i = 0; i < NAMES_A.length; i++) {
      membersA.push({ id: 'u_a' + i, nickname: NAMES_A[i], joinedAt: atDay(-90 + Math.floor(rnd() * 80), 10, 0) });
    }
    /* 班级 B：英语打卡小组（王老师是管理员，我是普通成员） */
    var membersB = [{ id: 'u_t', nickname: '王老师', role: 'owner', joinedAt: atDay(-30, 9, 0) }];
    for (var j = 1; j < NAMES_B.length; j++) {
      membersB.push({ id: 'u_b' + (j - 1), nickname: NAMES_B[j], joinedAt: atDay(-25 + Math.floor(rnd() * 20), 10, 0) });
    }
    membersB.push({ id: 'u_me', nickname: me.nickname, joinedAt: atDay(-14, 12, 0) });

    var classes = [
      {
        id: 'c_classA', name: '三年级二班', description: '数学语文英语，每日作业同步打卡',
        ownerId: 'u_me', inviteCode: '7K3M9Q', memberIds: membersA.map(function (m) { return m.id; }),
        createdAt: atDay(-120, 9, 0), badgeColor: '#5B8DEF'
      },
      {
        id: 'c_classB', name: '英语打卡小组', description: '每天 15 分钟，跟读打卡不间断',
        ownerId: 'u_t', inviteCode: 'M4P2XR', memberIds: membersB.map(function (m) { return m.id; }),
        createdAt: atDay(-30, 9, 0), badgeColor: '#F2994A'
      }
    ];

    /* 作业 */
    var assignments = [
      { id: 'a_math', classId: 'c_classA', title: '11月5日数学作业',
        content: '完成数学课本第 35 页、第 36 页。\n订正上次单元测验错题，准备好草稿纸。',
        creatorId: 'u_me', deadline: endOfDay(0), createdAt: atDay(0, 18, 0), status: 'published' },
      { id: 'a_chinese', classId: 'c_classA', title: '11月5日语文作业',
        content: '背诵《望天门山》，背诵后默写一遍自查。\n抄写生字词，每个三遍。',
        creatorId: 'u_me', deadline: endOfDay(0), createdAt: atDay(0, 18, 10), status: 'published' },
      { id: 'a_english', classId: 'c_classA', title: '11月5日英语朗读打卡',
        content: '跟读 Unit 5 单词表，录音时长不少于 3 分钟。',
        creatorId: 'u_me', deadline: null, createdAt: atDay(0, 18, 15), status: 'published' },

      { id: 'a_math_4', classId: 'c_classA', title: '11月4日数学作业',
        content: '完成数学课本第 33 页、第 34 页，并预习第 37 页。',
        creatorId: 'u_me', deadline: endOfDay(-1), createdAt: atDay(-1, 18, 0), status: 'published' },
      { id: 'a_chinese_4', classId: 'c_classA', title: '11月4日语文作业',
        content: '背诵《饮湖上初晴后雨》，默写古诗一首。',
        creatorId: 'u_me', deadline: endOfDay(-1), createdAt: atDay(-1, 18, 10), status: 'published' },
      { id: 'a_english_3', classId: 'c_classA', title: '11月3日英语朗读打卡',
        content: '跟读 Unit 4 单词表 + 课文第一段。',
        creatorId: 'u_me', deadline: null, createdAt: atDay(-2, 18, 15), status: 'published' },

      { id: 'a_b12', classId: 'c_classB', title: 'Day 12 · 跟读 Unit 5 单词表',
        content: '跟读 20 个单词并造 3 个句子。',
        creatorId: 'u_t', deadline: null, createdAt: atDay(0, 8, 0), status: 'published' },
      { id: 'a_b11', classId: 'c_classB', title: 'Day 11 · 听力精听 Section A',
        content: '精听 Section A 两遍，写出听到的 5 个句子。',
        creatorId: 'u_t', deadline: null, createdAt: atDay(-2, 20, 0), status: 'published' }
    ];

    /* 完成记录（显式时间，保证排行榜数字可复现） */
    var C = [];
    function push(id, uidStr, h, m, d) {
      C.push({ id: 'c_' + C.length, assignmentId: id, userId: uidStr, completedAt: atDay(d === undefined ? 0 : d, h, m) });
    }
    /* 数学作业（今日）：25 人完成，其中 3 人逾期 */
    var mathTimes = [[18, 5], [18, 9], [18, 14], [18, 18], [18, 23], [18, 27], [18, 31], [18, 35],
      [18, 39], [18, 42], [18, 46], [18, 50], [18, 55], [19, 2], [19, 8], [19, 14], [19, 20],
      [19, 26], [19, 33], [19, 41], [19, 48], [19, 56], [20, 11], [20, 24], [20, 37]];
    for (var t = 0; t < mathTimes.length; t++) push('a_math', 'u_a' + t, mathTimes[t][0], mathTimes[t][1]);
    /* 语文作业（今日）：20 人完成，我在 19:02 完成 → 第 13 名 */
    var cnTimes = [[18, 12], [18, 15], [18, 19], [18, 24], [18, 30], [18, 33], [18, 41], [18, 46],
      [18, 52], [18, 58], [19, 0], [19, 1], [19, 5], [19, 10], [19, 14], [19, 22], [19, 30], [19, 41], [19, 55], [20, 20]];
    for (var t2 = 0; t2 < cnTimes.length - 1; t2++) push('a_chinese', 'u_a' + t2, cnTimes[t2][0], cnTimes[t2][1]);
    push('a_chinese', 'u_me', 19, 2);
    /* 英语朗读（今日）：18 人完成 */
    var enTimes = [[18, 22], [18, 29], [18, 37], [18, 44], [18, 52], [19, 3], [19, 11], [19, 19],
      [19, 27], [19, 35], [19, 44], [19, 53], [20, 2], [20, 12], [20, 22], [20, 33], [20, 45], [20, 58]];
    for (var t3 = 0; t3 < enTimes.length; t3++) push('a_english', 'u_a' + t3, enTimes[t3][0], enTimes[t3][1]);
    /* 昨日 / 前日 */
    for (var t4 = 0; t4 < 29; t4++) push('a_math_4', 'u_a' + t4, 18 + (t4 % 4), (t4 * 7) % 60, -1);
    push('a_math_4', 'u_me', 18, 3, -1);
    for (var t5 = 0; t5 < 27; t5++) push('a_chinese_4', 'u_a' + t5, 18 + (t5 % 3), (t5 * 11) % 60, -1);
    push('a_chinese_4', 'u_me', 18, 5, -1);
    push('a_chinese_4', 'u_a28', 0, 12, 0);      /* 逾期：昨天已截止，今天凌晨补做 */
    push('a_chinese_4', 'u_a29', 0, 35, 0);      /* 逾期 */
    for (var t6 = 0; t6 < 28; t6++) push('a_english_3', 'u_a' + t6, 19 + (t6 % 3), (t6 * 5) % 60, -2);
    push('a_english_3', 'u_me', 18, 4, -2);
    /* 班级 B */
    var bTimes = [[8, 12], [9, 30], [12, 45], [15, 20], [17, 5], [17, 50]];
    for (var t7 = 0; t7 < bTimes.length; t7++) push('a_b12', 'u_b' + t7, bTimes[t7][0], bTimes[t7][1]);
    push('a_b12', 'u_me', 18, 40);
    for (var t8 = 0; t8 < 10; t8++) push('a_b11', 'u_b' + t8, 19 + (t8 % 4), (t8 * 13) % 60, -1);
    push('a_b11', 'u_me', 20, 22, -1);

    var state = {
      seedDate: dayKey(Date.now()),
      loggedIn: false,
      me: me,
      users: { 'u_me': me },
      classes: classes,
      assignments: assignments,
      completions: C,
      members: { c_classA: membersA, c_classB: membersB }
    };
    return state;
  }

  /* ---------------- 持久化 ---------------- */
  function readStore() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return null;
      var s = JSON.parse(raw);
      if (!s || s.seedDate !== dayKey(Date.now())) return null;   // 跨天自动重置
      return s;
    } catch (e) { return null; }
  }
  function writeStore(s) {
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* 忽略 */ }
  }

  /* ---------------- Store ---------------- */
  var Store = {
    state: null,

    init: function () {
      this.state = readStore() || seed();
      writeStore(this.state);
      return this.state;
    },
    reset: function () {
      this.state = seed();
      writeStore(this.state);
    },
    save: function () { writeStore(this.state); },

    /* 服务端时间（演示固定，便于复现排名） */
    now: function () { return atDay(0, 19, 10); },

    /* --- 用户 --- */
    me: function () { return this.state.me; },
    user: function (uid) {
      if (uid === 'u_me') return this.state.me;
      var cls = this.state.classes;
      for (var i = 0; i < cls.length; i++) {
        var list = this.state.members[cls[i].id] || [];
        for (var j = 0; j < list.length; j++) if (list[j].id === uid) return list[j];
      }
      return null;
    },
    nickname: function (uid) { var u = this.user(uid); return u ? u.nickname : '已退出成员'; },
    avatarColor: function (name) { return colorOf(name); },

    /* --- 班级 --- */
    myClasses: function () {
      var me = this.state.me.id, list = [];
      for (var i = 0; i < this.state.classes.length; i++) {
        var c = this.state.classes[i];
        if ((c.memberIds || []).indexOf(me) >= 0) list.push(c);
      }
      return list;
    },
    klass: function (id) {
      for (var i = 0; i < this.state.classes.length; i++) if (this.state.classes[i].id === id) return this.state.classes[i];
      return null;
    },
    membersOf: function (classId) { return this.state.members[classId] || []; },
    isOwner: function (classId) {
      var c = this.klass(classId); return !!c && c.ownerId === this.state.me.id;
    },
    isMember: function (classId) {
      var c = this.klass(classId); return !!c && (c.memberIds || []).indexOf(this.state.me.id) >= 0;
    },
    createClass: function (name, desc) {
      var id = uid('c');
      var c = {
        id: id, name: name, description: desc || '', ownerId: this.state.me.id,
        inviteCode: pickCode(), memberIds: [this.state.me.id], createdAt: this.now(), badgeColor: '#' + Math.floor(Math.random() * 0xFFFFFF).toString(16).padStart(6, '0')
      };
      this.state.classes.push(c);
      this.state.members[id] = [{ id: this.state.me.id, nickname: this.state.me.nickname, joinedAt: this.now() }];
      this.save();
      return c;
    },
    joinClass: function (code) {
      code = (code || '').trim().toUpperCase();
      for (var i = 0; i < this.state.classes.length; i++) {
        var c = this.state.classes[i];
        if (c.inviteCode === code) {
          if ((c.memberIds || []).indexOf(this.state.me.id) >= 0) return { ok: false, msg: '你已经是该班级成员' };
          c.memberIds.push(this.state.me.id);
          this.state.members[c.id].push({ id: this.state.me.id, nickname: this.state.me.nickname, joinedAt: this.now() });
          this.save();
          return { ok: true, klass: c };
        }
      }
      return { ok: false, msg: '邀请码不存在或已失效' };
    },
    renameClass: function (classId, name, desc) {
      var c = this.klass(classId); if (!c) return;
      if (name) c.name = name;
      if (desc !== undefined) c.description = desc;
      this.save();
    },
    regenerateCode: function (classId) {
      var c = this.klass(classId); if (!c) return;
      c.inviteCode = pickCode(); this.save(); return c.inviteCode;
    },
    removeMember: function (classId, uid) {
      var c = this.klass(classId); if (!c) return;
      c.memberIds = c.memberIds.filter(function (x) { return x !== uid; });
      this.state.members[classId] = this.state.members[classId].filter(function (m) { return m.id !== uid; });
      this.save();   // 注意：历史完成记录保留，不删除
    },
    transferOwner: function (classId, uid) {
      var c = this.klass(classId); if (!c) return;
      c.ownerId = uid; this.save();
    },
    dissolveClass: function (classId) {
      this.state.classes = this.state.classes.filter(function (c) { return c.id !== classId; });
      delete this.state.members[classId];
      this.state.assignments = this.state.assignments.filter(function (a) { return a.classId !== classId; });
      this.save();
    },
    leaveClass: function (classId) {
      this.removeMember(classId, this.state.me.id);
    },
    addDemoMember: function (classId) {
      var pool = ['李慕云', '周静姝', '吴亦帆', '郑楚楚', '孙可欣'];
      var list = this.state.members[classId] || [];
      var name = pool[list.length % pool.length];
      var id = uid('u');
      list.push({ id: id, nickname: name, joinedAt: this.now() });
      this.state.members[classId] = list;
      var c = this.klass(classId);
      if (c) c.memberIds.push(id);
      this.save();
      return name;
    },

    /* --- 作业 --- */
    assignmentsOf: function (classId) {
      return this.state.assignments
        .filter(function (a) { return a.classId === classId && a.status === 'published'; })
        .sort(function (a, b) { return b.createdAt - a.createdAt; });
    },
    todayAssignments: function (classId) {
      var today = dayKey(this.now());
      return this.assignmentsOf(classId).filter(function (a) { return dayKey(a.createdAt) === today; });
    },
    historyAssignments: function (classId) {
      var today = dayKey(this.now());
      return this.assignmentsOf(classId).filter(function (a) { return dayKey(a.createdAt) !== today; });
    },
    assignment: function (id) {
      for (var i = 0; i < this.state.assignments.length; i++) if (this.state.assignments[i].id === id) return this.state.assignments[i];
      return null;
    },
    createAssignment: function (classId, title, content, deadline) {
      var a = {
        id: uid('a'), classId: classId, title: title, content: content,
        creatorId: this.state.me.id, deadline: deadline || null,
        createdAt: this.now(), status: 'published'
      };
      this.state.assignments.push(a);
      this.save();
      return a;
    },
    /* 修改作业：只改内容，不影响已产生的完成记录 */
    updateAssignment: function (id, title, content, deadline) {
      var a = this.assignment(id);
      if (!a) return null;
      if (title) a.title = title;
      if (content !== undefined && content !== null) a.content = content;
      a.deadline = deadline || null;
      a.updatedAt = this.now();
      this.save();
      return a;
    },
    /* 是否为该作业的发布者（MVP 中即班级管理员） */
    canManageAssignment: function (id) {
      var a = this.assignment(id);
      return !!a && a.creatorId === this.state.me.id;
    },
    deleteAssignment: function (id) {
      this.state.assignments = this.state.assignments.filter(function (a) { return a.id !== id; });
      this.state.completions = this.state.completions.filter(function (c) { return c.assignmentId !== id; });
      this.save();
    },

    /* --- 完成记录 --- */
    completionsOf: function (assignmentId) {
      return this.state.completions.filter(function (c) { return c.assignmentId === assignmentId; });
    },
    completionOf: function (assignmentId, userId) {
      for (var i = 0; i < this.state.completions.length; i++) {
        var c = this.state.completions[i];
        if (c.assignmentId === assignmentId && c.userId === userId) return c;
      }
      return null;
    },
    /* 排行榜：按服务器完成时间升序；逾期单独归组 */
    rankingOf: function (assignmentId) {
      var a = this.assignment(assignmentId);
      var rows = this.completionsOf(assignmentId).map(function (c) {
        return {
          userId: c.userId,
          name: this.nickname(c.userId),
          completedAt: c.completedAt,
          overdue: !!(a.deadline && c.completedAt > a.deadline)
        };
      }, this);
      rows.sort(function (x, y) { return x.completedAt - y.completedAt; });
      var normal = rows.filter(function (r) { return !r.overdue; });
      var overdue = rows.filter(function (r) { return r.overdue; });
      normal.forEach(function (r, i) { r.rank = i + 1; });
      overdue.forEach(function (r) { r.rank = null; });
      return { normal: normal, overdue: overdue, all: normal.concat(overdue), total: rows.length };
    },
    myRank: function (assignmentId) {
      var r = this.rankingOf(assignmentId);
      for (var i = 0; i < r.normal.length; i++) if (r.normal[i].userId === this.state.me.id) return r.normal[i];
      for (var j = 0; j < r.overdue.length; j++) if (r.overdue[j].userId === this.state.me.id) return r.overdue[j];
      return null;
    },
    isCompleted: function (assignmentId) { return !!this.completionOf(assignmentId, this.state.me.id); },
    /* 完成作业：唯一约束 + 服务端时间 + 不可撤销 */
    complete: function (assignmentId) {
      if (!this.isMember(this.assignment(assignmentId).classId)) return { ok: false, msg: '你不在该班级中' };
      if (this.isCompleted(assignmentId)) return { ok: false, msg: '你已完成过这项作业' };
      var rec = { id: uid('c'), assignmentId: assignmentId, userId: this.state.me.id, completedAt: this.now() };
      this.state.completions.push(rec);
      this.save();
      var rank = this.myRank(assignmentId);
      return { ok: true, record: rec, rank: rank };
    },
    /* 演示：模拟他人完成 */
    simulateComplete: function (assignmentId) {
      var a = this.assignment(assignmentId);
      var list = this.membersOf(a.classId);
      var done = {};
      this.completionsOf(assignmentId).forEach(function (c) { done[c.userId] = 1; });
      var candidates = list.filter(function (m) { return !done[m.id]; });
      if (!candidates.length) return null;
      var pick = candidates[Math.floor(Math.random() * candidates.length)];
      var rec = { id: uid('c'), assignmentId: assignmentId, userId: pick.id, completedAt: this.now() };
      this.state.completions.push(rec);
      this.save();
      return { name: pick.nickname, rank: this.rankingOf(assignmentId).normal.length };
    },

    /* --- 学期成就排行 ---
       计分规则：每个作业按完成名次给分 —— 第 1 名 3 分，第 2 名 2 分，
       其余完成者各 1 分；逾期完成不计入排名，记 0 分（完成数仍统计）。 */
    rankPoints: function (rank) {
      if (!rank) return 0;
      return rank === 1 ? 3 : (rank === 2 ? 2 : 1);
    },
    achievementOf: function (classId) {
      var self = this;
      var list = this.assignmentsOf(classId);
      var board = {};
      this.membersOf(classId).forEach(function (m) {
        board[m.id] = { userId: m.id, name: m.nickname, points: 0, done: 0, overdue: 0, total: list.length };
      });
      list.forEach(function (a) {
        var rk = self.rankingOf(a.id);
        rk.normal.forEach(function (r) {
          var row = board[r.userId];
          if (!row) return;
          row.points += self.rankPoints(r.rank);
          row.done += 1;
        });
        rk.overdue.forEach(function (r) {
          var row = board[r.userId];
          if (!row) return;
          row.done += 1;
          row.overdue += 1;
        });
      });
      var rows = Object.keys(board).map(function (k) { return board[k]; });
      rows.sort(function (x, y) {
        if (y.points !== x.points) return y.points - x.points;
        if (y.done !== x.done) return y.done - x.done;
        return x.userId < y.userId ? -1 : 1;
      });
      rows.forEach(function (r, i) { r.rank = i + 1; });
      return { classId: classId, rows: rows, assignments: list.length };
    },

    /* --- 统计 --- */
    classStats: function (classId) {
      var total = this.membersOf(classId).length;
      var list = this.assignmentsOf(classId);
      var today = this.todayAssignments(classId);
      var doneToday = 0;
      today.forEach(function (a) { doneToday += this.completionsOf(a.id).length; }, this);
      var rate = today.length ? Math.round(doneToday / (total * today.length) * 100) : 0;
      return { total: total, assignmentCount: list.length, todayCount: today.length, todayDone: doneToday, rate: rate };
    },
    myStats: function () {
      var mine = this.state.completions.filter(function (c) { return c.userId === this.state.me.id; }, this);
      var weekStart = (function () {
        var d = new Date(); var day = d.getDay() || 7; d.setDate(d.getDate() - day + 1);
        d.setHours(0, 0, 0, 0); return d.getTime();
      })();
      var weekAssign = this.state.assignments.filter(function (a) { return a.createdAt >= weekStart; });
      var weekMine = mine.filter(function (c) { return c.completedAt >= weekStart; });
      return {
        total: mine.length,
        week: weekMine.length,
        weekTotal: weekAssign.length,
        classCount: this.myClasses().length
      };
    },

    /* --- 登录 --- */
    login: function (nickname) {
      this.state.loggedIn = true;
      if (nickname) this.state.me.nickname = nickname;
      this.save();
    }
  };

  /* 截止时间文案：当天 24:00 显示为「24:00」 */
  function deadlineText(deadline, now) {
    if (!deadline) return null;
    var d = new Date(deadline);
    var isEOD = d.getHours() === 23 && d.getMinutes() === 59;
    var l = fmtDayLabel(deadline);
    var time = isEOD ? '24:00' : fmtTime(deadline);
    var RELATIVE = ['今天', '昨天', '明天', '后天', '前天'];
    var label = RELATIVE.indexOf(l.rel) >= 0 ? l.rel : fmtDate(deadline);
    var over = now > deadline;
    return { text: (over ? '已于 ' : '') + label + ' ' + time + ' 截止', over: over };
  }

  /* 导出格式化工具 */
  Store.fmt = {
    time: fmtTime, date: fmtDate, dateTime: fmtDateTime, dayLabel: fmtDayLabel, week: WEEK, pad: pad, dayKey: dayKey,
    deadlineText: deadlineText
  };
  Store.util = { uid: uid, pickCode: pickCode, colorOf: colorOf, atDay: atDay, dayKey: dayKey, endOfDay: endOfDay };
  global.Store = Store;
})(window);
