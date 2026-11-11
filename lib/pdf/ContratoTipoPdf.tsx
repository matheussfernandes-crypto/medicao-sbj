import fs from "node:fs";
import path from "node:path";
import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";

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
const dataBR = (d: string | null | undefined) => (d ? d.slice(0, 10).split("-").reverse().join("/") : "—");

export type ContratoTipoDados = {
  numero: string;
  obra: string;
  objeto: string;
  dataInicio: string | null;
  dataTermino: string | null;
  retencaoPct: number;
  observacoes: string | null;
  empresa: {
    nome: string;
    nomeEmpresarial: string | null;
    cnpj: string | null;
    contato: string | null;
    telefone: string | null;
    endereco: string | null;
  };
  precos: { servico: string; unidade: string; valor_unitario: number }[];
};

const s = StyleSheet.create({
  page: { paddingVertical: 30, paddingHorizontal: 34, fontSize: 9, fontFamily: "Helvetica", color: "#1f2733" },
  header: { flexDirection: "row", alignItems: "center", borderBottomWidth: 2, borderBottomColor: "#1c474f", paddingBottom: 8, marginBottom: 12 },
  logo: { width: 46, height: 46, marginRight: 12 },
  title: { fontSize: 13, fontWeight: 700, color: "#1c474f" },
  sub: { fontSize: 8.5, color: "#444", marginTop: 2 },
  right: { marginLeft: "auto", textAlign: "right", fontSize: 7.5, color: "#444" },
  info: { flexDirection: "row", flexWrap: "wrap", backgroundColor: "#eef3f4", padding: 8, marginBottom: 12, borderRadius: 3 },
  infoCell: { width: "50%", marginBottom: 5, paddingRight: 6 },
  infoLbl: { fontSize: 6.5, color: "#65707d", textTransform: "uppercase" },
  infoVal: { fontSize: 9, fontWeight: 700 },
  section: { fontSize: 9, fontWeight: 700, textTransform: "uppercase", marginTop: 6, marginBottom: 5, color: "#16232e" },
  row: { flexDirection: "row" },
  th: { backgroundColor: "#1c474f", color: "#fff", fontSize: 8, fontWeight: 700, padding: 5, borderWidth: 0.5, borderColor: "#333" },
  td: { fontSize: 9.5, padding: 6, borderWidth: 0.5, borderColor: "#333" },
  num: { textAlign: "right" },
  center: { textAlign: "center" },
  clausula: { fontSize: 8.5, marginBottom: 4, lineHeight: 1.35 },
  obs: { fontSize: 8, color: "#333", lineHeight: 1.35, borderWidth: 0.5, borderColor: "#bbb", padding: 6, marginTop: 2 },
  ass: { flexDirection: "row", gap: 28, marginTop: 44 },
  assBox: { flex: 1, borderTopWidth: 1, borderTopColor: "#333", paddingTop: 4, fontSize: 8 },
  data: { marginTop: 22, fontSize: 8.5 },
});

export function ContratoTipoPdf({ d, engenheiroNome, dataGeracao }: { d: ContratoTipoDados; engenheiroNome: string; dataGeracao: string }) {
  const lg = logo();
  const e = d.empresa;
  return (
    <Document title={`Contrato tipo ${d.numero} - ${d.obra}`}>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          {lg ? <Image style={s.logo} src={lg} /> : null}
          <View>
            <Text style={s.title}>CONTRATO TIPO — TABELA DE PREÇOS UNITÁRIOS</Text>
            <Text style={s.sub}>Contrato Nº {d.numero} · {t(d.obra)} · {t(d.objeto)}</Text>
          </View>
          <View style={s.right}><Text>SBJ Construtora e Incorporadora</Text><Text>Gerado em {dataGeracao}</Text></View>
        </View>

        <View style={s.info}>
          <View style={s.infoCell}><Text style={s.infoLbl}>Obra</Text><Text style={s.infoVal}>{t(d.obra)}</Text></View>
          <View style={s.infoCell}><Text style={s.infoLbl}>Objeto</Text><Text style={s.infoVal}>{t(d.objeto)}</Text></View>
          <View style={s.infoCell}><Text style={s.infoLbl}>Contratada</Text><Text style={s.infoVal}>{t(e.nomeEmpresarial || e.nome)}</Text></View>
          <View style={s.infoCell}><Text style={s.infoLbl}>CNPJ</Text><Text style={s.infoVal}>{e.cnpj || "—"}</Text></View>
          <View style={s.infoCell}><Text style={s.infoLbl}>Responsável / contato</Text><Text style={s.infoVal}>{[e.contato, e.telefone].filter(Boolean).join(" · ") || "—"}</Text></View>
          <View style={s.infoCell}><Text style={s.infoLbl}>Vigência</Text><Text style={s.infoVal}>{dataBR(d.dataInicio)} a {dataBR(d.dataTermino)}</Text></View>
          {e.endereco ? <View style={[s.infoCell, { width: "100%" }]}><Text style={s.infoLbl}>Endereço da contratada</Text><Text style={s.infoVal}>{t(e.endereco)}</Text></View> : null}
        </View>

        <Text style={s.section}>Preços unitários acordados</Text>
        <View style={s.row}>
          <Text style={[s.th, s.center, { flex: 0.6 }]}>Item</Text>
          <Text style={[s.th, { flex: 4 }]}>Serviço</Text>
          <Text style={[s.th, s.center, { flex: 1 }]}>Unidade</Text>
          <Text style={[s.th, s.num, { flex: 1.8 }]}>Preço unitário (R$)</Text>
        </View>
        {d.precos.map((p, i) => (
          <View style={s.row} key={i} wrap={false}>
            <Text style={[s.td, s.center, { flex: 0.6 }]}>{i + 1}</Text>
            <Text style={[s.td, { flex: 4 }]}>{t(p.servico)}</Text>
            <Text style={[s.td, s.center, { flex: 1 }]}>{t(p.unidade)}</Text>
            <Text style={[s.td, s.num, { flex: 1.8, fontWeight: 700 }]}>R$ {f2(p.valor_unitario)} / {t(p.unidade)}</Text>
          </View>
        ))}

        <Text style={[s.section, { marginTop: 14 }]}>Condições</Text>
        <Text style={s.clausula}>1. Os serviços serão medidos pelas quantidades efetivamente executadas em obra, aplicando-se os preços unitários desta tabela para cada unidade de medida.</Text>
        <Text style={s.clausula}>2. Os preços unitários permanecem fixos durante a vigência do contrato. Qualquer alteração de preço ou inclusão de serviço só vale por aditivo aprovado pela SBJ.</Text>
        <Text style={s.clausula}>3. {d.retencaoPct > 0 ? `Sobre cada medição será retido ${f2(d.retencaoPct)}% do valor medido, liberado conforme as regras do contrato.` : "Não há retenção sobre as medições, salvo alteração registrada no contrato."}</Text>
        <Text style={s.clausula}>4. Os pagamentos seguem o boletim de medição mensal emitido e aprovado pela engenharia da SBJ.</Text>
        <Text style={s.clausula}>5. A contratada deve cumprir todas as normas de segurança da SBJ e as normas regulamentadoras de segurança do trabalho, com uso obrigatório de EPIs em obra.</Text>
        <Text style={s.clausula}>6. Todos os trabalhadores da contratada na obra devem ser registrados. Não é permitido trabalhador sem registro.</Text>
        <Text style={s.clausula}>7. A contratada deve manter a frente de serviço sempre limpa e organizada, retirando entulho e sobras de material ao fim de cada etapa e de cada dia de trabalho.</Text>

        {d.observacoes ? (
          <View wrap={false}>
            <Text style={[s.section, { marginTop: 10 }]}>Observações</Text>
            <Text style={s.obs}>{t(d.observacoes)}</Text>
          </View>
        ) : null}

        <Text style={s.data}>Data: ______/______/__________</Text>
        <View style={s.ass} wrap={false}>
          <View style={s.assBox}><Text>SBJ Construtora e Incorporadora — Engenharia</Text><Text style={{ fontWeight: 700, marginTop: 2 }}>{engenheiroNome}</Text></View>
          <View style={s.assBox}><Text>De acordo — contratada</Text><Text style={{ fontWeight: 700, marginTop: 2 }}>{t(e.nomeEmpresarial || e.nome)}</Text></View>
        </View>
      </Page>
    </Document>
  );
}
