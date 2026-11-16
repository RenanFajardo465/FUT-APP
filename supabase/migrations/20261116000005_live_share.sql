-- Link público de acompanhamento ao vivo (somente leitura, sem login).
-- Cada jogo do dia tem um token aleatório; quem tem o link vê times, fila,
-- cronômetro, sorteios e resultados. Notas NUNCA são expostas.

alter table public.match_days
  add column if not exists share_token uuid not null default gen_random_uuid();

create unique index if not exists match_days_share_token_idx on public.match_days (share_token);

-- SECURITY DEFINER de propósito: anon não tem acesso às tabelas (RLS). A função
-- devolve só o necessário para a tela ao vivo, filtrado pelo token.
create or replace function public.get_shared_day(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'day', jsonb_build_object(
      'id', d.id,
      'group_id', d.group_id,
      'date', d.date,
      'status', d.status,
      'players_per_team', d.players_per_team,
      'minutes_normal', d.minutes_normal,
      'minutes_crowded', d.minutes_crowded,
      'draw_cycle', d.draw_cycle,
      'version', d.version
    ),
    'group_name', g.name,
    'server_now', now(),
    'attendances', coalesce((
      select jsonb_agg(jsonb_build_object(
        'player_id', a.player_id, 'rsvp', a.rsvp, 'checked_in_at', a.checked_in_at,
        'arrival_order', a.arrival_order, 'is_goalkeeper', a.is_goalkeeper,
        'drawn_in_cycle', a.drawn_in_cycle, 'played', a.played, 'left_at', a.left_at))
      from public.attendances a where a.match_day_id = d.id and a.checked_in_at is not null), '[]'::jsonb),
    'teams', coalesce((
      select jsonb_agg(jsonb_build_object('label', t.label, 'position', t.position, 'streak', t.streak))
      from public.teams t where t.match_day_id = d.id), '[]'::jsonb),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object('player_id', m.player_id, 'label', m.label, 'joined_order', m.joined_order))
      from public.team_members m where m.match_day_id = d.id), '[]'::jsonb),
    'matches', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', x.id, 'seq', x.seq, 'home_label', x.home_label, 'away_label', x.away_label,
        'duration_min', x.duration_min, 'status', x.status, 'started_at', x.started_at,
        'elapsed_ms', x.elapsed_ms, 'winner_label', x.winner_label, 'penalties', x.penalties,
        'score_home', x.score_home, 'score_away', x.score_away))
      from public.matches x where x.match_day_id = d.id), '[]'::jsonb),
    'draws', coalesce((
      select jsonb_agg(jsonb_build_object(
        'draw_no', r.draw_no, 'kind', r.kind, 'match_seq', r.match_seq, 'from_label', r.from_label,
        'to_label', r.to_label, 'cycle', r.cycle, 'candidates', r.candidates, 'picked', r.picked,
        'from_waiting', r.from_waiting, 'undone', r.undone))
      from public.draws r where r.match_day_id = d.id), '[]'::jsonb),
    -- Somente nome e se é goleiro, dos jogadores presentes no dia. Sem notas.
    'players', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'is_goalkeeper', p.is_goalkeeper))
      from public.players p
      where p.id in (select a.player_id from public.attendances a
                     where a.match_day_id = d.id and a.checked_in_at is not null)), '[]'::jsonb)
  )
  from public.match_days d
  join public.groups g on g.id = d.group_id
  where d.share_token = p_token;
$$;

revoke execute on function public.get_shared_day(uuid) from public;
grant execute on function public.get_shared_day(uuid) to anon, authenticated;
