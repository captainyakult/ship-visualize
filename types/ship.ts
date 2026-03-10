export interface Ship {
  id: string;
  name: string;
  type: string;
  typeCode: number;
  lat: number;
  lon: number;
  speed: number;
  heading: number;
  path: [number, number][];
  timestamp: number;
  destination?: string;
  callsign?: string;
  length?: number;
  width?: number;
}

export type VesselFilter =
  | 'all'
  | 'cargo'
  | 'tanker'
  | 'passenger'
  | 'fishing'
  | 'military'
  | 'sailing'
  | 'tug'
  | 'other';

export interface BoundingBox {
  minLat: number;
  minLon: number;
  maxLat: number;
  maxLon: number;
}
