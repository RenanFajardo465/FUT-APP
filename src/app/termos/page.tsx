import { LegalPage } from "@/components/LegalPage";
import { APP_NAME, CONTACT_EMAIL } from "@/lib/app-config";

export const metadata = { title: "Termos de Uso" };

export default function TermsPage() {
  return (
    <LegalPage title="Termos de Uso" updated="15 de novembro de 2026">
      <p>Ao usar o {APP_NAME}, você concorda com estes termos.</p>

      <h2>O serviço</h2>
      <p>
        O {APP_NAME} é uma ferramenta para organizar peladas de futebol: cadastro de jogadores, check-in, formação de
        times, rodízio de partidas e cronômetro. O serviço é oferecido gratuitamente, no estado em que se encontra, e pode
        mudar ou ser interrompido a qualquer momento.
      </p>

      <h2>Sua conta</h2>
      <ul>
        <li>Você é responsável pelo acesso à sua conta e pelas informações que cadastra.</li>
        <li>
          O administrador de um grupo é responsável por ter autorização para cadastrar os nomes e notas dos jogadores do
          grupo.
        </li>
        <li>Não use o serviço para atividades ilegais ou para publicar conteúdo ofensivo.</li>
      </ul>

      <h2>Responsabilidade</h2>
      <p>
        Sorteios e cronômetro são ferramentas de apoio. Não nos responsabilizamos por decisões tomadas em campo, por
        perda de dados causada por mau uso ou por indisponibilidade temporária do serviço.
      </p>

      <h2>Privacidade</h2>
      <p>
        O tratamento de dados pessoais é descrito na <a href="/privacidade">Política de Privacidade</a>.
      </p>

      <h2>Contato</h2>
      <p>
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      </p>
    </LegalPage>
  );
}
