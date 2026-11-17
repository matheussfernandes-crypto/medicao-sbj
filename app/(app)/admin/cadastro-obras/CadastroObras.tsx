"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Copy, ImagePlus, Plus, Search, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import FiltroColuna, { contarValores, type Direcao } from "@/components/ui/FiltroColuna";
import { DataCampo, Paginador, Recolher, Seta, useAberto, usePaginas } from "@/components/ui/anima";
import { criarObra, marcarEntregue, mudarFase, salvarAparece, salvarLogo, salvarObra, voltarParaObra, type CampoAparece, type DadosObra } from "./actions";

export type ObraCadastro = {
  id: string;
  nome: string;
  nome_completo: string | null;
  nomes_alternativos: string[] | null;
  fase: "desenvolvimento" | "obra" | "entregue" | null;
  cnpj: string | null;
  cno: string | null;
  razao_social: string | null;
  endereco: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
  data_inicio: string | null;
  data_entrega_prevista: string | null;
  data_entrega_real: string | null;
  torres: number | null;
  pavimentos: number | null;
  unidades: number | null;
  responsavel_tecnico: string | null;
  logo_url: string | null;
  aparece_medicao: boolean;
  aparece_andamento: boolean;
  aparece_vistorias: boolean;
  aparece_posvenda: boolean;
  obra_id: string | null;
  andamento_obra_id: string | null;
  posobra_id: string | null;
  posvenda_emp_id: string | null;
  observacoes: string | null;
  atualizado_em: string | null;
};

const inp =
  "w-full rounded-[10px] border border-border bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15";
const btnPri = "inline-flex items-center gap-1.5 rounded-[10px] bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primaryDark disabled:opacity-60";
const btnSec =
  "inline-flex items-center gap-1.5 rounded-[10px] border border-border bg-white px-4 py-2 text-sm font-semibold text-ink-700 hover:border-primary hover:text-primary disabled:opacity-60";

const fmtData = (s: string | null) => (s ? s.split("-").reverse().join("/") : "—");
const dig = (s: string) => s.replace(/\D/g, "");
function mascaraCnpj(s: string) {
  const d = dig(s).slice(0, 14);
  if (d.length !== 14) return s.trim();
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}
function mascaraCno(s: string) {
  const d = dig(s).slice(0, 12);
  if (d.length !== 12) return s.trim();
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 10)}/${d.slice(10)}`;
}
function mascaraCep(s: string) {
  const d = dig(s).slice(0, 8);
  if (d.length !== 8) return s.trim();
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}
const entregaDe = (o: ObraCadastro) => (o.fase === "entregue" ? o.data_entrega_real : o.data_entrega_prevista) ?? o.data_entrega_real ?? o.data_entrega_prevista;
const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

// colunas da lista: o que cada título filtra (val/lab) e como ordena (ord)
type ColunaObra = "obra" | "fase" | "endereco" | "cnpj" | "cno" | "unidades" | "entrega";
const AZ: [Direcao, string][] = [["asc", "A → Z"], ["desc", "Z → A"]];
const COLUNAS: Record<
  ColunaObra,
  { rot: string; val?: (o: ObraCadastro) => string; lab?: (v: string) => string; ordens?: [Direcao, string][]; ord?: (o: ObraCadastro) => string | number | null }
> = {
  obra: { rot: "Obra", ordens: AZ, ord: (o) => o.nome },
  fase: { rot: "Fase", val: (o) => o.fase ?? "", lab: (v) => (v === "entregue" ? "Concluída" : v === "obra" ? "Em execução" : v === "desenvolvimento" ? "Em desenvolvimento" : "Sem fase") },
  endereco: { rot: "Endereço", val: (o) => [o.cidade, o.uf].filter(Boolean).join("/"), lab: (v) => v || "Sem cidade", ordens: AZ, ord: (o) => o.endereco || null },
  cnpj: { rot: "CNPJ", val: (o) => o.cnpj ?? "", lab: (v) => v || "Sem CNPJ" },
  cno: { rot: "CNO", val: (o) => (o.cno ? "sim" : ""), lab: (v) => (v ? "Com CNO" : "Sem CNO") },
  unidades: { rot: "Unidades", ordens: [["asc", "Menos"], ["desc", "Mais"]], ord: (o) => o.unidades ?? null },
  entrega: {
    rot: "Entrega",
    val: (o) => (entregaDe(o) ?? "").slice(0, 4),
    lab: (v) => v || "Sem data",
    ordens: [["asc", "Mais antigas"], ["desc", "Mais recentes"]],
    ord: (o) => entregaDe(o) ?? null,
  },
};

function Fase({ fase }: { fase: ObraCadastro["fase"] }) {
  if (fase === "entregue") return <span className="rounded-full bg-[#E3F1E8] px-2.5 py-0.5 text-xs font-semibold text-[#1D6B3D]">Concluída</span>;
  if (fase === "obra") return <span className="rounded-full bg-[#FDF0DC] px-2.5 py-0.5 text-xs font-semibold text-[#9A5B00]">Em execução</span>;
  if (fase === "desenvolvimento") return <span className="rounded-full bg-[#E4ECFA] px-2.5 py-0.5 text-xs font-semibold text-[#2A4B8D]">Em desenvolvimento</span>;
  return <span className="rounded-full bg-[#E1E9EB] px-2.5 py-0.5 text-xs font-semibold text-ink-500">Sem fase</span>;
}

// ---------------------------------------------------------------------------
// Lista

export default function CadastroObras({ obras, erro }: { obras: ObraCadastro[]; erro: string | null }) {
  const [abertaId, setAbertaId] = useState<string | null>(null);
  const [nova, setNova] = useState(false);
  const [busca, setBusca] = useState("");
  const [filtros, setFiltros] = useState<Partial<Record<ColunaObra, string[]>>>({});
  const [ordem, setOrdem] = useState<{ k: ColunaObra; d: Direcao } | null>(null);
  const aberta = obras.find((o) => o.id === abertaId) ?? null;

  const achadas = useMemo(() => {
    const q = norm(busca.trim());
    return obras.filter((o) => !q || norm([o.nome, o.nome_completo, ...(o.nomes_alternativos ?? []), o.endereco, o.cidade, o.cnpj, o.cno].join(" ")).includes(q));
  }, [obras, busca]);
  // passa nos filtros de todas as colunas, menos a indicada (para contar os valores daquela coluna)
  const passa = (o: ObraCadastro, menos?: ColunaObra) =>
    (Object.keys(filtros) as ColunaObra[]).every((k) => k === menos || !filtros[k]?.length || filtros[k]!.includes(COLUNAS[k].val!(o)));
  const lista = useMemo(() => {
    const vis = achadas.filter((o) => passa(o));
    const porNome = (a: ObraCadastro, b: ObraCadastro) => a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" });
    if (!ordem) return vis.sort(porNome);
    const def = COLUNAS[ordem.k];
    const m = ordem.d === "desc" ? -1 : 1;
    return vis.sort((a, b) => {
      const x = def.ord!(a);
      const y = def.ord!(b);
      // sem valor sempre no fim
      if (x === null && y === null) return porNome(a, b);
      if (x === null) return 1;
      if (y === null) return -1;
      const r = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "pt-BR", { numeric: true });
      return r * m || porNome(a, b);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [achadas, filtros, ordem]);
  const pg = usePaginas(lista, 15, busca + "|" + JSON.stringify(filtros) + "|" + JSON.stringify(ordem));
  const nFiltros = Object.values(filtros).filter((v) => v?.length).length;

  const titulo = (k: ColunaObra, direita = false) => {
    const def = COLUNAS[k];
    const valores = def.val
      ? contarValores(achadas.filter((o) => passa(o, k)), def.val, def.lab).sort((a, b) =>
          k === "entrega" ? b.v.localeCompare(a.v) : a.l.localeCompare(b.l, "pt-BR", { numeric: true })
        )
      : undefined;
    (filtros[k] ?? []).forEach((v) => valores && !valores.some((x) => x.v === v) && valores.push({ v, l: def.lab ? def.lab(v) : v, n: 0 }));
    return (
      <FiltroColuna
        rotulo={def.rot}
        ordens={def.ordens}
        ordem={ordem?.k === k ? ordem.d : null}
        onOrdem={(d) => setOrdem(d ? { k, d } : null)}
        valores={valores}
        marcados={filtros[k] ?? []}
        onMarcar={(v) => setFiltros((f) => ({ ...f, [k]: v }))}
        alinharDireita={direita}
      />
    );
  };

  if (aberta) return <EditorObra key={aberta.id + (aberta.atualizado_em ?? "")} obra={aberta} voltar={() => setAbertaId(null)} />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-primaryDark">Cadastro de obras</h1>
        <p className="text-sm text-ink-500">Um cadastro só para todas as obras. Vistorias e Pós-venda já leem daqui; cadastre as obras novas por aqui.</p>
      </div>
      {erro && <div className="rounded-[10px] border border-[#F1C4BF] bg-[#FDECEA] px-3 py-2 text-sm text-[#B3261E]">Não consegui carregar as obras: {erro}</div>}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[260px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input className={inp + " pl-9"} placeholder="Buscar por nome, endereço, CNPJ ou CNO…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <button type="button" className={btnPri} onClick={() => setNova((v) => !v)}>
          <Plus className="h-4 w-4" /> Cadastrar obra
        </button>
        <span className="text-sm text-ink-500">
          {lista.length === obras.length ? `${obras.length} obras` : `${lista.length} de ${obras.length} obras`}
          {(nFiltros > 0 || ordem) && (
            <>
              {nFiltros > 0 && (
                <b className="text-primary">
                  {" "}
                  · {nFiltros} {nFiltros === 1 ? "filtro" : "filtros"} nas colunas
                </b>
              )}{" "}
              ·{" "}
              <button
                type="button"
                className="font-semibold text-primary underline"
                onClick={() => {
                  setFiltros({});
                  setOrdem(null);
                }}
              >
                limpar
              </button>
            </>
          )}
        </span>
      </div>

      {nova && (
        <NovaObra
          cancelar={() => setNova(false)}
          criada={(id) => {
            setNova(false);
            setAbertaId(id);
          }}
        />
      )}

      <div ref={pg.topo} className="card-flush overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-ink-500">
              <th className="px-4 py-3">{titulo("obra")}</th>
              <th className="px-3 py-3">{titulo("fase")}</th>
              <th className="px-3 py-3">{titulo("endereco")}</th>
              <th className="px-3 py-3">{titulo("cnpj")}</th>
              <th className="px-3 py-3">{titulo("cno")}</th>
              <th className="px-3 py-3 text-right">{titulo("unidades", true)}</th>
              <th className="px-3 py-3">{titulo("entrega")}</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody key={pg.giro} className={pg.classe}>
            {pg.itens.map((o) => (
              <tr key={o.id} onClick={() => setAbertaId(o.id)} className="cursor-pointer border-b border-[#E8EEF0] last:border-0 hover:bg-[#F4F8F9]">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {o.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={o.logo_url} alt="" className="h-8 w-8 shrink-0 rounded-[8px] border border-[#E8EEF0] bg-white object-contain" />
                    ) : (
                      <span className="h-8 w-8 shrink-0 rounded-[8px] border border-dashed border-border" />
                    )}
                    <div className="min-w-0">
                      <div className="font-semibold text-ink-900">{o.nome}</div>
                      {o.nome_completo && <div className="text-xs text-ink-500">{o.nome_completo}</div>}
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3">
                  <Fase fase={o.fase} />
                </td>
                <td className="px-3 py-3 text-ink-700">{[o.endereco, o.cidade].filter(Boolean).join(" · ") || <span className="text-ink-400">—</span>}</td>
                <td className="px-3 py-3 tabular-nums text-ink-700">{o.cnpj || <span className="text-ink-400">—</span>}</td>
                <td className="px-3 py-3 tabular-nums text-ink-700">{o.cno || <span className="text-ink-400">—</span>}</td>
                <td className="px-3 py-3 text-right tabular-nums">{o.unidades ?? "—"}</td>
                <td className="px-3 py-3 tabular-nums text-ink-700">{fmtData(entregaDe(o))}</td>
                <td className="px-3 py-3 text-right">
                  <span className="text-sm font-semibold text-primary">Abrir</span>
                </td>
              </tr>
            ))}
            {!pg.itens.length && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-ink-500">
                  Nenhuma obra com esses filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="px-4 pb-3">
          <Paginador pag={pg.pag} pags={pg.pags} total={pg.total} por={pg.por} ir={pg.ir} />
        </div>
      </div>
    </div>
  );
}

// Formulário curto para obra nova; o resto (CNPJ, CNO, datas, estrutura…) se preenche no editor que abre em seguida.
function NovaObra({ cancelar, criada }: { cancelar: () => void; criada: (id: string) => void }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [f, setF] = useState({ nome: "", nome_completo: "", fase: "desenvolvimento" as "desenvolvimento" | "obra" | "entregue", unidades: "", endereco: "", cidade: "", uf: "SC" });
  const [erro, setErro] = useState<string | null>(null);
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));

  function criar() {
    setErro(null);
    iniciar(async () => {
      const r = await criarObra({
        nome: f.nome,
        nome_completo: f.nome_completo || null,
        fase: f.fase,
        unidades: f.unidades ? Number(f.unidades) : null,
        endereco: f.endereco || null,
        cidade: f.cidade || null,
        uf: f.uf || null,
      });
      if (!r.ok) return setErro(r.erro);
      router.refresh();
      criada(r.id);
    });
  }

  return (
    <div className="card space-y-4 p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-primaryDark">Cadastrar obra</h2>
        <button type="button" onClick={cancelar} className="text-ink-500 hover:text-ink-900" aria-label="Fechar">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <Campo rotulo="Nome da obra *">
          <input className={inp} placeholder="Ex.: ILHA DE FOO" value={f.nome} onChange={(e) => set("nome", e.target.value)} autoFocus />
        </Campo>
        <Campo rotulo="Nome completo" className="md:col-span-2">
          <input className={inp} placeholder="Ex.: Residencial Ilha de Foo (se vazio, o sistema monta)" value={f.nome_completo} onChange={(e) => set("nome_completo", e.target.value)} />
        </Campo>
        <Campo rotulo="Fase">
          <select className={inp} value={f.fase} onChange={(e) => set("fase", e.target.value)}>
            <option value="desenvolvimento">Em desenvolvimento</option>
            <option value="obra">Em execução</option>
            <option value="entregue">Concluída</option>
          </select>
        </Campo>
        <Campo rotulo="Unidades">
          <input className={inp} type="number" min={0} value={f.unidades} onChange={(e) => set("unidades", e.target.value)} />
        </Campo>
        <span className="hidden md:block" />
        <Campo rotulo="Endereço (rua e número)" className="md:col-span-2">
          <input className={inp} value={f.endereco} onChange={(e) => set("endereco", e.target.value)} />
        </Campo>
        <div className="grid grid-cols-[1fr_72px] gap-3">
          <Campo rotulo="Cidade">
            <input className={inp} value={f.cidade} onChange={(e) => set("cidade", e.target.value)} />
          </Campo>
          <Campo rotulo="UF">
            <input className={inp} maxLength={2} value={f.uf} onChange={(e) => set("uf", e.target.value.toUpperCase())} />
          </Campo>
        </div>
      </div>
      <p className="text-xs text-ink-500">A obra já nasce disponível nas Vistorias e no Pós-venda. Depois de criar, o editor abre para você completar CNPJ, CNO, datas, estrutura e logo.</p>
      {erro && <div className="rounded-[10px] border border-[#F1C4BF] bg-[#FDECEA] px-3 py-2 text-sm text-[#B3261E]">{erro}</div>}
      <div className="flex gap-2">
        <button type="button" className={btnPri} disabled={pendente || !f.nome.trim()} onClick={criar}>
          {pendente ? "Criando…" : "Criar obra"}
        </button>
        <button type="button" className={btnSec} onClick={cancelar}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Editor de uma obra

const ABAS = [
  ["gerais", "Dados gerais"],
  ["datas", "Datas e garantia"],
  ["estrutura", "Estrutura"],
  ["vinculos", "Vínculos e nomes"],
] as const;
type Aba = (typeof ABAS)[number][0];

function Bloco({ id, titulo, children, extra }: { id: string; titulo: string; children: React.ReactNode; extra?: React.ReactNode }) {
  const [aberto, alternar] = useAberto("cad-obra-" + id, true);
  return (
    <div className="card">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button type="button" onClick={alternar} aria-expanded={aberto} title={aberto ? "Recolher" : "Mostrar"} className="sbj-ts text-left font-semibold text-ink-900">
            {titulo}
            <span className="sbj-seta-btn">
              <Seta aberto={aberto} />
            </span>
          </button>
        </div>
        {extra && <div className="flex items-center gap-2">{extra}</div>}
      </div>
      <Recolher aberto={aberto}>
        <div className="pt-4">{children}</div>
      </Recolher>
    </div>
  );
}

function Campo({ rotulo, children, className = "" }: { rotulo: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={"block " + className}>
      <span className="mb-1 block text-xs font-semibold text-ink-500">{rotulo}</span>
      {children}
    </label>
  );
}

// chave liga/desliga
function Chave({ ligada, onChange, disabled, rotulo }: { ligada: boolean; onChange: (v: boolean) => void; disabled?: boolean; rotulo: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligada}
      aria-label={rotulo}
      title={ligada ? "Aparece" : "Não aparece"}
      disabled={disabled}
      onClick={() => onChange(!ligada)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 disabled:opacity-60 ${ligada ? "bg-primary" : "bg-[#C9D6DA]"}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-[left] duration-200 ${ligada ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

// logo da obra: envia a imagem para o espaço "obras-logos" e guarda o endereço no cadastro
function LogoObra({ obra, aviso }: { obra: ObraCadastro; aviso: (m: { tipo: "ok" | "erro"; texto: string } | null) => void }) {
  const router = useRouter();
  const arq = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  async function enviar(f: File) {
    if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(f.type)) return aviso({ tipo: "erro", texto: "A logo precisa ser PNG, JPG, WEBP ou SVG." });
    if (f.size > 2 * 1024 * 1024) return aviso({ tipo: "erro", texto: "A logo pode ter no máximo 2 MB." });
    setEnviando(true);
    try {
      const ext = (f.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
      const caminho = `${obra.id}/${Date.now()}.${ext}`;
      const sb = createClient();
      const { error } = await sb.storage.from("obras-logos").upload(caminho, f, { contentType: f.type, upsert: false });
      if (error) return aviso({ tipo: "erro", texto: "Não consegui enviar a logo: " + error.message });
      const url = sb.storage.from("obras-logos").getPublicUrl(caminho).data.publicUrl;
      const r = await salvarLogo(obra.id, url);
      if (!r.ok) return aviso({ tipo: "erro", texto: r.erro });
      aviso({ tipo: "ok", texto: "Logo salva." });
      router.refresh();
    } finally {
      setEnviando(false);
      if (arq.current) arq.current.value = "";
    }
  }
  async function tirar() {
    if (!confirm("Tirar a logo desta obra? (o arquivo continua guardado)")) return;
    const r = await salvarLogo(obra.id, null);
    if (!r.ok) return aviso({ tipo: "erro", texto: r.erro });
    router.refresh();
  }
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => arq.current?.click()}
        disabled={enviando}
        title={obra.logo_url ? "Trocar logo" : "Enviar logo"}
        className="flex h-[74px] w-[74px] items-center justify-center overflow-hidden rounded-[12px] border border-dashed border-border bg-white text-ink-400 transition-colors hover:border-primary hover:text-primary disabled:opacity-60"
      >
        {enviando ? (
          <span className="text-xs">Enviando…</span>
        ) : obra.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={obra.logo_url} alt={"Logo " + obra.nome} className="h-full w-full object-contain p-1.5" />
        ) : (
          <span className="flex flex-col items-center gap-1 text-[11px]">
            <ImagePlus className="h-5 w-5" /> enviar logo
          </span>
        )}
      </button>
      {obra.logo_url && !enviando && (
        <button type="button" onClick={tirar} className="text-xs font-semibold text-ink-500 hover:text-[#B3261E]">
          Tirar
        </button>
      )}
      <input ref={arq} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={(e) => e.target.files?.[0] && enviar(e.target.files[0])} />
    </div>
  );
}

const CAMPOS_ZAP = [
  ["nome", "Nome"],
  ["cno", "CNO"],
  ["cnpj", "CNPJ"],
  ["endereco", "Endereço e CEP"],
  ["razao", "Razão social"],
] as const;
type CampoZap = (typeof CAMPOS_ZAP)[number][0];

function EditorObra({ obra, voltar }: { obra: ObraCadastro; voltar: () => void }) {
  const router = useRouter();
  const [aba, setAba] = useState<Aba>("gerais");
  const [d, setD] = useState<DadosObra>({
    nome: obra.nome,
    nome_completo: obra.nome_completo,
    razao_social: obra.razao_social,
    cnpj: obra.cnpj,
    cno: obra.cno,
    endereco: obra.endereco,
    bairro: obra.bairro,
    cidade: obra.cidade,
    uf: obra.uf,
    cep: obra.cep,
    data_inicio: obra.data_inicio,
    data_entrega_prevista: obra.data_entrega_prevista,
    torres: obra.torres,
    pavimentos: obra.pavimentos,
    unidades: obra.unidades,
    responsavel_tecnico: obra.responsavel_tecnico,
    nomes_alternativos: obra.nomes_alternativos ?? [],
    observacoes: obra.observacoes,
  });
  const [mudou, setMudou] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [salvando, iniciar] = useTransition();
  const [novoNome, setNovoNome] = useState("");
  const [zapAberto, setZapAberto] = useState(false);
  const [zapCampos, setZapCampos] = useState<Set<CampoZap>>(new Set(["nome", "endereco", "cnpj", "cno"]));
  const [entregaAberta, setEntregaAberta] = useState(false);
  const [dataReal, setDataReal] = useState(obra.data_entrega_real ?? "");

  const set = <K extends keyof DadosObra>(k: K, v: DadosObra[K]) => {
    setD((x) => ({ ...x, [k]: v }));
    setMudou(true);
    setMsg(null);
  };
  const t = (k: keyof DadosObra) => ({
    value: (d[k] as string | number | null) ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(k, e.target.value as never),
  });

  function salvar() {
    iniciar(async () => {
      const r = await salvarObra(obra.id, d);
      if (r.ok) {
        setMudou(false);
        setMsg({ tipo: "ok", texto: "Obra salva." });
        router.refresh();
      } else setMsg({ tipo: "erro", texto: r.erro });
    });
  }
  function entregar() {
    iniciar(async () => {
      const r = await marcarEntregue(obra.id, dataReal);
      if (r.ok) {
        setEntregaAberta(false);
        setMsg({ tipo: "ok", texto: "Obra marcada como concluída." });
        router.refresh();
      } else setMsg({ tipo: "erro", texto: r.erro });
    });
  }
  function aparece(campo: CampoAparece, valor: boolean) {
    iniciar(async () => {
      const r = await salvarAparece(obra.id, campo, valor);
      if (r.ok) router.refresh();
      else setMsg({ tipo: "erro", texto: r.erro });
    });
  }
  function trocarFase(fase: "desenvolvimento" | "obra") {
    const nome = fase === "obra" ? "Em execução" : "Em desenvolvimento";
    if (obra.fase === "entregue" && !confirm(`Voltar esta obra para "${nome}"? A data de entrega real fica guardada, mas deixa de valer para a garantia.`)) return;
    if (obra.fase === "obra" && fase === "desenvolvimento" && !confirm(`Voltar esta obra para "${nome}"? Ela sai do Andamento de obra (nada é apagado).`)) return;
    iniciar(async () => {
      const r = await mudarFase(obra.id, fase);
      if (r.ok) {
        setMsg({ tipo: "ok", texto: `Obra em ${nome.toLowerCase()}.` });
        router.refresh();
      } else setMsg({ tipo: "erro", texto: r.erro });
    });
  }

  // modelo usado no WhatsApp: nome, CNO, CNPJ, endereço (rua; bairro - cidade/UF) e CEP, com a indicação em negrito
  const local = [d.bairro, [d.cidade, d.uf].filter(Boolean).join("/")].filter(Boolean).join(" - ");
  const textoZap = [
    zapCampos.has("nome") && `*${d.nome}*`,
    zapCampos.has("razao") && `*Razão social:* ${d.razao_social || "—"}`,
    zapCampos.has("cno") && `*CNO:* ${d.cno || "—"}`,
    zapCampos.has("cnpj") && `*CNPJ:* ${d.cnpj || "—"}`,
    zapCampos.has("endereco") && [`*Endereço:* ${d.endereco || "—"}`, local].filter(Boolean).join("\n"),
    zapCampos.has("endereco") && d.cep && `*CEP:* ${d.cep}`,
  ]
    .filter(Boolean)
    .join("\n");
  async function copiarZap() {
    try {
      await navigator.clipboard.writeText(textoZap);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = textoZap;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setMsg({ tipo: "ok", texto: "Texto copiado. É só colar no WhatsApp." });
  }

  return (
    <div className="space-y-5">
      <button type="button" onClick={() => (!mudou || confirm("Sair sem salvar as alterações?")) && voltar()} className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
        <ArrowLeft className="h-4 w-4" /> Todas as obras
      </button>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-primaryDark">{d.nome || "Obra sem nome"}</h1>
            <Fase fase={obra.fase} />
          </div>
          {d.nome_completo && <p className="text-sm text-ink-500">{d.nome_completo}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={btnSec} onClick={() => setZapAberto((a) => !a)}>
            <Copy className="h-4 w-4" /> Copiar para WhatsApp
          </button>
          <button type="button" className={btnPri} onClick={salvar} disabled={salvando || !mudou}>
            {salvando ? "Salvando…" : mudou ? "Salvar obra" : "Salvo"}
          </button>
        </div>
      </div>

      {msg && (
        <div className={`rounded-[10px] px-3 py-2 text-sm ${msg.tipo === "ok" ? "bg-[#E3F1E8] text-[#1D6B3D]" : "border border-[#F1C4BF] bg-[#FDECEA] text-[#B3261E]"}`}>{msg.texto}</div>
      )}

      <Recolher aberto={zapAberto}>
        <div className="card">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-ink-900">Copiar para WhatsApp</span>
            <button type="button" onClick={() => setZapAberto(false)} className="sbj-seta-btn" aria-label="Fechar">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-sm">
            {CAMPOS_ZAP.map(([k, l]) => (
              <label key={k} className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={zapCampos.has(k)}
                  onChange={(e) =>
                    setZapCampos((s) => {
                      const n = new Set(s);
                      if (e.target.checked) n.add(k);
                      else n.delete(k);
                      return n;
                    })
                  }
                  className="h-4 w-4 accent-[#00687A]"
                />
                {l}
              </label>
            ))}
          </div>
          <pre className="mt-3 whitespace-pre-wrap rounded-[10px] border border-[#E8EEF0] bg-[#F4F8F9] px-3 py-2 font-mono text-[13px] leading-relaxed text-ink-900">{textoZap || "Marque o que entra no texto."}</pre>
          <div className="mt-3">
            <button type="button" className={btnPri} onClick={copiarZap} disabled={!textoZap}>
              Copiar texto
            </button>
          </div>
        </div>
      </Recolher>

      <div className="sbj-abas sem-marca">
        {ABAS.map(([k, l]) => (
          <button key={k} type="button" className={`sbj-aba ${aba === k ? "ativa" : ""}`} onClick={() => setAba(k)}>
            {l}
          </button>
        ))}
      </div>

      <div key={aba} className="sbj-conteudo space-y-4">
        {aba === "gerais" && (
          <>
            <Bloco id="identificacao" titulo="Identificação">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto]">
                <Campo rotulo="Nome da obra *">
                  <input className={inp} {...t("nome")} />
                </Campo>
                <Campo rotulo="Nome completo (documentos e relatórios)">
                  <input className={inp} {...t("nome_completo")} placeholder="Residencial Ilha de …" />
                </Campo>
                <Campo rotulo="Logo da obra">
                  <LogoObra obra={obra} aviso={setMsg} />
                </Campo>
              </div>
            </Bloco>
            <Bloco id="fiscais" titulo="Dados fiscais">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Campo rotulo="CNPJ da obra">
                  <input className={inp} {...t("cnpj")} onBlur={(e) => e.target.value && set("cnpj", mascaraCnpj(e.target.value))} placeholder="00.000.000/0000-00" inputMode="numeric" />
                </Campo>
                <Campo rotulo="CNO">
                  <input className={inp} {...t("cno")} onBlur={(e) => e.target.value && set("cno", mascaraCno(e.target.value))} placeholder="00.000.00000/00" inputMode="numeric" />
                </Campo>
                <Campo rotulo="Razão social / incorporadora">
                  <input className={inp} {...t("razao_social")} />
                </Campo>
              </div>
            </Bloco>
            <Bloco id="localizacao" titulo="Localização">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-6">
                <Campo rotulo="Endereço (rua e número)" className="sm:col-span-4">
                  <input className={inp} {...t("endereco")} />
                </Campo>
                <Campo rotulo="CEP" className="sm:col-span-2">
                  <input className={inp} {...t("cep")} onBlur={(e) => e.target.value && set("cep", mascaraCep(e.target.value))} placeholder="00000-000" inputMode="numeric" />
                </Campo>
                <Campo rotulo="Bairro" className="sm:col-span-2">
                  <input className={inp} {...t("bairro")} />
                </Campo>
                <Campo rotulo="Cidade" className="sm:col-span-3">
                  <input className={inp} {...t("cidade")} />
                </Campo>
                <Campo rotulo="UF" className="sm:col-span-1">
                  <input className={inp} {...t("uf")} maxLength={2} />
                </Campo>
              </div>
            </Bloco>
            <Bloco id="observacoes" titulo="Observações">
              <textarea className={inp + " min-h-[80px]"} {...t("observacoes")} />
            </Bloco>
          </>
        )}

        {aba === "datas" && (
          <>
            <Bloco id="datas" titulo="Datas">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Campo rotulo="Início da obra">
                  <DataCampo value={d.data_inicio ?? ""} onChange={(v) => set("data_inicio", v || null)} className="w-full" btnClassName="w-full" />
                </Campo>
                <Campo rotulo="Entrega prevista">
                  <DataCampo value={d.data_entrega_prevista ?? ""} onChange={(v) => set("data_entrega_prevista", v || null)} className="w-full" btnClassName="w-full" />
                </Campo>
                <Campo rotulo="Entrega real (habite-se / chaves)">
                  <div className={inp + " bg-[#F4F8F9] text-ink-700"}>{fmtData(obra.data_entrega_real)}</div>
                </Campo>
              </div>
            </Bloco>
            <Bloco id="fase" titulo="Fase da obra">
              <div className="space-y-3 text-sm">
                <div className="flex flex-wrap items-center gap-3">
                  <Fase fase={obra.fase} />
                  {obra.fase === "desenvolvimento" && (
                    <button type="button" className={btnPri} onClick={() => trocarFase("obra")} disabled={salvando}>
                      Iniciar execução da obra
                    </button>
                  )}
                  {obra.fase === "obra" && (
                    <>
                      <button type="button" className={btnPri} onClick={() => setEntregaAberta((a) => !a)} disabled={salvando}>
                        Marcar como concluída
                      </button>
                      <button type="button" className={btnSec} onClick={() => trocarFase("desenvolvimento")} disabled={salvando}>
                        Voltar para Em desenvolvimento
                      </button>
                    </>
                  )}
                  {obra.fase === "entregue" && (
                    <button type="button" className={btnSec} onClick={() => trocarFase("obra")} disabled={salvando}>
                      Voltar para Em execução
                    </button>
                  )}
                  {!obra.fase && (
                    <button type="button" className={btnPri} onClick={() => setEntregaAberta((a) => !a)} disabled={salvando}>
                      Marcar como concluída
                    </button>
                  )}
                </div>
                <Recolher aberto={entregaAberta}>
                  <div className="flex flex-wrap items-end gap-3 rounded-[12px] bg-[#E3EEF1] p-3">
                    <Campo rotulo="Data de entrega real">
                      <DataCampo value={dataReal} onChange={setDataReal} />
                    </Campo>
                    <button type="button" className={btnPri} onClick={entregar} disabled={salvando || !dataReal}>
                      Confirmar conclusão
                    </button>
                    <span className="text-xs text-[#1D5560]">A data de entrega real é a base da garantia no Pós-venda.</span>
                  </div>
                </Recolher>
                {obra.fase === "obra" && !obra.andamento_obra_id && (
                  <p className="rounded-[10px] bg-[#FDF0DC] px-3 py-2 text-xs text-[#9A5B00]">
                    Esta obra está em execução mas ainda não foi configurada no Andamento de obra (pavimentos e serviços).{" "}
                    <a href="/andamento-novo/config" className="font-semibold underline">Configurar no Andamento</a>
                  </p>
                )}
                <p className="text-xs text-ink-500">A fase só muda por aqui. Em desenvolvimento: aparece em Medição e Contratos. Em execução: aparece também no Andamento. Concluída: sai de Medição e Andamento (nada é apagado).</p>
              </div>
            </Bloco>
          </>
        )}

        {aba === "estrutura" && (
          <>
            <Bloco id="estrutura" titulo="Resumo da estrutura">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                <Campo rotulo="Torres / blocos">
                  <input className={inp} type="number" min={0} {...t("torres")} />
                </Campo>
                <Campo rotulo="Pavimentos">
                  <input className={inp} type="number" min={0} {...t("pavimentos")} />
                </Campo>
                <Campo rotulo="Nº de unidades">
                  <input className={inp} type="number" min={0} {...t("unidades")} />
                </Campo>
                <Campo rotulo="Responsável técnico">
                  <input className={inp} {...t("responsavel_tecnico")} />
                </Campo>
              </div>
            </Bloco>
            <Bloco id="pavimentos" titulo="Pavimentos e unidades">
              <p className="text-sm text-ink-500">Na próxima etapa: cadastro de cada pavimento com suas unidades (e o gerador em série para obras novas). Para as obras que já existem, a lista virá do que já está cadastrado.</p>
            </Bloco>
          </>
        )}

        {aba === "vinculos" && (
          <>
            <Bloco id="nomes" titulo="Nomes que já existiam">
              <p className="mb-3 text-sm text-ink-500">Outros nomes desta obra nos dados antigos, para o sistema reconhecer a mesma obra.</p>
              <div className="flex flex-wrap gap-2">
                {d.nomes_alternativos.map((n) => (
                  <span key={n} className="inline-flex items-center gap-1 rounded-[8px] bg-[#E1E9EB] px-2.5 py-1 text-sm">
                    {n}
                    <button
                      type="button"
                      aria-label={"Tirar " + n}
                      onClick={() =>
                        set(
                          "nomes_alternativos",
                          d.nomes_alternativos.filter((x) => x !== n)
                        )
                      }
                      className="text-ink-500 hover:text-[#B3261E]"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <input className={inp + " max-w-sm"} value={novoNome} onChange={(e) => setNovoNome(e.target.value)} placeholder="Acrescentar outro nome" />
                <button
                  type="button"
                  className={btnSec}
                  disabled={!novoNome.trim()}
                  onClick={() => {
                    set("nomes_alternativos", Array.from(new Set([...d.nomes_alternativos, novoNome.trim()])));
                    setNovoNome("");
                  }}
                >
                  Acrescentar
                </button>
              </div>
            </Bloco>
            <Bloco id="ligacoes" titulo="Ligações com os módulos">
              <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                {[
                  ["Medição, Fechamento, Contratos e RH", obra.obra_id, obra.aparece_medicao, "aparece_medicao"],
                  ["Andamento de obra", obra.andamento_obra_id, obra.aparece_andamento, "aparece_andamento"],
                  ["Vistorias e Controle de entregas", obra.posobra_id, obra.aparece_vistorias, "aparece_vistorias"],
                  ["Pós-venda (chamados e clientes)", obra.posvenda_emp_id, obra.aparece_posvenda, "aparece_posvenda"],
                ].map(([rot, lig, ap, campo]) => (
                  <div key={rot as string} className="flex items-center justify-between gap-3 rounded-[10px] border border-[#E8EEF0] px-3 py-2">
                    <div className="min-w-0">
                      <div>{rot as string}</div>
                      <div className={`text-xs ${lig ? "text-[#1D6B3D]" : "text-ink-400"}`}>{lig ? "Ligada a esta obra" : "Não existe lá"}</div>
                    </div>
                    <Chave ligada={!!ap} onChange={(v) => aparece(campo as CampoAparece, v)} disabled={salvando} rotulo={"Aparece em " + rot} />
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-ink-500">“Aparece em” fica guardado aqui; cada módulo passa a respeitar quando for ligado ao cadastro, um de cada vez, com sua aprovação.</p>
            </Bloco>
          </>
        )}
      </div>
    </div>
  );
}
