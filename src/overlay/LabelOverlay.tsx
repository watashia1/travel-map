import React, { useState, useRef, useMemo } from 'react';
import { Place, LabelStyle } from '../types';
import { ProjectedPlace } from './types';

interface LabelOverlayProps {
  projectedPlaces: ProjectedPlace[];
  style: LabelStyle;
  onDragStart?: () => void;
  onDragMove?: (placeId: string, labelOffsetX: number, labelOffsetY: number) => void;
  onDragEnd?: (placeId: string, labelOffsetX: number, labelOffsetY: number) => void;
}

interface BoundingBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

function boxesOverlap(b1: BoundingBox, b2: BoundingBox): boolean {
  return !(
    b1.x + b1.w < b2.x ||
    b2.x + b2.w < b1.x ||
    b1.y + b1.h < b2.y ||
    b2.y + b2.h < b1.y
  );
}

export const LabelOverlay: React.FC<LabelOverlayProps> = ({
  projectedPlaces,
  style,
  onDragStart,
  onDragMove,
  onDragEnd,
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

  const validPlaces = projectedPlaces.filter(
    (item) =>
      (item.place.status === 'resolved' ||
        item.place.geoStatus === 'resolved' ||
        item.place.visualStatus === 'placed' ||
        !!item.place.visualPosition) &&
      !item.place.hideLabel &&
      item.visible !== false
  );

  // Compute 8-direction auto-avoidance offsets if enabled
  const computedOffsets = useMemo(() => {
    const candidateDirs = [
      { x: 14, y: -12, anchor: 'start' }, // Top-Right (default)
      { x: 16, y: 0, anchor: 'start' },   // Right
      { x: 14, y: 14, anchor: 'start' },  // Bottom-Right
      { x: 0, y: 16, anchor: 'middle' },  // Bottom
      { x: -14, y: 14, anchor: 'end' },   // Bottom-Left
      { x: -16, y: 0, anchor: 'end' },    // Left
      { x: -14, y: -12, anchor: 'end' },  // Top-Left
      { x: 0, y: -16, anchor: 'middle' }, // Top
    ];

    const placedBoxes: BoundingBox[] = [];
    const offsets = new Map<string, { x: number; y: number; anchor: string }>();

    for (const item of validPlaces) {
      const { place, screenX, screenY } = item;

      // If user has explicitly dragged this label, respect custom offset
      if (
        place.labelOffsetX !== undefined &&
        place.labelOffsetY !== undefined &&
        (place.labelOffsetX !== 12 || place.labelOffsetY !== -12)
      ) {
        offsets.set(place.id, {
          x: place.labelOffsetX,
          y: place.labelOffsetY,
          anchor: place.labelOffsetX < 0 ? 'end' : 'start',
        });
        continue;
      }

      if (!style.autoAvoidCollisions) {
        offsets.set(place.id, { x: 14, y: -12, anchor: 'start' });
        continue;
      }

      // Estimate text box dimensions
      const textWidth = place.displayName.length * (style.fontSize * 0.9) + 8;
      const textHeight = style.fontSize + 4;

      let bestDir = candidateDirs[0];
      let minCollisions = Infinity;

      for (const cand of candidateDirs) {
        const boxX = cand.anchor === 'end' ? screenX + cand.x - textWidth : screenX + cand.x;
        const boxY = screenY + cand.y - textHeight / 2;
        const testBox: BoundingBox = { x: boxX, y: boxY, w: textWidth, h: textHeight };

        let collisionCount = 0;
        for (const existing of placedBoxes) {
          if (boxesOverlap(testBox, existing)) {
            collisionCount++;
          }
        }

        if (collisionCount < minCollisions) {
          minCollisions = collisionCount;
          bestDir = cand;
          if (collisionCount === 0) break;
        }
      }

      const finalBoxX = bestDir.anchor === 'end' ? screenX + bestDir.x - textWidth : screenX + bestDir.x;
      const finalBoxY = screenY + bestDir.y - textHeight / 2;
      placedBoxes.push({ x: finalBoxX, y: finalBoxY, w: textWidth, h: textHeight });

      offsets.set(place.id, bestDir);
    }

    return offsets;
  }, [validPlaces, style]);

  const handlePointerDown = (e: React.PointerEvent, place: Place) => {
    e.stopPropagation();
    try {
      (e.target as Element).setPointerCapture(e.pointerId);
    } catch {}

    onDragStart?.();
    setDraggingId(place.id);

    const auto = computedOffsets.get(place.id) || { x: 14, y: -12 };
    const initX = place.labelOffsetX ?? auto.x;
    const initY = place.labelOffsetY ?? auto.y;

    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialOffsetX: initX,
      initialOffsetY: initY,
      lastX: initX,
      lastY: initY,
    };
  };

  const handlePointerMove = (e: React.PointerEvent, placeId: string) => {
    if (draggingId !== placeId || !dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.startX;
    const dy = e.clientY - dragStartRef.current.startY;

    const newX = Math.round(dragStartRef.current.initialOffsetX + dx);
    const newY = Math.round(dragStartRef.current.initialOffsetY + dy);
    dragStartRef.current.lastX = newX;
    dragStartRef.current.lastY = newY;

    onDragMove?.(placeId, newX, newY);
  };

  const handlePointerUp = (e: React.PointerEvent, placeId: string) => {
    if (draggingId) {
      try {
        (e.target as Element).releasePointerCapture(e.pointerId);
      } catch {}

      if (dragStartRef.current) {
        onDragEnd?.(placeId, dragStartRef.current.lastX, dragStartRef.current.lastY);
      }
      setDraggingId(null);
      dragStartRef.current = null;
    }
  };

  return (
    <g id="labels-layer" className="labels-overlay">
      {validPlaces.map((item) => {
        const { place, screenX, screenY } = item;

        const auto = computedOffsets.get(place.id) || { x: 14, y: -12, anchor: 'start' };
        const offsetX = place.labelOffsetX ?? auto.x;
        const offsetY = place.labelOffsetY ?? auto.y;

        const x = screenX + offsetX;
        const y = screenY + offsetY;
        const isDragging = draggingId === place.id;
        const textAnchor = (auto.anchor as any) || (offsetX < 0 ? 'end' : 'start');

        return (
          <g
            key={`label-${place.id}`}
            transform={`translate(${x.toFixed(2)}, ${y.toFixed(2)})`}
            className="cursor-grab active:cursor-grabbing select-none"
            onPointerDown={(e) => handlePointerDown(e, place)}
            onPointerMove={(e) => handlePointerMove(e, place.id)}
            onPointerUp={(e) => handlePointerUp(e, place.id)}
            onPointerCancel={(e) => handlePointerUp(e, place.id)}
          >
            {/* Expanded drag hit box */}
            <rect
              x={textAnchor === 'end' ? -place.displayName.length * (style.fontSize * 0.9) - 8 : -4}
              y={-style.fontSize / 2 - 4}
              width={place.displayName.length * (style.fontSize * 0.9) + 16}
              height={style.fontSize + 10}
              fill="transparent"
            />

            {/* Subtle leader line if dragged far */}
            {(Math.abs(offsetX) > 35 || Math.abs(offsetY) > 35) && (
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
              className={isDragging ? 'filter drop-shadow-sm font-bold' : ''}
              pointerEvents="none"
              dominantBaseline="middle"
              textAnchor={textAnchor}
            >
              {place.displayName}
            </text>
          </g>
        );
      })}
    </g>
  );
};
