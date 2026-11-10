"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { ITENS, MODULOS, ehGestorAcessos, itensLiberados } from "@/lib/acessos/modulos";
import { salvarAcessos } from "./actions";

type Pessoa = { id: string; nome_completo: string | null; email: string | null; setor: string | null; acessos: string[] | null };

const SETOR_LABEL: Record<string, string> = {
  ESTAGIARIO: "Estagiário",
  ADMIN: "Engenheiro / ADM",
  ARQUITETO: "Arquiteto",
  ENGENHEIRO: "Engenheiro",
  MESTRE_GERAL: "Mestre Geral",
  RH: "RH",
  FINANCEIRO: "Financeiro",
};

// tira acentos e maiúsculas para a busca
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Lista de pessoas: busca por nome/e-mail e cada cartão abre e fecha ao clicar.
export default function ListaAcessos({ pessoas }: { pessoas: Pessoa[] }) {
  const [busca, setBusca] = useState("");
  const [abertas, setAbertas] = useState<Set<string>>(new Set());

  const filtradas = useMemo(() => {
    const q = norm(busca.trim());
    if (!q) return pessoas;
    return pessoas.filter((p) => norm(`${p.nome_completo ?? ""} ${p.email ?? ""}`).includes(q));
  }, [busca, pessoas]);

  const alternar = (id: string) =>
    setAbertas((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="w-4 h-4 text-ink-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Pesquisar pelo nome ou e-mail"
          className="w-full rounded-lg border border-border bg-white pl-9 pr-3 py-2.5 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>
      {filtradas.length === 0 && <p className="text-sm text-ink-500">Nenhuma pessoa encontrada.</p>}

      {filtradas.map((p) => {
        const aberta = abertas.has(p.id);
        const liberados = itensLiberados(p.acessos ?? []);
        const protegido = ehGestorAcessos(p.email);
        return (
          <div key={p.id} className="card !p-0 overflow-hidden transition-shadow duration-200 hover:shadow-panel">
            <button
              type="button"
              onClick={() => alternar(p.id)}
              aria-expanded={aberta}
              className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left"
            >
              <div className="min-w-0">
                <p className="font-semibold text-ink-900 truncate">{p.nome_completo ?? p.email}</p>
                <p className="text-xs text-ink-500">
                  {SETOR_LABEL[p.setor ?? ""] ?? p.setor}
                  {protegido ? " · conta protegida" : ""}
                </p>
              </div>
              <ChevronDown className={"w-5 h-5 text-ink-500 shrink-0 transition-transform duration-300 " + (aberta ? "rotate-180" : "")} />
            </button>

            <div className={"grid transition-[grid-template-rows,opacity] duration-300 ease-out " + (aberta ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
              <div className="overflow-hidden">
                <form action={salvarAcessos.bind(null, p.id)} className="px-5 pb-5 space-y-4 border-t border-border pt-4">
                  <div className="flex items-center justify-between gap-3">
                    <label className="flex items-center gap-2 text-sm font-semibold text-primaryDark cursor-pointer">
                      <input type="checkbox" name="todos" value="1" className="accent-[#00778A]" />
                      Liberar todos os módulos (acesso total)
                    </label>
                    <button className="bg-primary text-white rounded-lg px-4 py-2 text-sm font-semibold hover:bg-primaryDark transition-colors duration-200">Salvar</button>
                  </div>
                  {MODULOS.map((mod) => (
                    <div key={mod.key} className="space-y-1.5">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">{mod.label}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {ITENS.filter((i) => i.modulo === mod.key).map((i) => (
                          <label key={i.key} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-ink-700 cursor-pointer hover:bg-surface-subtle transition-colors duration-200">
                            <input type="checkbox" name="modulo" value={i.key} defaultChecked={liberados.has(i.key)} className="accent-[#00778A]" />
                            {i.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </form>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
