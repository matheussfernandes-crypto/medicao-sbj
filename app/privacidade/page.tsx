import type { Metadata } from "next";

// Página pública (sem login): política de privacidade exigida pelo Google para a ligação com o Google Agenda.
export const metadata: Metadata = { title: "Política de privacidade · Engenharia SBJ" };

export default function Privacidade() {
  return (
    <main className="min-h-screen bg-[#f5f7f8] text-ink-700 dark:bg-[#0f1416] dark:text-[#d7e1e4] px-4 py-10">
      <article className="max-w-2xl mx-auto bg-white dark:bg-[#172024] rounded-2xl p-6 sm:p-10 shadow-sm space-y-5 leading-relaxed text-[15px]">
        <img src="/logo-sbj.webp" alt="SBJ" className="h-10 w-auto" />
        <h1 className="text-2xl font-semibold text-primaryDark dark:text-white">Política de privacidade</h1>
        <p className="text-sm text-ink-500">Site interno de Engenharia da SBJ Construtora e Incorporadora · atualizada em 12/11/2026</p>

        <section className="space-y-2">
          <h2 className="font-semibold text-lg">Quem usa este site</h2>
          <p>
            Este site é uma ferramenta interna da SBJ Construtora e Incorporadora. Ele é usado só pela equipe da empresa, com login aprovado pela administração. Não é
            aberto ao público.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-lg">Ligação com o Google Agenda</h2>
          <p>Quem trabalha no pós-venda pode ligar a Agenda do site a uma agenda do Google. Nesse caso, com a autorização da própria pessoa, o site:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>lê a lista de agendas da conta, só para a pessoa escolher em qual as visitas vão entrar;</li>
            <li>cria, altera e remove na agenda escolhida apenas os eventos das visitas marcadas pelo próprio site;</li>
            <li>não lê, não altera e não apaga eventos que não foram criados pelo site;</li>
            <li>guarda apenas o e-mail da conta Google, a agenda escolhida e a autorização de acesso, cifrada.</li>
          </ul>
          <p>
            Esses dados não são vendidos nem compartilhados com terceiros e servem só para manter as visitas da empresa atualizadas na agenda. O uso das informações
            recebidas das APIs do Google segue a Política de Dados do Usuário dos Serviços de API do Google, incluindo os requisitos de uso limitado.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-lg">Como desligar</h2>
          <p>
            A qualquer momento, a pessoa pode clicar em <b>Desconectar</b> na Agenda do site, o que apaga a autorização guardada. Também é possível remover o acesso em{" "}
            <a className="text-primary underline" href="https://myaccount.google.com/permissions">
              myaccount.google.com/permissions
            </a>
            . Os eventos já criados na agenda do Google continuam lá, sob controle da própria pessoa.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-lg">Contato</h2>
          <p>Dúvidas sobre esta política: setor de Engenharia da SBJ Construtora e Incorporadora.</p>
        </section>
      </article>
    </main>
  );
}
