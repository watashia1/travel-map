import React from 'react';
import * as d3 from 'd3-geo';
import { Place, RouteStyle } from '../types';

interface RouteLayerProps {
  places: Place[];
  projection: d3.GeoProjection;
  style: RouteStyle;
}

export const RouteLayer: React.FC<RouteLayerProps> = ({ places, projection, style }) => {
  // Only connect places that are resolved and have coordinates
  const validPlaces = places.filter(p => p.status === 'resolved');
  if (validPlaces.length < 2) {
    return null;
  }

  // Calculate projected screen points including manual offsets
  const screenPoints = validPlaces.map(p => {
    const coords = projection([p.lon, p.lat]);
    if (!coords) return null;
    return {
      x: coords[0] + (p.manualOffsetX || 0),
      y: coords[1] + (p.manualOffsetY || 0)
    };
  });

  const segments: string[] = [];

  for (let i = 0; i < screenPoints.length - 1; i++) {
    const p1 = screenPoints[i];
    const p2 = screenPoints[i + 1];
    if (!p1 || !p2) continue;

    if (style.type === 'straight') {
      segments.push(`M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} L ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`);
    } else {
      // Curved arc calculation (subtle pleasant arching)
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Normal vector
      const nx = -dy / (dist || 1);
      const ny = dx / (dist || 1);

      // Bow curvature factor proportional to distance (capped for aesthetics)
      const curvature = Math.min(dist * 0.2, 70);

      // Adjust arch direction to favor upward curves
      const sign = nx < 0 ? -1 : 1;
      const cx = (p1.x + p2.x) / 2 + nx * curvature * sign;
      const cy = (p1.y + p2.y) / 2 + ny * curvature * sign - Math.min(dist * 0.08, 30);

      segments.push(`M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} Q ${cx.toFixed(2)} ${cy.toFixed(2)} ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`);
    }
  }

  let strokeDasharray = 'none';
  if (style.dashStyle === 'dashed') {
    strokeDasharray = `${style.strokeWidth * 2.5}, ${style.strokeWidth * 1.8}`;
  } else if (style.dashStyle === 'dotted') {
    strokeDasharray = `${style.strokeWidth}, ${style.strokeWidth * 1.5}`;
  }

  return (
    <g id="routes-layer" className="pointer-events-none">
      <defs>
        {style.showArrows && (
          <marker
            id="route-arrow"
            viewBox="0 0 10 10"
            refX="6"
            refY="5"
            markerWidth={Math.max(4, style.strokeWidth * 1.8)}
            markerHeight={Math.max(4, style.strokeWidth * 1.8)}
            orient="auto-start-reverse"
          >
            <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill={style.strokeColor} />
          </marker>
        )}
      </defs>

      {segments.map((d, index) => (
        <path
          key={`seg-${index}`}
          d={d}
          fill="none"
          stroke={style.strokeColor}
          strokeWidth={style.strokeWidth}
          strokeOpacity={style.strokeOpacity}
          strokeDasharray={strokeDasharray}
          strokeLinecap="round"
          strokeLinejoin="round"
          markerEnd={style.showArrows ? 'url(#route-arrow)' : undefined}
        />
      ))}
    </g>
  );
};