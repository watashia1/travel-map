import React from 'react';
import {
  ProjectData,
  Place,
  RouteStyle,
  MarkerStyle,
  LabelStyle,
  MapLibreViewState,
  ImageViewState,
  CameraState,
} from '../types';
import { MapLibreGlobalView } from '../maplibre/MapLibreGlobalView';
import { DEFAULT_MAPLIBRE_STYLE_ID } from '../maplibre/styleCatalog';
import { PolarMapView } from '../polar/PolarMapView';
import { ImageMapView } from '../image-map/ImageMapView';

interface MapViewportProps {
  project: ProjectData;
  pickingPlaceId?: string | null;
  imageFitRequestId?: number;
  onPlacePicked?: (placeId: string, imgX: number, imgY: number, normX: number, normY: number) => void;
  onMapLibreViewStateChange?: (viewState: MapLibreViewState) => void;
  onImageViewStateChange?: (viewState: ImageViewState) => void;
  onPolarCameraChange?: (camera: CameraState) => void;
  onMarkerDragMove?: (placeId: string, mapOffsetX: number, mapOffsetY: number) => void;
  onMarkerDragEnd?: (placeId: string, mapOffsetX: number, mapOffsetY: number) => void;
  onLabelDragStart?: () => void;
  onLabelDragMove?: (placeId: string, offsetX: number, offsetY: number) => void;
  onLabelDragEnd?: (placeId: string, offsetX: number, offsetY: number) => void;
}

export const MapViewport: React.FC<MapViewportProps> = ({
  project,
  pickingPlaceId,
  imageFitRequestId,
  onPlacePicked,
  onMapLibreViewStateChange,
  onImageViewStateChange,
  onPolarCameraChange,
  onMarkerDragMove,
  onMarkerDragEnd,
  onLabelDragStart,
  onLabelDragMove,
  onLabelDragEnd,
}) => {
  const { basemap, places, routeStyle, markerStyle, labelStyle, views } = project;

  // 1. Polar Basemap (North Pole / South Pole)
  if (basemap.type === 'polar') {
    return (
      <PolarMapView
        places={places}
        basemap={basemap}
        routeStyle={routeStyle}
        markerStyle={markerStyle}
        labelStyle={labelStyle}
        camera={views?.polar || project.camera}
        onCameraChange={onPolarCameraChange}
        onLabelDragStart={onLabelDragStart}
        onLabelDragMove={onLabelDragMove}
        onLabelDragEnd={onLabelDragEnd}
      />
    );
  }

  // 2. Builtin MapLibre Global Basemap
  if (basemap.type === 'builtin-maplibre') {
    return (
      <MapLibreGlobalView
        places={places}
        basemap={basemap}
        routeStyle={routeStyle}
        markerStyle={markerStyle}
        labelStyle={labelStyle}
        initialViewState={views?.builtin}
        onViewStateChange={onMapLibreViewStateChange}
        onLabelDragStart={onLabelDragStart}
        onLabelDragMove={onLabelDragMove}
        onLabelDragEnd={onLabelDragEnd}
      />
    );
  }

  // 3. Backward compatibility for legacy 'builtin' type
  if (basemap.type === 'builtin') {
    const builtinOld = basemap as any;
    if (builtinOld.region === 'antarctica') {
      return (
        <PolarMapView
          places={places}
          basemap={{ type: 'polar', pole: 'south', projection: 'stereographic' }}
          routeStyle={routeStyle}
          markerStyle={markerStyle}
          labelStyle={labelStyle}
          camera={views?.polar || project.camera}
          onCameraChange={onPolarCameraChange}
          onLabelDragStart={onLabelDragStart}
          onLabelDragMove={onLabelDragMove}
          onLabelDragEnd={onLabelDragEnd}
        />
      );
    }

    return (
      <MapLibreGlobalView
        places={places}
        basemap={{
          type: 'builtin-maplibre',
          styleId: DEFAULT_MAPLIBRE_STYLE_ID,
          enableCountryFill: builtinOld.enableColorByCountry ?? true,
          showAdmin1: builtinOld.showAdmin1 ?? true,
        }}
        routeStyle={routeStyle}
        markerStyle={markerStyle}
        labelStyle={labelStyle}
        initialViewState={views?.builtin}
        onViewStateChange={onMapLibreViewStateChange}
        onLabelDragStart={onLabelDragStart}
        onLabelDragMove={onLabelDragMove}
        onLabelDragEnd={onLabelDragEnd}
      />
    );
  }

  // 4. Custom Image Basemaps (free-image, equirectangular-image, calibrated-image)
  return (
    <ImageMapView
      places={places}
      basemap={basemap}
      routeStyle={routeStyle}
      markerStyle={markerStyle}
      labelStyle={labelStyle}
      viewState={views?.image || { zoom: project.camera?.zoom || 1, panX: project.camera?.panX || 0, panY: project.camera?.panY || 0 }}
      pickingPlaceId={pickingPlaceId}
      fitRequestId={imageFitRequestId}
      onPlacePicked={onPlacePicked}
      onViewStateChange={onImageViewStateChange}
      onMarkerDragMove={onMarkerDragMove}
      onMarkerDragEnd={onMarkerDragEnd}
      onLabelDragStart={onLabelDragStart}
      onLabelDragMove={onLabelDragMove}
      onLabelDragEnd={onLabelDragEnd}
    />
  );
};
