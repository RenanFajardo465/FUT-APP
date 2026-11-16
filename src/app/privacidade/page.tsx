import { LegalPage } from "@/components/LegalPage";
import { APP_NAME, CONTACT_EMAIL } from "@/lib/app-config";

export const metadata = { title: "Política de Privacidade" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Política de Privacidade" updated="15 de novembro de 2026">
      <p>
        Esta política explica quais dados o {APP_NAME} coleta, como eles são usados e quais são os seus direitos, em
        conformidade com a Lei Geral de Proteção de Dados (Lei 13.709/2018).
      </p>

      <h2>Dados que coletamos</h2>
      <ul>
        <li>
          <b>Conta:</b> nome e e-mail informados no cadastro ou fornecidos pelo Google quando você entra com sua conta
          Google (nome, e-mail e foto de perfil). Não temos acesso à sua senha do Google.
        </li>
        <li>
          <b>Dados do grupo:</b> nomes dos jogadores, notas de habilidade (1 a 5), presença e ordem de chegada, times,
          resultados e histórico de sorteios, cadastrados pelo administrador do grupo.
        </li>
        <li>
          <b>Dados técnicos:</b> cookies estritamente necessários para manter sua sessão ativa.
        </li>
      </ul>

      <h2>Como usamos</h2>
      <ul>
        <li>Autenticar você e manter sua sessão.</li>
        <li>Organizar as partidas: check-in, formação de times, rodízio e cronômetro.</li>
      </ul>
      <p>
        Não vendemos, não alugamos e não usamos seus dados para publicidade. As notas dos jogadores são visíveis apenas
        para o administrador do grupo.
      </p>

      <h2>Onde ficam armazenados</h2>
      <p>
        Os dados ficam no Supabase (banco de dados e autenticação) e o aplicativo é hospedado na Vercel. Cada grupo só é
        acessível pelo seu administrador, com controle de acesso aplicado no próprio banco de dados.
      </p>

      <h2>Seus direitos</h2>
      <p>
        Você pode pedir acesso, correção ou exclusão dos seus dados, ou o encerramento da sua conta, a qualquer momento,
        pelo e-mail <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. Administradores podem excluir jogadores e
        grupos diretamente no aplicativo.
      </p>

      <h2>Retenção</h2>
      <p>
        Mantemos os dados enquanto a conta ou o grupo existir. Ao excluir um grupo, todos os dados dele (jogadores, notas
        e jogos) são apagados.
      </p>

      <h2>Contato</h2>
      <p>
        Dúvidas sobre esta política: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </LegalPage>
  );
}
