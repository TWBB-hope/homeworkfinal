# 截图清单与命名约定

按课程要求：**所有截图必须截全屏，或用相机／手机直接对着屏幕拍摄**。
把文件按下面的名字放进本目录，报告（`docs/期末大作业报告.md`／`.docx`）里引用的就是这些名字。

建议先执行 `python -m http.server 8000`，用 Chrome 打开 `http://127.0.0.1:8000/`，
DevTools 里按 `Ctrl+Shift+M` 切换设备模拟即可改宽度（375／768／1200）。

## 一、响应式证据（报告第二部分）

```
01-首页-桌面1200.png
02-首页-手机375.png
03-查询预约-桌面1200.png
04-查询预约-手机375-卡片视图.png
05-数据分析-桌面1200-三图.png
06-数据分析-手机375.png
07-三维导览-桌面1200.png
08-三维导览-手机375.png
09-手机汉堡菜单展开.png
```

## 二、错误提示三状态（报告第三部分）

```
10-错误-文件不存在404.png          （把 data/facilities.json 临时改名后刷新）
11-错误-JSON格式错.png             （删掉一个逗号后刷新，提示含 json.tool 定位办法）
12-错误-数据为空.png               （把 facilities 改成 [] 后刷新）
13-错误-结构不符.png               （删掉 facilities 整个键）
14-错误-非法输入-未选场馆.png
15-错误-非法输入-重复预约.png
16-错误-非法输入-名额已满.png
17-错误-非法输入-超出5条上限.png
18-错误-非法输入-剩余名额填-5.png
19-错误-隐私模式不保存.png         （无痕窗口添加预约后的红色提示）
20-错误-图表库缺失.png             （临时把 vendor/chart.umd.min.js 改名）
21-错误-三维库缺失文字降级.png     （临时把 vendor/three.min.js 改名）
```

> 测完记得把文件名改回来，`git status` 应为干净状态。

## 三、图表与三维（报告第四、五部分）

```
22-图表-折线-近7天各校区.png
23-图表-环形-类型构成.png
24-图表-条形-今日人次排行.png
25-图表-筛选联动后只剩北区.png
26-图表-一致性自检五条全通过.png
27-三维-全景与校区色块.png
28-三维-点选建筑高亮与HUD.png
29-三维-深度链接id12自动选中.png
30-三维-只显示可预约场馆.png
```

## 四、Git 与调试（报告第六部分）

```
31-git-log-分步提交.png            （终端执行 git log --oneline 的全屏截图）
32-github-远程仓库提交列表.png     （浏览器打开仓库首页的 Commits 页）
33-devtools-console无报错.png
34-devtools-network-json请求200.png（能看到 facilities.json?_=时间戳 的请求）
35-devtools-elements-语义结构.png  （展开 main 下的 section 树）
36-devtools-sources-断点调试.png   （在 facilities.js 的 validate 处打断点）
37-devtools-application-localstorage.png
```

## 五、验收现场（报告第七部分）

```
38-现场-随机指一段代码解释.png
39-现场-按老师要求改一个小需求.png
```
