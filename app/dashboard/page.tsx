import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Topbar from "../components/Topbar";

export default async function DashboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: perfil } = await supabase
    .from("perfis")
    .select("nome_completo, setor")
    .eq("id", user!.id)
    .single();

  const setor = perfil?.setor ?? "ESTAGIARIO";

  return (
    <main className="min-h-screen">
      <Topbar setor={setor} voltar={false} />

      <div className="max-w-3xl mx-auto p-6 space-y-4">
        {setor === "ADMIN" && (
          <Link href="/admin/aprovacoes" className="block bg-white rounded-xl shadow p-4 hover:shadow-md transition">
            <h2 className="font-semibold text-primaryDark">Aprovação de logins</h2>
            <p className="text-sm text-gray-500">Aprovar ou rejeitar cadastros pendentes.</p>
          </Link>
        )}

        {setor === "ADMIN" && (
          <Link href="/admin/obras" className="block bg-white rounded-xl shadow p-4 hover:shadow-md transition">
            <h2 className="font-semibold text-primaryDark">Obras &amp; Pessoas</h2>
            <p className="text-sm text-gray-500">Cadastrar obras, serviços, retenção mensal e empresas contratadas.</p>
          </Link>
        )}

        {setor === "ADMIN" && (
          <Link href="/admin/empresas" className="block bg-white rounded-xl shadow p-4 hover:shadow-md transition">
            <h2 className="font-semibold text-primaryDark">Empresas Terceirizadas</h2>
            <p className="text-sm text-gray-500">Cadastrar e gerenciar empresas de serviços terceirizados.</p>
          </Link>
        )}

        {(setor === "ADMIN" || setor === "RH") && (
          <Link href="/rh/pessoas" className="block bg-white rounded-xl shadow p-4 hover:shadow-md transition">
            <h2 className="font-semibold text-primaryDark">RH &amp; Pessoas</h2>
            <p className="text-sm text-gray-500">Cadastrar empreiteiros/mestres, transferir e dar baixa.</p>
          </Link>
        )}

        <Link href="/lancamentos" className="block bg-white rounded-xl shadow p-4 hover:shadow-md transition">
          <h2 className="font-semibold text-primaryDark">Lançamentos — Medição &amp; Vale</h2>
          <p className="text-sm text-gray-500">Registrar medições e vales por pessoa/obra, com aprovação.</p>
        </Link>

        {(setor === "ADMIN" || setor === "FINANCEIRO") && (
          <Link href="/financeiro/retiradas" className="block bg-white rounded-xl shadow p-4 hover:shadow-md transition">
            <h2 className="font-semibold text-primaryDark">Financeiro — Retiradas de retido</h2>
            <p className="text-sm text-gray-500">Lançar retiradas, saldo inicial e saldo disponível por pessoa.</p>
          </Link>
        )}

        {setor === "ADMIN" && (
          <Link href="/admin/fechamento" className="block bg-white rounded-xl shadow p-4 hover:shadow-md transition">
            <h2 className="font-semibold text-primaryDark">Fechamento mensal — Medição &amp; Vale</h2>
            <p className="text-sm text-gray-500">Finalizar o mês: gera o PDF assinado e envia por email automaticamente.</p>
          </Link>
        )}

        {(setor === "ADMIN" || setor === "FINANCEIRO") && (
          <Link href="/financeiro/dashboard" className="block bg-white rounded-xl shadow p-4 hover:shadow-md transition">
            <h2 className="font-semibold text-primaryDark">Dashboard de gastos</h2>
            <p className="text-sm text-gray-500">Gasto por obra no mês atual e evolução dos últimos 6 meses.</p>
          </Link>
        )}

        {setor === "ADMIN" && (
          <Link href="/admin/auditoria" className="block bg-white rounded-xl shadow p-4 hover:shadow-md transition">
            <h2 className="font-semibold text-primaryDark">Log de auditoria</h2>
            <p className="text-sm text-gray-500">Histórico de quem criou, editou ou excluiu lançamentos, fechamentos e retiradas.</p>
          </Link>
        )}
      </div>
    </main>
  );
}
