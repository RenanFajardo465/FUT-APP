# Pelada

PWA para gestão de peladas de futebol: check-in por ordem de chegada, sorteio
equilibrado de times, rodízio FIFO, complemento justo de times incompletos e
cronômetro de partida.

**Stack:** Next.js 15 (App Router) + TypeScript + Tailwind v4 · Supabase
(Postgres, Auth, RLS) · Vitest · Vercel.

## Fase 1 (atual): admin

- Login do admin com e-mail e senha ou conta Google
- Grupos (multi-grupo; cada grupo tem um admin), jogadores com nota 1–5 e
  goleiros
- Configuração de N (jogadores de linha por time) e dos tempos (10 / 8 min)
- Jogo do dia: check-in com ordem de chegada, formação de A × B equilibrada,
  C e D por chegada, rodízio (máx. 2 jogos seguidos), complemento por
  atrasados + sorteio justo por ciclos, cronômetro com alerta sonoro e
  vibração, vencedor / pênaltis / placar opcional
- Ajustes: desfazer sorteio, trocar e mover jogadores, reordenar a fila,
  configuração do dia, histórico de sorteios

## Arquitetura

```
src/lib/engine/        Regras de negócio puras (sem React/Supabase) + testes
  day.ts               check-in, formação, rodízio, complemento, ajustes, desfazer
  balance.ts           divisão equilibrada (busca exaustiva da menor diferença de notas)
  fairDraw.ts          sorteio com regra de justiça por ciclos
src/lib/day/
  mapping.ts           linhas do banco ↔ estado do engine (testado em ida e volta)
  repo.ts              carrega o dia e salva via RPC save_day_state
src/app/dia/[dayId]/   Tela "Jogo do dia" (check-in, jogo, ajustes) + server actions
supabase/migrations/   Schema, RLS e funções SQL
```

Toda ação do jogo do dia segue o mesmo caminho: a server action carrega o
estado, aplica a função pura do engine e grava tudo numa transação via
`save_day_state`, com trava otimista (`match_days.version`). O cronômetro
fica no banco (`started_at` + `elapsed_ms`), então sobrevive a reload e
troca de aparelho.

### Segurança (RLS)

- `groups.owner_id = auth.uid()`: o admin só vê os próprios grupos e tudo
  que pertence a eles (funções `owns_group` / `owns_day`).
- As notas ficam em `player_ratings`, uma tabela separada de `players`, pois
  o RLS do Postgres é por linha. Na Fase 2 os jogadores vão poder ler
  `players`, mas nenhuma política dá acesso a `player_ratings`.

## Setup local

Pré-requisitos: Node 20+ e um projeto Supabase.

```bash
npm install
cp .env.example .env.local      # preencha URL e chave publishable do Supabase
```

### Banco de dados

Aplique as migrations de `supabase/migrations/` em ordem. Há duas opções:

- **Supabase CLI:** `npx supabase link --project-ref <ref>` e depois `npx supabase db push`
- **Painel:** SQL Editor → cole e execute cada arquivo, em ordem

### Auth

Em Authentication → URL Configuration, configure:

- **Site URL:** `http://localhost:3000` (em produção, a URL da Vercel)
- **Redirect URLs:** `http://localhost:3000/auth/confirm` e
  `https://<seu-app>.vercel.app/auth/confirm`

**Login com Google:** no [Google Cloud Console](https://console.cloud.google.com/apis/credentials),
crie um *OAuth client ID* do tipo *Web application* com a URI de redirecionamento
autorizada `https://<ref>.supabase.co/auth/v1/callback`. Depois, no Supabase, em
Authentication → Sign In / Providers → Google, ative o provedor e cole o Client ID e o Client Secret.

Por padrão o Supabase exige confirmação de e-mail no cadastro. Para testar
mais rápido, desative em Authentication → Providers → Email → *Confirm email*.

### Rodar

```bash
npm run dev          # http://localhost:3000
npm test             # testes do engine e do mapeamento
npm run typecheck
npm run lint
```

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | sim | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | sim | Chave publishable (`sb_publishable_…`) ou a anon key legada (também aceita como `NEXT_PUBLIC_SUPABASE_ANON_KEY`) |
| `NEXT_PUBLIC_APP_NAME` | não | Nome do app no manifest e no título (padrão `Pelada`) |

## Deploy (Vercel)

1. Importe o repositório do GitHub na Vercel (framework detectado: Next.js).
2. Cadastre as variáveis de ambiente acima.
3. Adicione a URL de produção nas Redirect URLs do Supabase Auth.

## Regras implementadas

Interpretações confirmadas na aprovação do modelo:

1. Após a P1, sai sempre o time que completou 2 jogos seguidos. O resultado só
   decide quem sai quando nenhum dos dois completou 2 (P1, ou depois da fase de
   só 2 times).
2. Quem chega depois da formação entra no time incompleto do fim da fila, ou
   cria C/D. Com 4 times completos, vai para a lista de espera, que tem
   prioridade no próximo complemento.
3. Sorteio justo: no time que saiu, sai primeiro quem ainda não foi sorteado no
   ciclo. O ciclo reinicia quando todos os jogadores de linha presentes já
   foram sorteados.
4. O tempo (≤ 3N → 10 min; > 3N → 8 min) é recalculado a cada check-in, mas só
   para a partida que ainda não começou.
5. O botão de formar A × B aparece com 2N presentes; dá para reduzir o N do dia.
6. Desfazer sorteio restaura o estado anterior e reabre a partida que gerou o
   sorteio (o resultado é registrado de novo). Check-ins feitos depois são
   mantidos. Só é permitido antes da partida seguinte começar.
7. **Saída durante o dia** ("Saiu" no check-in): o jogador sai do time e deixa
   de contar como presente (tempo 10/8 min e ciclo de sorteio), mas o histórico
   fica guardado. Se ele estava num time da fila, o time é completado pela regra
   normal quando entrar. Se estava em campo, o time termina a partida com um a
   menos e, se continuar em campo, é completado no fim dela (primeiro pela
   lista de espera, depois por sorteio no time que saiu). "Voltou" recoloca o
   jogador como uma nova chegada, no fim da ordem.
