import { MapRegionType, MapProjectionType } from '../../types';

export interface BuiltinMapPreset {
  id: MapRegionType;
  title: string;
  dataLevel: '110m' | '50m';
  dataset: string;
  showAdmin1: boolean;
  projection: MapProjectionType;
  description: string;
}

export const BUILTIN_MAP_PRESETS: BuiltinMapPreset[] = [
  {
    id: 'world',
    title: '世界',
    dataLevel: '110m',
    dataset: './data/ne_110m_admin_0_countries.geojson',
    showAdmin1: false,
    projection: 'equalEarth',
    description: '全球 1:110m 陆地国界全景'
  },
  {
    id: 'asia',
    title: '亚洲',
    dataLevel: '50m',
    dataset: './data/ne_50m_admin_0_countries.geojson',
    showAdmin1: true,
    projection: 'equalEarth',
    description: '亚洲 1:50m 细分国界与省州界'
  },
  {
    id: 'europe',
    title: '欧洲',
    dataLevel: '50m',
    dataset: './data/ne_50m_admin_0_countries.geojson',
    showAdmin1: true,
    projection: 'equalEarth',
    description: '欧洲 1:50m 细分国界与省州界'
  },
  {
    id: 'africa',
    title: '非洲',
    dataLevel: '50m',
    dataset: './data/ne_50m_admin_0_countries.geojson',
    showAdmin1: true,
    projection: 'equalEarth',
    description: '非洲 1:50m 细分国界与省州界'
  },
  {
    id: 'north-america',
    title: '北美洲',
    dataLevel: '50m',
    dataset: './data/ne_50m_admin_0_countries.geojson',
    showAdmin1: true,
    projection: 'equalEarth',
    description: '北美洲 1:50m 细分国界与省州界'
  },
  {
    id: 'south-america',
    title: '南美洲',
    dataLevel: '50m',
    dataset: './data/ne_50m_admin_0_countries.geojson',
    showAdmin1: true,
    projection: 'equalEarth',
    description: '南美洲 1:50m 细分国界与省州界'
  },
  {
    id: 'oceania',
    title: '大洋洲',
    dataLevel: '50m',
    dataset: './data/ne_50m_admin_0_countries.geojson',
    showAdmin1: true,
    projection: 'equalEarth',
    description: '大洋洲 1:50m (自适应180度经线)'
  },
  {
    id: 'antarctica',
    title: '南极洲',
    dataLevel: '50m',
    dataset: './data/ne_50m_admin_0_countries.geojson',
    showAdmin1: false,
    projection: 'stereographic',
    description: '南极洲极地投影 (以南极点为中心)'
  }
];

export interface OfficialBasemapItem {
  id: string;
  title: string;
  category: 'vector' | 'official';
  assetPath: string;
  assetType: 'vector' | 'svg' | 'png';
  imageWidth?: number;
  imageHeight?: number;
  approvalNumber?: string; // 审图号或资料来源
  source: string;
  description: string;
}

export const OFFICIAL_COMPLIANCE_NOTICE =
  '标准地图素材的公开使用应遵循原地图审图号及相关地图管理要求。对地图内容进行编辑后公开使用，可能需要按要求重新送审。';

export const OFFICIAL_BASEMAP_REGISTRY: OfficialBasemapItem[] = [
  {
    id: 'builtin-world',
    title: '内置矢量底图 (Natural Earth Vector)',
    category: 'vector',
    assetPath: './data/ne_110m_admin_0_countries.geojson',
    assetType: 'vector',
    source: 'Natural Earth 110m / 50m (Public Domain)',
    description: '纯前端矢量底图，涵盖世界全景及七大洲高精国界与省州界。'
  }
];