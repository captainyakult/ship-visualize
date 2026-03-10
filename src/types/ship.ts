export interface Ship {
  id: string;
  name: string;
  type: string;
  lat: number;
  lon: number;
  speed: number;
  heading: number;
  course: number;
  path: [number, number][];
  lastUpdate: number;
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

// AIS ship type code (first digit) to our category
export function aisTypeToCategory(shipType: number): string {
  if (shipType >= 70 && shipType <= 79) return "Cargo";
  if (shipType >= 80 && shipType <= 89) return "Tanker";
  if (shipType >= 60 && shipType <= 69) return "Passenger";
  if (shipType === 30) return "Fishing";
  if (shipType >= 35 && shipType <= 36) return "Military";
  if (shipType >= 50 && shipType <= 59) return "Other"; // pilot, SAR, tug, etc.
  return "Other";
}

export type ConnectionStatus = "disconnected" | "connecting" | "connected";
