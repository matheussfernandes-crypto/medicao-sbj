import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SETORES_MODULO, STATUS_LABEL, STATUS_COR, PRIORIDADE_LABEL, PRIORIDADE_COR, CATEGORIA_LABEL } from "../constants";

export default async function OrdensServicoPage({
  searchParams,
}: {
  searchParams: { status?: string; prioridade?: string; obra?: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: perfil } = await supabase.from("perfis").select("setor").eq("id", user!.id).single();
  if (!perfil || !SETORES_MODULO.includes(perfil.setor)) redirect("/dashboard");

  const { data: obras } = await supabase.from("obras").select("id, nome").order("nome");
  const nomeObra: Record<string, string> = {};
  for (const o of obras ?? []) nomeObra[o.id] = o.nome;

  let query = supabase
    .from("manutencao_os")
    .select("id, numero_os, obra_id, categoria, problema, prioridade, status, criado_em, solicitante_nome")
    .order("criado_em", { ascending: false })
    .limit(100);

  if (searchParams.status) query = query.eq("status", searchParams.status);
  if (searchParams.prioridade) query = query.eq("prioridade", searchParams.prioridade);
  if (searchParams.obra) query = query.eq("obra_id", searchParams.obra);

  const { data: ordens } = await query;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-semibold text-primaryDark">Ordens de Serviço</h1>
          <p className="text-sm text-ink-500">{ordens?.length ?? 0} ordem(ns) encontrada(s).</p>
        </div>
        <Link href="/manutencoes/nova" className="bg-primary text-white rounded px-4 py-2 text-sm font-semibold hover:bg-primaryDark transition">
          + Nova Ordem de Serviço
        </Link>
      </div>

      <div className="card flex flex-wrap gap-4 items-end">
        <div>
          <label className="text-xs text-ink-500 block mb-1">Status</label>
          <select
            defaultValue={searchParams.status ?? ""}
            className="border rounded px-2 py-1.5 text-sm"
            name="status"
            form="filtro-form"
          >
            <option value="">Todos</option>
            {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-ink-500 block mb-1">Prioridade</label>
          <select defaultValue={searchParams.prioridade ?? ""} className="border rounded px-2 py-1.5 text-sm" name="prioridade" form="filtro-form">
            <option value="">Todas</option>
            {Object.entries(PRIORIDADE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-ink-500 block mb-1">Empreendimento</label>
          <select defaultValue={searchParams.obra ?? ""} className="border rounded px-2 py-1.5 text-sm" name="obra" form="filtro-form">
            <option value="">Todos</option>
            {(obras ?? []).map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </select>
        </div>
        <form id="filtro-form" method="get">
          <button className="bg-gray-200 rounded px-4 py-1.5 text-sm">Filtrar</button>
        </form>
        {(searchParams.status || searchParams.prioridade || searchParams.obra) && (
          <Link href="/manutencoes/os" className="text-sm text-primary underline">Limpar filtros</Link>
        )}
      </div>

      <div className="card-table overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-gray-400">
            <tr>
              <th className="p-2">OS</th>
              <th className="p-2">Data</th>
              <th className="p-2">Empreendimento</th>
              <th className="p-2">Categoria</th>
              <th className="p-2">Problema</th>
              <th className="p-2">Solicitante</th>
              <th className="p-2">Prioridade</th>
              <th className="p-2">Status</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {(ordens ?? []).map((os) => (
              <tr key={os.id} className="border-t">
                <td className="p-2 font-semibold">#{os.numero_os}</td>
                <td className="p-2 whitespace-nowrap">{new Date(os.criado_em).toLocaleDateString("pt-BR")}</td>
                <td className="p-2">{nomeObra[os.obra_id] ?? "—"}</td>
                <td className="p-2">{CATEGORIA_LABEL[os.categoria] ?? os.categoria}</td>
                <td className="p-2">{os.problema}</td>
                <td className="p-2">{os.solicitante_nome}</td>
                <td className="p-2">
                  <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-semibold ${PRIORIDADE_COR[os.prioridade] ?? ""}`}>
                    {PRIORIDADE_LABEL[os.prioridade] ?? os.prioridade}
                  </span>
                </td>
                <td className="p-2">
                  <span className={`badge ${STATUS_COR[os.status] ?? ""}`}>{STATUS_LABEL[os.status] ?? os.status}</span>
                </td>
                <td className="p-2 text-right">
                  <Link href={`/manutencoes/os/${os.id}`} className="text-primary underline text-xs">Abrir</Link>
                </td>
              </tr>
            ))}
            {(!ordens || ordens.length === 0) && (
              <tr><td colSpan={9} className="p-4 text-center text-gray-400">Nenhuma ordem de serviço encontrada.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
