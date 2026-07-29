import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SETORES_MODULO, STATUS_LABEL, STATUS_COR, CATEGORIA_LABEL } from "../constants";

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: { funcionario?: string; empresa?: string; obra?: string; data?: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: perfil } = await supabase.from("perfis").select("setor").eq("id", user!.id).single();
  if (!perfil || !SETORES_MODULO.includes(perfil.setor)) redirect("/dashboard");

  const [{ data: obras }, { data: funcionarios }, { data: empresas }] = await Promise.all([
    supabase.from("obras").select("id, nome").order("nome"),
    supabase.from("perfis").select("id, nome_completo").in("setor", ["ADMIN", "ARQUITETO", "ENGENHEIRO"]).eq("status", "aprovado").order("nome_completo"),
    supabase.from("empresas_terceirizadas").select("id, nome").eq("ativo", true).order("nome"),
  ]);
  const nomeObra: Record<string, string> = {};
  for (const o of obras ?? []) nomeObra[o.id] = o.nome;

  let query = supabase
    .from("manutencao_os")
    .select("id, numero_os, obra_id, categoria, status, agendado_para, responsavel_tipo, responsavel_perfil_id, responsavel_empresa_id")
    .not("agendado_para", "is", null)
    .order("agendado_para", { ascending: true });

  if (searchParams.obra) query = query.eq("obra_id", searchParams.obra);
  if (searchParams.funcionario) query = query.eq("responsavel_perfil_id", searchParams.funcionario);
  if (searchParams.empresa) query = query.eq("responsavel_empresa_id", searchParams.empresa);
  if (searchParams.data) {
    const inicio = `${searchParams.data}T00:00:00`;
    const fim = `${searchParams.data}T23:59:59`;
    query = query.gte("agendado_para", inicio).lte("agendado_para", fim);
  }

  const { data: itens } = await query;

  const nomeFuncionario: Record<string, string> = {};
  for (const f of funcionarios ?? []) nomeFuncionario[f.id] = f.nome_completo;
  const nomeEmpresa: Record<string, string> = {};
  for (const e of empresas ?? []) nomeEmpresa[e.id] = e.nome;

  function responsavelDe(item: any) {
    if (item.responsavel_tipo === "FUNCIONARIO") return nomeFuncionario[item.responsavel_perfil_id] ?? "—";
    if (item.responsavel_tipo === "EMPRESA") return nomeEmpresa[item.responsavel_empresa_id] ?? "—";
    return "—";
  }

  // Agrupa por data (dia)
  const grupos = new Map<string, typeof itens>();
  for (const item of itens ?? []) {
    const dia = new Date(item.agendado_para).toLocaleDateString("pt-BR");
    if (!grupos.has(dia)) grupos.set(dia, []);
    grupos.get(dia)!.push(item);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-primaryDark">Agenda</h1>
        <p className="text-sm text-ink-500">Ordens de serviço com data/hora agendada.</p>
      </div>

      <form method="get" className="card flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-xs text-ink-500 block mb-1">Funcionário</label>
          <select name="funcionario" defaultValue={searchParams.funcionario ?? ""} className="border rounded px-2 py-1.5 text-sm">
            <option value="">Todos</option>
            {(funcionarios ?? []).map((f) => <option key={f.id} value={f.id}>{f.nome_completo}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-ink-500 block mb-1">Empresa</label>
          <select name="empresa" defaultValue={searchParams.empresa ?? ""} className="border rounded px-2 py-1.5 text-sm">
            <option value="">Todas</option>
            {(empresas ?? []).map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-ink-500 block mb-1">Empreendimento</label>
          <select name="obra" defaultValue={searchParams.obra ?? ""} className="border rounded px-2 py-1.5 text-sm">
            <option value="">Todos</option>
            {(obras ?? []).map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-ink-500 block mb-1">Data</label>
          <input type="date" name="data" defaultValue={searchParams.data ?? ""} className="border rounded px-2 py-1.5 text-sm" />
        </div>
        <button className="bg-gray-200 rounded px-4 py-1.5 text-sm">Filtrar</button>
        {(searchParams.funcionario || searchParams.empresa || searchParams.obra || searchParams.data) && (
          <Link href="/manutencoes/agenda" className="text-sm text-primary underline">Limpar filtros</Link>
        )}
      </form>

      {[...grupos.entries()].map(([dia, itensDoDia]) => (
        <div key={dia} className="card-table overflow-x-auto">
          <p className="px-3 pt-3 pb-1 font-semibold text-primaryDark text-sm">{dia}</p>
          <table className="w-full text-sm">
            <thead className="text-left text-gray-400">
              <tr>
                <th className="p-2">Hora</th>
                <th className="p-2">OS</th>
                <th className="p-2">Empreendimento</th>
                <th className="p-2">Categoria</th>
                <th className="p-2">Responsável</th>
                <th className="p-2">Situação</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {itensDoDia!.map((item) => (
                <tr key={item.id} className="border-t">
                  <td className="p-2">{new Date(item.agendado_para!).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</td>
                  <td className="p-2 font-semibold">#{item.numero_os}</td>
                  <td className="p-2">{nomeObra[item.obra_id] ?? "—"}</td>
                  <td className="p-2">{CATEGORIA_LABEL[item.categoria] ?? item.categoria}</td>
                  <td className="p-2">{responsavelDe(item)}</td>
                  <td className="p-2"><span className={`badge ${STATUS_COR[item.status] ?? ""}`}>{STATUS_LABEL[item.status] ?? item.status}</span></td>
                  <td className="p-2 text-right"><Link href={`/manutencoes/os/${item.id}`} className="text-primary underline text-xs">Abrir</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {grupos.size === 0 && <p className="text-sm text-ink-400">Nenhuma ordem de serviço agendada.</p>}
    </div>
  );
}
