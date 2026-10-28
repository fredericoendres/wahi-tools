import { supabase } from './supabase';
import type { OsmPlace } from '../types';
import { columns } from '../types';

const PAGE_SIZE = 500;

export async function fetchAllPlaces(onProgress?: (total: number) => void): Promise<OsmPlace[]> {
  if (!supabase) throw Error('Supabase não configurado');
  const all: OsmPlace[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase.from('osm_places')
      .select(columns).order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    const batch = (data ?? []) as unknown as OsmPlace[];
    all.push(...batch);
    onProgress?.(all.length);
    if (batch.length < PAGE_SIZE) break;
    offset += batch.length;
  }
  return all;
}

export type PoiEditable = Pick<OsmPlace,
  'name' | 'category' | 'subcategory' | 'latitude' | 'longitude' | 'tags' | 'is_visible'>;

export async function savePlace(id: string, changes: PoiEditable): Promise<OsmPlace> {
  if (!supabase) throw Error('Supabase não configurado');
  const { data, error } = await supabase.from('osm_places')
    .update({ ...changes, updated_at: new Date().toISOString() })
    .eq('id', id).select(columns).single();
  if (error) throw error;
  return data as unknown as OsmPlace;
}

export async function setVisibility(id: string, isVisible: boolean): Promise<OsmPlace> {
  if (!supabase) throw Error('Supabase não configurado');
  const { data, error } = await supabase.from('osm_places')
    .update({ is_visible: isVisible, updated_at: new Date().toISOString() })
    .eq('id', id).select(columns).single();
  if (error) throw error;
  return data as unknown as OsmPlace;
}

export async function checkIsAdmin(userId: string): Promise<boolean> {
  if (!supabase) return false;
  const { data, error } = await supabase.from('wahi_admin_users')
    .select('user_id').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data?.user_id === userId;
}
