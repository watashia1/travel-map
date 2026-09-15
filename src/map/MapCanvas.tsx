import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  Place,
  RouteStyle,
  MarkerStyle,
  LabelStyle,
  BasemapConfig,
  CameraState,
  OverlayScaleMode,
  BuiltinBasemap
} from '../types';
import { createMapProjection, calculateFitToPoints, calculateFitToImage } from './projections';
import { createCoordinateTransformer, getPlaceMapAnchor } from './transformer';
import { RouteLayer } from './RouteLayer';
import { MarkerLayer } from './MarkerLayer';
import { LabelLayer } from './LabelLayer';
import { ZoomIn, ZoomOut, RotateCcw, Maximize2, Crosshair, Image as ImageIcon } from 'lucide-react';

const geoCache = new Map<string, any>();

async function fetchGeoJSON(url: string): Promise<any> {
  if (geoCache.has(url)) {
    return geoCache.get(url);
  }
  const res = await fetch(url);
  const data = await res.json();
  geoCache.set(url, data);
  return data;
}

const countryPalette = [
  '#e9eef5',
  '#f0eadf',
  '#e6eee6',
  '#efe7ed',
  '#e8edf0',
  '#f1ecdf'
];

function stableHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function colorForCountry(
  feature: any,
  defaultLandColor?: string,
  enableColorByCountry = true
): string {
  if (!enableColorByCountry) return defaultLandColor || '#f1efe8';
  const key =
    feature.properties?.ADM0_A3 ||
    feature.properties?.ISO_A3 ||
    feature.properties?.ADMIN ||
    feature.properties?.NAME ||
    feature.properties?.name ||
    '';
  if (!key) return defaultLandColor || '#f1efe8';
  return countryPalette[stableHash(key) % countryPalette.length];
}

interface MapCanvasProps {
  places: Place[];
  basemap: BasemapConfig;
  camera: CameraState;
  routeStyle: RouteStyle;
  markerStyle: MarkerStyle;
  labelStyle: LabelStyle;
  overlayScaleMode?: OverlayScaleMode;
  pickingPlaceId?: string | null;
  onPlacePicked?: (placeId: string, imgX: number, imgY: number, normX: number, normY: number) => void;
  onCameraChange: (camera: CameraState) => void;
  onDragStart: () => void;
  onMarkerDragMove: (placeId: string, x: number, y: number) => void;
  onMarkerDragEnd: (placeId: string, x: number, y: number) => void;
  onLabelDragMove: (placeId: string, x: number, y: number) => void;
  onLabelDragEnd: (placeId: string, x: number, y: number) => void;
}

export const MapCanvas: React.FC<MapCanvasProps> = ({
  places,
  basemap,
  camera,
  routeStyle,
  markerStyle,
  labelStyle,
  overlayScaleMode = 'screen-fixed',
  pickingPlaceId = null,
  onPlacePicked,
  onCameraChange,
  onDragStart,
  onMarkerDragMove,
  onMarkerDragEnd,
  onLabelDragMove,
  onLabelDragEnd
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 1000, height: 600 });
  const [geoFeatures, setGeoFeatures] = useState<any[]>([]);
  const [admin1Features, setAdmin1Features] = useState<any[]>([]);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ startX: number; startY: number; initialPanX: number; initialPanY: number } | null>(null);

  // Load Natural Earth GeoJSON for builtin basemaps (110m for world, 50m for continents)
  useEffect(() => {
    let isMounted = true;
    if (basemap.type !== 'builtin') {
      setGeoFeatures([]);
      setAdmin1Features([]);
      return;
    }

    if (basemap.region === 'world') {
      fetchGeoJSON('./data/ne_110m_admin_0_countries.geojson')
        .then(geojson => {
          if (isMounted) {
            setGeoFeatures(geojson.features || []);
            setAdmin1Features([]);
          }
        })
        .catch(err => {
          console.error('Failed to load ne_110m_admin_0_countries.geojson', err);
        });
    } else {
      // Continent view: load 50m admin 0 countries + 50m admin 1 lines
      Promise.all([
        fetchGeoJSON('./data/ne_50m_admin_0_countries.geojson'),
        (basemap as BuiltinBasemap).showAdmin1 !== false
          ? fetchGeoJSON('./data/ne_50m_admin_1_states_provinces_lines.geojson')
          : Promise.resolve(null)
      ])
        .then(([countriesGeo, admin1Geo]) => {
          if (isMounted) {
            setGeoFeatures(countriesGeo?.features || []);
            setAdmin1Features(admin1Geo?.features || []);
          }
        })
        .catch(err => {
          console.error('Failed to load continent 50m geojson', err);
        });
    }

    return () => {
      isMounted = false;
    };
  }, [basemap.type, (basemap as BuiltinBasemap).region, (basemap as BuiltinBasemap).showAdmin1]);
  useEffect(() => {
    if (!containerRef.current) return;
    const updateSize = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        if (clientWidth > 100 && clientHeight > 100) {
          setDimensions({ width: clientWidth, height: clientHeight });
        }
      }
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Compute projection and path generator
  const { projection, pathGenerator } = useMemo(() => {
    const builtinCfg: BuiltinBasemap =
      basemap.type === 'builtin'
        ? basemap
        : {
            type: 'builtin',
            mapId: 'world',
            projection: 'equalEarth',
            region: 'world',
            landColor: '#f1efe8',
            borderColor: '#d5d2c8',
            oceanColor: '#ffffff'
          };

    return createMapProjection(builtinCfg, dimensions.width, dimensions.height);
  }, [basemap, dimensions]);

  // Unified Coordinate Transformer
  const transformer = useMemo(() => {
    return createCoordinateTransformer(basemap, projection, dimensions.width, dimensions.height);
  }, [basemap, projection, dimensions]);

  // Fit to points handler
  const handleFitToPoints = () => {
    const fit = calculateFitToPoints(
      places,
      dimensions.width,
      dimensions.height,
      (lon, lat, p) => getPlaceMapAnchor(p, transformer)
    );
    if (fit) {
      onCameraChange({
        ...camera,
        zoom: fit.zoom,
        panX: fit.panX,
        panY: fit.panY
      });
    }
  };

  // Fit to image handler (shows entire custom basemap)
  const handleFitToImage = () => {
    const imgW = (basemap as any).imageWidth || dimensions.width;
    const imgH = (basemap as any).imageHeight || dimensions.height;
    const fit = calculateFitToImage(imgW, imgH, dimensions.width, dimensions.height);
    onCameraChange({
      ...camera,
      zoom: fit.zoom,
      panX: fit.panX,
      panY: fit.panY
    });
  };

  // Zoom handlers
  const handleZoom = (delta: number) => {
    const newZoom = Math.min(Math.max(0.3, camera.zoom + delta), 20);
    onCameraChange({ ...camera, zoom: newZoom });
  };

  const handleResetView = () => {
    onCameraChange({ zoom: 1, panX: 0, panY: 0 });
  };

  // Canvas panning interaction
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;

    // If in point picking mode for custom images
    if (pickingPlaceId && onPlacePicked) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;

        // Invert from screen camera coordinate back to map image space
        const mapX = (screenX - dimensions.width / 2 - camera.panX) / camera.zoom + dimensions.width / 2;
        const mapY = (screenY - dimensions.height / 2 - camera.panY) / camera.zoom + dimensions.height / 2;

        const imgW = (basemap as any).imageWidth || dimensions.width;
        const imgH = (basemap as any).imageHeight || dimensions.height;

        const normX = Math.min(Math.max(mapX / imgW, 0), 1);
        const normY = Math.min(Math.max(mapY / imgH, 0), 1);

        onPlacePicked(pickingPlaceId, Math.round(mapX), Math.round(mapY), normX, normY);
        return;
      }
    }

    setIsPanning(true);
    panStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialPanX: camera.panX,
      initialPanY: camera.panY
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isPanning || !panStartRef.current) return;
    const dx = e.clientX - panStartRef.current.startX;
    const dy = e.clientY - panStartRef.current.startY;
    onCameraChange({
      ...camera,
      panX: panStartRef.current.initialPanX + dx,
      panY: panStartRef.current.initialPanY + dy
    });
  };

  const handlePointerUp = () => {
    setIsPanning(false);
    panStartRef.current = null;
  };

  // Wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 0.87;
    const newZoom = Math.min(Math.max(0.3, camera.zoom * factor), 20);
    onCameraChange({ ...camera, zoom: newZoom });
  };

  const isCustomImage =
    basemap.type === 'free-image' ||
    basemap.type === 'equirectangular-image' ||
    basemap.type === 'calibrated-image';

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full bg-slate-100 overflow-hidden select-none ${
        pickingPlaceId ? 'cursor-crosshair' : 'cursor-default'
      }`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onWheel={handleWheel}
    >
      {/* Floating Canvas View Controls */}
      <div className="absolute bottom-5 right-5 flex items-center bg-white/95 backdrop-blur shadow-md rounded-lg border border-slate-200 p-1 space-x-1 z-20">
        <button
          onClick={handleFitToPoints}
          title="自动缩放适配全部地点"
          className="p-1.5 hover:bg-blue-50 rounded text-blue-600 hover:text-blue-700 transition flex items-center text-xs px-2 font-medium"
        >
          <Maximize2 size={13} className="mr-1" />
          适配全部地点
        </button>
        {isCustomImage && (
          <button
            onClick={handleFitToImage}
            title="缩放以完整显示底图图片"
            className="p-1.5 hover:bg-purple-50 rounded text-purple-600 hover:text-purple-700 transition flex items-center text-xs px-2 font-medium"
          >
            <ImageIcon size={13} className="mr-1" />
            适应整图
          </button>
        )}
        <div className="w-[1px] h-4 bg-slate-200 my-auto" />
        <button
          onClick={() => handleZoom(0.3)}
          title="放大画布"
          className="p-1.5 hover:bg-slate-100 rounded text-slate-700 transition"
        >
          <ZoomIn size={16} />
        </button>
        <button
          onClick={() => handleZoom(-0.3)}
          title="缩小画布"
          className="p-1.5 hover:bg-slate-100 rounded text-slate-700 transition"
        >
          <ZoomOut size={16} />
        </button>
        <div className="w-[1px] h-4 bg-slate-200 my-auto" />
        <button
          onClick={handleResetView}
          title="重置缩放与平移"
          className="p-1.5 hover:bg-slate-100 rounded text-slate-700 transition flex items-center text-xs px-1.5"
        >
          <RotateCcw size={13} className="mr-1" />
          重置
        </button>
        <span className="text-[11px] text-slate-400 px-1 font-mono min-w-[38px] text-right">
          {Math.round(camera.zoom * 100)}%
        </span>
      </div>

      {/* Picking Point Hint Banner */}
      {pickingPlaceId && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-amber-500 text-white text-xs px-4 py-2 rounded-full shadow-lg flex items-center space-x-2 z-30 animate-pulse">
          <Crosshair size={16} />
          <span>请在底图上点击，指定此地点的精确位置</span>
        </div>
      )}

      {/* Main SVG Container */}
      <svg
        id="travel-map-svg"
        width={dimensions.width}
        height={dimensions.height}
        viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
        className="w-full h-full block"
      >
        <defs>
          <style>{`
            text { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif; }
          `}</style>
        </defs>

        {/* Ocean Background (Builtin map only) */}
        {!isCustomImage && (
          <rect
            id="ocean-background"
            x={0}
            y={0}
            width={dimensions.width}
            height={dimensions.height}
            fill={(basemap as BuiltinBasemap).oceanColor || '#ffffff'}
          />
        )}

        {/* LAYER GROUP 1: Map Camera Layer (Basemap & Route Geometry scale with camera) */}
        <g
          id="map-camera-layer"
          transform={`translate(${dimensions.width / 2 + camera.panX}, ${dimensions.height / 2 + camera.panY}) scale(${camera.zoom}) translate(${-dimensions.width / 2}, ${-dimensions.height / 2})`}
        >
          {/* Basemap Layer */}
          <g id="basemap-layer">
            {isCustomImage && (basemap as any).imageUrl ? (
              <image
                href={(basemap as any).imageUrl}
                x={0}
                y={0}
                width={(basemap as any).imageWidth || dimensions.width}
                height={(basemap as any).imageHeight || dimensions.height}
                preserveAspectRatio="xMidYMid meet"
              />
            ) : (
              <g id="builtin-vector-layer">
                {/* Admin-0 Countries */}
                <g id="countries-layer">
                  {geoFeatures.map((feature, index) => {
                    const pathStr = pathGenerator(feature);
                    if (!pathStr) return null;
                    const fill = colorForCountry(
                      feature,
                      (basemap as BuiltinBasemap).landColor,
                      (basemap as BuiltinBasemap).enableColorByCountry ?? true
                    );
                    return (
                      <path
                        key={`country-${index}`}
                        d={pathStr}
                        fill={fill}
                        stroke={(basemap as BuiltinBasemap).borderColor || '#cbd5e1'}
                        strokeWidth={0.5}
                      />
                    );
                  })}
                </g>

                {/* Admin-1 State/Province Boundaries for Continent View */}
                {admin1Features.length > 0 && (basemap as BuiltinBasemap).showAdmin1 !== false && (
                  <g id="admin-1-layer">
                    {admin1Features.map((feature, index) => {
                      const pathStr = pathGenerator(feature);
                      if (!pathStr) return null;
                      return (
                        <path
                          key={`admin1-${index}`}
                          d={pathStr}
                          fill="none"
                          stroke="#cbd5e1"
                          strokeWidth={0.45}
                          strokeOpacity={0.55}
                        />
                      );
                    })}
                  </g>
                )}
              </g>
            )}
          </g>

          {/* Route Geometry Layer */}
          <RouteLayer
            places={places}
            transformer={transformer}
            style={routeStyle}
            canvasWidth={dimensions.width}
            cameraZoom={camera.zoom}
          />
        </g>

        {/* LAYER GROUP 2: Overlay Layer (Markers & Labels stay fixed screen size) */}
        <g id="overlay-layer">
          <MarkerLayer
            places={places}
            transformer={transformer}
            style={markerStyle}
            camera={camera}
            canvasWidth={dimensions.width}
            canvasHeight={dimensions.height}
            scaleMode={overlayScaleMode}
            onDragStart={onDragStart}
            onDragMove={onMarkerDragMove}
            onDragEnd={onMarkerDragEnd}
          />

          <LabelLayer
            places={places}
            transformer={transformer}
            style={labelStyle}
            camera={camera}
            canvasWidth={dimensions.width}
            canvasHeight={dimensions.height}
            scaleMode={overlayScaleMode}
            onDragStart={onDragStart}
            onDragMove={onLabelDragMove}
            onDragEnd={onLabelDragEnd}
          />
        </g>
      </svg>
    </div>
  );
};