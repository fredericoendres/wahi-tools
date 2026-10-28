# Wahi · Painel interno de POIs

Painel web para administrar a tabela `public.osm_places` do Supabase, em **React + TypeScript + Vite + MapLibre GL JS**. Funciona como site estático no GitHub Pages — **não precisa de servidor próprio**.

## Funcionalidades

- Login via Supabase Auth, autorizado por lista explícita de dois usuários.
- Login por alias `wahi_admin` (convertido para seu e-mail de Supabase Auth), ou diretamente por e-mail.
- Mapa de Florianópolis com clusters de POIs, utilizando OpenFreeMap.
- Busca por nome, subcategoria, endereço e ID OSM.
- Filtros das quatro categorias do Wahi, além de visibilidade.
- Edição de nome, categoria, subcategoria, latitude, longitude, tags JSONB e visibilidade.
- Paginação de leitura (500 POIs por requisição) e lista de 60 locais por página.
- Exportação CSV dos resultados filtrados.
- Responsivo para desktop e celular, mantendo atribuição OSM.

**Limitações:** não existe inclusão/exclusão de objetos OSM no painel. Para lugares manuais sem ID OSM, crie futuramente `custom_places`; não invente IDs OSM. Alterações feitas aqui não são enviadas ao OpenStreetMap e podem ser sobrescritas em futuras importações Geofabrik. O painel não substitui a sincronização do app KMP.

## 1 — Criar dois usuários no Supabase Auth

Entre no projeto Supabase já usado pelo Wahi:

1. `Authentication → Users → Add user` e crie **dois usuários de e-mail/senha**, um para você e outro para seu sócio. Use e-mails reais aos quais cada um tenha acesso. Marque e-mail confirmado quando adequado ao procedimento do Dashboard.
2. Configure senhas **longas, únicas**. A senha simples proposta inicialmente (`admin_wahi`) não deve ser utilizada: ela já foi compartilhada e pode ser adivinhada. Nunca coloque senhas no código, `.env`, GitHub Variables ou na URL do site.
3. Copie o campo **User UID** de cada conta.
4. Desabilite cadastros públicos e habilite MFA para as contas administrativas se estiver disponível no projeto.

**Como funciona o usuário `wahi_admin`:** a tela aceita literalmente esse nome e converte para `VITE_ADMIN_LOGIN_EMAIL`; a senha digitada é validada diretamente pelo Supabase Auth. O alias não é uma conta de banco separada e não autoriza ninguém por si só. Seu sócio pode entrar com o e-mail próprio (ou um segundo alias opcional configurado no ambiente).

## 2 — Executar o SQL de permissões

No **SQL Editor** do projeto Supabase, execute [`sql/01_admin_permissions.sql`](sql/01_admin_permissions.sql).

Em seguida, substitua os UUIDs no comando abaixo e execute no SQL Editor:

```sql
insert into public.wahi_admin_users (user_id, label)
values
  ('SEU_UUID_REAL'::uuid, 'Administrador Wahi'),
  ('UUID_REAL_DO_SOCIO'::uuid, 'Sócio Wahi')
on conflict (user_id) do nothing;
```

O SQL **não apaga nem recria** `osm_places`, não inclui contas na allowlist automaticamente e preserva a leitura pública dos POIs visíveis, necessária ao app KMP.

**Segurança essencial:** `anon` não consegue escrever. Autenticados comuns também não podem editar, pois a política `UPDATE` exige que `auth.uid()` conste em `wahi_admin_users`, tabela na qual o cliente não tem permissão de `INSERT`/`UPDATE`. A fonte da autorização é o banco, não um `if` no React.

Se o schema existente tiver outras políticas permissivas de escrita para `osm_places`, revise-as antes de usar o painel: políticas permissivas de Postgres são combinadas com `OR`.

## 3 — Executar localmente

Instale Node.js 20.19+ ou 22+ e rode:

```bash
npm install
cp .env.example .env.local
```

No PowerShell, substitua `cp` por `Copy-Item`, se necessário.

Abra `.env.local` e preencha:

```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
VITE_ADMIN_LOGIN_EMAIL=seu-email-do-supabase-auth@exemplo.com
VITE_BASE_PATH=/
```

**Somente a URL do projeto e a publishable key ficam no frontend**. A `service_role` / `sb_secret` é proibida. O `.env.local` é ignorado pelo Git.

```bash
npm run dev
npm run build
```

Acesse a URL local indicada pelo Vite. Entre usando `wahi_admin` e sua senha do Supabase Auth.

## 4 — Publicar no GitHub Pages

1. Crie um repositório GitHub (por exemplo, `wahi-poi-admin`) e suba este projeto. Não suba `.env.local`.
2. Em `Settings → Secrets and variables → Actions → Variables`, crie:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `VITE_ADMIN_LOGIN_EMAIL`
   - opcionalmente `VITE_PARTNER_LOGIN_ALIAS` e `VITE_PARTNER_LOGIN_EMAIL`.
3. Em `Settings → Pages → Build and deployment`, selecione **GitHub Actions**.
4. Faça push na branch `main`. O arquivo `.github/workflows/deploy.yml` compilará e publicará automaticamente.
5. URL típica: `https://SEU-USUARIO.github.io/wahi-poi-admin/`.

O workflow injeta `VITE_BASE_PATH=/NOME-DO-REPO/`. Se usar domínio personalizado ou repositório `<usuario>.github.io`, ajuste a variável para `/`.

**Atenção:** GitHub Pages não oferece, por si só, uma página restrita a dois visitantes. A URL pode ser acessada por terceiros, mas o painel só carrega e modifica dados após login autorizado; as restrições reais estão no Supabase Auth e na RLS. Um repositório privado, quando suportado pelo plano, não torna necessariamente a URL publicada privada. Se você precisar restringir até o acesso ao HTML, use Cloudflare Access ou hospedagem com controle de acesso na borda.

## 5 — Testes manuais de segurança

Faça estes testes antes de colocar em uso:

1. `wahi_admin` com senha correta → login e edição funcionam.
2. Conta do sócio cadastrada na allowlist → login e edição funcionam.
3. Conta de Auth fora da allowlist → acesso negado.
4. Sem sessão → o painel não mostra mapa, lista nem controles.
5. `anon` → `SELECT` somente de POIs `is_visible=true`; `UPDATE` deve ser negado.
6. `authenticated` não listado → `UPDATE` negado mesmo se tentar diretamente a API.
7. POI oculto por um admin → desaparece da leitura pública do app KMP, mas continua listado no painel administrativo.
8. Edição de um POI sem alterar o tipo/ID OSM → preserva as chaves e as tags.
9. Confirmar `npm run build` antes de publicar.

## 6 — Sobre atualização de dados

- O painel atualiza `updated_at` a cada edição administrativa.
- Futuras cargas Geofabrik devem ser reconciliadas com alterações manuais. Não sobrescreva indiscriminadamente `name`, `tags`, `category` e coordenadas editados na ferramenta.
- Se passar a usar importação incremental, certifique-se de que o importador respeite `is_visible` e não reative locais ocultos sem revisão.
- Os pontos no mapa vêm da tabela `osm_places`, não de arquivo CSV armazenado no repositório.

## Licenças

Dados dos POIs: [© OpenStreetMap contributors](https://www.openstreetmap.org/copyright), sob ODbL. Mapa-base: [OpenFreeMap](https://openfreemap.org/), sujeito às atribuições incluídas no estilo.
