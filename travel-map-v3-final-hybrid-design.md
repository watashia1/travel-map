# travel-map V3 最终改造方案
## MapLibre + OpenFreeMap 全球连续内置地图 / SVG 旅行覆盖层 / 自定义图片底图双引擎

> 本方案基于当前仓库最新代码重新整理。
>
> 当前仓库已经完成：
>
> - Natural Earth 世界 + 七大洲底图
> - Marker map-space offset
> - `getPlaceMapAnchor()`
> - `screen-fixed`
> - 多点仿射校准
> - Fit 修正
> - Vitest 验收
>
> 下一阶段不再继续扩展 D3 内置地图，而是将“内置地图模式”迁移到 **MapLibre GL JS + OpenFreeMap**。
>
> **重点变化：**
>
> - 不再维护“亚洲地图 / 欧洲地图 / 非洲地图……”等独立内置底图。
> - 普通全球地图改为一套连续的 MapLibre + OpenFreeMap 全球矢量地图。
> - “世界 / 亚洲 / 欧洲……”只可作为 Camera 快捷视图，不再是不同地图。
> - 北极 / 南极保留为特殊极地专题，不强行用普通 Web Mercator。
> - 路线、Marker、Label 不全部迁入 MapLibre；继续保留现有 SVG 视觉编辑能力。
> - 自定义图片 / 标准经纬图片 / 多点仿射校准继续使用独立 ImageMapRenderer。

---

# 1. 最终产品架构

推荐最终结构：

```text
                    ProjectData
                        │
                        ↓
                   MapViewport
                        │
          ┌─────────────┴─────────────┐
          │                           │
          ↓                           ↓
     BuiltinMapView              ImageMapView
          │                           │
          │                           ├─ Free Image
          │                           ├─ Equirectangular
          │                           └─ Calibrated Affine
          │
          ├─ MapLibre + OpenFreeMap
          │     └─ Basemap + Camera
          │
          └─ SVG Travel Overlay
                ├─ Route
                ├─ Marker
                └─ Label
```

核心原则：

```text
MapLibre 负责地图空间、投影、缩放、平移
SVG 负责旅行路线和视觉编辑
```

不要让 MapLibre 和 SVG 各自维护一套 Camera 数学。

---

# 2. 为什么不再需要分洲地图

MapLibre + OpenFreeMap 是全球连续的多级矢量瓦片地图。

用户从：

```text
全球
→ 亚洲
→ 中国
→ 陕西
→ 西安
```

时，不是把一张世界地图无限放大，而是 MapLibre 根据 zoom 自动请求更详细的 vector tiles。

因此不再需要：

```text
world.geojson
asia.geojson
europe.geojson
africa.geojson
...
```

作为主地图系统。

正确概念变成：

```text
只有一张全球连续地图
不同地区只是不同 Camera 视图
```

---

# 3. 内置地图 UI 重新定义

不再显示：

```text
底图：
世界
亚洲
欧洲
非洲
北美洲
南美洲
大洋洲
南极洲
```

建议改成：

```text
内置地图

样式
[旅行极简] [标准地图]

视图
[适配全部地点]
[世界全景]

快速定位（可选）
[亚洲] [欧洲] [非洲]
[北美] [南美] [大洋洲]

极地专题
[北极] [南极]
```

其中：

```text
亚洲 / 欧洲 / 非洲……
```

只是：

```ts
map.flyTo(...)
```

或：

```ts
map.fitBounds(...)
```

不切换数据源。

---

# 4. 内置普通地图：MapLibre + OpenFreeMap

新增依赖：

```bash
npm install maplibre-gl
```

入口：

```ts
import 'maplibre-gl/dist/maplibre-gl.css';
```

标准底图：

```text
https://tiles.openfreemap.org/styles/liberty
```

初始化：

```ts
const map = new maplibregl.Map({
  container,
  style: 'https://tiles.openfreemap.org/styles/liberty',
  center: [100, 30],
  zoom: 2,
  attributionControl: true
});
```

不要引入 API key。

---

# 5. 不要让 MapLibre 接管全部旅行图层

前一版方案中“Route / Marker / Label 全部迁入 MapLibre”过于激进。

当前项目已经具备：

- Marker 编号
- Ring Marker
- 自定义颜色
- Arrow
- 虚线
- 标签 Halo
- 标签拖动
- Label leader line
- 8 方位自动避让
- SVG Overlay 导出

这些能力没有必要重写。

因此：

```text
MapLibre
只负责底图 + Camera

SVG
继续负责 Route / Marker / Label
```

---

# 6. BuiltinMapView 结构

建议：

```tsx
<div className="map-root">

  <div ref={mapLibreContainerRef}
       className="absolute inset-0" />

  <svg className="absolute inset-0 pointer-events-none">

    <RouteOverlay />

    <MarkerOverlay />

    <LabelOverlay />

  </svg>

</div>
```

其中 SVG：

```text
width = viewport width
height = viewport height
```

Route / Marker / Label 的屏幕坐标统一来自：

```ts
map.project([lon, lat])
```

不要再自己实现：

```text
projection
zoom
pan
screen transform
```

---

# 7. 内置地图中的地点锚点

内置地图不再使用：

```ts
D3ProjectionTransformer
getPlaceMapAnchor()
markerMapOffsetX
markerMapOffsetY
```

地点锚点直接：

```ts
function getBuiltinScreenAnchor(
  map: maplibregl.Map,
  place: Place
) {
  return map.project([place.lon, place.lat]);
}
```

这是唯一正确锚点。

---

# 8. 内置地图 Marker 不允许视觉拖动

这是本方案的重要修正。

在 MapLibre 内置地图中：

```text
Place.lat / Place.lon
```

代表真实地理位置。

例如：

```text
西安 = 34.3416N / 108.9398E
```

不能因为用户拖了一下红点就改变真实经纬度。

因此：

```text
内置地图模式
Marker 默认不可拖动
```

用户若要修改坐标：

```text
地点编辑
→ 编辑经纬度
```

必须是显式行为。

---

# 9. `markerMapOffset` 只属于 ImageMap

当前仓库已经实现：

```ts
markerMapOffsetX
markerMapOffsetY
```

这些不要删，但重新定义作用范围：

```text
仅用于自定义图片地图
```

适用：

```text
仿射校准存在少量误差
手工微调 Marker
```

不适用于：

```text
MapLibre builtin
```

---

# 10. Label 保留 SVG 层

Label 继续使用当前 SVG LabelLayer 思路。

Anchor：

```ts
const pt = map.project([place.lon, place.lat]);
```

然后：

```ts
x = pt.x + labelOffsetX
y = pt.y + labelOffsetY
```

其中：

```text
labelOffsetX / labelOffsetY
仍然是 screen-space px
```

这是正确的。

---

# 11. Label 拖动继续保留

用户拖 Label：

```text
只修改 labelOffsetX / labelOffsetY
```

不要改变地点坐标。

当前已有：

```text
leader line
auto avoidance
manual offset
```

全部保留。

---

# 12. Route 继续使用 SVG Overlay

Route 不需要迁入 MapLibre line layer。

推荐：

```text
地点 lon/lat
↓
生成 geographic interpolation
↓
map.project()
↓
SVG Path
```

这样继续保留：

```text
Arrow
dash
stroke style
decorative curve
SVG export
```

---

# 13. Geodesic 路线

推荐：

```ts
const interpolator =
  d3.geoInterpolate(
    [p1.lon, p1.lat],
    [p2.lon, p2.lat]
  );
```

生成：

```text
24~64 个经纬度中间点
```

再：

```ts
map.project([lon, lat])
```

转换成屏幕点。

最后生成 SVG path。

---

# 14. 跨 180° 经线

MapLibre 本身可以连续 wrap world，但 SVG Route 需要专门处理。

不能只使用：

```text
abs(screenX2 - screenX1)
```

粗略判断。

建议：

```text
geographic interpolation
↓
longitude unwrap
↓
map.project()
↓
检测 world copy / wrap
```

测试：

```text
东京 → 安克雷奇
斐济 → 萨摩亚
奥克兰 → 汤加
```

不得出现横穿整张地图的错误路线。

---

# 15. Camera 完全交给 MapLibre

内置地图删除：

```text
panX
panY
D3 camera transform
```

内置视图状态：

```ts
interface MapLibreViewState {
  center: [number, number];
  zoom: number;
  bearing: number;
  pitch: number;
}
```

获取：

```ts
map.getCenter()
map.getZoom()
map.getBearing()
map.getPitch()
```

恢复：

```ts
map.jumpTo(...)
```

---

# 16. Camera 不进入 Undo / Redo

当前仓库仍存在一个问题：

```text
pan pointermove
→ setProject()
→ history
```

会污染 Undo。

V3 必须修。

原则：

```text
内容修改
→ 可 Undo

Camera / viewport
→ 可持久化
→ 不进入 Undo history
```

建议：

```ts
setProjectWithoutHistory(...)
```

或者：

```text
project content state
view state
```

彻底拆开。

---

# 17. 建议 ProjectData 拆分

从：

```ts
ProjectData {
  camera
  places
  ...
}
```

改为：

```ts
interface ProjectDataV3 {
  version: '3.0';

  title: string;

  places: Place[];

  basemap: BasemapConfig;

  routeStyle: RouteStyle;
  markerStyle: MarkerStyle;
  labelStyle: LabelStyle;

  views: {
    builtin?: MapLibreViewState;
    image?: ImageViewState;
  };
}
```

---

# 18. 两套 View State 分开保存

不要使用 discriminated union 只保存当前 view。

否则：

```text
MapLibre
→ Image
→ MapLibre
```

会丢掉之前地图视图。

应：

```ts
views: {
  builtin: {
    center,
    zoom,
    bearing,
    pitch
  },

  image: {
    zoom,
    panX,
    panY
  }
}
```

---

# 19. MapLibre 的 `fit all places`

不再使用当前：

```ts
calculateFitToPoints()
```

内置模式直接：

```ts
const bounds =
  new maplibregl.LngLatBounds();

places
  .filter(p => p.geoStatus === 'resolved')
  .forEach(p =>
    bounds.extend([p.lon, p.lat])
  );

map.fitBounds(bounds, {
  padding: 80,
  maxZoom: 12
});
```

这是 MapLibre 原生能力。

---

# 20. 普通世界不再维护 Natural Earth 作为主地图

当前：

```text
Natural Earth 110m / 50m
```

不再作为内置主地图。

但不要删除这些文件和代码。

Natural Earth 保留三个用途：

```text
1. 分国设色辅助层
2. 网络失败 fallback
3. 未来 Print / SVG Export Renderer
```

---

# 21. Travel Clean Style

建立：

```text
旅行极简
```

作为默认样式。

视觉目标：

```text
低饱和
干净
无 POI
无建筑
无道路文字
无国家名
无城市名
行政边界清楚
海陆关系明确
```

路线和用户地点才是视觉主体。

---

# 22. Travel Clean 不要直接硬猜 source-layer

先读取：

```text
OpenFreeMap Liberty style JSON
```

检查：

```text
sources
layers
source-layer
filters
```

再决定隐藏/保留哪些 layer。

不要硬编码一个猜出来的：

```text
country
admin
land
```

source-layer。

---

# 23. 推荐 Travel Clean 第一阶段做法

第一阶段不要追求复杂分国设色。

先实现：

```text
water
land
country boundaries
admin1 boundaries
```

同时隐藏：

```text
roads
buildings
POI
road labels
place labels
country labels
```

保证稳定。

---

# 24. 分国设色建议继续用 Natural Earth

如果 OpenFreeMap vector tiles 不方便按国家 polygon 分色：

```text
不要硬做
```

直接使用当前已经下载好的：

```text
Natural Earth Admin-0
```

作为 MapLibre GeoJSON fill source：

```js
map.addSource('country-fill', {
  type: 'geojson',
  data: naturalEarthCountries
});
```

然后：

```js
map.addLayer({
  id: 'country-fill',
  type: 'fill',
  source: 'country-fill'
});
```

这样：

```text
底层细节 = OpenFreeMap
国家色块 = Natural Earth
```

仍然处于同一经纬度坐标系，不会漂移。

---

# 25. 普通大洲不再单独维护底图

以下删除为“底图”概念：

```text
世界底图
亚洲底图
欧洲底图
非洲底图
北美底图
南美底图
大洋洲底图
```

保留为：

```text
快速视图 preset
```

---

# 26. 极地是例外

MapLibre/OpenFreeMap 普通 Web Mercator 不适合真正极点。

因此：

```text
北极
南极
```

保留特殊专题 renderer。

推荐：

```text
北极
→ D3 geoAzimuthalEquidistant / stereographic

南极
→ D3 geoStereographic
```

不要强行统一。

---

# 27. 极地专题独立

建议：

```text
BuiltinMapView
├─ MapLibreGlobalView
└─ PolarMapView
```

而不是：

```text
所有 builtin 都 MapLibre
```

判断：

```ts
if (
  viewMode === 'north-pole' ||
  viewMode === 'south-pole'
) {
  return <PolarMapView />;
}
```

---

# 28. 南极洲不再当普通“大洲按钮”

因为用户真正需要的是：

```text
南极旅行 / 极地路线
```

不是普通 Mercator 下的“南极洲框选”。

UI：

```text
极地专题
[北极] [南极]
```

更合理。

---

# 29. 自定义图片引擎保留

ImageMapView 继续支持：

```text
自由图片
标准经纬世界图
多点仿射校准
```

---

# 30. 自定义图片中的 Marker

自定义图片模式继续允许：

```text
markerMapOffsetX/Y
```

但单位：

```text
image/map-space
```

不要恢复 screen-space offset。

---

# 31. ImageMap 中 `getPlaceMapAnchor()` 保留

当前函数：

```ts
getPlaceMapAnchor()
```

继续留在：

```text
ImageMapRenderer
```

不要用于 MapLibre。

建议移动文件：

```text
src/image-map/anchor.ts
```

---

# 32. Free Image 继续手工定位

```ts
visualPosition: {
  x: 0~1,
  y: 0~1
}
```

保留。

不要让自由图片模式反推真实经纬度。

---

# 33. geoStatus 与 visualStatus 分离

当前代码仍有：

```text
自由图片点击位置
→ status = resolved
```

这是概念错误。

V3 改为：

```ts
geoStatus:
  | 'resolved'
  | 'ambiguous'
  | 'unresolved'

visualStatus?:
  | 'placed'
  | 'unplaced'
```

自由图片上人工放置：

```text
visualStatus = placed
```

不自动改变：

```text
geoStatus
```

---

# 34. MapLibre 模式只显示 geoResolved 地点

条件：

```ts
place.geoStatus === 'resolved'
```

如果某地点只在自由图片里摆过：

```text
不在 MapLibre 中伪造坐标
```

---

# 35. 地点数据库继续保留

本轮不要引入：

```text
Photon
Nominatim
```

作为必须依赖。

继续使用当前本地 places DB。

联网搜索可后续增加。

---

# 36. 初始化 sample 要修

当前：

```text
project.places.length === 0
```

启动时自动加载 sample。

这会导致用户主动清空后刷新：

```text
sample 又回来
```

V3 顺手修复。

增加：

```text
hasInitialized
```

或：

```text
localStorage project exists
```

判断。

只有真正第一次启动才加载 sample。

---

# 37. MapLibre Overlay 监听

SVG Overlay 需要在这些事件更新：

```text
move
zoom
resize
rotate
pitch
```

可使用：

```ts
map.on('render', syncOverlay)
```

但不要每次都 set React ProjectData。

建议：

```text
MapLibre camera event
→ local render state
→ requestAnimationFrame
→ refresh projected screen points
```

---

# 38. 不要在 map move 中写 history

再次强调：

```text
map.on('move')
```

只能更新：

```text
runtime view state
```

不要：

```text
setProject()
```

等到：

```text
moveend
```

再持久化 view。

---

# 39. Overlay 性能

地点一般只有：

```text
3~50
```

因此 SVG Overlay 足够。

不要为了理论性能提前迁移到 WebGL layers。

---

# 40. Export：必须拆分

当前 exporter：

```text
clone SVG
→ serialize
→ PNG
```

在 MapLibre 模式下不能继续直接使用。

新策略：

## MapLibre 完整 PNG

```text
MapLibre canvas
+
SVG Travel Overlay
+
Attribution
↓
Composite Canvas
↓
PNG
```

---

# 41. MapLibre 完整 PNG 导出注意

不能假定：

```ts
map.getCanvas().toDataURL()
```

任何时候都可靠。

需要：

- 检查 `preserveDrawingBuffer`
- 或建立专门 export Map
- 或 render 后立即 composite
- 支持高 DPI pixelRatio

不要只写一行 `toDataURL()`。

---

# 42. SVG 导出重新定义

MapLibre 模式：

```text
SVG
只导出：
Route
Marker
Label
```

不包含 WebGL 底图。

UI 明确：

```text
导出 SVG 覆盖层
```

---

# 43. ImageMap 继续支持完整 SVG

自定义图片模式仍可以：

```text
完整 SVG
Overlay SVG
PNG
```

---

# 44. 未来出版模式

如果未来需要：

```text
可编辑世界地图 SVG
```

另建：

```text
PrintRenderer
```

使用：

```text
Natural Earth
+
SVG Route
+
SVG Marker
+
SVG Label
```

不要强迫 MapLibre 负责出版 SVG。

---

# 45. ProjectData V3 Migration

新增：

```ts
version: '3.0'
```

实现：

```ts
migrateProjectV2ToV3()
```

---

# 46. V2 builtin 项目迁移

旧：

```ts
basemap.type === 'builtin'
```

迁移：

```ts
{
  type: 'builtin-maplibre',
  styleId: 'travel-clean'
}
```

旧：

```text
region
```

不要作为地图类型保留。

如果：

```text
region = asia
```

只用它决定首次 Camera preset。

---

# 47. 旧 camera 不强行转换

旧：

```text
zoom
panX
panY
```

和 MapLibre：

```text
center
zoom
```

没有可靠一一映射。

迁移策略：

```text
如果有 places
→ MapLibre fitBounds

如果没有
→ world view
```

不要伪造旧 Camera。

---

# 48. 文件目录重构

推荐：

```text
src/
├── app/
│   └── MapViewport.tsx
│
├── maplibre/
│   ├── MapLibreGlobalView.tsx
│   ├── createTravelStyle.ts
│   ├── overlayProjector.ts
│   ├── regionPresets.ts
│   └── exportComposite.ts
│
├── polar/
│   ├── PolarMapView.tsx
│   └── polarProjection.ts
│
├── image-map/
│   ├── ImageMapView.tsx
│   ├── transformer.ts
│   ├── calibration.ts
│   └── anchor.ts
│
├── overlay/
│   ├── RouteOverlay.tsx
│   ├── MarkerOverlay.tsx
│   └── LabelOverlay.tsx
│
├── editor/
├── export/
└── types/
```

---

# 49. 不要继续扩张 `src/map/MapCanvas.tsx`

当前 `MapCanvas.tsx` 已经同时包含：

```text
GeoJSON load
D3 projection
Image map
Camera
Panning
Picking
Route
Marker
Label
```

V3 应把它拆掉。

不要继续：

```text
if builtin
else if free
else if calibrated
```

---

# 50. `MapViewport` 是新的统一入口

```tsx
function MapViewport({ project }) {

  if (project.basemap.type === 'builtin-maplibre') {
    return <MapLibreGlobalView />;
  }

  if (project.basemap.type === 'polar') {
    return <PolarMapView />;
  }

  return <ImageMapView />;
}
```

---

# 51. 极地类型建议

Basemap：

```ts
type BasemapConfig =
  | MapLibreBasemap
  | PolarBasemap
  | FreeImageBasemap
  | EquirectangularImageBasemap
  | CalibratedImageBasemap;
```

Polar：

```ts
interface PolarBasemap {
  type: 'polar';
  pole: 'north' | 'south';
}
```

---

# 52. MapLibre Basemap 类型

```ts
interface MapLibreBasemap {
  type: 'builtin-maplibre';

  styleId:
    | 'travel-clean'
    | 'standard';
}
```

不要再保存：

```text
region
projection
landColor
oceanColor
```

作为核心地图状态。

---

# 53. 快速视图 preset 独立

```ts
interface CameraPreset {
  id:
    | 'world'
    | 'asia'
    | 'europe'
    | 'africa'
    | 'north-america'
    | 'south-america'
    | 'oceania';

  bounds?: [[number, number], [number, number]];
  center?: [number, number];
  zoom?: number;
}
```

只是 UI shortcut。

---

# 54. MapLibre attribution

必须保留 attribution。

至少：

```text
© OpenStreetMap contributors
OpenFreeMap
```

不要为了截图好看直接删除。

导出 PNG 时也需要考虑 attribution。

---

# 55. 在线地图隐私提示

README / UI 说明：

```text
地点与路线项目数据仍保存在本地。

使用内置在线地图时，
浏览器会向 OpenFreeMap 请求当前视图所需地图瓦片，
地图服务可能获知当前浏览的大致区域。
```

---

# 56. 网络失败处理

MapLibre style / tile 加载失败：

```text
内置地图加载失败
```

提供：

```text
[重试]
[使用离线简化地图]
[切换自定义底图]
```

---

# 57. 离线 fallback

当前 Natural Earth 可以作为 fallback：

```text
OfflineFallbackMap
```

但 fallback 只是：

```text
简化全球地图
```

不要伪装成完整 MapLibre。

---

# 58. 自动化测试需要升级

当前 Vitest 中的“不漂移测试”主要是在验证同一公式等于自身。

V3 必须增加浏览器级 E2E。

安装：

```bash
npm install -D @playwright/test
```

---

# 59. Playwright 必测：Marker 不漂移

测试：

```text
打开页面
加入北京 / 西安 / 上海

记录：
map.project([lon,lat])

记录：
Marker SVG 中心

执行：
zoom
pan
resize

再次比较
```

要求：

```text
误差 < 0.5 px
```

---

# 60. Playwright 必测：Label

```text
Label anchor
=
map.project(place)
+
labelOffset
```

多次 zoom / pan 后仍成立。

---

# 61. Playwright 必测：Route

取任意 route vertex：

```text
Geo coordinate
→ map.project()
```

与 SVG path 中对应 point 对比。

---

# 62. ImageMap 零漂移测试继续保留

自定义图片：

```text
zoom 0.5
1
1.5
2
5
```

Marker 与 image-space anchor：

```text
< 0.5 px
```

---

# 63. 极地验收

北极：

```text
北极点位于中心
朗伊尔城
特罗姆瑟
奥斯陆
```

路线合理。

南极：

```text
南极点中心
长城站
乌斯怀亚
```

不得使用 Web Mercator 假装极地。

---

# 64. 内置地图验收

输入：

```text
北京
上海
西安
东京
巴黎
纽约
悉尼
```

点击：

```text
适配全部地点
```

MapLibre 自动 fit。

继续放大到任一城市：

```text
底图细节增加
Marker 不漂移
Label 不漂移
Route 不漂移
```

---

# 65. 本轮不要做

不要实现：

```text
道路导航
路径规划
OSM Snap
GPX 编辑
实时 GPS
账户
云同步
多人协作
```

本轮只解决：

```text
内置地图引擎
双引擎架构
稳定坐标
视觉覆盖层
导出
```

---

# 66. 开发顺序

严格按照：

```text
1. 安装 maplibre-gl
2. 新建 MapViewport
3. 新建 MapLibreGlobalView
4. 接 OpenFreeMap Liberty
5. 用 map.project 驱动现有 Marker SVG
6. 用 map.project 驱动现有 Label SVG
7. 用 map.project 驱动 Route SVG
8. 实现 fitBounds
9. Camera view 独立出 Undo history
10. 建 Travel Clean style
11. 各洲改成 Camera shortcut
12. 保留 Natural Earth 作为 fallback / fill / print source
13. 新建 PolarMapView
14. 北极/南极迁到 PolarMapView
15. 将旧 MapCanvas 重构为 ImageMapView
16. image offset / calibration 清债
17. ProjectData 升级 V3
18. V2 → V3 migration
19. 重构 PNG / SVG export
20. 增加 Playwright E2E
21. 删除旧 D3 builtin global renderer
```

---

# 67. 删除旧代码的时机

只有当：

```text
MapLibreGlobalView
+
SVG overlay
+
PolarMapView
+
ImageMapView
```

全部通过验收后，再删除：

```text
D3 builtin world/continent renderer
旧 region projection presets
旧 builtin MapCanvas branch
```

不要提前删。

---

# 68. 最终 Definition of Done

## 普通全球地图

```text
MapLibre + OpenFreeMap
```

一张全球连续地图。

不再维护分洲底图。

---

## 快速区域

```text
亚洲 / 欧洲 / 非洲……
```

只是 Camera preset。

---

## 地点

```text
经纬度是真实地理位置
```

内置地图 Marker 不做视觉偏移。

---

## Route / Marker / Label

继续 SVG Overlay。

位置统一：

```text
map.project()
```

---

## Camera

```text
MapLibre 原生
```

不进入 Undo history。

---

## 极地

```text
北极 / 南极
```

使用独立极地 renderer。

---

## 自定义图片

继续：

```text
Free Image
Equirectangular
Affine Calibration
```

---

## Natural Earth

不再是主地图。

保留：

```text
fallback
分国 fill
print/export
```

---

## Export

MapLibre：

```text
完整 PNG
SVG Overlay
```

ImageMap：

```text
完整 PNG
完整 SVG
Overlay SVG
```

---

## 测试

必须通过：

```text
MapLibre zoom / pan / resize
Marker / Label / Route drift < 0.5 px
```

以及：

```text
ImageMap zero drift
Polar projection
Project migration
Export
```

---

# 69. 最终架构判断

如果完成后仍然存在：

```text
内置地图里自己计算 projection + zoom + pan
```

说明改造没有完成。

正确状态应是：

```text
普通全球地图：
MapLibre 负责所有地理投影和 Camera

旅行视觉：
SVG Overlay 负责 Route / Marker / Label

自定义图片：
ImageMapRenderer 负责图片空间

极地：
PolarMapRenderer 负责极区
```

这是 V3 应达到的最终结构。
