import React from 'react';
import * as d3 from 'd3-geo';
import { Place, RouteStyle } from '../types';

interface RouteOverlayProps {
  places: Place[];
  projectCoordinate: (lon: number, lat: number) => { x: number; y: number } | [number, number] | null;
  style: RouteStyle;
  canvasWidth?: number;
}

export const RouteOverlay: React.FC<RouteOverlayProps> = ({
  places,
  projectCoordinate,
  style,
  canvasWidth = 1000,
}) => {
  // 1. Group continuous resolved places into segments (unresolved breaks the route)
  const segments: Place[][] = [];
  let currentSegment: Place[] = [];

  for (const place of places) {
    if (place.status === 'resolved') {
      currentSegment.push(place);
    } else {
      if (currentSegment.length > 1) {
        segments.push(currentSegment);
      }
      currentSegment = [];
    }
  }
  if (currentSegment.length > 1) {
    segments.push(currentSegment);
  }

  if (segments.length === 0) return null;

  const toXY = (pt: { x: number; y: number } | [number, number] | null): { x: number; y: number } | null => {
    if (!pt) return null;
    if (Array.isArray(pt)) return { x: pt[0], y: pt[1] };
    return pt;
  };

  const pathStrings: string[] = [];

  for (const seg of segments) {
    for (let i = 0; i < seg.length - 1; i++) {
      const p1 = seg[i];
      const p2 = seg[i + 1];

      const startPt = toXY(projectCoordinate(p1.lon, p1.lat));
      const endPt = toXY(projectCoordinate(p2.lon, p2.lat));
      if (!startPt || !endPt) continue;

      if (style.mode === 'straight-screen') {
        pathStrings.push(
          `M ${startPt.x.toFixed(2)} ${startPt.y.toFixed(2)} L ${endPt.x.toFixed(2)} ${endPt.y.toFixed(2)}`
        );
      } else if (style.mode === 'decorative-curve') {
        const dx = endPt.x - startPt.x;
        const dy = endPt.y - startPt.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const nx = -dy / (dist || 1);
        const ny = dx / (dist || 1);
        const curvature = Math.min(dist * 0.22, 80);
        const sign = nx < 0 ? -1 : 1;
        const cx = (startPt.x + endPt.x) / 2 + nx * curvature * sign;
        const cy = (startPt.y + endPt.y) / 2 + ny * curvature * sign - Math.min(dist * 0.08, 30);

        pathStrings.push(
          `M ${startPt.x.toFixed(2)} ${startPt.y.toFixed(2)} Q ${cx.toFixed(2)} ${cy.toFixed(2)} ${endPt.x.toFixed(2)} ${endPt.y.toFixed(2)}`
        );
      } else {
        // 'geodesic' spherical great-circle interpolation
        const interpolator = d3.geoInterpolate([p1.lon, p1.lat], [p2.lon, p2.lat]);
        const numSteps = 32;
        const pts: { x: number; y: number }[] = [];

        for (let s = 0; s <= numSteps; s++) {
          const t = s / numSteps;
          const [lon, lat] = interpolator(t);
          const proj = toXY(projectCoordinate(lon, lat));
          if (proj) {
            pts.push(proj);
          }
        }

        if (pts.length < 2) continue;

        // Antimeridian wrap safety: if jump in X is too large, split subpaths
        let subPath = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
        for (let k = 1; k < pts.length; k++) {
          const prev = pts[k - 1];
          const curr = pts[k];
          const deltaX = Math.abs(curr.x - prev.x);
          if (deltaX > canvasWidth * 0.45) {
            subPath += ` M ${curr.x.toFixed(2)} ${curr.y.toFixed(2)}`;
          } else {
            subPath += ` L ${curr.x.toFixed(2)} ${curr.y.toFixed(2)}`;
          }
        }
        pathStrings.push(subPath);
      }
    }
  }

  let strokeDasharray = 'none';
  if (style.dashStyle === 'dashed') {
    strokeDasharray = `${style.strokeWidth * 2.5}, ${style.strokeWidth * 1.8}`;
  } else if (style.dashStyle === 'dotted') {
    strokeDasharray = `${style.strokeWidth}, ${style.strokeWidth * 1.5}`;
  }

  return (
    <g id="route-geometry-layer" className="pointer-events-none">
      <defs>
        {style.showArrows && (
          <marker
            id="v3-route-arrow"
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

      {pathStrings.map((d, index) => (
        <path
          key={`route-${index}`}
          d={d}
          fill="none"
          stroke={style.strokeColor}
          strokeWidth={style.strokeWidth}
          strokeOpacity={style.strokeOpacity}
          strokeDasharray={strokeDasharray}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          markerEnd={style.showArrows ? 'url(#v3-route-arrow)' : undefined}
        />
      ))}
    </g>
  );
};
