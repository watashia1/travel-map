import React, { useState, useRef } from 'react';
import * as d3 from 'd3-geo';
import { Place, MarkerStyle } from '../types';

interface MarkerLayerProps {
  places: Place[];
  projection: d3.GeoProjection;
  style: MarkerStyle;
  onUpdatePlaceOffset: (placeId: string, manualOffsetX: number, manualOffsetY: number) => void;
}

export const MarkerLayer: React.FC<MarkerLayerProps> = ({
  places,
  projection,
  style,
  onUpdatePlaceOffset
}) => {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragStartRef = useRef<{ startX: number; startY: number; initialOffsetX: number; initialOffsetY: number } | null>(null);

  const validPlaces = places.filter(p => p.status === 'resolved');

  const handlePointerDown = (e: React.PointerEvent, place: Place) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);

    setDraggingId(place.id);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialOffsetX: place.manualOffsetX || 0,
      initialOffsetY: place.manualOffsetY || 0
    };
  };

  const handlePointerMove = (e: React.PointerEvent, placeId: string) => {
    if (draggingId !== placeId || !dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.startX;
    const dy = e.clientY - dragStartRef.current.startY;
    const newX = Math.round(dragStartRef.current.initialOffsetX + dx);
    const newY = Math.round(dragStartRef.current.initialOffsetY + dy);

    onUpdatePlaceOffset(placeId, newX, newY);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (draggingId) {
      try {
        (e.target as Element).releasePointerCapture(e.pointerId);
      } catch {
        // Ignore if pointer not captured
      }
      setDraggingId(null);
      dragStartRef.current = null;
    }
  };

  return (
    <g id="markers-layer">
      {validPlaces.map((place, idx) => {
        const coords = projection([place.lon, place.lat]);
        if (!coords) return null;

        const cx = coords[0] + (place.manualOffsetX || 0);
        const cy = coords[1] + (place.manualOffsetY || 0);
        const r = style.size;
        const isDragging = draggingId === place.id;
        const orderNum = idx + 1;

        return (
          <g
            key={place.id}
            transform={`translate(${cx}, ${cy})`}
            className="cursor-grab active:cursor-grabbing select-none"
            onPointerDown={e => handlePointerDown(e, place)}
            onPointerMove={e => handlePointerMove(e, place.id)}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            {/* Expanded invisible hit area for easy mouse grabbing */}
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

            {/* Main marker body */}
            <circle
              r={r}
              fill={style.color}
              stroke={style.strokeColor}
              strokeWidth={style.strokeWidth}
              className={isDragging ? 'filter drop-shadow-md' : ''}
            />

            {/* Inner dot or number */}
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
              <circle r={Math.max(2, r * 0.4)} fill="#ffffff" pointerEvents="none" />
            ) : null}

            {/* Small indicator if manually offset */}
            {(place.manualOffsetX || place.manualOffsetY) ? (
              <title>{`${place.displayName} (已微调: dx=${place.manualOffsetX}, dy=${place.manualOffsetY})`}</title>
            ) : (
              <title>{`${place.displayName} (${place.lat.toFixed(4)}, ${place.lon.toFixed(4)})`}</title>
            )}
          </g>
        );
      })}
    </g>
  );
};