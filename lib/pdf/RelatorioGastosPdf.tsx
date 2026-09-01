import fs from "node:fs";
import path from "node:path";
import { Document, Page, Text, View, Image, Svg, Path, Circle, Rect, StyleSheet } from "@react-pdf/renderer";

function getLogoSrc(): string | undefined {
  try {
    const logoPath = path.join(process.cwd(), "public", "logo-pdf.png");
    const base64 = fs.readFileSync(logoPath).toString("base64");
    return `data:image/png;base64,${base64}`;
  } catch {
    return undefined;
  }
}

function fmt(n: number | null | undefined) {
  return (n ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 9, fontFamily: "Helvetica", color: "#1f2733" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 2,
    borderBottomColor: "#1c474f",
    paddingBottom: 10,
    marginBottom: 14,
  },
  headerCenter: { flex: 1, alignItems: "center" },
  title: { fontSize: 13, fontWeight: 700, letterSpacing: 0.5, color: "#1f2733" },
  headerRight: { fontSize: 8, color: "#444", textAlign: "right" },
  logo: { width: 46, height: 46 },
  sectionTitle: {
    fontSize: 9,
    fontWeight: 700,
    textTransform: "uppercase",
    marginTop: 14,
    marginBottom: 5,
    color: "#16232e",
  },
  row: { flexDirection: "row" },
  th: {
    backgroundColor: "#1c474f",
    color: "#fff",
    fontSize: 7.5,
    fontWeight: 700,
    textTransform: "uppercase",
    padding: 5,
    borderWidth: 0.5,
    borderColor: "#333",
  },
  td: { fontSize: 8, padding: 5, borderWidth: 0.5, borderColor: "#333" },
  tdFirst: { fontSize: 8, padding: 5, borderWidth: 0.5, borderColor: "#333", color: "#1c474f", fontWeight: 700 },
  somaCell: { fontSize: 8, padding: 5, borderWidth: 0.5, borderColor: "#333", fontWeight: 700, backgroundColor: "#eef1f4" },
  somaFirst: { fontSize: 8, padding: 5, borderWidth: 0.5, borderColor: "#333", fontWeight: 700, backgroundColor: "#0e1820", color: "#fff" },
  totalBox: {
    marginTop: 14,
    backgroundColor: "#16232e",
    padding: 12,
    borderRadius: 4,
  },
  totalLabel: { fontSize: 8, color: "#cfd8de", textTransform: "uppercase" },
  totalValor: { fontSize: 16, fontWeight: 700, color: "#fff", marginTop: 2 },
  note: { fontSize: 7.5, color: "#65707d", marginTop: 10, lineHeight: 1.4 },
});

// Cores das fatias da composição — as mesmas do gráfico de pizza do dashboard
// web (components/GraficoPizza.tsx), pra bater visualmente com a tela.
const CORES_COMPOSICAO: Record<string, string> = {
  "Medições": "#2c6975",
  "Vales": "#f4dd3d",
  "Correções": "#c8763e",
  "Retidos": "#8a94a6",
};

function polarToCartesian(cx: number, cy: number, r: number, angleGraus: number) {
  const rad = ((angleGraus - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function fatiaPizzaPath(cx: number, cy: number, r: number, anguloInicial: number, anguloFinal: number) {
  const inicio = polarToCartesian(cx, cy, r, anguloInicial);
  const fim = polarToCartesian(cx, cy, r, anguloFinal);
  const largeArc = anguloFinal - anguloInicial <= 180 ? "0" : "1";
  return ["M", cx, cy, "L", inicio.x, inicio.y, "A", r, r, 0, largeArc, 1, fim.x, fim.y, "Z"].join(" ");
}

function GraficoPizzaPdf({ composicao }: { composicao: ItemComposicao[] }) {
  const cx = 45;
  const cy = 45;
  const r = 42;
  const total = composicao.reduce((s, c) => s + c.valor, 0);
  const comValor = composicao.filter((c) => c.valor > 0);
  let anguloAtual = 0;

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 18, marginTop: 4 }}>
      <Svg width={90} height={90} viewBox="0 0 90 90">
        {total <= 0 ? (
          <Circle cx={cx} cy={cy} r={r} fill="#e5e7eb" />
        ) : comValor.length === 1 ? (
          <Circle cx={cx} cy={cy} r={r} fill={CORES_COMPOSICAO[comValor[0].categoria] ?? "#8a94a6"} />
        ) : (
          comValor.map((c) => {
            const pct = c.valor / total;
            const anguloFinal = anguloAtual + pct * 360;
            const d = fatiaPizzaPath(cx, cy, r, anguloAtual, anguloFinal);
            anguloAtual = anguloFinal;
            return (
              <Path key={c.categoria} d={d} fill={CORES_COMPOSICAO[c.categoria] ?? "#8a94a6"} stroke="#fff" strokeWidth={1} />
            );
          })
        )}
      </Svg>
      <View style={{ gap: 4 }}>
        {composicao.map((c) => (
          <View key={c.categoria} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <View style={{ width: 8, height: 8, backgroundColor: CORES_COMPOSICAO[c.categoria] ?? "#8a94a6", borderRadius: 2 }} />
            <Text style={{ fontSize: 8 }}>
              {c.categoria} — R$ {fmt(c.valor)} ({c.pct.toFixed(1)}%)
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const LARGURA_BARRA = 470;

function BarraHorizontal({
  linhas,
  cor,
  formatarValor,
}: {
  linhas: { label: string; valor: number }[];
  cor: string;
  formatarValor: (v: number) => string;
}) {
  const max = Math.max(1, ...linhas.map((l) => l.valor));
  return (
    <View style={{ marginTop: 4, gap: 7 }}>
      {linhas.map((l, i) => {
        const largura = Math.max(2, (l.valor / max) * LARGURA_BARRA);
        return (
          <View key={i}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 7.5, color: "#444" }}>{l.label}</Text>
              <Text style={{ fontSize: 7.5, fontWeight: 700 }}>{formatarValor(l.valor)}</Text>
            </View>
            <Svg width={LARGURA_BARRA} height={8}>
              <Rect x={0} y={0} width={LARGURA_BARRA} height={8} fill="#eef1f4" rx={2} />
              <Rect x={0} y={0} width={largura} height={8} fill={cor} rx={2} />
            </Svg>
          </View>
        );
      })}
    </View>
  );
}

function Header({ titulo, dataGeracao }: { titulo: string; dataGeracao: string }) {
  const logoSrc = getLogoSrc();
  return (
    <View style={styles.header}>
      <View>{logoSrc ? <Image style={styles.logo} src={logoSrc} /> : null}</View>
      <View style={styles.headerCenter}>
        <Text style={styles.title}>{titulo}</Text>
      </View>
      <View style={styles.headerRight}>
        <Text>Data de geração: {dataGeracao}</Text>
      </View>
    </View>
  );
}

export type LinhaObra = {
  nome: string;
  medicao: number;
  valeReal: number;
  valeCorrecao: number;
  total: number;
};

export type LinhaMes = {
  mes: string;
  total: number;
};

export type ItemComposicao = {
  categoria: string;
  valor: number;
  pct: number;
};

export type LinhaEmpreiteiros = {
  nome: string;
  qtd: number;
};

export function RelatorioGastosPdf({
  mesLabel,
  linhasObra,
  totalGeral,
  linhasMes,
  composicao,
  linhasEmpreiteiros,
  totalEmpreiteiros,
  dataGeracao,
}: {
  mesLabel: string;
  linhasObra: LinhaObra[];
  totalGeral: number;
  linhasMes: LinhaMes[];
  composicao: ItemComposicao[];
  linhasEmpreiteiros: LinhaEmpreiteiros[];
  totalEmpreiteiros: number;
  dataGeracao: string;
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Header titulo={`RELATÓRIO DE GASTOS — ${mesLabel.toUpperCase()}`} dataGeracao={dataGeracao} />

        <View style={styles.totalBox}>
          <Text style={styles.totalLabel}>Total geral aprovado no mês</Text>
          <Text style={styles.totalValor}>R$ {fmt(totalGeral)}</Text>
        </View>

        <View wrap={false}>
          <Text style={styles.sectionTitle}>Composição do total aprovado — {mesLabel}</Text>
          <GraficoPizzaPdf composicao={composicao} />
          <View>
            <View style={styles.row}>
              <Text style={[styles.th, { flex: 3 }]}>Categoria</Text>
              <Text style={[styles.th, { flex: 2 }]}>Valor (R$)</Text>
              <Text style={[styles.th, { flex: 1.5 }]}>%</Text>
            </View>
            {composicao.map((c, i) => (
              <View style={styles.row} key={i}>
                <Text style={[styles.tdFirst, { flex: 3 }]}>{c.categoria}</Text>
                <Text style={[styles.td, { flex: 2 }]}>R$ {fmt(c.valor)}</Text>
                <Text style={[styles.td, { flex: 1.5 }]}>{c.pct.toFixed(1)}%</Text>
              </View>
            ))}
            <View style={styles.row}>
              <Text style={[styles.somaFirst, { flex: 3 }]}>SOMA</Text>
              <Text style={[styles.somaCell, { flex: 3.5 }]}>
                R$ {fmt(composicao.reduce((s, c) => s + c.valor, 0))}
              </Text>
            </View>
          </View>
        </View>

        <View wrap={false}>
          <Text style={styles.sectionTitle}>Empreiteiros por obra — {mesLabel}</Text>
          <View>
            <View style={styles.row}>
              <Text style={[styles.th, { flex: 4 }]}>Obra</Text>
              <Text style={[styles.th, { flex: 2 }]}>Empreiteiros</Text>
            </View>
            {linhasEmpreiteiros.map((l, i) => (
              <View style={styles.row} key={i}>
                <Text style={[styles.tdFirst, { flex: 4 }]}>{l.nome}</Text>
                <Text style={[styles.td, { flex: 2 }]}>{l.qtd}</Text>
              </View>
            ))}
            {linhasEmpreiteiros.length === 0 && (
              <View style={styles.row}>
                <Text style={[styles.td, { flex: 6 }]}>Nenhum empreiteiro com movimentação neste mês.</Text>
              </View>
            )}
            <View style={styles.row}>
              <Text style={[styles.somaFirst, { flex: 4 }]}>TOTAL GERAL (sem repetir entre obras)</Text>
              <Text style={[styles.somaCell, { flex: 2 }]}>{totalEmpreiteiros}</Text>
            </View>
          </View>
        </View>

        <View wrap={false}>
          <Text style={styles.sectionTitle}>Gasto por obra — {mesLabel}</Text>
          <BarraHorizontal
            linhas={linhasObra.map((l) => ({ label: l.nome, valor: l.total }))}
            cor="#1c474f"
            formatarValor={(v) => `R$ ${fmt(v)}`}
          />
          <View style={{ marginTop: 8 }}>
            <View style={styles.row}>
              <Text style={[styles.th, { flex: 2.5 }]}>Obra</Text>
              <Text style={[styles.th, { flex: 1.5 }]}>Medição</Text>
              <Text style={[styles.th, { flex: 1.5 }]}>Vale real</Text>
              <Text style={[styles.th, { flex: 1.5 }]}>Vale correção</Text>
              <Text style={[styles.th, { flex: 1.5 }]}>Total (R$)</Text>
            </View>
            {linhasObra.map((l, i) => (
              <View style={styles.row} key={i}>
                <Text style={[styles.tdFirst, { flex: 2.5 }]}>{l.nome}</Text>
                <Text style={[styles.td, { flex: 1.5 }]}>R$ {fmt(l.medicao)}</Text>
                <Text style={[styles.td, { flex: 1.5 }]}>R$ {fmt(l.valeReal)}</Text>
                <Text style={[styles.td, { flex: 1.5 }]}>R$ {fmt(l.valeCorrecao)}</Text>
                <Text style={[styles.td, { flex: 1.5, fontWeight: 700 }]}>R$ {fmt(l.total)}</Text>
              </View>
            ))}
            {linhasObra.length === 0 && (
              <View style={styles.row}>
                <Text style={[styles.td, { flex: 8.5 }]}>Nenhuma medição ou vale aprovado neste mês.</Text>
              </View>
            )}
            <View style={styles.row}>
              <Text style={[styles.somaFirst, { flex: 7 }]}>SOMA</Text>
              <Text style={[styles.somaCell, { flex: 1.5 }]}>R$ {fmt(totalGeral)}</Text>
            </View>
          </View>
        </View>

        <View wrap={false}>
          <Text style={styles.sectionTitle}>Evolução — últimos 6 meses (todas as obras)</Text>
          <BarraHorizontal
            linhas={linhasMes.map((l) => ({ label: l.mes, valor: l.total }))}
            cor="#c8763e"
            formatarValor={(v) => `R$ ${fmt(v)}`}
          />
          <View style={{ marginTop: 8 }}>
            <View style={styles.row}>
              <Text style={[styles.th, { flex: 4 }]}>Mês</Text>
              <Text style={[styles.th, { flex: 4 }]}>Total aprovado (R$)</Text>
            </View>
            {linhasMes.map((l, i) => (
              <View style={styles.row} key={i}>
                <Text style={[styles.tdFirst, { flex: 4 }]}>{l.mes}</Text>
                <Text style={[styles.td, { flex: 4 }]}>R$ {fmt(l.total)}</Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={styles.note}>
          Relatório gerado automaticamente a partir dos lançamentos com status APROVADO. Valores referem-se a
          medições e vales (real e correção) já aprovados pelo engenheiro responsável.
        </Text>
      </Page>
    </Document>
  );
}
