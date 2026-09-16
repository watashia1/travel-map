import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import * as d3 from 'd3-geo';
import {
  Place,
  PolarBasemap,
  RouteStyle,
  MarkerStyle,
  LabelStyle,
  CameraState,
} from '../types';
import { ProjectedPlace } from '../overlay/types';
import { MarkerOverlay } from '../overlay/MarkerOverlay';
import { LabelOverlay } from '../overlay/LabelOverlay';
import { RouteOverlay } from '../overlay/RouteOverlay';
import { Maximize2, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface PolarMapViewProps {
  places: Place[];
  basemap: PolarBasemap;
  routeStyle: RouteStyle;
  markerStyle: MarkerStyle;
  labelStyle: LabelStyle;
  camera?: CameraState;
  onCameraChange?: (camera: CameraState) => void;
  onLabelDragStart?: () => void;
  onLabelDragMove?: (placeId: string, offsetX: number, offsetY: number) => void;
  onLabelDragEnd?: (placeId: string, offsetX: number, offsetY: number) => void;
}

import { fetchGeoJSON } from '../utils/assets';

export const PolarMapView: React.FC<PolarMapViewProps> = ({
  places,
  basemap,
  routeStyle,
  markerStyle,
  labelStyle,
  camera = { zoom: 1, panX: 0, panY: 0 },
  onCameraChange,
  onLabelDragStart,
  onLabelDragMove,
  onLabelDragEnd,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 1000, height: 600 });
  const [geoFeatures, setGeoFeatures] = useState<any[]>([]);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ startX: number; startY: number; initialPanX: number; initialPanY: number } | null>(null);

  // Resize observer
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

  // Load geojson
  useEffect(() => {
    let isMounted = true;
    fetchGeoJSON('data/ne_110m_admin_0_countries.geojson')
      .then((geojson) => {
        if (isMounted) {
          setGeoFeatures(geojson.features || []);
        }
      })
      .catch((err) => console.error('Failed to load countries geojson for polar map:', err));

    return () => {
      isMounted = false;
    };
  }, []);

  // Polar Projection & Path Generator
  const { projection, pathGenerator } = useMemo(() => {
    const isNorth = basemap.pole === 'north';
    const proj = isNorth
      ? d3.geoAzimuthalEquidistant().rotate([0, -90])
      : d3.geoStereographic().rotate([0, 90]);

    proj.clipAngle(179.9);
    proj.translate([dimensions.width / 2, dimensions.height / 2]);

    // Set appropriate base scale for polar coverage
    const baseScale = Math.min(dimensions.width, dimensions.height) * (isNorth ? 0.38 : 0.45);
    proj.scale(baseScale);

    const pathGen = d3.geoPath().projection(proj);
    return { projection: proj, pathGenerator: pathGen };
  }, [basemap.pole, dimensions]);

  // Project coordinate to screen
  const projectCoordinate = useCallback(
    (lon: number, lat: number) => {
      const pt = projection([lon, lat]);
      if (!pt) return null;
      const x = (pt[0] - dimensions.width / 2) * camera.zoom + dimensions.width / 2 + camera.panX;
      const y = (pt[1] - dimensions.height / 2) * camera.zoom + dimensions.height / 2 + camera.panY;
      return { x, y };
    },
    [projection, dimensions, camera]
  );

  // Projected places for Marker and Label overlays
  const projectedPlaces: ProjectedPlace[] = useMemo(() => {
    return places
      .filter((p) => p.status === 'resolved' || p.geoStatus === 'resolved')
      .map((p) => {
        const pt = projectCoordinate(p.lon, p.lat);
        return {
          place: p,
          screenX: pt ? pt.x : -9999,
          screenY: pt ? pt.y : -9999,
          visible: pt !== null,
        };
      });
  }, [places, projectCoordinate]);

  // Panning interactions
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    setIsPanning(true);
    panStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialPanX: camera.panX,
      initialPanY: camera.panY,
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isPanning || !panStartRef.current || !onCameraChange) return;
    const dx = e.clientX - panStartRef.current.startX;
    const dy = e.clientY - panStartRef.current.startY;
    onCameraChange({
      ...camera,
      panX: panStartRef.current.initialPanX + dx,
      panY: panStartRef.current.initialPanY + dy,
    });
  };

  const handlePointerUp = () => {
    setIsPanning(false);
    panStartRef.current = null;
  };

  // Wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (!onCameraChange) return;
    const factor = e.deltaY < 0 ? 1.15 : 0.87;
    const newZoom = Math.min(Math.max(0.3, camera.zoom * factor), 20);
    onCameraChange({ ...camera, zoom: newZoom });
  };

  // Fit to places
  const handleFitAll = () => {
    const valid = places.filter((p) => p.status === 'resolved' || p.geoStatus === 'resolved');
    if (valid.length === 0 || !onCameraChange) return;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    valid.forEach((p) => {
      const pt = projection([p.lon, p.lat]);
      if (pt) {
        if (pt[0] < minX) minX = pt[0];
        if (pt[0] > maxX) maxX = pt[0];
        if (pt[1] < minY) minY = pt[1];
        if (pt[1] > maxY) maxY = pt[1];
      }
    });

    if (minX !== Infinity) {
      const w = Math.max(maxX - minX, 60);
      const h = Math.max(maxY - minY, 60);
      const pad = 80;
      const zoomX = (dimensions.width - pad * 2) / w;
      const zoomY = (dimensions.height - pad * 2) / h;
      const fitZoom = Math.min(Math.max(Math.min(zoomX, zoomY), 0.5), 10);
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      const panX = (dimensions.width / 2 - centerX) * fitZoom;
      const panY = (dimensions.height / 2 - centerY) * fitZoom;

      onCameraChange({ zoom: fitZoom, panX, panY });
    }
  };

  return (
    <div
      ref={containerRef}
      id="polar-map-root"
      className="relative w-full h-full bg-slate-100 overflow-hidden select-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onWheel={handleWheel}
    >
      <svg
        id="travel-map-svg"
        className="w-full h-full block"
        viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
        width={dimensions.width}
        height={dimensions.height}
      >
        <defs>
          <style>{`
            text { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif; }
          `}</style>
        </defs>

        {/* Ocean Background */}
        <rect
          x={0}
          y={0}
          width={dimensions.width}
          height={dimensions.height}
          fill={basemap.oceanColor || '#e8f0f8'}
        />

        {/* Scaled & panned basemap container */}
        <g
          transform={`translate(${dimensions.width / 2 + camera.panX}, ${dimensions.height / 2 + camera.panY}) scale(${camera.zoom}) translate(${-dimensions.width / 2}, ${-dimensions.height / 2})`}
        >
          {/* Countries Polygons */}
          <g id="polar-countries">
            {geoFeatures.map((feature, idx) => {
              const d = pathGenerator(feature);
              if (!d) return null;
              return (
                <path
                  key={`polar-land-${idx}`}
                  d={d}
                  fill={basemap.landColor || '#f8fafc'}
                  stroke={basemap.borderColor || '#cbd5e1'}
                  strokeWidth={0.6}
                />
              );
            })}
          </g>
        </g>

        {/* SVG Route Overlay */}
        <RouteOverlay
          places={places}
          projectPlace={(place) => projectCoordinate(place.lon, place.lat)}
          projectGeo={projectCoordinate}
          supportsGeodesic={true}
          style={routeStyle}
          canvasWidth={dimensions.width}
        />

        {/* SVG Marker Overlay */}
        <MarkerOverlay
          projectedPlaces={projectedPlaces}
          style={markerStyle}
          canDrag={false}
        />

        {/* SVG Label Overlay */}
        <LabelOverlay
          projectedPlaces={projectedPlaces}
          style={labelStyle}
          onDragStart={onLabelDragStart}
          onDragMove={onLabelDragMove}
          onDragEnd={onLabelDragEnd}
        />
      </svg>

      {/* Floating Canvas Controls */}
      <div className="absolute bottom-5 right-5 flex items-center bg-white/95 backdrop-blur shadow-md rounded-lg border border-slate-200 p-1 space-x-1 z-20">
        <button
          onClick={handleFitAll}
          title="自动缩放适配全部地点"
          className="p-1.5 hover:bg-blue-50 rounded text-blue-600 hover:text-blue-700 transition flex items-center text-xs px-2 font-medium"
        >
          <Maximize2 size={13} className="mr-1" />
          适配全部地点
        </button>

        <div className="w-[1px] h-4 bg-slate-200 my-auto" />

        <button
          onClick={() => onCameraChange?.({ ...camera, zoom: Math.min(camera.zoom + 0.3, 20) })}
          title="放大"
          className="p-1.5 hover:bg-slate-100 rounded text-slate-700 transition"
        >
          <ZoomIn size={16} />
        </button>

        <button
          onClick={() => onCameraChange?.({ ...camera, zoom: Math.max(camera.zoom - 0.3, 0.3) })}
          title="缩小"
          className="p-1.5 hover:bg-slate-100 rounded text-slate-700 transition"
        >
          <ZoomOut size={16} />
        </button>

        <div className="w-[1px] h-4 bg-slate-200 my-auto" />

        <button
          onClick={() => onCameraChange?.({ zoom: 1, panX: 0, panY: 0 })}
          title="重置"
          className="p-1.5 hover:bg-slate-100 rounded text-slate-700 transition flex items-center text-xs px-1.5"
        >
          <RotateCcw size={13} className="mr-1" />
          重置
        </button>

        <span className="text-[11px] text-slate-400 px-1 font-mono min-w-[38px] text-right">
          {Math.round(camera.zoom * 100)}%
        </span>
      </div>
    </div>
  );
};
