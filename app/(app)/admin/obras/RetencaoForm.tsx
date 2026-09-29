"use client";
import { useState, useTransition } from "react";
import { salvarRetencao, salvarRetencaoRetroativo, verificarLancamentos } from "./actions";

interface Pessoa {
  id: string;
  nome: string;
}

interface Props {
  pessoas: Pessoa[];
  retencoesPorPessoa: Record<string, number>;
  obraId: string;
  mes: string;
}

interface Confirmacao {
  pessoaId: string;
  pessoaNome: string;
  percentNovo: number;
  countLancamentos: number;
}

export default function RetencaoForm({ pessoas, retencoesPorPessoa, obraId, mes }: Props) {
  const [confirmando, setConfirmando] = useState<Confirmacao | null>(null);
  const [isPending, startTransition] = useTransition();
  const [salvandoId, setSalvandoId] = useState<string | null>(null);

  const handleSubmit = async (
    e: React.FormEvent<HTMLFormElement>,
    pessoaId: string,
    pessoaNome: string
  ) => {
    e.preventDefault();
    const form = e.currentTarget;
    const pct = Number((form.elements.namedItem("percent") as HTMLInputElement).value);

    setSalvandoId(pessoaId);
    const count = await verificarLancamentos(pessoaId, mes);
    setSalvandoId(null);

    if (count > 0) {
      setConfirmando({ pessoaId, pessoaNome, percentNovo: pct, countLancamentos: count });
    } else {
      const fd = new FormData();
      fd.append("pessoaId", pessoaId);
      fd.append("obraId", obraId);
      fd.append("mes", mes);
      fd.append("percent", String(pct));
      startTransition(async () => {
        await salvarRetencao(fd);
      });
    }
  };

  const confirmarSoParaFrente = () => {
    if (!confirmando) return;
    const fd = new FormData();
    fd.append("pessoaId", confirmando.pessoaId);
    fd.append("obraId", obraId);
    fd.append("mes", mes);
    fd.append("percent", String(confirmando.percentNovo));
    setConfirmando(null);
    startTransition(async () => {
      await salvarRetencao(fd);
    });
  };

  const confirmarRetroativo = () => {
    if (!confirmando) return;
    const fd = new FormData();
    fd.append("pessoaId", confirmando.pessoaId);
    fd.append("obraId", obraId);
    fd.append("mes", mes);
    fd.append("percent", String(confirmando.percentNovo));
    setConfirmando(null);
    startTransition(async () => {
      await salvarRetencaoRetroativo(fd);
    });
  };

  const mesLabel = mes
    ? new Date(mes + "-01T12:00:00").toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
    : mes;

  return (
    <>
      <div className="space-y-2">
        {pessoas.map((p) => (
          <form
            key={p.id}
            onSubmit={(e) => handleSubmit(e, p.id, p.nome)}
            className="flex items-center gap-2"
          >
            <span className="flex-1 text-sm">{p.nome}</span>
            <input
              type="number"
              name="percent"
              min={0}
              max={100}
              defaultValue={retencoesPorPessoa[p.id] ?? 0}
              className="border rounded px-2 py-1 w-20 text-right"
            />
            <span className="text-sm text-gray-500">%</span>
            <button
              type="submit"
              disabled={salvandoId === p.id || isPending}
              className="bg-gray-200 rounded px-3 py-1 text-sm disabled:opacity-50"
            >
              {salvandoId === p.id ? "..." : "Salvar"}
            </button>
          </form>
        ))}
      </div>

      {/* Modal de confirmação */}
      {confirmando && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg p-6 max-w-sm w-full mx-4">
            <h3 className="font-bold text-lg mb-3" style={{ color: "#2c6975" }}>
              Atualizar retenção
            </h3>
            <p className="text-sm text-gray-700 mb-5">
              Há <strong>{confirmando.countLancamentos}</strong> medição(ões) já lançada(s) em{" "}
              <strong>{mesLabel}</strong> para <strong>{confirmando.pessoaNome}</strong>.
              <br />
              <br />
              Deseja atualizar o % retido dessas medições de{" "}
              <strong>{mesLabel}</strong> também?
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={confirmarRetroativo}
                className="text-white rounded px-4 py-2 text-sm font-medium"
                style={{ backgroundColor: "#2c6975" }}
              >
                ✅ Sim, atualizar medições de {mesLabel} também
              </button>
              <button
                onClick={confirmarSoParaFrente}
                className="bg-gray-100 text-gray-700 rounded px-4 py-2 text-sm"
              >
                ➡️ Não, aplicar só daqui para frente
              </button>
              <button
                onClick={() => setConfirmando(null)}
                className="text-gray-400 text-xs mt-1 underline"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
