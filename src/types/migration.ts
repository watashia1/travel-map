import { ProjectData, BasemapConfig, Place } from './index';

import { DEFAULT_MAPLIBRE_STYLE_ID } from '../maplibre/styleCatalog';

export function migrateProjectV2ToV3(raw: any): ProjectData {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid project data format');
  }

  let basemap: BasemapConfig = raw.basemap;

  // Migrate builtin basemap
  if (basemap && basemap.type === 'builtin') {
    const builtinOld = basemap as any;
    if (builtinOld.region === 'antarctica') {
      basemap = {
        type: 'polar',
        pole: 'south',
        projection: 'stereographic'
      };
    } else if (builtinOld.region === 'arctic') {
      basemap = {
        type: 'polar',
        pole: 'north',
        projection: 'azimuthalEquidistant'
      };
    } else {
      basemap = {
        type: 'builtin-maplibre',
        styleId: DEFAULT_MAPLIBRE_STYLE_ID,
        enableCountryFill: builtinOld.enableColorByCountry ?? true,
        showAdmin1: builtinOld.showAdmin1 ?? true
      };
    }
  } else if (!basemap) {
    basemap = {
      type: 'builtin-maplibre',
      styleId: DEFAULT_MAPLIBRE_STYLE_ID,
      enableCountryFill: true,
      showAdmin1: true
    };
  }

  // Migrate places
  const places: Place[] = (raw.places || []).map((p: any) => ({
    ...p,
    geoStatus: p.geoStatus || p.status || 'resolved',
    visualStatus: p.visualStatus || (p.visualPosition ? 'placed' : undefined)
  }));

  // Migrate views & camera
  const oldCam = raw.camera || { zoom: 1, panX: 0, panY: 0 };
  const views: any = raw.views || {};

  if (!views.image && (basemap.type === 'free-image' || basemap.type === 'calibrated-image' || basemap.type === 'equirectangular-image')) {
    views.image = {
      zoom: oldCam.zoom || 1,
      panX: oldCam.panX || 0,
      panY: oldCam.panY || 0
    };
  }

  if (!views.polar && basemap.type === 'polar') {
    views.polar = oldCam;
  }

  return {
    version: '3.0',
    title: raw.title || '我的旅行路线',
    places,
    basemap,
    camera: oldCam,
    views,
    routeStyle: raw.routeStyle || {
      type: 'curved',
      mode: 'geodesic',
      strokeColor: '#e63946',
      strokeWidth: 2.5,
      strokeOpacity: 0.9,
      dashStyle: 'solid',
      showArrows: true
    },
    markerStyle: raw.markerStyle || {
      type: 'dot',
      color: '#e63946',
      size: 7,
      strokeColor: '#ffffff',
      strokeWidth: 2
    },
    labelStyle: raw.labelStyle || {
      fontSize: 12,
      color: '#1e293b',
      showHalo: true,
      fontWeight: 'medium',
      autoAvoidCollisions: true
    },
    overlayScaleMode: 'screen-fixed',
    updatedAt: raw.updatedAt || new Date().toISOString()
  };
}
