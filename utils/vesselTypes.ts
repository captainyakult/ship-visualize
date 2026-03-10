export const VESSEL_TYPE_COLORS: Record<string, string> = {
  cargo: '#4ade80',
  tanker: '#f97316',
  passenger: '#60a5fa',
  fishing: '#facc15',
  military: '#ef4444',
  sailing: '#a78bfa',
  tug: '#fb923c',
  towing: '#fb923c',
  pleasure: '#f472b6',
  highspeed: '#22d3ee',
  pilot: '#e879f9',
  sar: '#f43f5e',
  other: '#94a3b8',
};

export function getVesselTypeName(typeCode: number): string {
  if (typeCode >= 70 && typeCode <= 79) return 'cargo';
  if (typeCode >= 80 && typeCode <= 89) return 'tanker';
  if (typeCode >= 60 && typeCode <= 69) return 'passenger';
  if (typeCode === 30) return 'fishing';
  if (typeCode === 35) return 'military';
  if (typeCode === 36) return 'sailing';
  if (typeCode === 37) return 'pleasure';
  if (typeCode === 52 || typeCode === 53) return 'tug';
  if (typeCode === 31 || typeCode === 32) return 'towing';
  if (typeCode >= 40 && typeCode <= 49) return 'highspeed';
  if (typeCode === 50) return 'pilot';
  if (typeCode === 51) return 'sar';
  if (typeCode === 55) return 'military';
  return 'other';
}

export function getVesselCategory(type: string): string {
  const categories: Record<string, string> = {
    cargo: 'Cargo',
    tanker: 'Tanker',
    passenger: 'Passenger',
    fishing: 'Fishing',
    military: 'Military',
    sailing: 'Sailing',
    tug: 'Tug/Towing',
    towing: 'Tug/Towing',
    pleasure: 'Pleasure Craft',
    highspeed: 'High Speed Craft',
    pilot: 'Pilot Vessel',
    sar: 'Search & Rescue',
    other: 'Other',
  };
  return categories[type] || 'Other';
}
