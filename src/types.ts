export type PoiGroup = 'FOOD' | 'LEISURE' | 'SERVICES' | 'TRANSPORT';

export type OsmPlace = {
  id: string;
  osm_type: 'node' | 'way' | 'relation';
  osm_id: number;
  name: string | null;
  category: string | null;
  subcategory: string | null;
  latitude: number;
  longitude: number;
  tags: Record<string, unknown>;
  is_visible: boolean;
  osm_snapshot_at: string | null;
  updated_at: string;
  created_at: string;
};

export const GROUPS: { key: PoiGroup; label: string; color: string; categories: string[] }[] = [
  { key: 'FOOD', label: 'Alimentação', color: '#e39a55', categories: ['FOOD'] },
  { key: 'LEISURE', label: 'Lazer e turismo', color: '#33a391', categories: ['LEISURE', 'TOURISM', 'BEACH', 'TRAIL'] },
  { key: 'SERVICES', label: 'Serviços', color: '#6c8ac6', categories: ['SERVICES', 'HEALTH', 'ACCOMMODATION'] },
  { key: 'TRANSPORT', label: 'Transporte', color: '#8e7cb8', categories: ['TRANSPORT'] },
];

export const RAW_CATEGORIES = [
  'FOOD', 'LEISURE', 'TOURISM', 'BEACH', 'TRAIL',
  'SERVICES', 'HEALTH', 'ACCOMMODATION', 'TRANSPORT',
];

export function groupFor(category: string | null): PoiGroup | null {
  return GROUPS.find(g => g.categories.includes(category || ''))?.key ?? null;
}

export function displayName(place: OsmPlace): string {
  return place.name?.trim() || ({
    TRANSPORT: 'Parada de transporte', BEACH: 'Praia', TRAIL: 'Trilha',
    SERVICES: 'Serviço', HEALTH: 'Serviço de saúde', ACCOMMODATION: 'Hospedagem',
  }[place.category || ''] || place.subcategory?.replaceAll('_', ' ').toLowerCase() || 'Local sem nome');
}

export function niceCategory(raw: string | null): string {
  const labels: Record<string, string> = {
    FOOD: 'Alimentação', LEISURE: 'Lazer', TOURISM: 'Turismo', BEACH: 'Praia',
    TRAIL: 'Trilha', SERVICES: 'Serviços', HEALTH: 'Saúde',
    ACCOMMODATION: 'Hospedagem', TRANSPORT: 'Transporte',
  };
  return labels[raw || ''] || raw || 'Sem categoria';
}

export const columns = [
  'id', 'osm_type', 'osm_id', 'name', 'category', 'subcategory',
  'latitude', 'longitude', 'tags', 'is_visible',
  'osm_snapshot_at', 'created_at', 'updated_at',
].join(',');
