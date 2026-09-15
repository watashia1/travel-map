import React, { useState, useEffect, useCallback } from 'react';
import {
  ProjectData,
  Place,
  PlaceRecord,
  RouteStyle,
  MarkerStyle,
  LabelStyle,
  BasemapConfig,
  CameraState,
  OverlayScaleMode,
  CalibrationPoint,
  CalibratedImageBasemap
} from './types';
import { useHistory } from './editor/useHistory';
import { PlaceList } from './editor/PlaceList';
import { BasemapPanel } from './editor/BasemapPanel';
import { StylePanel } from './editor/StylePanel';
import { ProjectPanel } from './editor/ProjectPanel';
import { MapCanvas } from './map/MapCanvas';
import { ExportModal } from './export/ExportModal';
import { ConfirmModal } from './editor/ConfirmModal';
import { AmbiguityModal } from './editor/AmbiguityModal';
import { parseInputText, loadPlacesDatabase } from './parser/placeSearch';
import { getImageObjectUrl } from './map/storage/imageStore';
import { calculateFitToImage } from './map/projections';
import { fitAffineTransform } from './map/transformer';
import { OFFICIAL_BASEMAP_REGISTRY } from './map/basemaps/registry';
import {
  MapPin,
  Map as MapIcon,
  Sliders,
  FolderKanban,
  Undo2,
  Redo2,
  Download,
  Plane
} from 'lucide-react';

const STORAGE_KEY = 'travel_map_project_v2';

const defaultRouteStyle: RouteStyle = {
  type: 'curved',
  mode: 'geodesic',
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
  fontWeight: 'medium',
  autoAvoidCollisions: true
};

const defaultBasemap: BasemapConfig = {
  type: 'builtin',
  mapId: 'world',
  projection: 'equalEarth',
  region: 'world',
  landColor: '#f1efe8',
  borderColor: '#d5d2c8',
  oceanColor: '#ffffff'
};

const defaultCamera: CameraState = {
  zoom: 1,
  panX: 0,
  panY: 0
};

const initialProject: ProjectData = {
  version: '2.0',
  title: '我的旅行路线',
  places: [],
  basemap: defaultBasemap,
  camera: defaultCamera,
  routeStyle: defaultRouteStyle,
  markerStyle: defaultMarkerStyle,
  labelStyle: defaultLabelStyle,
  overlayScaleMode: 'screen-fixed'
};

export const App: React.FC = () => {
  const {
    state: project,
    set: setProject,
    beginTransaction,
    setTransient,
    commitTransaction,
    undo,
    redo,
    canUndo,
    canRedo
  } = useHistory<ProjectData>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.places)) {
          return {
            ...initialProject,
            ...parsed,
            basemap: parsed.basemap || defaultBasemap,
            camera: parsed.camera || defaultCamera
          };
        }
      }
    } catch {}
    return initialProject;
  }, STORAGE_KEY);

  const [activeTab, setActiveTab] = useState<'places' | 'basemap' | 'style' | 'project'>('places');
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isConfirmResetOpen, setIsConfirmResetOpen] = useState(false);
  const [ambiguousPlace, setAmbiguousPlace] = useState<{ id: string; name: string; candidates: PlaceRecord[] } | null>(null);
  const [pickingPlaceId, setPickingPlaceId] = useState<string | null>(null);

  // Preload places database on startup
  useEffect(() => {
    loadPlacesDatabase();
  }, []);

  // Restore image url from IndexedDB or official registry if basemap is custom image
  useEffect(() => {
    const bm = project.basemap;
    if (bm.type !== 'builtin' && (bm as any).assetId && !(bm as any).imageUrl) {
      // Check official registry first
      const official = OFFICIAL_BASEMAP_REGISTRY.find(o => o.id === (bm as any).assetId);
      if (official && official.assetPath) {
        setProject(prev => ({
          ...prev,
          basemap: { ...prev.basemap, imageUrl: official.assetPath } as any
        }));
        return;
      }

      getImageObjectUrl((bm as any).assetId).then(url => {
        if (url) {
          setProject(prev => ({
            ...prev,
            basemap: { ...prev.basemap, imageUrl: url } as any
          }));
        }
      });
    }
  }, [project.basemap, setProject]);

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

  // Batch input update
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

  // Transactional Dragging Handlers
  const handleDragStart = useCallback(() => {
    beginTransaction();
  }, [beginTransaction]);

  const handleMarkerDragMove = useCallback((placeId: string, x: number, y: number) => {
    setTransient(prev => ({
      ...prev,
      places: prev.places.map(p => (p.id === placeId ? { ...p, manualOffsetX: x, manualOffsetY: y } : p))
    }));
  }, [setTransient]);

  const handleMarkerDragEnd = useCallback((placeId: string, x: number, y: number) => {
    commitTransaction(prev => ({
      ...prev,
      places: prev.places.map(p => (p.id === placeId ? { ...p, manualOffsetX: x, manualOffsetY: y } : p))
    }));
  }, [commitTransaction]);

  const handleLabelDragMove = useCallback((placeId: string, x: number, y: number) => {
    setTransient(prev => ({
      ...prev,
      places: prev.places.map(p => (p.id === placeId ? { ...p, labelOffsetX: x, labelOffsetY: y } : p))
    }));
  }, [setTransient]);

  const handleLabelDragEnd = useCallback((placeId: string, x: number, y: number) => {
    commitTransaction(prev => ({
      ...prev,
      places: prev.places.map(p => (p.id === placeId ? { ...p, labelOffsetX: x, labelOffsetY: y } : p))
    }));
  }, [commitTransaction]);

  // Fit view to entire image
  const handleFitToImage = useCallback((w?: number, h?: number) => {
    const imgW = w || (project.basemap as any).imageWidth || 1000;
    const imgH = h || (project.basemap as any).imageHeight || 600;
    const fit = calculateFitToImage(imgW, imgH, 1000, 600);
    setProject(prev => ({
      ...prev,
      camera: fit
    }));
  }, [project.basemap, setProject]);

  // Point picking for custom basemaps (both free-image & calibrated-image)
  const handlePlacePicked = (placeId: string, imgX: number, imgY: number, normX: number, normY: number) => {
    if (project.basemap.type === 'calibrated-image') {
      const place = project.places.find(p => p.id === placeId);
      if (!place) return;

      const currentPoints = project.basemap.controlPoints || [];
      const filtered = currentPoints.filter(cp => cp.placeId !== placeId);
      const newPoint: CalibrationPoint = {
        placeId: place.id,
        name: place.displayName,
        lat: place.lat,
        lon: place.lon,
        imageX: imgX,
        imageY: imgY
      };
      const updatedPoints = [...filtered, newPoint];

      let newTransform = project.basemap.transform;
      let newError = project.basemap.errorPx;

      if (updatedPoints.length >= 3) {
        const fit = fitAffineTransform(updatedPoints);
        if (fit) {
          newTransform = fit.transform;
          newError = fit.errorPx;
        }
      }

      setProject(prev => ({
        ...prev,
        basemap: {
          ...prev.basemap,
          controlPoints: updatedPoints,
          transform: newTransform,
          errorPx: newError
        } as CalibratedImageBasemap,
        places: prev.places.map(p =>
          p.id === placeId ? { ...p, status: 'resolved' } : p
        )
      }));
      setPickingPlaceId(null);
      return;
    }

    // Free image mode:
    setProject(prev => ({
      ...prev,
      places: prev.places.map(p =>
        p.id === placeId
          ? { ...p, visualPosition: { x: normX, y: normY }, status: 'resolved' }
          : p
      )
    }));
    setPickingPlaceId(null);
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

  // Presets loader
  const handleLoadPreset = async (presetId: string) => {
    let presetText = '';
    let newBasemap: BasemapConfig = defaultBasemap;

    if (presetId === 'galapagos') {
      presetText = `圣克里斯托瓦尔岛\n弗雷里安纳岛\n伊莎贝拉岛\n圣地亚哥岛`;
      const galapagosItem = OFFICIAL_BASEMAP_REGISTRY.find(o => o.id === 'galapagos-topo');
      if (galapagosItem) {
        newBasemap = {
          type: 'calibrated-image',
          assetId: galapagosItem.id,
          imageName: galapagosItem.title,
          imageWidth: galapagosItem.imageWidth,
          imageHeight: galapagosItem.imageHeight,
          imageUrl: galapagosItem.assetPath,
          transform: galapagosItem.defaultTransform,
          controlPoints: galapagosItem.defaultControlPoints || [],
          errorPx: galapagosItem.errorPx
        };
      }
    } else if (presetId === 'arctic_true') {
      presetText = `奥斯陆\n特罗姆瑟\n朗伊尔城\n89.9, 0 | 北极点`;
      newBasemap = { ...defaultBasemap, projection: 'azimuthalEquidistant', region: 'arctic' };
    } else if (presetId === 'antimeridian') {
      presetText = `东京\n安克雷奇`;
      newBasemap = { ...defaultBasemap, projection: 'equalEarth', region: 'world' };
    } else if (presetId === 'spec_v1') {
      presetText = `东京\n43.0618, 141.3545 | 札幌\n奥斯陆\n64.1466, -21.9426 | 雷克雅未克\n78.2232, 15.6469 | 朗伊尔城`;
      newBasemap = { ...defaultBasemap, projection: 'equalEarth', region: 'world' };
    } else if (presetId === 'silkroad') {
      presetText = `西安\n敦煌\n喀什\n撒马尔罕\n伊斯坦布尔\n罗马`;
      newBasemap = { ...defaultBasemap, projection: 'equalEarth', region: 'asia' };
    }

    const parsed = await parseInputText(presetText);
    let initialCam = defaultCamera;
    if (presetId === 'galapagos') {
      initialCam = calculateFitToImage(2160, 2160, 1000, 600);
    }

    setProject(prev => ({
      ...prev,
      places: parsed,
      basemap: newBasemap,
      camera: initialCam
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
                V2.0 Pro
              </span>
            </h1>
            <p className="text-[11px] text-slate-400">轻量中文经纬度与自定义底图视觉编辑器 · 纯前端纯本地</p>
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
              title="撤销 (Ctrl+Z - 一步还原一次拖动)"
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
        <aside className="w-[350px] bg-white border-r border-slate-200 flex flex-col shrink-0 shadow-sm z-10">
          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-200 text-xs font-medium">
            <button
              onClick={() => setActiveTab('places')}
              className={`flex-1 py-3 text-center border-b-2 transition flex items-center justify-center space-x-1 ${
                activeTab === 'places'
                  ? 'border-blue-600 text-blue-600 font-semibold bg-blue-50/20'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <MapPin size={14} />
              <span>地点 ({project.places.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('basemap')}
              className={`flex-1 py-3 text-center border-b-2 transition flex items-center justify-center space-x-1 ${
                activeTab === 'basemap'
                  ? 'border-blue-600 text-blue-600 font-semibold bg-blue-50/20'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <MapIcon size={14} />
              <span>底图</span>
            </button>

            <button
              onClick={() => setActiveTab('style')}
              className={`flex-1 py-3 text-center border-b-2 transition flex items-center justify-center space-x-1 ${
                activeTab === 'style'
                  ? 'border-blue-600 text-blue-600 font-semibold bg-blue-50/20'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Sliders size={14} />
              <span>样式</span>
            </button>

            <button
              onClick={() => setActiveTab('project')}
              className={`flex-1 py-3 text-center border-b-2 transition flex items-center justify-center space-x-1 ${
                activeTab === 'project'
                  ? 'border-blue-600 text-blue-600 font-semibold bg-blue-50/20'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <FolderKanban size={14} />
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

            {activeTab === 'basemap' && (
              <BasemapPanel
                basemap={project.basemap}
                places={project.places}
                pickingPlaceId={pickingPlaceId}
                onSelectPickingPlace={setPickingPlaceId}
                onChangeBasemap={newBasemap => setProject(prev => ({ ...prev, basemap: newBasemap }))}
                onFitImage={handleFitToImage}
              />
            )}

            {activeTab === 'style' && (
              <StylePanel
                routeStyle={project.routeStyle}
                markerStyle={project.markerStyle}
                labelStyle={project.labelStyle}
                overlayScaleMode={project.overlayScaleMode}
                basemapType={project.basemap.type}
                onChangeRouteStyle={stl => setProject(prev => ({ ...prev, routeStyle: { ...prev.routeStyle, ...stl } }))}
                onChangeMarkerStyle={stl => setProject(prev => ({ ...prev, markerStyle: { ...prev.markerStyle, ...stl } }))}
                onChangeLabelStyle={stl => setProject(prev => ({ ...prev, labelStyle: { ...prev.labelStyle, ...stl } }))}
                onChangeOverlayScaleMode={mode => setProject(prev => ({ ...prev, overlayScaleMode: mode }))}
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
            basemap={project.basemap}
            camera={project.camera}
            routeStyle={project.routeStyle}
            markerStyle={project.markerStyle}
            labelStyle={project.labelStyle}
            overlayScaleMode={project.overlayScaleMode}
            pickingPlaceId={pickingPlaceId}
            onPlacePicked={handlePlacePicked}
            onCameraChange={newCamera => setProject(prev => ({ ...prev, camera: newCamera }))}
            onDragStart={handleDragStart}
            onMarkerDragMove={handleMarkerDragMove}
            onMarkerDragEnd={handleMarkerDragEnd}
            onLabelDragMove={handleLabelDragMove}
            onLabelDragEnd={handleLabelDragEnd}
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
        message="清空后画布上的所有地点和连线将被移除。您也可以在误操作后按下 Ctrl + Z 进行单步撤销。"
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
