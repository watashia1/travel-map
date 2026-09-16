import React, { useState, useRef } from 'react';
import { Place, MarkerStyle } from '../types';
import { ProjectedPlace } from './types';

interface MarkerOverlayProps {
  projectedPlaces: ProjectedPlace[];
  style: MarkerStyle;
  canDrag?: boolean;
  onDragStart?: () => void;
  onDragMove?: (placeId: string, dx: number, dy: number) => void;
  onDragEnd?: (placeId: string, dx: number, dy: number) => void;
  onMarkerClick?: (place: Place) => void;
}

export const MarkerOverlay: React.FC<MarkerOverlayProps> = ({
  projectedPlaces,
  style,
  canDrag = false,
  onDragStart,
  onDragMove,
  onDragEnd,
  onMarkerClick,
}) => {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragStartRef = useRef<{
    startX: number;
    startY: number;
    lastDx: number;
    lastDy: number;
  } | null>(null);

  const validPlaces = projectedPlaces.filter(
    (item) =>
      (item.place.status === 'resolved' ||
        item.place.geoStatus === 'resolved' ||
        item.place.visualStatus === 'placed' ||
        !!item.place.visualPosition) &&
      !item.place.hideMarker &&
      item.visible !== false
  );

  const handlePointerDown = (e: React.PointerEvent, place: Place) => {
    if (!canDrag) {
      if (onMarkerClick) onMarkerClick(place);
      return;
    }

    e.stopPropagation();
    try {
      (e.target as Element).setPointerCapture(e.pointerId);
    } catch {}

    onDragStart?.();
    setDraggingId(place.id);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      lastDx: 0,
      lastDy: 0,
    };
  };

  const handlePointerMove = (e: React.PointerEvent, placeId: string) => {
    if (draggingId !== placeId || !dragStartRef.current || !canDrag) return;
    const dx = e.clientX - dragStartRef.current.startX;
    const dy = e.clientY - dragStartRef.current.startY;
    dragStartRef.current.lastDx = dx;
    dragStartRef.current.lastDy = dy;
    onDragMove?.(placeId, dx, dy);
  };

  const handlePointerUp = (e: React.PointerEvent, placeId: string) => {
    if (draggingId) {
      try {
        (e.target as Element).releasePointerCapture(e.pointerId);
      } catch {}

      if (dragStartRef.current) {
        onDragEnd?.(placeId, dragStartRef.current.lastDx, dragStartRef.current.lastDy);
      }
      setDraggingId(null);
      dragStartRef.current = null;
    }
  };

  return (
    <g id="markers-layer" className="markers-overlay">
      {validPlaces.map((item, idx) => {
        const { place, screenX, screenY } = item;
        const r = style.size;
        const isDragging = draggingId === place.id;
        const orderNum = place.order !== undefined ? place.order + 1 : idx + 1;

        return (
          <g
            key={`marker-${place.id}`}
            transform={`translate(${screenX.toFixed(2)}, ${screenY.toFixed(2)})`}
            className={canDrag ? 'cursor-grab active:cursor-grabbing select-none' : 'cursor-pointer select-none'}
            onPointerDown={(e) => handlePointerDown(e, place)}
            onPointerMove={(e) => handlePointerMove(e, place.id)}
            onPointerUp={(e) => handlePointerUp(e, place.id)}
            onPointerCancel={(e) => handlePointerUp(e, place.id)}
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
              className={isDragging ? 'filter drop-shadow-md' : 'filter drop-shadow-sm'}
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

            <title>{place.displayName}</title>
          </g>
        );
      })}
    </g>
  );
};
