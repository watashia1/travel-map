import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Place,
  FreeImageBasemap,
  EquirectangularImageBasemap,
  CalibratedImageBasemap,
  RouteStyle,
  MarkerStyle,
  LabelStyle,
  ImageViewState,
} from '../types';
import {
  createCoordinateTransformer,
  CoordinateTransformer,
} from '../map/transformer';
import { getPlaceImageAnchor } from './anchor';
import { ProjectedPlace } from '../overlay/types';
import { MarkerOverlay } from '../overlay/MarkerOverlay';
import { LabelOverlay } from '../overlay/LabelOverlay';
import { RouteOverlay } from '../overlay/RouteOverlay';
import { calculateFitToPoints, calculateFitToImage } from '../map/projections';
import { ZoomIn, ZoomOut, RotateCcw, Maximize2, Image as ImageIcon, Crosshair } from 'lucide-react';

type ImageBasemapConfig = FreeImageBasemap | EquirectangularImageBasemap | CalibratedImageBasemap;

interface ImageMapViewProps {
  places: Place[];
  basemap: ImageBasemapConfig;
  routeStyle: RouteStyle;
  markerStyle: MarkerStyle;
  labelStyle: LabelStyle;
  viewState?: ImageViewState;
  pickingPlaceId?: string | null;
  onPlacePicked?: (placeId: string, imgX: number, imgY: number, normX: number, normY: number) => void;
  onViewStateChange?: (viewState: ImageViewState) => void;
  onMarkerDragMove?: (placeId: string, mapOffsetX: number, mapOffsetY: number) => void;
  onMarkerDragEnd?: (placeId: string, mapOffsetX: number, mapOffsetY: number) => void;
  onLabelDragStart?: () => void;
  onLabelDragMove?: (placeId: string, offsetX: number, offsetY: number) => void;
  onLabelDragEnd?: (placeId: string, offsetX: number, offsetY: number) => void;
}

export const ImageMapView: React.FC<ImageMapViewProps> = ({
  places,
  basemap,
  routeStyle,
  markerStyle,
  labelStyle,
  viewState = { zoom: 1, panX: 0, panY: 0 },
  pickingPlaceId,
  onPlacePicked,
  onViewStateChange,
  onMarkerDragMove,
  onMarkerDragEnd,
  onLabelDragStart,
  onLabelDragMove,
  onLabelDragEnd,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 1000, height: 600 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ startX: number; startY: number; initialPanX: number; initialPanY: number } | null>(null);

  const imgW = basemap.imageWidth || dimensions.width;
  const imgH = basemap.imageHeight || dimensions.height;

  // Track container dimensions
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

  // Image Transformer
  const transformer: CoordinateTransformer = useMemo(() => {
    return createCoordinateTransformer(basemap, null as any, dimensions.width, dimensions.height);
  }, [basemap, dimensions]);

  // Project place to screen coordinate
  const projectCoordinate = useCallback(
    (lon: number, lat: number, place?: Place) => {
      let mapPt: [number, number] | null = null;
      if (place) {
        mapPt = getPlaceImageAnchor(place, transformer);
      } else {
        mapPt = transformer.project(lon, lat);
      }
      if (!mapPt) return null;

      const screenX = (mapPt[0] - dimensions.width / 2) * viewState.zoom + dimensions.width / 2 + viewState.panX;
      const screenY = (mapPt[1] - dimensions.height / 2) * viewState.zoom + dimensions.height / 2 + viewState.panY;
      return { x: screenX, y: screenY };
    },
    [transformer, dimensions, viewState]
  );

  // Projected Places for Overlay
  const projectedPlaces: ProjectedPlace[] = useMemo(() => {
    return places
      .filter((p) => p.status === 'resolved' || p.visualStatus === 'placed')
      .map((p) => {
        const pt = projectCoordinate(p.lon, p.lat, p);
        return {
          place: p,
          screenX: pt ? pt.x : -9999,
          screenY: pt ? pt.y : -9999,
          visible: pt !== null,
        };
      });
  }, [places, projectCoordinate]);

  // Pointer Down for Pan / Pick
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;

    // In point picking mode
    if (pickingPlaceId && onPlacePicked) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;

        // Invert screen coordinate to image coordinate
        const mapX = (screenX - dimensions.width / 2 - viewState.panX) / viewState.zoom + dimensions.width / 2;
        const mapY = (screenY - dimensions.height / 2 - viewState.panY) / viewState.zoom + dimensions.height / 2;

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
      initialPanX: viewState.panX,
      initialPanY: viewState.panY,
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isPanning || !panStartRef.current || !onViewStateChange) return;
    const dx = e.clientX - panStartRef.current.startX;
    const dy = e.clientY - panStartRef.current.startY;
    onViewStateChange({
      ...viewState,
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
    if (!onViewStateChange) return;
    const factor = e.deltaY < 0 ? 1.15 : 0.87;
    const newZoom = Math.min(Math.max(0.2, viewState.zoom * factor), 20);
    onViewStateChange({ ...viewState, zoom: newZoom });
  };

  // Fit to places
  const handleFitToPoints = () => {
    if (!onViewStateChange) return;
    const fit = calculateFitToPoints(
      places,
      dimensions.width,
      dimensions.height,
      (_lon, _lat, p) => getPlaceImageAnchor(p, transformer)
    );
    if (fit) {
      onViewStateChange({
        zoom: fit.zoom,
        panX: fit.panX,
        panY: fit.panY,
      });
    }
  };

  // Fit to whole image
  const handleFitToImage = () => {
    if (!onViewStateChange) return;
    const fit = calculateFitToImage(imgW, imgH, dimensions.width, dimensions.height);
    onViewStateChange({
      zoom: fit.zoom,
      panX: fit.panX,
      panY: fit.panY,
    });
  };

  // Marker drag handlers in Image map space
  const handleMarkerDragMove = (placeId: string, screenDx: number, screenDy: number) => {
    if (!onMarkerDragMove) return;
    const mapDx = screenDx / Math.max(viewState.zoom, 0.01);
    const mapDy = screenDy / Math.max(viewState.zoom, 0.01);
    onMarkerDragMove(placeId, parseFloat(mapDx.toFixed(2)), parseFloat(mapDy.toFixed(2)));
  };

  const handleMarkerDragEnd = (placeId: string, screenDx: number, screenDy: number) => {
    if (!onMarkerDragEnd) return;
    const mapDx = screenDx / Math.max(viewState.zoom, 0.01);
    const mapDy = screenDy / Math.max(viewState.zoom, 0.01);
    onMarkerDragEnd(placeId, parseFloat(mapDx.toFixed(2)), parseFloat(mapDy.toFixed(2)));
  };

  return (
    <div
      ref={containerRef}
      id="image-map-root"
      className={`relative w-full h-full bg-slate-100 overflow-hidden select-none ${
        pickingPlaceId ? 'cursor-crosshair' : 'cursor-default'
      }`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onWheel={handleWheel}
    >
      {/* Picking Point Hint Banner */}
      {pickingPlaceId && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-amber-500 text-white text-xs px-4 py-2 rounded-full shadow-lg flex items-center space-x-2 z-30 animate-pulse">
          <Crosshair size={16} />
          <span>请在底图上点击，指定此地点的精确位置</span>
        </div>
      )}

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

        {/* Scaled and Panned Map Image */}
        <g
          transform={`translate(${dimensions.width / 2 + viewState.panX}, ${dimensions.height / 2 + viewState.panY}) scale(${viewState.zoom}) translate(${-dimensions.width / 2}, ${-dimensions.height / 2})`}
        >
          {basemap.imageUrl && (
            <image
              href={basemap.imageUrl}
              x={0}
              y={0}
              width={imgW}
              height={imgH}
              preserveAspectRatio="xMidYMid meet"
            />
          )}
        </g>

        {/* SVG Route Overlay */}
        <RouteOverlay
          places={places}
          projectCoordinate={(lon, lat) => projectCoordinate(lon, lat)}
          style={routeStyle}
          canvasWidth={dimensions.width}
        />

        {/* SVG Marker Overlay (Draggable in Image Mode) */}
        <MarkerOverlay
          projectedPlaces={projectedPlaces}
          style={markerStyle}
          canDrag={true}
          onDragMove={handleMarkerDragMove}
          onDragEnd={handleMarkerDragEnd}
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

        <button
          onClick={handleFitToImage}
          title="缩放以完整显示底图图片"
          className="p-1.5 hover:bg-purple-50 rounded text-purple-600 hover:text-purple-700 transition flex items-center text-xs px-2 font-medium"
        >
          <ImageIcon size={13} className="mr-1" />
          适应整图
        </button>

        <div className="w-[1px] h-4 bg-slate-200 my-auto" />

        <button
          onClick={() => onViewStateChange?.({ ...viewState, zoom: Math.min(viewState.zoom + 0.3, 20) })}
          title="放大"
          className="p-1.5 hover:bg-slate-100 rounded text-slate-700 transition"
        >
          <ZoomIn size={16} />
        </button>

        <button
          onClick={() => onViewStateChange?.({ ...viewState, zoom: Math.max(viewState.zoom - 0.3, 0.2) })}
          title="缩小"
          className="p-1.5 hover:bg-slate-100 rounded text-slate-700 transition"
        >
          <ZoomOut size={16} />
        </button>

        <div className="w-[1px] h-4 bg-slate-200 my-auto" />

        <button
          onClick={() => onViewStateChange?.({ zoom: 1, panX: 0, panY: 0 })}
          title="重置"
          className="p-1.5 hover:bg-slate-100 rounded text-slate-700 transition flex items-center text-xs px-1.5"
        >
          <RotateCcw size={13} className="mr-1" />
          重置
        </button>

        <span className="text-[11px] text-slate-400 px-1 font-mono min-w-[38px] text-right">
          {Math.round(viewState.zoom * 100)}%
        </span>
      </div>
    </div>
  );
};
