import React, { useState, useRef } from 'react';
import * as d3 from 'd3-geo';
import { Place, LabelStyle } from '../types';

interface LabelLayerProps {
  places: Place[];
  projection: d3.GeoProjection;
  style: LabelStyle;
  onUpdateLabelOffset: (placeId: string, labelOffsetX: number, labelOffsetY: number) => void;
}

export const LabelLayer: React.FC<LabelLayerProps> = ({
  places,
  projection,
  style,
  onUpdateLabelOffset
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
      initialOffsetX: place.labelOffsetX ?? 12,
      initialOffsetY: place.labelOffsetY ?? -12
    };
  };

  const handlePointerMove = (e: React.PointerEvent, placeId: string) => {
    if (draggingId !== placeId || !dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.startX;
    const dy = e.clientY - dragStartRef.current.startY;
    const newX = Math.round(dragStartRef.current.initialOffsetX + dx);
    const newY = Math.round(dragStartRef.current.initialOffsetY + dy);

    onUpdateLabelOffset(placeId, newX, newY);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (draggingId) {
      try {
        (e.target as Element).releasePointerCapture(e.pointerId);
      } catch {
        // Ignore
      }
      setDraggingId(null);
      dragStartRef.current = null;
    }
  };

  return (
    <g id="labels-layer">
      {validPlaces.map(place => {
        const coords = projection([place.lon, place.lat]);
        if (!coords) return null;

        // Base anchor is the marker's visual position
        const baseX = coords[0] + (place.manualOffsetX || 0);
        const baseY = coords[1] + (place.manualOffsetY || 0);

        const offsetX = place.labelOffsetX ?? 12;
        const offsetY = place.labelOffsetY ?? -12;

        const x = baseX + offsetX;
        const y = baseY + offsetY;
        const isDragging = draggingId === place.id;

        return (
          <g
            key={`lbl-${place.id}`}
            transform={`translate(${x}, ${y})`}
            className="cursor-grab active:cursor-grabbing select-none"
            onPointerDown={e => handlePointerDown(e, place)}
            onPointerMove={e => handlePointerMove(e, place.id)}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            {/* Expanded hit box for easy clicking & dragging */}
            <rect
              x="-4"
              y="-14"
              width={place.displayName.length * (style.fontSize * 0.9) + 16}
              height={style.fontSize + 12}
              fill="transparent"
            />

            {/* Connecting subtle leader line if dragged far from marker */}
            {(Math.abs(offsetX) > 30 || Math.abs(offsetY) > 30) && (
              <line
                x1={-offsetX}
                y1={-offsetY}
                x2={0}
                y2={0}
                stroke="#94a3b8"
                strokeWidth={1}
                strokeDasharray="2, 2"
                strokeOpacity={0.6}
                pointerEvents="none"
              />
            )}

            {/* Label text with white halo stroke for crystal clarity over borders/land */}
            <text
              x={0}
              y={0}
              fontSize={style.fontSize}
              fontWeight={style.fontWeight}
              fill={style.color}
              stroke={style.showHalo ? '#ffffff' : 'none'}
              strokeWidth={style.showHalo ? 3.5 : 0}
              strokeLinejoin="round"
              paintOrder="stroke fill"
              className={isDragging ? 'filter drop-shadow-sm font-semibold' : ''}
              pointerEvents="none"
              dominantBaseline="middle"
            >
              {place.displayName}
            </text>
          </g>
        );
      })}
    </g>
  );
};