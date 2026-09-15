import React from 'react';
import {
  RouteStyle,
  MarkerStyle,
  LabelStyle,
  RouteMode,
  DashStyle,
  MarkerType,
  OverlayScaleMode
} from '../types';
import { AlertCircle } from 'lucide-react';

interface StylePanelProps {
  routeStyle: RouteStyle;
  markerStyle: MarkerStyle;
  labelStyle: LabelStyle;
  overlayScaleMode: OverlayScaleMode;
  basemapType?: string;
  onChangeRouteStyle: (stl: Partial<RouteStyle>) => void;
  onChangeMarkerStyle: (stl: Partial<MarkerStyle>) => void;
  onChangeLabelStyle: (stl: Partial<LabelStyle>) => void;
  onChangeOverlayScaleMode: (mode: OverlayScaleMode) => void;
}

export const StylePanel: React.FC<StylePanelProps> = ({
  routeStyle,
  markerStyle,
  labelStyle,
  overlayScaleMode,
  basemapType,
  onChangeRouteStyle,
  onChangeMarkerStyle,
  onChangeLabelStyle,
  onChangeOverlayScaleMode
}) => {
  const colorPresets = [
    '#e63946', '#2563eb', '#059669', '#d97706', '#7c3aed', '#db2777', '#0f172a', '#475569'
  ];

  const isFreeImage = basemapType === 'free-image';

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 space-y-6 text-xs text-slate-700">
      {/* 1. Route Geometry & Mode */}
      <section className="space-y-3">
        <h4 className="font-semibold text-slate-900 uppercase tracking-wider text-[11px] pb-1 border-b border-slate-200">
          路线连线模式 (Route)
        </h4>

        <div>
          <label className="block text-slate-500 mb-1.5 font-medium">连线计算方式</label>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { id: 'geodesic', label: '球面测地线' },
              { id: 'straight-screen', label: '平面直线' },
              { id: 'decorative-curve', label: '视觉装饰曲线' }
            ].map(m => {
              const disabled = isFreeImage && m.id === 'geodesic';
              const isCurrent = routeStyle.mode === m.id;

              return (
                <button
                  key={m.id}
                  disabled={disabled}
                  onClick={() => onChangeRouteStyle({ mode: m.id as RouteMode })}
                  title={disabled ? '自由底图没有统一地理投影，不能计算真实球面路线' : undefined}
                  className={`py-1.5 px-1.5 rounded-lg border text-center transition text-[11px] ${
                    disabled
                      ? 'border-slate-200 bg-slate-100 text-slate-300 cursor-not-allowed'
                      : isCurrent
                      ? 'bg-blue-50 border-blue-500 text-blue-600 font-medium'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {m.label}
                </button>
              );
            })}
          </div>

          {isFreeImage ? (
            <div className="text-[10px] text-amber-700 bg-amber-50 p-2 rounded mt-1.5 border border-amber-200 flex items-start space-x-1.5">
              <AlertCircle size={13} className="shrink-0 text-amber-600 mt-0.5" />
              <span>自由底图没有统一地理经纬投影，已自动禁用球面测地线，推荐使用“视觉装饰曲线”或“平面直线”。</span>
            </div>
          ) : (
            <div className="text-[10px] text-slate-400 mt-1">
              {routeStyle.mode === 'geodesic'
                ? '沿地球大圆球面真实飞行路径绘制，跨 180° 经线安全无跳跃。'
                : routeStyle.mode === 'straight-screen'
                ? '直接以屏幕直线两点连接。'
                : '两点间以优雅贝塞尔弧线拱起连接。'}
            </div>
          )}
        </div>

        <div>
          <label className="block text-slate-500 mb-1.5 font-medium">线型样式</label>
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
          <label className="text-slate-600 font-medium">显示航线前进箭头</label>
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
          <label className="block text-slate-500 mb-1.5 font-medium">路线颜色</label>
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

      {/* 2. Visual Scale Mode & Marker Style */}
      <section className="space-y-3">
        <h4 className="font-semibold text-slate-900 uppercase tracking-wider text-[11px] pb-1 border-b border-slate-200">
          标记点与图层尺寸策略
        </h4>

        {/* Scaled mode: standardized to screen-fixed for crystal clarity */}
        <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-[11px]">
          <div className="font-semibold text-slate-800">屏幕固定尺寸渲染 (专业地图规范)</div>
          <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
            无论缩放平移地图至何种视角，红点标记与文字标签始终保持设定的物理像素大小，保证最佳视觉可读性且绝不膨胀遮挡地图。
          </p>
        </div>

        <div>
          <label className="block text-slate-500 mb-1.5 font-medium">点位形状</label>
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
            <span>点位视觉大小 ({markerStyle.size}px)</span>
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
          <label className="block text-slate-500 mb-1.5 font-medium">标记颜色</label>
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

      {/* 3. Label Style & Collision Avoidance */}
      <section className="space-y-3 pb-6">
        <h4 className="font-semibold text-slate-900 uppercase tracking-wider text-[11px] pb-1 border-b border-slate-200">
          地名标签排版 (Label)
        </h4>

        <div className="flex items-center justify-between p-2.5 bg-blue-50/50 rounded-lg border border-blue-100">
          <div>
            <div className="font-medium text-slate-800">8方向智能自动避让重叠</div>
            <div className="text-[10px] text-slate-500">点位密集时自动寻找无遮挡角度展示文字</div>
          </div>
          <input
            type="checkbox"
            checked={labelStyle.autoAvoidCollisions}
            onChange={e => onChangeLabelStyle({ autoAvoidCollisions: e.target.checked })}
            className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
          />
        </div>

        <div className="flex items-center justify-between">
          <label className="text-slate-600 font-medium">白色文字描边 (保护可读性)</label>
          <input
            type="checkbox"
            checked={labelStyle.showHalo}
            onChange={e => onChangeLabelStyle({ showHalo: e.target.checked })}
            className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
          />
        </div>

        <div>
          <div className="flex justify-between text-slate-500 mb-1">
            <span>文字大小 ({labelStyle.fontSize}px)</span>
          </div>
          <input
            type="range"
            min={10}
            max={22}
            step={1}
            value={labelStyle.fontSize}
            onChange={e => onChangeLabelStyle({ fontSize: parseInt(e.target.value) })}
            className="w-full accent-blue-600"
          />
        </div>

        <div>
          <label className="block text-slate-500 mb-1.5 font-medium">文字颜色</label>
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
