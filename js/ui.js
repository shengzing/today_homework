/* ==========================================================================
   今日作业 · UI 组件层
   Toast / Dialog / ActionSheet / Loading / Icon / 伪二维码
   ========================================================================== */
(function (global) {
  'use strict';

  var toastHost, modalHost, loadingHost, timer = null;

  function el(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ---------------- Icon ---------------- */
  var ICONS = {
    back:    '<path d="M15 18l-6-6 6-6"/>',
    right:   '<path d="M9 18l6-6-6-6"/>',
    down:    '<path d="M6 9l6 6 6-6"/>',
    plus:    '<path d="M12 5v14M5 12h14"/>',
    check:   '<path d="M20 6L9 17l-5-5"/>',
    clock:   '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    users:   '<path d="M16 19v-1.5a4 4 0 00-4-4H6a4 4 0 00-4 4V19"/><circle cx="9" cy="7" r="3.2"/><path d="M17 4.2a3.2 3.2 0 010 6.2"/><path d="M22 19v-1.5a4 4 0 00-3-3.9"/>',
    share:   '<path d="M4 12.5V19a1.5 1.5 0 001.5 1.5h13A1.5 1.5 0 0020 19v-6.5"/><path d="M12 15V3.5"/><path d="M7.5 8L12 3.5 16.5 8"/>',
    copy:    '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4.5A1.5 1.5 0 013 13.5v-9A1.5 1.5 0 014.5 3h9A1.5 1.5 0 0115 4.5V5"/>',
    edit:    '<path d="M4 20h4l10-10a2.6 2.6 0 00-3.7-3.7L4.3 16.3 4 20z"/>',
    trash:   '<path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 12a1.5 1.5 0 001.5 1.4h7A1.5 1.5 0 0017 19l1-12"/><path d="M9 7V4.5h6V7"/>',
    refresh: '<path d="M20 12a8 8 0 11-2.3-5.6"/><path d="M20 4v4.5h-4.5"/>',
    qr:      '<rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1.2"/><rect x="14" y="3.5" width="6.5" height="6.5" rx="1.2"/><rect x="3.5" y="14" width="6.5" height="6.5" rx="1.2"/><path d="M14 14h3v3h-3zM20.5 14v3M17.5 20.5h3"/>',
    bell:    '<path d="M18 8.5a6 6 0 10-12 0c0 6-2.5 7.5-2.5 7.5h17S18 14.5 18 8.5z"/><path d="M10.3 20a2 2 0 003.4 0"/>',
    doc:     '<path d="M6 3.5h8L18.5 8v12.5H6z"/><path d="M13.5 3.5V8h5"/>',
    exit:    '<path d="M14 4.5h4A1.5 1.5 0 0119.5 6v12a1.5 1.5 0 01-1.5 1.5h-4"/><path d="M10 8.5L6.5 12 10 15.5"/><path d="M6.5 12H15"/>',
    crown:   '<path d="M4 18h16"/><path d="M4 18l-1-9 5 3.5L12 6l4 6.5L21 9l-1 9"/>',
    chart:   '<path d="M4 19.5h16"/><rect x="6" y="11" width="3.2" height="6"/><rect x="11" y="7" width="3.2" height="10"/><rect x="16" y="13" width="3.2" height="4"/>',
    camera:  '<path d="M3.5 8.5h3l1.5-2.5h8L17.5 8.5h3v11h-17z"/><circle cx="12" cy="13.5" r="3.2"/>',
    info:    '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5"/><circle cx="12" cy="7.8" r=".9" fill="currentColor" stroke="none"/>',
    dots:    '<circle cx="5" cy="12" r="1.7" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.7" fill="currentColor" stroke="none"/>',
    target:  '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.4" fill="currentColor" stroke="none"/>',
    empty:   '<path d="M6 8.5h12l-1 11H7z"/><path d="M9.5 8.5V6.2A2.5 2.5 0 0112 3.7a2.5 2.5 0 012.5 2.5v2.3"/>'
  };
  function icon(name, size, cls) {
    var body = ICONS[name] || '';
    return '<svg class="' + (cls || '') + '" width="' + (size || 20) + '" height="' + (size || 20) +
      '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + body + '</svg>';
  }

  /* ---------------- Toast ---------------- */
  function toast(msg, duration) {
    if (!toastHost) toastHost = el('toastHost');
    toastHost.innerHTML = '<div class="toast">' + esc(msg) + '</div>';
    clearTimeout(timer);
    timer = setTimeout(function () {
      var t = toastHost.querySelector('.toast');
      if (t) { t.classList.add('is-out'); setTimeout(function () { toastHost.innerHTML = ''; }, 200); }
    }, duration || 1900);
  }

  /* ---------------- Dialog ---------------- */
  function openDialog(opts) {
    return new Promise(function (resolve) {
      if (!modalHost) modalHost = el('modalHost');
      var isPrompt = opts.type === 'prompt';
      var html =
        '<div class="modal-mask" data-dismiss="1"></div>' +
        '<div class="modal" role="dialog">' +
        (opts.title ? '<div class="modal__title">' + esc(opts.title) + '</div>' : '') +
        (opts.content ? '<div class="modal__content">' + esc(opts.content) + '</div>' : '') +
        (isPrompt ? '<input class="modal__input" id="dlgInput" maxlength="' + (opts.maxlength || 20) +
          '" placeholder="' + esc(opts.placeholder || '') + '" value="' + esc(opts.value || '') + '">' : '') +
        '<div class="modal__btns">' +
        (opts.cancelText === null ? '' : '<button class="modal__btn modal__btn--cancel" data-act="cancel">' + esc(opts.cancelText || '取消') + '</button>') +
        '<button class="modal__btn ' + (opts.danger ? 'modal__btn--danger' : 'modal__btn--ok') + '" data-act="ok">' + esc(opts.confirmText || '确定') + '</button>' +
        '</div></div>';
      modalHost.innerHTML = html;
      modalHost.classList.add('is-open');

      var input = el('dlgInput');
      if (input) setTimeout(function () { input.focus(); input.select(); }, 60);

      function close(val) {
        modalHost.classList.remove('is-open');
        modalHost.innerHTML = '';
        resolve(val);
      }
      modalHost.querySelector('[data-act="ok"]').addEventListener('click', function () {
        close(isPrompt ? (input ? input.value.trim() : '') : true);
      });
      var cancelBtn = modalHost.querySelector('[data-act="cancel"]');
      if (cancelBtn) cancelBtn.addEventListener('click', function () { close(isPrompt ? null : false); });
      var mask = modalHost.querySelector('.modal-mask');
      if (mask) mask.addEventListener('click', function () { close(isPrompt ? null : false); });
    });
  }
  function confirm(opts) { return openDialog(Object.assign({ type: 'confirm' }, opts)); }
  function prompt(opts) { return openDialog(Object.assign({ type: 'prompt' }, opts)); }

  /* ---------------- 表单弹窗（多字段） ---------------- */
  function formDialog(opts) {
    return new Promise(function (resolve) {
      if (!modalHost) modalHost = el('modalHost');
      var fields = opts.fields || [];
      var html =
        '<div class="modal-mask" data-dismiss="1"></div>' +
        '<div class="modal modal--form" role="dialog">' +
        (opts.title ? '<div class="modal__title">' + esc(opts.title) + '</div>' : '') +
        '<div class="modal__fields">' +
        fields.map(function (f, i) {
          var fid = 'fld_' + i + '_' + Math.random().toString(36).slice(2, 7);
          return '<div class="modal__field">' +
            (f.label ? '<label class="modal__label" for="' + fid + '">' + esc(f.label) + (f.required ? ' <i>*</i>' : '') + '</label>' : '') +
            '<input class="modal__input modal__input--field" id="' + fid + '" name="fld_' + i + '" data-f="' + i + '" ' +
            'maxlength="' + (f.maxlength || 30) + '" placeholder="' + esc(f.placeholder || '') + '" value="' + esc(f.value || '') + '"' +
            (f.uppercase ? ' data-upper="1"' : '') + '>' +
            '</div>';
        }).join('') +
        '</div>' +
        '<div class="modal__btns">' +
        '<button class="modal__btn modal__btn--cancel" data-act="cancel">' + esc(opts.cancelText || '取消') + '</button>' +
        '<button class="modal__btn ' + (opts.danger ? 'modal__btn--danger' : 'modal__btn--ok') + '" data-act="ok">' + esc(opts.confirmText || '确定') + '</button>' +
        '</div></div>';
      modalHost.innerHTML = html;
      modalHost.classList.add('is-open');

      var inputs = modalHost.querySelectorAll('.modal__input--field');
      Array.prototype.forEach.call(inputs, function (inp) {
        inp.addEventListener('input', function () {
          if (inp.getAttribute('data-upper')) inp.value = inp.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
        });
      });
      function close(val) {
        modalHost.classList.remove('is-open');
        modalHost.innerHTML = '';
        resolve(val);
      }
      modalHost.querySelector('[data-act="ok"]').addEventListener('click', function () {
        var vals = [];
        Array.prototype.forEach.call(inputs, function (inp) { vals.push(inp.value.trim()); });
        close(vals);
      });
      modalHost.querySelector('[data-act="cancel"]').addEventListener('click', function () { close(null); });
      modalHost.querySelector('.modal-mask').addEventListener('click', function () { close(null); });
      if (inputs[0]) setTimeout(function () { inputs[0].focus(); }, 60);
    });
  }

  /* ---------------- 卡片式提示（用于「诚实的小朋友」这类正向反馈） ---------------- */
  function hint(title, sub, duration) {
    if (!toastHost) toastHost = el('toastHost');
    toastHost.innerHTML =
      '<div class="toast toast--card">' +
        '<div class="toast--card__icon">✓</div>' +
        '<div class="toast--card__title">' + esc(title) + '</div>' +
        (sub ? '<div class="toast--card__sub">' + esc(sub) + '</div>' : '') +
      '</div>';
    clearTimeout(timer);
    timer = setTimeout(function () {
      var t = toastHost.querySelector('.toast');
      if (t) { t.classList.add('is-out'); setTimeout(function () { toastHost.innerHTML = ''; }, 200); }
    }, duration || 2600);
  }

  /* ---------------- ActionSheet ---------------- */
  function actionSheet(opts) {
    return new Promise(function (resolve) {
      if (!modalHost) modalHost = el('modalHost');
      var items = (opts.items || []).map(function (it, i) {
        return '<button class="sheet__item' + (it.danger ? ' sheet__item--danger' : '') + '" data-i="' + i + '">' +
          (it.icon ? icon(it.icon, 18) : '') + '<span>' + esc(it.label) + '</span></button>';
      }).join('');
      modalHost.innerHTML =
        '<div class="sheet-mask" data-dismiss="1"></div>' +
        '<div class="sheet">' +
        (opts.title ? '<div class="sheet__title">' + esc(opts.title) + '</div>' : '') +
        '<div class="sheet__scroll">' + items + '</div>' +
        '<button class="sheet__item sheet__cancel" data-i="-1">' + esc(opts.cancelText || '取消') + '</button>' +
        '</div>';
      modalHost.classList.add('is-open');
      function close(v) { modalHost.classList.remove('is-open'); modalHost.innerHTML = ''; resolve(v); }
      modalHost.querySelectorAll('.sheet__item').forEach(function (b) {
        b.addEventListener('click', function () {
          var i = parseInt(b.dataset.i, 10);
          close(i < 0 ? null : i);
        });
      });
      modalHost.querySelector('.sheet-mask').addEventListener('click', function () { close(null); });
    });
  }

  /* ---------------- Loading ---------------- */
  function loading(text) {
    if (!loadingHost) loadingHost = el('loadingHost');
    loadingHost.innerHTML = '<div class="loading"><span class="spinner"></span><span>' + esc(text || '处理中…') + '</span></div>';
    loadingHost.classList.add('is-open');
  }
  function hideLoading() {
    if (!loadingHost) loadingHost = el('loadingHost');
    loadingHost.classList.remove('is-open');
    loadingHost.innerHTML = '';
  }

  /* ---------------- 伪二维码 ---------------- */
  function pseudoQR(code, canvas) {
    if (!canvas) return;
    var N = 25, ctx = canvas.getContext('2d');
    canvas.width = N; canvas.height = N;
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, N, N);
    ctx.fillStyle = '#0E1113';

    function seeded(str) {
      var h = 2166136261;
      for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
      return h >>> 0;
    }
    var s = seeded(code || 'qr'), i, j;
    function rand() {
      s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    }
    /* 定位图案 */
    function finder(ox, oy) {
      for (var a = 0; a < 7; a++) for (var b = 0; b < 7; b++) {
        var edge = (a === 0 || a === 6 || b === 0 || b === 6);
        var core = (a >= 2 && a <= 4 && b >= 2 && b <= 4);
        if (edge || core) ctx.fillRect(ox + b, oy + a, 1, 1);
      }
    }
    finder(0, 0); finder(N - 7, 0); finder(0, N - 7);
    /* 数据区 */
    for (i = 0; i < N; i++) {
      for (j = 0; j < N; j++) {
        var inFinder = (i < 8 && j < 8) || (i < 8 && j > N - 9) || (i > N - 9 && j < 8);
        if (inFinder) continue;
        if (rand() > 0.52) ctx.fillRect(j, i, 1, 1);
      }
    }
  }

  /* ---------------- 复制 ---------------- */
  function copy(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text);
        toast('已复制');
        return;
      }
    } catch (e) { /* 降级 */ }
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0;left:-9999px';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); toast('已复制'); }
    catch (e) { toast('请手动复制'); }
    document.body.removeChild(ta);
  }

  global.UI = {
    toast: toast, hint: hint,
    confirm: confirm, prompt: prompt, formDialog: formDialog, actionSheet: actionSheet,
    loading: loading, hideLoading: hideLoading,
    icon: icon, pseudoQR: pseudoQR, copy: copy, esc: esc
  };
})(window);
