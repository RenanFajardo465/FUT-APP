-- Play no cronômetro pelo link público /ao-vivo/<token>.
-- Só inicia/retoma; pausar, encerrar e zerar seguem exclusivos do admin.
-- Concorrência: o UPDATE só afeta a partida se ela NÃO estiver rodando; dois
-- plays simultâneos disputam o lock da linha e o segundo vira no-op, então só
-- o primeiro play conta.
create or replace function public.shared_start_timer(p_token uuid, p_seq int)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_day uuid;
  v_match public.matches;
  v_started boolean := false;
begin
  select d.id into v_day
  from public.match_days d
  where d.share_token = p_token and d.status = 'open';
  if v_day is null then
    raise exception 'Jogo não encontrado ou encerrado' using errcode = 'P0002';
  end if;

  -- A partida em aberto precisa ser a que o celular estava vendo (evita
  -- iniciar a partida seguinte a partir de uma tela desatualizada).
  update public.matches m
  set status = 'running', started_at = now()
  where m.match_day_id = v_day
    and m.seq = p_seq
    and m.status in ('pending', 'paused')
  returning * into v_match;
  v_started := v_match.id is not null;

  if not v_started then
    select * into v_match
    from public.matches m
    where m.match_day_id = v_day and m.seq = p_seq;
  end if;

  return jsonb_build_object(
    'started', v_started,
    'match', case when v_match.id is null then null else jsonb_build_object(
      'seq', v_match.seq,
      'status', v_match.status,
      'started_at', v_match.started_at,
      'elapsed_ms', v_match.elapsed_ms,
      'duration_min', v_match.duration_min) end,
    'server_now', now()
  );
end;
$$;

revoke execute on function public.shared_start_timer(uuid, int) from public;
grant execute on function public.shared_start_timer(uuid, int) to anon, authenticated;
