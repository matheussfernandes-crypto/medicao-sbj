import fs from "node:fs";
import path from "node:path";
import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import type { Boletim } from "@/lib/contratos/boletim";

function logo(): string | undefined {
  try {
    return `data:image/png;base64,${fs.readFileSync(path.join(process.cwd(), "public", "logo-pdf.png")).toString("base64")}`;
  } catch {
    return undefined;
  }
}

// Helvetica padrão do PDF não tem ², ³ nem o sinal de menos tipográfico.
const t = (v: string | null | undefined) => (v ?? "").replace(/²/g, "2").replace(/³/g, "3").replace(/−/g, "-");
const f2 = (n: number) => (n ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fq = (n: number) => (n ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
const mesLabel = (m: string) => {
  const [a, mm] = m.split("-");
  return `${["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"][Number(mm) - 1]}/${a}`;
};

const s = StyleSheet.create({
  page: { padding: 22, fontSize: 7.5, fontFamily: "Helvetica", color: "#1f2733" },
  header: { flexDirection: "row", alignItems: "center", borderBottomWidth: 2, borderBottomColor: "#1c474f", paddingBottom: 6, marginBottom: 8 },
  logo: { width: 38, height: 38, marginRight: 10 },
  title: { fontSize: 12, fontWeight: 700, color: "#1c474f" },
  sub: { fontSize: 7.5, color: "#444", marginTop: 2 },
  right: { marginLeft: "auto", textAlign: "right", fontSize: 7, color: "#444" },
  info: { flexDirection: "row", flexWrap: "wrap", backgroundColor: "#eef3f4", padding: 6, marginBottom: 8, borderRadius: 3 },
  infoCell: { width: "33%", marginBottom: 2 },
  infoLbl: { fontSize: 6, color: "#65707d", textTransform: "uppercase" },
  infoVal: { fontSize: 8, fontWeight: 700 },
  section: { fontSize: 8, fontWeight: 700, textTransform: "uppercase", marginTop: 8, marginBottom: 3, color: "#16232e" },
  row: { flexDirection: "row" },
  th: { backgroundColor: "#1c474f", color: "#fff", fontSize: 6, fontWeight: 700, padding: 2.5, borderWidth: 0.5, borderColor: "#333", textAlign: "center" },
  td: { fontSize: 6.8, padding: 2.5, borderWidth: 0.5, borderColor: "#333" },
  num: { textAlign: "right" },
  hl: { backgroundColor: "#fff8d6" },
  tot: { fontSize: 7, padding: 2.5, borderWidth: 0.5, borderColor: "#333", fontWeight: 700, backgroundColor: "#eef1f4" },
  resumo: { width: 260, marginLeft: "auto", marginTop: 8 },
  resRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#999", paddingVertical: 2.5 },
  resLbl: { flex: 1 },
  resVal: { width: 90, textAlign: "right", fontWeight: 700 },
  liquido: { flexDirection: "row", backgroundColor: "#1c474f", color: "#fff", padding: 4, marginTop: 2 },
  note: { fontSize: 6.5, color: "#555", marginTop: 2 },
  ass: { flexDirection: "row", gap: 24, marginTop: 26 },
  assBox: { flex: 1, borderTopWidth: 1, borderTopColor: "#333", paddingTop: 3, fontSize: 7 },
});

const COLS = [
  { k: "codigo", t: "Item", w: 0.6 },
  { k: "descricao", t: "Serviço", w: 3.2 },
  { k: "unidade", t: "Un", w: 0.5 },
  { k: "qc", t: "Qtd contrat.", w: 0.9 },
  { k: "vu", t: "V. unit. (R$)", w: 0.9 },
  { k: "vc", t: "Valor contrat.", w: 1.1 },
  { k: "qa", t: "Anterior", w: 0.8 },
  { k: "qm", t: "Este mês", w: 0.8 },
  { k: "qac", t: "Acumulado", w: 0.8 },
  { k: "pe", t: "% exec.", w: 0.6 },
  { k: "qs", t: "Saldo", w: 0.8 },
  { k: "vm", t: "Valor do mês", w: 1.1 },
  { k: "vac", t: "Valor acumul.", w: 1.1 },
];

export function BoletimContratoPdf({ b, engenheiroNome, dataGeracao }: { b: Boletim; engenheiroNome: string; dataGeracao: string }) {
  const lg = logo();
  const c = b.contrato;
  const totMes = b.linhas.reduce((t, l) => t + l.valor_atual, 0);
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>
        <View style={s.header}>
          {lg ? <Image style={s.logo} src={lg} /> : null}
          <View>
            <Text style={s.title}>BOLETIM DE MEDIÇÃO — CONTRATO Nº {c.numero}</Text>
            <Text style={s.sub}>Mês de referência: {mesLabel(b.mes)} {b.fechamento ? "· FECHADO" : "· PRÉVIA (mês em aberto)"}</Text>
          </View>
          <View style={s.right}><Text>SBJ Construtora e Incorporadora</Text><Text>Gerado em {dataGeracao}</Text></View>
        </View>

        <View style={s.info}>
          <View style={s.infoCell}><Text style={s.infoLbl}>Obra</Text><Text style={s.infoVal}>{c.obras?.nome}</Text></View>
          <View style={s.infoCell}><Text style={s.infoLbl}>Empresa contratada</Text><Text style={s.infoVal}>{c.empresas_terceirizadas?.nome_empresarial || c.empresas_terceirizadas?.nome}</Text></View>
          <View style={s.infoCell}><Text style={s.infoLbl}>CNPJ</Text><Text style={s.infoVal}>{c.empresas_terceirizadas?.cnpj || "—"}</Text></View>
          <View style={s.infoCell}><Text style={s.infoLbl}>Objeto</Text><Text style={s.infoVal}>{t(c.objeto)}</Text></View>
          <View style={s.infoCell}><Text style={s.infoLbl}>Valor do contrato (atualizado)</Text><Text style={s.infoVal}>R$ {f2(b.valorContrato)}</Text></View>
          <View style={s.infoCell}><Text style={s.infoLbl}>Executado acumulado</Text><Text style={s.infoVal}>R$ {f2(b.valorAcumuladoTotal)} ({f2(b.valorContrato > 0 ? (b.valorAcumuladoTotal / b.valorContrato) * 100 : 0)}%)</Text></View>
        </View>

        <Text style={s.section}>Planilha de medição</Text>
        <View style={s.row}>
          {COLS.map((col) => <Text key={col.k} style={[s.th, { flex: col.w }]}>{col.t}</Text>)}
        </View>
        {b.linhas.map((l) => {
          const hl = l.qtd_atual > 0 ? s.hl : {};
          const v: Record<string, string> = {
            codigo: l.codigo ?? "", descricao: t(l.descricao) + (l.antecipado ? " (antecipado)" : ""), unidade: t(l.unidade),
            qc: fq(l.qtd_contratada), vu: f2(l.valor_unitario), vc: f2(l.valor_contratado),
            qa: fq(l.qtd_anterior), qm: fq(l.qtd_atual), qac: fq(l.qtd_acumulada),
            pe: `${f2(l.perc_executado)}%`, qs: fq(l.qtd_saldo), vm: f2(l.valor_atual), vac: f2(l.valor_acumulado),
          };
          return (
            <View style={s.row} key={l.item_id} wrap={false}>
              {COLS.map((col) => (
                <Text key={col.k} style={[s.td, hl, { flex: col.w }, ["codigo", "descricao", "unidade"].includes(col.k) ? {} : s.num]}>{v[col.k]}</Text>
              ))}
            </View>
          );
        })}
        <View style={s.row}>
          <Text style={[s.tot, { flex: 5.2 }]}>TOTAIS</Text>
          <Text style={[s.tot, s.num, { flex: 1.1 }]}>{f2(b.valorContrato)}</Text>
          <Text style={[s.tot, { flex: 3.8 }]}></Text>
          <Text style={[s.tot, s.num, { flex: 1.1 }]}>{f2(totMes)}</Text>
          <Text style={[s.tot, s.num, { flex: 1.1 }]}>{f2(b.valorAcumuladoTotal)}</Text>
        </View>
        {b.valesMedicao.length > 0 && (
          <Text style={s.note}>Itens marcados como "antecipado" tiveram parte paga por vale de medição no mês (R$ {f2(b.valeMedicaoBruto)} bruto, retenção R$ {f2(b.valeMedicaoRetido)}, líquido pago R$ {f2(b.valeMedicaoLiquido)}) — esse valor não é pago de novo neste boletim.</Text>
        )}

        <View style={{ flexDirection: "row", gap: 16 }} wrap={false}>
          <View style={{ flex: 1 }}>
            {b.glosas.length > 0 && (
              <>
                <Text style={s.section}>Glosas</Text>
                {b.glosas.map((g, i) => (
                  <Text key={i} style={s.note}>• {g.codigo} {t(g.descricao)}: medido {fq(g.medido)} {t(g.unidade)}, aprovado {fq(g.aprovado)} {t(g.unidade)} — {t(g.motivo)}</Text>
                ))}
              </>
            )}
            {b.retencoesDispensadas.length > 0 && (
              <>
                <Text style={s.section}>Retenção dispensada</Text>
                {b.retencoesDispensadas.map((r, i) => <Text key={i} style={s.note}>• Lançamento nº {r.numero}: {r.motivo}</Text>)}
              </>
            )}
            {b.vales.filter((v) => v.descontar_agora > 0).length > 0 && (
              <>
                <Text style={s.section}>Vales descontados</Text>
                {b.vales.filter((v) => v.descontar_agora > 0).map((v) => (
                  <Text key={v.vale_id} style={s.note}>• Vale nº {v.numero} de {v.data.split("-").reverse().join("/")}: R$ {f2(v.descontar_agora)}{v.restante_depois > 0 ? ` (restante R$ ${f2(v.restante_depois)} para o próximo mês)` : ""}</Text>
                ))}
              </>
            )}
          </View>
          <View style={s.resumo}>
            <Text style={s.section}>Resumo para pagamento</Text>
            <View style={s.resRow}><Text style={s.resLbl}>Valor bruto medido no mês</Text><Text style={s.resVal}>R$ {f2(b.bruto)}</Text></View>
            <View style={s.resRow}><Text style={s.resLbl}>(-) Retenção contratual</Text><Text style={s.resVal}>R$ {f2(b.retido)}</Text></View>
            <View style={s.resRow}><Text style={s.resLbl}>(-) Vales / adiantamentos</Text><Text style={s.resVal}>R$ {f2(b.valesDescontados)}</Text></View>
            <View style={s.liquido}><Text style={[s.resLbl, { fontWeight: 700 }]}>LÍQUIDO A PAGAR</Text><Text style={s.resVal}>R$ {f2(b.liquido)}</Text></View>
          </View>
        </View>

        <View style={s.ass} wrap={false}>
          <View style={s.assBox}><Text>Engenharia SBJ — conferido e aprovado</Text><Text style={{ fontWeight: 700, marginTop: 2 }}>{engenheiroNome}</Text></View>
          <View style={s.assBox}><Text>De acordo — empresa contratada</Text><Text style={{ fontWeight: 700, marginTop: 2 }}>{c.empresas_terceirizadas?.nome}</Text></View>
        </View>
      </Page>
    </Document>
  );
}
