# travel-map V2 本轮修复 + 内置全球/各大洲底图重构方案

> 目标：一次性解决当前 Marker/底图缩放后漂移的坐标系问题，并把内置地图体系重构为“全球 + 各大洲”七套预设视图。
>
> 本轮不要继续增加无关功能；先保证坐标正确、缩放稳定、地图层级合理。
>
> **明确删除：加拉帕戈斯内置地图。**
> 加拉帕戈斯及其他群岛/景区/专题图只保留为“用户自定义图片底图”的使用场景，不再放进内置预设。

---

# 一、本轮最终目标

内置底图只保留：

1. 世界
2. 亚洲
3. 欧洲
4. 非洲
5. 北美洲
6. 南美洲
7. 大洋洲
8. 南极洲

说明：

- “北极”不是洲，不再作为“洲地图”之一。
- 如果后续仍想保留北极，可单独放进“专题投影”而不是“各大洲”。
- 中国、日本等不再作为内置一级预设；需要时可以通过“适配全部地点”自动缩放，或后续再做国家级扩展。
- 加拉帕戈斯不再内置。

---

# 二、地图数据源：统一改用 Natural Earth

本项目内置底图建议统一采用 **Natural Earth Vector**。

理由：

- 专门为制图设计，不是普通 GIS 原始边界 dump；
- 提供 1:110m、1:50m、1:10m 三个精度级别；
- 有世界国界、州/省一级边界、海岸线、湖泊、河流等；
- GeoJSON 可直接供前端或构建脚本处理；
- **完全 Public Domain**，可修改、重新配色、裁切、商用，不要求署名；
- 数据本身没有“国名文字”，正好适合本项目自己绘制地点标签；
- 可自行做“分国设色”，不会与地点文字发生冲突。

Natural Earth 官方：

```text
https://www.naturalearthdata.com/
```

GitHub 镜像：

```text
https://github.com/nvkelso/natural-earth-vector
```

---

# 三、让 AI 可以直接获取的文件

## 3.1 世界地图：110m

用于“世界全景”。

AI 直接下载：

```bash
curl -L https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson -o public/data/ne_110m_admin_0_countries.geojson
```

用途：

```text
世界全景
全球跨洲路线
低 zoom
```

---

## 3.2 各大洲：50m

各大洲统一使用 50m Admin-0 Countries：

```bash
curl -L https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson -o public/data/ne_50m_admin_0_countries.geojson
```

用途：

```text
亚洲
欧洲
非洲
北美洲
南美洲
大洋洲
南极洲
```

注意：

**不要为每个洲寻找七个不同来源。**

正确架构是：

```text
同一份 ne_50m_admin_0_countries.geojson
+
不同的 continent viewport / projection preset
```

这样：

- 所有洲共享同一套经纬度几何；
- 不存在七套数据版本互相打架；
- 城市点和国界天然使用同一坐标空间；
- 维护成本最低。

如果为了体积想预生成七个文件，可以在构建阶段从 50m 数据裁切，但原始 source-of-truth 仍然只有一份。

---

# 四、建议同时获取 Admin-1 边界

当前“西安看起来像在中国腹部”的问题，很大一部分不是坐标错，而是只有国家外轮廓，没有省/州一级参照。

建议各洲视图增加低对比度 Admin-1 边界。

下载：

```bash
curl -L https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_1_states_provinces_lines.geojson -o public/data/ne_50m_admin_1_states_provinces_lines.geojson
```

用途：

```text
各洲视图中显示省/州/一级行政区分界线
```

默认样式：

```text
stroke: #cbd5e1
stroke-width: 0.35 ~ 0.6
opacity: 0.45 ~ 0.65
fill: none
```

不要显示省名文字。

---

# 五、不要默认使用 10m

Natural Earth 10m 更详细，但文件明显更大：

```text
Admin-0 10m GeoJSON ≈ 12.6 MB
Admin-1 10m GeoJSON ≈ 38.8 MB
```

不适合作为默认 GitHub Pages 首屏数据。

本项目建议：

```text
世界：110m
各洲：50m
```

以后如果做“国家级详细模式”，再按需 lazy-load 10m。

---

# 六、分国设色：不要找预先上色图片

Natural Earth 提供的是矢量几何。

项目自己渲染颜色：

```ts
const countryPalette = [
  '#e9eef5',
  '#f0eadf',
  '#e6eee6',
  '#efe7ed',
  '#e8edf0',
  '#f1ecdf'
];
```

按国家稳定分配颜色：

```ts
function colorForCountry(feature) {
  const key =
    feature.properties.ADM0_A3 ||
    feature.properties.ISO_A3 ||
    feature.properties.ADMIN ||
    '';

  return countryPalette[stableHash(key) % countryPalette.length];
}
```

要求：

```text
同一个国家每次打开颜色一致
相邻国家尽量不同
颜色低饱和
不要显示国家名称
```

因此可以直接得到：

> 分国设色 + 无国名文字

---

# 七、内置地图 registry 重构

删除：

```text
galapagos-topo
```

以及所有群岛专用 preset。

建议：

```ts
export type BuiltinRegion =
  | 'world'
  | 'asia'
  | 'europe'
  | 'africa'
  | 'north-america'
  | 'south-america'
  | 'oceania'
  | 'antarctica';
```

registry 示例：

```ts
export const BUILTIN_MAP_PRESETS = [
  {
    id: 'world',
    title: '世界',
    dataLevel: '110m',
    dataset: '/data/ne_110m_admin_0_countries.geojson',
    showAdmin1: false,
    projection: 'equalEarth'
  },
  {
    id: 'asia',
    title: '亚洲',
    dataLevel: '50m',
    dataset: '/data/ne_50m_admin_0_countries.geojson',
    showAdmin1: true,
    projection: 'equalEarth'
  },
  {
    id: 'europe',
    title: '欧洲',
    dataLevel: '50m',
    dataset: '/data/ne_50m_admin_0_countries.geojson',
    showAdmin1: true,
    projection: 'equalEarth'
  },
  {
    id: 'africa',
    title: '非洲',
    dataLevel: '50m',
    dataset: '/data/ne_50m_admin_0_countries.geojson',
    showAdmin1: true,
    projection: 'equalEarth'
  },
  {
    id: 'north-america',
    title: '北美洲',
    dataLevel: '50m',
    dataset: '/data/ne_50m_admin_0_countries.geojson',
    showAdmin1: true,
    projection: 'equalEarth'
  },
  {
    id: 'south-america',
    title: '南美洲',
    dataLevel: '50m',
    dataset: '/data/ne_50m_admin_0_countries.geojson',
    showAdmin1: true,
    projection: 'equalEarth'
  },
  {
    id: 'oceania',
    title: '大洋洲',
    dataLevel: '50m',
    dataset: '/data/ne_50m_admin_0_countries.geojson',
    showAdmin1: true,
    projection: 'equalEarth'
  },
  {
    id: 'antarctica',
    title: '南极洲',
    dataLevel: '50m',
    dataset: '/data/ne_50m_admin_0_countries.geojson',
    showAdmin1: false,
    projection: 'stereographic'
  }
];
```

---

# 八、各洲不要依赖 `CONTINENT` 字段把国家删掉

不要简单：

```ts
features.filter(f => f.properties.CONTINENT === 'Asia')
```

作为最终地图内容。

原因：

```text
俄罗斯
土耳其
哈萨克斯坦
埃及
法国海外领地
```

等跨洲/海外区域会产生分类问题。

推荐：

```text
50m 全球几何全部加载
↓
通过 projection + camera / fitExtent 只显示目标洲区域
```

也就是：

**“洲预设”本质是 viewport preset，不是另一套坐标系统。**

---

# 九、各洲初始视口

可以建立 region bounds，再使用：

```ts
projection.fitExtent()
```

自动计算。

建议范围只作为初始视图参考：

```text
Asia          lon ~ 25–180, lat ~ -10–80
Europe        lon ~ -25–60, lat ~ 30–75
Africa        lon ~ -25–60, lat ~ -40–40
North America lon ~ -170–-20, lat ~ 5–85
South America lon ~ -90–-30, lat ~ -60–15
Oceania       lon ~ 95–180 / Pacific wrap
Antarctica    polar projection
```

这些 bbox 只用于初始视图，不参与城市定位。

---

# 十、南极洲单独处理

建议：

```ts
geoStereographic()
  .rotate([0, 90])
```

或：

```ts
geoAzimuthalEquidistant()
```

中心为南极点。

不要使用 Mercator。

---

# 十一、大洋洲需要专门处理 180° 经线

必须验证：

```text
澳大利亚
新西兰
斐济
萨摩亚
汤加
```

不能因为世界图切缝而被拆到屏幕两端。

可以对大洋洲 projection 设置 rotation，而不是修改地点经度。

---

# 十二、删除加拉帕戈斯内置地图

删除：

```text
public/basemaps/galapagos.svg
```

删除：

```text
galapagos-topo
```

registry 条目。

删除：

```text
加拉帕戈斯内置验收 preset
```

如果仍需要测试“自定义图片 + 仿射校准”，只作为测试 fixture，不出现在正式 UI。

---

# 十三、自定义底图功能仍然保留

内置地图：

```text
世界 + 七大洲
```

自定义底图：

```text
自由底图
标准经纬世界图
多点仿射校准
```

例如：

```text
加拉帕戈斯
马达加斯加旅游图
某国家专题图
某景区地图
插画导览图
```

全部走自定义底图。

---

# 十四、本轮坐标漂移问题：必须先修

## 修复优先级

### 1. 删除 / 禁用 `map-scaled`

当前行为错误。

本轮直接：

```ts
export type OverlayScaleMode = 'screen-fixed';
```

或者 UI 只暴露：

```text
屏幕固定尺寸
```

---

## 2. Marker `manualOffset` 从 screen-space 改成 map-space

建议重命名：

```ts
markerMapOffsetX
markerMapOffsetY
```

单位：

```text
map coordinate units / image coordinate units
```

---

## 3. 统一 `getPlaceMapAnchor()`

新增：

```ts
export function getPlaceMapAnchor(
  place: Place,
  transformer: CoordinateTransformer
): [number, number] | null {
  const pt = transformer.project(
    place.lon,
    place.lat,
    place
  );

  if (!pt) return null;

  return [
    pt[0] + (place.markerMapOffsetX || 0),
    pt[1] + (place.markerMapOffsetY || 0)
  ];
}
```

以下全部引用：

```text
MarkerLayer
RouteLayer
LabelLayer 的 anchor
leader line
FitToPoints
```

严禁各组件各写一套位置公式。

---

## 4. 去掉 App 里的硬编码 `1000 × 600`

所有 viewport 尺寸只来自：

```text
MapCanvas ResizeObserver
```

以下统一在 MapCanvas 或 viewport service 中计算：

```text
Fit Image
Fit To Points
Camera
```

---

# 十五、Marker 拖动的正确数学

用户拖动：

```text
dxScreen
dyScreen
```

转换为：

```ts
dxMap = dxScreen / camera.zoom
dyMap = dyScreen / camera.zoom
```

保存：

```ts
markerMapOffsetX += dxMap
markerMapOffsetY += dyMap
```

---

# 十六、Marker 屏幕位置公式

```ts
const anchor = getPlaceMapAnchor(place, transformer);

screenX =
  (anchor[0] - canvasWidth / 2) * camera.zoom
  + canvasWidth / 2
  + camera.panX;

screenY =
  (anchor[1] - canvasHeight / 2) * camera.zoom
  + canvasHeight / 2
  + camera.panY;
```

正确顺序：

```text
Camera(mapPoint + mapOffset)
```

不是：

```text
Camera(mapPoint) + screenOffset
```

---

# 十七、Label offset 仍保留 screen-space

Marker 修正：

```text
map-space
```

Label 相对 Marker 排版：

```text
screen-space
```

这样缩放后：

- Marker 不漂；
- Label 始终离 Marker 固定像素距离；
- 文字大小不变。

---

# 十八、RouteLayer 删除 `/ zoom` 补偿

修改后直接：

```ts
const p1 = getPlaceMapAnchor(place1, transformer)
const p2 = getPlaceMapAnchor(place2, transformer)
```

删除：

```ts
manualOffsetX / cameraZoom
```

等补偿逻辑。

---

# 十九、更稳的 Overlay 架构

推荐：

```text
Map Coordinate
      │
      ├── Basemap
      ├── Route
      └── Place Anchor
              │
            Camera
              │
         Screen Position
          ├─ Marker glyph
          └─ Label glyph
```

更进一步可以让 Marker anchor 直接在 Camera group 内：

```tsx
<g transform={cameraTransform}>
  <g transform={`translate(${mapX}, ${mapY})`}>
    <g transform={`scale(${1 / zoom})`}>
      <MarkerGlyph />
    </g>
  </g>
</g>
```

---

# 二十、自动化验收：缩放不得漂移

必须加入 regression test。

```text
zoom:
0.5
1.0
1.5
2.0
5.0

pan:
多组随机 panX / panY
```

要求：

```text
Marker 中心
与
同一 anchor 经 Camera 变换后的屏幕位置

距离始终 < 0.5 px
```

测试不通过不得发布。

---

# 二十一、内置地图定位验收

固定城市：

```text
北京     39.9042, 116.4074
上海     31.2304, 121.4737
西安     34.3416, 108.9398
兰州     36.0611, 103.8343
西宁     36.6171, 101.7782
东京     35.6762, 139.6503
札幌     43.0618, 141.3545
巴黎     48.8566, 2.3522
纽约     40.7128, -74.0060
悉尼    -33.8688, 151.2093
```

要求城市和底图使用完全相同的 projection。

禁止为了视觉印象人工改经纬度。

---

# 二十二、视觉样式

世界：

```text
Admin-0 分国填色
国家边界
不显示 Admin-1
```

各洲：

```text
Admin-0 分国填色
国家边界稍强
Admin-1 低对比细线
不显示国家名
不显示省州名
```

---

# 二十三、数据加载

默认只加载：

```text
world 110m
```

切到任一洲时 lazy-load：

```text
50m Admin-0
50m Admin-1 lines
```

缓存：

```ts
Map<string, GeoJSON>
```

---

# 二十四、数据文件结构

```text
public/
└── data/
    ├── ne_110m_admin_0_countries.geojson
    ├── ne_50m_admin_0_countries.geojson
    └── ne_50m_admin_1_states_provinces_lines.geojson
```

---

# 二十五、AI 自动获取数据的完整命令

```bash
mkdir -p public/data

curl -L https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson -o public/data/ne_110m_admin_0_countries.geojson

curl -L https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson -o public/data/ne_50m_admin_0_countries.geojson

curl -L https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_1_states_provinces_lines.geojson -o public/data/ne_50m_admin_1_states_provinces_lines.geojson
```

下载后：

```bash
ls -lh public/data/ne_*.geojson
```

数据应提交进仓库，由 GitHub Pages 静态托管，不依赖运行时外网。

---

# 二十六、来源与版权

README 增加：

```text
Basemap data: Natural Earth
https://www.naturalearthdata.com/
Public Domain
```

Natural Earth 不强制署名，但建议保留来源说明。

---

# 二十七、中国公开出版/传播的合规说明

技术底图可用 Natural Earth。

但用于中国正式出版物、公开宣传品等场景时，不能默认认为 Natural Earth 的边界表达满足中国地图审图要求。

因此必须保留：

```text
自定义底图
```

用于上传自然资源部标准地图或其他已审核素材。

不要把整个地图引擎绑定死在官方 JPG/EPS 上。

---

# 二十八、本轮删除项

正式 UI / registry 删除：

```text
加拉帕戈斯地形图
galapagos-topo
galapagos.svg
```

删除其：

```text
默认 transform
默认 calibration points
内置 preset
```

---

# 二十九、开发顺序

```text
1. 删除 / 禁用 map-scaled
2. manualOffset → map-space
3. 新建 getPlaceMapAnchor()
4. Marker / Route / Label 全部统一 anchor
5. 删除 Route 的 /zoom 补偿
6. 删除 App 1000×600 viewport 假设
7. 加 zoom/pan 不漂移自动化测试
8. 删除加拉帕戈斯内置地图
9. 下载 Natural Earth 110m / 50m 数据
10. 重构 world + 七大洲 registry
11. 增加 50m Admin-1 线
12. 分国低饱和设色
13. 做七大洲初始 viewport
14. 大洋洲 antimeridian 测试
15. 南极洲极地投影测试
16. 最后再做 UI 打磨
```

---

# 三十、Definition of Done

### 坐标稳定

```text
zoom 0.5 / 1 / 1.5 / 2 / 5
任意 pan
Marker 与对应底图锚点误差 < 0.5px
```

### 内置地图

UI 只有：

```text
世界
亚洲
欧洲
非洲
北美洲
南美洲
大洋洲
南极洲
```

### 数据

```text
世界 → Natural Earth 110m
各洲 → Natural Earth 50m
各洲可显示 50m Admin-1 细边界
```

### 地图文字

```text
无国家名
无省州名
只显示用户添加的地点标签
```

### 颜色

```text
国家分色
低饱和
稳定配色
相邻国家尽量不同
```

### 专题地图

```text
加拉帕戈斯不再内置
专题/群岛/景区走自定义底图
```

### 架构

```text
Basemap
Route
Marker anchor
Label anchor
```

全部建立在同一个 map-space 上。

如果地图缩放以后点还能相对底图漂移，本轮视为失败，不得发布。
