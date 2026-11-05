/* ==========================================================================
   今日作业 · 页面渲染层
   7 个页面：登录 / 首页 / 班级详情 / 发布作业 / 作业详情 / 排行榜 / 班级管理
   （创建班级、加入班级、改名 降级为弹窗；邀请成员 合并进班级管理）
   ========================================================================== */
(function (global) {
  'use strict';

  var F = Store.fmt;

  /* ---------------- 渲染辅助 ---------------- */
  function avatarText(name) { name = (name || '').trim() || '我'; return name.length > 2 ? name.slice(-2) : name; }
  function avatar(name, cls) {
    return '<span class="avatar ' + (cls || '') + '" style="--c:' + Store.avatarColor(name) + '">' + UI.esc(avatarText(name)) + '</span>';
  }
  function ic(name, size, cls) {
    return '<span class="' + (cls || 'inline-ic') + '">' + UI.icon(name, size || 14) + '</span>';
  }
  function pct(done, total) { return total ? Math.round(done / total * 100) : 0; }
  function esc(s) { return UI.esc(s); }
  function dlText(deadline) { return F.deadlineText(deadline, Store.now()); }

  /* 作业状态：列表里只由底部状态 chip 表达，避免同一状态出现两次 */
  function statusOf(a) {
    var done = Store.isCompleted(a.id);
    var over = a.deadline && Store.now() > a.deadline;
    if (done) return { key: 'done', btn: '已完成 ✓', btnCls: 'assign__state--done' };
    if (over) return { key: 'over', btn: '已截止', btnCls: 'assign__state--over' };
    return { key: 'todo', btn: '去完成', btnCls: 'assign__state--todo' };
  }

  /* 作业卡片 */
  function assignCard(a) {
    var total = Store.membersOf(a.classId).length;
    var done = Store.completionsOf(a.id).length;
    var p = pct(done, total);
    var st = statusOf(a);
    var dl = dlText(a.deadline);
    return '' +
      '<div class="assign" data-action="goto-assignment" data-id="' + a.id + '">' +
        '<div class="assign__main">' +
          '<div class="assign__title' + (st.key === 'done' ? ' is-done' : '') + '">' + esc(a.title) + '</div>' +
          '<div class="assign__content">' + esc(a.content) + '</div>' +
          '<div class="assign__meta">' +
            '<span>' + F.time(a.createdAt) + '</span>' +
            (dl ? '<i>·</i><span class="assign__deadline' + (dl.over ? ' is-over' : '') + '">' + ic('clock', 11) + ' ' + esc(dl.text) + '</span>' : '') +
          '</div>' +
        '</div>' +
        '<div class="assign__foot">' +
          '<div class="assign__progress">' +
            '<div class="assign__count">已完成 <b>' + done + '</b>/' + total + ' 人</div>' +
            '<div class="progress" style="margin-top:6px"><div class="progress__bar" style="width:' + p + '%"></div></div>' +
          '</div>' +
          '<div class="assign__state ' + st.btnCls + '">' + st.btn + '</div>' +
        '</div>' +
      '</div>';
  }

  /* 排行榜单行 */
  function rankRow(r, isMe) {
    var medal = r.rank === null ? '—' : (r.rank === 1 ? '🥇' : (r.rank === 2 ? '🥈' : (r.rank === 3 ? '🥉' : r.rank)));
    return '' +
      '<div class="rank-row' + (isMe ? ' is-me' : '') + '">' +
        '<span class="rank-badge' + (r.rank <= 3 ? ' rank-badge--' + r.rank : '') + '">' + medal + '</span>' +
        avatar(r.name, 'avatar--sm') +
        '<div class="rank-row__main">' +
          '<div class="rank-row__name">' + esc(r.name) + (isMe ? '<span class="rank-row__me">我</span>' : '') +
            (r.overdue ? '<span class="tag tag--warn">逾期</span>' : '') + '</div>' +
        '</div>' +
        '<div class="rank-row__time">' + F.time(r.completedAt) + '</div>' +
      '</div>';
  }

  /* ==================== 页面 ==================== */
  var Screens = {};

  /* ---------- 1. 微信授权登录 ---------- */
  Screens.login = {
    nav: function () { return { title: '今日作业' }; },
    body: function () {
      return '' +
        '<div class="screen screen--fade">' +
          '<div class="auth">' +
            '<div class="auth__logo">今</div>' +
            '<h1 class="auth__title">今日作业</h1>' +
            '<p class="auth__desc">极简的班级作业工具<br>发布 · 一键完成 · 实时排名</p>' +
            '<button class="auth__wechat" data-action="do-login">' + ic('users', 18) + ' 微信授权登录</button>' +
            '<p class="auth__tips">仅使用你的微信昵称与头像，不收集手机号、真实姓名<br>登录后可在首页头像处随时修改昵称</p>' +
          '</div>' +
        '</div>';
    }
  };

  /* ---------- 2. 首页：我的班级 ---------- */
  Screens.home = {
    nav: function () {
      return { title: '今日作业', right: { html: '<button class="navbar__btn" data-action="open-profile">' + avatar(Store.me().nickname, 'avatar--sm') + '</button>' } };
    },
    body: function () {
      var list = Store.myClasses();
      var me = Store.me();
      var hour = new Date(Store.now()).getHours();
      var greet = hour < 6 ? '凌晨好' : (hour < 11 ? '早上好' : (hour < 14 ? '中午好' : (hour < 18 ? '下午好' : '晚上好')));

      var cards = list.map(function (c) {
        var st = Store.classStats(c.id);
        var owner = Store.isOwner(c.id);
        return '' +
          '<button class="class-card" data-action="goto-class" data-id="' + c.id + '">' +
            '<div class="class-card__top">' +
              '<div class="class-card__badge" style="--c:' + c.badgeColor + '">' + esc(c.name.slice(0, 2)) + '</div>' +
              '<div style="flex:1;min-width:0">' +
                '<div class="class-card__name">' + esc(c.name) +
                  (owner ? '<span class="tag tag--admin">管理员</span>' : '<span class="tag tag--gray">成员</span>') +
                '</div>' +
                '<div class="class-card__desc">' + esc(c.description || '暂无班级简介') + '</div>' +
              '</div>' +
              '<span class="chevron">' + UI.icon('right', 16) + '</span>' +
            '</div>' +
            '<div class="class-card__meta">' +
              '<span>' + ic('users', 13) + ' <b>' + st.total + '</b> 人</span>' +
              '<span>' + ic('doc', 13) + ' 今日 <b>' + st.todayCount + '</b> 条作业</span>' +
            '</div>' +
            '<div class="class-card__foot">' +
              '<div class="class-card__stat">今日完成率 <b>' + st.rate + '%</b></div>' +
              '<div class="progress class-card__bar"><div class="progress__bar" style="width:' + st.rate + '%"></div></div>' +
            '</div>' +
          '</button>';
      }).join('');

      return '' +
        '<div class="screen screen--fade">' +
          '<div class="home-head">' +
            '<div class="home-head__row">' +
              '<div>' +
                '<div class="home-head__hi">' + greet + ' 👋</div>' +
                '<div class="home-head__name">' + esc(me.nickname) + '</div>' +
              '</div>' +
              '<button class="home-head__avatar" data-action="open-profile">' + avatar(me.nickname) + '</button>' +
            '</div>' +
          '</div>' +
          '<div class="sec-title sec-title--plain">我的班级<span style="color:var(--ink-300)">' + list.length + '</span></div>' +
          (list.length ? cards :
            '<div class="empty">' +
              '<div class="empty__icon">' + UI.icon('empty', 28) + '</div>' +
              '<div class="empty__title">还没有班级</div>' +
              '<div class="empty__text">创建一个班级，或用邀请码加入同学的班级</div>' +
            '</div>') +
          '<div class="quick-actions">' +
            '<button class="quick-btn quick-btn--primary" data-action="create-class">' + UI.icon('plus', 18) + ' 创建班级</button>' +
            '<button class="quick-btn quick-btn--ghost" data-action="join-class">' + UI.icon('qr', 18) + ' 加入班级</button>' +
          '</div>' +
        '</div>';
    }
  };

  /* ---------- 3. 班级详情 ---------- */
  Screens.classDetail = {
    nav: function (p) {
      var c = Store.klass(p.id);
      return {
        title: c ? c.name : '班级', back: true,
        right: { html: '<button class="navbar__btn" data-action="goto-manage" data-id="' + p.id + '">' + UI.icon('users', 19) + '</button>' }
      };
    },
    body: function (p) {
      var c = Store.klass(p.id);
      if (!c) return '<div class="empty"><div class="empty__title">班级不存在或已解散</div></div>';
      var st = Store.classStats(c.id);
      var owner = Store.isOwner(c.id);
      var tab = (p.tab || 'today');

      var hero = '' +
        '<div class="class-hero">' +
          '<div class="class-hero__top">' +
            '<div class="class-hero__avatar" style="--c:' + c.badgeColor + '">' + esc(c.name.slice(0, 2)) + '</div>' +
            '<div style="flex:1;min-width:0">' +
              '<div class="class-hero__name">' + esc(c.name) +
                (owner ? '<span class="tag tag--admin">管理员</span>' : '<span class="tag tag--gray">成员</span>') + '</div>' +
              '<div class="class-hero__desc">' + st.total + ' 名成员</div>' +
            '</div>' +
            '<button class="btn btn--ghost btn--sm class-hero__right" data-action="goto-manage" data-id="' + c.id + '">' + UI.icon('plus', 14) + ' 邀请</button>' +
          '</div>' +
        '</div>';

      var tabs = '' +
        '<div class="tabs">' +
          '<button class="tab' + (tab === 'today' ? ' is-active' : '') + '" data-action="switch-tab" data-tab="today">今日作业<span class="tab__count">' + st.todayCount + '</span></button>' +
          '<button class="tab' + (tab === 'history' ? ' is-active' : '') + '" data-action="switch-tab" data-tab="history">历史作业</button>' +
        '</div>';

      var bodyHtml = '';
      if (tab === 'today') {
        var today = Store.todayAssignments(c.id);
        bodyHtml = today.length ? today.map(function (a) { return assignCard(a); }).join('') :
          '<div class="empty">' +
            '<div class="empty__icon">' + UI.icon('doc', 28) + '</div>' +
            '<div class="empty__title">今天还没有作业</div>' +
            '<div class="empty__text">' + (owner ? '点击下方「发布作业」布置今天的第一条任务' : '等待管理员发布今天的作业') + '</div>' +
          '</div>';
      } else {
        var hist = Store.historyAssignments(c.id);
        var groups = {};
        hist.forEach(function (a) { var k = F.dayKey(a.createdAt); (groups[k] = groups[k] || []).push(a); });
        var keys = Object.keys(groups).sort().reverse();
        bodyHtml = keys.length ? keys.map(function (k) {
          var l = F.dayLabel(groups[k][0].createdAt);
          return '<div class="day-group">' +
            '<div class="day-head"><b>' + l.date + '</b><span>' + l.week + '</span><span class="day-head__line"></span><span>' + l.rel + '</span></div>' +
            groups[k].map(function (a) { return assignCard(a); }).join('') +
          '</div>';
        }).join('') :
          '<div class="empty">' +
            '<div class="empty__icon">' + UI.icon('chart', 28) + '</div>' +
            '<div class="empty__title">还没有历史作业</div>' +
            '<div class="empty__text">往期作业会按日期归档在这里</div>' +
          '</div>';
      }

      return '<div class="screen screen--fade">' + hero + tabs + bodyHtml + '</div>';
    },
    action: function (p) {
      if (!Store.isOwner(p.id)) return '';
      return '<button class="btn btn--primary btn--block" data-action="goto-publish" data-id="' + p.id + '">' + UI.icon('plus', 18) + ' 发布作业</button>';
    }
  };

  /* ---------- 4. 发布作业 ---------- */
  Screens.publish = {
    nav: function () { return { title: '发布作业', back: true }; },
    body: function (p) {
      var dl = p.deadline || Store.util.endOfDay(0);
      var label = F.deadlineText(dl, Store.now()).text.replace(' 截止', '');
      return '' +
        '<div class="screen screen--fade">' +
          '<div class="form">' +
            '<div class="field" id="f_title">' +
              '<div class="field__label">作业标题 <i>*</i><span class="field__count" id="cnt_title">0/20</span></div>' +
              '<input class="input" id="inp_title" maxlength="20" placeholder="例如：11月5日数学作业">' +
              '<div class="field__err">' + ic('info', 13) + ' 请填写作业标题</div>' +
            '</div>' +
            '<div class="field" id="f_content">' +
              '<div class="field__label">作业内容 <i>*</i><span class="field__count" id="cnt_content">0/200</span></div>' +
              '<textarea class="textarea" id="inp_content" maxlength="200" placeholder="写清楚具体任务，例如：完成数学课本第 35 页、第 36 页。"></textarea>' +
              '<div class="field__err">' + ic('info', 13) + ' 请填写作业内容</div>' +
            '</div>' +
            '<div class="field">' +
              '<div class="field__label">截止时间</div>' +
              '<button class="picker-box" data-action="pick-deadline">' +
                '<span class="picker-box__val">' + esc(label) + '</span>' +
                '<span class="chevron">' + UI.icon('right', 16) + '</span>' +
              '</button>' +
              '<div class="field__hint">默认当天 24:00 截止，当天完成都算数</div>' +
            '</div>' +
            '<div style="margin-top:18px;padding:13px 14px;background:#F2FBF6;border-radius:12px;font-size:12.5px;color:#177E4B;line-height:1.6">' +
              ic('info', 14) + ' 发布后所有班级成员都会收到；成员点击「我已完成」即记录服务器完成时间并进入排行榜。' +
            '</div>' +
          '</div>' +
        '</div>';
    },
    action: function () { return '<button class="btn btn--primary btn--block" data-action="submit-assignment">发布作业</button>'; }
  };

  /* ---------- 5. 作业详情 ---------- */
  Screens.assignmentDetail = {
    nav: function () {
      return { title: '作业详情', back: true, right: { html: '<button class="navbar__btn" data-action="assign-more">' + UI.icon('info', 19) + '</button>' } };
    },
    body: function (p) {
      var a = Store.assignment(p.id);
      if (!a) return '<div class="empty"><div class="empty__title">作业不存在或已删除</div></div>';
      var total = Store.membersOf(a.classId).length;
      var done = Store.completionsOf(a.id).length;
      var p2 = pct(done, total);
      var dl = dlText(a.deadline);
      var myRec = Store.completionOf(a.id, Store.me().id);
      var myRank = Store.myRank(a.id);
      var creator = Store.nickname(a.creatorId);

      var head = '' +
        '<div class="detail-head">' +
          '<div class="detail-head__title">' + esc(a.title) + '</div>' +
          '<div class="detail-head__meta">' +
            '<span class="who">' + avatar(creator, 'avatar--sm') + esc(creator) + '</span>' +
            '<span>' + F.date(a.createdAt) + ' ' + F.time(a.createdAt) + ' 发布</span>' +
          '</div>' +
        '</div>';

      var cards = '' +
        '<div class="detail-body">' +
          '<div class="detail-card">' +
            '<div class="detail-card__label">作业内容</div>' +
            '<div class="detail-card__text">' + esc(a.content) + '</div>' +
          '</div>' +
          '<div class="detail-card" style="margin-top:12px">' +
            '<div class="kv"><div class="kv__k">截止时间</div><div class="kv__v">' +
              (dl ? '<span style="color:' + (dl.over ? 'var(--ink-400)' : '#C97C1E') + '">' + esc(dl.text) + '</span>'
                  : '<span style="color:var(--ink-400)">未设置</span>') +
            '</div></div>' +
            '<div class="kv"><div class="kv__k">我的状态</div><div class="kv__v">' +
              (myRec ? '<span class="tag tag--brand">已完成 ' + F.time(myRec.completedAt) + '</span>' +
                (myRank && myRank.rank ? ' <span style="color:var(--ink-400);font-size:13px;margin-left:4px">第 ' + myRank.rank + ' 名</span>' : '') +
                (myRank && myRank.overdue ? ' <span class="tag tag--warn">逾期完成</span>' : '')
                : '<span class="tag tag--warn">未完成</span>') +
            '</div></div>' +
          '</div>' +
          '<div class="detail-card" style="margin-top:12px">' +
            '<div style="display:flex;align-items:baseline;gap:8px">' +
              '<div style="font-size:20px;font-weight:650">' + p2 + '%</div>' +
              '<div style="font-size:12.5px;color:var(--ink-400)">' + done + ' / ' + total + ' 人完成</div>' +
            '</div>' +
            '<div class="progress" style="margin:10px 0 12px"><div class="progress__bar" style="width:' + p2 + '%"></div></div>' +
            '<button class="link-row" data-action="goto-ranking" data-id="' + a.id + '">查看完整排行榜' + UI.icon('right', 14) + '</button>' +
          '</div>' +
        '</div>';

      return '<div class="screen screen--fade">' + head + cards + '</div>';
    },
    action: function (p) {
      var a = Store.assignment(p.id);
      if (!a) return '';
      if (Store.isCompleted(a.id)) {
        return '<button class="btn btn--done btn--block" data-action="already-done">已完成 ✓　查看我的排名</button>';
      }
      if (a.deadline && Store.now() > a.deadline) {
        return '<button class="btn btn--secondary btn--block" data-action="late-complete">已截止，仍要记录完成</button>';
      }
      return '<button class="btn btn--primary btn--block" data-action="do-complete" data-id="' + a.id + '">' + UI.icon('check', 19) + ' 我已完成</button>';
    }
  };

  /* ---------- 6. 完成排行榜 ---------- */
  Screens.ranking = {
    nav: function () { return { title: '完成排行榜', back: true }; },
    body: function (p) {
      var a = Store.assignment(p.id);
      if (!a) return '<div class="empty"><div class="empty__title">作业不存在</div></div>';
      var total = Store.membersOf(a.classId).length;
      var rk = Store.rankingOf(a.id);
      var done = rk.total;
      var p2 = pct(done, total);
      var myRank = Store.myRank(a.id);
      var R = 34, C = 2 * Math.PI * R;

      var hero = '' +
        '<div class="rank-hero">' +
          '<div class="rank-hero__title">' + esc(a.title) + '</div>' +
          '<div class="rank-hero__row">' +
            '<div class="rank-hero__ring">' +
              '<svg width="80" height="80" viewBox="0 0 80 80">' +
                '<circle cx="40" cy="40" r="' + R + '" fill="none" stroke="rgba(255,255,255,.25)" stroke-width="6"/>' +
                '<circle cx="40" cy="40" r="' + R + '" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" ' +
                  'stroke-dasharray="' + (C * p2 / 100).toFixed(1) + ' ' + C.toFixed(1) + '" transform="rotate(-90 40 40)"/>' +
              '</svg>' +
              '<div class="rank-hero__ringtxt"><b>' + p2 + '%</b><span>完成率</span></div>' +
            '</div>' +
            '<div class="rank-hero__stats">' +
              '<div class="rank-hero__stat"><b>' + done + '</b><span>/ ' + total + ' 人已完成</span></div>' +
              '<div class="rank-hero__stat"><b>' + (total - done) + '</b><span>人未完成</span></div>' +
            '</div>' +
          '</div>' +
        '</div>';

      var mine = myRank ?
        '<div class="my-rank">' +
          '<span class="rank-badge' + (myRank.rank && myRank.rank <= 3 ? ' rank-badge--' + myRank.rank : '') + '">' +
            (myRank.rank ? (myRank.rank === 1 ? '🥇' : (myRank.rank === 2 ? '🥈' : (myRank.rank === 3 ? '🥉' : myRank.rank))) : '—') + '</span>' +
          '<div><div class="my-rank__k">我的排名</div><div class="my-rank__v">' +
            (myRank.rank ? '第 ' + myRank.rank + ' 名' : '逾期完成') + '</div></div>' +
          '<div class="my-rank__time">' + F.time(myRank.completedAt) + ' 完成</div>' +
        '</div>' :
        '<div class="my-rank" style="border-left-color:var(--ink-300)">' +
          '<span class="rank-badge">—</span>' +
          '<div><div class="my-rank__k">我的排名</div><div class="my-rank__v" style="color:var(--ink-400);font-size:15px">还没完成</div></div>' +
          '<button class="btn btn--ghost btn--sm" data-action="goto-assignment" data-id="' + a.id + '">去完成</button>' +
        '</div>';

      var list = '<div class="rank-list">' + (rk.normal.length ? rk.normal.map(function (r) {
        return rankRow(r, r.userId === Store.me().id);
      }).join('') : '<div style="padding:30px 16px;text-align:center;color:var(--ink-400);font-size:13px">还没有人完成，快来抢第一</div>') + '</div>';

      var overdue = rk.overdue.length ?
        '<div class="overdue-head">' + ic('clock', 13) + '<b>逾期完成</b><span>' + rk.overdue.length + ' 人（保留记录，不参与正常排名）</span></div>' +
        '<div class="rank-list">' + rk.overdue.map(function (r) { return rankRow(r, r.userId === Store.me().id); }).join('') + '</div>' : '';

      return '<div class="screen screen--fade">' + hero + mine + list + overdue + '</div>';
    }
  };

  /* ---------- 7. 班级管理（含邀请码与二维码） ---------- */
  Screens.manage = {
    nav: function () { return { title: '班级管理', back: true }; },
    body: function (p) {
      var c = Store.klass(p.id);
      if (!c) return '<div class="empty"><div class="empty__title">班级不存在</div></div>';
      var owner = Store.isOwner(c.id);
      var members = Store.membersOf(c.id);
      var me = Store.me().id;

      var invite = '' +
        '<div class="sec-title sec-title--plain">邀请成员</div>' +
        '<div class="card invite-card">' +
          '<canvas class="qr" id="qrCanvas"></canvas>' +
          '<div class="invite-card__side">' +
            '<div class="invite-card__k">邀请码</div>' +
            '<div class="invite-code">' + esc(c.inviteCode) + '</div>' +
            '<button class="copy-link" data-action="copy-code" data-code="' + esc(c.inviteCode) + '">' + UI.icon('copy', 14) + ' 复制邀请码</button>' +
            '<button class="copy-link" data-action="share-to-friend">' + UI.icon('share', 14) + ' 分享给好友</button>' +
          '</div>' +
        '</div>';

      var info = '' +
        '<div class="sec-title sec-title--plain">班级信息</div>' +
        '<div class="card" style="margin:0 16px">' +
          '<div class="row">' +
            '<div class="class-hero__avatar" style="--c:' + c.badgeColor + ';width:42px;height:42px;border-radius:13px;font-size:17px">' + esc(c.name.slice(0, 2)) + '</div>' +
            '<div class="row__main">' +
              '<div class="row__title">' + esc(c.name) + '</div>' +
              '<div class="row__sub">' + esc(c.description || '暂无简介') + '</div>' +
            '</div>' +
            (owner ? '<button class="btn btn--ghost btn--sm" data-action="edit-class" data-id="' + c.id + '">' + UI.icon('edit', 13) + ' 修改</button>' : '') +
          '</div>' +
          (owner ? '<div class="row">' +
            '<div class="row__main"><div class="row__title">重新生成邀请码</div>' +
            '<div class="row__sub">生成后旧邀请码立即失效</div></div>' +
            '<button class="btn btn--ghost btn--sm" data-action="regen-code" data-id="' + c.id + '">' + UI.icon('refresh', 13) + ' 换新</button>' +
          '</div>' : '') +
        '</div>';

      var memberList = '' +
        '<div class="sec-title sec-title--plain">班级成员<span style="color:var(--ink-300)">' + members.length + ' 人</span></div>' +
        '<div class="card" style="margin:0 16px">' +
          members.map(function (m) {
            var isOwner = m.id === c.ownerId;
            var isMe = m.id === me;
            return '<div class="member">' +
              avatar(m.nickname) +
              '<div class="member__main">' +
                '<div class="member__name">' + esc(m.nickname) +
                  (isOwner ? '<span class="tag tag--admin">管理员</span>' : '') +
                  (isMe ? '<span class="tag tag--brand">我</span>' : '') +
                '</div>' +
                '<div class="member__sub">' + F.date(m.joinedAt) + ' 加入</div>' +
              '</div>' +
              (owner && !isOwner ?
                '<div class="member__act"><button class="btn btn--danger btn--sm" data-action="remove-member" data-id="' + c.id + '" data-uid="' + m.id + '" data-name="' + esc(m.nickname) + '">移除</button></div>'
                : '') +
            '</div>';
          }).join('') +
        '</div>';

      var danger = '' +
        '<div class="sec-title sec-title--plain">更多</div>' +
        '<div class="danger-zone">' +
          (owner ?
            '<button class="danger-row" data-action="transfer-owner" data-id="' + c.id + '">' +
              '<div><div>转让管理员</div><div class="danger-row__sub">转让后你将成为普通成员</div></div>' +
              '<span class="chevron">' + UI.icon('right', 16) + '</span>' +
            '</button>' +
            '<button class="danger-row" data-action="dissolve" data-id="' + c.id + '">' +
              '<div><div style="color:var(--danger)">解散班级</div><div class="danger-row__sub">解散后作业与完成记录一并移除</div></div>' +
              '<span class="chevron">' + UI.icon('right', 16) + '</span>' +
            '</button>'
            :
            '<button class="danger-row" data-action="leave" data-id="' + c.id + '">' +
              '<div><div style="color:var(--danger)">退出班级</div><div class="danger-row__sub">退出后历史完成记录仍会保留</div></div>' +
              '<span class="chevron">' + UI.icon('right', 16) + '</span>' +
            '</button>') +
        '</div>';

      return '<div class="screen screen--fade">' + invite + info + memberList + danger + '<div style="height:8px"></div></div>';
    },
    mounted: function (p) {
      var c = Store.klass(p.id);
      var cv = document.getElementById('qrCanvas');
      if (cv && c) UI.pseudoQR(c.inviteCode, cv);
    }
  };

  global.Screens = Screens;
  global.H = { avatar: avatar, avatarText: avatarText, ic: ic, pct: pct, assignCard: assignCard, statusOf: statusOf };
})(window);
