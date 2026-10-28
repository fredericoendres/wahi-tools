-- WAHI / PAINEL INTERNO DE POIS
-- Execute uma única vez no Supabase SQL Editor, após revisar.
-- NÃO substitui nem apaga public.osm_places.
-- A edição só poderá ser realizada por usuários explicitamente cadastrados abaixo.

create table if not exists public.wahi_admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  label text,
  created_at timestamptz not null default now()
);

alter table public.wahi_admin_users enable row level security;
revoke all on table public.wahi_admin_users from public, anon, authenticated;
grant select on table public.wahi_admin_users to authenticated;

drop policy if exists "wahi_admin_self_lookup" on public.wahi_admin_users;
create policy "wahi_admin_self_lookup"
on public.wahi_admin_users for select to authenticated
using (user_id = (select auth.uid()));

-- Preserva a consulta pública de POIs visíveis que o app KMP já utiliza.
-- Remove privilégios de escrita genéricos e concede apenas as colunas editáveis
-- para usuários autenticados; RLS restringe a execução à allowlist.
revoke insert, update, delete, truncate on table public.osm_places
from public, anon, authenticated;
grant select on table public.osm_places to anon, authenticated;
grant update (name, category, subcategory, latitude, longitude, tags, is_visible, updated_at)
on table public.osm_places to authenticated;

alter table public.osm_places enable row level security;

drop policy if exists "wahi_admin_read_all_pois" on public.osm_places;
create policy "wahi_admin_read_all_pois"
on public.osm_places for select to authenticated
using (
  (select exists (
    select 1 from public.wahi_admin_users a
    where a.user_id = (select auth.uid())
  ))
);

drop policy if exists "wahi_admin_update_pois" on public.osm_places;
create policy "wahi_admin_update_pois"
on public.osm_places for update to authenticated
using (
  (select exists (
    select 1 from public.wahi_admin_users a
    where a.user_id = (select auth.uid())
  ))
)
with check (
  (select exists (
    select 1 from public.wahi_admin_users a
    where a.user_id = (select auth.uid())
  ))
);

-- PASSO MANUAL: criar os dois usuários em Authentication > Users.
-- Depois copiar seus UUIDs e executar, substituindo os placeholders:
--
-- insert into public.wahi_admin_users (user_id, label)
-- values
--   ('UUID_DO_SEU_USUARIO'::uuid, 'Responsável Wahi'),
--   ('UUID_DO_SOCIO'::uuid, 'Sócio Wahi')
-- on conflict (user_id) do nothing;
--
-- Nunca execute o INSERT com placeholders literais.
-- Não habilitar cadastro aberto de usuários.
