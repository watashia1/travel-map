import React, { useRef, useState } from 'react';
import {
  BasemapConfig,
  BuiltinBasemap,
  Place,
  MapProjectionType,
  MapRegionType
} from '../types';
import { saveImageBlob, getImageObjectUrl } from '../map/storage/imageStore';
import { fitAffineTransform } from '../map/transformer';
import { Upload, Image as ImageIcon, Globe, Crosshair, Check, AlertCircle, Trash2 } from 'lucide-react';

interface BasemapPanelProps {
  basemap: BasemapConfig;
  places: Place[];
  pickingPlaceId: string | null;
  onSelectPickingPlace: (placeId: string | null) => void;
  onChangeBasemap: (newBasemap: BasemapConfig) => void;
}

export const BasemapPanel: React.FC<BasemapPanelProps> = ({
  basemap,
  places,
  pickingPlaceId,
  onSelectPickingPlace,
  onChangeBasemap
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeUploadMode, setActiveUploadMode] = useState<'free-image' | 'equirectangular-image' | 'calibrated-image'>('free-image');
  const [selectedControlPlaceId, setSelectedControlPlaceId] = useState<string>('');

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

      // Measure image natural dimensions
      const img = new Image();
      img.onload = () => {
        const w = img.naturalWidth || 1200;
        const h = img.naturalHeight || 800;

        if (activeUploadMode === 'free-image') {
          onChangeBasemap({
            type: 'free-image',
            assetId,
            imageName: file.name,
            imageWidth: w,
            imageHeight: h,
            imageUrl: url || undefined
          });
        } else if (activeUploadMode === 'equirectangular-image') {
          onChangeBasemap({
            type: 'equirectangular-image',
            assetId,
            imageName: file.name,
            imageWidth: w,
            imageHeight: h,
            imageUrl: url || undefined
          });
        } else {
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
  };

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
                ? 'border-blue-500 bg-blue-50/50 text-blue-700 font-medium'
                : 'border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Globe size={16} className="mt-0.5 text-blue-600 shrink-0" />
            <div>
              <div className="font-semibold">内置矢量地图</div>
              <div className="text-[10px] text-slate-400 mt-0.5">世界/各大洲/北极极地</div>
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
                ? 'border-blue-500 bg-blue-50/50 text-blue-700 font-medium'
                : 'border-slate-200 hover:bg-slate-50'
            }`}
          >
            <ImageIcon size={16} className="mt-0.5 text-purple-600 shrink-0" />
            <div>
              <div className="font-semibold">自定义图片底图</div>
              <div className="text-[10px] text-slate-400 mt-0.5">手绘地图/景区图/海报</div>
            </div>
          </button>
        </div>
      </section>

      {/* 2A. Built-in Vector Map Options */}
      {basemap.type === 'builtin' && (
        <section className="space-y-4">
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
            <label className="block text-slate-500 mb-1.5 font-medium">聚焦视角预设</label>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: 'world', label: '世界全景' },
                { id: 'asia', label: '亚洲' },
                { id: 'europe', label: '欧洲' },
                { id: 'china', label: '中国' },
                { id: 'japan', label: '日本' },
                { id: 'arctic', label: '北极极区' }
              ].map(r => (
                <button
                  key={r.id}
                  onClick={() =>
                    onChangeBasemap({
                      ...basemap,
                      region: r.id as MapRegionType
                    })
                  }
                  className={`py-1.5 px-2 rounded-lg border text-center transition ${
                    basemap.region === r.id
                      ? 'bg-blue-50 border-blue-500 text-blue-600 font-medium'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {r.label}
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

      {/* 2B. Custom Image Map Options */}
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
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-2.5 py-1 bg-white border border-purple-200 text-purple-700 rounded-md text-xs hover:bg-purple-50"
            >
              换一张
            </button>
          </div>

          {/* Mode Sub-Selector */}
          <div>
            <label className="block text-slate-500 mb-1.5 font-medium">图片定位工作模式</label>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: 'free-image', label: '自由底图 (推荐)' },
                { id: 'equirectangular-image', label: '标准经纬世界图' },
                { id: 'calibrated-image', label: '三点仿射校准' }
              ].map(m => (
                <button
                  key={m.id}
                  onClick={() => {
                    setActiveUploadMode(m.id as any);
                    onChangeBasemap({
                      ...basemap,
                      type: m.id as any
                    });
                  }}
                  className={`py-2 px-1.5 rounded-lg border text-center transition text-[11px] ${
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
              <div className="space-y-1.5 pt-1 max-h-48 overflow-y-auto">
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
                          ? 'bg-amber-500 text-white'
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
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-[11px] space-y-1">
              <div className="font-medium text-slate-800">标准等距圆柱世界底图</div>
              <p className="text-slate-500 leading-relaxed">
                要求图片的四边严格对应：左边 -180°、右边 +180°、上边 +90°、下边 -90°。系统将自动按经纬度公式投射点位，无需任何校准。
              </p>
            </div>
          )}

          {/* Mode C: Calibrated */}
          {basemap.type === 'calibrated-image' && (
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-[11px] space-y-2">
              <div className="font-medium text-slate-800">三点及以上仿射校准</div>
              <p className="text-slate-500 leading-relaxed">
                在已知地图上指定至少 3 个控制点（包含真实经纬度与图片像素坐标），系统将通过最小二乘法拟合地理投影。
              </p>
              {basemap.errorPx !== undefined && (
                <div className={`p-2 rounded font-mono text-xs flex items-center ${
                  basemap.errorPx > 50 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  <AlertCircle size={14} className="mr-1.5 shrink-0" />
                  <span>平均校准误差：{basemap.errorPx} px</span>
                  {basemap.errorPx > 50 && (
                    <span className="block text-[10px] mt-1 font-sans">
                      误差较大，该图可能存在艺术变形，建议切换为“自由底图”。
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      )}

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