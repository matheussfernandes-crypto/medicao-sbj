// Enquanto uma aba do Andamento carrega, só o conteúdo mostra um esqueleto: o título e as abas ficam no lugar
// (antes a tela inteira era trocada pela animação grande da logo a cada clique, o que passava a sensação de lentidão).
export default function CarregandoAndamento() {
  return (
    <div className="space-y-4 animate-pulse" role="status" aria-label="Carregando">
      <div className="h-10 w-60 rounded-[10px] bg-gray-200" />
      <div className="card space-y-3">
        <div className="h-5 w-48 rounded bg-gray-200" />
        <div className="h-3 w-full rounded bg-gray-200" />
        <div className="h-3 w-5/6 rounded bg-gray-200" />
        <div className="h-3 w-2/3 rounded bg-gray-200" />
      </div>
      <div className="card space-y-3">
        <div className="h-5 w-40 rounded bg-gray-200" />
        <div className="h-24 w-full rounded bg-gray-200" />
      </div>
    </div>
  );
}
