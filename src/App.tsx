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
  CalibrationPoint,
  CalibratedImageBasemap,
  MapLibreViewState,
  ImageViewState,
} from './types';
import { migrateProjectV2ToV3 } from './types/migration';
import { useHistory } from './editor/useHistory';
import { PlaceList } from './editor/PlaceList';
import { BasemapPanel } from './editor/BasemapPanel';
import { StylePanel } from './editor/StylePanel';
import { ProjectPanel } from './editor/ProjectPanel';
import { MapViewport } from './map/MapViewport';
import { MapRendererErrorBoundary } from './map/MapRendererErrorBoundary';
import { ExportModal } from './export/ExportModal';
import { ConfirmModal } from './editor/ConfirmModal';
import { AmbiguityModal } from './editor/AmbiguityModal';
import { parseInputText, loadPlacesDatabase } from './parser/placeSearch';
import { getImageObjectUrl } from './map/storage/imageStore';
import { checkControlPointsQuality, fitAffineTransform } from './map/transformer';
import { OFFICIAL_BASEMAP_REGISTRY } from './map/basemaps/registry';
import { DEFAULT_MAPLIBRE_STYLE_ID } from './maplibre/styleCatalog';
import {
  MapPin,
  Map as MapIcon,
  Sliders,
  FolderKanban,
  Undo2,
  Redo2,
  Download,
  Plane,
} from 'lucide-react';

const STORAGE_KEY_V3 = 'travel_map_project_v3';
const STORAGE_KEY_V2 = 'travel_map_project_v2';
const INIT_FLAG_KEY = 'travel_map_has_initialized_v3';
const LIBERTY_DEFAULT_MIGRATION_KEY = 'travel_map_default_basemap_liberty_v1';

const defaultRouteStyle: RouteStyle = {
  type: 'curved',
  mode: 'geodesic',
  strokeColor: '#e63946',
  strokeWidth: 2.5,
  strokeOpacity: 0.9,
  dashStyle: 'solid',
  showArrows: true,
};

const defaultMarkerStyle: MarkerStyle = {
  type: 'dot',
  color: '#e63946',
  size: 7,
  strokeColor: '#ffffff',
  strokeWidth: 2,
};

const defaultLabelStyle: LabelStyle = {
  fontSize: 12,
  color: '#1e293b',
  showHalo: true,
  fontWeight: 'medium',
  autoAvoidCollisions: true,
};

const defaultBasemap: BasemapConfig = {
  type: 'builtin-maplibre',
  styleId: DEFAULT_MAPLIBRE_STYLE_ID,
  enableCountryFill: true,
  showAdmin1: true,
};

const defaultCamera: CameraState = {
  zoom: 1,
  panX: 0,
  panY: 0,
};

const initialProject: ProjectData = {
  version: '3.0',
  title: '我的旅行路线',
  places: [],
  basemap: defaultBasemap,
  camera: defaultCamera,
  views: {
    builtin: {
      center: [20, 20],
      zoom: 1.8,
      bearing: 0,
      pitch: 0,
    },
  },
  routeStyle: defaultRouteStyle,
  markerStyle: defaultMarkerStyle,
  labelStyle: defaultLabelStyle,
  overlayScaleMode: 'screen-fixed',
};

const replacePreviousDefaultBasemap = (project: ProjectData): ProjectData => {
  if (project.basemap.type !== 'builtin-maplibre' || project.basemap.styleId !== 'travel-clean') {
    return project;
  }

  return {
    ...project,
    basemap: {
      ...project.basemap,
      styleId: DEFAULT_MAPLIBRE_STYLE_ID,
    },
  };
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
    canRedo,
  } = useHistory<ProjectData>(() => {
    const shouldMigratePreviousDefault =
      localStorage.getItem(LIBERTY_DEFAULT_MIGRATION_KEY) !== 'true';

    try {
      // 1. Try V3 storage first
      const savedV3 = localStorage.getItem(STORAGE_KEY_V3);
      if (savedV3) {
        const parsed = JSON.parse(savedV3);
        if (parsed && Array.isArray(parsed.places)) {
          const migrated = migrateProjectV2ToV3(parsed);
          return shouldMigratePreviousDefault
            ? replacePreviousDefaultBasemap(migrated)
            : migrated;
        }
      }

      // 2. Try V2 legacy storage and migrate
      const savedV2 = localStorage.getItem(STORAGE_KEY_V2);
      if (savedV2) {
        const parsed = JSON.parse(savedV2);
        if (parsed && Array.isArray(parsed.places)) {
          const migrated = migrateProjectV2ToV3(parsed);
          return shouldMigratePreviousDefault
            ? replacePreviousDefaultBasemap(migrated)
            : migrated;
        }
      }
    } catch (e) {
      console.warn('Error loading saved project:', e);
    }
    return initialProject;
  }, STORAGE_KEY_V3);

  const [activeTab, setActiveTab] = useState<'places' | 'basemap' | 'style' | 'project'>('places');
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isConfirmResetOpen, setIsConfirmResetOpen] = useState(false);
  const [ambiguousPlace, setAmbiguousPlace] = useState<{
    id: string;
    name: string;
    candidates: PlaceRecord[];
  } | null>(null);
  const [pickingPlaceId, setPickingPlaceId] = useState<string | null>(null);
  const [imageFitRequestId, setImageFitRequestId] = useState(0);

  useEffect(() => {
    localStorage.setItem(LIBERTY_DEFAULT_MIGRATION_KEY, 'true');
  }, []);

  // Preload places database on startup
  useEffect(() => {
    loadPlacesDatabase();
  }, []);

  // Restore image url from IndexedDB or official registry if basemap is custom image
  useEffect(() => {
    const bm = project.basemap;
    if (
      bm.type === 'free-image' ||
      bm.type === 'equirectangular-image' ||
      bm.type === 'calibrated-image'
    ) {
      if ((bm as any).assetId && !(bm as any).imageUrl) {
        const official = OFFICIAL_BASEMAP_REGISTRY.find((o) => o.id === (bm as any).assetId);
        if (official && official.assetPath) {
          setProject((prev) => ({
            ...prev,
            basemap: { ...prev.basemap, imageUrl: official.assetPath } as any,
          }));
          return;
        }

        getImageObjectUrl((bm as any).assetId).then((url) => {
          if (url) {
            setProject((prev) => ({
              ...prev,
              basemap: { ...prev.basemap, imageUrl: url } as any,
            }));
          }
        });
      }
    }
  }, [project.basemap, setProject]);

  // Initial load sample preset ONLY on true first startup (prevents re-spawning sample after user clears)
  useEffect(() => {
    const hasInitialized = localStorage.getItem(INIT_FLAG_KEY);
    if (!hasInitialized) {
      localStorage.setItem(INIT_FLAG_KEY, 'true');
      if (project.places.length === 0) {
        const sampleText = `东京\n43.0618, 141.3545 | 札幌\n奥斯陆\n64.1466, -21.9426 | 雷克雅未克\n78.2232, 15.6469 | 朗伊尔城`;
        parseInputText(sampleText, []).then((parsedPlaces) => {
          setProject((prev) => ({
            ...prev,
            places: parsedPlaces,
          }));
        });
      }
    }
  }, [project.places.length, setProject]);

  // Batch input update
  const handleBatchUpdate = async (inputText: string) => {
    const newPlaces = await parseInputText(inputText, project.places);
    setProject((prev) => ({
      ...prev,
      places: [...prev.places, ...newPlaces],
    }));
  };

  const handleReorderPlaces = (newPlaces: Place[]) => {
    setProject((prev) => ({
      ...prev,
      places: newPlaces,
    }));
  };

  const handleDeletePlace = (placeId: string) => {
    setProject((prev) => ({
      ...prev,
      places: prev.places.filter((p) => p.id !== placeId).map((p, idx) => ({ ...p, order: idx })),
    }));
  };

  const handleResetPlaceOffset = (placeId: string) => {
    setProject((prev) => ({
      ...prev,
      places: prev.places.map((p) =>
        p.id === placeId
          ? {
              ...p,
              markerMapOffsetX: 0,
              markerMapOffsetY: 0,
              manualOffsetX: 0,
              manualOffsetY: 0,
              labelOffsetX: 12,
              labelOffsetY: -12,
            }
          : p
      ),
    }));
  };

  // Transactional Dragging Handlers
  const handleDragStart = useCallback(() => {
    beginTransaction();
  }, [beginTransaction]);

  const handleMarkerDragMove = useCallback(
    (placeId: string, mapDx: number, mapDy: number) => {
      setTransient((prev) => ({
        ...prev,
        places: prev.places.map((p) =>
          p.id === placeId
            ? {
                ...p,
                markerMapOffsetX: (p.markerMapOffsetX || 0) + mapDx,
                markerMapOffsetY: (p.markerMapOffsetY || 0) + mapDy,
              }
            : p
        ),
      }));
    },
    [setTransient]
  );

  const handleMarkerDragEnd = useCallback(
    (placeId: string, mapDx: number, mapDy: number) => {
      commitTransaction((prev) => ({
        ...prev,
        places: prev.places.map((p) =>
          p.id === placeId
            ? {
                ...p,
                markerMapOffsetX: (p.markerMapOffsetX || 0) + mapDx,
                markerMapOffsetY: (p.markerMapOffsetY || 0) + mapDy,
              }
            : p
        ),
      }));
    },
    [commitTransaction]
  );

  const handleLabelDragMove = useCallback(
    (placeId: string, x: number, y: number) => {
      setTransient((prev) => ({
        ...prev,
        places: prev.places.map((p) =>
          p.id === placeId ? { ...p, labelOffsetX: x, labelOffsetY: y } : p
        ),
      }));
    },
    [setTransient]
  );

  const handleLabelDragEnd = useCallback(
    (placeId: string, x: number, y: number) => {
      commitTransaction((prev) => ({
        ...prev,
        places: prev.places.map((p) =>
          p.id === placeId ? { ...p, labelOffsetX: x, labelOffsetY: y } : p
        ),
      }));
    },
    [commitTransaction]
  );

  // Decoupled Camera View State Handlers (DO NOT PUSH TO UNDO HISTORY)
  const handleMapLibreViewStateChange = useCallback(
    (vs: MapLibreViewState) => {
      setTransient((prev) => ({
        ...prev,
        views: {
          ...prev.views,
          builtin: vs,
        },
      }));
    },
    [setTransient]
  );

  const handleImageViewStateChange = useCallback(
    (vs: ImageViewState) => {
      setTransient((prev) => ({
        ...prev,
        views: {
          ...prev.views,
          image: vs,
        },
      }));
    },
    [setTransient]
  );

  const handlePolarCameraChange = useCallback(
    (cam: CameraState) => {
      setTransient((prev) => ({
        ...prev,
        views: {
          ...prev.views,
          polar: cam,
        },
        camera: cam,
      }));
    },
    [setTransient]
  );

  // ImageMapView owns fit math because it knows the real measured viewport.
  const handleFitToImage = useCallback(() => {
    setImageFitRequestId((current) => current + 1);
  }, []);

  // Point picking for custom basemaps (both free-image & calibrated-image)
  const handlePlacePicked = (
    placeId: string,
    imgX: number,
    imgY: number,
    normX: number,
    normY: number
  ) => {
    if (project.basemap.type === 'calibrated-image') {
      const place = project.places.find((p) => p.id === placeId);
      if (!place) return;
      const hasResolvedCoordinates =
        (place.status === 'resolved' || place.geoStatus === 'resolved') &&
        Number.isFinite(place.lat) &&
        Number.isFinite(place.lon);
      if (!hasResolvedCoordinates) {
        alert('该地点尚未解析经纬度，请先设置有效经纬度再用于地图校准。');
        setPickingPlaceId(null);
        return;
      }

      const currentPoints = project.basemap.controlPoints || [];
      const filtered = currentPoints.filter((cp) => cp.placeId !== placeId);
      const newPoint: CalibrationPoint = {
        placeId: place.id,
        name: place.displayName,
        lat: place.lat,
        lon: place.lon,
        imageX: imgX,
        imageY: imgY,
      };
      const updatedPoints = [...filtered, newPoint];

      let newTransform: CalibratedImageBasemap['transform'];
      let newError: number | undefined;

      if (updatedPoints.length >= 3) {
        const quality = checkControlPointsQuality(updatedPoints);
        if (quality.isValid) {
          const fit = fitAffineTransform(updatedPoints);
          if (fit) {
            newTransform = fit.transform;
            newError = fit.errorPx;
          }
        }
      }

      setProject((prev) => ({
        ...prev,
        basemap: {
          ...prev.basemap,
          controlPoints: updatedPoints,
          transform: newTransform,
          errorPx: newError,
        } as CalibratedImageBasemap,
      }));
      setPickingPlaceId(null);
      return;
    }

    // Free image mode:
    setProject((prev) => ({
      ...prev,
      places: prev.places.map((p) =>
        p.id === placeId
          ? {
              ...p,
              visualPosition: { x: normX, y: normY },
              visualStatus: 'placed',
            }
          : p
      ),
    }));
    setPickingPlaceId(null);
  };

  const handleResolveAmbiguity = (placeId: string, candidate: PlaceRecord) => {
    setProject((prev) => ({
      ...prev,
      places: prev.places.map((p) => {
        if (p.id !== placeId) return p;
        return {
          ...p,
          displayName: candidate.displayName,
          name: candidate.name,
          lat: candidate.lat,
          lon: candidate.lon,
          country: candidate.country,
          status: 'resolved',
          geoStatus: 'resolved',
        };
      }),
    }));
    setAmbiguousPlace(null);
  };

  const handleManualResolveCoord = (placeId: string, lat: number, lon: number) => {
    setProject((prev) => ({
      ...prev,
      places: prev.places.map((p) => {
        if (p.id !== placeId) return p;
        return {
          ...p,
          lat,
          lon,
          source: 'manual',
          status: 'resolved',
          geoStatus: 'resolved',
        };
      }),
    }));
  };

  // Presets loader
  const handleLoadPreset = async (presetId: string) => {
    let presetText = '';
    let newBasemap: BasemapConfig = defaultBasemap;

    if (presetId === 'oceania_island') {
      presetText = `悉尼\n奥克兰\n楠迪\n努库阿洛法`;
      newBasemap = {
        type: 'builtin-maplibre',
        styleId: DEFAULT_MAPLIBRE_STYLE_ID,
        enableCountryFill: true,
        showAdmin1: true,
      };
    } else if (presetId === 'antarctica_pole') {
      presetText = `乌斯怀亚\n长城站\n阿蒙森-斯科特南极站`;
      newBasemap = {
        type: 'polar',
        pole: 'south',
        projection: 'stereographic',
        oceanColor: '#e0f2fe',
        landColor: '#ffffff',
        borderColor: '#cbd5e1',
      };
    } else if (presetId === 'antimeridian') {
      presetText = `东京\n安克雷奇`;
      newBasemap = {
        type: 'builtin-maplibre',
        styleId: DEFAULT_MAPLIBRE_STYLE_ID,
        enableCountryFill: true,
        showAdmin1: true,
      };
    } else if (presetId === 'spec_v1') {
      presetText = `东京\n43.0618, 141.3545 | 札幌\n奥斯陆\n64.1466, -21.9426 | 雷克雅未克\n78.2232, 15.6469 | 朗伊尔城`;
      newBasemap = {
        type: 'builtin-maplibre',
        styleId: DEFAULT_MAPLIBRE_STYLE_ID,
        enableCountryFill: true,
        showAdmin1: true,
      };
    } else if (presetId === 'silkroad') {
      presetText = `西安\n敦煌\n喀什\n撒马尔罕\n伊斯坦布尔\n罗马`;
      newBasemap = {
        type: 'builtin-maplibre',
        styleId: DEFAULT_MAPLIBRE_STYLE_ID,
        enableCountryFill: true,
        showAdmin1: true,
      };
    }

    const parsed = await parseInputText(presetText);
    setProject((prev) => ({
      ...prev,
      places: parsed,
      basemap: newBasemap,
      views: {
        builtin: {
          center: [20, 20],
          zoom: 2,
          bearing: 0,
          pitch: 0,
        },
      },
    }));
    setActiveTab('places');
  };

  const handleClearAllConfirmed = () => {
    setProject((prev) => ({
      ...prev,
      places: [],
    }));
    setIsConfirmResetOpen(false);
  };

  const handleResetRendererToBuiltin = useCallback(() => {
    setPickingPlaceId(null);
    setProject((prev) => ({
      ...prev,
      basemap: { ...defaultBasemap },
      views: {
        ...prev.views,
        builtin: prev.views?.builtin || initialProject.views?.builtin,
      },
    }));
  }, [setProject]);

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
                V3.0 Hybrid Pro
              </span>
            </h1>
            <p className="text-[11px] text-slate-400">
              全球连续矢量瓦片底图 · SVG 旅行覆盖层 · 极地与自定义底图双引擎
            </p>
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
              title="撤销 (Ctrl+Z - 一步还原一次修改)"
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
                onAddPlace={(line) => handleBatchUpdate(line)}
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
                onChangeBasemap={(newBasemap) =>
                  setProject((prev) => ({ ...prev, basemap: newBasemap }))
                }
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
                onChangeRouteStyle={(stl) =>
                  setProject((prev) => ({
                    ...prev,
                    routeStyle: { ...prev.routeStyle, ...stl },
                  }))
                }
                onChangeMarkerStyle={(stl) =>
                  setProject((prev) => ({
                    ...prev,
                    markerStyle: { ...prev.markerStyle, ...stl },
                  }))
                }
                onChangeLabelStyle={(stl) =>
                  setProject((prev) => ({
                    ...prev,
                    labelStyle: { ...prev.labelStyle, ...stl },
                  }))
                }
                onChangeOverlayScaleMode={(mode) =>
                  setProject((prev) => ({ ...prev, overlayScaleMode: mode }))
                }
              />
            )}

            {activeTab === 'project' && (
              <ProjectPanel
                projectData={project}
                onImportProject={(data) => setProject(migrateProjectV2ToV3(data))}
                onRequestReset={() => setIsConfirmResetOpen(true)}
                onLoadPreset={handleLoadPreset}
              />
            )}
          </div>
        </aside>

        {/* Right Map Canvas (Routed through MapViewport) */}
        <main className="flex-1 h-full overflow-hidden relative">
          <MapRendererErrorBoundary
            basemapType={project.basemap.type}
            resetKey={`${project.basemap.type}:${'assetId' in project.basemap ? project.basemap.assetId : ''}`}
            onResetToBuiltinMap={handleResetRendererToBuiltin}
          >
            <MapViewport
              project={project}
              pickingPlaceId={pickingPlaceId}
              imageFitRequestId={imageFitRequestId}
              onPlacePicked={handlePlacePicked}
              onMapLibreViewStateChange={handleMapLibreViewStateChange}
              onImageViewStateChange={handleImageViewStateChange}
              onPolarCameraChange={handlePolarCameraChange}
              onMarkerDragMove={handleMarkerDragMove}
              onMarkerDragEnd={handleMarkerDragEnd}
              onLabelDragStart={handleDragStart}
              onLabelDragMove={handleLabelDragMove}
              onLabelDragEnd={handleLabelDragEnd}
            />
          </MapRendererErrorBoundary>
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
          onSelectCandidate={(cand) => handleResolveAmbiguity(ambiguousPlace.id, cand)}
          onCancel={() => setAmbiguousPlace(null)}
        />
      )}
    </div>
  );
};
