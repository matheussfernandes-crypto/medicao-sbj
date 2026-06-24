import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { criarPessoa, transferirObra, darBaixa, reativarPessoa } from "./actions";
import Topbar from "../../components/Topbar";

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function diffTempo(inicioISO: string, fimISO: string) {
  const ini = new Date(inicioISO);
  const fim = new Date(fimISO);
  let meses = (fim.getFullYear() - ini.getFullYear()) * 12 + (fim.getMonth() - ini.getMonth());
  if (fim.getDate() < ini.getDate()) meses -= 1;
  if (meses < 0) meses = 0;
  const anos = Math.floor(meses / 12);
  const restoMeses = meses % 12;
  if (anos === 0) return `${restoMeses} mês(es)`;
  return `${anos} ano(s) e ${restoMeses} mês(es)`;
}

export default async function PessoasPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: meuPerfil } = await supabase.from("perfis").select("setor").eq("id", user!.id).single();
  if (meuPerfil?.setor !== "RH" && meuPerfil?.setor !== "ADMIN") redirect("/dashboard");

  const { data: obras } = await supabase.from("obras").select("id, nome").order("nome");
  const { data: pessoas } = await supabase
    .from("pessoas")
    .select("id, nome, papel, obra_id, admissao, status, saida")
    .order("nome");

  const nomeObra: Record<string, string> = {};
  for (const o of obras ?? []) nomeObra[o.id] = o.nome;

  const hoje = hojeISO();

  return (
    <main className="min-h-screen">
      <Topbar setor="RH" />
      <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-xl font-semibold text-primaryDark">RH &amp; Pessoas</h1>

      <div className="bg-white rounded-xl shadow p-4">
        <h2 className="font-semibold text-primaryDark mb-2">Cadastrar novo empreiteiro</h2>
        {obras && obras.length > 0 ? (
          <form action={criarPessoa} className="flex flex-wrap gap-2">
            <input name="nome" placeholder="Nome da pessoa" className="border rounded px-2 py-1 flex-1 min-w-[160px]" required />
            <select name="papel" className="border rounded px-2 py-1">
              <option value="EMPREITEIRO">Empreiteiro</option>
              <option value="MESTRE">Mestre</option>
            </select>
            <select name="obraId" className="border rounded px-2 py-1">
              {obras.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
            </select>
            <input name="admissao" type="date" defaultValue={hoje} className="border rounded px-2 py-1" />
            <input name="retencao" type="number" min={0} max={100} placeholder="% retenção inicial" className="border rounded px-2 py-1 w-40" />
            <button className="bg-primary text-white rounded px-3 py-1">Cadastrar</button>
          </form>
        ) : (
          <p className="text-sm text-gray-400">Cadastre uma obra primeiro em Obras &amp; Pessoas.</p>
        )}
        <p className="text-xs text-gray-400 mt-2">
          O Mestre de uma obra é quem assina &quot;Conferido por&quot; nas folhas de medição/vale daquela obra.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow p-4 overflow-x-auto">
        <h2 className="font-semibold text-primaryDark mb-2">Resumo de pessoas — situação e tempo na empresa</h2>
        {pessoas && pessoas.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="text-left text-gray-400">
              <tr>
                <th className="p-1">Nome</th><th className="p-1">Papel</th><th className="p-1">Obra</th>
                <th className="p-1">Admissão</th><th className="p-1">Tempo</th><th className="p-1">Status</th><th className="p-1">Ações</th>
              </tr>
            </thead>
            <tbody>
              {pessoas.map((p) => {
                const fim = p.status === "ATIVO" ? hoje : (p.saida || hoje);
                return (
                  <tr key={p.id} className="border-t">
                    <td className="p-1">{p.nome}</td>
                    <td className="p-1">{p.papel === "MESTRE" ? "Mestre" : "Empreiteiro"}</td>
                    <td className="p-1">{nomeObra[p.obra_id] ?? "—"}</td>
                    <td className="p-1">{p.admissao}</td>
                    <td className="p-1">{diffTempo(p.admissao, fim)}{p.status !== "ATIVO" ? " (até a saída)" : ""}</td>
                    <td className="p-1">
                      <span className={p.status === "ATIVO" ? "text-green-600" : "text-red-500"}>
                        {p.status === "ATIVO" ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="p-1 space-y-1">
                      {p.status === "ATIVO" ? (
                        <>
                          <form action={transferirObra} className="flex gap-1 mb-1">
                            <input type="hidden" name="pessoaId" value={p.id} />
                            <select name="obraId" defaultValue={p.obra_id} className="border rounded px-1 text-xs">
                              {(obras ?? []).map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
                            </select>
                            <button className="bg-gray-200 rounded px-2 text-xs">Transferir</button>
                          </form>
                          <form action={darBaixa} className="flex gap-1">
                            <input type="hidden" name="pessoaId" value={p.id} />
                            <input type="date" name="saida" defaultValue={hoje} className="border rounded px-1 text-xs" />
                            <button className="bg-red-100 text-red-700 rounded px-2 text-xs">Dar baixa</button>
                          </form>
                        </>
                      ) : (
                        <form action={reativarPessoa}>
                          <input type="hidden" name="pessoaId" value={p.id} />
                          <span className="text-xs text-gray-400 mr-2">Saída em {p.saida || "—"}</span>
                          <button className="bg-gray-200 rounded px-2 text-xs">Reativar</button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-gray-400">Nenhum empreiteiro cadastrado ainda.</p>
        )}
      </div>
      </div>
    </main>
  );
}
