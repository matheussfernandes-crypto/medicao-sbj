import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Topbar from "../../components/Topbar";
import { criarEmpresa, editarEmpresa, toggleEmpresaAtivo } from "./actions";

const UF_LIST = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

export default async function EmpresasPage({
  searchParams,
}: {
  searchParams: { editar?: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: perfil } = await supabase.from("perfis").select("setor").eq("id", user!.id).single();
  if (perfil?.setor !== "ADMIN") redirect("/dashboard");

  const { data: empresas } = await supabase
    .from("empresas_terceirizadas")
    .select("id, nome, nome_empresarial, cnpj, inscricao_municipal, contato, email, telefone, endereco, cep, bairro, municipio, uf, observacoes, ativo")
    .order("nome");

  const editarId = searchParams.editar ?? null;
  const e = editarId ? (empresas ?? []).find((x) => x.id === editarId) : null;

  return (
    <main className="min-h-screen">
      <Topbar setor="ADMIN" />
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <h1 className="text-xl font-semibold text-primaryDark">Empresas Terceirizadas</h1>

        {/* Formulário criar / editar */}
        <div className="bg-white rounded-xl shadow p-5">
          <h2 className="font-semibold text-primaryDark mb-4">
            {e ? `Editando: ${e.nome}` : "Cadastrar nova empresa"}
          </h2>
          <form
            action={e ? editarEmpresa : criarEmpresa}
            className="grid grid-cols-1 sm:grid-cols-2 gap-3"
          >
            {e && <input type="hidden" name="id" value={e.id} />}

            {/* Nome fantasia */}
            <div className="sm:col-span-2">
              <label className="text-xs text-gray-500 block mb-1">Nome fantasia *</label>
              <input name="nome" defaultValue={e?.nome ?? ""} className="border rounded px-3 py-2 w-full" placeholder="EMPREITEIRA DE MAO DE OBRA GABRIELA CAVALCANTE" required />
            </div>

            {/* Nome empresarial */}
            <div className="sm:col-span-2">
              <label className="text-xs text-gray-500 block mb-1">Nome empresarial (razão social)</label>
              <input name="nome_empresarial" defaultValue={e?.nome_empresarial ?? ""} className="border rounded px-3 py-2 w-full" placeholder="GARCIA CAVALCANTE LTDA" />
            </div>

            {/* CNPJ + Inscrição Municipal */}
            <div>
              <label className="text-xs text-gray-500 block mb-1">CNPJ / CPF</label>
              <input name="cnpj" defaultValue={e?.cnpj ?? ""} className="border rounded px-3 py-2 w-full" placeholder="45.126.416/0001-99" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Inscrição Municipal</label>
              <input name="inscricao_municipal" defaultValue={e?.inscricao_municipal ?? ""} className="border rounded px-3 py-2 w-full" placeholder="334110" />
            </div>

            {/* Endereço */}
            <div className="sm:col-span-2">
              <label className="text-xs text-gray-500 block mb-1">Endereço</label>
              <input name="endereco" defaultValue={e?.endereco ?? ""} className="border rounded px-3 py-2 w-full" placeholder="MARIO URIARTE, 255 - SALA 210 BOX 17" />
            </div>

            {/* CEP + Bairro */}
            <div>
              <label className="text-xs text-gray-500 block mb-1">CEP</label>
              <input name="cep" defaultValue={e?.cep ?? ""} className="border rounded px-3 py-2 w-full" placeholder="88311-740" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Bairro</label>
              <input name="bairro" defaultValue={e?.bairro ?? ""} className="border rounded px-3 py-2 w-full" placeholder="CORDEIROS" />
            </div>

            {/* Município + UF */}
            <div>
              <label className="text-xs text-gray-500 block mb-1">Município</label>
              <input name="municipio" defaultValue={e?.municipio ?? ""} className="border rounded px-3 py-2 w-full" placeholder="ITAJAÍ" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">UF</label>
              <select name="uf" defaultValue={e?.uf ?? ""} className="border rounded px-3 py-2 w-full">
                <option value="">—</option>
                {UF_LIST.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>

            {/* Contato + Telefone */}
            <div>
              <label className="text-xs text-gray-500 block mb-1">Contato (responsável)</label>
              <input name="contato" defaultValue={e?.contato ?? ""} className="border rounded px-3 py-2 w-full" placeholder="Nome do responsável" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Telefone / Fone</label>
              <input name="telefone" defaultValue={e?.telefone ?? ""} className="border rounded px-3 py-2 w-full" placeholder="47 3246-2529" />
            </div>

            {/* E-mail */}
            <div className="sm:col-span-2">
              <label className="text-xs text-gray-500 block mb-1">E-mail</label>
              <input type="email" name="email" defaultValue={e?.email ?? ""} className="border rounded px-3 py-2 w-full" placeholder="r.ccontabilidade@terra.com.br" />
            </div>

            {/* Observações */}
            <div className="sm:col-span-2">
              <label className="text-xs text-gray-500 block mb-1">Observações</label>
              <textarea name="observacoes" defaultValue={e?.observacoes ?? ""} className="border rounded px-3 py-2 w-full h-16 resize-none" placeholder="Informações adicionais…" />
            </div>

            <div className="sm:col-span-2 flex gap-2">
              <button className="bg-primary text-white rounded px-5 py-2">
                {e ? "Salvar alterações" : "Cadastrar empresa"}
              </button>
              {e && (
                <a href="/admin/empresas" className="border rounded px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
                  Cancelar
                </a>
              )}
            </div>
          </form>
        </div>

        {/* Lista */}
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-400 text-xs uppercase tracking-wide">
              <tr>
                <th className="p-3">Empresa</th>
                <th className="p-3">CNPJ / Insc. Mun.</th>
                <th className="p-3">Localização</th>
                <th className="p-3">Contato / Fone</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {(empresas ?? []).length === 0 && (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-gray-400">Nenhuma empresa cadastrada ainda.</td>
                </tr>
              )}
              {(empresas ?? []).map((emp) => (
                <tr key={emp.id} className={`border-t ${!emp.ativo ? "opacity-50" : ""}`}>
                  <td className="p-3">
                    <span className="font-medium block">{emp.nome}</span>
                    {emp.nome_empresarial && <span className="text-xs text-gray-400 block">{emp.nome_empresarial}</span>}
                    {emp.observacoes && <span className="text-xs text-gray-400 italic block truncate max-w-[180px]">{emp.observacoes}</span>}
                  </td>
                  <td className="p-3 text-gray-600 text-xs">
                    {emp.cnpj && <span className="block">{emp.cnpj}</span>}
                    {emp.inscricao_municipal && <span className="block text-gray-400">Insc. {emp.inscricao_municipal}</span>}
                    {!emp.cnpj && !emp.inscricao_municipal && "—"}
                  </td>
                  <td className="p-3 text-xs text-gray-600">
                    {emp.municipio ? (
                      <>
                        <span className="block">{emp.municipio}{emp.uf ? ` / ${emp.uf}` : ""}</span>
                        {emp.bairro && <span className="block text-gray-400">{emp.bairro}</span>}
                      </>
                    ) : "—"}
                  </td>
                  <td className="p-3 text-xs">
                    <span className="block">{emp.contato ?? "—"}</span>
                    {emp.telefone && <span className="text-gray-400 block">{emp.telefone}</span>}
                    {emp.email && <span className="text-gray-400 block">{emp.email}</span>}
                  </td>
                  <td className="p-3 text-center">
                    <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-semibold ${emp.ativo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {emp.ativo ? "Ativa" : "Inativa"}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <a href={`/admin/empresas?editar=${emp.id}`} className="text-xs text-primary underline">Editar</a>
                      <form action={toggleEmpresaAtivo}>
                        <input type="hidden" name="id" value={emp.id} />
                        <input type="hidden" name="ativo" value={String(emp.ativo)} />
                        <button className="text-xs text-gray-500 underline">{emp.ativo ? "Desativar" : "Reativar"}</button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
