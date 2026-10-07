import Link from "next/link";
import { Plus } from "lucide-react";
import { exigirPerfil, listarContratos } from "@/lib/contratos/server";
import { SETORES_VEEM_CONTRATO, brl, pct } from "@/lib/contratos/util";

const STATUS_COR: Record<string, string> = {
  ATIVO: "badge-aprovado",
  SUSPENSO: "badge-pendente",
  ENCERRADO: "badge-desativado",
};

export default async function ContratosPage({
  searchParams,
}: {
  searchParams: { obra?: string; empresa?: string; status?: string };
}) {
  const { supabase, ehAdmin } = await exigirPerfil(SETORES_VEEM_CONTRATO);

  const [contratos, { data: obras }, { data: empresas }] = await Promise.all([
    listarContratos(supabase, {
      obraId: searchParams.obra || undefined,
      empresaId: searchParams.empresa || undefined,
      status: searchParams.status ?? "ATIVO",
    }),
    supabase.from("obras").select("id, nome").order("nome"),
    supabase.from("empresas_terceirizadas").select("id, nome").order("nome"),
  ]);

  const totalContratado = contratos.reduce((s, c) => s + c.valor_atual, 0);
  const totalMedido = contratos.reduce((s, c) => s + c.valor_medido, 0);
  const totalSaldo = contratos.reduce((s, c) => s + c.saldo, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-primaryDark">Contratos de empresas terceirizadas</h1>
        {ehAdmin && (
          <Link href="/contratos/novo" className="inline-flex items-center gap-1.5 bg-primary text-white rounded-lg px-4 py-2 text-sm font-semibold hover:bg-primaryDark">
            <Plus className="w-4 h-4" /> Novo contrato
          </Link>
        )}
      </div>

      <form method="get" className="card !p-4 flex flex-wrap gap-2 items-end">
        <label className="flex flex-col text-xs text-ink-500 gap-1 flex-1 min-w-[160px]">
          Obra
          <select name="obra" defaultValue={searchParams.obra ?? ""} className="border rounded px-2 py-2 text-sm text-ink-900">
            <option value="">Todas</option>
            {(obras ?? []).map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </select>
        </label>
        <label className="flex flex-col text-xs text-ink-500 gap-1 flex-1 min-w-[160px]">
          Empresa
          <select name="empresa" defaultValue={searchParams.empresa ?? ""} className="border rounded px-2 py-2 text-sm text-ink-900">
            <option value="">Todas</option>
            {(empresas ?? []).map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select>
        </label>
        <label className="flex flex-col text-xs text-ink-500 gap-1">
          Status
          <select name="status" defaultValue={searchParams.status ?? "ATIVO"} className="border rounded px-2 py-2 text-sm text-ink-900">
            <option value="ATIVO">Ativos</option>
            <option value="SUSPENSO">Suspensos</option>
            <option value="ENCERRADO">Encerrados</option>
            <option value="">Todos</option>
          </select>
        </label>
        <button className="bg-gray-100 border rounded px-4 py-2 text-sm">Filtrar</button>
      </form>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="stat-tile"><span className="stat-label">Valor contratado (atualizado)</span><span className="stat-value">{brl(totalContratado)}</span></div>
        <div className="stat-tile"><span className="stat-label">Medido (aprovado)</span><span className="stat-value">{brl(totalMedido)}</span><span className="stat-hint">{totalContratado > 0 ? pct((totalMedido / totalContratado) * 100) : "—"} executado</span></div>
        <div className="stat-tile"><span className="stat-label">Saldo a medir</span><span className="stat-value">{brl(totalSaldo)}</span></div>
      </div>

      <div className="card-table table-scroll">
        <table className="w-full text-sm">
          <thead className="bg-surface-subtle">
            <tr className="text-left">
              <th className="px-4 py-3">Nº</th>
              <th className="px-4 py-3">Obra</th>
              <th className="px-4 py-3">Empresa / objeto</th>
              <th className="px-4 py-3 text-right">Contratado</th>
              <th className="px-4 py-3">Executado</th>
              <th className="px-4 py-3 text-right">Saldo</th>
              <th className="px-4 py-3">Retenção</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {contratos.map((c) => (
              <tr key={c.id} className="border-t hover:bg-surface-subtle">
                <td className="px-4 py-3 font-semibold text-primaryDark whitespace-nowrap">
                  <Link href={`/contratos/${c.id}`} className="hover:underline">{c.numero}</Link>
                </td>
                <td className="px-4 py-3 font-semibold whitespace-nowrap">{c.obra_nome}</td>
                <td className="px-4 py-3">
                  <Link href={`/contratos/${c.id}`} className="hover:underline">
                    <span className="block">{c.empresa_nome}</span>
                    <span className="block text-xs text-ink-500">{c.objeto}</span>
                  </Link>
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">{brl(c.valor_atual)}</td>
                <td className="px-4 py-3 min-w-[130px]">
                  <div className="h-2 bg-gray-100 rounded overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${Math.min(100, c.perc_executado)}%` }} />
                  </div>
                  <span className="text-xs text-ink-500">{pct(c.perc_executado)}{c.valor_pendente > 0 ? ` · ${brl(c.valor_pendente)} pendente` : ""}</span>
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">{brl(c.saldo)}</td>
                <td className="px-4 py-3">{pct(c.retencao_vigente)}</td>
                <td className="px-4 py-3"><span className={`badge ${STATUS_COR[c.status] ?? ""}`}>{c.status}</span></td>
              </tr>
            ))}
            {!contratos.length && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-ink-400">Nenhum contrato encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
