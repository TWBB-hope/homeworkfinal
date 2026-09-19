'use strict';

/* common.js —— 四个页面共用的基础工具：提示条、本地存储的安全读写、时间与文本格式、导航行为。
   依赖：jQuery（所有页面均在前面引入）。数据相关的派生计算不在这里，见 js/data.js。 */

window.Campus = window.Campus || {};

(function (C) {

  /* 把任意文本转成可以安全写进 HTML 字符串的形式。
     场馆名来自 JSON、关键字来自用户输入、预约记录来自 localStorage，三者都可能含 < > " '，
     不转义直接拼串会把内容当标签解析（也会造成 XSS）。所有 .html() 拼接前都要过这个函数。 */
  C.escape = function (value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  C.pct = function (ratio) {
    return Math.round(ratio * 100) + '%';
  };

  C.num = function (value) {
    return Number(value).toLocaleString('zh-CN');
  };

  /* "08:30" → 510，用于比较时段与开放区间 */
  C.toMinutes = function (hhmm) {
    const parts = String(hhmm).split(':');
    const h = Number(parts[0]);
    const m = Number(parts[1] || 0);
    if (!isFinite(h) || !isFinite(m)) return NaN;
    return h * 60 + m;
  };

  /* 占用程度分档：颜色 + 文字 + 数字三者同时给出，不单靠颜色传达信息 */
  C.loadLevel = function (ratio) {
    if (ratio >= 0.8) return { text: '紧张', cls: 'danger', bg: '#dc3545' };
    if (ratio >= 0.5) return { text: '适中', cls: 'warning', bg: '#e0a800' };
    return { text: '宽松', cls: 'success', bg: '#198754' };
  };

  /* ---------- 提示条：所有面向用户的错误与确认都走这里 ---------- */
  var notifySeq = 0;

  C.notify = function (level, text, options) {
    var opts = options || {};
    var box = document.getElementById('messages');
    if (!box) return;
    var cls = { danger: 'danger', warning: 'warning', success: 'success' }[level] || 'info';
    var id = 'alert-' + (++notifySeq);
    var $a = $('<div></div>', {
      'class': 'alert alert-' + cls + ' py-2 px-3 small d-flex justify-content-between align-items-start gap-2',
      role: cls === 'danger' ? 'alert' : 'status',
      id: id
    });
    $a.append($('<span></span>').text(text));
    $('<button></button>', {
      type: 'button',
      class: 'btn-close btn-sm',
      'aria-label': '关闭提示'
    }).on('click', function () { $a.stop(true, true).fadeOut(120, function () { $(this).remove(); }); }).appendTo($a);
    box.appendChild($a[0]);
    if (!opts.sticky) {
      window.setTimeout(function () { $a.fadeOut(250, function () { $(this).remove(); }); }, opts.duration || 7000);
    }
  };

  /* ---------- localStorage：隐私模式／被禁用时会抛异常，全部包在 try/catch 里 ---------- */
  C.storage = {
    available: true,

    read: function (key, fallback) {
      try {
        var raw = window.localStorage.getItem(key);
        if (raw === null) return fallback;
        var parsed = JSON.parse(raw);
        return parsed === null || parsed === undefined ? fallback : parsed;
      } catch (e) {
        this.available = false;
        C.notify('danger', '浏览器拒绝读取本机存储（' + e.name + '：可能处于隐私模式或被站点设置禁用）。'
          + '本页的预约与偏好无法保存，刷新后会丢失，其余浏览功能不受影响。');
        return fallback;
      }
    },

    write: function (key, value) {
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (e) {
        this.available = false;
        C.notify('danger', '浏览器拒绝写入本机存储（' + e.name + '：可能处于隐私模式或空间已满），本次改动未能保存。');
        return false;
      }
    },

    remove: function (key) {
      try {
        window.localStorage.removeItem(key);
        return true;
      } catch (e) {
        return false;
      }
    }
  };

  /* ---------- 导航：手机端点击链接后自动收起折叠菜单 ---------- */
  C.bindSharedUi = function () {
    $('#siteNav').on('click', '.nav-link', function () {
      var el = document.getElementById('topNavCollapse');
      if (el && window.bootstrap && el.classList.contains('show')) {
        window.bootstrap.Collapse.getOrCreateInstance(el).hide();
      }
    });

    $('#footerYear').text(new Date().getFullYear());

    /* 三维库／图表库没加载成功时，由页脚统一给出可执行的下一步建议 */
    if (!window.jQuery) {
      document.body.innerHTML = '<div class="container py-5"><h1>脚本库未加载</h1>'
        + '<p>jQuery 未能加载，页面无法初始化。请确认 <code>vendor/jquery.min.js</code> 存在，'
        + '或用本地服务器打开：python -m http.server 8000</p></div>';
    }
  };

  /* 页面加载兜底：CDN 不可达时改读仓库内 vendor/ 的同版本副本。
     CSS 用 <link onerror>，JS 用"加载后检测全局变量再 document.write"，
     两种写法都由浏览器同步完成，保证后面的代码执行时库已就绪。 */
  C.libAvailable = function (name) {
    return !!window[name];
  };

})(window.Campus);
