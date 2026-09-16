export interface CameraPreset {
  id: string;
  name: string;
  center: [number, number]; // [lon, lat]
  zoom: number;
  bearing?: number;
  pitch?: number;
}

export const REGION_CAMERA_PRESETS: CameraPreset[] = [
  {
    id: 'world',
    name: '世界全景',
    center: [20, 20],
    zoom: 1.5,
  },
  {
    id: 'asia',
    name: '亚洲',
    center: [95, 32],
    zoom: 2.8,
  },
  {
    id: 'europe',
    name: '欧洲',
    center: [15, 50],
    zoom: 3.5,
  },
  {
    id: 'africa',
    name: '非洲',
    center: [20, 2],
    zoom: 2.8,
  },
  {
    id: 'north-america',
    name: '北美洲',
    center: [-98, 42],
    zoom: 2.8,
  },
  {
    id: 'south-america',
    name: '南美洲',
    center: [-60, -22],
    zoom: 2.8,
  },
  {
    id: 'oceania',
    name: '大洋洲',
    center: [138, -25],
    zoom: 3.2,
  },
];
