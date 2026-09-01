import fs from "fs";
import path from "path";
import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import type { LinhaRelatorio } from "@/app/(app)/manutencoes/historico/relatorio-dados";

function getLogoSrc(): string | undefined {
  try {
    const logoPath = path.join(process.cwd(), "public", "logo-pdf.png");
    return `data:image/png;base64,${fs.readFileSync(logoPath).toString("base64")}`;
  } catch {
    return undefined;
  }
}

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 9, fontFamily: "Helvetica" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  logo: { width: 90 },
  titulo: { fontSize: 14, fontWeight: 700, color: "#1c474f" },
  infoLinha: { fontSize: 8, color: "#65707d", marginTop: 2 },
  table: { marginTop: 10 },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#dfe3ea", paddingVertical: 4 },
  thRow: { flexDirection: "row", backgroundColor: "#f4f6f9", paddingVertical: 4 },
  th: { fontSize: 7.5, fontWeight: 700, color: "#65707d", textTransform: "uppercase" },
  td: { fontSize: 8 },
  resumo: { marginTop: 14, borderTopWidth: 1, borderTopColor: "#dfe3ea", paddingTop: 8 },
  resumoLinha: { flexDirection: "row", justifyContent: "space-between", marginTop: 2 },
});

const COLS = [
  { key: "data", label: "Data", w: "8%" },
  { key: "numeroOS", label: "Nº OS", w: "7%" },
  { key: "local", label: "Local", w: "22%" },
  { key: "categoria", label: "Categoria", w: "13%" },
  { key: "problema", label: "Problema", w: "12%" },
  { key: "servicoExecutado", label: "Serviço executado", w: "13%" },
  { key: "responsavel", label: "Responsável", w: "13%" },
  { key: "situacao", label: "Situação", w: "8%" },
  { key: "garantia", label: "Garantia", w: "12%" },
] as const;

export function HistoricoManutencoesPdf({
  linhas,
  resumo,
  filtrosTexto,
  dataEmissao,
}: {
  linhas: LinhaRelatorio[];
  resumo: { total: number; concluidos: number; emAndamento: number; pendentes: number; garantia: number; foraGarantia: number };
  filtrosTexto: string;
  dataEmissao: string;
}) {
  const logo = getLogoSrc();

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.titulo}>RELATÓRIO DE HISTÓRICO DE MANUTENÇÕES</Text>
            <Text style={styles.infoLinha}>Emitido em: {dataEmissao}</Text>
            <Text style={styles.infoLinha}>Filtros aplicados: {filtrosTexto || "nenhum"}</Text>
            <Text style={styles.infoLinha}>Quantidade de registros: {resumo.total}</Text>
          </View>
          {logo && <Image src={logo} style={styles.logo} />}
        </View>

        <View style={styles.table}>
          <View style={styles.thRow}>
            {COLS.map((c) => (
              <Text key={c.key} style={[styles.th, { width: c.w }]}>{c.label}</Text>
            ))}
          </View>
          {linhas.map((l, i) => (
            <View key={i} style={styles.tr}>
              {COLS.map((c) => (
                <Text key={c.key} style={[styles.td, { width: c.w }]}>
                  {c.key === "numeroOS" ? `#${l.numeroOS}` : String((l as any)[c.key] ?? "—")}
                </Text>
              ))}
            </View>
          ))}
        </View>

        <View style={styles.resumo}>
          <Text style={{ fontSize: 9, fontWeight: 700, color: "#1c474f" }}>Resumo</Text>
          <View style={styles.resumoLinha}><Text>Total de registros</Text><Text>{resumo.total}</Text></View>
          <View style={styles.resumoLinha}><Text>Concluídos</Text><Text>{resumo.concluidos}</Text></View>
          <View style={styles.resumoLinha}><Text>Em andamento</Text><Text>{resumo.emAndamento}</Text></View>
          <View style={styles.resumoLinha}><Text>Pendentes</Text><Text>{resumo.pendentes}</Text></View>
          <View style={styles.resumoLinha}><Text>Garantia</Text><Text>{resumo.garantia}</Text></View>
          <View style={styles.resumoLinha}><Text>Fora da garantia</Text><Text>{resumo.foraGarantia}</Text></View>
        </View>
      </Page>
    </Document>
  );
}
