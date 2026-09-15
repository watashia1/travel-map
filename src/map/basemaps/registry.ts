import { CalibrationPoint, CalibrationTransform } from '../../types';

export interface OfficialBasemapItem {
  id: string;
  title: string;
  category: 'vector' | 'official' | 'island';
  assetPath: string;
  assetType: 'vector' | 'svg' | 'png';
  imageWidth?: number;
  imageHeight?: number;
  approvalNumber?: string; // 审图号或资料来源
  source: string;
  description: string;
  defaultControlPoints?: CalibrationPoint[];
  defaultTransform?: CalibrationTransform;
  errorPx?: number;
}

export const OFFICIAL_COMPLIANCE_NOTICE =
  '标准地图素材的公开使用应遵循原地图审图号及相关地图管理要求。对地图内容进行编辑后公开使用，可能需要按要求重新送审。';

export const OFFICIAL_BASEMAP_REGISTRY: OfficialBasemapItem[] = [
  {
    id: 'builtin-world',
    title: '内置极简矢量世界地图',
    category: 'vector',
    assetPath: './data/world.json',
    assetType: 'vector',
    source: 'Natural Earth 110m (Public Domain)',
    description: '纯前端高通用性矢量底图，支持 Equal Earth、Mercator 与极区投影自由切换。'
  },
  {
    id: 'galapagos-topo',
    title: '加拉帕戈斯群岛地形矢量图 (2160×2160)',
    category: 'island',
    assetPath: './basemaps/galapagos.svg',
    assetType: 'svg',
    imageWidth: 2160,
    imageHeight: 2160,
    source: 'Wikipedia Commons / Cartography Department',
    description: '高精度群岛等高线地形与岛屿边界图，已内置高精度仿射校准，点位精准吸附。',
    defaultTransform: {
      a: 552.0,
      b: 0.0,
      c: 0.0,
      d: -552.0,
      tx: 50924.0,
      ty: 1670.6
    },
    errorPx: 0.8,
    defaultControlPoints: [
      {
        placeId: 'isabela',
        name: '伊莎贝拉岛',
        lat: -0.8293,
        lon: -91.1349,
        imageX: 618,
        imageY: 2128
      },
      {
        placeId: 'santiago',
        name: '圣地亚哥岛',
        lat: -0.25,
        lon: -90.7,
        imageX: 858,
        imageY: 1809
      },
      {
        placeId: 'floreana',
        name: '弗雷里安纳岛',
        lat: -1.2975,
        lon: -90.4356,
        imageX: 1004,
        imageY: 2387
      },
      {
        placeId: 'san_cristobal',
        name: '圣克里斯托瓦尔岛',
        lat: -0.9022,
        lon: -89.4314,
        imageX: 1558,
        imageY: 2169
      }
    ]
  }
];