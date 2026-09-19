# 校园运动场馆信息与数据展示中心

课程：软件开发综合实践（2026 年秋季学期）期末大作业　｜　统一题目：校园公共信息与数据展示中心
姓名：李偲钿　学号：20251060150　班级：4 班　｜　远程仓库：<https://github.com/TWBB-hope/homeworkfinal>

纯前端静态站点：无后端、无数据库、无构建步骤、不需要 `npm install`。
四个页面读同一份 `data/facilities.json`，提供场馆信息查询、筛选搜索、预约增改删、三类图表与三维导览。

---

## 一、一分钟跑起来

### 方式 A：本地服务器（推荐）

```bash
git clone git@github.com:TWBB-hope/homeworkfinal.git
cd homeworkfinal
python -m http.server 8000
```

浏览器打开 <http://127.0.0.1:8000/index.html>。

没有 Python 时，任选一种等价命令：

```bash
npx serve -l 8000          # 已有 Node 环境
php -S 127.0.0.1:8000      # 已有 PHP 环境
```

### 方式 B：直接双击

双击 `index.html` 也能打开。本机的 Chrome 实测可直接读到同目录 JSON（地址栏为 `file://`）；
若你的浏览器禁止 `file://` 页面读取本地文件，页面顶部会出现黄色提示
"场馆数据读取失败……已切换到 js/data.js 内置备份数据"，**功能照常可用，不会白屏**
（备份数据内容与 JSON 一致，提示里会说明原因与解决办法）。

### 四个页面入口

| 页面 | 文件 | 内容 |
| --- | --- | --- |
| 信息首页 | `index.html` | 今日概览四卡、按整点时段看开放场馆与剩余名额、场馆公告、三个功能区入口、技术清单 |
| 场馆查询与预约 | `facilities.html` | 六项查询条件（类型／校区／拥挤度／预约方式／排序／关键字＋剩余名额下限）、表格与卡片双视图、我的预约添加·修改·取消 |
| 使用数据分析 | `statistics.html` | 折线图（近 7 天各校区人次）、环形图（类型构成）、水平条形图（今日人次排行）、统计口径联动、数据一致性自检 |
| 校园三维导览 | `venue-3d.html` | Three.js 按校区分组的场馆场景，高度＝容量、颜色＝类型、屋顶灯＝峰值占用，支持旋转／缩放／点选／校区跳转 |

浏览器：Chrome 与 Edge 均已验证（见 `docs/期末大作业报告.md` 第六部分测试记录）。

---

## 二、目录结构

```
homeworkfinal/
├── index.html              信息首页
├── facilities.html         场馆查询与预约
├── statistics.html         使用数据分析
├── venue-3d.html           校园三维导览
├── css/
│   ├── base.css            全站公共样式（主题色、导航页脚、提示条、三档断点）
│   └── pages.css           四个页面各自专属的模块样式
├── js/
│   ├── common.js           Campus 命名空间：提示条、HTML 转义、localStorage 安全读写、导航
│   ├── data.js             唯一取数入口：加载、四类异常降级、派生指标、一致性自检、内置备份数据
│   ├── home.js             首页逻辑
│   ├── facilities.js       查询与预约逻辑（筛选、双视图、增改删与六道校验）
│   ├── statistics.js       三类图表、口径联动、自检清单
│   └── venue3d.js          Three.js 场景、交互与库缺失降级
├── data/facilities.json    全部数据（含 meta 里的表结构、单位与统计口径说明）
├── vendor/                 第三方库固定版本副本，CDN 不可达时自动兜底
├── docs/                   开发记录、测试记录、期末大作业报告（md 与 docx）
├── screenshots/            运行截图（命名见 screenshots/README.md）
└── final-assignment.docx   教师下发的期末大作业要求原件
```

---

## 三、技术职责边界（只用课堂讲过的技术）

| 技术 | 版本 | 在本项目里只负责 | 没有用它做 |
| --- | --- | --- | --- |
| HTML 语义化标签 | — | `header/nav/main/section/article/footer`、表格 `caption/scope`、`time` | 不靠 `div` 堆结构 |
| Bootstrap | 5.3.3 | 栅格、导航、卡片、徽章、表单、折叠菜单、提示条配色 | 不整体覆盖，自定义只写在 `css/` 里 |
| jQuery | 3.7.1 | 选择器与 DOM 更新、事件委托、表单交互、`$.getJSON` | 不与三维渲染混写 |
| Chart.js | 4.4.1 | 折线／环形／水平条形三类图表 | 不用它画三维场景 |
| Three.js | 0.128.0 | 三维场景、射线拾取、相机轨道控制 | 不塞进主页面拖慢首屏 |
| 原生 JavaScript | ES5 语法 | 数据派生计算、数组与对象处理 | — |

**加载顺序统一**：第三方库在前 → `common.js` → `data.js` → 页面脚本；CSS 为 Bootstrap 在前、`base.css`、`pages.css` 在后（保证能覆盖）。
所有 CDN 均写死版本号，不使用 `latest`；CDN 失败时自动改读 `vendor/` 同版本副本。
未使用 React／Vue 等课堂未讲授的框架，未使用后端与数据库。

---

## 四、数据说明

`data/facilities.json` 共六张表，`meta.tables` 里有每个字段的中文说明：

| 表 | 作用 | 被谁使用 |
| --- | --- | --- |
| `meta` | 单位、更新时间、统计口径与规则 | 四个页面的"数据来源"说明文字 |
| `areas` | 5 个校区：名称、颜色、场景坐标 | 三维场景分组与校区跳转按钮 |
| `facilities` | 14 个场馆主表 | 全部页面 |
| `slots` | 14 个整点时段 | 时段下拉、可约判断 |
| `slotBookings` | 今日各场馆各时段已约人数（稀疏，未列出即 0） | 剩余名额、今日人次、峰值占用、折线图今日点、条形图 |
| `history` | 近 6 天各校区预约人次 | 折线图历史部分 |
| `notices` | 4 条公告 | 首页公告栏 |

三条关键设计，改数据时请一并了解：

1. **占用率与今日人次不单独存储**，一律由 `slotBookings` 现算（`CampusData.stats()`），
   所以首页卡片、场馆表格、三张图表、三维屋顶灯不可能出现两个版本的事实。
2. **今日点不在 `history` 里**，由记录表现算，保证折线图"今日"与条形图、表格必然一致。
3. 峰值占用＝最拥挤时段已约人数 ÷ 容量；人次＝各时段之和（可大于容量，本就按次计）。
   自由进场场馆没有预约记录，因此不计入预约类图表，页面上写明了这一口径。

改完数据刷新页面即可看到四个页面同步变化（请求带时间戳绕开缓存）。
校验 JSON 是否合法：

```bash
python -m json.tool data/facilities.json
```

---

## 五、遇到问题先看这张表

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 顶部黄色提示"场馆数据读取失败……已切换内置备份数据" | 直接双击打开且浏览器禁止 `file://` 读本地文件，或 JSON 被改名／删除 | 用方式 A 的本地服务器打开；文件确实丢了就 `git restore data/facilities.json` |
| 提示"文件能读到（HTTP 200）但 JSON 解析失败" | 手工改 JSON 时少了逗号或引号 | `python -m json.tool data/facilities.json`，它会报出具体行列 |
| 提示"缺少 facilities 数组" | 表名被改动，结构与 `meta.tables` 不一致 | 对照 `meta.tables` 补回字段名 |
| 页面显示"共 0 个场馆" | `facilities` 是空数组 | 属预期的空数据分支，补回数据即可 |
| 图表区显示灰色"图表库 Chart.js 未能加载" | CDN 与 `vendor/chart.umd.min.js` 都没取到 | `git restore vendor/`；文字结论与自检仍可读 |
| 三维区显示红色"Three.js 未能加载" | 同上，`vendor/three.min.js` 缺失 | `git restore vendor/`；页面会自动降级成文字场馆清单 |
| 红色提示"浏览器拒绝写入本机存储" | 隐私模式或禁用了站点存储 | 属预期降级：预约不保存，其余功能正常；换普通窗口即可 |
| 改了 JSON 页面数字不变 | 极少数情况下的强缓存 | 强制刷新 Ctrl＋F5（正常刷新已带时间戳绕缓存） |

---

## 六、键盘操作与可访问性

- 只用 Tab 可遍历：跳到主内容链接 → 导航（含手机汉堡按钮）→ 查询条件 → 视图切换 → 表格"预约此馆" → 预约表单 → 修改／取消按钮 → 页脚链接。
- 三维页支持键盘：`← →` 旋转、`↑ ↓` 俯仰、`+ −` 缩放、`Esc` 取消选中（先点一下场景取得焦点）。
- 拥挤度等信息同时给出**颜色＋文字＋数字**，不单靠颜色传达；图表容器带 `role="img"` 与 `aria-label`；提示条为 `aria-live`／`role="alert"`。
- 所有表单控件都有显式 `<label for>`；已适配 `prefers-reduced-motion`。

---

## 七、资源与许可

| 资源 | 来源 | 许可 |
| --- | --- | --- |
| Bootstrap 5.3.3（CSS/JS） | jsDelivr `bootstrap@5.3.3`，本地副本 `vendor/` | MIT |
| jQuery 3.7.1 | jsDelivr `jquery@3.7.1`，本地副本 `vendor/` | MIT |
| Chart.js 4.4.1 | jsDelivr `chart.js@4.4.1`，本地副本 `vendor/` | MIT |
| Three.js 0.128.0 | jsDelivr `three@0.128.0`，本地副本 `vendor/` | MIT |
| 全部数据（场馆、时段、人次、公告） | 自编虚构数据，仅用于课堂练习，不对应真实场馆与真实价格 | 自编 |
| 图片与三维模型 | **未使用任何位图素材与外部模型文件**；三维场景全部由代码生成的几何体构成，校区标签由 Canvas 绘制 | — |

---

## 八、Git 与提交记录

```bash
git log --oneline          # 分步提交：骨架 → 公共层 → 数据层 → 四个页面 → 错误处理 → 文档 → 报告
git remote -v              # origin = git@github.com:TWBB-hope/homeworkfinal.git
```

提交说明按"做了什么 ＋ 为什么这样做"书写，便于现场验收时按提交回溯每一段代码的来历。

---

## 九、交付物清单

| 交付物 | 位置 |
| --- | --- |
| 源码（四个页面 ＋ css/js/data/vendor） | 本仓库根目录 |
| 期末大作业报告（七部分，Word） | `docs/期末大作业报告.docx` |
| 报告的可读版（Markdown） | `docs/期末大作业报告.md` |
| 开发进度与风险记录 | `docs/dev-log.md` |
| 测试记录（34 条用例） | `docs/测试记录.md`，同时收录在报告第六部分 |
| 截图清单与命名约定 | `screenshots/README.md` |
| 作业要求原件 | `final-assignment.docx` |
