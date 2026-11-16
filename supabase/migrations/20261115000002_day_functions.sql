-- Persistência atômica do estado do dia calculado pelo engine (src/lib/engine)
-- e controle do cronômetro. Ambas rodam como SECURITY INVOKER: o RLS vale.

create or replace function public.save_day_state(p_day uuid, p_version int, p_state jsonb)
returns int
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_group uuid;
  v_version int;
begin
  select d.group_id, d.version into v_group, v_version
  from public.match_days d
  where d.id = p_day
  for update;

  if v_group is null then
    raise exception 'Dia não encontrado' using errcode = 'P0002';
  end if;
  if v_version <> p_version then
    raise exception 'O jogo foi alterado em outro lugar. Recarregue a página.' using errcode = '40001';
  end if;

  -- Todos os jogadores precisam ser do grupo do dia.
  if exists (
    select 1
    from jsonb_array_elements(p_state -> 'arrivals') a
    left join public.players p on p.id = (a ->> 'player_id')::uuid and p.group_id = v_group
    where p.id is null
  ) then
    raise exception 'Jogador não pertence ao grupo' using errcode = '23503';
  end if;

  update public.match_days
  set draw_cycle = (p_state ->> 'draw_cycle')::int,
      players_per_team = coalesce((p_state ->> 'players_per_team')::int, players_per_team),
      minutes_normal = coalesce((p_state ->> 'minutes_normal')::int, minutes_normal),
      minutes_crowded = coalesce((p_state ->> 'minutes_crowded')::int, minutes_crowded),
      version = version + 1
  where id = p_day;

  -- Presenças: quem não está mais na lista perde o check-in (RSVP é mantido).
  update public.attendances at
  set checked_in_at = null, arrival_order = null, drawn_in_cycle = false, played = false
  where at.match_day_id = p_day
    and at.checked_in_at is not null
    and at.player_id not in (
      select (a ->> 'player_id')::uuid from jsonb_array_elements(p_state -> 'arrivals') a
    );

  insert into public.attendances
    (match_day_id, player_id, checked_in_at, arrival_order, is_goalkeeper, drawn_in_cycle, played)
  select p_day,
         (a ->> 'player_id')::uuid,
         now(),
         (a ->> 'order')::int,
         (a ->> 'is_goalkeeper')::boolean,
         (a ->> 'drawn')::boolean,
         (a ->> 'played')::boolean
  from jsonb_array_elements(p_state -> 'arrivals') a
  on conflict (match_day_id, player_id) do update
  set checked_in_at = coalesce(public.attendances.checked_in_at, excluded.checked_in_at),
      arrival_order = excluded.arrival_order,
      is_goalkeeper = excluded.is_goalkeeper,
      drawn_in_cycle = excluded.drawn_in_cycle,
      played = excluded.played;

  -- Times e integrantes: regravados por completo.
  delete from public.teams where match_day_id = p_day;

  insert into public.teams (match_day_id, label, position, streak)
  select p_day, t ->> 'label', (t ->> 'position')::int, (t ->> 'streak')::int
  from jsonb_array_elements(p_state -> 'teams') t;

  insert into public.team_members (match_day_id, player_id, label, joined_order)
  select p_day, m.value::uuid, t ->> 'label', m.ordinality::int
  from jsonb_array_elements(p_state -> 'teams') t,
       jsonb_array_elements_text(t -> 'members') with ordinality m;

  -- Partidas: upsert por seq; o cronômetro é preservado.
  delete from public.matches
  where match_day_id = p_day
    and seq not in (select (m ->> 'seq')::int from jsonb_array_elements(p_state -> 'matches') m);

  insert into public.matches
    (match_day_id, seq, home_label, away_label, duration_min, winner_label, penalties,
     score_home, score_away, status, finished_at)
  select p_day,
         (m ->> 'seq')::int,
         m ->> 'home',
         m ->> 'away',
         (m ->> 'duration_min')::int,
         m ->> 'winner',
         coalesce((m ->> 'penalties')::boolean, false),
         (m ->> 'score_home')::int,
         (m ->> 'score_away')::int,
         case when m ->> 'winner' is null then 'pending' else 'finished' end,
         case when m ->> 'winner' is null then null else now() end
  from jsonb_array_elements(p_state -> 'matches') m
  on conflict (match_day_id, seq) do update
  set home_label = excluded.home_label,
      away_label = excluded.away_label,
      duration_min = excluded.duration_min,
      winner_label = excluded.winner_label,
      penalties = excluded.penalties,
      score_home = excluded.score_home,
      score_away = excluded.score_away,
      status = case
        when excluded.winner_label is not null then 'finished'
        when public.matches.status = 'finished' then 'paused' -- reaberta por "desfazer"
        else public.matches.status
      end,
      started_at = case when excluded.winner_label is not null then null else public.matches.started_at end,
      elapsed_ms = case
        when excluded.winner_label is not null and public.matches.status = 'running'
          then public.matches.elapsed_ms
               + (extract(epoch from now() - public.matches.started_at) * 1000)::bigint
        else public.matches.elapsed_ms
      end,
      finished_at = case
        when excluded.winner_label is not null then coalesce(public.matches.finished_at, now())
        else null
      end;

  -- Histórico de sorteios: insere novos e atualiza "desfeito".
  insert into public.draws
    (match_day_id, draw_no, kind, match_seq, from_label, to_label, cycle,
     candidates, picked, from_waiting, undone, snapshot_before)
  select p_day,
         (d ->> 'draw_no')::int,
         d ->> 'kind',
         (d ->> 'match_seq')::int,
         d ->> 'from',
         d ->> 'to',
         (d ->> 'cycle')::int,
         array(select jsonb_array_elements_text(d -> 'candidates'))::uuid[],
         array(select jsonb_array_elements_text(d -> 'picked'))::uuid[],
         array(select jsonb_array_elements_text(d -> 'from_waiting'))::uuid[],
         (d ->> 'undone')::boolean,
         d -> 'snapshot'
  from jsonb_array_elements(p_state -> 'draws') d
  on conflict (match_day_id, draw_no) do update
  set undone = excluded.undone;

  return v_version + 1;
end;
$$;

-- Cronômetro: start | pause | reset. Retorna a partida e o relógio do servidor.
create or replace function public.match_timer(p_match uuid, p_action text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  m public.matches;
begin
  select * into m from public.matches where id = p_match for update;
  if m.id is null then
    raise exception 'Partida não encontrada' using errcode = 'P0002';
  end if;
  if m.status = 'finished' then
    raise exception 'Partida já encerrada' using errcode = '22023';
  end if;

  if p_action = 'start' and m.status <> 'running' then
    update public.matches set status = 'running', started_at = now() where id = p_match;
  elsif p_action = 'pause' and m.status = 'running' then
    update public.matches
    set status = 'paused',
        elapsed_ms = elapsed_ms + (extract(epoch from now() - started_at) * 1000)::bigint,
        started_at = null
    where id = p_match;
  elsif p_action = 'reset' then
    update public.matches
    set status = 'pending', elapsed_ms = 0, started_at = null
    where id = p_match;
  elsif p_action not in ('start', 'pause') then
    raise exception 'Ação inválida: %', p_action using errcode = '22023';
  end if;

  select * into m from public.matches where id = p_match;
  return jsonb_build_object('match', to_jsonb(m), 'server_now', now());
end;
$$;

revoke execute on function public.save_day_state(uuid, int, jsonb) from public, anon;
revoke execute on function public.match_timer(uuid, text) from public, anon;
grant execute on function public.save_day_state(uuid, int, jsonb) to authenticated;
grant execute on function public.match_timer(uuid, text) to authenticated;
