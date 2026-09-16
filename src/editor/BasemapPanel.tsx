import React, { useRef, useState } from 'react';
import {
  BasemapConfig,
  MapLibreBasemap,
  PolarBasemap,
  CalibratedImageBasemap,
  Place,
  CalibrationTransform,
  MapLibreStyleId,
} from '../types';
import { deleteImageBlob, saveImageBlob, getImageObjectUrl } from '../map/storage/imageStore';
import { fitAffineTransform, checkControlPointsQuality } from '../map/transformer';
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
  Compass,
  Layers,
} from 'lucide-react';

interface BasemapPanelProps {
  basemap: BasemapConfig;
  places: Place[];
  pickingPlaceId: string | null;
  onSelectPickingPlace: (placeId: string | null) => void;
  onChangeBasemap: (newBasemap: BasemapConfig) => void;
  onFitImage?: () => void;
}

export const BasemapPanel: React.FC<BasemapPanelProps> = ({
  basemap,
  places,
  pickingPlaceId,
  onSelectPickingPlace,
  onChangeBasemap,
  onFitImage,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [aspectRatioWarning, setAspectRatioWarning] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const isBuiltinMapLibre = basemap.type === 'builtin-maplibre' || basemap.type === 'builtin';
  const isPolar = basemap.type === 'polar';
  const isCustomImage =
    basemap.type === 'free-image' ||
    basemap.type === 'equirectangular-image' ||
    basemap.type === 'calibrated-image';

  // Handle uploading custom image file
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadError(null);
      const assetId = await saveImageBlob(file, file.name);
      const url = await getImageObjectUrl(assetId);
      if (!url) throw new Error('图片资源保存后无法读取');

      const img = new Image();
      img.onload = () => {
        const w = img.naturalWidth || 1200;
        const h = img.naturalHeight || 800;
        const ratio = w / h;

        setAspectRatioWarning(
          Math.abs(ratio - 2.0) <= 0.3
            ? '这张图片比例接近 2:1。如果它确实是完整的等距圆柱世界地图，可手动选择“标准经纬世界图”。'
            : null
        );

        // Every arbitrary image is safe in free-image mode. Geographic modes
        // require an explicit user choice and must never be inferred by ratio.
        onChangeBasemap({
          type: 'free-image',
          assetId,
          imageName: file.name,
          imageWidth: w,
          imageHeight: h,
          imageUrl: url,
        });
        onFitImage?.();
      };
      img.onerror = () => {
        setUploadError('无法读取该图片。请尝试 PNG、JPEG、WebP，或检查 SVG 是否有效。');
        void deleteImageBlob(assetId).catch((error) => {
          console.warn('Failed to clean up unreadable image asset', error);
        });
      };
      img.src = url;
    } catch (err) {
      setUploadError('上传底图失败：' + String(err));
    }
    e.target.value = '';
  };

  const handleSwitchToMapLibre = (styleId: MapLibreStyleId = 'travel-clean') => {
    onChangeBasemap({
      type: 'builtin-maplibre',
      styleId,
      enableCountryFill: true,
      showAdmin1: true,
    });
    onSelectPickingPlace(null);
  };

  const handleSwitchToPolar = (pole: 'north' | 'south') => {
    onChangeBasemap({
      type: 'polar',
      pole,
      projection: pole === 'north' ? 'azimuthalEquidistant' : 'stereographic',
      landColor: '#f8fafc',
      borderColor: '#cbd5e1',
      oceanColor: '#e0f2fe',
    });
    onSelectPickingPlace(null);
  };

  // Re-run calibration
  const handleRecalculateCalibration = () => {
    if (basemap.type !== 'calibrated-image') return;
    const points = basemap.controlPoints || [];
    if (points.length < 3) {
      alert('至少需要 3 个控制点才能计算仿射变换。');
      return;
    }
    const quality = checkControlPointsQuality(points);
    if (!quality.isValid) {
      alert(quality.warning || '控制点分布无效，请重新选择。');
      return;
    }
    const fit = fitAffineTransform(points);
    if (fit) {
      onChangeBasemap({
        ...basemap,
        transform: fit.transform,
        errorPx: fit.errorPx,
      });
    } else {
      alert('计算仿射变换失败，控制点可能近似共线，请选择更分散的地点。');
    }
  };

  // Delete single control point
  const handleDeleteControlPoint = (placeId: string) => {
    if (basemap.type !== 'calibrated-image') return;
    const updatedPoints = (basemap.controlPoints || []).filter((cp) => cp.placeId !== placeId);
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
      errorPx: newError,
    });
  };

  const calibrationQuality =
    basemap.type === 'calibrated-image'
      ? checkControlPointsQuality(basemap.controlPoints || [])
      : null;

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 space-y-6 text-xs text-slate-700">
      {/* 1. Basemap Mode Selector */}
      <section className="space-y-3">
        <h4 className="font-semibold text-slate-900 uppercase tracking-wider text-[11px] pb-1 border-b border-slate-200">
          底图模式选择
        </h4>

        <div className="grid grid-cols-3 gap-2">
          {/* A. Builtin Global MapLibre */}
          <button
            onClick={() => handleSwitchToMapLibre('travel-clean')}
            className={`p-2.5 rounded-lg border text-left flex flex-col justify-between transition ${
              isBuiltinMapLibre
                ? 'border-blue-500 bg-blue-50/50 text-blue-700 font-medium shadow-sm'
                : 'border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Globe size={16} className="text-blue-600 mb-1.5" />
            <div>
              <div className="font-semibold text-[11px]">全球连续地图</div>
              <div className="text-[10px] text-slate-400 mt-0.5">矢量瓦片无级缩放</div>
            </div>
          </button>

          {/* B. Polar Specialty */}
          <button
            onClick={() => handleSwitchToPolar('north')}
            className={`p-2.5 rounded-lg border text-left flex flex-col justify-between transition ${
              isPolar
                ? 'border-cyan-500 bg-cyan-50/50 text-cyan-700 font-medium shadow-sm'
                : 'border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Compass size={16} className="text-cyan-600 mb-1.5" />
            <div>
              <div className="font-semibold text-[11px]">极地专题地图</div>
              <div className="text-[10px] text-slate-400 mt-0.5">北极 / 南极专有投影</div>
            </div>
          </button>

          {/* C. Custom Image Basemap */}
          <button
            onClick={() => {
              if (!isCustomImage) {
                fileInputRef.current?.click();
              }
            }}
            className={`p-2.5 rounded-lg border text-left flex flex-col justify-between transition ${
              isCustomImage
                ? 'border-purple-500 bg-purple-50/50 text-purple-700 font-medium shadow-sm'
                : 'border-slate-200 hover:bg-slate-50'
            }`}
          >
            <ImageIcon size={16} className="text-purple-600 mb-1.5" />
            <div>
              <div className="font-semibold text-[11px]">自定义图片底图</div>
              <div className="text-[10px] text-slate-400 mt-0.5">手绘/海报/仿射校准</div>
            </div>
          </button>
        </div>
      </section>

      {/* 2A. MapLibre Vector Map Controls */}
      {isBuiltinMapLibre && (
        <section className="space-y-4">
          <div className="p-3 bg-blue-50/40 rounded-lg border border-blue-100 space-y-3">
            <div className="font-semibold text-slate-800 text-xs flex items-center justify-between">
              <span>全球矢量与切片底图引擎</span>
              <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-mono">
                连续缩放
              </span>
            </div>

            <div>
              <label className="block text-slate-500 mb-1.5 font-medium">底图视觉风格与源</label>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: 'travel-clean', label: '旅行极简 (高速 CDN)' },
                  { id: 'natural-earth', label: '离线内置矢量 (免外网)' },
                  { id: 'liberty', label: 'OpenFreeMap 彩色' },
                  { id: 'positron', label: 'OpenFreeMap 白底' },
                  { id: 'osm-standard', label: '标准 OpenStreetMap' },
                ].map((s) => {
                  const currentStyleId = (basemap as MapLibreBasemap).styleId || 'travel-clean';
                  const isSelected = currentStyleId === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() =>
                        onChangeBasemap({
                          ...basemap,
                          type: 'builtin-maplibre',
                          styleId: s.id as MapLibreStyleId,
                        })
                      }
                      className={`py-2 px-1.5 rounded-lg border text-center transition text-[11px] ${
                        isSelected
                          ? 'bg-blue-50 border-blue-500 text-blue-600 font-medium'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Country Fill Layer Toggle */}
            <div className="flex items-center justify-between pt-1">
              <div>
                <div className="font-medium text-slate-800 text-xs">分国色彩对比 (柔和设色)</div>
                <div className="text-[10px] text-slate-500">
                  采用 Natural Earth 多国配色填充，海陆分明
                </div>
              </div>
              <input
                type="checkbox"
                checked={(basemap as MapLibreBasemap).enableCountryFill ?? true}
                onChange={(e) =>
                  onChangeBasemap({
                    ...basemap,
                    type: 'builtin-maplibre',
                    styleId: (basemap as MapLibreBasemap).styleId || 'travel-clean',
                    enableCountryFill: e.target.checked,
                  })
                }
                className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
              />
            </div>

            {/* Admin-1 Provincial Boundary Toggle */}
            <div className="flex items-center justify-between pt-1 border-t border-blue-100/60">
              <div>
                <div className="font-medium text-slate-800 text-xs">显示省/州一级行政区边界</div>
                <div className="text-[10px] text-slate-500">放大后呈现清晰低对比度省州分界线</div>
              </div>
              <input
                type="checkbox"
                checked={(basemap as MapLibreBasemap).showAdmin1 !== false}
                onChange={(e) =>
                  onChangeBasemap({
                    ...basemap,
                    type: 'builtin-maplibre',
                    styleId: (basemap as MapLibreBasemap).styleId || 'travel-clean',
                    showAdmin1: e.target.checked,
                  })
                }
                className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
              />
            </div>
          </div>

          {/* Privacy & Attribution Notice */}
          <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-[10px] text-slate-500 leading-relaxed space-y-1">
            <div className="font-semibold text-slate-600 flex items-center space-x-1">
              <ShieldCheck size={12} className="text-emerald-600" />
              <span>数据隐私与服务说明</span>
            </div>
            <div>
              地点与旅行路线数据完全保存在本地浏览器中。浏览在线矢量地图时，浏览器直接请求 OpenFreeMap
              公共开放切片服务（无商业跟踪，无 API Key 限制）。
            </div>
          </div>
        </section>
      )}

      {/* 2B. Polar Basemap Controls */}
      {isPolar && (
        <section className="space-y-4">
          <div className="p-3 bg-cyan-50/40 rounded-lg border border-cyan-100 space-y-3">
            <div className="font-semibold text-slate-800 text-xs flex items-center justify-between">
              <span>极地专用投影地图</span>
              <span className="text-[9px] bg-cyan-100 text-cyan-800 px-1.5 py-0.5 rounded font-mono">
                方位立体投影
              </span>
            </div>

            <div>
              <label className="block text-slate-500 mb-1.5 font-medium">极区选择</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'north', label: '北极 (方位等距投影)' },
                  { id: 'south', label: '南极 (立体极射投影)' },
                ].map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleSwitchToPolar(p.id as 'north' | 'south')}
                    className={`py-2 px-2 rounded-lg border text-center transition text-xs ${
                      (basemap as PolarBasemap).pole === p.id
                        ? 'bg-cyan-50 border-cyan-500 text-cyan-700 font-medium'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="text-[10px] text-slate-500 leading-relaxed pt-1">
              极地路线专门采用以极点为中心的极射/方位等距投影，彻底避免普通墨卡托地图在南北两极产生的巨大几何形变。
            </div>
          </div>
        </section>
      )}

      {/* 2C. Custom Image Map Controls */}
      {isCustomImage && (
        <section className="space-y-4">
          <div className="p-3 bg-purple-50/50 rounded-lg border border-purple-100 flex items-center justify-between">
            <div>
              <div className="font-semibold text-slate-800">
                当前底图：{(basemap as any).imageName || '自定义图片'}
              </div>
              <div className="text-[10px] text-slate-500">
                分辨率：{(basemap as any).imageWidth} × {(basemap as any).imageHeight} px
              </div>
            </div>
            <div className="flex items-center space-x-1.5">
              <button
                onClick={() => onFitImage?.()}
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

          {aspectRatioWarning && (
            <div className="flex items-start space-x-1.5 rounded-lg border border-blue-200 bg-blue-50 p-2.5 text-[10px] leading-relaxed text-blue-800">
              <AlertCircle size={14} className="mt-0.5 shrink-0 text-blue-600" />
              <span>{aspectRatioWarning}</span>
            </div>
          )}

          {uploadError && (
            <div role="alert" className="flex items-start space-x-1.5 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-[10px] leading-relaxed text-rose-800">
              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-rose-600" />
              <span>{uploadError}</span>
            </div>
          )}

          {/* Mode Sub-Selector */}
          <div>
            <label className="block text-slate-500 mb-1.5 font-medium">图片定位工作模式</label>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: 'free-image', label: '自由底图 (手绘/导览)' },
                { id: 'equirectangular-image', label: '标准经纬世界图' },
                { id: 'calibrated-image', label: '多点仿射校准 (推荐)' },
              ].map((m) => (
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
                        controlPoints: (basemap as any).controlPoints || [],
                      });
                    } else if (m.id === 'equirectangular-image') {
                      onChangeBasemap({
                        type: 'equirectangular-image',
                        assetId: (basemap as any).assetId || '',
                        imageName: (basemap as any).imageName,
                        imageWidth: (basemap as any).imageWidth,
                        imageHeight: (basemap as any).imageHeight,
                        imageUrl: (basemap as any).imageUrl,
                      });
                    } else {
                      onChangeBasemap({
                        type: 'free-image',
                        assetId: (basemap as any).assetId || '',
                        imageName: (basemap as any).imageName,
                        imageWidth: (basemap as any).imageWidth,
                        imageHeight: (basemap as any).imageHeight,
                        imageUrl: (basemap as any).imageUrl,
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
                {places.map((p) => (
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
                    {(basemap as CalibratedImageBasemap).controlPoints?.length || 0}
                  </span>
                  <span className="text-slate-400 text-[10px] ml-1">(至少 3 点)</span>
                </div>

                {(basemap as CalibratedImageBasemap).errorPx !== undefined && (
                  <div className="flex items-center space-x-1">
                    <span className="text-slate-500">误差：</span>
                    <span
                      className={`px-1.5 py-0.5 rounded font-mono font-bold text-[10px] ${
                        (basemap as CalibratedImageBasemap).errorPx! < 15
                          ? 'bg-emerald-100 text-emerald-800'
                          : (basemap as CalibratedImageBasemap).errorPx! < 50
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {(basemap as CalibratedImageBasemap).errorPx!.toFixed(1)} px
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
              {(basemap as CalibratedImageBasemap).controlPoints &&
                (basemap as CalibratedImageBasemap).controlPoints.length > 0 && (
                  <div className="space-y-1">
                    <label className="block text-[10px] font-medium text-slate-500">
                      已登记控制点：
                    </label>
                    <div className="max-h-36 overflow-y-auto space-y-1">
                      {(basemap as CalibratedImageBasemap).controlPoints.map((cp) => (
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
                  {places.map((p) => {
                    const isCalibrated = (basemap as CalibratedImageBasemap).controlPoints?.some(
                      (cp) => cp.placeId === p.id
                    );
                    const isPicking = pickingPlaceId === p.id;
                    const hasResolvedCoordinates =
                      (p.status === 'resolved' || p.geoStatus === 'resolved') &&
                      Number.isFinite(p.lat) &&
                      Number.isFinite(p.lon);

                    return (
                      <div
                        key={p.id}
                        className="flex items-center justify-between p-1.5 bg-white rounded border border-slate-200"
                      >
                        <div className="truncate mr-2">
                          <span className="font-medium text-slate-800">{p.displayName}</span>
                          <span className="text-[9px] text-slate-400 block font-mono">
                            {hasResolvedCoordinates
                              ? `${p.lat.toFixed(2)}°, ${p.lon.toFixed(2)}°`
                              : '经纬度未解析'}
                          </span>
                        </div>
                        <button
                          disabled={!hasResolvedCoordinates}
                          onClick={() =>
                            hasResolvedCoordinates && onSelectPickingPlace(isPicking ? null : p.id)
                          }
                          className={`px-2 py-1 rounded text-[10px] font-medium flex items-center transition ${
                            !hasResolvedCoordinates
                              ? 'cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400'
                              : isPicking
                              ? 'bg-amber-500 text-white animate-pulse'
                              : isCalibrated
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100'
                          }`}
                        >
                          <Crosshair size={11} className="mr-1" />
                          {!hasResolvedCoordinates
                            ? '先设置经纬度'
                            : isPicking
                            ? '请点击地图...'
                            : isCalibrated
                            ? '重新标定'
                            : '标定该点'}
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
                  disabled={
                    !(basemap as CalibratedImageBasemap).controlPoints ||
                    (basemap as CalibratedImageBasemap).controlPoints.length < 3
                  }
                  className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-md text-xs font-semibold flex items-center justify-center space-x-1 transition shadow-sm"
                >
                  <RefreshCw size={12} />
                  <span>重新拟合计算</span>
                </button>
                <button
                  onClick={() =>
                    onFitImage?.()
                  }
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
