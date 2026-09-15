import React from 'react';
import * as d3 from 'd3-geo';
import { Place, RouteStyle } from '../types';
import { CoordinateTransformer } from './transformer';

interface RouteLayerProps {
  places: Place[];
  transformer: CoordinateTransformer;
  style: RouteStyle;
  canvasWidth?: number;
}

export const RouteLayer: React.FC<RouteLayerProps> = ({
  places,
  transformer,
  style,
  canvasWidth = 1000
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

  const pathStrings: string[] = [];

  for (const seg of segments) {
    for (let i = 0; i < seg.length - 1; i++) {
      const p1 = seg[i];
      const p2 = seg[i + 1];

      const startPt = transformer.project(p1.lon, p1.lat, p1);
      const endPt = transformer.project(p2.lon, p2.lat, p2);
      if (!startPt || !endPt) continue;

      if (style.mode === 'straight-screen') {
        pathStrings.push(
          `M ${startPt[0].toFixed(2)} ${startPt[1].toFixed(2)} L ${endPt[0].toFixed(2)} ${endPt[1].toFixed(2)}`
        );
      } else if (style.mode === 'decorative-curve') {
        const dx = endPt[0] - startPt[0];
        const dy = endPt[1] - startPt[1];
        const dist = Math.sqrt(dx * dx + dy * dy);
        const nx = -dy / (dist || 1);
        const ny = dx / (dist || 1);
        const curvature = Math.min(dist * 0.22, 80);
        const sign = nx < 0 ? -1 : 1;
        const cx = (startPt[0] + endPt[0]) / 2 + nx * curvature * sign;
        const cy = (startPt[1] + endPt[1]) / 2 + ny * curvature * sign - Math.min(dist * 0.08, 30);

        pathStrings.push(
          `M ${startPt[0].toFixed(2)} ${startPt[1].toFixed(2)} Q ${cx.toFixed(2)} ${cy.toFixed(2)} ${endPt[0].toFixed(2)} ${endPt[1].toFixed(2)}`
        );
      } else {
        // 'geodesic' default: Great circle interpolation
        const interpolator = d3.geoInterpolate([p1.lon, p1.lat], [p2.lon, p2.lat]);
        const numSteps = 24;
        const pts: [number, number][] = [];

        for (let s = 0; s <= numSteps; s++) {
          const t = s / numSteps;
          const [lon, lat] = interpolator(t);
          const projected = transformer.project(lon, lat);
          if (projected) {
            pts.push(projected);
          }
        }

        if (pts.length < 2) continue;

        // Check for antimeridian jump (wrap across edge)
        let subPath = `M ${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;
        for (let k = 1; k < pts.length; k++) {
          const prev = pts[k - 1];
          const curr = pts[k];
          // If distance between successive steps exceeds 40% of canvas, split line
          const deltaX = Math.abs(curr[0] - prev[0]);
          if (deltaX > canvasWidth * 0.4) {
            subPath += ` M ${curr[0].toFixed(2)} ${curr[1].toFixed(2)}`;
          } else {
            subPath += ` L ${curr[0].toFixed(2)} ${curr[1].toFixed(2)}`;
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
          markerEnd={style.showArrows ? 'url(#route-arrow)' : undefined}
        />
      ))}
    </g>
  );
};