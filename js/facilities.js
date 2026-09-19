'use strict';

/* facilities.js —— 场馆查询与预约：筛选／搜索／排序、双视图渲染、我的预约（增·改·删）。
   约定：
   1) 页面上所有数字来自 CampusData 的派生函数（含"我的预约"叠加），不另存一份；
   2) 任何写进 innerHTML 的动态文本必须先过 Campus.escape；
   3) 用户可见的错误一律走 Campus.notify，不静默失败。 */

(function (C, D) {

  var state = { editingId: null };

  /* ---------- 一、筛选条件 ---------- */
  function fillFilterOptions() {
    var types = [];
    D.facilityList().forEach(function (f) {
      if (types.indexOf(f.type) === -1) types.push(f.type);
    });
    var $type = C.$('#typeSelect');
    types.forEach(function (t) { $type.append($('<option></option>').val(t).text(t)); });

    var $area = C.$('#areaSelect');
    D.areaList().forEach(function (a) { $area.append($('<option></option>').val(a.id).text(a.name)); });

    var $slot = C.$('#freeSlotSelect');
    D.slotList().forEach(function (s, i) { $slot.append($('<option></option>').val(s).text(s).prop('selected', i === 4)); });
  }

  function readQuery() {
    var rawMinFree = C.$('#minFreeInput').val();
    var minFree = null;
    var minFreeError = '';
    if (rawMinFree !== '' && rawMinFree !== null) {
      var n = Number(rawMinFree);
      if (!isFinite(n) || n < 0 || n > 300 || Math.floor(n) !== n) {
        minFreeError = '剩余名额需要填 0～300 之间的整数，你填的"' + rawMinFree + '"已忽略，其余条件照常生效。';
      } else {
        minFree = n;
      }
    }
    return {
      type: C.$('#typeSelect').val() || 'all',
      area: C.$('#areaSelect').val() || 'all',
      load: C.$('#loadSelect').val() || 'all',
      book: C.$('#bookSelect').val() || 'all',
      sort: C.$('#sortSelect').val() || 'default',
      keyword: String(C.$('#searchInput').val() || '').trim().toLowerCase(),
      minFree: minFree,
      minFreeSlot: C.$('#freeSlotSelect').val() || '',
      minFreeError: minFreeError
    };
  }

  function keywordHit(facility, keyword) {
    if (!keyword) return true;
    var hay = [facility.name, facility.type, facility.intro, D.areaById(facility.areaId).name,
      facility.openFrom, facility.openTo].join(' ').toLowerCase();
    /* 空格分隔的多关键字：每一段都要命中，"北区 羽毛球"＝北区里的羽毛球馆 */
    return keyword.split(/\s+/).every(function (token) {
      return hay.indexOf(token) !== -1;
    });
  }

  function matches(facility, q, overrides) {
    if (q.type !== 'all' && facility.type !== q.type) return false;
    if (q.area !== 'all' && facility.areaId !== q.area) return false;
    if (q.book === 'yes' && !(facility.bookable && facility.status === 'open')) return false;
    if (q.book === 'free' && (facility.bookable || facility.status !== 'open')) return false;
    if (q.book === 'closed' && facility.status === 'open') return false;
    if (q.load !== 'all') {
      /* 拥挤程度只对"有名额概念"的场馆成立，自由进场与暂停开放的场馆直接排除 */
      if (!facility.bookable || facility.status !== 'open') return false;
      var ratio = D.stats(facility, overrides).peakLoad;
      if (q.load === 'easy' && ratio >= 0.5) return false;
      if (q.load === 'mid' && (ratio < 0.5 || ratio >= 0.8)) return false;
      if (q.load === 'busy' && ratio < 0.8) return false;
    }
    if (q.minFree !== null) {
      if (!facility.bookable || facility.status !== 'open') return false;
      if (D.availableSlots(facility).indexOf(q.minFreeSlot) === -1) return false;
      if (D.stats(facility, overrides).remainingOf(q.minFreeSlot) < q.minFree) return false;
    }
    return keywordHit(facility, q.keyword);
  }

  function sortList(list, mode, overrides) {
    var copy = list.slice();
    function load(f) { return D.stats(f, overrides).peakLoad; }
    function booked(f) { return D.stats(f, overrides).bookedToday; }
    if (mode === 'loadDesc') copy.sort(function (a, b) { return load(b) - load(a); });
    else if (mode === 'loadAsc') copy.sort(function (a, b) { return load(a) - load(b); });
    else if (mode === 'bookedDesc') copy.sort(function (a, b) { return booked(b) - booked(a); });
    else if (mode === 'capacityDesc') copy.sort(function (a, b) { return b.capacity - a.capacity; });
    else if (mode === 'priceAsc') copy.sort(function (a, b) { return a.pricePerHour - b.pricePerHour; });
    else copy.sort(function (a, b) { return a.id - b.id; });
    return copy;
  }

  function filterEcho(q) {
    var parts = [];
    if (q.type !== 'all') parts.push('类型＝' + q.type);
    if (q.area !== 'all') parts.push('校区＝' + D.areaById(q.area).name);
    if (q.load !== 'all') parts.push('拥挤程度＝' + ({ easy: '宽松', mid: '适中', busy: '紧张' }[q.load]));
    if (q.book !== 'all') parts.push('预约方式＝' + ({ yes: '支持线上预约', free: '自由进场', closed: '暂停开放' }[q.book]));
    if (q.keyword) parts.push('关键字＝' + q.keyword);
    if (q.minFree !== null) parts.push(q.minFreeSlot + ' 剩余 ≥ ' + q.minFree + ' 人');
    if (q.sort !== 'default') parts.push('排序＝' + C.$('#sortSelect option:selected').text());
    return parts.length ? '当前条件：' + parts.join('；') : '未设置筛选条件，显示全部场馆。';
  }

  /* ---------- 二、列表渲染（表格与卡片共用同一份命中结果） ---------- */
  function loadCell(facility, overrides) {
    var s = D.stats(facility, overrides);
    if (!facility.bookable || facility.status !== 'open') {
      return '<span class="text-secondary small">' + (facility.status === 'open' ? '不计名额' : '—') + '</span>';
    }
    var width = Math.round(s.peakLoad * 100);
    return '<span class="badge text-bg-' + s.level.cls + ' badge-soft">' + s.level.text + '</span> '
      + C.pct(s.peakLoad) + '<br><span class="small text-secondary">最挤时段 ' + (s.peakSlot || '无') + ' '
      + s.peakCount + '/' + facility.capacity + ' 人</span>'
      + '<div class="occupancy-bar mt-1" role="img" aria-label="峰值占用 ' + C.pct(s.peakLoad) + '">'
      + '<span style="width:' + width + '%;background-color:' + s.level.bg + '"></span></div>';
  }

  function actionCell(facility) {
    if (facility.status !== 'open') {
      return '<button class="btn btn-sm btn-secondary" type="button" disabled title="本学期暂停开放">暂停开放</button>';
    }
    if (!facility.bookable) {
      return '<span class="badge text-bg-light border badge-soft">自由进场</span>';
    }
    return '<button class="btn btn-sm btn-primary pick-btn" type="button" data-id="' + facility.id + '">预约此馆</button>';
  }

  function metaLine(facility) {
    return C.escape(facility.intro) + '<br><a class="small link-offset-2" href="venue-3d.html?id=' + facility.id
      + '">在三维场景查看</a>';
  }

  function rowHtml(facility, overrides) {
    var price = facility.pricePerHour === 0 ? '免费' : facility.pricePerHour + ' 元';
    var booked = facility.bookable && facility.status === 'open' ? C.num(D.stats(facility, overrides).bookedToday) : '—';
    return '<tr data-fid="' + facility.id + '">'
      + '<th scope="row" class="fw-normal">' + C.escape(facility.name)
      + '<span class="small text-secondary d-block">编号 ' + facility.id + '</span></th>'
      + '<td>' + C.escape(facility.type) + '</td>'
      + '<td>' + C.escape(D.areaById(facility.areaId).name) + '</td>'
      + '<td>' + facility.capacity + '</td>'
      + '<td class="small">' + C.escape(facility.openFrom) + '–' + C.escape(facility.openTo) + '</td>'
      + '<td>' + C.escape(price) + '</td>'
      + '<td>' + booked + '</td>'
      + '<td>' + loadCell(facility, overrides) + '</td>'
      + '<td>' + actionCell(facility) + '</td>'
      + '</tr>';
  }

  function cardHtml(facility, overrides) {
    var s = D.stats(facility, overrides);
    var price = facility.pricePerHour === 0 ? '免费' : facility.pricePerHour + ' 元/小时';
    return '<div class="col-12 col-sm-6 col-lg-4" data-fid="' + facility.id + '"><div class="card">'
      + '<div class="card-body">'
      + '<h3 class="venue-name mb-1">' + C.escape(facility.name) + '</h3>'
      + '<p class="small text-secondary mb-1">' + C.escape(facility.type) + ' · '
      + C.escape(D.areaById(facility.areaId).name) + ' · 容量 ' + facility.capacity + ' 人</p>'
      + '<p class="small mb-2">' + C.escape(facility.openFrom) + '–' + C.escape(facility.openTo)
      + ' · ' + C.escape(price) + (facility.bookable && facility.status === 'open'
        ? ' · 今日 ' + s.bookedToday + ' 人次' : '') + '</p>'
      + '<p class="small mb-2">' + C.escape(facility.intro) + '</p>'
      + '<p class="mb-2">' + loadCell(facility, overrides) + '</p>'
      + actionCell(facility) + ' '
      + '<a class="btn btn-sm btn-outline-secondary" href="venue-3d.html?id=' + facility.id + '">三维查看</a>'
      + '</div></div></div>';
  }

  function emptyRow(colspan) {
    return '<tr><td colspan="' + colspan + '" class="text-center text-secondary py-4">'
      + '没有符合条件的场馆，请放宽类型、校区、拥挤程度或关键字。</td></tr>';
  }

  function renderList() {
    var overrides = D.myBookingMap();
    var q = readQuery();
    var all = D.facilityList();
    if (q.minFreeError) {
      C.$('#filterEcho').text(q.minFreeError);
    }
    if (!all.length) {
      C.$('#venueBody').html('<tr><td colspan="9" class="text-center text-secondary py-4">'
        + '场馆主表为空，请检查 data/facilities.json。</td></tr>');
      C.$('#cardsWrap').html('<div class="col-12"><div class="alert alert-warning py-2 small mb-0">暂无场馆数据。</div></div>');
      C.$('#listState').text('共 0 个场馆');
      return;
    }
    var matched = sortList(all.filter(function (f) { return matches(f, q, overrides); }), q.sort, overrides);
    C.$('#venueBody').html(matched.length ? matched.map(function (f) { return rowHtml(f, overrides); }).join('') : emptyRow(9));
    C.$('#cardsWrap').html(matched.length ? matched.map(function (f) { return cardHtml(f, overrides); }).join('')
      : '<div class="col-12"><div class="alert alert-info py-2 small mb-0">没有符合条件的场馆，请调整查询条件。</div></div>');
    C.$('#listState').text('共 ' + all.length + ' 个场馆，当前显示 ' + matched.length + ' 个'
      + (q.load !== 'all' || q.minFree !== null ? '（拥挤程度与剩余名额只作用于支持线上预约的场馆）' : ''));
    if (!q.minFreeError) C.$('#filterEcho').text(filterEcho(q));
  }

  /* ---------- 三、我的预约：增 · 改 · 删 ---------- */
  function fillVenuePick() {
    var $pick = C.$('#venuePick');
    var keep = $pick.val();
    $pick.empty();
    $pick.append($('<option></option>').val('').text('请选择场馆'));
    D.bookableList().forEach(function (f) {
      $pick.append($('<option></option>').val(String(f.id)).text(f.name + '（' + f.type + '）'));
    });
    /* 列表局部刷新（取消一条预约等）不应把用户已经选好的场馆清空 */
    if (keep && $pick.find('option[value="' + keep + '"]').length) $pick.val(keep);
  }

  function fillSlotPick(facilityId, keepValue) {
    var $slot = C.$('#slotPick2').empty();
    if (!facilityId) {
      $slot.prop('disabled', true).append($('<option></option>').val('').text('请先选择场馆'));
      return;
    }
    var facility = D.facilityById(facilityId);
    if (!facility) {
      $slot.prop('disabled', true).append($('<option></option>').val('').text('该场馆已不在数据中'));
      return;
    }
    var slots = D.availableSlots(facility);
    if (!slots.length) {
      $slot.prop('disabled', true).append($('<option></option>').val('').text('该场馆今日无可约时段'));
      return;
    }
    $slot.prop('disabled', false);
    $slot.append($('<option></option>').val('').text('请选择时段'));
    slots.forEach(function (slot) {
      var left = D.stats(facility).remainingOf(slot);
      $slot.append($('<option></option>').val(slot).text(slot + '（剩 ' + left + ' 个名额）').prop('disabled', left === 0));
    });
    if (keepValue && slots.indexOf(keepValue) !== -1) $slot.val(keepValue);
  }

  function bookingRow(b, index) {
    var facility = D.facilityById(b.facilityId);
    var title = facility ? facility.name : '（该场馆已从数据中移除，取消后不可恢复）';
    var detail = facility ? D.areaById(facility.areaId).name + ' · ' + facility.openFrom + '–' + facility.openTo : '数据中已无此场馆';
    var $li = $('<li class="list-group-item d-flex justify-content-between align-items-center gap-2 px-0"></li>');
    var $text = $('<div></div>').append(
      $('<span class="d-block"></span>').text((index + 1) + '. ' + title)
    ).append(
      $('<span class="booking-slot"></span>').text((b.slot || '未选时段') + ' · 提交于 ' + (b.createdAt || '未知'))
    ).append(
      $('<span class="d-block small text-secondary"></span>').text(detail)
    );
    var $ops = $('<div class="d-flex gap-1 flex-shrink-0"></div>');
    if (facility) {
      $ops.append($('<button class="btn btn-sm btn-outline-primary edit-btn" type="button">修改时段</button>').data('id', b.id));
    }
    $ops.append($('<button class="btn btn-sm btn-outline-danger del-btn" type="button">取消</button>').data('id', b.id));
    return $li.append($text).append($ops);
  }

  function renderMyBookings() {
    var list = D.myBookings();
    var $ul = C.$('#myBookingList').empty();
    if (!list.length) {
      $ul.append('<li class="list-group-item text-secondary small px-0">还没有预约记录。用上面的表单选场馆与时段，或在场馆列表里点"预约此馆"。</li>');
    } else {
      list.forEach(function (b, i) { $ul.append(bookingRow(b, i)); });
    }
    C.$('#myBookingState').text('本机共 ' + list.length + ' 条预约，最多同时保留 ' + D.MAX_MY_BOOKINGS
      + ' 条；这些记录只影响你浏览器里看到的数字，不会改动 JSON 文件。');
    if (state.editingId) {
      C.$('#submitBtn').text('保存修改');
      C.$('#cancelEditBtn').removeClass('d-none');
    } else {
      C.$('#submitBtn').text('添加预约');
      C.$('#cancelEditBtn').addClass('d-none');
    }
  }

  function nextId() {
    return 'b' + Date.now().toString(36) + Math.floor(Math.random() * 1000);
  }

  function stamp() {
    var now = new Date();
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return now.getFullYear() + '-' + p(now.getMonth() + 1) + '-' + p(now.getDate())
      + ' ' + p(now.getHours()) + ':' + p(now.getMinutes());
  }

  /* 一条提交要过的六道校验：场馆存在且可约 → 时段合法 → 未选不做拦截 →
     与自己的记录不重复 → 该时段还有名额 → 总数不超上限。任何一步失败都给出可执行的下一步提示。 */
  function validate(facilityIdText, slot, list, editingId) {
    if (!facilityIdText) return { error: '请先选择要预约的场馆，再选择时段。' };
    if (!slot) return { error: '请先选择时段。若时段下拉框是灰的，说明该场馆今日没有可预约的整点时段。' };
    var facility = D.facilityById(facilityIdText);
    if (!facility) return { error: '编号 ' + facilityIdText + ' 的场馆已不在数据中，请重新选择。' };
    if (!facility.bookable || facility.status !== 'open') {
      return { error: facility.name + ' ' + (facility.status === 'open' ? '为自由进场场馆，无需预约。' : '本学期暂停开放，不能预约。') };
    }
    if (D.availableSlots(facility).indexOf(slot) === -1) {
      return { error: facility.name + ' 在 ' + slot + ' 不开放（开放区间为 ' + facility.openFrom + '–' + facility.openTo + '），请换时段。' };
    }
    var duplicated = list.filter(function (b) {
      return b.id !== editingId && String(b.facilityId) === String(facility.id) && b.slot === slot;
    });
    if (duplicated.length) {
      return { error: '该场馆的 ' + slot + ' 时段你已经约过了，请换一个时段或先取消原记录。' };
    }
    var left = D.stats(facility).remainingOf(slot);
    if (left <= 0) {
      return { error: facility.name + ' 的 ' + slot + ' 名额已满（容量 ' + facility.capacity + ' 人），请换一个时段。' };
    }
    if (!editingId && list.length >= D.MAX_MY_BOOKINGS) {
      return { error: '最多保留 ' + D.MAX_MY_BOOKINGS + ' 条练习预约，请先取消一条再添加。' };
    }
    return { facility: facility };
  }

  function submitBooking() {
    var facilityIdText = C.$('#venuePick').val();
    var slot = C.$('#slotPick2').val();
    var list = D.myBookings();
    var check = validate(facilityIdText, slot, list, state.editingId);
    if (check.error) {
      C.notify('danger', check.error);
      return;
    }
    if (state.editingId) {
      var idx = -1;
      list.forEach(function (b, i) { if (b.id === state.editingId) idx = i; });
      if (idx === -1) {
        C.notify('warning', '要修改的预约记录已经不在了（可能在另一个标签页里取消过），已退出修改状态。');
        state.editingId = null;
        renderMyBookings();
        return;
      }
      list[idx] = { id: list[idx].id, facilityId: check.facility.id, slot: slot, createdAt: stamp() };
      if (D.saveMyBookings(list)) {
        /* 剩余名额要在保存之后再算一次：保存前算会把"我自己这一条"漏掉，显示成多 1 个名额 */
        C.notify('success', '已改为：' + check.facility.name + ' ' + slot + '，该时段现在还剩 '
          + D.stats(check.facility).remainingOf(slot) + ' 个名额。');
        state.editingId = null;
      }
    } else {
      list.push({ id: nextId(), facilityId: check.facility.id, slot: slot, createdAt: stamp() });
      if (D.saveMyBookings(list)) {
        C.notify('success', '已添加预约：' + check.facility.name + ' ' + slot + '，该时段还剩 '
          + D.stats(check.facility).remainingOf(slot) + ' 个名额。刷新页面后仍在。');
      }
    }
    renderAll();
  }

  function startEdit(id) {
    var list = D.myBookings();
    var hit = list.filter(function (b) { return b.id === id; })[0];
    if (!hit) {
      C.notify('warning', '没找到这条预约记录，可能已被取消，请刷新页面。');
      return;
    }
    state.editingId = id;
    C.$('#venuePick').val(String(hit.facilityId));
    fillSlotPick(String(hit.facilityId), hit.slot);
    C.$('#bookingHint').text('修改模式：为该预约换一个新时段，保存后原时段名额立即释放。');
    renderMyBookings();
    C.$('html, body').animate({ scrollTop: C.$('#bookingForm').offset().top - 90 }, 200);
    C.$('#slotPick2').trigger('focus');
  }

  function removeBooking(id) {
    var list = D.myBookings();
    var hit = list.filter(function (b) { return b.id === id; })[0];
    if (!hit) {
      C.notify('warning', '这条预约已经不在了，列表已刷新。');
      renderList();
      return;
    }
    var rest = list.filter(function (b) { return b.id !== id; });
    if (D.saveMyBookings(rest)) {
      var facility = D.facilityById(hit.facilityId);
      C.notify('success', '已取消预约：' + (facility ? facility.name : '该场馆') + ' ' + hit.slot + '，名额已释放。');
      if (state.editingId === id) state.editingId = null;
      renderAll();
    }
  }

  function pickIntoForm(facilityId) {
    var facility = D.facilityById(facilityId);
    if (!facility) return;
    C.$('#venuePick').val(String(facilityId));
    fillSlotPick(String(facilityId));
    C.$('html, body').animate({ scrollTop: C.$('#bookingForm').offset().top - 90 }, 200);
    C.$('#slotPick2').trigger('focus');
    C.notify('info', '已为你选中「' + facility.name + '」，请在下方预约表单里选择时段后提交。');
  }

  /* 首页与三维页带 #f<id> 跳过来时，滚到那一行并短暂描边 */
  function focusFromHash() {
    var hash = window.location.hash;
    var hit = /^#f(\d+)$/.exec(hash || '');
    if (!hit) return;
    var id = hit[1];
    var $target = C.$('[data-fid="' + id + '"]').first();
    if (!$target.length) {
      C.notify('warning', '链接指向的场馆编号 ' + id + ' 不在当前筛选结果里，请清空条件后重试。');
      return;
    }
    var facility = D.facilityById(id);
    $target.addClass('is-editing');
    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    C.$('html, body').animate({ scrollTop: $target.offset().top - 110 }, 250);
    window.setTimeout(function () { $target.removeClass('is-editing'); }, 4000);
    if (facility) C.notify('info', '已定位到「' + facility.name + '」。' + (facility.bookable && facility.status === 'open' ? '点行末"预约此馆"可直接带入预约表单。' : '该场馆' + (facility.status === 'open' ? '为自由进场。' : '暂停开放。')));
  }

  function applyDefaultView() {
    /* 手机上表格要横向滚动，默认给卡片视图；桌面默认表格。用户仍可手动切换 */
    var preferCards = window.innerWidth < 768;
    C.$(preferCards ? '#viewCards' : '#viewTable').prop('checked', true).trigger('change');
  }

  function bindEvents() {
    C.$('#queryForm').on('change', 'select', renderList);
    C.$('#queryForm').on('input', '#searchInput', renderList);
    C.$('#queryForm').on('input blur', '#minFreeInput', renderList);
    C.$('#clearBtn').on('click', function () {
      C.$('#typeSelect,#areaSelect,#loadSelect,#bookSelect,#sortSelect').val('all');
      C.$('#searchInput').val('');
      C.$('#minFreeInput').val('');
      renderList();
      C.notify('info', '已清空全部查询条件。');
    });
    C.$('input[name="viewMode"]').on('change', function () {
      var cards = C.$('input[name="viewMode"]:checked').val() === 'cards';
      C.$('#tableWrap').toggleClass('d-none', cards);
      C.$('#cardsWrap').toggleClass('d-none', !cards);
    });

    C.$('#venueBody').on('click', '.pick-btn', function () { pickIntoForm($(this).data('id')); });
    C.$('#cardsWrap').on('click', '.pick-btn', function () { pickIntoForm($(this).data('id')); });

    C.$('#venuePick').on('change', function () { fillSlotPick($(this).val()); });
    C.$('#bookingForm').on('submit', function (e) { e.preventDefault(); submitBooking(); });
    C.$('#myBookingList').on('click', '.edit-btn', function () { startEdit($(this).data('id')); });
    C.$('#myBookingList').on('click', '.del-btn', function () { removeBooking($(this).data('id')); });
    C.$('#cancelEditBtn').on('click', function () {
      state.editingId = null;
      C.$('#bookingHint').text('选择场馆后才会列出可约时段。同一场馆同一时段只能约一条，最多保留 5 条。');
      renderMyBookings();
      C.notify('info', '已退出修改模式，预约记录保持不变。');
    });
  }

  function renderAll() {
    renderList();
    fillVenuePick();
    fillSlotPick(C.$('#venuePick').val(), C.$('#slotPick2').val());
    renderMyBookings();
  }

  function boot() {
    fillFilterOptions();
    renderAll();
    bindEvents();
    /* 默认视图要在事件绑定之后触发，否则 change 回调还没挂上 */
    applyDefaultView();
    focusFromHash();
  }

  C.ready(function () {
    C.bindSharedUi();
    D.load(boot);
  });

})(window.Campus, window.CampusData);
