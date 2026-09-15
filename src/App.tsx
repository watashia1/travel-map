import React, { useState, useEffect } from 'react';
import { ProjectData, Place, PlaceRecord, RouteStyle, MarkerStyle, LabelStyle, MapConfig } from './types';
import { useHistory } from './editor/useHistory';
import { PlaceList } from './editor/PlaceList';
import { StylePanel } from './editor/StylePanel';
import { ProjectPanel } from './editor/ProjectPanel';
import { MapCanvas } from './map/MapCanvas';
import { ExportModal } from './export/ExportModal';
import { ConfirmModal } from './editor/ConfirmModal';
import { AmbiguityModal } from './editor/AmbiguityModal';
import { parseInputText, loadPlacesDatabase } from './parser/placeSearch';
import {
  MapPin,
  Sliders,
  FolderKanban,
  Undo2,
  Redo2,
  Download,
  Plane
} from 'lucide-react';

const STORAGE_KEY = 'travel_map_project_v1';

const defaultRouteStyle: RouteStyle = {
  type: 'curved',
  strokeColor: '#e63946',
  strokeWidth: 2.5,
  strokeOpacity: 0.9,
  dashStyle: 'solid',
  showArrows: true
};

const defaultMarkerStyle: MarkerStyle = {
  type: 'dot',
  color: '#e63946',
  size: 7,
  strokeColor: '#ffffff',
  strokeWidth: 2
};

const defaultLabelStyle: LabelStyle = {
  fontSize: 12,
  color: '#1e293b',
  showHalo: true,
  fontWeight: 'medium'
};

const defaultMapConfig: MapConfig = {
  projection: 'equalEarth',
  region: 'world',
  landColor: '#f1efe8',
  borderColor: '#d5d2c8',
  oceanColor: '#ffffff'
};

const initialProject: ProjectData = {
  version: '1.0',
  title: '我的旅行路线',
  places: [],
  routeStyle: defaultRouteStyle,
  markerStyle: defaultMarkerStyle,
  labelStyle: defaultLabelStyle,
  mapConfig: defaultMapConfig
};

export const App: React.FC = () => {
  const { state: project, set: setProject, undo, redo, canUndo, canRedo } = useHistory<ProjectData>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.places)) {
          return parsed;
        }
      }
    } catch {
      // Ignore
    }
    return initialProject;
  });

  const [activeTab, setActiveTab] = useState<'places' | 'style' | 'project'>('places');
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isConfirmResetOpen, setIsConfirmResetOpen] = useState(false);
  const [ambiguousPlace, setAmbiguousPlace] = useState<{ id: string; name: string; candidates: PlaceRecord[] } | null>(null);

  // Preload places database on startup
  useEffect(() => {
    loadPlacesDatabase();
  }, []);

  // Save to localStorage whenever project changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
    } catch (e) {
      console.warn('Failed to save to localStorage', e);
    }
  }, [project]);

  // Initial load sample preset if first time empty
  useEffect(() => {
    if (project.places.length === 0) {
      const sampleText = `东京\n43.0618, 141.3545 | 札幌\n奥斯陆\n64.1466, -21.9426 | 雷克雅未克\n78.2232, 15.6469 | 朗伊尔城`;
      parseInputText(sampleText, []).then(parsedPlaces => {
        setProject(prev => ({
          ...prev,
          places: parsedPlaces
        }));
      });
    }
  }, []);

  // Handlers for place editing
  const handleBatchUpdate = async (inputText: string) => {
    const newPlaces = await parseInputText(inputText, project.places);
    setProject(prev => ({
      ...prev,
      places: [...prev.places, ...newPlaces]
    }));
  };

  const handleReorderPlaces = (newPlaces: Place[]) => {
    setProject(prev => ({
      ...prev,
      places: newPlaces
    }));
  };

  const handleDeletePlace = (placeId: string) => {
    setProject(prev => ({
      ...prev,
      places: prev.places.filter(p => p.id !== placeId).map((p, idx) => ({ ...p, order: idx }))
    }));
  };

  const handleResetPlaceOffset = (placeId: string) => {
    setProject(prev => ({
      ...prev,
      places: prev.places.map(p =>
        p.id === placeId
          ? { ...p, manualOffsetX: 0, manualOffsetY: 0, labelOffsetX: 12, labelOffsetY: -12 }
          : p
      )
    }));
  };

  const handleUpdatePlaceOffset = (placeId: string, x: number, y: number) => {
    setProject(prev => ({
      ...prev,
      places: prev.places.map(p => (p.id === placeId ? { ...p, manualOffsetX: x, manualOffsetY: y } : p))
    }));
  };

  const handleUpdateLabelOffset = (placeId: string, x: number, y: number) => {
    setProject(prev => ({
      ...prev,
      places: prev.places.map(p => (p.id === placeId ? { ...p, labelOffsetX: x, labelOffsetY: y } : p))
    }));
  };

  const handleResolveAmbiguity = (placeId: string, candidate: PlaceRecord) => {
    setProject(prev => ({
      ...prev,
      places: prev.places.map(p => {
        if (p.id !== placeId) return p;
        return {
          ...p,
          displayName: candidate.displayName,
          name: candidate.name,
          lat: candidate.lat,
          lon: candidate.lon,
          country: candidate.country,
          status: 'resolved'
        };
      })
    }));
    setAmbiguousPlace(null);
  };

  const handleManualResolveCoord = (placeId: string, lat: number, lon: number) => {
    setProject(prev => ({
      ...prev,
      places: prev.places.map(p => {
        if (p.id !== placeId) return p;
        return {
          ...p,
          lat,
          lon,
          source: 'manual',
          status: 'resolved'
        };
      })
    }));
  };

  // Preset loader
  const handleLoadPreset = async (presetId: string) => {
    let presetText = '';
    let region: any = 'world';

    if (presetId === 'arctic') {
      presetText = `东京\n43.0618, 141.3545 | 札幌\n奥斯陆\n64.1466, -21.9426 | 雷克雅未克\n78.2232, 15.6469 | 朗伊尔城`;
      region = 'world';
    } else if (presetId === 'silkroad') {
      presetText = `西安\n敦煌\n喀什\n撒马尔罕\n伊斯坦布尔\n罗马`;
      region = 'asia';
    } else if (presetId === 'japan') {
      presetText = `东京\n镰仓\n箱根\n富士山\n京都\n奈良\n大阪`;
      region = 'japan';
    } else if (presetId === 'nordic') {
      presetText = `赫尔辛基\n罗瓦涅米\n特罗姆瑟\n朗伊尔城`;
      region = 'europe';
    }

    const parsed = await parseInputText(presetText);
    setProject(prev => ({
      ...prev,
      places: parsed,
      mapConfig: { ...prev.mapConfig, region }
    }));
    setActiveTab('places');
  };

  const handleClearAllConfirmed = () => {
    setProject(prev => ({
      ...prev,
      places: []
    }));
    setIsConfirmResetOpen(false);
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-100 font-sans">
      {/* 1. Global Header Bar */}
      <header className="h-14 bg-white border-b border-slate-200 px-4 flex items-center justify-between shadow-sm shrink-0 z-20">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-600 text-white rounded-lg shadow-sm">
            <Plane size={18} className="transform -rotate-45" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-800 tracking-tight flex items-center space-x-2">
              <span>旅行足迹 / 路线地图生成器</span>
              <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-mono font-normal">
                V1.0
              </span>
            </h1>
            <p className="text-[11px] text-slate-400">轻量中文经纬度地图视觉编辑器 · 纯前端纯本地</p>
          </div>
        </div>

        {/* Center & Right Actions */}
        <div className="flex items-center space-x-2">
          {/* Undo / Redo */}
          <div className="flex items-center space-x-1 bg-slate-50 border border-slate-200 rounded-lg p-1">
            <button
              onClick={undo}
              disabled={!canUndo}
              className="p-1.5 rounded text-slate-600 hover:bg-slate-200 disabled:opacity-30 disabled:hover:bg-transparent transition"
              title="撤销 (Ctrl+Z)"
            >
              <Undo2 size={16} />
            </button>
            <button
              onClick={redo}
              disabled={!canRedo}
              className="p-1.5 rounded text-slate-600 hover:bg-slate-200 disabled:opacity-30 disabled:hover:bg-transparent transition"
              title="重做 (Ctrl+Y)"
            >
              <Redo2 size={16} />
            </button>
          </div>

          {/* Export Button */}
          <button
            onClick={() => setIsExportOpen(true)}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition flex items-center space-x-1.5"
          >
            <Download size={14} />
            <span>导出地图 ▾</span>
          </button>
        </div>
      </header>

      {/* 2. Main Workbench (Sidebar + Canvas) */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <aside className="w-[340px] bg-white border-r border-slate-200 flex flex-col shrink-0 shadow-sm z-10">
          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-200 text-xs font-medium">
            <button
              onClick={() => setActiveTab('places')}
              className={`flex-1 py-3 text-center border-b-2 transition flex items-center justify-center space-x-1.5 ${
                activeTab === 'places'
                  ? 'border-blue-600 text-blue-600 font-semibold bg-blue-50/20'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <MapPin size={15} />
              <span>地点 ({project.places.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('style')}
              className={`flex-1 py-3 text-center border-b-2 transition flex items-center justify-center space-x-1.5 ${
                activeTab === 'style'
                  ? 'border-blue-600 text-blue-600 font-semibold bg-blue-50/20'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Sliders size={15} />
              <span>样式</span>
            </button>

            <button
              onClick={() => setActiveTab('project')}
              className={`flex-1 py-3 text-center border-b-2 transition flex items-center justify-center space-x-1.5 ${
                activeTab === 'project'
                  ? 'border-blue-600 text-blue-600 font-semibold bg-blue-50/20'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <FolderKanban size={15} />
              <span>项目</span>
            </button>
          </div>

          {/* Tab Content Panels */}
          <div className="flex-1 overflow-hidden">
            {activeTab === 'places' && (
              <PlaceList
                places={project.places}
                onAddPlace={line => handleBatchUpdate(line)}
                onBatchUpdate={handleBatchUpdate}
                onReorderPlaces={handleReorderPlaces}
                onDeletePlace={handleDeletePlace}
                onRequestClearAll={() => setIsConfirmResetOpen(true)}
                onResetPlaceOffset={handleResetPlaceOffset}
                onResolveAmbiguity={handleResolveAmbiguity}
                onManualResolveCoord={handleManualResolveCoord}
              />
            )}

            {activeTab === 'style' && (
              <StylePanel
                mapConfig={project.mapConfig}
                routeStyle={project.routeStyle}
                markerStyle={project.markerStyle}
                labelStyle={project.labelStyle}
                onChangeMapConfig={cfg => setProject(prev => ({ ...prev, mapConfig: { ...prev.mapConfig, ...cfg } }))}
                onChangeRouteStyle={stl => setProject(prev => ({ ...prev, routeStyle: { ...prev.routeStyle, ...stl } }))}
                onChangeMarkerStyle={stl => setProject(prev => ({ ...prev, markerStyle: { ...prev.markerStyle, ...stl } }))}
                onChangeLabelStyle={stl => setProject(prev => ({ ...prev, labelStyle: { ...prev.labelStyle, ...stl } }))}
              />
            )}

            {activeTab === 'project' && (
              <ProjectPanel
                projectData={project}
                onImportProject={data => setProject(data)}
                onRequestReset={() => setIsConfirmResetOpen(true)}
                onLoadPreset={handleLoadPreset}
              />
            )}
          </div>
        </aside>

        {/* Right Map Canvas */}
        <main className="flex-1 h-full overflow-hidden relative">
          <MapCanvas
            places={project.places}
            routeStyle={project.routeStyle}
            markerStyle={project.markerStyle}
            labelStyle={project.labelStyle}
            mapConfig={project.mapConfig}
            onUpdatePlaceOffset={handleUpdatePlaceOffset}
            onUpdateLabelOffset={handleUpdateLabelOffset}
          />
        </main>
      </div>

      {/* 3. Export Modal */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
      />

      {/* 4. Confirm Dialog (Only for critical destructive actions like clear all) */}
      <ConfirmModal
        isOpen={isConfirmResetOpen}
        title="确认清空所有地点？"
        message="清空后画布上的所有地点和连线将被移除。您也可以在误操作后按下 Ctrl + Z 进行撤销。"
        confirmText="清空地点"
        cancelText="取消"
        isDangerous={true}
        onConfirm={handleClearAllConfirmed}
        onCancel={() => setIsConfirmResetOpen(false)}
      />

      {/* 5. Ambiguity Modal */}
      {ambiguousPlace && (
        <AmbiguityModal
          isOpen={true}
          placeName={ambiguousPlace.name}
          candidates={ambiguousPlace.candidates}
          onSelectCandidate={cand => handleResolveAmbiguity(ambiguousPlace.id, cand)}
          onCancel={() => setAmbiguousPlace(null)}
        />
      )}
    </div>
  );
};