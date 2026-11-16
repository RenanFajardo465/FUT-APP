-- Move os helpers de autorização (security definer) para fora do schema
-- exposto pela API. As políticas RLS referenciam a função por OID e
-- continuam funcionando.
create schema if not exists private;
grant usage on schema private to authenticated;

alter function public.owns_group(uuid) set schema private;
alter function public.owns_day(uuid) set schema private;

-- Índices para as foreign keys compostas (performance advisor)
create index player_ratings_player_group_idx on public.player_ratings (player_id, group_id);
create index team_members_day_label_idx on public.team_members (match_day_id, label);
