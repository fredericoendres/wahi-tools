import { useState, type FormEvent } from 'react';
import { ArrowRight, Eye, EyeOff, LockKeyhole, MapPinned } from 'lucide-react';
import { configured, loginEmail, supabase } from '../lib/supabase';

interface Props { onAuthenticated: () => Promise<void>; notice?: string }

export default function Login({ onAuthenticated, notice }: Props) {
  const [username, setUsername] = useState('wahi_admin');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault(); if (!supabase) return;
    setBusy(true); setError('');
    const email = loginEmail(username);
    if (!email || !email.includes('@')) { setError('Configure VITE_ADMIN_LOGIN_EMAIL no arquivo .env.local.'); setBusy(false); return; }
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw new Error('Usuário ou senha inválidos.');
      await onAuthenticated();
    } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível entrar.'); }
    finally { setBusy(false); }
  }

  return <main className="login-screen">
    <div className="login-pattern" aria-hidden="true"><div className="orb one"/><div className="orb two"/></div>
    <div className="login-card">
      <div className="brand-mark"><MapPinned size={28} strokeWidth={2.1}/></div>
      <div className="login-heading"><div className="eyebrow">PAINEL INTERNO</div><h1>Bem-vindo ao <em>Wahi.</em></h1><p>Gerencie os lugares que fazem parte da experiência dos hóspedes.</p></div>
      {notice && <div className="form-error" role="alert">{notice}</div>}
      {!configured && <div className="form-error" role="alert">Supabase não configurado. Copie .env.example para .env.local e preencha os dados públicos do projeto.</div>}
      <form onSubmit={submit} className="login-form">
        <label>Usuário ou e-mail<input autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} placeholder="wahi_admin" disabled={!configured}/></label>
        <label>Senha<div className="password-wrap"><input autoComplete="current-password" type={visible ? 'text' : 'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Sua senha de acesso" disabled={!configured}/><button type="button" className="password-toggle" onClick={()=>setVisible(x=>!x)} aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}>{visible ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></label>
        {error && <div role="alert" className="form-error">{error}</div>}
        <button className="button primary login-submit" type="submit" disabled={!configured || busy}>{busy ? 'Entrando...' : 'Entrar no painel'}<ArrowRight size={18}/></button>
      </form>
      <div className="login-footer"><LockKeyhole size={15}/> Acesso restrito à equipe autorizada.</div>
    </div>
    <p className="login-copyright">Wahi · Gestão de pontos de interesse</p>
  </main>;
}
