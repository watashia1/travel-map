import React, { useEffect, useState, useRef, useMemo } from 'react';
import * as topojson from 'topojson-client';
import { Place, RouteStyle, MarkerStyle, LabelStyle, MapConfig } from '../types';
import { createMapProjection } from './projections';
import { RouteLayer } from './RouteLayer';
import { MarkerLayer } from './MarkerLayer';
import { LabelLayer } from './LabelLayer';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface MapCanvasProps {
  places: Place[];
  routeStyle: RouteStyle;
  markerStyle: MarkerStyle;
  labelStyle: LabelStyle;
  mapConfig: MapConfig;
  onUpdatePlaceOffset: (placeId: string, x: number, y: number) => void;
  onUpdateLabelOffset: (placeId: string, x: number, y: number) => void;
}

export const MapCanvas: React.FC<MapCanvasProps> = ({
  places,
  routeStyle,
  markerStyle,
  labelStyle,
  mapConfig,
  onUpdatePlaceOffset,
  onUpdateLabelOffset
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 1000, height: 600 });
  const [geoFeatures, setGeoFeatures] = useState<any[]>([]);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ startX: number; startY: number; initialPanX: number; initialPanY: number } | null>(null);

  // Load world topojson data
  useEffect(() => {
    fetch('./data/world.json')
      .then(res => res.json())
      .then(topology => {
        // Extract countries or land
        if (topology.objects && topology.objects.countries) {
          const countries = (topojson.feature(topology, topology.objects.countries) as any).features;
          setGeoFeatures(countries || []);
        } else if (topology.objects && topology.objects.land) {
          const land = (topojson.feature(topology, topology.objects.land) as any).features;
          setGeoFeatures(land || []);
        }
      })
      .catch(err => {
        console.error('Failed to load world.json', err);
      });
  }, []);

  // Track container dimension changes
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
    return createMapProjection(mapConfig, dimensions.width, dimensions.height);
  }, [mapConfig, dimensions]);

  // Pan interaction on background canvas
  const handleBackgroundPointerDown = (e: React.PointerEvent) => {
    // Only pan if left click on background
    if (e.button !== 0) return;
    setIsPanning(true);
    panStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialPanX: panOffset.x,
      initialPanY: panOffset.y
    };
  };

  const handleBackgroundPointerMove = (e: React.PointerEvent) => {
    if (!isPanning || !panStartRef.current) return;
    const dx = e.clientX - panStartRef.current.startX;
    const dy = e.clientY - panStartRef.current.startY;
    setPanOffset({
      x: panStartRef.current.initialPanX + dx,
      y: panStartRef.current.initialPanY + dy
    });
  };

  const handleBackgroundPointerUp = () => {
    setIsPanning(false);
    panStartRef.current = null;
  };

  const handleZoom = (delta: number) => {
    setZoomLevel(prev => Math.min(Math.max(0.5, prev + delta), 4));
  };

  const handleResetView = () => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-slate-100 overflow-hidden select-none cursor-default"
      onPointerDown={handleBackgroundPointerDown}
      onPointerMove={handleBackgroundPointerMove}
      onPointerUp={handleBackgroundPointerUp}
    >
      {/* Floating Canvas View Controls */}
      <div className="absolute bottom-5 right-5 flex items-center bg-white/90 backdrop-blur shadow-md rounded-lg border border-slate-200 p-1 space-x-1 z-10">
        <button
          onClick={() => handleZoom(0.2)}
          title="放大画布"
          className="p-1.5 hover:bg-slate-100 rounded text-slate-700 transition"
        >
          <ZoomIn size={18} />
        </button>
        <button
          onClick={() => handleZoom(-0.2)}
          title="缩小画布"
          className="p-1.5 hover:bg-slate-100 rounded text-slate-700 transition"
        >
          <ZoomOut size={18} />
        </button>
        <div className="w-[1px] h-4 bg-slate-200 my-auto" />
        <button
          onClick={handleResetView}
          title="重置视图"
          className="p-1.5 hover:bg-slate-100 rounded text-slate-700 transition flex items-center text-xs px-2"
        >
          <RotateCcw size={14} className="mr-1" />
          重置
        </button>
        <span className="text-xs text-slate-400 px-1 font-mono">{Math.round(zoomLevel * 100)}%</span>
      </div>

      {/* Main Vector SVG */}
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

        {/* Ocean Background */}
        <rect
          id="ocean-background"
          x={0}
          y={0}
          width={dimensions.width}
          height={dimensions.height}
          fill={mapConfig.oceanColor}
        />

        {/* Transformed Map Layer */}
        <g
          id="map-transform-group"
          transform={`translate(${dimensions.width / 2 + panOffset.x}, ${dimensions.height / 2 + panOffset.y}) scale(${zoomLevel}) translate(${-dimensions.width / 2}, ${-dimensions.height / 2})`}
        >
          {/* Countries / Continents Layer */}
          <g id="countries-layer" className="transition-colors duration-200">
            {geoFeatures.map((feature, index) => {
              const pathStr = pathGenerator(feature);
              if (!pathStr) return null;
              return (
                <path
                  key={`country-${index}`}
                  d={pathStr}
                  fill={mapConfig.landColor}
                  stroke={mapConfig.borderColor}
                  strokeWidth={0.5}
                />
              );
            })}
          </g>

          {/* Connected Routes Layer */}
          <RouteLayer
            places={places}
            projection={projection}
            style={routeStyle}
          />

          {/* Place Markers Layer */}
          <MarkerLayer
            places={places}
            projection={projection}
            style={markerStyle}
            onUpdatePlaceOffset={onUpdatePlaceOffset}
          />

          {/* Place Labels Layer */}
          <LabelLayer
            places={places}
            projection={projection}
            style={labelStyle}
            onUpdateLabelOffset={onUpdateLabelOffset}
          />
        </g>
      </svg>
    </div>
  );
};