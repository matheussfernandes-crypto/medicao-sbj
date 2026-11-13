// A cada troca de seção (Lançamentos, Contratos, Financeiro…) o conteúdo entra suave, no padrão do pós-obra.
// O template só remonta quando muda a seção; trocar de aba dentro de uma seção não passa por aqui.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="sbj-conteudo">{children}</div>;
}
