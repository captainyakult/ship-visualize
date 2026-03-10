export interface Ship {
  id: string;
  name: string;
  type: string;
  lat: number;
  lon: number;
  speed: number;
  heading: number;
  path: [number, number][];
}

export const VESSEL_TYPES = [
  "All vessels",
  "Cargo",
  "Tanker",
  "Passenger",
  "Fishing",
  "Military",
  "Other",
] as const;

export type VesselType = (typeof VESSEL_TYPES)[number];
