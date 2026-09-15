import React, { useState } from 'react';
import { exportMapAsSVG } from './svgExporter';
import { exportMapAsPNG } from './pngExporter';
import { Download, X, Layers, Image as ImageIcon, Sparkles } from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose }) => {
  const [exportFormat, setExportFormat] = useState<'png' | 'svg'>('png');
  const [resolutionMode, setResolutionMode] = useState<'2x' | '4x' | 'custom'>('2x');
  const [customWidth, setCustomWidth] = useState<number>(6000);
  const [transparentRouteOnly, setTransparentRouteOnly] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  if (!isOpen) return null;

  const handleExport = async () => {
    setIsExporting(true);
    try {
      if (exportFormat === 'svg') {
        await exportMapAsSVG('travel-map-svg', `travel-map-${Date.now()}.svg`, transparentRouteOnly);
      } else {
        let scale = 2;
        let cWidth: number | undefined = undefined;

        if (resolutionMode === '2x') scale = 2;
        else if (resolutionMode === '4x') scale = 4;
        else if (resolutionMode === 'custom') {
          cWidth = customWidth;
        }

        await exportMapAsPNG('travel-map-svg', {
          scale,
          customWidth: cWidth,
          transparentRouteOnly,
          filename: `travel-map-${resolutionMode === 'custom' ? customWidth + 'px' : resolutionMode}-${Date.now()}.png`
        });
      }
      onClose();
    } catch (err) {
      alert('导出发生错误：' + String(err));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-5 border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
              <Download size={18} />
            </div>
            <h3 className="text-base font-semibold text-slate-800">导出旅行路线地图</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 text-xs text-slate-700">
          {/* Format Selection */}
          <div>
            <label className="block font-medium text-slate-800 mb-1.5">导出格式</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setExportFormat('png')}
                className={`p-3 rounded-lg border text-left flex items-start space-x-2.5 transition ${
                  exportFormat === 'png'
                    ? 'border-blue-500 bg-blue-50/50 text-blue-700'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <ImageIcon size={18} className="mt-0.5 text-blue-600 shrink-0" />
                <div>
                  <div className="font-semibold text-slate-800">PNG 高清位图</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">适合海报、小红书、推文与PPT</div>
                </div>
              </button>

              <button
                onClick={() => setExportFormat('svg')}
                className={`p-3 rounded-lg border text-left flex items-start space-x-2.5 transition ${
                  exportFormat === 'svg'
                    ? 'border-blue-500 bg-blue-50/50 text-blue-700'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Sparkles size={18} className="mt-0.5 text-purple-600 shrink-0" />
                <div>
                  <div className="font-semibold text-slate-800">SVG 纯矢量图</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">保留文字与曲线，可在 Figma / AI 中二次编辑</div>
                </div>
              </button>
            </div>
          </div>

          {/* Resolution Options (for PNG) */}
          {exportFormat === 'png' && (
            <div>
              <label className="block font-medium text-slate-800 mb-1.5">输出清晰度</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: '2x', title: '2× 超清 (推荐)', desc: '~2400px' },
                  { id: '4x', title: '4× 印刷级', desc: '~4800px' },
                  { id: 'custom', title: '自定义宽度', desc: '海报大图' }
                ].map(r => (
                  <button
                    key={r.id}
                    onClick={() => setResolutionMode(r.id as any)}
                    className={`p-2 rounded-lg border text-center transition ${
                      resolutionMode === r.id
                        ? 'border-blue-500 bg-blue-50/50 text-blue-700 font-medium'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div>{r.title}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{r.desc}</div>
                  </button>
                ))}
              </div>

              {resolutionMode === 'custom' && (
                <div className="mt-2 flex items-center space-x-2 bg-slate-50 p-2 rounded-lg border border-slate-200">
                  <span className="text-slate-600">目标宽度：</span>
                  <input
                    type="number"
                    min={1000}
                    max={10000}
                    step={500}
                    value={customWidth}
                    onChange={e => setCustomWidth(parseInt(e.target.value) || 6000)}
                    className="w-24 px-2 py-1 bg-white border border-slate-300 rounded font-mono text-center"
                  />
                  <span className="text-slate-500">像素 (px)</span>
                  <span className="text-[10px] text-slate-400 ml-auto">最高支持 10000px</span>
                </div>
              )}
            </div>
          )}

          {/* Transparent route only toggle */}
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-start space-x-2.5">
            <input
              type="checkbox"
              id="transparent-toggle"
              checked={transparentRouteOnly}
              onChange={e => setTransparentRouteOnly(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500 mt-0.5 h-4 w-4"
            />
            <label htmlFor="transparent-toggle" className="cursor-pointer">
              <div className="font-medium text-slate-800 flex items-center">
                <Layers size={13} className="mr-1 text-slate-500" />
                仅导出路线与标记图层 (背景透明)
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                底图全透明，仅保留红点标记、地名文字与路线连线，可直接作为图层置入 Photoshop / Figma / 手绘底图进行二次排版。
              </div>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 flex justify-end space-x-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs text-slate-600 hover:bg-slate-100 transition"
          >
            取消
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-xs font-semibold rounded-lg shadow-sm transition flex items-center"
          >
            <Download size={14} className="mr-1.5" />
            {isExporting ? '正在生成...' : '立即下载导出'}
          </button>
        </div>
      </div>
    </div>
  );
};