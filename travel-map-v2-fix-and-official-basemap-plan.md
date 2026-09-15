# travel-map V2 修复与官方标准地图接入方案

> 目标：先修正当前 V2 的正确性问题，再评估并接入自然资源部标准地图服务系统的世界地图、各洲地图作为“官方视觉底图”。不要简单删除现有 `world.json`。

---

## 1. 当前版本判断

V2 的方向是对的，已经加入：

- `BasemapConfig`
- `CameraState`
- `CoordinateTransformer`
- 自定义图片底图
- IndexedDB 图片存储
- 极地投影
- Fit to Points
- Undo transaction
- 标签避让
- 真正拖拽排序
- 自由底图 / 标准经纬世界图 / 仿射校准三种模式

但现在仍有几项 P0 级问题，会直接影响真实使用。

---

# 2. P0：必须立即修复

## 2.1 仿射校准目前只有数学函数，缺少完整交互链路

当前已经有：

```ts
fitAffineTransform(points)
CalibratedImageTransformer
```

但没有真正完成：

```text
选择控制点
→ 在地图上点击对应位置
→ 保存 CalibrationPoint
→ 至少 3 点
→ 执行 fitAffineTransform
→ 写回 transform
→ 自动定位其他地点
```

当前 `handlePlacePicked()` 主要只写 `visualPosition`，没有为 `calibrated-image` 建立 `controlPoints` 和 `transform`。

### 修复要求

针对 `calibrated-image` 单独实现完整工作流。

建议 UI：

```text
多点仿射校准
至少 3 点，推荐 4–8 点

圣克里斯托瓦尔岛   [标定]
伊莎贝拉岛         [标定]
弗雷里安纳岛       [标定]
圣地亚哥岛         [标定]

已标定：3 / 4
[重新计算校准]
```

点击“标定”后：

```text
鼠标变为十字
→ 点击地图位置
→ 保存：
{
  placeId,
  name,
  lat,
  lon,
  imageX,
  imageY
}
```

每增加/移动一个控制点后：

```ts
const result = fitAffineTransform(controlPoints)
```

成功后写回：

```ts
basemap.transform = result.transform
basemap.errorPx = result.errorPx
```

---

## 2.2 “三点仿射校准”改名为“多点仿射校准”

3 个非共线点只是数学最低条件。

3 点刚好能唯一确定二维仿射变换，因此对这 3 个训练点本身的误差可能接近 0，但这并不代表第四个地点准确。

### UI 建议

```text
多点仿射校准
至少 3 点，推荐 4–8 点
```

并提示：

```text
3 点只能完成基础拟合；
4–8 个分散控制点更适合评估实际地图误差。
```

---

## 2.3 控制点必须做几何质量检查

控制点不能：

- 全部集中在同一角落
- 近似共线
- 距离过近

如果近似共线，提示：

```text
控制点分布过于接近直线，无法稳定求解仿射变换。
请选择分布更分散的地点。
```

推荐控制点分布：

```text
西侧 1 点
东侧 1 点
北侧或南侧 1 点
再补 1–3 个中间点
```

---

## 2.4 Fit to Points 算法要修

如果当前逻辑是：

```ts
Math.max(
  availWidth / ptsWidth,
  availHeight / ptsHeight
)
```

这是错的。

应改成：

```ts
const zoomX = availWidth / ptsWidth;
const zoomY = availHeight / ptsHeight;
const zoom = Math.min(zoomX, zoomY);
```

因为必须同时满足横向和纵向都能装进画布。

### 单点 Fit 也统一修正

若 camera 变换为：

```text
screenX = (mapX - width/2) * zoom + width/2 + panX
```

则单点居中应使用：

```ts
panX = -(mapX - width / 2) * zoom;
panY = -(mapY - height / 2) * zoom;
```

---

## 2.5 自由底图禁止 geodesic

自由底图依赖：

```ts
place.visualPosition
```

而 geodesic 会产生一批没有 `place.visualPosition` 的中间经纬度点。

因此自由底图下球面测地线没有可靠数学意义。

### 必须修改

当：

```ts
basemap.type === 'free-image'
```

时：

```text
禁用 geodesic
```

自动改用：

```text
straight-screen
```

或：

```text
decorative-curve
```

UI 提示：

```text
自由底图没有统一地理投影，不能计算真实球面路线。
```

---

## 2.6 Marker 拖动后路线端点必须同步

当前 Marker 使用：

```ts
manualOffsetX
manualOffsetY
```

如果 RouteLayer 不读取这两个值，就会出现：

```text
红点已移动
路线仍连在旧位置
```

### 修复

建立统一视觉锚点：

```ts
visualAnchor = transformer.project(...) + manualOffset
```

Marker、Route endpoint、Label leader line 共用同一个视觉锚点函数。

---

## 2.7 自定义底图刷新后不能丢失

图片 Blob 存 IndexedDB 是对的，但 `blob:` URL 是临时 URL，不应持久化。

### 错误模式

```text
ProjectData 保存 blob:https://...
刷新页面
旧 blob URL 失效
```

### 正确模式

持久数据只保存：

```ts
assetId
imageName
imageWidth
imageHeight
```

运行时 URL 单独维护：

```ts
runtimeImageUrl
```

页面启动时永远：

```text
assetId
→ IndexedDB
→ getImageObjectUrl()
→ fresh blob URL
```

不要把 `imageUrl` 写入 localStorage / JSON 项目文件。

---

## 2.8 项目 JSON 不得声称“任意电脑 100% 恢复”

当前 JSON 不包含真正图片 Blob。

换电脑以后 `assetId` 没有对应 IndexedDB 数据。

### 临时正确文案

```text
JSON 可恢复项目参数。
自定义底图图片保存在当前浏览器，本 JSON 不包含图片文件。
```

### 后续实现 `.travelmap`

建议本质为 ZIP：

```text
trip.travelmap
├── project.json
└── assets/
    └── basemap.svg
```

这样才能真正跨电脑恢复。

---

# 3. P1：下一阶段修复

## 3.1 “随地图等比缩放”模式当前不完整

Marker / Label 已在 Camera Layer 外。

如果 `map-scaled` 分支没有正确套用 camera zoom/pan，就应该：

### 推荐方案

暂时删除 `map-scaled`，只保留：

```text
screen-fixed
```

直到真正实现。

---

## 3.2 路线线宽不要随 zoom 无限变粗

RouteLayer 若仍在 camera transform 内，建议 path 加：

```svg
vector-effect="non-scaling-stroke"
```

箭头 marker 也单独检查缩放行为。

---

## 3.3 自定义图片上传后自动 Fit Image

当前例如：

```text
2160 × 2160
```

图片可能大于画布。

上传/更换底图后应：

```text
自动 Fit Image
重置 camera
```

并使用完整显示图片的 contain/meet 行为，不要默认 `slice` 裁掉地图边缘。

---

## 3.4 标准经纬世界图必须增加合法性提示

该模式只适用于完整世界等距圆柱图：

```text
左 = -180°
右 = +180°
上 = +90°
下 = -90°
```

公式：

```ts
x = (lon + 180) / 360 * width;
y = (90 - lat) / 180 * height;
```

不适用于：

- 加拉帕戈斯局部图
- 欧洲区域图
- 中国地图
- 北极投影图
- 手绘图
- 景区图

完整标准世界图通常接近 2:1。

如果上传 2160×2160 之类图片，应提示：

```text
这张图片比例不像完整标准经纬世界图。
如果它是局部地图，请改用“多点仿射校准”或“自由底图”。
```

不要强制阻止，但必须警告。

---

# 4. 三种图片底图模式的最终定义

## 自由底图

适用：

- 插画地图
- 导览图
- 变形地图
- 艺术地图
- 无投影信息地图

工作方式：

```text
每个地点人工点击定位
```

路线只允许：

```text
平面直线
装饰曲线
```

---

## 标准经纬世界图

只适用完整世界 Equirectangular / Plate Carrée 图。

用户无需校准，系统按经纬度公式定位。

---

## 多点仿射校准

适用：

- 正规局部地图
- 区域地图
- 群岛地图
- 各洲地图
- 有地理比例关系但不是完整世界图的图片

要求：

```text
至少 3 点
推荐 4–8 点
```

控制点尽量分散。

---

# 5. 自然资源部标准地图服务系统接入建议

## 5.1 可以用，但不要简单替换 world.json

建议把该网站作为“官方标准视觉底图来源”。

不要直接：

```text
删除 world.json
换成几张 JPG
```

正确架构是：

```text
计算地图 + 官方视觉底图
```

### 计算地图

继续保留：

```text
world.json / GeoJSON / TopoJSON
```

负责：

- 经纬度投影
- Fit to Points
- 路线计算
- 数学空间
- 无图片模式

### 官方视觉底图

新增：

```text
官方标准世界地图
官方标准各洲地图
```

负责：

- 最终视觉
- 出版参考
- 国界样式
- 分国/分洲设色
- 导出展示

---

# 6. 官方站地图格式兼容性

公开资料显示，自然资源部标准地图服务系统主要提供：

```text
JPG
EPS
```

## JPG

浏览器可以直接使用。

适合作为图片底图。

但 JPG 本身通常不包含：

```text
投影信息
地理坐标系
经纬度边界元数据
```

所以仍需要明确：

```text
标准经纬世界图
多点仿射校准
自由底图
```

不能因为是官方地图就默认能直接做经纬度映射。

---

## EPS

浏览器不能直接渲染 EPS。

不能直接：

```html
<image href="xxx.eps">
```

### 推荐用途

EPS 作为高质量源文件。

离线转换为：

```text
SVG
```

或：

```text
PNG / WebP
```

### 对本项目最理想

如果目标是：

```text
分国设色
无国名
高质量矢量
```

技术上最理想的是：

```text
EPS → SVG
```

然后作为内置视觉底图。

---

# 7. 合规提示必须加入产品

官方标准地图说明明确：

- 可免费浏览、下载标准地图
- 直接使用标准地图时需要标注审图号
- 对地图内容进行编辑，包括放大、缩小、裁切等改动，公开使用前需要按要求送审

因此产品中应加入说明：

```text
标准地图素材的公开使用应遵循原地图审图号及相关地图管理要求。
对地图内容进行编辑后公开使用，可能需要重新审核。
```

不要把“技术上能改”误写成“改完仍可直接公开使用”。

---

# 8. “分国设色但没有国名文字”是最合适的视觉底图

原因：

- 国界清楚
- 不和用户地点标签冲突
- 视觉层级干净
- 适合路线和 Marker 叠加

### 资源优先级

第一优先：

```text
官方直接提供：分国设色 + 无国名文字
```

第二优先：

```text
官方自助制图生成无国名版本
```

但自助制图生成的地图，官方说明要求公开使用前送审。

第三优先：

```text
EPS → SVG 后删除文字图层
```

技术上可行，但公开使用的合规要求需单独处理。

---

# 9. 世界地图和各洲地图的接入方式

建议新建：

```text
src/map/basemaps/registry.ts
```

示例：

```ts
export const builtinBasemapRegistry = [
  {
    id: 'official-world',
    title: '官方标准世界地图',
    assetPath: '/basemaps/world.svg',
    assetType: 'svg',
    calibrationMode: 'calibrated',
    approvalNumber: 'GS(...)',
    sourceUrl: '...'
  }
];
```

每张预设地图至少保存：

```ts
{
  id,
  title,
  assetPath,
  assetType,
  calibrationMode,
  transform?,
  controlPoints?,
  projectionHint?,
  approvalNumber?,
  sourceUrl?
}
```

---

# 10. 官方地图建议的资源工作流

不要把 EPS 直接丢进前端。

推荐：

```text
官方站下载 EPS
↓
保留原始 EPS 归档
↓
转换为 SVG
↓
确认 SVG 没有被栅格化
↓
保留必要边界与填色
↓
加入 /public/basemaps/
↓
建立 registry
↓
为每张图做一次校准
↓
保存 transform / controlPoints
↓
前端直接调用
```

如果只有 JPG：

```text
JPG
↓
/public/basemaps/
↓
多点仿射校准
↓
保存 transform
```

预设地图只需校准一次，不要让用户每次重新标点。

---

# 11. 世界图与各洲图的建议

## 世界地图

优先寻找：

```text
完整世界图
分国设色
无国名文字
```

如果官方站没有完全匹配版本，不要默认自行删文字后仍视为“原标准地图”。

---

## 各洲地图

如能取得：

```text
亚洲
欧洲
非洲
北美洲
南美洲
大洋洲
```

分别作为预设视觉底图。

除非明确知道某一张图是标准经纬投影，否则默认用：

```text
多点仿射校准
```

不要猜投影。

---

# 12. 审图号和来源元数据要保留

对于官方标准地图，保存：

```text
审图号
来源 URL
原始文件名
下载时间
```

可以提供：

```text
显示审图号
```

开关，但不要在资源层删除这些信息。

---

# 13. 当前 Galapagos 地图怎么处理

当前：

```text
Galapagos_Islands_topographic_map-en.svg
2160 × 2160
```

不要使用：

```text
标准经纬世界图
```

因为它不是完整世界地图。

优先：

```text
多点仿射校准
```

推荐至少 4 个控制点：

```text
西侧一个
东侧一个
北侧一个
南侧一个
```

尽量覆盖整张图。

如果地图存在明显艺术变形，改用：

```text
自由底图
```

---

# 14. 上传图片后的自动模式推荐

如果图片接近 2:1：

```text
这张图可能是完整经纬世界图。
是否尝试“标准经纬世界图”？
```

如果明显不是：

```text
这张图不像完整世界地图。
推荐：
1. 多点仿射校准
2. 自由底图
```

不要自动强制切换。

---

# 15. 测试必须补上

加入：

```text
Vitest
Playwright
```

至少覆盖：

```text
fitToPoints
free-image route
calibrated-image
equirectangular-image
refresh custom image
IndexedDB restore
project export/import
route endpoint manualOffset
antimeridian
polar projection
undo transaction
```

---

# 16. 本轮验收标准

## A. 多点仿射校准

```text
上传 Galapagos 地图
→ 选择多点仿射校准
→ 标 4 个控制点
→ 自动计算 transform
→ 第 5 个地点自动落在合理位置
```

## B. 自由底图

```text
上传手绘地图
→ 手工放置 A/B/C
→ 路线正常
→ geodesic 不可选
```

## C. Fit

```text
适配全部地点
```

后所有 Marker 必须位于可视画布内。

## D. 刷新

```text
上传自定义地图
→ 放置地点
→ 刷新浏览器
```

必须保留：

```text
底图
地点
Camera
```

## E. 项目导出

在 `.travelmap` 实现前，JSON UI 不得声称包含图片资产。

---

# 17. 开发顺序

严格按下面顺序：

```text
1. 修 FitToPoints
2. 修 custom image 持久化
3. 修 free-image + geodesic
4. 修 Route endpoint manualOffset
5. 完成 calibrated-image 全工作流
6. 增加控制点质量检查
7. 增加图片 Fit Image
8. 修路线线宽 zoom
9. 增加标准经纬图合法性提示
10. 补测试
11. 再开始导入官方标准地图素材
```

不要反过来。

---

# 18. 最终产品架构要求

不要把“换地图素材”理解成：

```text
删掉 world.json
换几张 JPG
```

正确目标是：

```text
Geo / TopoJSON
负责数学与地理空间

官方标准地图 JPG / SVG
负责最终视觉表现
```

两层必须解耦。

先修 correctness，再换视觉素材。
