import fs from "node:fs";
import path from "node:path";
import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";

function getLogoSrc(): string | undefined {
  try {
    const logoPath = path.join(process.cwd(), "public", "logo-pdf.png");
    return `data:image/png;base64,${fs.readFileSync(logoPath).toString("base64")}`;
  } catch { return undefined; }
}

function fmtReais(v: number) {
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtData(s: string) {
  const [y, m, d] = s.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export type MovimentacaoRetido = {
  data: string;
  tipo: string;
  referencia: string;
  descricao: string;
  obra: string | null;
  entrada: number;
  saida: number;
  saldo: number;
  responsavel: string | null;
};

export type PessoaExtrato = {
  id: string;
  nome: string;
  movimentacoes: MovimentacaoRetido[];
  totalEntradas: number;
  totalSaidas: number;
  saldoAtual: number;
};

const s = StyleSheet.create({
  page: { padding: 28, fontSize: 8.5, fontFamily: "Helvetica", color: "#1f2733" },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start",
    borderBottomWidth: 2, borderBottomColor: "#1c474f", paddingBottom: 8, marginBottom: 12,
  },
  logo: { width: 42, height: 42 },
  headerCenter: { flex: 1, alignItems: "center", paddingHorizontal: 8 },
  titulo: { fontSize: 12, fontWeight: 700, color: "#1c474f" },
  subtitulo: { fontSize: 8, color: "#555", marginTop: 2 },
  headerRight: { fontSize: 7.5, color: "#555", textAlign: "right" },
  nomePessoa: { fontSize: 11, fontWeight: 700, color: "#1c474f", marginBottom: 3 },
  infoRow: { flexDirection: "row", gap: 20, marginBottom: 10 },
  infoLabel: { fontSize: 7.5, color: "#888", textTransform: "uppercase" },
  infoVal: { fontSize: 8.5, fontWeight: 700, color: "#1f2733" },
  row: { flexDirection: "row" },
  th: { backgroundColor: "#1c474f", color: "#fff", fontSize: 6.5, fontWeight: 700, padding: 4, borderWidth: 0.4, borderColor: "#333", textTransform: "uppercase" },
  td: { fontSize: 7.5, padding: 4, borderWidth: 0.4, borderColor: "#ddd" },
  tdRight: { fontSize: 7.5, padding: 4, borderWidth: 0.4, borderColor: "#ddd", textAlign: "right" },
  tdSaldo: { fontSize: 7.5, padding: 4, borderWidth: 0.4, borderColor: "#ddd", textAlign: "right", fontWeight: 700 },
  tdEntrada: { fontSize: 7.5, padding: 4, borderWidth: 0.4, borderColor: "#ddd", textAlign: "right", color: "#1c6b30" },
  tdSaida: { fontSize: 7.5, padding: 4, borderWidth: 0.4, borderColor: "#ddd", textAlign: "right", color: "#b91c1c" },
  evenRow: { backgroundColor: "#f7f9fb" },
  totaisBox: { flexDirection: "row", marginTop: 8, gap: 6 },
  totalCard: { flex: 1, backgroundColor: "#1c474f", padding: 8, borderRadius: 3 },
  totalCardGreen: { flex: 1, backgroundColor: "#1c6b30", padding: 8, borderRadius: 3 },
  totalCardRed: { flex: 1, backgroundColor: "#7f1d1d", padding: 8, borderRadius: 3 },
  totalLabel: { fontSize: 7, color: "#c9e4ec", textTransform: "uppercase" },
  totalValor: { fontSize: 11, fontWeight: 700, color: "#fff", marginTop: 2 },
  sectionSep: { marginTop: 18, marginBottom: 6, borderTopWidth: 1, borderTopColor: "#c4d3db" },
  pessoaNomeGeral: { fontSize: 9.5, fontWeight: 700, color: "#1c474f", marginBottom: 2 },
  badgeOk: { color: "#1c6b30", fontSize: 7, fontWeight: 700 },
  badgeZero: { color: "#999", fontSize: 7 },
});

function Header({ titulo, subtitulo, dataGeracao }: { titulo: string; subtitulo?: string; dataGeracao: string }) {
  const logo = getLogoSrc();
  return (
    <View style={s.header}>
      <View>{logo ? <Image style={s.logo} src={logo} /> : null}</View>
      <View style={s.headerCenter}>
        <Text style={s.titulo}>{titulo}</Text>
        {subtitulo ? <Text style={s.subtitulo}>{subtitulo}</Text> : null}
      </View>
      <View style={s.headerRight}>
        <Text>SBJ Construtora e Incorporadora</Text>
        <Text style={{ marginTop: 2 }}>Emitido em: {dataGeracao}</Text>
      </View>
    </View>
  );
}

function TabelaExtrato({ movs }: { movs: MovimentacaoRetido[] }) {
  const cols = [
    { label: "Data", w: "7%" },
    { label: "Obra", w: "14%" },
    { label: "Referência", w: "11%" },
    { label: "Descrição", w: "30%" },
    { label: "Entrada", w: "10%" },
    { label: "Saída", w: "10%" },
    { label: "Saldo", w: "10%" },
    { label: "Responsável", w: "8%" },
  ];
  return (
    <View>
      <View style={s.row}>
        {cols.map((c) => (
          <Text key={c.label} style={[s.th, { width: c.w }]}>{c.label}</Text>
        ))}
      </View>
      {movs.map((m, i) => (
        <View key={i} style={[s.row, i % 2 === 1 ? s.evenRow : {}]}>
          <Text style={[s.td, { width: "7%" }]}>{fmtData(m.data)}</Text>
          <Text style={[s.td, { width: "14%" }]}>{m.obra ?? "—"}</Text>
          <Text style={[s.td, { width: "11%" }]}>{m.referencia}</Text>
          <Text style={[s.td, { width: "30%" }]}>{m.descricao}</Text>
          <Text style={[m.entrada > 0 ? s.tdEntrada : s.tdRight, { width: "10%" }]}>
            {m.entrada > 0 ? fmtReais(m.entrada) : "—"}
          </Text>
          <Text style={[m.saida > 0 ? s.tdSaida : s.tdRight, { width: "10%" }]}>
            {m.saida > 0 ? fmtReais(m.saida) : "—"}
          </Text>
          <Text style={[s.tdSaldo, { width: "10%" }]}>{fmtReais(m.saldo)}</Text>
          <Text style={[s.td, { width: "8%" }]}>{m.responsavel ?? "—"}</Text>
        </View>
      ))}
    </View>
  );
}

function Totais({ entradas, saidas, saldo }: { entradas: number; saidas: number; saldo: number }) {
  return (
    <View style={s.totaisBox}>
      <View style={s.totalCardGreen}>
        <Text style={s.totalLabel}>Total de Entradas</Text>
        <Text style={s.totalValor}>{fmtReais(entradas)}</Text>
      </View>
      <View style={s.totalCardRed}>
        <Text style={s.totalLabel}>Total de Saídas</Text>
        <Text style={s.totalValor}>{fmtReais(saidas)}</Text>
      </View>
      <View style={s.totalCard}>
        <Text style={s.totalLabel}>Saldo Atual de Retidos</Text>
        <Text style={s.totalValor}>{fmtReais(saldo)}</Text>
      </View>
    </View>
  );
}

// ─── PDF INDIVIDUAL ────────────────────────────────────────────────────────────
export function ExtratoIndividualPdf({
  pessoa,
  periodo,
  dataGeracao,
}: {
  pessoa: PessoaExtrato;
  periodo: string;
  dataGeracao: string;
}) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>
        <Header titulo="Extrato de Retidos" subtitulo="SBJ Construtora e Incorporadora" dataGeracao={dataGeracao} />
        <Text style={s.nomePessoa}>{pessoa.nome}</Text>
        <View style={s.infoRow}>
          <View>
            <Text style={s.infoLabel}>Período</Text>
            <Text style={s.infoVal}>{periodo}</Text>
          </View>
          <View>
            <Text style={s.infoLabel}>Movimentações</Text>
            <Text style={s.infoVal}>{pessoa.movimentacoes.length}</Text>
          </View>
        </View>
        <TabelaExtrato movs={pessoa.movimentacoes} />
        <Totais entradas={pessoa.totalEntradas} saidas={pessoa.totalSaidas} saldo={pessoa.saldoAtual} />
      </Page>
    </Document>
  );
}

// ─── PDF GERAL ─────────────────────────────────────────────────────────────────
export function ExtratoGeralPdf({
  pessoas,
  periodo,
  dataGeracao,
}: {
  pessoas: PessoaExtrato[];
  periodo: string;
  dataGeracao: string;
}) {
  const totalEntradas = pessoas.reduce((a, p) => a + p.totalEntradas, 0);
  const totalSaidas = pessoas.reduce((a, p) => a + p.totalSaidas, 0);
  const totalSaldo = pessoas.reduce((a, p) => a + p.saldoAtual, 0);

  return (
    <Document>
      {/* Página 1: Resumo */}
      <Page size="A4" style={s.page}>
        <Header titulo="Relatório Geral de Retidos" subtitulo={`Período: ${periodo}`} dataGeracao={dataGeracao} />
        {/* Tabela resumo */}
        <View style={s.row}>
          {["Empreiteiro", "Movimentações", "Total Entradas", "Total Saídas", "Saldo Atual"].map((c, i) => (
            <Text key={c} style={[s.th, { flex: i === 0 ? 3 : 1 }]}>{c}</Text>
          ))}
        </View>
        {pessoas.map((p, i) => (
          <View key={p.id} style={[s.row, i % 2 === 1 ? s.evenRow : {}]}>
            <Text style={[s.td, { flex: 3 }]}>{p.nome}</Text>
            <Text style={[s.tdRight, { flex: 1 }]}>{p.movimentacoes.length}</Text>
            <Text style={[s.tdEntrada, { flex: 1 }]}>{fmtReais(p.totalEntradas)}</Text>
            <Text style={[s.tdSaida, { flex: 1 }]}>{fmtReais(p.totalSaidas)}</Text>
            <Text style={[s.tdSaldo, { flex: 1 }]}>{fmtReais(p.saldoAtual)}</Text>
          </View>
        ))}
        <Totais entradas={totalEntradas} saidas={totalSaidas} saldo={totalSaldo} />
      </Page>
      {/* Páginas seguintes: extrato por pessoa */}
      {pessoas.filter(p => p.movimentacoes.length > 0).map((p) => (
        <Page key={p.id} size="A4" orientation="landscape" style={s.page}>
          <Header titulo="Extrato de Retidos" subtitulo={`Período: ${periodo}`} dataGeracao={dataGeracao} />
          <Text style={s.nomePessoa}>{p.nome}</Text>
          <TabelaExtrato movs={p.movimentacoes} />
          <Totais entradas={p.totalEntradas} saidas={p.totalSaidas} saldo={p.saldoAtual} />
        </Page>
      ))}
    </Document>
  );
}
