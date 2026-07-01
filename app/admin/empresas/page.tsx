import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Topbar from "../../components/Topbar";
import { criarEmpresa, editarEmpresa, toggleEmpresaAtivo } from "./actions";

export default async function EmpresasPage({
  searchParams,
}: {
  searchParams: { editar?: string; msg?: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: perfil } = await supabase.from("perfis").select("setor").eq("id", user!.id).single();
  if (perfil?.setor !== "ADMIN") redirect("/dashboard");

  const { data: empresas } = await supabase
    .from("empresas_terceirizadas")
    .select("id, nome, cnpj, contato, email, telefone, observacoes, ativo, criado_em")
    .order("nome");

  const editarId = searchParams.editar ?? null;
  const empresaEditando = editarId ? (empresas ?? []).find((e) => e.id === editarId) : null;

  return (
    <main className="min-h-screen">
      <Topbar setor="ADMIN" />
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <h1 className="text-xl font-semibold text-primaryDark">Empresas Terceirizadas</h1>

        {searchParams.msg && (
          <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl p-3 text-sm">
            {searchParams.msg}
          </div>
        )}

        {/* Formulário criar / editar */}
        <div className="bg-white rounded-xl shadow p-5">
          <h2 className="font-semibold text-primaryDark mb-3">
            {empresaEditando ? `Editando: ${empresaEditando.nome}` : "Cadastrar nova empresa"}
          </h2>
          <form
            action={empresaEditando ? editarEmpresa : criarEmpresa}
            className="grid grid-cols-1 sm:grid-cols-2 gap-3"
          >
            {empresaEditando && <input type="hidden" name="id" value={empresaEditando.id} />}

            <div className="sm:col-span-2">
              <label className="text-xs text-gray-500 block mb-1">Nome da empresa *</label>
              <input
                name="nome"
                defaultValue={empresaEditando?.nome ?? ""}
                className="border rounded px-3 py-2 w-full"
                placeholder="Construtora XYZ Ltda."
                required
              />
            </div>

            <div>
              <label className="text-xs text-gray-500 block mb-1">CNPJ</label>
              <input
                name="cnpj"
                defaultValue={empresaEditando?.cnpj ?? ""}
                className="border rounded px-3 py-2 w-full"
                placeholder="00.000.000/0000-00"
              />
            </div>

            <div>
              <label className="text-xs text-gray-500 block mb-1">Contato (responsável)</label>
              <input
                name="contato"
                defaultValue={empresaEditando?.contato ?? ""}
                className="border rounded px-3 py-2 w-full"
                placeholder="Nome do responsável"
              />
            </div>

            <div>
              <label className="text-xs text-gray-500 block mb-1">E-mail</label>
              <input
                type="email"
                name="email"
                defaultValue={empresaEditando?.email ?? ""}
                className="border rounded px-3 py-2 w-full"
                placeholder="contato@empresa.com"
              />
            </div>

            <div>
              <label className="text-xs text-gray-500 block mb-1">Telefone</label>
              <input
                name="telefone"
                defaultValue={empresaEditando?.telefone ?? ""}
                className="border rounded px-3 py-2 w-full"
                placeholder="(11) 99999-9999"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs text-gray-500 block mb-1">Observações</label>
              <textarea
                name="observacoes"
                defaultValue={empresaEditando?.observacoes ?? ""}
                className="border rounded px-3 py-2 w-full h-20 resize-none"
                placeholder="Informações adicionais…"
              />
            </div>

            <div className="sm:col-span-2 flex gap-2">
              <button className="bg-primary text-white rounded px-5 py-2">
                {empresaEditando ? "Salvar alterações" : "Cadastrar empresa"}
              </button>
              {empresaEditando && (
                <a href="/admin/empresas" className="border rounded px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
                  Cancelar
                </a>
              )}
            </div>
          </form>
        </div>

        {/* Lista de empresas */}
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-400 text-xs uppercase tracking-wide">
              <tr>
                <th className="p-3">Empresa</th>
                <th className="p-3">CNPJ</th>
                <th className="p-3">Contato</th>
                <th className="p-3">Telefone</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {(empresas ?? []).length === 0 && (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-gray-400">
                    Nenhuma empresa cadastrada ainda.
                  </td>
                </tr>
              )}
              {(empresas ?? []).map((e) => (
                <tr key={e.id} className={`border-t ${!e.ativo ? "opacity-50" : ""}`}>
                  <td className="p-3 font-medium">
                    {e.nome}
                    {e.observacoes && (
                      <span className="block text-xs text-gray-400 font-normal truncate max-w-[200px]" title={e.observacoes}>
                        {e.observacoes}
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-gray-600">{e.cnpj ?? "—"}</td>
                  <td className="p-3">
                    <span className="block">{e.contato ?? "—"}</span>
                    {e.email && <span className="text-xs text-gray-400">{e.email}</span>}
                  </td>
                  <td className="p-3 text-gray-600">{e.telefone ?? "—"}</td>
                  <td className="p-3 text-center">
                    <span
                      className={`inline-block text-xs px-2 py-0.5 rounded-full font-semibold ${
                        e.ativo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {e.ativo ? "Ativa" : "Inativa"}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <a
                        href={`/admin/empresas?editar=${e.id}`}
                        className="text-xs text-primary underline hover:text-primaryDark"
                      >
                        Editar
                      </a>
                      <form action={toggleEmpresaAtivo}>
                        <input type="hidden" name="id" value={e.id} />
                        <input type="hidden" name="ativo" value={String(e.ativo)} />
                        <button className="text-xs text-gray-500 underline hover:text-gray-700">
                          {e.ativo ? "Desativar" : "Reativar"}
                        </button>
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
