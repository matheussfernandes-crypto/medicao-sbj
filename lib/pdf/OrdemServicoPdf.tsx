import fs from "fs";
import path from "path";
import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";

function getLogoSrc(): string | undefined {
  try {
    const logoPath = path.join(process.cwd(), "public", "logo-pdf.png");
    return `data:image/png;base64,${fs.readFileSync(logoPath).toString("base64")}`;
  } catch {
    return undefined;
  }
}

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 9, fontFamily: "Helvetica", color: "#1c1c1c" },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#dfe3ea",
    paddingBottom: 10,
  },
  logo: { width: 80 },
  titulo: { fontSize: 15, fontWeight: 700, color: "#1c474f" },
  infoLinha: { fontSize: 8, color: "#65707d", marginTop: 2 },
  badge: { fontSize: 8, fontWeight: 700, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 3, color: "#fff", marginTop: 6 },
  secao: { marginTop: 10 },
  secaoTitulo: { fontSize: 10, fontWeight: 700, color: "#1c474f", marginBottom: 4, textTransform: "uppercase" },
  grid2: { flexDirection: "row", gap: 16 },
  col: { flex: 1 },
  linha: { fontSize: 9, marginTop: 2 },
  label: { color: "#65707d" },
  fotosGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
  fotoBox: { width: "31%" },
  foto: { width: "100%", height: 110, objectFit: "cover", borderRadius: 3, borderWidth: 1, borderColor: "#dfe3ea" },
  fotoLegenda: { fontSize: 7, color: "#65707d", marginTop: 2, textAlign: "center" },
});

const STATUS_COR_PDF: Record<string, string> = {
  ABERTA: "#b45309",
  AGENDADA: "#b45309",
  EM_ANDAMENTO: "#b45309",
  AGUARDANDO_MATERIAL: "#b45309",
  AGUARDANDO_EMPRESA: "#b45309",
  AGUARDANDO_APROVACAO: "#b45309",
  CONCLUIDA: "#15803d",
  CANCELADA: "#6b7280",
  GARANTIA_NEGADA: "#b91c1c",
};

export type OSPdfDados = {
  numeroOS: number;
  criadoEm: string;
  obraNome: string;
  local: string;
  status: string;
  statusLabel: string;
  prioridadeLabel: string;
  solicitanteNome: string;
  solicitanteTelefone: string | null;
  solicitanteTipoLabel: string;
  origemLabel: string;
  categoriaLabel: string;
  problemaLabel: string;
  descricao: string | null;
  responsavel: string | null;
  servicoExecutadoLabel: string | null;
  garantiaLabel: string | null;
  materiaisUtilizados: string | null;
  observacaoTecnica: string | null;
  motivoReprovacao: string | null;
  fotos: { url: string; legenda: string }[];
  dataEmissao: string;
};

export function OrdemServicoPdf({ dados }: { dados: OSPdfDados }) {
  const logo = getLogoSrc();

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.titulo}>ORDEM DE SERVIÇO Nº {dados.numeroOS}</Text>
            <Text style={styles.infoLinha}>{dados.obraNome} — criada em {dados.criadoEm}</Text>
            <Text style={styles.infoLinha}>Emitido em: {dados.dataEmissao}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            {logo && <Image src={logo} style={styles.logo} />}
            <Text style={[styles.badge, { backgroundColor: STATUS_COR_PDF[dados.status] ?? "#65707d" }]}>
              {dados.statusLabel}
            </Text>
          </View>
        </View>

        <View style={styles.secao} wrap={false}>
          <Text style={styles.secaoTitulo}>Solicitante</Text>
          <View style={styles.grid2}>
            <View style={styles.col}>
              <Text style={styles.linha}><Text style={styles.label}>Nome: </Text>{dados.solicitanteNome}</Text>
              <Text style={styles.linha}><Text style={styles.label}>Telefone: </Text>{dados.solicitanteTelefone ?? "—"}</Text>
            </View>
            <View style={styles.col}>
              <Text style={styles.linha}><Text style={styles.label}>Tipo: </Text>{dados.solicitanteTipoLabel}</Text>
              <Text style={styles.linha}><Text style={styles.label}>Origem: </Text>{dados.origemLabel}</Text>
            </View>
          </View>
        </View>

        <View style={styles.secao} wrap={false}>
          <Text style={styles.secaoTitulo}>Local e problema</Text>
          <Text style={styles.linha}><Text style={styles.label}>Local: </Text>{dados.local}</Text>
          <View style={styles.grid2}>
            <Text style={[styles.linha, styles.col]}><Text style={styles.label}>Categoria: </Text>{dados.categoriaLabel}</Text>
            <Text style={[styles.linha, styles.col]}><Text style={styles.label}>Problema: </Text>{dados.problemaLabel}</Text>
          </View>
          <Text style={styles.linha}><Text style={styles.label}>Prioridade: </Text>{dados.prioridadeLabel}</Text>
          {dados.descricao && <Text style={styles.linha}><Text style={styles.label}>Descrição: </Text>{dados.descricao}</Text>}
        </View>

        <View style={styles.secao} wrap={false}>
          <Text style={styles.secaoTitulo}>Execução</Text>
          <Text style={styles.linha}><Text style={styles.label}>Responsável: </Text>{dados.responsavel ?? "Não atribuído"}</Text>
          {dados.servicoExecutadoLabel && (
            <Text style={styles.linha}><Text style={styles.label}>Serviço executado: </Text>{dados.servicoExecutadoLabel}</Text>
          )}
          {dados.garantiaLabel && (
            <Text style={styles.linha}><Text style={styles.label}>Garantia: </Text>{dados.garantiaLabel}</Text>
          )}
          {dados.materiaisUtilizados && (
            <Text style={styles.linha}><Text style={styles.label}>Materiais utilizados: </Text>{dados.materiaisUtilizados}</Text>
          )}
          {dados.observacaoTecnica && (
            <Text style={styles.linha}><Text style={styles.label}>Observação técnica: </Text>{dados.observacaoTecnica}</Text>
          )}
          {dados.motivoReprovacao && (
            <Text style={styles.linha}><Text style={styles.label}>Motivo da reprovação: </Text>{dados.motivoReprovacao}</Text>
          )}
        </View>

        {dados.fotos.length > 0 && (
          <View style={styles.secao} wrap={false}>
            <Text style={styles.secaoTitulo}>Fotos ({dados.fotos.length})</Text>
            <View style={styles.fotosGrid}>
              {dados.fotos.map((f, i) => (
                <View key={i} style={styles.fotoBox}>
                  <Image src={f.url} style={styles.foto} />
                  <Text style={styles.fotoLegenda}>{f.legenda}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </Page>
    </Document>
  );
}
