import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  ArrowDownToLine, Check, ChevronDown,
  ChevronLeft, ChevronRight, CircleHelp, Compass, Eye, EyeOff, Filter,
  LayoutDashboard, LoaderCircle, LogOut, Map, MapPin, MapPinned, Pencil,
  RefreshCw, Search, ShieldCheck, SlidersHorizontal, UtensilsCrossed, X,
  BusFront, ShoppingBag, Waves,
} from 'lucide-react';
import type { OsmPlace, PoiGroup } from './types';
import { displayName, GROUPS, groupFor, niceCategory } from './types';
import { supabase } from './lib/supabase';
import { checkIsAdmin, fetchAllPlaces, savePlace, setVisibility, type PoiEditable } from './lib/data';
import Login from './components/Login';
import PoiMap from './components/PoiMap';
import PlaceEditor from './components/PlaceEditor';

const PAGE_SIZE = 60;
type Visibility = 'all' | 'visible' | 'hidden';
const groupIcons: Record<PoiGroup, typeof MapPin> = {
  FOOD: UtensilsCrossed, LEISURE: Waves, SERVICES: ShoppingBag, TRANSPORT: BusFront,
};

function escCsv(value: unknown): string {
  const plain = typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value ?? '');
  // Prevent spreadsheet formula execution in exported CSV.
  const safe = /^[=+@\-\t\r]/.test(plain) ? `'${plain}` : plain;
  return `"${safe.replaceAll('"', '""')}"`;
}
function downloadCsv(places: OsmPlace[]) {
  const cols: (keyof OsmPlace)[] = ['osm_type','osm_id','name','category','subcategory','latitude','longitude','tags','is_visible','osm_snapshot_at'];
  const lines = [cols.join(','), ...places.map(p=>cols.map(key=>escCsv(p[key])).join(','))];
  const blob = new Blob(['\uFEFF', lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'wahi-pois-export.csv';
  a.click(); URL.revokeObjectURL(url);
}

export default function App() {
  const [authorized, setAuthorized] = useState<'checking'|'yes'|'no'>('checking');
  const [loginNotice, setLoginNotice] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [places, setPlaces] = useState<OsmPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string|null>(null);
  const [editingId, setEditingId] = useState<string|null>(null);
  const [search, setSearch] = useState('');
  const [categories, setCategories] = useState<Set<PoiGroup>>(new Set(['FOOD','LEISURE','SERVICES','TRANSPORT']));
  const [visibility, setVisibilityFilter] = useState<Visibility>('all');
  const [page, setPage] = useState(1);
  const [mobileView, setMobileView] = useState<'list'|'map'>('list');
  const [lastFetch, setLastFetch] = useState<Date|null>(null);

  const authorize = useCallback(async () => {
    if (!supabase) { setAuthorized('no'); return; }
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) { setAuthorized('no'); return; }
    const allowed = await checkIsAdmin(data.user.id);
    if (!allowed) {
      await supabase.auth.signOut();
      setLoginNotice('Esta conta não está autorizada. Cadastre seu ID na lista de administradores do Supabase.');
      setAuthorized('no');
      throw Error('Conta sem permissão de administrador.');
    }
    setLoginNotice(''); setUserEmail(data.user.email || 'Administrador'); setAuthorized('yes');
  }, []);

  useEffect(() => {
    if (!supabase) { setAuthorized('no'); return; }
    void authorize().catch(()=>setAuthorized('no'));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') { setAuthorized('no'); setPlaces([]); setSelectedId(null); }
    });
    return () => subscription.unsubscribe();
  }, [authorize]);

  const load = useCallback(async () => {
    setLoading(true); setLoadError(''); setProgress(0);
    try {
      const result = await fetchAllPlaces(setProgress);
      setPlaces(result); setLastFetch(new Date());
    } catch (err) { setLoadError(err instanceof Error ? err.message : 'Falha ao carregar locais.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (authorized === 'yes') void load(); }, [authorized, load]);
  useEffect(() => { setPage(1); }, [search, categories, visibility]);

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR');
    return places.filter(p => {
      const group = groupFor(p.category);
      if (!group || !categories.has(group)) return false;
      if (visibility === 'visible' && !p.is_visible) return false;
      if (visibility === 'hidden' && p.is_visible) return false;
      if (!term) return true;
      const searchable = `${p.name || ''} ${p.category || ''} ${p.subcategory || ''} ${p.tags['addr:suburb'] || ''} ${p.tags['addr:street'] || ''} ${p.osm_id}`.toLocaleLowerCase('pt-BR');
      return searchable.includes(term);
    });
  }, [places, search, categories, visibility]);

  const sorted = useMemo(() => [...filtered].sort((a,b) => displayName(a).localeCompare(displayName(b), 'pt-BR')), [filtered]);
  const listPage = useMemo(() => sorted.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE), [sorted,page]);
  const pages = Math.max(1,Math.ceil(sorted.length/PAGE_SIZE));
  const selected = useMemo(() => places.find(p=>p.id===selectedId)||null, [places,selectedId]);
  const editing = useMemo(() => places.find(p=>p.id===editingId)||null, [places,editingId]);
  const counts = useMemo(() => {
    const result = { FOOD:0, LEISURE:0, SERVICES:0, TRANSPORT:0 };
    places.forEach(p => { const g = groupFor(p.category); if(g) result[g]++; });
    return result;
  }, [places]);

  const upsert = (place: OsmPlace) => setPlaces(prev => prev.map(p=>p.id===place.id?place:p));
  async function save(changes: PoiEditable) {
    if (!editing) return;
    setSaving(true); setSaveError('');
    try { const saved = await savePlace(editing.id, changes); upsert(saved); setSelectedId(saved.id); }
    finally { setSaving(false); }
  }
  async function toggleVisible(place: OsmPlace) {
    setSaveError('');
    try { const result = await setVisibility(place.id, !place.is_visible); upsert(result); }
    catch (err) { setSaveError(err instanceof Error ? err.message : 'Não foi possível mudar a visibilidade.'); }
  }
  function choose(id: string) { setSelectedId(id); }
  async function logout() { await supabase?.auth.signOut(); }
  function setGroup(group: PoiGroup) {
    setCategories(prev => { const copy = new Set(prev); if(copy.has(group))copy.delete(group);else copy.add(group); return copy; });
  }

  if (authorized === 'checking') return <div className="app-boot"><div className="boot-logo">W</div><LoaderCircle className="spin"/><span>Conectando ao Wahi...</span></div>;
  if (authorized === 'no') return <Login onAuthenticated={authorize} notice={loginNotice}/>;

  return <div className="app-layout">
    <aside className="sidebar">
      <div className="sidebar-brand"><div className="brand-small">W</div><div><strong>Wahi</strong><small>GESTÃO INTERNA</small></div></div>
      <div className="sidebar-section-label">WORKSPACE</div>
      <div className="nav-item active"><LayoutDashboard size={18}/> Visão geral</div>
      <div className="nav-item secondary"><MapPinned size={18}/> Pontos de interesse <span className="nav-count">{places.length.toLocaleString('pt-BR')}</span></div>
      <div className="sidebar-section-label second">CATEGORIAS</div>
      <div className="sidebar-categories">
        {GROUPS.map(group=>{
          const Icon=groupIcons[group.key]; const checked=categories.has(group.key);
          return <button key={group.key} className={`sidebar-category ${checked?'checked':''}`} onClick={()=>setGroup(group.key)} aria-pressed={checked}>
            <span className="category-swatch" style={{background:group.color+'24',color:group.color}}><Icon size={16}/></span>
            <span>{group.label}</span><small>{counts[group.key]}</small><span className="category-check">{checked&&<Check size={13}/>}</span>
          </button>;
        })}
      </div>
      <div className="sidebar-bottom"><div className="sidebar-user"><div className="user-avatar">{userEmail.slice(0,1).toUpperCase()}</div><div><strong>Administrador</strong><small title={userEmail}>{userEmail}</small></div></div><button onClick={logout} className="logout"><LogOut size={17}/> Sair</button></div>
    </aside>

    <div className="main-shell">
      <header className="topbar"><div className="topbar-location"><span className="topbar-icon"><Compass size={18}/></span><span>Wahi <ChevronRight size={14}/> <strong>Pontos de interesse</strong></span></div><div className="topbar-right"><span className="security-tag"><ShieldCheck size={15}/> Acesso autorizado</span><button className="button outline compact" onClick={()=>void load()} disabled={loading}><RefreshCw size={15} className={loading?'spin':''}/> <span>Atualizar dados</span></button></div></header>
      <main className="content">
        <div className="page-head"><div><div className="eyebrow">CATÁLOGO GEOGRÁFICO</div><h1>Explore seus <em>lugares.</em></h1><p>Visualize, organize e mantenha os pontos de interesse do Wahi atualizados.</p></div><button className="button outline export-button" onClick={()=>downloadCsv(filtered)} disabled={!places.length}><ArrowDownToLine size={17}/> Exportar CSV</button></div>
        <div className="stat-row">
          <div className="stat"><span>Total de locais</span><strong>{places.length.toLocaleString('pt-BR')}</strong><small><MapPin size={14}/> Florianópolis, SC</small></div>
          <div className="stat"><span>Visíveis no app</span><strong>{places.filter(p=>p.is_visible).length.toLocaleString('pt-BR')}</strong><small><Eye size={14}/> Publicados</small></div>
          <div className="stat"><span>Ocultos</span><strong>{places.filter(p=>!p.is_visible).length.toLocaleString('pt-BR')}</strong><small><EyeOff size={14}/> Fora do mapa</small></div>
          <div className="stat"><span>Última consulta</span><strong className="stat-date">{lastFetch?lastFetch.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):'—'}</strong><small><RefreshCw size={13}/> Sincronizado do Supabase</small></div>
        </div>
        {loadError && <div className="error-banner" role="alert"><CircleHelp size={18}/><span>Não foi possível carregar todos os locais: {loadError}</span><button className="button outline compact" onClick={()=>void load()}>Tentar novamente</button></div>}
        {saveError && <div className="error-banner" role="alert"><CircleHelp size={18}/><span>{saveError}</span><button className="icon-btn" onClick={()=>setSaveError('')}><X size={16}/></button></div>}
        <div className="explorer-head"><div className="explorer-title"><h2>Todos os pontos</h2><span>{filtered.length.toLocaleString('pt-BR')} resultados</span></div><div className="explorer-controls"><div className="search-box"><Search size={17}/><input aria-label="Buscar pontos de interesse" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por nome, rua, ID..." />{search&&<button className="clear-search" aria-label="Limpar busca" onClick={()=>setSearch('')}><X size={15}/></button>}</div><div className="select-wrap"><SlidersHorizontal size={15}/><select aria-label="Filtrar visibilidade" value={visibility} onChange={e=>setVisibilityFilter(e.target.value as Visibility)}><option value="all">Todos</option><option value="visible">Visíveis</option><option value="hidden">Ocultos</option></select><ChevronDown size={13}/></div></div></div>
        <div className="mobile-tabs"><button className={mobileView==='list'?'active':''} onClick={()=>setMobileView('list')}><Filter size={16}/> Lista</button><button className={mobileView==='map'?'active':''} onClick={()=>setMobileView('map')}><Map size={16}/> Mapa</button></div>
        <div className="mobile-category-chips">{GROUPS.map(g=><button key={g.key} className={categories.has(g.key)?'active':''} onClick={()=>setGroup(g.key)} style={{'--chip-color':g.color} as CSSProperties}>{g.label}</button>)}</div>
        <div className="workspace">
          <section className={`places-panel ${mobileView==='map'?'mobile-hidden':''}`} aria-label="Lista de POIs">
            <div className="places-heading"><span>ESTABELECIMENTOS</span><span>{loading&&<><LoaderCircle className="spin" size={14}/> {progress.toLocaleString('pt-BR')}...</>}</span></div>
            <div className="places-list">
              {listPage.length===0&&!loading&&<div className="empty-state"><Search size={28}/><h3>Nenhum lugar encontrado</h3><p>Tente mudar o filtro ou o termo da busca.</p></div>}
              {listPage.map(p=>{
                const group=groupFor(p.category);const cfg=GROUPS.find(g=>g.key===group);
                return <div key={p.id} className={`place-row ${selectedId===p.id?'selected':''}`}>
                  <button className="place-select" onClick={()=>choose(p.id)}>
                    <span className="place-dot" style={{background:cfg?.color||'#789'}}/>
                    <span className="place-descriptions"><strong>{displayName(p)}</strong><small>{niceCategory(p.category)} · {p.subcategory?.replaceAll('_',' ') || '—'}</small></span>
                  </button>
                  <span className={`visible-dot ${p.is_visible?'on':'off'}`} title={p.is_visible?'Visível':'Oculto'}/>
                  <button className="mini-edit" aria-label={`Editar ${displayName(p)}`} title="Editar POI" onClick={()=>{setSelectedId(p.id);setEditingId(p.id);}}><Pencil size={16}/></button>
                </div>;
              })}
            </div>
            <div className="list-bottom"><span>{sorted.length?`${(page-1)*PAGE_SIZE+1}–${Math.min(page*PAGE_SIZE,sorted.length)}`:'0'} de {sorted.length.toLocaleString('pt-BR')}</span><div><button aria-label="Página anterior" disabled={page<=1} onClick={()=>setPage(v=>v-1)}><ChevronLeft size={17}/></button><span>{page} / {pages}</span><button aria-label="Próxima página" disabled={page>=pages} onClick={()=>setPage(v=>v+1)}><ChevronRight size={17}/></button></div></div>
          </section>
          <section className={`map-panel ${mobileView==='list'?'mobile-hidden':''}`} aria-label="Mapa de POIs"><PoiMap places={filtered} selected={selected} onSelect={choose} active={mobileView==='map'}/><div className="map-info"><MapPin size={15}/><span>{filtered.length.toLocaleString('pt-BR')} locais no mapa</span></div>{selected&&<div className="map-selection"><button className="map-selection-close" onClick={()=>setSelectedId(null)} aria-label="Fechar seleção"><X size={15}/></button><small>{niceCategory(selected.category)}</small><strong>{displayName(selected)}</strong><span>{selected.osm_type}/{selected.osm_id} · {selected.is_visible?'Visível':'Oculto'}</span><div className="map-selection-buttons"><button className="button primary compact" onClick={()=>setEditingId(selected.id)}><Pencil size={14}/> Editar</button><button className="button outline compact" onClick={()=>void toggleVisible(selected)}>{selected.is_visible?<EyeOff size={14}/>:<Eye size={14}/>} {selected.is_visible?'Ocultar':'Mostrar'}</button></div></div>}</section>
        </div>
        <footer className="site-footer"><span>Wahi Admin · Dados © OpenStreetMap contributors (ODbL)</span><span>Feito para explorar melhor Florianópolis</span></footer>
      </main>
    </div>
    {editing&&<PlaceEditor place={editing} busy={saving} onClose={()=>setEditingId(null)} onSave={save}/>}
  </div>;
}
