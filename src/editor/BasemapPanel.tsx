import React, { useRef, useState } from 'react';
import {
  BasemapConfig,
  BuiltinBasemap,
  CalibratedImageBasemap,
  Place,
  MapProjectionType,
  MapRegionType,
  CalibrationPoint,
  CalibrationTransform
} from '../types';
import { saveImageBlob, getImageObjectUrl } from '../map/storage/imageStore';
import { fitAffineTransform, checkControlPointsQuality } from '../map/transformer';
import { OFFICIAL_BASEMAP_REGISTRY, OFFICIAL_COMPLIANCE_NOTICE } from '../map/basemaps/registry';
import {
  Upload,
  Image as ImageIcon,
  Globe,
  Crosshair,
  AlertCircle,
  AlertTriangle,
  Trash2,
  RefreshCw,
  Maximize2,
  ShieldCheck,
  Map
} from 'lucide-react';

interface BasemapPanelProps {
  basemap: BasemapConfig;
  places: Place[];
  pickingPlaceId: string | null;
  onSelectPickingPlace: (placeId: string | null) => void;
  onChangeBasemap: (newBasemap: BasemapConfig) => void;
  onFitImage?: (w?: number, h?: number) => void;
}

export const BasemapPanel: React.FC<BasemapPanelProps> = ({
  basemap,
  places,
  pickingPlaceId,
  onSelectPickingPlace,
  onChangeBasemap,
  onFitImage
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [aspectRatioWarning, setAspectRatioWarning] = useState<string | null>(null);

  const themePresets = [
    { name: '极简米白', land: '#f1efe8', border: '#d5d2c8', ocean: '#ffffff' },
    { name: '经典雅灰', land: '#e2e8f0', border: '#cbd5e1', ocean: '#f8fafc' },
    { name: '淡蓝海洋', land: '#f3f4f6', border: '#e5e7eb', ocean: '#e0f2fe' },
    { name: '暗夜黑金', land: '#1e293b', border: '#334155', ocean: '#0f172a' }
  ];

  // Handle uploading custom image file
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const assetId = await saveImageBlob(file, file.name);
      const url = await getImageObjectUrl(assetId);

      const img = new Image();
      img.onload = () => {
        const w = img.naturalWidth || 1200;
        const h = img.naturalHeight || 800;
        const ratio = w / h;

        const isEquirect = Math.abs(ratio - 2.0) <= 0.3;
        if (isEquirect) {
          setAspectRatioWarning(null);
          onChangeBasemap({
            type: 'equirectangular-image',
            assetId,
            imageName: file.name,
            imageWidth: w,
            imageHeight: h,
            imageUrl: url || undefined
          });
        } else {
          setAspectRatioWarning(`当前上传图片比例约为 ${ratio.toFixed(2)}:1，不像完整标准经纬世界图 (通常为 2:1)。已推荐设为“多点仿射校准”或“自由底图”。`);
          onChangeBasemap({
            type: 'calibrated-image',
            assetId,
            imageName: file.name,
            imageWidth: w,
            imageHeight: h,
            imageUrl: url || undefined,
            controlPoints: []
          });
        }

        onFitImage?.(w, h);
      };
      if (url) img.src = url;
    } catch (err) {
      alert('上传底图失败：' + String(err));
    }
    e.target.value = '';
  };

  const handleSwitchToBuiltin = () => {
    onChangeBasemap({
      type: 'builtin',
      mapId: 'world',
      projection: 'equalEarth',
      region: 'world',
      landColor: '#f1efe8',
      borderColor: '#d5d2c8',
      oceanColor: '#ffffff'
    });
    onSelectPickingPlace(null);
    setAspectRatioWarning(null);
  };

  const handleSelectOfficialPreset = (presetId: string) => {
    const item = OFFICIAL_BASEMAP_REGISTRY.find(o => o.id === presetId);
    if (!item) return;

    if (item.id === 'builtin-world') {
      handleSwitchToBuiltin();
    }
  };

  // Re-run calibration
  const handleRecalculateCalibration = () => {
    if (basemap.type !== 'calibrated-image') return;
    const points = basemap.controlPoints || [];
    if (points.length < 3) {
      alert('至少需要 3 个控制点才能计算仿射变换。');
      return;
    }
    const fit = fitAffineTransform(points);
    if (fit) {
      onChangeBasemap({
        ...basemap,
        transform: fit.transform,
        errorPx: fit.errorPx
      });
    } else {
      alert('计算仿射变换失败，控制点可能近似共线，请选择更分散的地点。');
    }
  };

  // Delete single control point
  const handleDeleteControlPoint = (placeId: string) => {
    if (basemap.type !== 'calibrated-image') return;
    const updatedPoints = (basemap.controlPoints || []).filter(cp => cp.placeId !== placeId);
    let newTransform: CalibrationTransform | undefined = undefined;
    let newError: number | undefined = undefined;

    if (updatedPoints.length >= 3) {
      const fit = fitAffineTransform(updatedPoints);
      if (fit) {
        newTransform = fit.transform;
        newError = fit.errorPx;
      }
    }

    onChangeBasemap({
      ...basemap,
      controlPoints: updatedPoints,
      transform: newTransform,
      errorPx: newError
    });
  };

  // Current calibration quality check
  const calibrationQuality =
    basemap.type === 'calibrated-image'
      ? checkControlPointsQuality(basemap.controlPoints || [])
      : null;

  // Aspect ratio check for Equirectangular
  const isEquirectangular = basemap.type === 'equirectangular-image';
  const equirectangularRatio =
    isEquirectangular && basemap.imageWidth && basemap.imageHeight
      ? basemap.imageWidth / basemap.imageHeight
      : null;
  const isEquirectangularRatioBad =
    equirectangularRatio !== null && Math.abs(equirectangularRatio - 2.0) > 0.35;

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 space-y-6 text-xs text-slate-700">
      {/* 1. Basemap Mode Selection */}
      <section className="space-y-3">
        <h4 className="font-semibold text-slate-900 uppercase tracking-wider text-[11px] pb-1 border-b border-slate-200">
          底图模式选择
        </h4>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleSwitchToBuiltin}
            className={`p-2.5 rounded-lg border text-left flex items-start space-x-2 transition ${
              basemap.type === 'builtin'
                ? 'border-blue-500 bg-blue-50/50 text-blue-700 font-medium shadow-sm'
                : 'border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Globe size={16} className="mt-0.5 text-blue-600 shrink-0" />
            <div>
              <div className="font-semibold">内置矢量地图</div>
              <div className="text-[10px] text-slate-400 mt-0.5">世界/各大洲/北极极区</div>
            </div>
          </button>

          <button
            onClick={() => {
              if (basemap.type === 'builtin') {
                fileInputRef.current?.click();
              }
            }}
            className={`p-2.5 rounded-lg border text-left flex items-start space-x-2 transition ${
              basemap.type !== 'builtin'
                ? 'border-purple-500 bg-purple-50/50 text-purple-700 font-medium shadow-sm'
                : 'border-slate-200 hover:bg-slate-50'
            }`}
          >
            <ImageIcon size={16} className="mt-0.5 text-purple-600 shrink-0" />
            <div>
              <div className="font-semibold">自定义图片底图</div>
              <div className="text-[10px] text-slate-400 mt-0.5">群岛/海报/手绘导览图</div>
            </div>
          </button>
        </div>
      </section>

      {/* 2. Official Standard Basemap Registry Selector */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-semibold text-slate-800 flex items-center space-x-1">
            <Map size={13} className="text-blue-600" />
            <span>精选与官方视觉底图预置</span>
          </label>
        </div>

        <div className="grid grid-cols-1 gap-1.5">
          {OFFICIAL_BASEMAP_REGISTRY.map(item => {
            const isSelected = item.id === 'builtin-world' && basemap.type === 'builtin';

            return (
              <button
                key={item.id}
                onClick={() => handleSelectOfficialPreset(item.id)}
                className={`p-2 rounded-lg border text-left flex items-start justify-between transition ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50/40 text-blue-900 font-medium ring-1 ring-blue-400/40'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div>
                  <div className="font-semibold text-xs flex items-center space-x-1.5">
                    <span>{item.title}</span>
                    {item.approvalNumber && (
                      <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1 rounded font-mono">
                        {item.approvalNumber}
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{item.description}</div>
                </div>
                <div className="text-[10px] text-slate-400 font-mono ml-2 shrink-0">
                  {item.assetType.toUpperCase()}
                </div>
              </button>
            );
          })}
        </div>

        {/* Official Compliance Notice */}
        <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex items-start space-x-2 text-[10px] text-slate-500 leading-relaxed">
          <ShieldCheck size={14} className="text-blue-500 shrink-0 mt-0.5" />
          <span>{OFFICIAL_COMPLIANCE_NOTICE}</span>
        </div>
      </section>

      {/* 3A. Built-in Vector Map Options */}
      {basemap.type === 'builtin' && (
        <section className="space-y-4">
          <div>
            <label className="block text-slate-500 mb-1.5 font-medium">聚焦视角预设 (世界 + 七大洲)</label>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { id: 'world', label: '世界' },
                { id: 'asia', label: '亚洲' },
                { id: 'europe', label: '欧洲' },
                { id: 'africa', label: '非洲' },
                { id: 'north-america', label: '北美洲' },
                { id: 'south-america', label: '南美洲' },
                { id: 'oceania', label: '大洋洲' },
                { id: 'antarctica', label: '南极洲' }
              ].map(r => (
                <button
                  key={r.id}
                  onClick={() =>
                    onChangeBasemap({
                      ...basemap,
                      region: r.id as MapRegionType,
                      projection: r.id === 'antarctica' ? 'stereographic' : 'equalEarth'
                    })
                  }
                  className={`py-1.5 px-2 rounded-lg border text-center transition text-xs ${
                    basemap.region === r.id
                      ? 'bg-blue-50 border-blue-500 text-blue-600 font-medium'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Admin-1 State/Province Boundaries toggle for continents */}
          {basemap.region !== 'world' && (
            <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200">
              <div>
                <div className="font-medium text-slate-800 text-xs">显示省/州一级行政区边界</div>
                <div className="text-[10px] text-slate-500">在各大洲视图中呈现清晰低对比度省州分界线</div>
              </div>
              <input
                type="checkbox"
                checked={basemap.showAdmin1 !== false}
                onChange={e =>
                  onChangeBasemap({
                    ...basemap,
                    showAdmin1: e.target.checked
                  })
                }
                className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
              />
            </div>
          )}

          {/* Color by country toggle */}
          <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200">
            <div>
              <div className="font-medium text-slate-800 text-xs">分国色彩对比 (自动低饱和设色)</div>
              <div className="text-[10px] text-slate-500">相邻国家自动分配不同色块，避免整片陆地混淆</div>
            </div>
            <input
              type="checkbox"
              checked={basemap.enableColorByCountry ?? true}
              onChange={e =>
                onChangeBasemap({
                  ...basemap,
                  enableColorByCountry: e.target.checked
                })
              }
              className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
            />
          </div>

          <div>
            <label className="block text-slate-500 mb-1.5 font-medium">地理投影 (Projection)</label>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { id: 'equalEarth', label: 'Equal Earth (推荐)' },
                { id: 'naturalEarth', label: 'Natural Earth' },
                { id: 'azimuthalEquidistant', label: '北极方位等距 (极区)' },
                { id: 'stereographic', label: '极地立体投影' },
                { id: 'mercator', label: 'Mercator' }
              ].map(proj => (
                <button
                  key={proj.id}
                  onClick={() =>
                    onChangeBasemap({
                      ...basemap,
                      projection: proj.id as MapProjectionType
                    })
                  }
                  className={`py-1.5 px-2 rounded-lg border text-center transition ${
                    basemap.projection === proj.id
                      ? 'bg-blue-50 border-blue-500 text-blue-600 font-medium'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {proj.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-slate-500 mb-1.5 font-medium">底图配色主题</label>
            <div className="grid grid-cols-2 gap-2">
              {themePresets.map(theme => (
                <button
                  key={theme.name}
                  onClick={() =>
                    onChangeBasemap({
                      ...basemap,
                      landColor: theme.land,
                      borderColor: theme.border,
                      oceanColor: theme.ocean
                    })
                  }
                  className="p-2 rounded-lg border border-slate-200 hover:border-slate-400 flex items-center space-x-2 text-left transition"
                >
                  <div
                    className="w-5 h-5 rounded border border-slate-300 shrink-0"
                    style={{ backgroundColor: theme.land }}
                  />
                  <span className="text-slate-700 text-xs truncate">{theme.name}</span>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 3B. Custom Image Map Options */}
      {basemap.type !== 'builtin' && (
        <section className="space-y-4">
          <div className="p-3 bg-purple-50/50 rounded-lg border border-purple-100 flex items-center justify-between">
            <div>
              <div className="font-semibold text-slate-800">
                当前底图：{basemap.imageName || '自定义图片'}
              </div>
              <div className="text-[10px] text-slate-500">
                分辨率：{basemap.imageWidth} × {basemap.imageHeight} px
              </div>
            </div>
            <div className="flex items-center space-x-1.5">
              <button
                onClick={() => onFitImage?.(basemap.imageWidth, basemap.imageHeight)}
                className="px-2.5 py-1 bg-white border border-purple-200 text-purple-700 rounded-md text-xs hover:bg-purple-50 flex items-center space-x-1"
                title="缩放视口以完整展示整张底图"
              >
                <Maximize2 size={12} />
                <span>适应整图</span>
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-2.5 py-1 bg-purple-600 text-white rounded-md text-xs hover:bg-purple-700 shadow-sm"
              >
                换一张
              </button>
            </div>
          </div>

          {/* Mode Sub-Selector */}
          <div>
            <label className="block text-slate-500 mb-1.5 font-medium">图片定位工作模式</label>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: 'free-image', label: '自由底图 (手绘/导览)' },
                { id: 'equirectangular-image', label: '标准经纬世界图' },
                { id: 'calibrated-image', label: '多点仿射校准 (推荐)' }
              ].map(m => (
                <button
                  key={m.id}
                  onClick={() => {
                    if (m.id === 'calibrated-image') {
                      onChangeBasemap({
                        type: 'calibrated-image',
                        assetId: (basemap as any).assetId || '',
                        imageName: (basemap as any).imageName,
                        imageWidth: (basemap as any).imageWidth,
                        imageHeight: (basemap as any).imageHeight,
                        imageUrl: (basemap as any).imageUrl,
                        controlPoints: (basemap as any).controlPoints || []
                      });
                    } else if (m.id === 'equirectangular-image') {
                      onChangeBasemap({
                        type: 'equirectangular-image',
                        assetId: (basemap as any).assetId || '',
                        imageName: (basemap as any).imageName,
                        imageWidth: (basemap as any).imageWidth,
                        imageHeight: (basemap as any).imageHeight,
                        imageUrl: (basemap as any).imageUrl
                      });
                    } else {
                      onChangeBasemap({
                        type: 'free-image',
                        assetId: (basemap as any).assetId || '',
                        imageName: (basemap as any).imageName,
                        imageWidth: (basemap as any).imageWidth,
                        imageHeight: (basemap as any).imageHeight,
                        imageUrl: (basemap as any).imageUrl
                      });
                    }
                  }}
                  className={`py-2 px-1 rounded-lg border text-center transition text-[10.5px] ${
                    basemap.type === m.id
                      ? 'bg-purple-50 border-purple-500 text-purple-700 font-medium'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Mode A: Free Image Specific Controls */}
          {basemap.type === 'free-image' && (
            <div className="space-y-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="font-medium text-slate-800 text-[11px]">
                自由底图指定点位（点击地图标定）
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                适合手绘地图、旅游导览图、非标准群岛插画。点击下方地点旁的“点选定位”，再在画布上点击对应位置即可标定归一化坐标。
              </p>
              <div className="space-y-1.5 pt-1 max-h-52 overflow-y-auto">
                {places.map(p => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-1.5 bg-white rounded border border-slate-200"
                  >
                    <span className="font-medium truncate mr-2">{p.displayName}</span>
                    <button
                      onClick={() => onSelectPickingPlace(pickingPlaceId === p.id ? null : p.id)}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium flex items-center transition ${
                        pickingPlaceId === p.id
                          ? 'bg-amber-500 text-white animate-pulse'
                          : p.visualPosition
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-blue-50 text-blue-600 border border-blue-200'
                      }`}
                    >
                      <Crosshair size={11} className="mr-1" />
                      {pickingPlaceId === p.id
                        ? '请点选地图'
                        : p.visualPosition
                        ? '已标定 (重选)'
                        : '点选定位'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Mode B: Equirectangular */}
          {basemap.type === 'equirectangular-image' && (
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-[11px] space-y-2">
              <div className="font-medium text-slate-800">标准等距圆柱世界底图</div>
              <p className="text-slate-500 leading-relaxed">
                要求图片的四边严格对应：左边 -180°、右边 +180°、上边 +90°、下边 -90°。系统将自动按经纬度公式投射点位，无需任何校准。
              </p>

              {/* 2:1 Aspect Ratio Alert */}
              {isEquirectangularRatioBad && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-[10px] leading-relaxed flex items-start space-x-1.5">
                  <AlertTriangle size={14} className="shrink-0 text-amber-600 mt-0.5" />
                  <div>
                    <span className="font-semibold">图片长宽比可能不符：</span>
                    当前图片比例约为 {equirectangularRatio.toFixed(2)}:1，与完整标准经纬世界图 (2:1) 偏差较大。如果它是局部区域或群岛地图，请改用“多点仿射校准”或“自由底图”。
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Mode C: Multi-Point Calibrated Image */}
          {basemap.type === 'calibrated-image' && (
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-[11px] space-y-3">
              <div>
                <div className="font-semibold text-slate-800 text-xs">
                  多点仿射校准 (至少 3 点，推荐 4~8 点)
                </div>
                <p className="text-slate-500 leading-relaxed text-[10px] mt-0.5">
                  在已知局部地图上标定 3 个及以上控制点（选择东、西、南、北不同方位），系统将自动拟合仿射变换矩阵，并自动解算其他全部地点的精确坐标。
                </p>
              </div>

              {/* Status & Error Display */}
              <div className="flex items-center justify-between bg-white p-2 rounded border border-slate-200">
                <div>
                  <span className="text-slate-500">已标定控制点：</span>
                  <span className="font-bold text-slate-800 font-mono">
                    {basemap.controlPoints?.length || 0}
                  </span>
                  <span className="text-slate-400 text-[10px] ml-1">(至少 3 点)</span>
                </div>

                {basemap.errorPx !== undefined && (
                  <div className="flex items-center space-x-1">
                    <span className="text-slate-500">误差：</span>
                    <span
                      className={`px-1.5 py-0.5 rounded font-mono font-bold text-[10px] ${
                        basemap.errorPx < 15
                          ? 'bg-emerald-100 text-emerald-800'
                          : basemap.errorPx < 50
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {basemap.errorPx.toFixed(1)} px
                    </span>
                  </div>
                )}
              </div>

              {/* Geometric Quality Warning */}
              {calibrationQuality && !calibrationQuality.isValid && calibrationQuality.warning && (
                <div className="p-2 bg-amber-50 border border-amber-200 rounded text-amber-800 text-[10px] flex items-start space-x-1.5">
                  <AlertCircle size={14} className="shrink-0 text-amber-600 mt-0.5" />
                  <span>{calibrationQuality.warning}</span>
                </div>
              )}

              {/* Calibrated Points List */}
              {basemap.controlPoints && basemap.controlPoints.length > 0 && (
                <div className="space-y-1">
                  <label className="block text-[10px] font-medium text-slate-500">已登记控制点：</label>
                  <div className="max-h-36 overflow-y-auto space-y-1">
                    {basemap.controlPoints.map(cp => (
                      <div
                        key={cp.placeId}
                        className="flex items-center justify-between p-1.5 bg-white rounded border border-slate-200 text-[10px]"
                      >
                        <div className="truncate mr-2">
                          <span className="font-semibold text-slate-700">{cp.name}</span>
                          <span className="text-slate-400 font-mono ml-1.5">
                            ({cp.imageX}, {cp.imageY} px)
                          </span>
                        </div>
                        <button
                          onClick={() => handleDeleteControlPoint(cp.placeId)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                          title="移除此控制点"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Places Calibration Picker */}
              <div className="space-y-1.5 pt-1">
                <label className="block text-[10px] font-medium text-slate-500">
                  选择地点并在地图上标定：
                </label>
                <div className="max-h-44 overflow-y-auto space-y-1">
                  {places.map(p => {
                    const isCalibrated = basemap.controlPoints?.some(cp => cp.placeId === p.id);
                    const isPicking = pickingPlaceId === p.id;

                    return (
                      <div
                        key={p.id}
                        className="flex items-center justify-between p-1.5 bg-white rounded border border-slate-200"
                      >
                        <div className="truncate mr-2">
                          <span className="font-medium text-slate-800">{p.displayName}</span>
                          <span className="text-[9px] text-slate-400 block font-mono">
                            {p.lat.toFixed(2)}°, {p.lon.toFixed(2)}°
                          </span>
                        </div>
                        <button
                          onClick={() => onSelectPickingPlace(isPicking ? null : p.id)}
                          className={`px-2 py-1 rounded text-[10px] font-medium flex items-center transition ${
                            isPicking
                              ? 'bg-amber-500 text-white animate-pulse'
                              : isCalibrated
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100'
                          }`}
                        >
                          <Crosshair size={11} className="mr-1" />
                          {isPicking ? '请点击地图...' : isCalibrated ? '重新标定' : '标定该点'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Recalculate Button */}
              <div className="flex space-x-2 pt-1">
                <button
                  onClick={handleRecalculateCalibration}
                  disabled={!basemap.controlPoints || basemap.controlPoints.length < 3}
                  className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-md text-xs font-semibold flex items-center justify-center space-x-1 transition shadow-sm"
                >
                  <RefreshCw size={12} />
                  <span>重新拟合计算</span>
                </button>
                <button
                  onClick={() => onFitImage?.(basemap.imageWidth, basemap.imageHeight)}
                  className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-md text-xs font-medium flex items-center space-x-1 transition"
                >
                  <Maximize2 size={12} />
                  <span>居中全图</span>
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Hidden File Input for Custom Image Upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        onChange={handleImageUpload}
        className="hidden"
      />
    </div>
  );
};
