import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CATEGORIA_LABEL, PROBLEMA_LABEL } from "../constants";
import { criarCategoria, criarProblema, alternarAtivoCategoria, alternarAtivoProblema } from "./actions";

type Item = { id: string; nome: string; ativo: boolean };

export default async function OpcoesManutencaoPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: perfil } = await supabase.from("perfis").select("setor").eq("id", user!.id).single();
  if (!perfil || perfil.setor !== "ADMIN") redirect("/manutencoes");

  const [{ data: categorias }, { data: problemas }] = await Promise.all([
    supabase.from("manutencao_categorias").select("id, nome, ativo").order("nome"),
    supabase.from("manutencao_problemas").select("id, nome, ativo").order("nome"),
  ]);

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-primaryDark">Categorias & Problemas</h1>
        <p className="text-sm text-ink-500">
          Listas usadas ao abrir uma Ordem de Serviço. Um item desativado some das opções de cadastro, mas
          continua aparecendo normalmente nas OS antigas que já usam ele.
        </p>
      </div>

      <ListaOpcao
        titulo="Categorias"
        itens={(categorias ?? []) as Item[]}
        labelPadrao={CATEGORIA_LABEL}
        criar={criarCategoria}
        alternarAtivo={alternarAtivoCategoria}
        placeholder="Ex: Deck"
      />

      <ListaOpcao
        titulo="Problemas"
        itens={(problemas ?? []) as Item[]}
        labelPadrao={PROBLEMA_LABEL}
        criar={criarProblema}
        alternarAtivo={alternarAtivoProblema}
        placeholder="Ex: Madeira apodrecida"
      />
    </div>
  );
}

function ListaOpcao({
  titulo,
  itens,
  labelPadrao,
  criar,
  alternarAtivo,
  placeholder,
}: {
  titulo: string;
  itens: Item[];
  labelPadrao: Record<string, string>;
  criar: (formData: FormData) => void;
  alternarAtivo: (formData: FormData) => void;
  placeholder: string;
}) {
  return (
    <div className="card space-y-3">
      <h2 className="font-semibold text-primaryDark">{titulo}</h2>

      <form action={criar} className="flex gap-2">
        <input
          name="nome"
          required
          placeholder={placeholder}
          className="border rounded px-3 py-2 flex-1 text-sm"
        />
        <button className="bg-primary text-white rounded px-4 py-2 text-sm font-semibold">Adicionar</button>
      </form>

      <ul className="divide-y">
        {itens.map((item) => (
          <li key={item.id} className="flex items-center justify-between py-2 text-sm">
            <span className={item.ativo ? "" : "text-ink-400 line-through"}>
              {labelPadrao[item.nome] ?? item.nome}
            </span>
            <form action={alternarAtivo}>
              <input type="hidden" name="id" value={item.id} />
              <input type="hidden" name="ativo" value={item.ativo ? "0" : "1"} />
              <button className={`text-xs rounded px-2 py-1 ${item.ativo ? "bg-gray-100 text-gray-600" : "bg-primary/10 text-primaryDark"}`}>
                {item.ativo ? "Desativar" : "Ativar"}
              </button>
            </form>
          </li>
        ))}
        {itens.length === 0 && <li className="py-2 text-sm text-ink-400">Nenhum item cadastrado.</li>}
      </ul>
    </div>
  );
}
