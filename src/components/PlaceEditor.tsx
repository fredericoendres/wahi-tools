import { useEffect, useState, type FormEvent } from 'react';
import { Check, ExternalLink, Eye, EyeOff, MapPin, Save, X } from 'lucide-react';
import { displayName, niceCategory, RAW_CATEGORIES, type OsmPlace } from '../types';
import type { PoiEditable } from '../lib/data';

interface Props {
  place: OsmPlace;
  busy: boolean;
  onClose: () => void;
  onSave: (changes: PoiEditable) => Promise<void>;
}

export default function PlaceEditor({ place, busy, onClose, onSave }: Props) {
  const [name, setName] = useState(place.name || '');
  const [category, setCategory] = useState(place.category || '');
  const [subcategory, setSubcategory] = useState(place.subcategory || '');
  const [latitude, setLatitude] = useState(String(place.latitude));
  const [longitude, setLongitude] = useState(String(place.longitude));
  const [visible, setVisible] = useState(place.is_visible);
  const [tagsText, setTagsText] = useState(JSON.stringify(place.tags, null, 2));
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    setName(place.name || ''); setCategory(place.category || '');
    setSubcategory(place.subcategory || ''); setLatitude(String(place.latitude));
    setLongitude(String(place.longitude)); setVisible(place.is_visible);
    setTagsText(JSON.stringify(place.tags, null, 2));
    setError(''); setSuccess(false);
  }, [place.id]);

  async function handleSubmit(evt: FormEvent) {
    evt.preventDefault(); setError(''); setSuccess(false);
    try {
      const tags = JSON.parse(tagsText) as Record<string, unknown>;
      if (tags === null || Array.isArray(tags) || typeof tags !== 'object') throw new Error('As tags devem formar um objeto JSON.');
      const lat = Number(latitude);
      const lon = Number(longitude);
      if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lon) || lon < -180 || lon > 180) {
        throw new Error('Coordenadas inválidas.');
      }
      if (!category || !subcategory.trim()) throw new Error('Selecione uma categoria e informe a subcategoria.');
      const cleanName = name.trim() || null;
      const normalizedTags = { ...tags };
      if (cleanName) normalizedTags.name = cleanName;
      else delete normalizedTags.name;
      await onSave({ name: cleanName, category, subcategory: subcategory.trim(), latitude: lat, longitude: lon, tags: normalizedTags, is_visible: visible });
      setTagsText(JSON.stringify(normalizedTags, null, 2));
      setSuccess(true);
    } catch (err) { setError(err instanceof Error ? err.message : 'Falha ao salvar o local.'); }
  }

  return <div className="editor-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <aside className="editor" role="dialog" aria-modal="true" aria-label="Editar POI">
      <div className="editor-header">
        <div><div className="eyebrow">EDITAR LOCAL</div><h2>{displayName(place)}</h2><span className="small-muted">{niceCategory(place.category)} · {place.osm_type}/{place.osm_id}</span></div>
        <button className="icon-btn" type="button" aria-label="Fechar edição" onClick={onClose}><X size={19}/></button>
      </div>
      <form onSubmit={handleSubmit} className="editor-form">
        <div className="section-label">Informações principais</div>
        <label>Nome do local<input value={name} onChange={e => setName(e.target.value)} placeholder="Local sem nome" /></label>
        <div className="form-grid">
          <label>Categoria<select value={category} onChange={e=>setCategory(e.target.value)}>{RAW_CATEGORIES.map(c=><option key={c} value={c}>{niceCategory(c)} ({c})</option>)}</select></label>
          <label>Subcategoria<input value={subcategory} onChange={e=>setSubcategory(e.target.value)} placeholder="RESTAURANT" /></label>
        </div>
        <div className="section-label">Localização</div>
        <div className="form-grid">
          <label>Latitude<input type="number" step="any" value={latitude} onChange={e=>setLatitude(e.target.value)} required /></label>
          <label>Longitude<input type="number" step="any" value={longitude} onChange={e=>setLongitude(e.target.value)} required /></label>
        </div>
        <a className="small-link" href={`https://www.openstreetmap.org/${place.osm_type}/${place.osm_id}`} target="_blank" rel="noopener noreferrer"><MapPin size={14}/> Abrir registro no OpenStreetMap <ExternalLink size={13}/></a>
        <div className="section-label">Visibilidade</div>
        <label className="visibility-control"><span className="visibility-glyph">{visible ? <Eye size={19}/> : <EyeOff size={19}/>}</span><span><strong>{visible ? 'Visível no aplicativo' : 'Oculto no aplicativo'}</strong><small>Desative para não exibir este POI aos hóspedes.</small></span><input type="checkbox" checked={visible} onChange={e=>setVisible(e.target.checked)} /></label>
        <div className="section-label">Tags originais · JSONB</div>
        <label>Metadados OSM<textarea className="json-textarea" rows={9} value={tagsText} spellCheck={false} onChange={e=>setTagsText(e.target.value)} /></label>
        <p className="helper">Ao salvar o nome, a tag <code>name</code> também será atualizada. Importações futuras do OSM podem sobrescrever esses campos; mantenha um processo de reconciliação.</p>
        {error && <div role="alert" className="form-error">{error}</div>}
        {success && <div role="status" className="form-success"><Check size={15}/> Alterações salvas no Supabase.</div>}
        <div className="form-actions"><button type="button" className="button ghost" onClick={onClose}>Cancelar</button><button type="submit" className="button primary" disabled={busy}><Save size={17}/>{busy ? 'Salvando...' : 'Salvar alterações'}</button></div>
      </form>
    </aside>
  </div>;
}
