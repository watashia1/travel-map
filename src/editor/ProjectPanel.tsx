import React, { useRef } from 'react';
import { ProjectData } from '../types';
import { Download, Upload, Trash2, Compass } from 'lucide-react';

interface ProjectPanelProps {
  projectData: ProjectData;
  onImportProject: (data: ProjectData) => void;
  onRequestReset: () => void;
  onLoadPreset: (presetId: string) => void;
}

export const ProjectPanel: React.FC<ProjectPanelProps> = ({
  projectData,
  onImportProject,
  onRequestReset,
  onLoadPreset
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportJSON = () => {
    const cleanData = { ...projectData };
    if (cleanData.basemap && (cleanData.basemap as any).imageUrl) {
      const { imageUrl, ...restBasemap } = cleanData.basemap as any;
      cleanData.basemap = restBasemap;
    }
    const dataStr = JSON.stringify(cleanData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `travel-map-v2-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const parsed = JSON.parse(evt.target?.result as string);
        if (parsed && Array.isArray(parsed.places)) {
          onImportProject(parsed);
        } else {
          alert('导入失败：该文件不是有效的旅行地图项目 JSON');
        }
      } catch (err) {
        alert('解析文件出错：' + String(err));
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 space-y-6 text-xs text-slate-700">
      {/* 1. Project Backup / Restore */}
      <section className="space-y-3">
        <h4 className="font-semibold text-slate-900 uppercase tracking-wider text-[11px] pb-1 border-b border-slate-200">
          项目工程存档与还原
        </h4>
        <p className="text-slate-500 leading-relaxed text-[11px]">
          项目参数与标定数据实时防抖暂存于当前浏览器。导出 JSON 可备份全部路线与标定点；自定义底图图片保存在当前浏览器本地数据库 (IndexedDB)，本 JSON 文件不包含图片原始文件。
        </p>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            onClick={handleExportJSON}
            className="p-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-800 transition flex items-center justify-center space-x-1.5 shadow-sm"
          >
            <Download size={14} className="text-blue-600" />
            <span className="font-medium">导出项目 (JSON)</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-800 transition flex items-center justify-center space-x-1.5 shadow-sm"
          >
            <Upload size={14} className="text-emerald-600" />
            <span className="font-medium">导入工程文件</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      </section>

      {/* 2. Official Acceptance Cases & Route Presets */}
      <section className="space-y-3">
        <h4 className="font-semibold text-slate-900 uppercase tracking-wider text-[11px] pb-1 border-b border-slate-200">
          规范验收案例与预设路线
        </h4>
        <div className="space-y-2">
          {[
            {
              id: 'galapagos',
              title: '案例 A：加拉帕戈斯群岛 (内置地形矢量图与仿射标定)',
              desc: '圣克里斯托瓦尔岛 → 弗雷里安纳岛 → 伊莎贝拉岛 → 圣地亚哥岛'
            },
            {
              id: 'arctic_true',
              title: '案例 B：北极真实极地航线 (极地等距投影)',
              desc: '奥斯陆 → 特罗姆瑟 → 朗伊尔城 → 北极点'
            },
            {
              id: 'antimeridian',
              title: '案例 C：跨 180° 经线安全测地线',
              desc: '东京 → 安克雷奇 (球面测地线不横穿大陆)'
            },
            {
              id: 'spec_v1',
              title: '案例 D：跨大洲经典探索 (V1 验收样例)',
              desc: '东京 → 札幌 → 奥斯陆 → 雷克雅未克 → 朗伊尔城'
            },
            {
              id: 'silkroad',
              title: '经典丝绸之路巡游',
              desc: '西安 → 敦煌 → 喀什 → 撒马尔罕 → 伊斯坦布尔 → 罗马'
            }
          ].map(preset => (
            <button
              key={preset.id}
              onClick={() => onLoadPreset(preset.id)}
              className="w-full text-left p-2.5 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 transition group"
            >
              <div className="flex items-center text-slate-800 font-medium group-hover:text-blue-600">
                <Compass size={14} className="mr-1.5 text-blue-500 shrink-0" />
                {preset.title}
              </div>
              <div className="text-[11px] text-slate-400 mt-1 truncate pl-5">
                {preset.desc}
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* 3. Danger Zone */}
      <section className="space-y-2 pt-4 border-t border-slate-200">
        <h4 className="font-semibold text-red-600 uppercase tracking-wider text-[11px]">
          危险操作
        </h4>
        <p className="text-[11px] text-slate-500">
          清空当前画布上的所有地点和连线设置。该操作需要二次确认。
        </p>
        <button
          onClick={onRequestReset}
          className="w-full py-2 px-3 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg transition font-medium flex items-center justify-center space-x-1"
        >
          <Trash2 size={14} />
          <span>重置并清空当前项目</span>
        </button>
      </section>
    </div>
  );
};
