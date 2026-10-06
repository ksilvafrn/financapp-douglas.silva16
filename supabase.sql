-- FinancApp: schema inicial para executar no Supabase SQL Editor.
--
-- ATENCAO: as politicas anonimas abaixo permitem acesso amplo aos dados,
-- inclusive leitura da tabela usuarios, que atualmente armazena senha.
-- Use somente para testes/demonstracao, nunca com dados pessoais reais.

create table if not exists public.usuarios (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  turma text not null,
  usuario text not null unique,
  senha text not null,
  foto_url text,
  criado_em timestamptz not null default now()
);

create table if not exists public.lancamentos (
  id uuid primary key default gen_random_uuid(),
  autor_id uuid not null references public.usuarios(id) on delete cascade,
  descricao text not null,
  valor numeric(12, 2) not null check (valor > 0),
  tipo text not null check (tipo in ('receita', 'despesa')),
  criado_em timestamptz not null default now()
);

create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique
);

create table if not exists public.lancamento_tags (
  lancamento_id uuid not null
    references public.lancamentos(id) on delete cascade,
  tag_id uuid not null
    references public.tags(id) on delete cascade,
  primary key (lancamento_id, tag_id)
);

create index if not exists lancamentos_autor_criado_idx
  on public.lancamentos (autor_id, criado_em desc);

alter table public.usuarios enable row level security;
alter table public.lancamentos enable row level security;
alter table public.tags enable row level security;
alter table public.lancamento_tags enable row level security;

grant usage on schema public to anon;
grant select, insert on public.usuarios to anon;
grant select, insert, update, delete on public.lancamentos to anon;
grant select, insert on public.tags to anon;
grant select, insert on public.lancamento_tags to anon;

drop policy if exists "Acesso anonimo a usuarios" on public.usuarios;
create policy "Acesso anonimo a usuarios"
  on public.usuarios
  for all
  to anon
  using (true)
  with check (true);

drop policy if exists "Acesso anonimo a lancamentos" on public.lancamentos;
create policy "Acesso anonimo a lancamentos"
  on public.lancamentos
  for all
  to anon
  using (true)
  with check (true);

drop policy if exists "Acesso anonimo a tags" on public.tags;
create policy "Acesso anonimo a tags"
  on public.tags
  for all
  to anon
  using (true)
  with check (true);

drop policy if exists "Acesso anonimo a lancamento_tags"
  on public.lancamento_tags;
create policy "Acesso anonimo a lancamento_tags"
  on public.lancamento_tags
  for all
  to anon
  using (true)
  with check (true);
