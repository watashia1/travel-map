# 旅行足迹 / 路线地图生成器 (Travel Map Generator)

> 纯前端、无后端的轻量中文经纬度旅行路线视觉编辑器。
> 100% 运行在浏览器端，保护隐私，支持中英文地名检索、多格式经纬度坐标解析、自由拖拽微调、多倍率与 SVG 矢量导出，一键部署到 GitHub Pages。

[![Deploy Travel Map to GitHub Pages](https://github.com/watashia1/travel-map/actions/workflows/deploy.yml/badge.svg)](https://github.com/watashia1/travel-map/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## ✨ 核心特性

- **纯前端零依赖**：无服务器、无数据库、无登录注册、无在线地图 API Key 限制，100% 在浏览器沙盒中离线运行。
- **经纬度优先引擎**：
  - **形式 A：地名输入**（如 `东京`、`奥斯陆`、`北京`、`Cambridge`）自动匹配本地离线地名库；多重同名支持歧义消除。
  - **形式 B：十进制经纬度**（如 `35.6762, 139.6503`）。
  - **形式 C：经纬度 + 自定义名称**（如 `43.0618, 141.3545 | 札幌`、`78.2232, 15.6469 | 朗伊尔城`）。
  - **形式 D：度分秒 DMS**（如 `35°40'34"N, 139°39'1"E | 东京`）。
- **多种世界与区域投影**：
  - 支持 **Equal Earth**（等面积世界投影，推荐）、**Natural Earth** 以及 **Mercator** 实时切换。
  - 内置视角预设：世界全景、亚洲、欧洲、中国、日本、北极极地。
- **可视化拖拽与微调**：
  - **拖动地名标签**：自由调整文字避让拥挤区域，独立保存偏移，不改变实际经纬度。
  - **拖动红点微调**：鼠标拖动画布上的标记点微调视觉位置，并支持一键恢复自动经纬度位置。
  - **拖动地点排序**：左侧地点卡片支持上下调整与拖动排序，路线即时按新顺序平滑重绘。
- **完整撤销 / 重做 (Undo / Redo)**：
  - 支持快捷键 `Ctrl + Z`（撤销）与 `Ctrl + Y` / `Ctrl + Shift + Z`（重做），记录位移、删改与样式调整。
- **专业级高清与矢量导出**：
  - **SVG 纯矢量**：保留原生 `<text>` 文本节点与贝塞尔曲线，可在 Adobe Illustrator 或 Figma 中无损二次排版。
  - **PNG 高清位图**：支持 1×、2×、4× 印刷级精度，以及最高 **6000px+** 自定义超高分辨率导出。
  - **仅导出透明路线图层**：底图完全透明，仅保留红点、文字和路线连线，可直接作为图层置入海报底图。
- **项目备份与本地持久化**：
  - 编辑状态自动保存于浏览器 `localStorage`，刷新页面数据不丢失。
  - 支持一键导出 `my-trip.json` 项目存档与导入还原。

---

## 🚀 官方验收测试样例

在输入框粘贴以下内容并点击【生成路线 / 添加】：

```text
东京
43.0618, 141.3545 | 札幌
奥斯陆
64.1466, -21.9426 | 雷克雅未克
78.2232, 15.6469 | 朗伊尔城
```

系统将自动识别：
1. `东京` 与 `奥斯陆` 自动命中离线地名库并定位于日本和挪威。
2. `札幌`、`雷克雅未克`、`朗伊尔城` 自动提取经纬度与名称。
3. 按照顺序绘制航线：东京 → 札幌 → 奥斯陆 → 雷克雅未克 → 朗伊尔城。

---

## 🛠 本地开发与运行

项目基于 **Vite + React 18 + TypeScript + Tailwind CSS + D3-Geo** 构建。

```bash
# 1. 安装依赖
npm install

# 2. 启动本地开发服务器
npm run dev

# 3. 生产环境编译打包
npm run build

# 4. 本地静态预览
npm run preview
```

---

## 🌐 部署到 GitHub Pages

项目已配置 `.github/workflows/deploy.yml` 自动化部署工作流。

### 首次推送与部署步骤：

1. **在 GitHub 上创建空仓库**：
   - 访问 [https://github.com/new](https://github.com/new)
   - Repository name 填入：`travel-map`
   - 选择 **Public**
   - **不要**勾选 "Add a README" 或 ".gitignore"（保持完全空白）
   - 点击 **Create repository**

2. **在本地终端推送代码**：
   ```bash
   git add .
   git commit -m "feat: complete travel map generator V1.0"
   git push -u origin main
   ```

3. **开启 GitHub Pages (仅需设置一次)**：
   - 打开您的 GitHub 仓库页面：`https://github.com/watashia1/travel-map`
   - 点击上方 **Settings** ➔ 左侧侧边栏 **Pages**
   - 在 **Build and deployment** 下方的 **Source** 下拉框中，选择 **GitHub Actions**
   - 稍等约 1~2 分钟，GitHub Actions 自动构建完成后，即可通过以下地址在线使用：

👉 **`https://watashia1.github.io/travel-map/`**

---

## 📄 开源许可证

本项目采用 [MIT 许可证](LICENSE)。