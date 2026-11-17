import fs from "node:fs";
import path from "node:path";
import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import type { FechamentoVale } from "@/lib/contratos/fechamentoVale";

function logo(): string | undefined {
  try {
    return `data:image/png;base64,${fs.readFileSync(path.join(process.cwd(), "public", "logo-pdf.png")).toString("base64")}`;
  } catch {
    return undefined;
  }
}

const t = (v: string | null | undefined) => (v ?? "").replace(/²/g, "2").replace(/³/g, "3").replace(/−/g, "-");
const f2 = (n: number) => (n ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const mesLabel = (m: string) => {
  const [a, mm] = m.split("-");
  return `${["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"][Number(mm) - 1]}/${a}`;
};
const dataBR = (d: string) => (d ? d.slice(0, 10).split("-").reverse().join("/") : "");

const s = StyleSheet.create({
  page: { padding: 22, fontSize: 8, fontFamily: "Helvetica", color: "#1f2733" },
  header: { flexDirection: "row", alignItems: "center", borderBottomWidth: 2, borderBottomColor: "#1c474f", paddingBottom: 6, marginBottom: 10 },
  logo: { width: 38, height: 38, marginRight: 10 },
  title: { fontSize: 12, fontWeight: 700, color: "#1c474f" },
  sub: { fontSize: 7.5, color: "#444", marginTop: 2 },
  right: { marginLeft: "auto", textAlign: "right", fontSize: 7, color: "#444" },
  info: { flexDirection: "row", flexWrap: "wrap", backgroundColor: "#eef3f4", padding: 6, marginBottom: 10, borderRadius: 3 },
  infoCell: { width: "25%", marginBottom: 3 },
  infoLbl: { fontSize: 6, color: "#65707d", textTransform: "uppercase" },
  infoVal: { fontSize: 8.5, fontWeight: 700 },
  section: { fontSize: 8.5, fontWeight: 700, textTransform: "uppercase", marginBottom: 4, color: "#16232e" },
  row: { flexDirection: "row" },
  th: { backgroundColor: "#1c474f", color: "#fff", fontSize: 7, fontWeight: 700, padding: 3, borderWidth: 0.5, borderColor: "#333", textAlign: "center" },
  td: { fontSize: 7.5, padding: 3, borderWidth: 0.5, borderColor: "#333" },
  num: { textAlign: "right" },
  tot: { fontSize: 8, padding: 3, borderWidth: 0.5, borderColor: "#333", fontWeight: 700, backgroundColor: "#1c474f", color: "#fff" },
  note: { fontSize: 6.8, color: "#555", marginTop: 6 },
  ass: { flexDirection: "row", gap: 24, marginTop: 36 },
  assBox: { flex: 1, borderTopWidth: 1, borderTopColor: "#333", paddingTop: 3, fontSize: 7.5 },
});

export function FechamentoValePdf({ f, engenheiroNome, dataGeracao }: { f: FechamentoVale; engenheiroNome: string; dataGeracao: string }) {
  const lg = logo();
  const c = f.contrato;
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>
        <View style={s.header}>
          {lg ? <Image style={s.logo} src={lg} /> : null}
          <View>
            <Text style={s.title}>FECHAMENTO DE VALES — CONTRATO Nº {c.numero}</Text>
            <Text style={s.sub}>Mês de referência: {mesLabel(f.mes)} {f.fechamento ? "· FECHADO" : "· PRÉVIA (vales do mês ainda não fechados)"}</Text>
          </View>
          <View style={s.right}><Text>SBJ Construtora e Incorporadora</Text><Text>Gerado em {dataGeracao}</Text></View>
        </View>

        <View style={s.info}>
          <View style={s.infoCell}><Text style={s.infoLbl}>Obra</Text><Text style={s.infoVal}>{c.obras?.nome}</Text></View>
          <View style={s.infoCell}><Text style={s.infoLbl}>Empresa contratada</Text><Text style={s.infoVal}>{c.empresas_terceirizadas?.nome_empresarial || c.empresas_terceirizadas?.nome}</Text></View>
          <View style={s.infoCell}><Text style={s.infoLbl}>CNPJ</Text><Text style={s.infoVal}>{c.empresas_terceirizadas?.cnpj || "—"}</Text></View>
          <View style={s.infoCell}><Text style={s.infoLbl}>Objeto</Text><Text style={s.infoVal}>{t(c.objeto)}</Text></View>
        </View>

        <Text style={s.section}>Vales (adiantamentos) pagos no mês</Text>
        <View style={s.row} wrap={false}>
          <Text style={[s.th, { flex: 0.8 }]}>Vale nº</Text>
          <Text style={[s.th, { flex: 1 }]}>Data</Text>
          <Text style={[s.th, { flex: 4 }]}>Observação</Text>
          <Text style={[s.th, { flex: 1.3 }]}>Valor (R$)</Text>
        </View>
        {f.vales.map((v) => (
          <View style={s.row} key={v.id} wrap={false}>
            <Text style={[s.td, { flex: 0.8, textAlign: "center" }]}>{v.numero}</Text>
            <Text style={[s.td, { flex: 1, textAlign: "center" }]}>{dataBR(v.data)}</Text>
            <Text style={[s.td, { flex: 4 }]}>{t(v.observacao) || "-"}</Text>
            <Text style={[s.td, s.num, { flex: 1.3 }]}>{f2(v.valor)}</Text>
          </View>
        ))}
        {!f.vales.length && (
          <View style={s.row}><Text style={[s.td, { flex: 1, textAlign: "center", color: "#777" }]}>Nenhum vale aprovado neste mês.</Text></View>
        )}
        <View style={s.row} wrap={false}>
          <Text style={[s.tot, { flex: 5.8 }]}>VALOR TOTAL DE VALES A PAGAR ({f.vales.length})</Text>
          <Text style={[s.tot, s.num, { flex: 1.3 }]}>{f2(f.total)}</Text>
        </View>
        <Text style={s.note}>Os vales são adiantamentos: serão descontados do líquido da medição deste contrato no fechamento do mês (o que não couber passa para o mês seguinte).</Text>

        <View style={s.ass} wrap={false}>
          <View style={s.assBox}><Text>Engenharia SBJ — conferido e aprovado</Text><Text style={{ fontWeight: 700, marginTop: 2 }}>{engenheiroNome}</Text></View>
          <View style={s.assBox}><Text>Recebido — empresa contratada</Text><Text style={{ fontWeight: 700, marginTop: 2 }}>{c.empresas_terceirizadas?.nome}</Text></View>
        </View>
      </Page>
    </Document>
  );
}
