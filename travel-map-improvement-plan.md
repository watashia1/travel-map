# travel-map 改进与修正方案

> 目的：在保留“纯前端、轻量、可部署到 GitHub Pages、无需账号/后端”的前提下，把当前项目从“固定世界底图上的打点工具”升级为真正可用的“旅行路线视觉编辑器”。

---

## 0. 本轮修改的核心判断

当前项目最主要的问题不是 UI 不够漂亮，也不是功能数量不够，而是底层模型把以下几件事混在了一起：

1. 地理数据：经纬度与地点信息；
2. 地图底图：世界矢量图、区域图、自定义图片；
3. 坐标转换：经纬度如何映射为画布坐标；
4. 视口：缩放、平移、自动适配；
5. 视觉图层：路线、Marker、Label。

这会导致一旦用户的地点集中在群岛、极地、城市、小区域，当前“同一张世界地图 + 固定投影 + 固定区域缩放”的方案迅速失效。

本轮改动的目标不是继续在 `MapCanvas.tsx` 中增加更多 if/else，而是先把地图渲染架构拆开，再增加真正可用的底图体系。

---

# 1. 当前必须修正的问题

## 1.1 单一 world.json 导致局部路线几乎无法使用

当前 `MapCanvas` 始终加载：

```ts
./data/world.json
```

所谓“世界 / 亚洲 / 欧洲 / 中国 / 日本 / 北极”只是改变同一张底图的 projection center / scale，并没有真正切换区域底图。

这会导致：

- 加拉帕戈斯群岛等岛屿路线挤成一团；
- 一个国家内部旅行没有足够地理细节；
- 日本、欧洲等区域放大后仍然只是低细节世界图；
- 极地路线的视觉结构不合理；
- 用户只能靠手工缩放和平移勉强找位置。

### 必须改为

增加“自动适配全部地点”作为默认视图策略。

输入完成后，根据所有 resolved 地点自动计算 bounds：

```ts
minLat
maxLat
minLon
maxLon
```

并增加 15%～25% padding，然后自动缩放和平移，使所有地点铺满主要画布区域。

优先使用 D3 的：

```ts
projection.fitExtent(...)
```

或等价的基于 `MultiPoint` 的 fit 逻辑。

### 默认行为

当用户新增、删除或改变地点顺序时：

- 不强制每次重新 fit；
- 仅首次生成路线时自动 fit；
- 提供明显按钮：

```text
[适配全部地点]
```

---

# 2. Zoom / Pan 与 Overlay 必须分层

当前实现把：

- countries
- routes
- markers
- labels

全部包进同一个：

```tsx
<g id="map-transform-group" transform="... scale(...) ...">
```

结果是用户放大地图时：

- Marker 同时变大；
- Label 同时变大；
- 线宽同时变大；
- 文字很快重叠；
- 局部路线完全不可读。

这是当前架构中的 P0 级问题。

---

## 2.1 推荐的新图层结构

改成：

```tsx
<svg>
  <g id="map-camera-layer">
    <g id="basemap-layer" />
    <g id="route-geometry-layer" />
  </g>

  <g id="overlay-layer">
    <g id="markers-layer" />
    <g id="labels-layer" />
  </g>
</svg>
```

其中：

- Basemap 随 Camera 缩放 / 平移；
- Route Geometry 可随地图一起缩放；
- Marker 默认保持视觉尺寸不变；
- Label 默认保持字体尺寸不变；
- Marker / Label 位置根据当前 camera 和 projection 动态换算。

---

## 2.2 Marker / Label 的尺寸策略

增加配置：

```ts
overlayScaleMode:
  | 'screen-fixed'
  | 'map-scaled'
```

默认：

```ts
screen-fixed
```

含义：

- 地图放大 4 倍；
- Marker 仍然是 7px；
- 字号仍然是 12px；
- 只有地理距离被拉开。

这才符合地图视觉编辑器的常规行为。

---

# 3. 北极视图必须使用真正的极地投影

当前所谓北极模式，只是在现有世界投影上：

```ts
center([0, 78])
scale(...)
```

这并不是真正的极区地图。

---

## 3.1 新增投影

至少增加：

```ts
geoAzimuthalEquidistant()
```

推荐再增加：

```ts
geoStereographic()
```

北极默认可以使用：

```ts
geoAzimuthalEquidistant()
  .rotate([0, -90])
```

或经过实际效果调试后的等价方案。

---

## 3.2 区域与投影不要强绑定

`region` 与 `projection` 应分开。

例如：

```ts
region: 'arctic'
projection: 'azimuthalEquidistant'
```

而不是把“北极”当作一个普通 center preset。

---

# 4. 路线绘制逻辑必须从“屏幕曲线”改为“地理路线”

当前 `RouteLayer` 的逻辑是：

1. 经纬度先投影成两个屏幕点；
2. 再在屏幕上画二次贝塞尔曲线。

这种做法在普通短距离情况下勉强可用，但对于：

- 东京 → 阿拉斯加；
- 斐济 → 萨摩亚；
- 俄罗斯远东 → 加拿大；
- 任意跨 180° 经线的路线；

可能出现路线横穿整张地图的问题。

---

## 4.1 推荐改法

默认路线先在地理空间生成：

```ts
GeoJSON LineString
```

再交给当前 projection 转为 SVG path。

即：

```text
lon/lat
→ geographic line
→ projection
→ SVG path
```

不要再把屏幕上的 Q 贝塞尔作为唯一真实路线模型。

---

## 4.2 路线模式建议

保留三种视觉模式：

```ts
routeMode:
  | 'geodesic'
  | 'straight-screen'
  | 'decorative-curve'
```

默认：

```ts
geodesic
```

其中：

- `geodesic`：适合真实地理路线；
- `straight-screen`：纯视觉直线；
- `decorative-curve`：保留现有审美曲线，但明确它只是视觉模式。

---

# 5. 未解析地点不能被“跨过去”连线

当前路线绘制使用：

```ts
places.filter(p => p.status === 'resolved')
```

这会产生逻辑错误。

例如：

```text
东京
未知地点
奥斯陆
```

当前可能直接画成：

```text
东京 → 奥斯陆
```

但用户真实输入的路线不是这个意思。

---

## 5.1 正确行为

路线应按原始顺序分段：

```text
东京
→ [未知地点，断开]
→ 奥斯陆
```

只有连续的 resolved 地点之间才连线。

实现上按原始 places 顺序扫描，遇到 unresolved / ambiguous 时切断当前 segment。

---

# 6. Undo / Redo 必须改为事务模型

当前 `MarkerLayer` 与 `LabelLayer` 在每次 pointermove 时都会更新 ProjectData。

而 `useHistory.set()` 每次调用都会创建一条历史记录。

这意味着一次拖动可能产生几十条 Undo。

最终表现为：

- Ctrl+Z 只能一点一点退；
- 一次拖动就可能耗光 50 条历史；
- 之前真正重要的操作被挤掉。

---

## 6.1 必须改为

拖拽操作改成：

```text
pointerDown
→ beginTransaction()

pointerMove
→ updatePreview()

pointerUp
→ commitTransaction()
```

整个拖动只生成一条 Undo。

---

## 6.2 useHistory 建议增加

```ts
beginTransaction()
updateTransient()
commitTransaction()
cancelTransaction()
```

或者至少提供：

```ts
setTransient(...)
commit(...)
```

不要再把 pointermove 直接写入历史。

---

# 7. localStorage 自动保存必须防抖

当前 project 每发生变化就：

```ts
localStorage.setItem(...)
```

拖动时可能每几十毫秒写一次。

这会造成：

- 不必要的同步 IO；
- 大项目时卡顿；
- 以后加入自定义底图后问题更严重。

---

## 7.1 改法

使用：

```ts
300ms ~ 800ms debounce
```

或者：

- 普通参数修改：debounce 保存；
- 拖动：pointerup 后保存；
- 导入 / 清空：立即保存。

---

# 8. 自定义底图必须提前到核心功能

原规格把“自定义底图”放在后续版本，这个优先级应该调整。

真实使用已经证明：

只有一张世界底图无法覆盖：

- 群岛；
- 极区；
- 一个国家内部；
- 景区；
- 手绘旅游图；
- 出版物插画地图；
- 变形地图。

因此自定义底图应提升为 P1 核心能力。

---

# 9. 自定义底图设计：三种模式

## 9.1 模式 A：自由底图

适用于：

- 手绘地图；
- 旅游宣传图；
- 群岛插画；
- 极地插图；
- 景区导览图；
- 变形地图；
- 非标准投影地图。

上传格式：

```text
PNG
JPG
JPEG
WebP
SVG
```

---

### 工作方式

用户上传底图以后，不尝试自动识别其地理投影。

每个地点仍然保存真实经纬度：

```ts
lat
lon
```

同时额外保存：

```ts
visualPosition: {
  x: number
  y: number
}
```

其中：

```text
x / y 均使用 0～1 的归一化坐标
```

例如：

```ts
visualPosition: {
  x: 0.614,
  y: 0.382
}
```

这样即使底图尺寸发生变化，点位仍然正确。

---

### 交互

上传自由底图后：

```text
地点 1：点击地图指定位置
地点 2：点击地图指定位置
地点 3：点击地图指定位置
```

已有点也允许自由拖动。

---

## 9.2 模式 B：标准经纬度世界底图

适用于标准等距圆柱世界地图。

要求：

```text
左边 = -180°
右边 = +180°
上边 = +90°
下边 = -90°
```

使用：

```ts
x = (lon + 180) / 360
y = (90 - lat) / 180
```

直接得到归一化位置。

此模式不需要人工校准。

---

## 9.3 模式 C：校准底图

适用于：

“确实是一张地图，但不是标准 world equirectangular”。

用户上传图片后，指定至少 3 个已知地点。

例如：

```text
基多
瓜亚基尔
圣克里斯托瓦尔岛
```

然后分别在图片上点击这些地点的位置。

根据：

```text
真实地理坐标
→ 图片像素坐标
```

拟合 affine transform。

---

### 推荐能力

3 点：

```text
基础仿射变换
```

4～8 点：

```text
least-squares fitting
```

同时显示：

```text
平均校准误差：xx px
```

---

### 降级策略

如果误差超过阈值，提示：

```text
当前底图可能存在较强艺术变形，无法可靠进行自动地理定位。
建议切换到“自由底图模式”。
```

不要让 AI 猜，也不要假装定位准确。

---

# 10. Basemap 架构必须重构

当前：

```ts
interface MapConfig {
  projection
  region
  landColor
  borderColor
  oceanColor
}
```

不够用了。

建议改成：

```ts
interface ProjectData {
  version: '2.0';

  title: string;
  places: Place[];

  basemap: BasemapConfig;
  camera: CameraState;

  routeStyle: RouteStyle;
  markerStyle: MarkerStyle;
  labelStyle: LabelStyle;
}
```

---

## 10.1 BasemapConfig

```ts
type BasemapConfig =
  | BuiltinBasemap
  | FreeImageBasemap
  | EquirectangularImageBasemap
  | CalibratedImageBasemap
  | NoBasemap;
```

示例：

```ts
interface BuiltinBasemap {
  type: 'builtin';
  mapId: string;
  projection: MapProjectionType;
  landColor: string;
  borderColor: string;
  oceanColor: string;
}
```

```ts
interface FreeImageBasemap {
  type: 'free-image';
  assetId: string;
}
```

```ts
interface EquirectangularImageBasemap {
  type: 'equirectangular-image';
  assetId: string;
}
```

```ts
interface CalibratedImageBasemap {
  type: 'calibrated-image';
  assetId: string;
  controlPoints: CalibrationPoint[];
  transform: CalibrationTransform;
  errorPx?: number;
}
```

---

# 11. 引入统一 CoordinateTransformer

所有地点最终都应该走统一接口：

```ts
interface CoordinateTransformer {
  project(
    lon: number,
    lat: number
  ): [number, number] | null;
}
```

不同底图分别实现：

```text
Builtin D3 Projection Transformer
Equirectangular Image Transformer
Calibrated Image Transformer
Free Image Visual Position Transformer
```

这样：

- MarkerLayer 不关心底图类型；
- LabelLayer 不关心底图类型；
- RouteLayer 不关心底图类型；
- 导出逻辑也更容易统一。

这是本轮最重要的架构改造之一。

---

# 12. Camera 状态必须进入 ProjectData

当前 zoom / pan 是 `MapCanvas` 本地 state。

结果：

- 保存项目后视角丢失；
- 导入项目后无法恢复编辑状态；
- 导出项目不能完全复现当前画面。

---

## 12.1 新增

```ts
interface CameraState {
  zoom: number;
  panX: number;
  panY: number;
  autoFit?: boolean;
}
```

或者更通用地保存：

```ts
viewport: {
  centerX
  centerY
  scale
}
```

要求项目导入后视觉状态完全一致。

---

# 13. 上传底图文件不要存 localStorage

不要把用户上传图片转 Base64 直接塞进 ProjectData。

原因：

一个 4MB JPG 变成 Base64 后可能超过 5MB。

localStorage 很容易爆容量。

---

## 13.1 正确方案

结构数据：

```text
localStorage
```

图片 Blob：

```text
IndexedDB
```

ProjectData 中只保存：

```ts
assetId: 'basemap-xxxx'
```

---

## 13.2 项目导出

当前继续保留：

```text
my-trip.json
```

用于不包含图片资产的项目。

新增：

```text
my-trip.travelmap
```

建议本质为 zip：

```text
project.json
assets/
  basemap.jpg
```

该功能可以放到后续，不阻塞本轮第一阶段。

---

# 14. 标签排版必须增加自动避让

当前所有标签默认：

```ts
labelOffsetX = 12
labelOffsetY = -12
```

当点位集中时必然重叠。

---

## 14.1 最低要求

自动尝试 8 个候选方向：

```text
右上
右
右下
下
左下
左
左上
上
```

逐个计算 label bounding box 是否与：

- 其他 label；
- marker；
- 重要路线；

发生严重重叠。

选择碰撞最少的位置。

---

## 14.2 可选优化

后续增加：

```text
自动排版
重新避让
```

按钮。

不要在用户每次拖动时实时跑复杂避让。

---

# 15. Marker 与 Label 的交互改进

增加：

```text
隐藏该标签
隐藏该 Marker
锁定位置
恢复自动位置
```

并支持：

```text
Ctrl / Cmd + 点击
```

多选可以以后再做，不属于本轮硬要求。

---

# 16. 地点排序必须真正支持拖拽

当前 UI 文案写着：

```text
可拖动排序
```

但实现实际上只有：

```text
上移
下移
```

需要二选一：

### 方案 A：真正实现 drag & drop

推荐。

可以使用轻量实现，不必引入大型依赖。

### 方案 B：如果暂时不做

立刻把 UI 文案改成：

```text
可调整顺序
```

不要让 README 和产品界面描述不存在的功能。

---

# 17. 经纬度解析必须回归原规格

原规格要求优先使用成熟坐标解析库，不要自己重写复杂正则。

当前项目实际上自己实现了 DMS / decimal regex。

这会增加大量边缘输入风险。

---

## 17.1 推荐处理

优先评估并接入：

```text
parse-gps-coordinates
```

如果由于体积或兼容性决定继续使用自研 parser，则必须增加完整 test corpus。

至少测试：

```text
35.6762, 139.6503
35.6762 139.6503
35°40'34"N, 139°39'1"E
35°40′34″N 139°39′1″E
35.6762N, 139.6503E
−35.6762, 139.6503
35.6762，139.6503
geo:35.6762,139.6503
```

以及无效输入。

---

# 18. 内置底图不要再只保留一张

当前 `public/data` 只有：

```text
world.json
places.json
```

建议至少增加几个真正不同的数据集：

```text
world-low.json
world-medium.json
japan.json
china.json
europe.json
arctic.json
galapagos.json（可选示例）
```

不要求做成在线瓦片。

仍然可以保持：

```text
纯前端
静态资源
GitHub Pages
```

---

## 18.1 地图级别策略

推荐：

```text
世界视角 → world-low
区域视角 → world-medium / region map
局部视角 → region specific map
```

这样可以避免世界地图被无限放大后仍然没有细节。

---

# 19. 导出体系必须兼容自定义底图

SVG 导出时：

内置矢量地图：

```text
继续导出为 SVG path
```

自定义图片：

```text
使用 <image href="...">
```

必须确保资源被嵌入为：

```text
data URL
```

或 Blob 转内联内容，否则导出的 SVG 在别的电脑上会丢图。

---

## 19.1 PNG 导出

需要确保：

```text
自定义图片
地图
路线
Marker
Label
```

全部被正确合成。

---

## 19.2 透明图层导出

继续保留：

```text
仅导出路线图层
```

但同时增加：

```text
仅导出 Overlay
```

即：

```text
Route
Marker
Label
```

方便放进 Photoshop / Figma / Illustrator。

---

# 20. 性能与交互细节

## 20.1 pointermove 不要频繁 setProject

拖动预览使用本地 transient state。

只在：

```text
pointerup
```

提交到 ProjectData。

---

## 20.2 ProjectData 更新不要导致全部重算

使用：

```text
useMemo
memo
```

控制：

- projection；
- pathGenerator；
- basemap geometry；
- labels；
- routes；

避免无意义全局 rerender。

---

# 21. 新版优先级

## P0：必须先修

```text
自动适配全部地点
Zoom 不放大 Marker / Label
真正的北极投影
Undo 拖动事务化
localStorage 防抖
未解析地点切断路线
Camera 写入项目状态
```

---

## P0.5：架构重构

```text
BasemapConfig
CameraState
CoordinateTransformer
地图 / Overlay 分层
```

这一步完成以前，不要继续堆更多样式功能。

---

## P1：核心新增

```text
自由上传底图
标准经纬度图片底图
三点及以上校准底图
标签自动避让
真正拖拽排序
```

---

## P2：后续增强

```text
多级区域地图
多路线
时间轴
动画
互动 HTML 导出
项目压缩包格式
更复杂的地图校准
```

---

# 22. 推荐的开发顺序

严格按下面顺序执行：

```text
① 重构 MapCanvas 图层
② 拆分 Basemap / Camera / Overlay
③ 实现 screen-fixed Marker / Label
④ 实现 Fit to Points
⑤ 修复 Route 断点逻辑
⑥ 修复 Undo transaction
⑦ 修复 autosave debounce
⑧ 引入 Arctic projection
⑨ 将 Camera 写入 ProjectData
⑩ 引入 CoordinateTransformer
⑪ 新增 Free Image Basemap
⑫ 新增 Equirectangular Image Basemap
⑬ 新增 Calibrated Image Basemap
⑭ 标签自动避让
⑮ 导出兼容
⑯ 完整测试
```

---

# 23. 新的验收案例

## 案例 A：加拉帕戈斯群岛

输入：

```text
圣克里斯托瓦尔岛
弗雷里安纳岛
伊莎贝拉岛
圣地亚哥岛
```

预期：

- 自动缩放到群岛范围；
- 地点之间明显分开；
- Label 不得全部重叠；
- Marker 不因 zoom 变大；
- 可以一键“适配全部地点”。

这是当前版本必须通过的新 P0 验收案例。

---

## 案例 B：北极

输入：

```text
奥斯陆
特罗姆瑟
朗伊尔城
北极点
```

预期：

- 使用极地投影；
- 视觉中心为北极区域；
- 路线自然；
- 不出现普通 Mercator 式极区畸变。

---

## 案例 C：跨 180° 经线

输入：

```text
东京
安克雷奇
```

预期：

- 默认地理路线不得横穿整张地图；
- 应按最合理的地理路径显示。

---

## 案例 D：未知地点

输入：

```text
东京
某未知地点
奥斯陆
```

预期：

```text
东京
→ 路线断开
某未知地点（未解析）
→ 路线断开
奥斯陆
```

不得直接绘制：

```text
东京 → 奥斯陆
```

---

## 案例 E：自由上传底图

上传一张手绘岛屿地图。

输入：

```text
地点 A
地点 B
地点 C
```

预期：

- 用户可以依次点击图片指定位置；
- 点位保存为归一化 x/y；
- 刷新页面后位置仍然正确；
- 图片缩放后点位仍然保持相对位置；
- PNG / SVG 导出正常。

---

## 案例 F：Undo

拖动一个 Marker 100px。

按一次：

```text
Ctrl + Z
```

预期：

Marker 一次恢复到拖动前位置。

不得需要连续按几十次。

---

# 24. 测试要求

新增测试体系。

推荐：

```text
Vitest
Playwright
```

至少覆盖：

```text
coordinate parser
fit-to-points
projection
route segmentation
antimeridian
undo transaction
project save / load
custom basemap
export
```

---

# 25. 不要做的事情

本轮仍然不要加入：

```text
账号系统
云同步
后端
在线地图瓦片
Google Maps
Mapbox
AI 自动识别地图
实时 GPS
导航
酒店 / 航班
MCP
多人协作
```

本轮的重点仍然是：

```text
轻量
本地
可视化
可编辑
可导出
```

---

# 26. 新的产品定义

建议把产品定义从：

> 输入地名或经纬度，自动生成可编辑、可连线、可导出的旅行足迹地图。

升级为：

> 输入地点或经纬度，在内置地图或自定义底图上自动生成、校准、编辑并导出旅行路线视觉地图。

---

# 27. 给开发 AI 的最终执行要求

请不要在当前代码上简单增加一个“上传底图”按钮。

必须先完成：

```text
Basemap
Coordinate Transformer
Camera
Overlay
```

四层拆分。

所有后续功能都应基于这个架构扩展。

开发时遵守以下原则：

```text
地理坐标是真实数据
底图只是视觉载体
Camera 负责视口
Overlay 负责 Marker / Label
```

任何实现如果再次把：

```text
地图缩放
Marker 缩放
Label 缩放
经纬度投影
图片坐标
```

混在同一个 SVG transform 中，都视为架构退化。

---

# 28. Definition of Done

本轮改造完成后，必须稳定支持下面完整链路：

```text
打开网页
↓
输入 3～20 个地点
↓
系统自动定位
↓
自动适配全部地点
↓
地图局部范围清晰可读
↓
Marker / Label 在 zoom 时保持稳定尺寸
↓
路线正确显示
↓
用户可以切换内置地图或上传自定义底图
↓
自定义底图可以自由指定点位
或进行标准经纬度 / 校准定位
↓
拖动 Marker / Label
↓
一次 Ctrl+Z 完整撤销一次拖动
↓
刷新浏览器
↓
项目、Camera、底图状态可以恢复
↓
PNG / SVG 导出正常
```

只要其中一条仍然不稳定，本轮就不算完成。
