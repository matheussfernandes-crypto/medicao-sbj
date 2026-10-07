"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Paperclip } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { registrarAnexo } from "@/app/(app)/contratos/actions";

type Meta = {
  contratoId: string;
  tipo: "CONTRATO" | "ADITIVO" | "FOTO" | "OUTRO";
  aditivoId?: string;
  lancamentoId?: string;
  solicitacaoId?: string;
};

/**
 * Envia direto do navegador para o Storage (sem passar pelo servidor da
 * Vercel, que limita o corpo da requisição a ~4,5 MB) e depois registra o
 * arquivo no banco.
 */
export async function enviarArquivos(files: File[], meta: Meta): Promise<string | null> {
  const supabase = createClient();
  for (const file of files) {
    const nome = file.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${meta.contratoId}/${meta.tipo.toLowerCase()}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${nome}`;
    const { error } = await supabase.storage.from("contratos").upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
    if (error) return `Falha ao enviar ${file.name}: ${error.message}`;
    const fd = new FormData();
    fd.set("contratoId", meta.contratoId);
    fd.set("tipo", meta.tipo);
    fd.set("path", path);
    fd.set("nome", file.name);
    if (meta.aditivoId) fd.set("aditivoId", meta.aditivoId);
    if (meta.lancamentoId) fd.set("lancamentoId", meta.lancamentoId);
    if (meta.solicitacaoId) fd.set("solicitacaoId", meta.solicitacaoId);
    const r = await registrarAnexo(fd);
    if (r.erro) return r.erro;
  }
  return null;
}

export default function UploadArquivo({
  meta,
  label = "Anexar PDF",
  accept = "application/pdf",
  multiple = false,
}: {
  meta: Meta;
  label?: string;
  accept?: string;
  multiple?: boolean;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  return (
    <div className="inline-flex flex-col gap-1">
      <input
        ref={input}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={async (e) => {
          const files = Array.from(e.target.files ?? []);
          if (!files.length) return;
          setErro(null);
          setEnviando(true);
          const r = await enviarArquivos(files, meta);
          setEnviando(false);
          if (input.current) input.current.value = "";
          if (r) setErro(r);
          else router.refresh();
        }}
      />
      <button
        type="button"
        disabled={enviando}
        onClick={() => input.current?.click()}
        className="inline-flex items-center gap-1.5 border border-primary text-primary rounded px-3 py-1.5 text-xs font-semibold hover:bg-primary hover:text-white transition disabled:opacity-50"
      >
        <Paperclip className="w-3.5 h-3.5" />
        {enviando ? "Enviando…" : label}
      </button>
      {erro && <span className="text-xs text-danger">{erro}</span>}
    </div>
  );
}
