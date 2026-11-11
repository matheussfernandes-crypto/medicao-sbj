"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Lê o texto do "Registro rápido" da página inicial e já abre a empresa (e o contrato, quando dá) certa.
type Contrato = { id: string; empresa_id: string; empresa_nome: string; obra_nome: string };

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ");
const IGNORAR = new Set(["de", "da", "do", "das", "dos", "e", "ltda", "me", "epp", "eireli", "sa", "medicao", "iniciar", "fazer", "lancar", "empreiteiro", "empresa", "obra", "vale", "o", "a"]);
const palavras = (s: string) => norm(s).split(/\s+/).filter((p) => p.length > 2 && !IGNORAR.has(p));

export default function PreencheRegistro({ contratos }: { contratos: Contrato[] }) {
  const router = useRouter();
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    let texto = "";
    try {
      texto = sessionStorage.getItem("registro-medicao") ?? "";
      sessionStorage.removeItem("registro-medicao");
    } catch {}
    if (!texto) return;
    const ditas = palavras(texto);
    if (!ditas.length) return;

    const nota = (alvo: string) => {
      const ps = palavras(alvo);
      return ps.filter((p) => ditas.some((d) => d === p || (d.length > 3 && p.startsWith(d)) || (p.length > 3 && d.startsWith(p)))).length;
    };

    // melhor empresa pelo nome
    const empresas = new Map<string, string>();
    contratos.forEach((c) => empresas.set(c.empresa_id, c.empresa_nome));
    let melhor = "";
    let pontos = 0;
    empresas.forEach((nome, id) => {
      const n = nota(nome);
      if (n > pontos) {
        pontos = n;
        melhor = id;
      }
    });
    if (!melhor) {
      setAviso(`Não achei a empresa em “${texto}”. Escolha abaixo.`);
      return;
    }
    // se a obra também foi citada, ou se só há um contrato, já abre o contrato
    const daEmpresa = contratos.filter((c) => c.empresa_id === melhor);
    const porObra = daEmpresa
      .map((c) => ({ c, n: nota(c.obra_nome) }))
      .filter((x) => x.n > 0)
      .sort((a, b) => b.n - a.n);
    const contrato = porObra.length === 1 || (porObra.length > 1 && porObra[0].n > porObra[1].n) ? porObra[0].c : daEmpresa.length === 1 ? daEmpresa[0] : null;
    router.replace(contrato ? `/contratos/medicoes?contrato=${contrato.id}` : `/contratos/medicoes?empresa=${melhor}`);
  }, [contratos, router]);

  if (!aviso) return null;
  return <div className="card !p-3 text-sm text-warning">{aviso}</div>;
}
