'use strict';

/* statistics.js —— 使用数据分析：三类 Chart.js 图表 + 筛选联动 + 数据一致性自检。
   约定：图表只在首次创建实例，之后改条件只换 data 并 update()，避免重复初始化造成闪烁与内存泄漏。 */

(function (C, D) {

  var charts = { week: null, type: null, rank: null };
  var TYPE_COLORS = { 球类: '#2f6f8f', 水上: '#3f88b0', 田径: '#c86b3c', 综合: '#6a8f6f', 健身: '#d9a441' };

  function readFilter() {
    return {
      area: C.$('#areaFilter').val() || 'all',
      type: C.$('#typeFilter').val() || 'all',
      top: Number(C.$('#topCount').val()) || 8,
      bookableOnly: C.$('#bookableOnly').is(':checked')
    };
  }

  /* 参与统计的场馆集合：先按"是否只统计可预约"收窄，再按校区与类型收窄 */
  function filteredFacilities(f) {
    return D.facilityList().filter(function (x) {
      if (f.bookableOnly && !(x.bookable && x.status === 'open')) return false;
      if (!f.bookableOnly && x.status !== 'open') return false;
      if (f.area !== 'all' && x.areaId !== f.area) return false;
      if (f.type !== 'all' && x.type !== f.type) return false;
      return true;
    });
  }

  function statEcho(f) {
    var scope = [];
    scope.push(f.area === 'all' ? '全校区' : D.areaById(f.area).name);
    scope.push(f.type === 'all' ? '全部类型' : f.type);
    scope.push(f.bookableOnly ? '仅支持线上预约的场馆' : '全部开放场馆（含自由进场）');
    C.$('#statEcho').text('当前口径：' + scope.join(' · ') + '。'
      + '折线图的 history 表只记录到校区粒度，因此类型筛选不作用于折线；'
      + '且自由进场场馆没有预约记录，折线的今日点始终只含有预约记录的场馆——'
      + '取消勾选只会让环形图与条形图把自由进场场馆按 0 人次计入，折线不变。');
  }

  /* ---------- 折线图：近 7 天各校区预约人次 ---------- */
  function weekData(f) {
    var series = D.weekSeries();
    var areas = D.areaList().filter(function (a) { return f.area === 'all' || a.id === f.area; });
    return {
      labels: series.map(function (d) { return d.label; }),
      datasets: areas.map(function (a) {
        return {
          label: a.name,
          data: series.map(function (d) { return Number(d.byArea[a.id]) || 0; }),
          borderColor: a.color,
          backgroundColor: a.color + '22',
          pointRadius: series.map(function (d) { return d.isToday ? 6 : 3; }),
          pointStyle: series.map(function (d) { return d.isToday ? 'rectRot' : 'circle'; }),
          borderWidth: 2,
          tension: 0.25
        };
      }),
      series: series
    };
  }

  function weekStatsText(f, week) {
    var totals = week.series.map(function (d) {
      return f.area === 'all' ? d.total : (Number(d.byArea[f.area]) || 0);
    });
    var sum = totals.reduce(function (s, v) { return s + v; }, 0);
    var max = Math.max.apply(null, totals);
    var maxIndex = totals.indexOf(max);
    var today = totals[totals.length - 1];
    return '七日合计 ' + C.num(sum) + ' 人次；日均 ' + C.num(Math.round(sum / (totals.length || 1)))
      + ' 人次；最高是 ' + week.series[maxIndex].label + '（' + C.num(max) + ' 人次）；'
      + '今日 ' + C.num(today) + ' 人次（统计截至 ' + (D.meta().dataCutoff || '未知') + '，未过完一天，一般低于上一个周末）。'
      + '今日那一列由 slotBookings 逐场馆现算，与本页条形图、场馆页表格完全同源。';
  }

  /* ---------- 环形图：类型构成 ---------- */
  function typeData(f) {
    var list = filteredFacilities(f);
    var counts = {};
    list.forEach(function (x) { counts[x.type] = (counts[x.type] || 0) + 1; });
    var keys = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; });
    return {
      labels: keys,
      datasets: [{
        label: '场馆数量（个）',
        data: keys.map(function (k) { return counts[k]; }),
        backgroundColor: keys.map(function (k) { return TYPE_COLORS[k] || '#8aa6b5'; }),
        borderWidth: 1
      }],
      total: list.length
    };
  }

  /* ---------- 条形图：今日预约人次排行 ---------- */
  function rankData(f) {
    var list = filteredFacilities(f);
    var rows = list.map(function (x) {
      return { name: x.name, booked: x.bookable && x.status === 'open' ? D.stats(x).bookedToday : 0 };
    }).sort(function (a, b) { return b.booked - a.booked; }).slice(0, f.top);
    return {
      labels: rows.map(function (r) { return r.name; }),
      datasets: [{
        label: '今日预约人次（人次）',
        data: rows.map(function (r) { return r.booked; }),
        backgroundColor: '#2f6f8f',
        borderRadius: 3
      }],
      rows: rows
    };
  }

  /* 环形图中心写总数：Chart.js 没有内置的中心文本，注册一个只在环形图用的行内插件 */
  var centerNumber = {
    id: 'centerNumber',
    afterDraw: function (chart, args, opts) {
      if (!opts || !opts.value) return;
      var ctx = chart.ctx;
      var meta = chart.getDatasetMeta(0);
      if (!meta || !meta.data || !meta.data.length) return;
      var cx = (chart.chartArea.left + chart.chartArea.right) / 2;
      var cy = (chart.chartArea.top + chart.chartArea.bottom) / 2;
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#164a46';
      ctx.font = 'bold 22px system-ui, "Microsoft YaHei", sans-serif';
      ctx.fillText(String(opts.value), cx, cy - 6);
      ctx.font = '12px system-ui, "Microsoft YaHei", sans-serif';
      ctx.fillStyle = '#5c6b66';
      ctx.fillText('个场馆', cx, cy + 14);
      ctx.restore();
    }
  };

  function baseScales(yTitle, xTitle) {
    return {
      y: { beginAtZero: true, title: { display: true, text: yTitle, font: { size: 11 } } },
      x: { title: { display: true, text: xTitle, font: { size: 11 } }, ticks: { autoSkip: false, maxRotation: 60, minRotation: 0 } }
    };
  }

  function createCharts(f) {
    var week = weekData(f);
    var types = typeData(f);
    var rank = rankData(f);

    charts.week = new window.Chart(document.getElementById('weekChart'), {
      type: 'line',
      data: { labels: week.labels, datasets: week.datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
          tooltip: { callbacks: { label: function (ctx) { return ctx.dataset.label + '：' + C.num(ctx.parsed.y) + ' 人次'; } } }
        },
        scales: baseScales('人次／天', '统计日')
      }
    });

    charts.type = new window.Chart(document.getElementById('typeChart'), {
      type: 'doughnut',
      plugins: [centerNumber],
      data: { labels: types.labels, datasets: types.datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '58%',
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
          centerNumber: { value: types.total },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                var total = ctx.dataset.data.reduce(function (s, v) { return s + v; }, 0);
                return ctx.label + '：' + ctx.parsed + ' 个（占 ' + C.pct(total ? ctx.parsed / total : 0) + '）';
              }
            }
          }
        }
      }
    });

    charts.rank = new window.Chart(document.getElementById('rankChart'), {
      type: 'bar',
      data: { labels: rank.labels, datasets: rank.datasets },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: function (ctx) { return '今日 ' + C.num(ctx.parsed.x) + ' 人次'; } } }
        },
        scales: {
          x: { beginAtZero: true, title: { display: true, text: '人次', font: { size: 11 } } },
          y: { ticks: { font: { size: 10 } } }
        }
      }
    });
  }

  /* 三张图下方的统计结论文字：与图表共用同一批计算结果，不另算一遍 */
  function renderStatTexts(f) {
    var week = weekData(f);
    var types = typeData(f);
    var rank = rankData(f);
    C.$('#weekStat').text(weekStatsText(f, week));
    C.$('#typeStat').text('参与分组计数 ' + types.total + ' 个场馆，类型数 ' + types.labels.length
      + ' 类；各扇区之和 ' + types.datasets[0].data.reduce(function (s, v) { return s + v; }, 0)
      + '，与场馆总数一致才算通过。');
    var shownSum = rank.rows.reduce(function (s, r) { return s + r.booked; }, 0);
    var scopeList = filteredFacilities(f);
    var allSum = scopeList.reduce(function (s, x) {
      return s + (x.bookable && x.status === 'open' ? D.stats(x).bookedToday : 0);
    }, 0);
    var tail = rank.rows.length < scopeList.length
      ? '两者之差 ' + C.num(allSum - shownSum) + ' 人次即未进入前 ' + f.top + ' 名的 ' + (scopeList.length - rank.rows.length) + ' 个场馆。'
      : '当前口径下共 ' + scopeList.length + ' 个场馆，不足前 ' + f.top + ' 名，已全部列出。';
    C.$('#rankStat').text('条形图列出前 ' + rank.rows.length + ' 名，合计 ' + C.num(shownSum) + ' 人次；'
      + '当前口径下全部 ' + scopeList.length + ' 个场馆合计 ' + C.num(allSum) + ' 人次；' + tail);
  }

  function applyData(f) {
    var week = weekData(f);
    var types = typeData(f);
    var rank = rankData(f);

    charts.week.data.labels = week.labels;
    charts.week.data.datasets = week.datasets;
    charts.week.update();

    charts.type.data.labels = types.labels;
    charts.type.data.datasets = types.datasets;
    charts.type.options.plugins.centerNumber.value = types.total;
    charts.type.update();

    charts.rank.data.labels = rank.labels;
    charts.rank.data.datasets = rank.datasets;
    charts.rank.update();

    renderStatTexts(f);
  }

  function renderCharts(f) {
    var week = weekData(f);
    var empty = !filteredFacilities(f).length || !week.labels.length;
    if (empty) {
      destroyCharts();
      C.$('.chart-box').html('<div class="chart-fallback">当前筛选口径下没有可统计的场馆，图表暂不渲染。请放宽校区或类型条件。</div>');
      C.notify('info', '筛选后场馆数为 0，三张图都已停用；清空条件即可恢复。');
      C.$('#weekStat,#typeStat,#rankStat').text('');
      return;
    }
    if (!charts.week || !charts.type || !charts.rank) {
      /* 容器可能在上一次"空结果"里被 fallback 文案替换掉，重建一次再画 */
      ensureChartBoxes();
      createCharts(f);
      renderStatTexts(f);
    } else {
      applyData(f);
    }
  }

  /* 空结果时容器里被换成了提示文案，重新筛选时要先把 canvas 放回去，
     否则 Chart 构造时拿不到 canvas 会直接抛异常。按容器 id 重建，不依赖已消失的 canvas。 */
  var BOXES = [
    { box: '#weekBox', canvas: 'weekChart', label: '折线图：近 7 天各校区每日预约人次，单位人次每天' },
    { box: '#typeBox', canvas: 'typeChart', label: '环形图：各运动类型场馆数量占比，单位个' },
    { box: '#rankBox', canvas: 'rankChart', label: '水平条形图：今日各场馆预约人次排行，单位人次' }
  ];

  function ensureChartBoxes() {
    BOXES.forEach(function (b) {
      var $box = C.$(b.box);
      if ($box.find('canvas#' + b.canvas).length) return;
      $box.html($('<canvas></canvas>').attr({ id: b.canvas, role: 'img', 'aria-label': b.label }));
    });
  }

  function destroyCharts() {
    Object.keys(charts).forEach(function (k) {
      if (charts[k]) { charts[k].destroy(); charts[k] = null; }
    });
  }

  function renderChecks() {
    var list = D.consistencyChecks();
    var failed = list.filter(function (c) { return !c.ok; });
    C.$('#checkList').html(list.map(function (c) {
      return '<li class="mb-1">' + (c.ok ? '<span class="ok">通过</span> ' : '<span class="bad">不通过</span> ')
        + C.escape(c.label) + '<span class="text-secondary"> —— ' + C.escape(c.detail) + '</span></li>';
    }).join(''));
    C.$('#checkSummary').text(failed.length
      ? '有 ' + failed.length + ' 项自检未通过，页面顶部的红色提示里写明了具体是哪一条。'
      : '以上 ' + list.length + ' 项全部通过：图表上的每一个数字都能从 data/facilities.json 用另一条独立路径复现。');
    if (failed.length) {
      C.notify('danger', '数据一致性自检未通过：' + failed.map(function (c) { return c.label; }).join('；'), { sticky: true });
    }
  }

  function fillFilterOptions() {
    var types = [];
    D.facilityList().forEach(function (f) { if (types.indexOf(f.type) === -1) types.push(f.type); });
    types.forEach(function (t) { C.$('#typeFilter').append($('<option></option>').val(t).text(t)); });
    D.areaList().forEach(function (a) { C.$('#areaFilter').append($('<option></option>').val(a.id).text(a.name)); });
  }

  function renderSource() {
    var meta = D.meta();
    C.$('#source').text('来源文件：data/facilities.json；当前实际读自：' + D.from()
      + '；数据更新时间 ' + (meta.updatedAt || '未知') + '，今日统计截至 ' + (meta.dataCutoff || '未知') + '。'
      + (meta.source || ''));
    C.$('#sourceRules').text('口径约定：' + (meta.rules || []).join('；') + '。');
  }

  function chartLibMissing() {
    if (window.Chart && typeof window.Chart.register === 'function') return false;
    C.$('.chart-box').html('<div class="chart-fallback">图表库 Chart.js 未能加载（离线或 CDN 被拦截）。'
      + '本页的统计文字与自检结论仍可读，场馆查询与预约功能不受影响。</div>');
    C.notify('danger', '图表库 Chart.js 未能加载：已自动改用仓库内 vendor/chart.umd.min.js 的同版本副本；'
      + '若该文件也不存在，请执行 git restore vendor/ 或重新克隆仓库。', { sticky: true });
    return true;
  }

  function bindEvents() {
    C.$('#statFilterForm').on('change', 'select, input', function () {
      var f = readFilter();
      statEcho(f);
      renderCharts(f);
    });
  }

  function boot() {
    fillFilterOptions();
    renderSource();
    renderChecks();
    var f = readFilter();
    statEcho(f);
    if (chartLibMissing()) {
      C.$('#weekStat,#typeStat,#rankStat').text('图表库不可用，统计结论以文字形式给出。');
      var week = weekData(f);
      C.$('#weekStat').text(weekStatsText(f, week));
      bindEvents();
      return;
    }
    renderCharts(f);
    bindEvents();
  }

  C.ready(function () {
    C.bindSharedUi();
    D.load(boot);
  });

})(window.Campus, window.CampusData);
