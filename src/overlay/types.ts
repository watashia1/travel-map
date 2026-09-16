import { Place } from '../types';

export interface ProjectedPlace {
  place: Place;
  screenX: number;
  screenY: number;
  visible?: boolean;
}
