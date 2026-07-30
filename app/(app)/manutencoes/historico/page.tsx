import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SETORES_MODULO, CATEGORIA_LABEL, PROBLEMA_LABEL, STATUS_LABEL, STATUS_COR, GARANTIA_LABEL, ORIGEM_LABEL, PRIORIDADE_LABEL } from "../constants";
import { lerFiltros, aplicarFiltros } from "./filtros";
import { listarCategoriasEProblemas } from "../opcoes-listas";

export default async function HistoricoPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: perfil } = await supabase.from("perfis").select("setor").eq("id", user!.id).single();
  if (!perfil || !SETORES_MODULO.includes(perfil.setor)) redirect("/dashboard");

  const usp = new URLSearchParams(Object.entries(searchParams).filter(([, v]) => v) as [string, string][]);
  const filtros = lerFiltros(usp);

  const [{ data: obras }, { data: registros }, { categorias, problemas }] = await Promise.all([
    supabase.from("obras").select("id, nome").order("nome"),
    aplicarFiltros(supabase, filtros),
    listarCategoriasEProblemas(),
  ]);
  const nomeObra: Record<string, string> = {};
  for (const o of obras ?? []) nomeObra[o.id] = o.nome;

  const qs = usp.toString();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-semibold text-primaryDark">Histórico de Manutenções</h1>
          <p className="text-sm text-ink-500">{registros?.length ?? 0} registro(s) — histórico técnico permanente, sem fotos/anexos.</p>
        </div>
        <div className="flex gap-2">
          <a href={`/manutencoes/historico/pdf?${qs}`} target="_blank" rel="noopener noreferrer" className="bg-gray-100 hover:bg-gray-200 text-gray-700 rounded px-3 py-2 text-sm">
            Exportar PDF
          </a>
          <a href={`/manutencoes/historico/excel?${qs}`} className="bg-gray-100 hover:bg-gray-200 text-gray-700 rounded px-3 py-2 text-sm">
            Exportar Excel
          </a>
        </div>
      </div>

      <form method="get" className="card space-y-3">
        <input name="q" defaultValue={filtros.q ?? ""} placeholder="Pesquisar: nome do solicitante, descrição, local, observação técnica…" className="border rounded px-3 py-2 w-full text-sm" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <select name="obra" defaultValue={filtros.obra ?? ""} className="border rounded px-2 py-1.5 text-sm">
            <option value="">Empreendimento</option>
            {(obras ?? []).map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </select>
          <select name="categoria" defaultValue={filtros.categoria ?? ""} className="border rounded px-2 py-1.5 text-sm">
            <option value="">Categoria</option>
            {categorias.map((c) => <option key={c.valor} value={c.valor}>{c.label}</option>)}
          </select>
          <select name="problema" defaultValue={filtros.problema ?? ""} className="border rounded px-2 py-1.5 text-sm">
            <option value="">Problema</option>
            {problemas.map((p) => <option key={p.valor} value={p.valor}>{p.label}</option>)}
          </select>
          <select name="status" defaultValue={filtros.status ?? ""} className="border rounded px-2 py-1.5 text-sm">
            <option value="">Situação</option>
            {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select name="garantia" defaultValue={filtros.garantia ?? ""} className="border rounded px-2 py-1.5 text-sm">
            <option value="">Garantia</option>
            {Object.entries(GARANTIA_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select name="origem" defaultValue={filtros.origem ?? ""} className="border rounded px-2 py-1.5 text-sm">
            <option value="">Origem</option>
            {Object.entries(ORIGEM_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select name="prioridade" defaultValue={filtros.prioridade ?? ""} className="border rounded px-2 py-1.5 text-sm">
            <option value="">Prioridade</option>
            {Object.entries(PRIORIDADE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <div className="flex gap-1">
            <input type="date" name="de" defaultValue={filtros.de ?? ""} className="border rounded px-2 py-1.5 text-sm w-full" title="De" />
            <input type="date" name="ate" defaultValue={filtros.ate ?? ""} className="border rounded px-2 py-1.5 text-sm w-full" title="Até" />
          </div>
        </div>
        <div className="flex gap-2">
          <button className="bg-primary text-white rounded px-4 py-1.5 text-sm font-semibold">Aplicar Filtros</button>
          <Link href="/manutencoes/historico" className="bg-gray-200 rounded px-4 py-1.5 text-sm">Limpar Filtros</Link>
        </div>
      </form>

      <div className="card-table overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-gray-400">
            <tr>
              <th className="p-2">Data</th>
              <th className="p-2">Nº OS</th>
              <th className="p-2">Local</th>
              <th className="p-2">Categoria</th>
              <th className="p-2">Problema</th>
              <th className="p-2">Situação</th>
              <th className="p-2">Garantia</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {(registros ?? []).map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-2 whitespace-nowrap">{new Date(r.criado_em).toLocaleDateString("pt-BR")}</td>
                <td className="p-2 font-semibold">#{r.numero_os}</td>
                <td className="p-2">{nomeObra[r.obra_id] ?? "—"}</td>
                <td className="p-2">{CATEGORIA_LABEL[r.categoria] ?? r.categoria}</td>
                <td className="p-2">{PROBLEMA_LABEL[r.problema] ?? r.problema}</td>
                <td className="p-2"><span className={`badge ${STATUS_COR[r.status] ?? ""}`}>{STATUS_LABEL[r.status] ?? r.status}</span></td>
                <td className="p-2 text-xs">{r.garantia_classificacao ? GARANTIA_LABEL[r.garantia_classificacao] ?? r.garantia_classificacao : "—"}</td>
                <td className="p-2 text-right"><Link href={`/manutencoes/os/${r.id}`} className="text-primary underline text-xs">Visualizar OS</Link></td>
              </tr>
            ))}
            {(!registros || registros.length === 0) && (
              <tr><td colSpan={8} className="p-4 text-center text-gray-400">Nenhum registro encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
