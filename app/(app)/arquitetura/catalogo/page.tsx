import { assinarImagens } from "@/lib/especificacoes/imagem";
import { exigirArquiteturaPagina } from "../acesso";
import Catalogo from "./Catalogo";
import type { Modelo } from "../comum";

export const dynamic = "force-dynamic";

// Obras › Arquitetura › Catálogo de modelos: os modelos que a arquitetura escolhe para os itens.
export default async function CatalogoPage() {
  const supabase = await exigirArquiteturaPagina();
  const { data } = await supabase
    .from("esp_modelos")
    .select("id, grupo, material, referencia, medidas, marca, linha, acab, codigo, faixa, uso, valor_ref, img, revisar, ordem")
    .order("ordem");
  const modelos = (data ?? []) as Modelo[];
  const assinadas = await assinarImagens(supabase, modelos.map((m) => m.img));
  return <Catalogo modelos={modelos} assinadas={assinadas} />;
}
