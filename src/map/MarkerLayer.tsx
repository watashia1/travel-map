import React, { useState, useRef } from 'react';
import { Place, MarkerStyle, CameraState, OverlayScaleMode } from '../types';
import { CoordinateTransformer, getPlaceMapAnchor } from './transformer';

interface MarkerLayerProps {
  places: Place[];
  transformer: CoordinateTransformer;
  style: MarkerStyle;
  camera: CameraState;
  canvasWidth: number;
  canvasHeight: number;
  scaleMode?: OverlayScaleMode;
  onDragStart: () => void;
  onDragMove: (placeId: string, mapOffsetX: number, mapOffsetY: number) => void;
  onDragEnd: (placeId: string, mapOffsetX: number, mapOffsetY: number) => void;
}

export const MarkerLayer: React.FC<MarkerLayerProps> = ({
  places,
  transformer,
  style,
  camera,
  canvasWidth,
  canvasHeight,
  scaleMode = 'screen-fixed',
  onDragStart,
  onDragMove,
  onDragEnd
}) => {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragStartRef = useRef<{
    startX: number;
    startY: number;
    initialOffsetX: number;
    initialOffsetY: number;
    lastX: number;
    lastY: number;
  } | null>(null);

  const validPlaces = places.filter(p => p.status === 'resolved' && !p.hideMarker);

  const handlePointerDown = (e: React.PointerEvent, place: Place) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);

    onDragStart();
    setDraggingId(place.id);
    const initOffX = place.markerMapOffsetX ?? place.manualOffsetX ?? 0;
    const initOffY = place.markerMapOffsetY ?? place.manualOffsetY ?? 0;
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialOffsetX: initOffX,
      initialOffsetY: initOffY,
      lastX: initOffX,
      lastY: initOffY
    };
  };

  const handlePointerMove = (e: React.PointerEvent, placeId: string) => {
    if (draggingId !== placeId || !dragStartRef.current) return;
    const zoom = Math.max(camera.zoom, 0.001);
    const dxMap = (e.clientX - dragStartRef.current.startX) / zoom;
    const dyMap = (e.clientY - dragStartRef.current.startY) / zoom;

    const newX = parseFloat((dragStartRef.current.initialOffsetX + dxMap).toFixed(2));
    const newY = parseFloat((dragStartRef.current.initialOffsetY + dyMap).toFixed(2));
    dragStartRef.current.lastX = newX;
    dragStartRef.current.lastY = newY;

    onDragMove(placeId, newX, newY);
  };

  const handlePointerUp = (e: React.PointerEvent, placeId: string) => {
    if (draggingId) {
      try {
        (e.target as Element).releasePointerCapture(e.pointerId);
      } catch {}

      if (dragStartRef.current) {
        onDragEnd(placeId, dragStartRef.current.lastX, dragStartRef.current.lastY);
      }
      setDraggingId(null);
      dragStartRef.current = null;
    }
  };

  const { zoom, panX, panY } = camera;

  return (
    <g id="markers-layer">
      {validPlaces.map((place, idx) => {
        const anchor = getPlaceMapAnchor(place, transformer);
        if (!anchor) return null;

        // Apply camera transformation to map anchor to get screen position (zero drift!)
        const screenX = (anchor[0] - canvasWidth / 2) * zoom + canvasWidth / 2 + panX;
        const screenY = (anchor[1] - canvasHeight / 2) * zoom + canvasHeight / 2 + panY;

        const r = style.size;
        const isDragging = draggingId === place.id;
        const orderNum = place.order !== undefined ? place.order + 1 : idx + 1;

        return (
          <g
            key={`marker-${place.id}`}
            transform={`translate(${screenX.toFixed(2)}, ${screenY.toFixed(2)})`}
            className="cursor-grab active:cursor-grabbing select-none"
            onPointerDown={e => handlePointerDown(e, place)}
            onPointerMove={e => handlePointerMove(e, place.id)}
            onPointerUp={e => handlePointerUp(e, place.id)}
            onPointerCancel={e => handlePointerUp(e, place.id)}
          >
            {/* Expanded hit target */}
            <circle r={Math.max(r + 8, 14)} fill="transparent" />

            {style.type === 'ring' && (
              <circle
                r={r + 3}
                fill="none"
                stroke={style.color}
                strokeWidth={1.5}
                strokeOpacity={0.6}
              />
            )}

            <circle
              r={r}
              fill={style.color}
              stroke={style.strokeColor}
              strokeWidth={style.strokeWidth}
              className={isDragging ? 'filter drop-shadow-md' : ''}
            />

            {style.type === 'numbered' ? (
              <text
                textAnchor="middle"
                dominantBaseline="central"
                fill="#ffffff"
                fontSize={Math.max(9, r * 1.1)}
                fontWeight="bold"
                pointerEvents="none"
              >
                {orderNum}
              </text>
            ) : style.type === 'ring' ? (
              <circle r={Math.max(2, r * 0.35)} fill="#ffffff" pointerEvents="none" />
            ) : null}

            <title>
              {place.displayName}
              {place.manualOffsetX || place.manualOffsetY ? ` (微调: dx=${place.manualOffsetX}, dy=${place.manualOffsetY})` : ''}
            </title>
          </g>
        );
      })}
    </g>
  );
};