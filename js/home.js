'use strict';

/* home.js —— 信息首页：概览卡片、今日开放速览、公告、功能入口。
   所有数字都通过 CampusData 的派生函数计算，本页自己不做任何"再算一遍"的常量。 */

(function (C, D) {

  var SLOT_RE = /^(\d{2}:\d{2})-(\d{2}:\d{2})$/;

  function pad(n) {
    return (n < 10 ? '0' : '') + n;
  }

  function clockText() {
    var now = new Date();
    return pad(now.getHours()) + ':' + pad(now.getMinutes());
  }

  /* 默认定位到"现在"所在的整点时段；深夜不在任何时段内则退回第一个时段并说明 */
  function currentSlotGuess() {
    var slots = D.slotList();
    var now = new Date();
    var minutes = now.getHours() * 60 + now.getMinutes();
    for (var i = 0; i < slots.length; i++) {
      var parts = SLOT_RE.exec(slots[i]);
      if (!parts) continue;
      if (minutes >= C.toMinutes(parts[1]) && minutes < C.toMinutes(parts[2])) {
        return { slot: slots[i], inside: true };
      }
    }
    return { slot: slots[0] || '', inside: false };
  }

  function renderHero() {
    var meta = D.meta();
    C.$('#heroMeta').text('数据来源：' + D.from()
      + '｜更新时间 ' + (meta.updatedAt || '未知')
      + '｜今日数据统计截至 ' + (meta.dataCutoff || meta.updatedAt || '未知')
      + '｜' + (meta.source || ''));
  }

  function renderSummary() {
    var s = D.summary();
    var meta = D.meta();
    if (!s.total) {
      C.$('#summaryCards').html('<div class="col-12"><div class="alert alert-warning mb-0" role="alert">'
        + '场馆主表为空，概览无数据可算。请检查 <code>data/facilities.json</code> 的 facilities 数组。</div></div>');
      C.$('#summaryNote').text('');
      return;
    }
    var cards = [
      { t: '场馆总数', v: C.num(s.total) + ' 个', s: '其中 ' + s.open + ' 个今日开放、' + (s.total - s.open) + ' 个暂停开放' },
      { t: '支持线上预约', v: s.bookable + ' 个', s: '其余 ' + (s.total - s.bookable) + ' 个自由进场或暂停，不产生预约记录' },
      { t: '今日预约人次', v: C.num(s.bookedToday) + ' 人次', s: '各时段已约人数之和，含本机新增的 ' + s.mine + ' 条' },
      { t: '平均峰值占用', v: C.pct(s.avgLoad), s: '最拥挤时段已约人数 ÷ 容量，仅统计可预约场馆' }
    ];
    C.$('#summaryCards').html(cards.map(function (c) {
      return '<div class="col-12 col-sm-6 col-lg-3"><div class="card info-card h-100"><div class="card-body">'
        + '<h3 class="h6 text-secondary mb-1">' + C.escape(c.t) + '</h3>'
        + '<p class="card-value mb-1">' + C.escape(c.v) + '</p>'
        + '<p class="small text-secondary mb-0">' + C.escape(c.s) + '</p>'
        + '</div></div></div>';
    }).join(''));
    var units = meta.units || {};
    C.$('#summaryNote').text('口径说明：人次——' + (units.bookedToday || '各时段已约人数之和')
      + '；占用——' + (units.peakLoad || '峰值时段已约人数 ÷ 容量')
      + '。全校容量合计 ' + C.num(s.seats) + ' 人（含自由进场场馆）。');
  }

  function fillSlotOptions() {
    var slots = D.slotList();
    var $select = C.$('#slotPick');
    var guess = currentSlotGuess();
    $select.empty();
    if (!slots.length) {
      C.$('#slotHint').text('开放时段表（slots）为空，无法预览某一时段的开放情况。');
      return;
    }
    slots.forEach(function (s) { $select.append($('<option></option>').val(s).text(s)); });
    $select.val(guess.slot);
    C.$('#slotHint').text(guess.inside
      ? '当前时间 ' + clockText() + '，已默认定位到所在时段；切换时段可看各场馆当时的剩余名额。'
      : '当前时间 ' + clockText() + ' 不在任何整点开放时段内，已默认预览 ' + guess.slot + '。');
  }

  /* 自由进场场馆没有"可预约时段"，只判断整点是否落在开放区间内 */
  function slotInWindow(facility, slot) {
    var parts = SLOT_RE.exec(slot);
    if (!parts) return false;
    var from = C.toMinutes(facility.openFrom);
    var to = C.toMinutes(facility.openTo);
    if (!isFinite(from) || !isFinite(to)) return false;
    return C.toMinutes(parts[1]) >= from && C.toMinutes(parts[2]) <= to;
  }

  function openAt(facility, slot) {
    if (facility.status !== 'open') return false;
    return facility.bookable
      ? D.availableSlots(facility).indexOf(slot) !== -1
      : slotInWindow(facility, slot);
  }

  function openNowCard(facility, slot) {
    var area = D.areaById(facility.areaId);
    var used = D.slotCount(facility.id, slot);
    var ratio = facility.capacity ? used / facility.capacity : 0;
    var level = C.loadLevel(ratio);
    var free = Math.max(0, facility.capacity - used);
    var price = facility.pricePerHour ? facility.pricePerHour + ' 元/小时' : '免费';
    var meter = facility.bookable
      ? '<div class="occupancy-bar mt-2" role="img" aria-label="' + C.escape(facility.name) + ' 该时段已约 ' + used
        + ' 人，容量 ' + facility.capacity + ' 人，占用 ' + C.pct(ratio) + '">'
        + '<span style="width:' + Math.round(ratio * 100) + '%;background-color:' + level.bg + '"></span></div>'
        + '<p class="small mb-1 mt-1">该时段已约 ' + used + ' 人 · 剩 ' + free + ' 个名额（' + level.text + '）</p>'
      : '<p class="small mb-1 mt-2">自由进场，不设名额</p>';
    return '<div class="col-12 col-sm-6 col-xl-3"><div class="card info-card h-100"><div class="card-body">'
      + '<h3 class="h6 mb-1">' + C.escape(facility.name) + '</h3>'
      + '<p class="small text-secondary mb-1">' + C.escape(facility.type) + ' · ' + C.escape(area.name) + ' · '
      + C.escape(facility.openFrom) + '-' + C.escape(facility.openTo) + ' · ' + C.escape(price) + '</p>'
      + '<p class="small mb-0"><span class="badge text-bg-' + (facility.bookable ? 'primary' : 'secondary')
      + ' badge-soft">' + (facility.bookable ? '可预约' : '自由进场') + '</span></p>'
      + meter
      + (facility.bookable
        ? '<a class="small link-offset-2" href="facilities.html#f' + facility.id + '">去预约</a> · '
        : '<a class="small link-offset-2" href="facilities.html#f' + facility.id + '">查看场馆信息</a> · ')
      + '<a class="small link-offset-2" href="venue-3d.html?id=' + facility.id + '">三维定位</a>'
      + '</div></div></div>';
  }

  function renderOpenNow() {
    var slot = C.$('#slotPick').val();
    var $list = C.$('#openNowList').empty();
    if (!slot) {
      C.$('#openNowState').text('');
      return;
    }
    var all = D.facilityList();
    if (!all.length) {
      C.$('#openNowState').text('共 0 个场馆。');
      $list.html('<div class="col-12"><div class="alert alert-warning py-2 small mb-0">暂无场馆数据。</div></div>');
      return;
    }
    var matched = all.filter(function (f) { return openAt(f, slot); });
    if (!matched.length) {
      C.$('#openNowState').text(slot + '：没有场馆在该时段开放。');
      $list.html('<div class="col-12"><div class="alert alert-info py-2 small mb-0">'
        + C.escape(slot) + ' 全校无开放场馆（深夜或清早时段通常如此），换一个整点时段看看。</div></div>');
      return;
    }
    var bookableCount = matched.filter(function (f) { return f.bookable; }).length;
    C.$('#openNowState').text(slot + '：共 ' + matched.length + ' 个场馆开放，其中 ' + bookableCount + ' 个支持线上预约。');
    $list.html(matched.map(function (f) { return openNowCard(f, slot); }).join(''));
  }

  function renderNotices() {
    var list = D.notices();
    var $box = C.$('#noticeList').empty();
    if (!list.length) {
      $box.html('<p class="text-secondary small mb-0">暂无公告。</p>');
      return;
    }
    var TAG = { warning: { cls: 'warning', text: '调整' }, success: { cls: 'success', text: '新增' }, info: { cls: 'secondary', text: '通知' } };
    $box.html(list.map(function (n) {
      var tag = TAG[n.level] || TAG.info;
      return '<article class="mb-3">'
        + '<h3 class="h6 mb-1"><span class="badge text-bg-' + tag.cls + ' badge-soft me-2">' + tag.text + '</span>'
        + C.escape(n.title || '（无标题）') + '</h3>'
        + '<time class="d-block small text-secondary" datetime="' + C.escape(n.date || '') + '">'
        + C.escape(n.date || '日期未标注') + '</time>'
        + '<p class="small text-secondary mb-0">' + C.escape(n.body || '') + '</p>'
        + '</article>';
    }).join(''));
  }

  function renderAbout() {
    var meta = D.meta();
    C.$('#aboutSource').text('数据来源：' + D.from() + '。' + (meta.source || '')
      + ' 表结构与单位见 data/facilities.json 的 meta.tables 与 meta.units 字段。');
  }

  function renderAll() {
    renderHero();
    renderSummary();
    fillSlotOptions();
    renderOpenNow();
    renderNotices();
    renderAbout();
    C.$('#slotForm').on('change', '#slotPick', renderOpenNow);
  }

  C.ready(function () {
    C.bindSharedUi();
    D.load(renderAll);
  });

})(window.Campus, window.CampusData);
