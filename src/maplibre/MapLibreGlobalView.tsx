import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
type MLMap = maplibregl.Map;
import {
  Place,
  RouteStyle,
  MarkerStyle,
  LabelStyle,
  MapLibreBasemap,
  MapLibreViewState,
} from '../types';
import { createTravelStyle } from './createTravelStyle';
import { REGION_CAMERA_PRESETS, CameraPreset } from './regionPresets';
import { ProjectedPlace } from '../overlay/types';
import { MarkerOverlay } from '../overlay/MarkerOverlay';
import { LabelOverlay } from '../overlay/LabelOverlay';
import { RouteOverlay } from '../overlay/RouteOverlay';
import { Maximize2, ZoomIn, ZoomOut, RotateCcw, Compass, MapPin } from 'lucide-react';

interface MapLibreGlobalViewProps {
  places: Place[];
  basemap: MapLibreBasemap;
  routeStyle: RouteStyle;
  markerStyle: MarkerStyle;
  labelStyle: LabelStyle;
  initialViewState?: MapLibreViewState;
  onViewStateChange?: (viewState: MapLibreViewState) => void;
  onLabelDragStart?: () => void;
  onLabelDragMove?: (placeId: string, offsetX: number, offsetY: number) => void;
  onLabelDragEnd?: (placeId: string, offsetX: number, offsetY: number) => void;
}

export const MapLibreGlobalView: React.FC<MapLibreGlobalViewProps> = ({
  places,
  basemap,
  routeStyle,
  markerStyle,
  labelStyle,
  initialViewState,
  onViewStateChange,
  onLabelDragStart,
  onLabelDragMove,
  onLabelDragEnd,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);

  const [dimensions, setDimensions] = useState({ width: 1000, height: 600 });
  const [currentZoom, setCurrentZoom] = useState<number>(initialViewState?.zoom || 1.8);
  const [projectedPlaces, setProjectedPlaces] = useState<ProjectedPlace[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [showPresetsMenu, setShowPresetsMenu] = useState(false);

  // Filter geo-resolved places
  const resolvedPlaces = useMemo(() => {
    return places.filter((p) => p.status === 'resolved' || p.geoStatus === 'resolved');
  }, [places]);

  // Project places onto screen coordinates
  const updateProjectedPlaces = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    const projected: ProjectedPlace[] = resolvedPlaces.map((p) => {
      const screenPt = map.project([p.lon, p.lat]);
      return {
        place: p,
        screenX: screenPt.x,
        screenY: screenPt.y,
        visible: true,
      };
    });

    setProjectedPlaces(projected);
    setCurrentZoom(parseFloat(map.getZoom().toFixed(2)));
  }, [resolvedPlaces]);

  // Initialize MapLibre
  useEffect(() => {
    if (!mapContainerRef.current) return;

    let isMounted = true;
    let map: MLMap | null = null;

    createTravelStyle({
      styleId: basemap.styleId,
      enableCountryFill: basemap.enableCountryFill ?? true,
      showAdmin1: basemap.showAdmin1 ?? true,
    })
      .then((styleObj) => {
        if (!isMounted || !mapContainerRef.current) return;

        const defaultCenter: [number, number] = initialViewState?.center || [20, 20];
        const defaultZoom = initialViewState?.zoom || 1.8;

        const mapInstance = new maplibregl.Map({
          container: mapContainerRef.current,
          style: styleObj,
          center: defaultCenter,
          zoom: defaultZoom,
          bearing: initialViewState?.bearing || 0,
          pitch: initialViewState?.pitch || 0,
          canvasContextAttributes: { preserveDrawingBuffer: true },
          attributionControl: { compact: true },
        });

        map = mapInstance;
        mapRef.current = mapInstance;

        mapInstance.on('load', () => {
          if (!isMounted) return;
          setMapLoaded(true);
          updateProjectedPlaces();

          // If no initial view state was saved and we have places, fit to points once
          if (!initialViewState && resolvedPlaces.length > 0) {
            const bounds = new maplibregl.LngLatBounds();
            resolvedPlaces.forEach((p) => bounds.extend([p.lon, p.lat]));
            mapInstance.fitBounds(bounds, { padding: 80, maxZoom: 12 });
          }
        });

        const syncOverlay = () => {
          requestAnimationFrame(updateProjectedPlaces);
        };

        mapInstance.on('move', syncOverlay);
        mapInstance.on('zoom', syncOverlay);
        mapInstance.on('resize', syncOverlay);
        mapInstance.on('rotate', syncOverlay);
        mapInstance.on('pitch', syncOverlay);

        mapInstance.on('moveend', () => {
          if (!onViewStateChange) return;
          const center = mapInstance.getCenter();
          onViewStateChange({
            center: [parseFloat(center.lng.toFixed(5)), parseFloat(center.lat.toFixed(5))],
            zoom: parseFloat(mapInstance.getZoom().toFixed(2)),
            bearing: parseFloat(mapInstance.getBearing().toFixed(1)),
            pitch: parseFloat(mapInstance.getPitch().toFixed(1)),
          });
        });
      })
      .catch((err) => {
        console.error('Failed to init MapLibre map:', err);
      });

    return () => {
      isMounted = false;
      if (map) {
        map.remove();
        mapRef.current = null;
      }
    };
  }, []); // Mount once

  // Handle basemap style/options changes dynamically
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    createTravelStyle({
      styleId: basemap.styleId,
      enableCountryFill: basemap.enableCountryFill ?? true,
      showAdmin1: basemap.showAdmin1 ?? true,
    }).then((styleObj) => {
      if (mapRef.current) {
        mapRef.current.setStyle(styleObj);
      }
    });
  }, [basemap.styleId, basemap.enableCountryFill, basemap.showAdmin1, mapLoaded]);

  // Keep projected places updated when places change
  useEffect(() => {
    updateProjectedPlaces();
  }, [updateProjectedPlaces]);

  // Resize observer
  useEffect(() => {
    if (!containerRef.current) return;
    const updateSize = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        if (clientWidth > 100 && clientHeight > 100) {
          setDimensions({ width: clientWidth, height: clientHeight });
          mapRef.current?.resize();
        }
      }
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Fit all places
  const handleFitAll = () => {
    const map = mapRef.current;
    if (!map || resolvedPlaces.length === 0) return;

    if (resolvedPlaces.length === 1) {
      map.flyTo({
        center: [resolvedPlaces[0].lon, resolvedPlaces[0].lat],
        zoom: 6,
        essential: true,
      });
      return;
    }

    const bounds = new maplibregl.LngLatBounds();
    resolvedPlaces.forEach((p) => bounds.extend([p.lon, p.lat]));
    map.fitBounds(bounds, { padding: 90, maxZoom: 12, essential: true });
  };

  // Zoom controls
  const handleZoomIn = () => mapRef.current?.zoomIn();
  const handleZoomOut = () => mapRef.current?.zoomOut();

  // Reset view to default world
  const handleReset = () => {
    mapRef.current?.flyTo({
      center: [20, 20],
      zoom: 1.8,
      bearing: 0,
      pitch: 0,
      essential: true,
    });
  };

  // Switch to region preset
  const handleSelectPreset = (preset: CameraPreset) => {
    mapRef.current?.flyTo({
      center: preset.center,
      zoom: preset.zoom,
      bearing: preset.bearing || 0,
      pitch: preset.pitch || 0,
      essential: true,
    });
    setShowPresetsMenu(false);
  };

  // Project coordinate function for RouteOverlay
  const projectCoordinate = useCallback((lon: number, lat: number) => {
    const map = mapRef.current;
    if (!map) return null;
    const pt = map.project([lon, lat]);
    return { x: pt.x, y: pt.y };
  }, []);

  return (
    <div
      ref={containerRef}
      id="maplibre-global-root"
      className="relative w-full h-full bg-slate-100 overflow-hidden select-none"
    >
      {/* MapLibre WebGL Canvas Container */}
      <div
        ref={mapContainerRef}
        id="maplibre-canvas-container"
        className="absolute inset-0 w-full h-full"
      />

      {/* SVG Travel Overlay (Route, Marker, Label) */}
      <svg
        id="travel-map-svg"
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
        width={dimensions.width}
        height={dimensions.height}
      >
        <defs>
          <style>{`
            text { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif; }
          `}</style>
        </defs>

        {/* Route Overlay */}
        <RouteOverlay
          places={places}
          projectCoordinate={projectCoordinate}
          style={routeStyle}
          canvasWidth={dimensions.width}
        />

        {/* Marker Overlay - Builtin mode disables arbitrary marker dragging */}
        <MarkerOverlay
          projectedPlaces={projectedPlaces}
          style={markerStyle}
          canDrag={false}
        />

        {/* Label Overlay - Allows dragging labelOffset with collision avoidance */}
        <LabelOverlay
          projectedPlaces={projectedPlaces}
          style={labelStyle}
          onDragStart={onLabelDragStart}
          onDragMove={onLabelDragMove}
          onDragEnd={onLabelDragEnd}
        />
      </svg>

      {/* Floating Canvas View Controls */}
      <div className="absolute bottom-5 right-5 flex items-center bg-white/95 backdrop-blur shadow-md rounded-lg border border-slate-200 p-1 space-x-1 z-20">
        <button
          onClick={handleFitAll}
          title="自动缩放适配全部地点"
          className="p-1.5 hover:bg-blue-50 rounded text-blue-600 hover:text-blue-700 transition flex items-center text-xs px-2 font-medium"
        >
          <Maximize2 size={13} className="mr-1" />
          适配全部地点
        </button>

        {/* Region Presets Shortcut Menu */}
        <div className="relative">
          <button
            onClick={() => setShowPresetsMenu(!showPresetsMenu)}
            title="快速切换大洲视角"
            className="p-1.5 hover:bg-slate-100 rounded text-slate-700 transition flex items-center text-xs px-2"
          >
            <Compass size={13} className="mr-1 text-slate-500" />
            快速定位
          </button>

          {showPresetsMenu && (
            <div className="absolute bottom-full mb-1 right-0 bg-white border border-slate-200 rounded-lg shadow-xl py-1 w-32 z-30">
              <div className="text-[10px] font-bold text-slate-400 px-3 py-1 uppercase tracking-wider">
                大洲视角
              </div>
              {REGION_CAMERA_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handleSelectPreset(preset)}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 hover:text-blue-600 transition flex items-center"
                >
                  <MapPin size={11} className="mr-1.5 opacity-60" />
                  {preset.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="w-[1px] h-4 bg-slate-200 my-auto" />

        <button
          onClick={handleZoomIn}
          title="放大"
          className="p-1.5 hover:bg-slate-100 rounded text-slate-700 transition"
        >
          <ZoomIn size={16} />
        </button>

        <button
          onClick={handleZoomOut}
          title="缩小"
          className="p-1.5 hover:bg-slate-100 rounded text-slate-700 transition"
        >
          <ZoomOut size={16} />
        </button>

        <div className="w-[1px] h-4 bg-slate-200 my-auto" />

        <button
          onClick={handleReset}
          title="重置为全球全景"
          className="p-1.5 hover:bg-slate-100 rounded text-slate-700 transition flex items-center text-xs px-1.5"
        >
          <RotateCcw size={13} className="mr-1" />
          全景
        </button>

        <span className="text-[11px] text-slate-400 px-1.5 font-mono min-w-[34px] text-right">
          {Math.round(currentZoom * 10) / 10}z
        </span>
      </div>
    </div>
  );
};
