import Link from "next/link";
import { FileDown } from "lucide-react";
import { exigirPerfil } from "@/lib/contratos/server";
import { brl, mesLabel, dataHoraBR } from "@/lib/contratos/util";
import Selecao from "@/components/ui/Selecao";
import { TabelaPaginada } from "@/components/ui/anima";

export default async function HistoricoContratosPage({
  searchParams,
}: {
  searchParams: { obra?: string; empresa?: string };
}) {
  const { supabase } = await exigirPerfil(["ADMIN", "FINANCEIRO"]);

  const { data: fechamentos } = await supabase
    .from("contrato_fechamentos")
    .select("id, contrato_id, mes_referencia, valor_bruto, retencao_valor, vales_descontados, valor_liquido, fechado_em, contratos(numero, objeto, obra_id, empresa_id, obras(nome), empresas_terceirizadas(nome))")
    .order("mes_referencia", { ascending: false });

  const lista = (fechamentos ?? []) as any[];
  const obras = Array.from(new Map(lista.map((f) => [f.contratos?.obra_id, f.contratos?.obras?.nome])).entries()).filter(([id]) => id);
  const empresas = Array.from(new Map(lista.map((f) => [f.contratos?.empresa_id, f.contratos?.empresas_terceirizadas?.nome])).entries()).filter(([id]) => id);
  const obra = searchParams.obra || "";
  const empresa = searchParams.empresa || "";
  const filtrada = lista
    .filter((f) => (!obra || f.contratos?.obra_id === obra) && (!empresa || f.contratos?.empresa_id === empresa))
    .sort((a, b) => (a.mes_referencia < b.mes_referencia ? 1 : a.mes_referencia > b.mes_referencia ? -1 : (a.contratos?.numero ?? 0) - (b.contratos?.numero ?? 0)));

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold text-primaryDark">Histórico de medições</h1>

      <form method="get" className="card !p-4 flex flex-wrap gap-2 items-end">
        <label className="flex flex-col gap-1 text-xs text-ink-500 min-w-[220px]">Obra
          <Selecao name="obra" defaultValue={obra} className="border rounded px-2 py-2 text-sm text-ink-900">
            <option value="">Todas</option>
            {obras.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
          </Selecao>
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-500 min-w-[220px]">Empresa
          <Selecao name="empresa" defaultValue={empresa} className="border rounded px-2 py-2 text-sm text-ink-900">
            <option value="">Todas</option>
            {empresas.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
          </Selecao>
        </label>
        <button className="bg-primary text-white rounded px-4 py-2 text-sm font-semibold">Filtrar</button>
      </form>

      <section className="card overflow-x-auto">
        {filtrada.length === 0 ? (
          <p className="text-sm text-ink-400">Nenhuma medição fechada ainda. Os PDFs aparecem aqui depois do fechamento do mês.</p>
        ) : (
          <TabelaPaginada por={20} className="w-full text-sm" cabecalho={
<thead>
              <tr className="text-left border-b text-ink-500">
                <th className="py-2 pr-3">Mês</th>
                <th className="py-2 pr-3">Obra</th>
                <th className="py-2 pr-3">Contrato</th>
                <th className="py-2 pr-3">Empresa</th>
                <th className="py-2 pr-3 text-right">Medido</th>
                <th className="py-2 pr-3 text-right">Retenção</th>
                <th className="py-2 pr-3 text-right">Vales</th>
                <th className="py-2 pr-3 text-right">Líquido</th>
                <th className="py-2 pr-3">Fechado em</th>
                <th className="py-2"></th>
              </tr>
            </thead>
}>
              {filtrada.map((f) => (
                <tr key={f.id} className="border-b">
                  <td className="py-2 pr-3 whitespace-nowrap">{mesLabel(f.mes_referencia)}</td>
                  <td className="py-2 pr-3">{f.contratos?.obras?.nome}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">
                    <Link href={`/contratos/${f.contrato_id}`} className="text-primary hover:underline">Nº {String(f.contratos?.numero ?? "").padStart(2, "0")}</Link>
                    <span className="text-ink-400 text-xs ml-1">{f.contratos?.objeto}</span>
                  </td>
                  <td className="py-2 pr-3">{f.contratos?.empresas_terceirizadas?.nome}</td>
                  <td className="py-2 pr-3 text-right">{brl(f.valor_bruto)}</td>
                  <td className="py-2 pr-3 text-right">{brl(f.retencao_valor)}</td>
                  <td className="py-2 pr-3 text-right">{brl(f.vales_descontados)}</td>
                  <td className="py-2 pr-3 text-right font-semibold">{brl(f.valor_liquido)}</td>
                  <td className="py-2 pr-3 whitespace-nowrap text-xs text-ink-500">{dataHoraBR(f.fechado_em)}</td>
                  <td className="py-2 text-right">
                    <a href={`/contratos/fechamento/pdf?contrato=${f.contrato_id}&mes=${f.mes_referencia}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary font-semibold hover:underline">
                      <FileDown className="w-3.5 h-3.5" /> PDF
                    </a>
                  </td>
                </tr>
              ))}
            </TabelaPaginada>
        )}
      </section>
    </div>
  );
}
