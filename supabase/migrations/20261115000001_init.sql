-- Pelada — Fase 1: schema multi-grupo com RLS
-- Todo dado pertence a um grupo; o dono do grupo (admin) é groups.owner_id.

-- ---------------------------------------------------------------------------
-- Perfis
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Grupos, jogadores, notas
-- ---------------------------------------------------------------------------
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  players_per_team int not null default 6 check (players_per_team between 2 and 11),
  minutes_normal int not null default 10 check (minutes_normal between 1 and 90),
  minutes_crowded int not null default 8 check (minutes_crowded between 1 and 90),
  created_at timestamptz not null default now()
);
create index groups_owner_idx on public.groups (owner_id);

create table public.players (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  is_goalkeeper boolean not null default false,
  active boolean not null default true,
  user_id uuid references auth.users (id) on delete set null, -- Fase 2
  created_at timestamptz not null default now(),
  unique (id, group_id)
);
create index players_group_idx on public.players (group_id);
create index players_user_idx on public.players (user_id);

-- Nota separada de players: o RLS do Postgres é por linha, não por coluna.
-- Jogadores (Fase 2) poderão ler players, mas nunca esta tabela.
create table public.player_ratings (
  player_id uuid primary key,
  group_id uuid not null references public.groups (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  updated_at timestamptz not null default now(),
  foreign key (player_id, group_id) references public.players (id, group_id) on delete cascade
);
create index player_ratings_group_idx on public.player_ratings (group_id);

-- ---------------------------------------------------------------------------
-- Jogo do dia
-- ---------------------------------------------------------------------------
create table public.match_days (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  date date not null default current_date,
  status text not null default 'open' check (status in ('open', 'closed')),
  players_per_team int not null check (players_per_team between 2 and 11),
  minutes_normal int not null check (minutes_normal between 1 and 90),
  minutes_crowded int not null check (minutes_crowded between 1 and 90),
  draw_cycle int not null default 1,
  version int not null default 0, -- trava otimista para save_day_state
  created_at timestamptz not null default now()
);
create index match_days_group_idx on public.match_days (group_id, date desc);

create table public.attendances (
  id uuid primary key default gen_random_uuid(),
  match_day_id uuid not null references public.match_days (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  rsvp text check (rsvp in ('going', 'not_going')), -- Fase 2
  checked_in_at timestamptz,
  arrival_order int,
  is_goalkeeper boolean not null default false,
  drawn_in_cycle boolean not null default false,
  played boolean not null default false,
  unique (match_day_id, player_id),
  constraint attendances_order_unique unique (match_day_id, arrival_order) deferrable initially deferred
);
create index attendances_player_idx on public.attendances (player_id);

create table public.teams (
  match_day_id uuid not null references public.match_days (id) on delete cascade,
  label text not null check (label in ('A', 'B', 'C', 'D')),
  -- 0 = mandante em campo, 1 = visitante em campo, 2+ = posição na fila
  position int not null,
  streak int not null default 0,
  primary key (match_day_id, label)
);

create table public.team_members (
  match_day_id uuid not null,
  player_id uuid not null references public.players (id) on delete cascade,
  label text not null,
  joined_order int not null,
  primary key (match_day_id, player_id),
  foreign key (match_day_id, label) references public.teams (match_day_id, label) on delete cascade
);
create index team_members_player_idx on public.team_members (player_id);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  match_day_id uuid not null references public.match_days (id) on delete cascade,
  seq int not null,
  home_label text not null,
  away_label text not null,
  duration_min int not null,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'paused', 'finished')),
  started_at timestamptz, -- início do trecho corrente (quando running)
  elapsed_ms bigint not null default 0, -- tempo acumulado dos trechos anteriores
  winner_label text,
  penalties boolean not null default false,
  score_home int check (score_home >= 0),
  score_away int check (score_away >= 0),
  finished_at timestamptz,
  unique (match_day_id, seq)
);

create table public.draws (
  id uuid primary key default gen_random_uuid(),
  match_day_id uuid not null references public.match_days (id) on delete cascade,
  draw_no int not null,
  kind text not null check (kind in ('formation', 'completion')),
  match_seq int,
  from_label text,
  to_label text,
  cycle int not null,
  candidates uuid[] not null default '{}',
  picked uuid[] not null default '{}',
  from_waiting uuid[] not null default '{}',
  undone boolean not null default false,
  snapshot_before jsonb not null,
  created_at timestamptz not null default now(),
  unique (match_day_id, draw_no)
);

-- ---------------------------------------------------------------------------
-- Funções de autorização (security definer evita recursão de RLS)
-- ---------------------------------------------------------------------------
create or replace function public.owns_group(p_group uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.groups g where g.id = p_group and g.owner_id = (select auth.uid())
  );
$$;

create or replace function public.owns_day(p_day uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.match_days d
    join public.groups g on g.id = d.group_id
    where d.id = p_day and g.owner_id = (select auth.uid())
  );
$$;

revoke execute on function public.owns_group(uuid) from public, anon;
revoke execute on function public.owns_day(uuid) from public, anon;
grant execute on function public.owns_group(uuid) to authenticated;
grant execute on function public.owns_day(uuid) to authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.players enable row level security;
alter table public.player_ratings enable row level security;
alter table public.match_days enable row level security;
alter table public.attendances enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.matches enable row level security;
alter table public.draws enable row level security;

create policy "profile: self read" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profile: self update" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "groups: owner all" on public.groups
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "players: owner all" on public.players
  for all to authenticated
  using ((select public.owns_group(group_id)))
  with check ((select public.owns_group(group_id)));

-- Notas: SOMENTE o admin do grupo. Nenhuma política para jogadores.
create policy "ratings: owner all" on public.player_ratings
  for all to authenticated
  using ((select public.owns_group(group_id)))
  with check ((select public.owns_group(group_id)));

create policy "match_days: owner all" on public.match_days
  for all to authenticated
  using ((select public.owns_group(group_id)))
  with check ((select public.owns_group(group_id)));

create policy "attendances: owner all" on public.attendances
  for all to authenticated
  using ((select public.owns_day(match_day_id)))
  with check ((select public.owns_day(match_day_id)));

create policy "teams: owner all" on public.teams
  for all to authenticated
  using ((select public.owns_day(match_day_id)))
  with check ((select public.owns_day(match_day_id)));

create policy "team_members: owner all" on public.team_members
  for all to authenticated
  using ((select public.owns_day(match_day_id)))
  with check ((select public.owns_day(match_day_id)));

create policy "matches: owner all" on public.matches
  for all to authenticated
  using ((select public.owns_day(match_day_id)))
  with check ((select public.owns_day(match_day_id)));

create policy "draws: owner all" on public.draws
  for all to authenticated
  using ((select public.owns_day(match_day_id)))
  with check ((select public.owns_day(match_day_id)));
