Você é um engenheiro full-stack sênior. Desenvolva um PWA de gestão de peladas
de futebol, inspirado no app Apitto, em fases incrementais (do simples ao complexo).
Entregue cada fase funcionando e testada antes de começar a próxima.

## Stack
- Front-end: Next.js (App Router) + TypeScript + Tailwind, como PWA instalável,
  responsivo e mobile-first. Não precisa funcionar offline.
- Back-end/BD/Auth: Supabase (Postgres + Auth + Row Level Security)
- Versionamento: GitHub
- Hospedagem: Vercel
- Use as conexões/CLIs de Supabase e Vercel disponíveis para criar o projeto,
  aplicar as migrations e fazer o deploy.
- Nome provisório do app: "Pelada" (configurável no manifest).

## Perfis e grupos
- Admin: pode ter vários grupos. Cada grupo tem um único admin.
- Jogador: entra no grupo por um link de convite enviado pelo admin.
- Estruture os dados como multi-grupo (multi-tenant) desde o início: o app
  pode virar produto comercial no futuro.

## Regras de negócio

### 1. Jogadores e presença
- Nota do jogador: inteiro de 1 a 5, definida pelo admin e visível só para ele.
- Presença (as duas formas coexistem):
  a. Antes do jogo, o jogador pode confirmar "vou / não vou" pelo app.
  b. No dia, o admin faz o check-in de cada jogador conforme ele chega.
     O sistema registra a ORDEM DE CHEGADA, que é a base de toda prioridade.
     Só quem fez check-in participa.
- O check-in fica aberto durante todo o jogo.
- Goleiros: fixos, fora dos times, do equilíbrio e do rodízio.

### 2. Formação dos times (por ordem de chegada)
- O admin define N = jogadores de linha por time (normalmente 5 ou 6).
- Times A e B: assim que 2N jogadores tiverem feito check-in, o admin gera
  A e B por sorteio equilibrado (soma das notas próxima), apenas entre
  esses 2N primeiros. Não há rebalanceamento depois.
- Quem chega depois forma o 3º time (C), depois o 4º (D), por ordem de chegada
  e sem equilíbrio por nota. Um time em formação com menos de N jogadores fica
  incompleto no fim da fila.
- Máximo de 4 times.
- Ex.: 15 jogadores, N=6 → A e B (os 12 primeiros, equilibrados), C (13º ao 15º, incompleto).

### 3. Rodízio das partidas (fila FIFO)
- Partida 1: A × B. O perdedor sai e o vencedor fica. Em caso de empate,
  a disputa é nos pênaltis e o admin registra quem venceu.
- A partir daí, todo time joga no máximo 2 partidas seguidas e sai,
  independentemente do resultado. Quem sai vai para o fim da fila.
  O próximo da fila entra.
- Ex. com 3 times: P1 A×B (A vence, B sai) → P2 A×C (A completou 2, sai)
  → P3 B×C (C completou 2, sai) → P4 A×B (B completou 2, sai) → ...
- A mesma lógica vale para 4 times.
- Caso de só 2 times sem sobra: não há rodízio. Os times só são equilibrados no início.

### 4. Completar o time incompleto
Quando um time sai e o próximo da fila está incompleto, as vagas são
preenchidas nesta ordem de prioridade:
  1º Jogadores que chegaram atrasados e ainda não jogaram, por ordem de chegada.
  2º Sorteio entre os jogadores do time que acabou de sair, com a regra de justiça:
     - quem já foi sorteado não é sorteado de novo enquanto houver candidatos
       ainda não sorteados no ciclo;
     - quando todos os presentes já tiverem sido sorteados uma vez, o ciclo
       reinicia e o sorteio volta a ser aleatório.
- Quem entra no time passa a fazer parte dele de vez.
- Os não sorteados do time que saiu formam o novo time incompleto no fim da fila.
- Se todos os times estiverem completos, não há complemento, só o rodízio.
- Guarde o histórico de sorteios do dia.
- Objetivo: todos jogam o mesmo tempo.

### 5. Tempo de partida (independente de gols)
- Total de jogadores de linha presentes ≤ 3N → 10 minutos.
- Total de jogadores de linha presentes > 3N (ex.: 3 times + 1) → 8 minutos.
- Recalcule automaticamente conforme novos check-ins. Tempos configuráveis
  pelo admin, com esses valores como padrão.
- Tela de jogo com cronômetro (iniciar, pausar, encerrar) e alerta
  sonoro/vibração no fim.

### 6. Ajustes manuais
- O admin pode desfazer um sorteio, trocar jogadores entre times
  e editar a ordem da fila.

## Fases
- Fase 1 (MVP, foco do admin): login do admin, CRUD de grupos e jogadores
  com nota, configuração de N e dos tempos, check-in com ordem de chegada,
  formação dos times, rodízio, complemento de times, cronômetro, registro do
  vencedor/pênaltis (placar opcional) e ajustes manuais.
  Uma tela "Jogo do dia" mostra o time em campo, a fila, quem joga a seguir
  e o cronômetro.
- Fase 2 (jogador): link de convite, cadastro/login do jogador, confirmação
  "vou / não vou", visualização dos times e da fila do dia.
- Fase 3 (futuro/comercial, não implementar agora): estatísticas, ranking,
  posições, cobrança/mensalidade, incentivos.

## Entregáveis em cada fase
- Migrations SQL do Supabase com políticas RLS (admin só vê os próprios grupos;
  jogador não vê notas)
- Lógica de formação, equilíbrio, rodízio e sorteio em módulos puros, separados da UI
- Testes unitários dessa lógica, cobrindo: sobra 0, sobra 1, sobra N-1,
  3 e 4 times, empate com pênaltis, chegada atrasada, troca de 10→8 min
  e vários ciclos de sorteio
- README com setup local e variáveis de ambiente
- Deploy na Vercel

Comece pela Fase 1. Antes de escrever código, apresente o modelo de dados
e o fluxo das telas para minha aprovação.
