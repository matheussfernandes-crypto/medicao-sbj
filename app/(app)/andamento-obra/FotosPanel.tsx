"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Trash2, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { registrarFotoObra, excluirFotoObra } from "./actions";
import type { FotoObra } from "./types";

const INTERVALO_DIAS = 15;

function hojeISO() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function fmtData(iso: string) {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

function diasEntre(deISO: string, ateISO: string) {
  const a = new Date(deISO + "T00:00:00").getTime();
  const b = new Date(ateISO + "T00:00:00").getTime();
  return Math.round((b - a) / 86400000);
}

// Fotos de celular têm 4-12 MB; reduz pra ~1920px antes de subir.
async function comprimir(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const max = 1920;
  const escala = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", 0.82));
  return blob ?? file;
}

export default function FotosPanel({ obraId, obraNome, fotos }: { obraId: string; obraNome: string; fotos: FotoObra[] }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [dataFoto, setDataFoto] = useState(hojeISO());
  const [legenda, setLegenda] = useState("");
  const [enviando, setEnviando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const grupos = useMemo(() => {
    const m = new Map<string, FotoObra[]>();
    fotos.forEach((f) => {
      if (!m.has(f.data_foto)) m.set(f.data_foto, []);
      m.get(f.data_foto)!.push(f);
    });
    return Array.from(m.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [fotos]);

  const ultima = grupos[0]?.[0] ?? null;
  const diasDesde = ultima ? diasEntre(ultima, hojeISO()) : null;
  const atrasada = diasDesde != null && diasDesde > INTERVALO_DIAS;

  async function enviar(files: File[]) {
    if (!files.length) return;
    setErro(null);
    const supabase = createClient();
    try {
      for (let i = 0; i < files.length; i++) {
        setEnviando(`Enviando ${i + 1} de ${files.length}…`);
        const blob = await comprimir(files[i]);
        const path = `${obraId}/${dataFoto}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
        const { error } = await supabase.storage.from("obra-fotos").upload(path, blob, {
          contentType: blob.type || "image/jpeg",
          upsert: false,
        });
        if (error) throw new Error(`Falha ao enviar ${files[i].name}: ${error.message}`);
        await registrarFotoObra({ obraId, dataFoto, legenda, path });
      }
      setLegenda("");
      router.refresh();
    } catch (e: any) {
      setErro(e.message ?? "Erro ao enviar as fotos.");
    } finally {
      setEnviando(null);
      if (input.current) input.current.value = "";
    }
  }

  async function excluir(f: FotoObra) {
    if (!window.confirm("Excluir esta foto?")) return;
    try {
      await excluirFotoObra(f.id);
      router.refresh();
    } catch (e: any) {
      setErro(e.message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-ink-500 mb-1">Data da atualização</label>
          <input
            type="date"
            value={dataFoto}
            max={hojeISO()}
            onChange={(e) => setDataFoto(e.target.value)}
            className="border border-border rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div className="flex-1 min-w-[220px]">
          <label className="block text-xs text-ink-500 mb-1">Legenda (opcional)</label>
          <input
            value={legenda}
            onChange={(e) => setLegenda(e.target.value)}
            placeholder="Ex.: Fachada lado norte"
            className="w-full border border-border rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <input
          ref={input}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => enviar(Array.from(e.target.files ?? []))}
        />
        <button
          type="button"
          disabled={!!enviando || !dataFoto}
          onClick={() => input.current?.click()}
          className="inline-flex items-center gap-2 bg-primary text-white rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
          {enviando ?? "Adicionar fotos"}
        </button>
      </div>

      {erro && <div className="text-sm text-danger bg-danger/10 border border-danger/30 rounded-lg px-3 py-2">{erro}</div>}

      <div
        className={`rounded-lg border px-4 py-3 text-sm ${
          atrasada ? "border-danger/40 bg-danger/5 text-danger" : "border-border bg-white text-ink-700"
        }`}
      >
        {ultima == null ? (
          <>Nenhuma foto ainda em <b>{obraNome}</b>. Envie as fotos da obra a cada {INTERVALO_DIAS} dias — as mais recentes aparecem no painel inicial.</>
        ) : (
          <>
            Última atualização: <b>{fmtData(ultima)}</b> ({diasDesde === 0 ? "hoje" : `há ${diasDesde} dia${diasDesde === 1 ? "" : "s"}`}).{" "}
            {atrasada
              ? `Atualização atrasada — o ideal é a cada ${INTERVALO_DIAS} dias.`
              : `Próxima atualização prevista para ${fmtData(new Date(new Date(ultima + "T00:00:00").getTime() + INTERVALO_DIAS * 86400000).toISOString().slice(0, 10))}.`}
          </>
        )}
      </div>

      {grupos.map(([data, lista], idx) => (
        <section key={data} className="card">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="font-semibold text-primaryDark">{fmtData(data)}</h3>
            <span className="text-xs text-ink-500">
              {lista.length} foto{lista.length > 1 ? "s" : ""}
            </span>
            {idx === 0 && <span className="text-[10px] font-semibold uppercase bg-accent text-primaryDark rounded px-1.5 py-0.5">No painel</span>}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {lista.map((f) => (
              <figure key={f.id} className="relative group">
                <a href={f.url} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.url} alt={f.legenda ?? "Foto da obra"} className="w-full h-32 object-cover rounded-lg border border-border" />
                </a>
                <button
                  type="button"
                  onClick={() => excluir(f)}
                  title="Excluir foto"
                  className="absolute top-1.5 right-1.5 bg-black/50 hover:bg-danger text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 focus:opacity-100 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                {(f.legenda || f.autor_nome) && (
                  <figcaption className="mt-1 text-xs text-ink-500 leading-tight">
                    {f.legenda && <span className="block text-ink-700">{f.legenda}</span>}
                    {f.autor_nome && <span>por {f.autor_nome.split(" ")[0]}</span>}
                  </figcaption>
                )}
              </figure>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
