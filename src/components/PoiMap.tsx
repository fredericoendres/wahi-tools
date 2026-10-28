import { useEffect, useRef } from 'react';
import maplibregl, { type Map as LibreMap, type GeoJSONSource } from 'maplibre-gl';
import type { FeatureCollection, Point } from 'geojson';
import { groupFor, type OsmPlace } from '../types';

const SOURCE = 'wahi-pois';
const empty: FeatureCollection<Point> = { type: 'FeatureCollection', features: [] };

function asGeoJSON(places: OsmPlace[]): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: places.filter(p => Number.isFinite(p.longitude) && Number.isFinite(p.latitude)).map(p => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [p.longitude, p.latitude] },
      properties: { id: p.id, group: groupFor(p.category), name: p.name || '' },
    })),
  };
}

const colorExpression: maplibregl.ExpressionSpecification = [
  'match', ['get', 'group'],
  'FOOD', '#e39a55', 'LEISURE', '#33a391',
  'SERVICES', '#6c8ac6', 'TRANSPORT', '#8e7cb8',
  '#94a3b8',
];

interface Props {
  places: OsmPlace[];
  selected: OsmPlace | null;
  active: boolean;
  onSelect: (id: string) => void;
}

export default function PoiMap({ places, selected, active, onSelect }: Props) {
  const root = useRef<HTMLDivElement | null>(null);
  const map = useRef<LibreMap | null>(null);
  const onSelectRef = useRef(onSelect);
  const pendingGeoJson = useRef<FeatureCollection<Point>>(empty);
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!root.current) return;
    const instance = new maplibregl.Map({
      container: root.current,
      style: 'https://tiles.openfreemap.org/styles/positron',
      center: [-48.548, -27.596], zoom: 10.6,
      attributionControl: false,
    });
    map.current = instance;
    instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    instance.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

    instance.on('load', () => {
      instance.addSource(SOURCE, {
        type: 'geojson', data: pendingGeoJson.current,
        cluster: true, clusterMaxZoom: 15, clusterRadius: 40,
      });
      instance.addLayer({
        id: 'poi-clusters', type: 'circle', source: SOURCE,
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#176e62',
          'circle-radius': ['step', ['get', 'point_count'], 16, 40, 20, 150, 25],
          'circle-stroke-color': '#fff', 'circle-stroke-width': 2,
          'circle-opacity': 0.92,
        },
      });
      instance.addLayer({
        id: 'poi-cluster-count', type: 'symbol', source: SOURCE,
        filter: ['has', 'point_count'],
        layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 11.5 },
        paint: { 'text-color': '#ffffff' },
      });
      instance.addLayer({
        id: 'poi-points', type: 'circle', source: SOURCE,
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': colorExpression,
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 3.5, 13, 5.5, 17, 7],
          'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1.5,
          'circle-opacity': 0.94,
        },
      });
      instance.on('click', 'poi-points', (evt) => {
        const id = evt.features?.[0]?.properties?.id;
        if (typeof id === 'string') onSelectRef.current(id);
      });
      instance.on('click', 'poi-clusters', async (evt) => {
        const feature = evt.features?.[0];
        const clusterId = feature?.properties?.cluster_id;
        if (typeof clusterId !== 'number' || feature?.geometry.type !== 'Point') return;
        const source = instance.getSource(SOURCE) as GeoJSONSource | undefined;
        if (!source) return;
        const zoom = await source.getClusterExpansionZoom(clusterId);
        instance.easeTo({ center: feature.geometry.coordinates as [number, number], zoom });
      });
      for (const layer of ['poi-points', 'poi-clusters']) {
        instance.on('mouseenter', layer, () => { instance.getCanvas().style.cursor = 'pointer'; });
        instance.on('mouseleave', layer, () => { instance.getCanvas().style.cursor = ''; });
      }
    });
    return () => { instance.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    const data = asGeoJSON(places);
    pendingGeoJson.current = data;
    const source = map.current?.getSource(SOURCE) as GeoJSONSource | undefined;
    if (source) void source.setData(data);
  }, [places]);

  useEffect(() => {
    if (active) {
      const handle = requestAnimationFrame(() => map.current?.resize());
      return () => cancelAnimationFrame(handle);
    }
  }, [active]);

  useEffect(() => {
    if (!selected || !map.current) return;
    map.current.flyTo({ center: [selected.longitude, selected.latitude], zoom: Math.max(map.current.getZoom(), 14.5), speed: 1.4 });
  }, [selected?.id]);

  return <div className="poi-map" ref={root} aria-label="Mapa dos pontos de interesse" />;
}
