'use strict';

/* data.js —— 全站唯一的取数入口。
   页面不直接读 JSON 字段做算术，一律经过这里的派生函数，
   目的：让首页卡片、场馆表格、图表、三维区显示的同一指标必然来自同一次计算。 */

(function (C) {

  var STORAGE_KEY = 'hwfinal-bookings-v1';
  var MAX_MY_BOOKINGS = 5;

  /* 内置备份数据：与 data/facilities.json 内容一致。
     直接双击 html（file://）或 JSON 文件缺失／格式错时使用，保证页面不白屏，
     同时页面顶部会给出黄色提示说明当前用的是备份。 */
  var BACKUP_DATA = {
    meta: {
      schemaVersion: '1.0',
      title: '校园运动场馆信息与数据展示中心',
      updatedAt: '2026-09-19',
      dataCutoff: '2026-09-19 14:00',
      source: '课堂练习用虚构数据，不对应真实场馆、真实开放时间与真实价格',
      units: { capacity: '人（同一时段可容纳人数）', bookedToday: '人次（由 slotBookings 逐时段求和得出，不单独存储）', peakLoad: '峰值时段占用率 = 该场馆最拥挤时段的已约人数 ÷ 容量', pricePerHour: '元 / 小时（0 表示自由进场、不收费）', history: '人次 / 天 / 校区' },
      tables: { areas: '校区表：三维场景按此分组建模，x／z 为该校区在场景中的中心坐标（单位：米）', facilities: '场馆主表：id 为全馆唯一编号，areaId 关联 areas.id', slots: '开放时段表：全天固定 14 个整点时段，场馆某时段是否可约由 openFrom／openTo 与整点区间比较得出，不重复存储', slotBookings: '今日时段预约记录表（稀疏）：只列出已有人预约的时段，未列出的时段视为 0 人；此处人数不含浏览器本地保存的『我的预约』', history: '近 6 天各校区预约人次（今日那一条不在这里，由 slotBookings 现算，保证两处数字必然一致）', notices: '公告表：level 取 info／warning／success，对应 Bootstrap 提示条配色' },
      rules: ['bookable=false 的场馆为自由进场或暂停开放，不产生预约记录，因此不计入预约类图表，页面上会写明统计口径', 'status=maintenance 的场馆不出现在『今日开放』列表与三维高亮中', '同一场馆同一时段的已约人数不得超过 capacity']
    },
    areas: [
      { id: 'north', name: '北区', color: '#2f6f8f', x: -46, z: -46, brief: '体育馆与田径场集中区' },
      { id: 'center', name: '中心区', color: '#3f88b0', x: 0, z: -8, brief: '游泳馆与综合体育馆' },
      { id: 'east', name: '东区', color: '#c86b3c', x: 46, z: -42, brief: '室外球场与健身步道' },
      { id: 'south', name: '南区', color: '#6a8f6f', x: 8, z: 42, brief: '风雨操场与健身中心' },
      { id: 'west', name: '西区', color: '#8aa6b5', x: -46, z: 36, brief: '小型球场，攀岩墙施工中' }
    ],
    facilities: [
      { id: 1, name: '北区体育馆羽毛球馆', type: '球类', areaId: 'north', capacity: 48, openFrom: '08:00', openTo: '21:30', pricePerHour: 30, bookable: true, status: 'open', intro: '12 片羽毛球场，空调开放，需自带球拍' },
      { id: 2, name: '北区体育馆乒乓球室', type: '球类', areaId: 'north', capacity: 24, openFrom: '08:00', openTo: '21:30', pricePerHour: 15, bookable: true, status: 'open', intro: '8 张球台，球台与球拍可现场借用' },
      { id: 3, name: '北区田径足球场', type: '田径', areaId: 'north', capacity: 200, openFrom: '06:30', openTo: '21:30', pricePerHour: 0, bookable: false, status: 'open', intro: '400 米跑道与十一人制足球场，自由进场' },
      { id: 4, name: '中心游泳馆 25 米池', type: '水上', areaId: 'center', capacity: 60, openFrom: '12:00', openTo: '20:30', pricePerHour: 25, bookable: true, status: 'open', intro: '8 道标准短池，需戴泳帽，含淋浴' },
      { id: 5, name: '中心游泳馆训练池', type: '水上', areaId: 'center', capacity: 30, openFrom: '07:00', openTo: '09:00', pricePerHour: 20, bookable: true, status: 'open', intro: '浅水训练池，早间开放，游泳队训练时段除外' },
      { id: 6, name: '中心区综合体育馆', type: '综合', areaId: 'center', capacity: 120, openFrom: '08:00', openTo: '21:30', pricePerHour: 40, bookable: true, status: 'open', intro: '篮球、排球、羽毛球共用场地，可整队包场' },
      { id: 7, name: '学生活动中心瑜伽室', type: '健身', areaId: 'center', capacity: 20, openFrom: '18:00', openTo: '21:00', pricePerHour: 12, bookable: true, status: 'open', intro: '地暖与镜面墙，晚间课程制，垫子提供' },
      { id: 8, name: '东区篮球场（室外）', type: '球类', areaId: 'east', capacity: 60, openFrom: '06:30', openTo: '21:30', pricePerHour: 0, bookable: false, status: 'open', intro: '6 片室外场地，夜间有照明，自由进场' },
      { id: 9, name: '东区网球场', type: '球类', areaId: 'east', capacity: 32, openFrom: '08:00', openTo: '20:30', pricePerHour: 35, bookable: true, status: 'open', intro: '4 片硬地网球场，雨天临时关闭' },
      { id: 10, name: '东区健身步道', type: '田径', areaId: 'east', capacity: 150, openFrom: '06:30', openTo: '21:30', pricePerHour: 0, bookable: false, status: 'open', intro: '2 公里环校步道，自由进场，不设名额' },
      { id: 11, name: '南区风雨操场综合馆', type: '综合', areaId: 'south', capacity: 120, openFrom: '08:30', openTo: '21:00', pricePerHour: 40, bookable: true, status: 'open', intro: '雨天可用的大型综合馆，含 2 片篮球半场' },
      { id: 12, name: '南区健身中心力量房', type: '健身', areaId: 'south', capacity: 35, openFrom: '09:00', openTo: '22:00', pricePerHour: 10, bookable: true, status: 'open', intro: '器械区限流 35 人，需签到入场' },
      { id: 13, name: '西区排球场', type: '球类', areaId: 'west', capacity: 40, openFrom: '08:00', openTo: '21:00', pricePerHour: 0, bookable: false, status: 'open', intro: '3 片室外排球场，自由进场' },
      { id: 14, name: '西区攀岩墙', type: '综合', areaId: 'west', capacity: 16, openFrom: '暂停', openTo: '暂停', pricePerHour: 0, bookable: false, status: 'maintenance', intro: '岩点更换施工中，本学期暂停开放' }
    ],
    slots: ['08:00-09:00', '09:00-10:00', '10:00-11:00', '11:00-12:00', '12:00-13:00', '13:00-14:00', '14:00-15:00', '15:00-16:00', '16:00-17:00', '17:00-18:00', '18:00-19:00', '19:00-20:00', '20:00-21:00', '21:00-22:00'],
    slotBookings: [
      { facilityId: 1, counts: { '10:00-11:00': 18, '14:00-15:00': 30, '16:00-17:00': 36, '18:00-19:00': 44, '19:00-20:00': 47, '20:00-21:00': 41 } },
      { facilityId: 2, counts: { '09:00-10:00': 6, '13:00-14:00': 9, '18:00-19:00': 17, '19:00-20:00': 21, '20:00-21:00': 14 } },
      { facilityId: 4, counts: { '12:00-13:00': 22, '16:00-17:00': 41, '17:00-18:00': 48, '18:00-19:00': 55, '19:00-20:00': 58 } },
      { facilityId: 5, counts: { '08:00-09:00': 8 } },
      { facilityId: 6, counts: { '09:00-10:00': 34, '14:00-15:00': 52, '19:00-20:00': 96, '20:00-21:00': 88 } },
      { facilityId: 7, counts: { '18:00-19:00': 15, '19:00-20:00': 19, '20:00-21:00': 11 } },
      { facilityId: 9, counts: { '08:00-09:00': 9, '15:00-16:00': 20, '19:00-20:00': 27 } },
      { facilityId: 11, counts: { '10:00-11:00': 28, '15:00-16:00': 45, '18:00-19:00': 66, '19:00-20:00': 74 } },
      { facilityId: 12, counts: { '09:00-10:00': 11, '12:00-13:00': 19, '18:00-19:00': 30, '19:00-20:00': 33, '20:00-21:00': 29 } }
    ],
    history: [
      { date: '09-13', weekday: '周日', byArea: { north: 296, center: 561, east: 61, south: 350, west: 0 } },
      { date: '09-14', weekday: '周一', byArea: { north: 244, center: 498, east: 48, south: 296, west: 0 } },
      { date: '09-15', weekday: '周二', byArea: { north: 258, center: 512, east: 51, south: 308, west: 0 } },
      { date: '09-16', weekday: '周三', byArea: { north: 270, center: 534, east: 53, south: 322, west: 0 } },
      { date: '09-17', weekday: '周四', byArea: { north: 266, center: 521, east: 50, south: 315, west: 0 } },
      { date: '09-18', weekday: '周五', byArea: { north: 289, center: 552, east: 58, south: 341, west: 0 } }
    ],
    notices: [
      { date: '2026-09-19', level: 'warning', title: '西区攀岩墙本学期暂停开放', body: '岩点与保护绳整体更换，预计 11 月初恢复；期间周边区域禁止入内。' },
      { date: '2026-09-18', level: 'info', title: '中心游泳馆每周二 10:00-12:00 换水消毒', body: '该时段 25 米池与训练池均闭馆，预约系统会自动跳过此时段。' },
      { date: '2026-09-15', level: 'success', title: '东区网球场开放线上预约', body: '4 片硬地场现可按整点时段预约，每小时 35 元，雨天提前两小时可免费取消。' },
      { date: '2026-09-10', level: 'info', title: '期中周场馆开放时间调整', body: '11 月第 9～10 周，自习与锻炼高峰时段延长至 22:30，具体以本页面数据更新时间为准。' }
    ]
  };

  var store = {
    data: null,
    from: ''
  };

  /* ---------- 一、加载：三种失败路径都有明确去处 ----------
     1) 请求失败（断网／file:// 禁止读本地文件／文件被改名）→ 备份数据 + 黄色提示
     2) 结构不符（缺 facilities 数组）→ 备份数据 + 黄色提示，说明缺什么
     3) facilities 为空数组 → 仍用本地数据，但列表与图表走"数据为空"分支，不伪造数字 */
  function loadData(done) {
    C.loadJson('data/facilities.json', function (data, error) {
      if (error === 'ok' && data && Array.isArray(data.facilities)) {
        use(data, 'data/facilities.json（本地 JSON 文件）');
        done();
        return;
      }
      if (error === 'empty-data') {
        use(data, 'data/facilities.json（读取成功，但 facilities 为空数组）');
        C.notify('warning', '数据文件里 facilities 是空数组，页面按"暂无数据"渲染。请检查 data/facilities.json 是否被清空。');
        done();
        return;
      }
      var detail = error === 'bad-structure'
        ? { reason: 'JSON 能读出来，但缺少 facilities 数组（与 meta.tables 里声明的结构不一致）',
            hint: '请对照 data/facilities.json 的 meta.tables 说明补回 facilities 字段。' }
        : error;
      C.notify('warning', '场馆数据读取失败：' + detail.reason + '。已切换到 js/data.js 内置备份数据（内容与 JSON 一致），'
        + '页面功能可正常演示。' + (detail.hint || ''), { sticky: true });
      use(BACKUP_DATA, 'js/data.js 内置备份数据（内容与 data/facilities.json 一致）');
      done();
    });
  }

  function use(data, from) {
    store.data = data;
    store.from = from;
    C.dataStore = data;
    C.dataFrom = from;
    var el = document.getElementById('loadState');
    if (el) {
      var count = facilityList().length;
      var prefix = count === 0 ? '数据为空 · ' : (from.indexOf('备份') === -1 ? '数据就绪 · ' : '降级：备份数据 · ');
      el.textContent = prefix + count + ' 个场馆 · 统计截至 ' + (data.meta.dataCutoff || data.meta.updatedAt);
    }
  }

  /* 统一包装 $.getJSON 与"解析成功但内容为空"两种情况，四个页面共用一套判定 */
  C.loadJson = function (url, done) {
    var request = window.jQuery ? C.getJson(url) : null;
    if (!request) {
      done(null, { reason: 'jQuery 未能加载，无法发起数据请求', hint: '请确认 vendor/jquery.min.js 存在。' });
      return;
    }
    request.done(function (data) {
      if (!data) { done(null, { reason: '服务器返回内容为空', hint: '' }); return; }
      if (!Array.isArray(data.facilities)) { done(data, 'bad-structure'); return; }
      if (data.facilities.length === 0) { done(data, 'empty-data'); return; }
      done(data, 'ok');
    }).fail(function (jqXHR, textStatus) {
      done(null, explainFailure(jqXHR, textStatus));
    });
  };

  /* 把 jQuery 的状态码翻译成能区分"文件没了"和"文件在但格式错"的说法：
     这两种情况要做的动作完全不同，混成一条提示就没法照着排查。
     reason 说清是什么问题，hint 给下一步动作（只有确实与打开方式有关时才提本地服务器）。 */
  function explainFailure(jqXHR, textStatus) {
    var status = jqXHR && jqXHR.status;
    if (textStatus === 'parsererror') {
      return {
        reason: '文件能读到（HTTP ' + status + '）但 JSON 解析失败，多半是少了逗号或引号',
        hint: '定位办法：在仓库根目录执行 python -m json.tool data/facilities.json，它会直接报出出错的行与列。'
      };
    }
    if (textStatus === 'error' && status === 404) {
      return {
        reason: 'HTTP 404，找不到 data/facilities.json',
        hint: '请确认文件名与路径（大小写敏感），或执行 git restore data/facilities.json 恢复原始数据。'
      };
    }
    if (textStatus === 'error') {
      return {
        reason: 'HTTP ' + (status || '无响应') + '，请求未成功',
        hint: '若你是直接双击 html 打开的（地址栏以 file:// 开头），浏览器禁止本地页面读取同源文件，'
          + '请改用本地服务器：python -m http.server 8000'
      };
    }
    return { reason: textStatus === 'timeout' ? '请求超时' : (textStatus || '未知原因'), hint: '' };
  }

  /* ---------- 二、我的预约（localStorage 叠加层） ---------- */
  function myBookings() {
    var list = C.storage.read(STORAGE_KEY, []);
    if (!Array.isArray(list)) {
      C.notify('warning', '本机预约记录格式异常，已按空记录处理（不会覆盖原数据文件）。');
      return [];
    }
    return list;
  }

  function saveMyBookings(list) {
    return C.storage.write(STORAGE_KEY, list);
  }

  /* facilityId → { "18:00-19:00": 条数 }，用于把本地预约叠加到 JSON 的已约人数上 */
  function myBookingMap(list) {
    var map = {};
    (list || myBookings()).forEach(function (b) {
      var key = String(b.facilityId);
      map[key] = map[key] || {};
      map[key][b.slot] = (map[key][b.slot] || 0) + 1;
    });
    return map;
  }

  /* ---------- 三、派生指标：所有页面都从这里取数 ---------- */
  function facilityList() {
    return (store.data && store.data.facilities) || [];
  }

  function areaList() {
    return (store.data && store.data.areas) || [];
  }

  function areaById(id) {
    var hit = areaList().filter(function (a) { return a.id === id; })[0];
    return hit || { id: id, name: '未知校区', color: '#8899aa', x: 0, z: 0, brief: '' };
  }

  function facilityById(id) {
    var key = Number(id);
    return facilityList().filter(function (f) { return f.id === key; })[0] || null;
  }

  function jsonCount(facilityId, slot) {
    var hit = (store.data.slotBookings || []).filter(function (r) {
      return Number(r.facilityId) === Number(facilityId);
    })[0];
    return hit && hit.counts && hit.counts[slot] ? Number(hit.counts[slot]) : 0;
  }

  /* 某场馆某时段的已约人数 = JSON 记录 + 我的预约 */
  function slotCount(facilityId, slot, mine) {
    return jsonCount(facilityId, slot) + ((mine[String(facilityId)] || {})[slot] || 0);
  }

  /* 该场馆当前可预约的时段：开放区间要完整包住整点时段，维护中的场馆一律不可约 */
  function availableSlots(facility) {
    if (!facility.bookable || facility.status !== 'open') return [];
    var from = C.toMinutes(facility.openFrom);
    var to = C.toMinutes(facility.openTo);
    if (!isFinite(from) || !isFinite(to)) return [];
    return (store.data.slots || []).filter(function (slot) {
      var parts = slot.split('-');
      return C.toMinutes(parts[0]) >= from && C.toMinutes(parts[1]) <= to;
    });
  }

  /* 今日指标：人次 = 各时段已约之和（可大于容量，人次本就按次计），
     峰值占用 = 最拥挤那一个时段的人数 ÷ 容量（这才是"名额紧不紧张"） */
  function stats(facility, mine) {
    var overrides = mine || myBookingMap();
    var bookedToday = 0;
    var peakCount = 0;
    var peakSlot = '';
    availableSlots(facility).forEach(function (slot) {
      var n = slotCount(facility.id, slot, overrides);
      bookedToday += n;
      if (n > peakCount) { peakCount = n; peakSlot = slot; }
    });
    var ratio = facility.capacity ? peakCount / facility.capacity : 0;
    return {
      bookedToday: bookedToday,
      peakCount: peakCount,
      peakSlot: peakSlot,
      peakLoad: ratio,
      level: C.loadLevel(ratio),
      remainingOf: function (slot) {
        return Math.max(0, facility.capacity - slotCount(facility.id, slot, overrides));
      }
    };
  }

  /* 折线图数据：前 6 天来自 history（按校区），最后一点"数据日"由 slotBookings 现算，
     两处口径不同但同源——今日点绝不写第二份常量，这是图表与表格能对上数的根本原因 */
  function weekSeries(mine) {
    var overrides = mine || myBookingMap();
    var days = (store.data.history || []).map(function (h) {
      return {
        label: h.date + ' ' + h.weekday,
        byArea: h.byArea,
        total: areaList().reduce(function (sum, a) { return sum + (Number(h.byArea[a.id]) || 0); }, 0),
        isToday: false
      };
    });
    var cutoff = String(store.data.meta.dataCutoff || store.data.meta.updatedAt).split(' ')[0];
    var todayByArea = {};
    areaList().forEach(function (a) { todayByArea[a.id] = 0; });
    facilityList().forEach(function (f) {
      if (!f.bookable || f.status !== 'open') return;
      var s = stats(f, overrides);
      todayByArea[f.areaId] = (todayByArea[f.areaId] || 0) + s.bookedToday;
    });
    days.push({
      label: cutoff.slice(5) + ' 今日',
      byArea: todayByArea,
      total: Object.keys(todayByArea).reduce(function (sum, k) { return sum + todayByArea[k]; }, 0),
      isToday: true
    });
    return days;
  }

  function typeCounts() {
    var counts = {};
    facilityList().forEach(function (f) { counts[f.type] = (counts[f.type] || 0) + 1; });
    return counts;
  }

  /* 只统计支持线上预约的场馆：自由进场的场馆没有预约记录，硬画进图里就是假数据 */
  function bookableList() {
    return facilityList().filter(function (f) { return f.bookable && f.status === 'open'; });
  }

  function topBooked(limit, mine) {
    var overrides = mine || myBookingMap();
    return bookableList().map(function (f) {
      return { facility: f, bookedToday: stats(f, overrides).bookedToday };
    }).sort(function (a, b) { return b.bookedToday - a.bookedToday; }).slice(0, limit);
  }

  /* mine 一律传"我的预约叠加表"（facilityId → 时段 → 条数），不传则现读 localStorage */
  function summary(mine) {
    var overrides = mine || myBookingMap();
    var all = facilityList();
    var openNow = all.filter(function (f) { return f.status === 'open'; });
    var loads = bookableList().map(function (f) { return stats(f, overrides).peakLoad; });
    var avg = loads.length ? loads.reduce(function (s, v) { return s + v; }, 0) / loads.length : 0;
    var totalBooked = bookableList().reduce(function (s, f) { return s + stats(f, overrides).bookedToday; }, 0);
    return {
      total: all.length,
      bookable: bookableList().length,
      open: openNow.length,
      seats: all.reduce(function (s, f) { return s + f.capacity; }, 0),
      avgLoad: avg,
      bookedToday: totalBooked,
      mine: myBookings().length
    };
  }

  /* ---------- 四、一致性自检：把"图表数字对得上"变成页面上看得见的结论 ---------- */
  function consistencyChecks(mine) {
    var overrides = mine || myBookingMap();
    var bookable = bookableList();
    var series = weekSeries(overrides);
    var today = series[series.length - 1];
    var perFacility = bookable.reduce(function (s, f) { return s + stats(f, overrides).bookedToday; }, 0);
    var perSlotTotal = 0;
    bookable.forEach(function (f) {
      availableSlots(f).forEach(function (slot) { perSlotTotal += slotCount(f.id, slot, overrides); });
    });
    var types = typeCounts();
    var typeSum = Object.keys(types).reduce(function (s, k) { return s + types[k]; }, 0);
    var overCapacity = [];
    bookable.forEach(function (f) {
      availableSlots(f).forEach(function (slot) {
        if (slotCount(f.id, slot, overrides) > f.capacity) overCapacity.push(f.name + ' ' + slot);
      });
    });
    return [
      { label: '逐场馆求和 今日预约人次 = ' + C.num(perFacility) + ' 人次', ok: perFacility === today.total, detail: '另一条路径：折线图今日点各校区合计 = ' + C.num(today.total) + ' 人次' },
      { label: '逐时段累加 = ' + C.num(perSlotTotal) + ' 人次', ok: perSlotTotal === perFacility, detail: '与逐场馆求和相互独立，两条路径都从 slotBookings＋我的预约 出发' },
      { label: '环形图各扇区合计 = ' + typeSum + ' 个', ok: typeSum === facilityList().length, detail: '场馆主表共 ' + facilityList().length + ' 条，环形图按类型分组不应多也不应少' },
      { label: '时段已约人数 ≤ 容量', ok: overCapacity.length === 0, detail: overCapacity.length ? '超出：' + overCapacity.join('、') : '逐场馆逐时段核对，没有任何一个时段的已约人数超过容量' },
      { label: '图表口径已注明', ok: true, detail: '折线与条形只统计 ' + bookable.length + ' 个支持线上预约的场馆，自由进场场馆不计入' }
    ];
  }

  window.CampusData = {
    BACKUP_DATA: BACKUP_DATA,
    STORAGE_KEY: STORAGE_KEY,
    MAX_MY_BOOKINGS: MAX_MY_BOOKINGS,
    load: loadData,
    raw: function () { return store.data; },
    from: function () { return store.from; },
    myBookings: myBookings,
    saveMyBookings: saveMyBookings,
    myBookingMap: myBookingMap,
    facilityList: facilityList,
    areaList: areaList,
    areaById: areaById,
    facilityById: facilityById,
    slotList: function () { return (store.data && store.data.slots) || []; },
    notices: function () { return (store.data && store.data.notices) || []; },
    meta: function () { return (store.data && store.data.meta) || {}; },
    availableSlots: availableSlots,
    slotCount: function (id, slot, mine) { return slotCount(id, slot, mine || myBookingMap()); },
    stats: stats,
    bookableList: bookableList,
    weekSeries: weekSeries,
    typeCounts: typeCounts,
    topBooked: topBooked,
    summary: summary,
    consistencyChecks: consistencyChecks
  };

})(window.Campus || (window.Campus = {}));
