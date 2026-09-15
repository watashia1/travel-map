import React from 'react';
import {
  MapConfig,
  RouteStyle,
  MarkerStyle,
  LabelStyle,
  MapProjectionType,
  MapRegionType,
  RouteType,
  DashStyle,
  MarkerType
} from '../types';

interface StylePanelProps {
  mapConfig: MapConfig;
  routeStyle: RouteStyle;
  markerStyle: MarkerStyle;
  labelStyle: LabelStyle;
  onChangeMapConfig: (cfg: Partial<MapConfig>) => void;
  onChangeRouteStyle: (stl: Partial<RouteStyle>) => void;
  onChangeMarkerStyle: (stl: Partial<MarkerStyle>) => void;
  onChangeLabelStyle: (stl: Partial<LabelStyle>) => void;
}

export const StylePanel: React.FC<StylePanelProps> = ({
  mapConfig,
  routeStyle,
  markerStyle,
  labelStyle,
  onChangeMapConfig,
  onChangeRouteStyle,
  onChangeMarkerStyle,
  onChangeLabelStyle
}) => {
  const colorPresets = [
    '#e63946', '#2563eb', '#059669', '#d97706', '#7c3aed', '#db2777', '#0f172a', '#475569'
  ];

  const themePresets = [
    { name: '极简米白', land: '#f1efe8', border: '#d5d2c8', ocean: '#ffffff' },
    { name: '经典雅灰', land: '#e2e8f0', border: '#cbd5e1', ocean: '#f8fafc' },
    { name: '淡蓝海洋', land: '#f3f4f6', border: '#e5e7eb', ocean: '#e0f2fe' },
    { name: '暗夜黑金', land: '#1e293b', border: '#334155', ocean: '#0f172a' }
  ];

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 space-y-6 text-xs text-slate-700">
      {/* 1. Map Projection & Region */}
      <section className="space-y-3">
        <h4 className="font-semibold text-slate-900 uppercase tracking-wider text-[11px] pb-1 border-b border-slate-200">
          地图投影与区域
        </h4>

        <div>
          <label className="block text-slate-500 mb-1.5">投影方式 (Projection)</label>
          <div className="grid grid-cols-3 gap-1.5">
            {(['equalEarth', 'naturalEarth', 'mercator'] as MapProjectionType[]).map(proj => (
              <button
                key={proj}
                onClick={() => onChangeMapConfig({ projection: proj })}
                className={`py-1.5 px-2 rounded-lg border text-center transition font-medium ${
                  mapConfig.projection === proj
                    ? 'bg-blue-50 border-blue-500 text-blue-600'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                {proj === 'equalEarth' ? 'Equal Earth' : proj === 'naturalEarth' ? 'Natural Earth' : 'Mercator'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-slate-500 mb-1.5">视角聚焦区域</label>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { id: 'world', label: '世界全景' },
              { id: 'asia', label: '亚洲' },
              { id: 'europe', label: '欧洲' },
              { id: 'china', label: '中国' },
              { id: 'japan', label: '日本' },
              { id: 'arctic', label: '北极极地' }
            ].map(r => (
              <button
                key={r.id}
                onClick={() => onChangeMapConfig({ region: r.id as MapRegionType })}
                className={`py-1.5 px-2 rounded-lg border text-center transition ${
                  mapConfig.region === r.id
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
          <label className="block text-slate-500 mb-1.5">底图配色主题</label>
          <div className="grid grid-cols-2 gap-2">
            {themePresets.map(theme => (
              <button
                key={theme.name}
                onClick={() =>
                  onChangeMapConfig({
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

      {/* 2. Route Style */}
      <section className="space-y-3">
        <h4 className="font-semibold text-slate-900 uppercase tracking-wider text-[11px] pb-1 border-b border-slate-200">
          路线样式 (Route)
        </h4>

        <div>
          <label className="block text-slate-500 mb-1.5">连线形态</label>
          <div className="grid grid-cols-2 gap-2">
            {(['curved', 'straight'] as RouteType[]).map(t => (
              <button
                key={t}
                onClick={() => onChangeRouteStyle({ type: t })}
                className={`py-1.5 px-2 rounded-lg border text-center transition ${
                  routeStyle.type === t
                    ? 'bg-blue-50 border-blue-500 text-blue-600 font-medium'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                {t === 'curved' ? '╭ 平滑曲线 (推荐)' : '─ 直线'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-slate-500 mb-1.5">线型风格</label>
          <div className="grid grid-cols-3 gap-1.5">
            {(['solid', 'dashed', 'dotted'] as DashStyle[]).map(d => (
              <button
                key={d}
                onClick={() => onChangeRouteStyle({ dashStyle: d })}
                className={`py-1.5 px-2 rounded-lg border text-center transition ${
                  routeStyle.dashStyle === d
                    ? 'bg-blue-50 border-blue-500 text-blue-600 font-medium'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                {d === 'solid' ? '实线' : d === 'dashed' ? '虚线' : '点线'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <label className="text-slate-500">显示前进方向箭头</label>
          <input
            type="checkbox"
            checked={routeStyle.showArrows}
            onChange={e => onChangeRouteStyle({ showArrows: e.target.checked })}
            className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
          />
        </div>

        <div>
          <div className="flex justify-between text-slate-500 mb-1">
            <span>线条粗细 ({routeStyle.strokeWidth}px)</span>
          </div>
          <input
            type="range"
            min={1}
            max={8}
            step={0.5}
            value={routeStyle.strokeWidth}
            onChange={e => onChangeRouteStyle({ strokeWidth: parseFloat(e.target.value) })}
            className="w-full accent-blue-600"
          />
        </div>

        <div>
          <div className="flex justify-between text-slate-500 mb-1">
            <span>线条透明度 ({Math.round(routeStyle.strokeOpacity * 100)}%)</span>
          </div>
          <input
            type="range"
            min={0.2}
            max={1}
            step={0.05}
            value={routeStyle.strokeOpacity}
            onChange={e => onChangeRouteStyle({ strokeOpacity: parseFloat(e.target.value) })}
            className="w-full accent-blue-600"
          />
        </div>

        <div>
          <label className="block text-slate-500 mb-1.5">路线颜色</label>
          <div className="flex items-center space-x-2">
            <div className="flex space-x-1 flex-1">
              {colorPresets.map(c => (
                <button
                  key={c}
                  onClick={() => onChangeRouteStyle({ strokeColor: c })}
                  className="w-5 h-5 rounded-full border border-slate-300 transition transform hover:scale-110"
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <input
              type="color"
              value={routeStyle.strokeColor}
              onChange={e => onChangeRouteStyle({ strokeColor: e.target.value })}
              className="w-7 h-7 rounded border border-slate-300 cursor-pointer p-0.5"
            />
          </div>
        </div>
      </section>

      {/* 3. Marker Style */}
      <section className="space-y-3">
        <h4 className="font-semibold text-slate-900 uppercase tracking-wider text-[11px] pb-1 border-b border-slate-200">
          标记点样式 (Marker)
        </h4>

        <div>
          <label className="block text-slate-500 mb-1.5">点位形状</label>
          <div className="grid grid-cols-3 gap-1.5">
            {(['dot', 'numbered', 'ring'] as MarkerType[]).map(t => (
              <button
                key={t}
                onClick={() => onChangeMarkerStyle({ type: t })}
                className={`py-1.5 px-2 rounded-lg border text-center transition ${
                  markerStyle.type === t
                    ? 'bg-blue-50 border-blue-500 text-blue-600 font-medium'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                {t === 'dot' ? '● 实心圆' : t === 'numbered' ? '① 序号标' : '◎ 双环圆'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex justify-between text-slate-500 mb-1">
            <span>点位大小 ({markerStyle.size}px)</span>
          </div>
          <input
            type="range"
            min={4}
            max={14}
            step={1}
            value={markerStyle.size}
            onChange={e => onChangeMarkerStyle({ size: parseInt(e.target.value) })}
            className="w-full accent-blue-600"
          />
        </div>

        <div>
          <label className="block text-slate-500 mb-1.5">标记颜色</label>
          <div className="flex items-center space-x-2">
            <div className="flex space-x-1 flex-1">
              {colorPresets.map(c => (
                <button
                  key={c}
                  onClick={() => onChangeMarkerStyle({ color: c })}
                  className="w-5 h-5 rounded-full border border-slate-300 transition transform hover:scale-110"
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <input
              type="color"
              value={markerStyle.color}
              onChange={e => onChangeMarkerStyle({ color: e.target.value })}
              className="w-7 h-7 rounded border border-slate-300 cursor-pointer p-0.5"
            />
          </div>
        </div>
      </section>

      {/* 4. Label Style */}
      <section className="space-y-3 pb-6">
        <h4 className="font-semibold text-slate-900 uppercase tracking-wider text-[11px] pb-1 border-b border-slate-200">
          地名标签样式 (Label)
        </h4>

        <div>
          <div className="flex justify-between text-slate-500 mb-1">
            <span>文字大小 ({labelStyle.fontSize}px)</span>
          </div>
          <input
            type="range"
            min={10}
            max={20}
            step={1}
            value={labelStyle.fontSize}
            onChange={e => onChangeLabelStyle({ fontSize: parseInt(e.target.value) })}
            className="w-full accent-blue-600"
          />
        </div>

        <div className="flex items-center justify-between">
          <label className="text-slate-500">白色描边保护 (提升文字辨识度)</label>
          <input
            type="checkbox"
            checked={labelStyle.showHalo}
            onChange={e => onChangeLabelStyle({ showHalo: e.target.checked })}
            className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
          />
        </div>

        <div>
          <label className="block text-slate-500 mb-1.5">文字颜色</label>
          <div className="flex items-center space-x-2">
            <input
              type="color"
              value={labelStyle.color}
              onChange={e => onChangeLabelStyle({ color: e.target.value })}
              className="w-7 h-7 rounded border border-slate-300 cursor-pointer p-0.5"
            />
            <span className="text-slate-500 font-mono">{labelStyle.color}</span>
          </div>
        </div>
      </section>
    </div>
  );
};