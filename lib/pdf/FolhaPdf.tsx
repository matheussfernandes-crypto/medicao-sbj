import fs from "node:fs";
import path from "node:path";
import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";

// Logo "limpa" (sem contorno branco) usada nas folhas de PDF — fundo branco.
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
  page: { padding: 22, fontSize: 8, fontFamily: "Helvetica", color: "#1f2733" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 2,
    borderBottomColor: "#1c474f",
    paddingBottom: 7,
    marginBottom: 9,
  },
  headerCenter: { flex: 1, alignItems: "center" },
  title: { fontSize: 11.5, fontWeight: 700, letterSpacing: 0.5, color: "#1f2733" },
  sub: { fontSize: 7, color: "#555", marginTop: 2 },
  headerRight: { fontSize: 7, color: "#444", textAlign: "right" },
  logo: { width: 36, height: 36 },
  sectionTitle: {
    fontSize: 8,
    fontWeight: 700,
    textTransform: "uppercase",
    marginTop: 8,
    marginBottom: 3,
    color: "#16232e",
  },
  row: { flexDirection: "row" },
  th: {
    backgroundColor: "#1c474f",
    color: "#fff",
    fontSize: 6.5,
    fontWeight: 700,
    textTransform: "uppercase",
    padding: 3,
    borderWidth: 0.5,
    borderColor: "#333",
  },
  thResumo: {
    backgroundColor: "#16232e",
    color: "#fff",
    fontSize: 6.5,
    fontWeight: 700,
    textTransform: "uppercase",
    padding: 3,
    borderWidth: 0.5,
    borderColor: "#333",
  },
  td: { fontSize: 7, padding: 3, borderWidth: 0.5, borderColor: "#333" },
  tdFirst: { fontSize: 7, padding: 3, borderWidth: 0.5, borderColor: "#333", color: "#1c474f", fontWeight: 700 },
  somaCell: { fontSize: 7, padding: 3, borderWidth: 0.5, borderColor: "#333", fontWeight: 700, backgroundColor: "#eef1f4" },
  somaFirst: { fontSize: 7, padding: 3, borderWidth: 0.5, borderColor: "#333", fontWeight: 700, backgroundColor: "#0e1820", color: "#fff" },
  note: { fontSize: 6.5, color: "#65707d", marginTop: 6, lineHeight: 1.3 },
  assinaturas: { flexDirection: "row", justifyContent: "space-between", marginTop: 18, gap: 16 },
  assinatura: { flex: 1 },
  linha: { borderTopWidth: 1, borderTopColor: "#333", marginTop: 16, paddingTop: 3 },
  rotulo: { fontSize: 6.5, color: "#444" },
  nomeAssinatura: { fontSize: 7, fontWeight: 700, marginTop: 2 },
});

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

function Assinaturas({
  mestreNome,
  lancadores,
  engenheiroNome,
  dataAssinatura,
}: {
  mestreNome: string | null;
  lancadores: string[];
  engenheiroNome: string;
  dataAssinatura: string;
}) {
  const lancadoresTexto = lancadores.length ? lancadores.join(", ") : "—";
  return (
    <View style={styles.assinaturas}>
      <View style={styles.assinatura}>
        <View style={styles.linha}>
          <Text style={styles.rotulo}>Medição realizada e conferida por (Mestre):</Text>
          <Text style={styles.nomeAssinatura}>
            {mestreNome ? `Assinado digitalmente por: ${mestreNome}` : "(Mestre não cadastrado nesta obra)"}
          </Text>
          <Text style={styles.rotulo}>Data: {dataAssinatura}</Text>
        </View>
      </View>
      <View style={styles.assinatura}>
        <View style={styles.linha}>
          <Text style={styles.rotulo}>Lançado e conferido por (Estagiário):</Text>
          <Text style={styles.nomeAssinatura}>
            {lancadoresTexto !== "—" ? `Assinado digitalmente por: ${lancadoresTexto}` : "—"}
          </Text>
          <Text style={styles.rotulo}>Data: {dataAssinatura}</Text>
        </View>
      </View>
      <View style={styles.assinatura}>
        <View style={styles.linha}>
          <Text style={styles.rotulo}>Conferido e aprovado por (Engenheiro):</Text>
          <Text style={styles.nomeAssinatura}>{engenheiroNome}</Text>
          <Text style={styles.rotulo}>Data: {dataAssinatura}</Text>
        </View>
      </View>
    </View>
  );
}

export type ItemMedicao = {
  empreiteiro: string;
  servico: string;
  local: string;
  valorUnitario: number;
  quantidadeTexto: string;
  total: number;
};

export type ResumoMedicao = {
  nome: string;
  retido: number;
  pct: number;
  total: number;
  vale: number;
  totalPagar: number;
};

export function FolhaMedicaoPdf({
  obraNome,
  mes,
  itens,
  resumo,
  somaTotal,
  somaRetido,
  somaVale,
  somaPagar,
  mestreNome,
  lancadores,
  engenheiroNome,
  dataGeracao,
}: {
  obraNome: string;
  mes: string;
  itens: ItemMedicao[];
  resumo: ResumoMedicao[];
  somaTotal: number;
  somaRetido: number;
  somaVale: number;
  somaPagar: number;
  mestreNome: string | null;
  lancadores: string[];
  engenheiroNome: string;
  dataGeracao: string;
}) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Header titulo={`RELATÓRIO MEDIÇÃO ${obraNome.toUpperCase()} — ${mes}`} dataGeracao={dataGeracao} />

        <Text style={styles.sectionTitle}>Itens detalhados da medição</Text>
        <View>
          <View style={styles.row}>
            <Text style={[styles.th, { flex: 2 }]}>Empreiteiro</Text>
            <Text style={[styles.th, { flex: 2 }]}>Descrição</Text>
            <Text style={[styles.th, { flex: 1.5 }]}>Local</Text>
            <Text style={[styles.th, { flex: 1.3 }]}>Valor unitário</Text>
            <Text style={[styles.th, { flex: 1.5 }]}>Quantidade</Text>
            <Text style={[styles.th, { flex: 1.3 }]}>Total (R$)</Text>
          </View>
          {itens.map((it, i) => (
            <View style={styles.row} key={i}>
              <Text style={[styles.tdFirst, { flex: 2 }]}>{it.empreiteiro}</Text>
              <Text style={[styles.td, { flex: 2 }]}>{it.servico}</Text>
              <Text style={[styles.td, { flex: 1.5 }]}>{it.local || "—"}</Text>
              <Text style={[styles.td, { flex: 1.3 }]}>R$ {fmt(it.valorUnitario)}</Text>
              <Text style={[styles.td, { flex: 1.5 }]}>{it.quantidadeTexto}</Text>
              <Text style={[styles.td, { flex: 1.3 }]}>R$ {fmt(it.total)}</Text>
            </View>
          ))}
          <View style={styles.row}>
            <Text style={[styles.somaFirst, { flex: 8.3 }]}>SOMA</Text>
            <Text style={[styles.somaCell, { flex: 1.3 }]}>R$ {fmt(somaTotal)}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Resumo por empreiteiro</Text>
        <View wrap={false}>
          <View style={styles.row}>
            <Text style={[styles.thResumo, { flex: 2 }]}>Empreiteiro</Text>
            <Text style={[styles.thResumo, { flex: 1.6 }]}>Retido</Text>
            <Text style={[styles.thResumo, { flex: 1.6 }]}>Total</Text>
            <Text style={[styles.thResumo, { flex: 1.6 }]}>Vale</Text>
            <Text style={[styles.thResumo, { flex: 1.6 }]}>Total a pagar (R$)</Text>
          </View>
          {resumo.map((r, i) => (
            <View style={styles.row} key={i}>
              <Text style={[styles.tdFirst, { flex: 2 }]}>{r.nome}</Text>
              <Text style={[styles.td, { flex: 1.6 }]}>R$ {fmt(r.retido)} ({(r.pct * 100).toFixed(0)}%)</Text>
              <Text style={[styles.td, { flex: 1.6 }]}>R$ {fmt(r.total)}</Text>
              <Text style={[styles.td, { flex: 1.6 }]}>R$ {fmt(r.vale)}</Text>
              <Text style={[styles.td, { flex: 1.6, fontWeight: 700 }]}>R$ {fmt(r.totalPagar)}</Text>
            </View>
          ))}
          <View style={styles.row}>
            <Text style={[styles.somaFirst, { flex: 2 }]}>SOMA</Text>
            <Text style={[styles.somaCell, { flex: 1.6 }]}>R$ {fmt(somaRetido)}</Text>
            <Text style={[styles.somaCell, { flex: 1.6 }]}>R$ {fmt(somaTotal)}</Text>
            <Text style={[styles.somaCell, { flex: 1.6 }]}>R$ {fmt(somaVale)}</Text>
            <Text style={[styles.somaCell, { flex: 1.6 }]}>R$ {fmt(somaPagar)}</Text>
          </View>
        </View>

        <Text style={styles.note}>
          Só o Vale Real é descontado aqui. Vale de correção de medição já foi pago líquido (bruto − retenção do
          próprio item) no momento do lançamento e não entra de novo neste fechamento.
        </Text>

        <Assinaturas
          mestreNome={mestreNome}
          lancadores={lancadores}
          engenheiroNome={engenheiroNome}
          dataAssinatura={dataGeracao}
        />
      </Page>
    </Document>
  );
}

export type ItemVale = {
  empreiteiro: string;
  descricao: string;
  ehCorrecao: boolean;
  total: number;
  hibrido?: boolean;
  medicaoComplementarBruto?: number;
  medicaoComplementarRetido?: number;
  medicaoComplementarLiquido?: number;
  valorValeHibrido?: number;
};

export type ResumoVale = {
  nome: string;
  valeReal: number;
  correcaoBruto: number;
  correcaoRetido: number;
  correcaoLiquido: number;
  totalGeral: number;
};

export function FolhaValePdf({
  obraNome,
  mes,
  itens,
  resumo,
  somaReal,
  somaCorrecaoBruto,
  somaCorrecaoRetido,
  somaCorrecaoLiquido,
  somaGeral,
  mestreNome,
  lancadores,
  engenheiroNome,
  dataGeracao,
}: {
  obraNome: string;
  mes: string;
  itens: ItemVale[];
  resumo: ResumoVale[];
  somaReal: number;
  somaCorrecaoBruto: number;
  somaCorrecaoRetido: number;
  somaCorrecaoLiquido: number;
  somaGeral: number;
  mestreNome: string | null;
  lancadores: string[];
  engenheiroNome: string;
  dataGeracao: string;
}) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Header titulo={`RELATÓRIO VALE ${obraNome.toUpperCase()} — ${mes}`} dataGeracao={dataGeracao} />

        <Text style={styles.sectionTitle}>Itens lançados no mês</Text>
        <View>
          <View style={styles.row}>
            <Text style={[styles.th, { flex: 2 }]}>Empreiteiro</Text>
            <Text style={[styles.th, { flex: 2 }]}>Empreendimento</Text>
            <Text style={[styles.th, { flex: 2.5 }]}>Descrição</Text>
            <Text style={[styles.th, { flex: 1.3 }]}>Total valor (R$)</Text>
          </View>
          {itens.map((it, i) => (
            <View style={styles.row} key={i}>
              <Text style={[styles.tdFirst, { flex: 2 }]}>{it.empreiteiro}</Text>
              <Text style={[styles.td, { flex: 2 }]}>{obraNome}</Text>
              <Text style={[styles.td, { flex: 2.5 }]}>
                {it.ehCorrecao
                  ? it.descricao
                  : it.hibrido
                  ? `VALE (R$ ${fmt(it.valorValeHibrido)}) + MEDIÇÃO COMPLEMENTAR — bruto R$ ${fmt(it.medicaoComplementarBruto)}, retenção R$ ${fmt(it.medicaoComplementarRetido)}, líquido R$ ${fmt(it.medicaoComplementarLiquido)}`
                  : "VALE"}
              </Text>
              <Text style={[styles.td, { flex: 1.3 }]}>R$ {fmt(it.total)}</Text>
            </View>
          ))}
          <View style={styles.row}>
            <Text style={[styles.somaFirst, { flex: 6.5 }]}>SOMA</Text>
            <Text style={[styles.somaCell, { flex: 1.3 }]}>R$ {fmt(somaGeral)}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Resumo por empreiteiro</Text>
        <View wrap={false}>
          <View style={styles.row}>
            <Text style={[styles.thResumo, { flex: 2 }]}>Empreiteiro</Text>
            <Text style={[styles.thResumo, { flex: 1.5 }]}>Vale Real</Text>
            <Text style={[styles.thResumo, { flex: 1.5 }]}>Correção / Med. Compl. (bruto)</Text>
            <Text style={[styles.thResumo, { flex: 1.5 }]}>Retenção do item</Text>
            <Text style={[styles.thResumo, { flex: 1.5 }]}>Correção / Med. Compl. (líquido)</Text>
            <Text style={[styles.thResumo, { flex: 1.5 }]}>Total do mês</Text>
          </View>
          {resumo.map((r, i) => (
            <View style={styles.row} key={i}>
              <Text style={[styles.tdFirst, { flex: 2 }]}>{r.nome}</Text>
              <Text style={[styles.td, { flex: 1.5 }]}>R$ {fmt(r.valeReal)}</Text>
              <Text style={[styles.td, { flex: 1.5 }]}>R$ {fmt(r.correcaoBruto)}</Text>
              <Text style={[styles.td, { flex: 1.5 }]}>R$ {fmt(r.correcaoRetido)}</Text>
              <Text style={[styles.td, { flex: 1.5 }]}>R$ {fmt(r.correcaoLiquido)}</Text>
              <Text style={[styles.td, { flex: 1.5, fontWeight: 700 }]}>R$ {fmt(r.totalGeral)}</Text>
            </View>
          ))}
          <View style={styles.row}>
            <Text style={[styles.somaFirst, { flex: 2 }]}>SOMA</Text>
            <Text style={[styles.somaCell, { flex: 1.5 }]}>R$ {fmt(somaReal)}</Text>
            <Text style={[styles.somaCell, { flex: 1.5 }]}>R$ {fmt(somaCorrecaoBruto)}</Text>
            <Text style={[styles.somaCell, { flex: 1.5 }]}>R$ {fmt(somaCorrecaoRetido)}</Text>
            <Text style={[styles.somaCell, { flex: 1.5 }]}>R$ {fmt(somaCorrecaoLiquido)}</Text>
            <Text style={[styles.somaCell, { flex: 1.5 }]}>R$ {fmt(somaGeral)}</Text>
          </View>
        </View>

        <Text style={styles.note}>
          "Vale Real" é descontado automaticamente do total a pagar na medição do mesmo mês. Vale de correção e a
          Medição Complementar de um lançamento "Vale + Medição" já são pagos líquidos (valor bruto menos a retenção)
          neste fechamento de vale — por isso eles não entram de novo no fechamento de medição do mês.
        </Text>

        <Assinaturas
          mestreNome={mestreNome}
          lancadores={lancadores}
          engenheiroNome={engenheiroNome}
          dataAssinatura={dataGeracao}
        />
      </Page>
    </Document>
  );
}
