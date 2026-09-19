'use strict';

/* venue3d.js —— Three.js 校园场馆三维场景。
   三条视觉通道各表示一件事，互不混用：
     建筑高度 ＝ 容量（人）   建筑颜色 ＝ 运动类型   屋顶指示灯颜色 ＝ 峰值占用分档（自由进场与暂停开放为灰色）
   数据一律取 CampusData（与首页、场馆页、分析页同一份派生函数），本页不写第二个数字来源。 */

(function (C, D) {

  var TYPE_COLOR = { 球类: 0x2f6f8f, 水上: 0x3f88b0, 田径: 0xc86b3c, 综合: 0x6a8f6f, 健身: 0xd9a441 };
  var TYPE_HEX = { 球类: '#2f6f8f', 水上: '#3f88b0', 田径: '#c86b3c', 综合: '#6a8f6f', 健身: '#d9a441' };
  var GRAY = 0xadb5bd;
  var HOME = { radius: 132, theta: Math.PI / 4, phi: Math.PI / 3.15 };

  var scene, camera, renderer, stage;
  var buildings = [];          // 可拾取的建筑主体
  var labels = [];             // 校区名称标签
  var orbit = { radius: HOME.radius, theta: HOME.theta, phi: HOME.phi, target: null, desired: null };
  var rafId = 0;
  var selected = null;

  /* ---------- 一、场景骨架 ---------- */
  function setupScene() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xdfeaec);
    scene.fog = new THREE.Fog(0xdfeaec, 190, 460);

    camera = new THREE.PerspectiveCamera(52, 1, 0.1, 900);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    stage.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.66));
    var sun = new THREE.DirectionalLight(0xffffff, 0.8);
    sun.position.set(70, 110, 50);
    sun.castShadow = true;
    sun.shadow.camera.left = -170;
    sun.shadow.camera.right = 170;
    sun.shadow.camera.top = 170;
    sun.shadow.camera.bottom = -170;
    sun.shadow.mapSize.set(1024, 1024);
    scene.add(sun);

    var ground = new THREE.Mesh(
      new THREE.PlaneGeometry(460, 460),
      new THREE.MeshLambertMaterial({ color: 0xc3cfc0 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    /* 中央广场：给场景一个"校门"方位参照，也是校区指引线的起点 */
    var plaza = new THREE.Mesh(new THREE.CylinderGeometry(13, 13, 0.6, 32), new THREE.MeshLambertMaterial({ color: 0xe8e3d5 }));
    plaza.position.set(0, 0.3, 0);
    plaza.receiveShadow = true;
    scene.add(plaza);

    orbit.target = new THREE.Vector3(0, 8, 0);
    orbit.desired = orbit.target.clone();
  }

  function makeLabelSprite(text, colorHex) {
    var canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 72;
    var ctx = canvas.getContext('2d');
    ctx.font = 'bold 44px "Microsoft YaHei", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(255,255,255,.9)';
    ctx.strokeText(text, 128, 36);
    ctx.fillStyle = colorHex;
    ctx.fillText(text, 128, 36);
    var texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    var sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
    sprite.scale.set(30, 8.4, 1);
    return sprite;
  }

  function guideLine(toX, toZ, colorHex) {
    var geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0.35, 0),
      new THREE.Vector3(toX, 0.35, toZ)
    ]);
    return new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: new THREE.Color(colorHex) }));
  }

  function buildingHeight(facility) {
    /* 容量 → 高度，线性但压缩，避免 200 人的田径场把其他楼完全盖住 */
    return 4 + Math.min(26, facility.capacity / 8);
  }

  function addProps(facility, x, y, z, size) {
    if (facility.type === '水上') {
      var water = new THREE.Mesh(new THREE.BoxGeometry(size * 0.8, 0.5, size * 0.55),
        new THREE.MeshLambertMaterial({ color: 0x9fd6e8 }));
      water.position.set(x, y + 0.3, z);
      scene.add(water);
    }
    if (facility.type === '田径') {
      var track = new THREE.Mesh(new THREE.TorusGeometry(size * 0.62, 1.1, 8, 40),
        new THREE.MeshLambertMaterial({ color: 0xa94f2a }));
      track.rotation.x = -Math.PI / 2;
      track.position.set(x, 0.6, z);
      scene.add(track);
    }
  }

  /* ---------- 二、按校区分组建模 ---------- */
  function build() {
    var areas = D.areaList();
    areas.forEach(function (area) {
      var members = D.facilityList().filter(function (f) { return f.areaId === area.id; });
      var padR = 15 + members.length * 3.4;

      var pad = new THREE.Mesh(new THREE.CylinderGeometry(padR, padR, 0.5, 40),
        new THREE.MeshLambertMaterial({ color: new THREE.Color(area.color).multiplyScalar(0.82) }));
      pad.position.set(area.x, 0.25, area.z);
      pad.receiveShadow = true;
      scene.add(pad);
      scene.add(guideLine(area.x, area.z, area.color));

      var label = makeLabelSprite(area.name, area.color);
      label.position.set(area.x, padR * 0.55 + 12, area.z);
      scene.add(label);
      labels.push(label);

      members.forEach(function (facility, i) {
        var columns = Math.ceil(Math.sqrt(members.length));
        var col = i % columns;
        var row = Math.floor(i / columns);
        var stepX = (columns - 1) / 2;
        var stepZ = (Math.ceil(members.length / columns) - 1) / 2;
        var x = area.x + (col - stepX) * 15;
        var z = area.z + (row - stepZ) * 14;
        addBuilding(facility, x, z);
      });
    });
  }

  function addBuilding(facility, x, z) {
    var height = buildingHeight(facility);
    var size = Math.max(6, Math.min(14, 6 + facility.capacity / 26));
    var color = facility.status === 'maintenance' ? GRAY : (TYPE_COLOR[facility.type] || GRAY);

    var body = new THREE.Mesh(
      new THREE.BoxGeometry(size, height, size * 0.82),
      new THREE.MeshLambertMaterial({ color: color, transparent: true, opacity: facility.status === 'maintenance' ? 0.55 : 1 })
    );
    body.position.set(x, height / 2 + 0.5, z);
    body.castShadow = true;
    body.receiveShadow = true;
    body.userData.facility = facility;
    body.userData.baseColor = color;
    scene.add(body);
    buildings.push(body);

    /* 屋顶指示灯：颜色即拥挤度分档，与表格里的徽章用同一套阈值 */
    var level = D.stats(facility).level;
    var beaconColor = facility.bookable && facility.status === 'open'
      ? new THREE.Color(level.bg)
      : new THREE.Color(GRAY);
    var beacon = new THREE.Mesh(new THREE.BoxGeometry(size * 0.34, 1.3, size * 0.28),
      new THREE.MeshLambertMaterial({ color: beaconColor, emissive: beaconColor, emissiveIntensity: 0.45 }));
    beacon.position.set(x, height + 1.2, z);
    scene.add(beacon);
    body.userData.beacon = beacon;

    if (facility.status === 'maintenance') {
      var fence = new THREE.Mesh(new THREE.BoxGeometry(size + 2.4, 2.2, size * 0.82 + 2.4),
        new THREE.MeshLambertMaterial({ color: 0xd8a012, transparent: true, opacity: 0.5 }));
      fence.position.set(x, 1.6, z);
      scene.add(fence);
      body.userData.fence = fence;
    } else {
      addProps(facility, x, height + 0.5, z, size);
    }
  }

  /* ---------- 三、相机与交互 ---------- */
  function updateCamera() {
    var sinPhi = Math.sin(orbit.phi);
    camera.position.set(
      orbit.target.x + orbit.radius * sinPhi * Math.cos(orbit.theta),
      orbit.target.y + orbit.radius * Math.cos(orbit.phi),
      orbit.target.z + orbit.radius * sinPhi * Math.sin(orbit.theta)
    );
    camera.lookAt(orbit.target);
  }

  function resize() {
    var w = stage.clientWidth;
    var h = stage.clientHeight || 460;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function setHighlight(mesh) {
    if (selected) {
      selected.material.color.setHex(selected.userData.baseColor);
      if (selected.userData.beacon) selected.userData.beacon.scale.set(1, 1, 1);
    }
    selected = mesh;
    if (mesh) {
      mesh.material.color.setHex(0xfff2b3);
      if (mesh.userData.beacon) mesh.userData.beacon.scale.set(1.6, 2.2, 1.6);
    }
  }

  function hudFor(facility) {
    var picked = document.getElementById('picked');
    var detail = document.getElementById('detail');
    var link = document.getElementById('bookingLink');
    if (!facility) {
      picked.textContent = '无';
      detail.textContent = '点击任意建筑查看该场馆的容量与今日占用。';
      link.href = 'facilities.html';
      link.textContent = '去查询与预约页';
      return;
    }
    var area = D.areaById(facility.areaId);
    var s = D.stats(facility);
    picked.textContent = facility.name;
    detail.textContent = [
      area.name + ' · ' + facility.type + ' · 容量 ' + facility.capacity + ' 人',
      facility.status === 'open'
        ? '开放 ' + facility.openFrom + '–' + facility.openTo + '（' + (facility.pricePerHour ? facility.pricePerHour + ' 元/小时' : '免费') + '）'
        : '本学期暂停开放',
      facility.bookable && facility.status === 'open'
        ? '今日 ' + s.bookedToday + ' 人次；最挤时段 ' + (s.peakSlot || '无') + ' ' + s.peakCount + '/' + facility.capacity + ' 人（' + C.pct(s.peakLoad) + ' ' + s.level.text + '）'
        : '自由进场，不设名额，不计拥挤度'
    ].join('｜');
    link.href = 'facilities.html#f' + facility.id;
    link.textContent = '在查询与预约页打开该场馆（编号 ' + facility.id + '）';
  }

  function focusOn(mesh, keepDistance) {
    setHighlight(mesh || null);
    hudFor(mesh ? mesh.userData.facility : null);
    if (mesh) {
      orbit.desired.set(mesh.position.x, mesh.position.y, mesh.position.z);
      if (!keepDistance) orbit.radius = Math.min(orbit.radius, 70);
    } else {
      orbit.desired.set(0, 8, 0);
    }
  }

  function pick(clientX, clientY) {
    var rect = renderer.domElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    var pointer = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
    var raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(pointer, camera);
    var visible = buildings.filter(function (b) { return b.visible; });
    var hits = raycaster.intersectObjects(visible, false);
    focusOn(hits.length ? hits[0].object : null, false);
  }

  function jumpToArea(areaId) {
    var area = D.areaById(areaId);
    if (areaId === 'all') {
      orbit.desired.set(0, 8, 0);
      orbit.radius = HOME.radius;
      orbit.theta = HOME.theta;
      orbit.phi = HOME.phi;
      focusOn(null, true);
      C.notify('info', '已回到全校视角。');
      return;
    }
    orbit.desired.set(area.x, 8, area.z);
    orbit.radius = Math.min(orbit.radius, 96);
    C.notify('info', '视角已移到' + area.name + '：' + area.brief + '，共 '
      + D.facilityList().filter(function (f) { return f.areaId === area.id; }).length + ' 个场馆。');
  }

  function bindStageEvents() {
    var el = renderer.domElement;
    var dragging = false;
    var moved = 0;
    var lastX = 0;
    var lastY = 0;
    var pinch = null;

    el.addEventListener('pointerdown', function (e) {
      dragging = true; moved = 0; lastX = e.clientX; lastY = e.clientY;
      el.setPointerCapture && el.setPointerCapture(e.pointerId);
    });

    window.addEventListener('pointermove', function (e) {
      if (e.touches && e.touches.length === 2 && pinch) {
        var dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        if (pinch.last) orbit.radius = clampRadius(orbit.radius + (pinch.last - dist) * 0.28);
        pinch.last = dist;
      }
      if (!dragging) return;
      var dx = e.clientX - lastX;
      var dy = e.clientY - lastY;
      moved += Math.abs(dx) + Math.abs(dy);
      lastX = e.clientX;
      lastY = e.clientY;
      orbit.theta -= dx * 0.006;
      orbit.phi = Math.max(0.24, Math.min(Math.PI / 2.15, orbit.phi - dy * 0.006));
    });

    /* 双指捏合缩放：touch 事件单独记两点距离，pointer 事件负责旋转 */
    el.addEventListener('touchstart', function (e) {
      if (e.touches.length === 2) {
        pinch = { last: Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY) };
        dragging = false;
      }
    }, { passive: true });
    el.addEventListener('touchend', function () { pinch = null; }, { passive: true });

    window.addEventListener('pointerup', function (e) {
      if (!dragging) return;
      dragging = false;
      if (moved < 6) pick(e.clientX, e.clientY);   /* 位移很小才算"点击"，否则是拖拽 */
    });

    el.addEventListener('wheel', function (e) {
      e.preventDefault();
      orbit.radius = clampRadius(orbit.radius + e.deltaY * 0.09);
    }, { passive: false });

    el.addEventListener('dblclick', function () {
      orbit.radius = HOME.radius;
      orbit.theta = HOME.theta;
      orbit.phi = HOME.phi;
      orbit.desired.set(0, 8, 0);
    });

    C.$(stage).on('keydown', function (e) {
      var step = 0.12;
      var used = true;
      switch (e.key) {
        case 'ArrowLeft': orbit.theta += step; break;
        case 'ArrowRight': orbit.theta -= step; break;
        case 'ArrowUp': orbit.phi = Math.max(0.24, orbit.phi - step / 2); break;
        case 'ArrowDown': orbit.phi = Math.min(Math.PI / 2.15, orbit.phi + step / 2); break;
        case '+': case '=': orbit.radius = clampRadius(orbit.radius - 8); break;
        case '-': case '_': orbit.radius = clampRadius(orbit.radius + 8); break;
        case 'Escape': focusOn(null, true); break;
        default: used = false;
      }
      if (used) e.preventDefault();
    });

    window.addEventListener('resize', resize);
  }

  function clampRadius(r) {
    return Math.max(34, Math.min(320, r));
  }

  /* ---------- 四、页面控件 ---------- */
  function buildControls() {
    var $jump = C.$('#areaJump').empty();
    $jump.append($('<button class="btn btn-outline-primary" type="button" data-area="all">全景</button>'));
    D.areaList().forEach(function (a) {
      var count = D.facilityList().filter(function (f) { return f.areaId === a.id; }).length;
      $jump.append(
        $('<button class="btn btn-outline-primary" type="button"></button>')
          .attr('data-area', a.id).text(a.name + '（' + count + '）')
      );
    });
    $jump.on('click', 'button', function () { jumpToArea($(this).data('area')); });

    var $list = C.$('#venueQuickList').empty();
    D.facilityList().forEach(function (f) {
      var mesh = buildings.filter(function (b) { return b.userData.facility.id === f.id; })[0];
      $list.append(
        $('<div class="col-6 col-md-3 col-lg-2"></div>').append(
          $('<button class="btn btn-sm btn-outline-secondary w-100 text-truncate" type="button"></button>')
            .text(f.name)
            .on('click', function () { focusOn(mesh, false); })
        )
      );
    });

    C.$('#resetView').on('click', function () {
      orbit.radius = HOME.radius;
      orbit.theta = HOME.theta;
      orbit.phi = HOME.phi;
      orbit.desired.set(0, 8, 0);
      C.notify('info', '视角已复位。');
    });
    C.$('#clearPick').on('click', function () { focusOn(null, true); });

    C.$('#showLabels').on('change', function () {
      var on = $(this).is(':checked');
      labels.forEach(function (l) { l.visible = on; });
    });

    C.$('#onlyBookable').on('change', function () {
      var on = $(this).is(':checked');
      var shown = 0;
      buildings.forEach(function (b) {
        var f = b.userData.facility;
        var show = !on || (f.bookable && f.status === 'open');
        if (show) shown++;
        b.visible = show;
        if (b.userData.beacon) b.userData.beacon.visible = show;
        if (b.userData.fence) b.userData.fence.visible = show;
      });
      C.notify('info', on
        ? '已隐藏 ' + (buildings.length - shown) + ' 个自由进场与暂停开放场馆，只留 ' + shown + ' 个可预约场馆。'
        : '已恢复显示全部 ' + buildings.length + ' 个场馆。');
    });
  }

  function buildLegend() {
    var parts = Object.keys(TYPE_HEX).map(function (t) {
      return '<span><i style="background:' + TYPE_HEX[t] + '"></i>' + C.escape(t) + '</span>';
    });
    parts.push('<span><i style="background:#198754"></i>屋顶绿灯＝峰值占用宽松</span>');
    parts.push('<span><i style="background:#e0a800"></i>黄灯＝适中</span>');
    parts.push('<span><i style="background:#dc3545"></i>红灯＝紧张</span>');
    parts.push('<span><i style="background:#adb5bd"></i>灰灯＝不计拥挤度</span>');
    C.$('#legend').html(parts.join(''));
    C.$('#encoding').text('三条视觉通道各自独立：建筑高度＝容量（'
      + D.facilityList().reduce(function (m, f) { return Math.max(m, f.capacity); }, 0) + ' 人的场地最高）、'
      + '建筑颜色＝运动类型、屋顶灯色＝峰值占用分档，与场馆页表格徽章用同一套阈值（50%／80%）。'
      + '灰色半透明并带围挡的是暂停开放场馆。');
  }

  /* ---------- 五、渲染循环：页面不可见时必须停下，否则后台一直吃 GPU ---------- */
  function loop() {
    orbit.target.lerp(orbit.desired, 0.12);
    updateCamera();
    renderer.render(scene, camera);
    rafId = window.requestAnimationFrame(loop);
  }

  function start() { if (!rafId) loop(); }

  function stop() {
    if (rafId) {
      window.cancelAnimationFrame(rafId);
      rafId = 0;
    }
  }

  function libMissing() {
    if (window.THREE && window.THREE.Scene) return false;
    document.getElementById('fallback').innerHTML =
      '<div class="alert alert-danger m-0" role="alert">三维库 Three.js 未能加载（离线或 CDN 被拦截）。'
      + '已自动改用仓库内 <code>vendor/three.min.js</code> 的同版本副本；若该文件也不存在，'
      + '请在仓库根目录执行 <code>git restore vendor/</code> 或重新克隆。'
      '场馆列表、筛选与预约功能不依赖三维库，可正常使用。</div>';
    C.$('#stage').css('min-height', '96px');
    return true;
  }

  function boot() {
    stage = document.getElementById('stage');
    if (libMissing()) return;

    setupScene();
    build();
    buildControls();
    buildLegend();
    bindStageEvents();
    resize();
    start();

    document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else start(); });
    window.addEventListener('pagehide', stop);

    /* 首页／场馆页带 ?id= 过来：直接选中并聚焦该建筑 */
    var wanted = new window.URLSearchParams(window.location.search).get('id');
    if (wanted) {
      var hit = buildings.filter(function (b) { return String(b.userData.facility.id) === String(wanted); })[0];
      if (hit) {
        focusOn(hit, false);
        C.notify('info', '已按链接定位到「' + hit.userData.facility.name + '」并高亮。');
      } else {
        C.notify('warning', '链接里的场馆编号 ' + wanted + ' 不在当前数据中，已按全景显示。');
      }
    }
  }

  C.ready(function () {
    C.bindSharedUi();
    D.load(boot);
  });

})(window.Campus, window.CampusData);
