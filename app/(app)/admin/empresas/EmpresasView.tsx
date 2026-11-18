"use client";

import { useEffect, useRef, useState } from "react";
import { consultarCep, consultarCnpj, enderecoComNumero, formatarCep } from "@/lib/consultaDocs";
import { Pencil, Snowflake, Sun } from "lucide-react";
import { criarEmpresa, editarEmpresa, toggleEmpresaAtivo } from "./actions";
import Selecao from "@/components/ui/Selecao";
import PainelCadastro from "@/components/ui/PainelCadastro";
import { TabelaPaginada } from "@/components/ui/anima";

const UF_LIST = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

// Edição abre na própria tela (sem recarregar a página)
export default function EmpresasView({ empresas, qtdContratos, editarInicial }: { empresas: any[]; qtdContratos: Record<string, { ativos: number; total: number }>; editarInicial: string | null }) {
  const [editarId, setEditarId] = useState<string | null>(editarInicial);
  const e = editarId ? (empresas ?? []).find((x) => x.id === editarId) ?? null : null;

  // UF controlada, para poder ser preenchida pela consulta de CEP/CNPJ
  const [uf, setUf] = useState<string>(e?.uf ?? "");
  useEffect(() => { setUf(e?.uf ?? ""); setMsgDoc(null); ultima.current = {}; }, [e?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // consulta de CEP/CNPJ: só roda quando o número foi digitado ou alterado agora; mostra o resultado abaixo do campo
  const [msgDoc, setMsgDoc] = useState<{ campo: "cnpj" | "cep"; texto: string; ok: boolean } | null>(null);
  const ultima = useRef<Record<string, string>>({});
  const guardar = (ev: React.FocusEvent<HTMLInputElement>) => { ev.target.dataset.orig = ev.target.value; };
  const dig = (x: string) => x.replace(/\D/g, "");
  function pos(form: HTMLFormElement | null, nome: string, valor: string, sobrescrever: boolean) {
    const el = form?.elements.namedItem(nome) as HTMLInputElement | null;
    if (!el || !valor) return;
    if (sobrescrever || !el.value.trim()) el.value = valor;
  }
  async function consultaCep(ev: React.FocusEvent<HTMLInputElement> | React.FormEvent<HTMLInputElement>) {
    const el = ev.target as HTMLInputElement;
    if (dig(el.value).length !== 8 || el.value === (el.dataset.orig ?? "") || ultima.current.cep === el.value) return;
    ultima.current.cep = el.value;
    const form = el.form;
    setMsgDoc({ campo: "cep", texto: "Consultando o CEP…", ok: true });
    const r = await consultarCep(el.value);
    if (!r) return setMsgDoc({ campo: "cep", texto: "Não consegui consultar este CEP agora (ou ele não existe). Preencha o endereço manualmente.", ok: false });
    pos(form, "endereco", r.logradouro, false);
    pos(form, "bairro", r.bairro, true);
    pos(form, "municipio", r.cidade, true);
    if (r.uf) setUf(r.uf);
    setMsgDoc({ campo: "cep", texto: "Endereço preenchido pelo CEP. Confira e acrescente o número.", ok: true });
  }
  async function consultaCnpj(ev: React.FocusEvent<HTMLInputElement> | React.FormEvent<HTMLInputElement>) {
    const el = ev.target as HTMLInputElement;
    if (dig(el.value).length !== 14 || el.value === (el.dataset.orig ?? "") || ultima.current.cnpj === el.value) return;
    ultima.current.cnpj = el.value;
    const form = el.form;
    setMsgDoc({ campo: "cnpj", texto: "Consultando o CNPJ…", ok: true });
    const r = await consultarCnpj(el.value);
    if (!r) return setMsgDoc({ campo: "cnpj", texto: "Não consegui consultar este CNPJ agora (ou ele não existe). Preencha os dados manualmente.", ok: false });
    // CNPJ novo ou alterado: os nomes e o endereço passam a ser os desta empresa
    pos(form, "nome_empresarial", r.razaoSocial, true);
    pos(form, "nome", r.nomeFantasia || r.razaoSocial, true);
    pos(form, "endereco", enderecoComNumero(r), true);
    pos(form, "cep", formatarCep(r.cep), true);
    pos(form, "bairro", r.bairro, true);
    pos(form, "municipio", r.cidade, true);
    if (r.uf) setUf(r.uf);
    // contatos: só se estiverem vazios
    pos(form, "telefone", r.telefone, false);
    pos(form, "email", r.email, false);
    setMsgDoc({ campo: "cnpj", texto: "Dados preenchidos pelo CNPJ (nome, endereço e contatos vazios). Confira antes de salvar.", ok: true });
  }
  return (
    <div className="space-y-6">
        <h1 className="text-xl font-semibold text-primaryDark">Cadastro de Terceirizado</h1>

        {/* Formulário criar / editar: fechado por padrão; abre ao clicar em Cadastrar ou ao editar uma empresa */}
        <PainelCadastro key={e?.id ?? "novo"} titulo={e ? `Editando: ${e.nome}` : "Cadastrar nova empresa"} rotuloBotao="Cadastrar empresa" abertoInicial={!!e}>
          <form
            action={e ? editarEmpresa : criarEmpresa}
            className="grid grid-cols-1 sm:grid-cols-2 gap-3"
          >
            {e && <input type="hidden" name="id" value={e.id} />}

            {/* Nome fantasia */}
            <div className="sm:col-span-2">
              <label className="text-xs text-gray-500 block mb-1">Nome fantasia *</label>
              <input name="nome" defaultValue={e?.nome ?? ""} className="border rounded px-3 py-2 w-full" placeholder="Ex.: ABC Revestimentos Ltda" required />
            </div>

            {/* Nome empresarial */}
            <div className="sm:col-span-2">
              <label className="text-xs text-gray-500 block mb-1">Nome empresarial (razão social)</label>
              <input name="nome_empresarial" defaultValue={e?.nome_empresarial ?? ""} className="border rounded px-3 py-2 w-full" placeholder="Ex.: ABC Revestimentos e Serviços Ltda" />
            </div>

            {/* CNPJ + Inscrição Municipal */}
            <div>
              <label className="text-xs text-gray-500 block mb-1">CNPJ / CPF</label>
              <input name="cnpj" onFocus={guardar} onInput={consultaCnpj} onBlur={consultaCnpj} defaultValue={e?.cnpj ?? ""} className="border rounded px-3 py-2 w-full" placeholder="00.000.000/0001-00" />
              {msgDoc?.campo === "cnpj" && <p className={"mt-1 text-xs " + (msgDoc.ok ? "text-ink-500" : "text-danger")}>{msgDoc.texto}</p>}
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Inscrição Municipal</label>
              <input name="inscricao_municipal" defaultValue={e?.inscricao_municipal ?? ""} className="border rounded px-3 py-2 w-full" placeholder="000000" />
            </div>

            {/* Endereço */}
            <div className="sm:col-span-2">
              <label className="text-xs text-gray-500 block mb-1">Endereço</label>
              <input name="endereco" defaultValue={e?.endereco ?? ""} className="border rounded px-3 py-2 w-full" placeholder="Ex.: Rua das Flores, 123 - Sala 4" />
            </div>

            {/* CEP + Bairro */}
            <div>
              <label className="text-xs text-gray-500 block mb-1">CEP</label>
              <input name="cep" onFocus={guardar} onInput={consultaCep} onBlur={consultaCep} defaultValue={e?.cep ?? ""} className="border rounded px-3 py-2 w-full" placeholder="00000-000" />
              {msgDoc?.campo === "cep" && <p className={"mt-1 text-xs " + (msgDoc.ok ? "text-ink-500" : "text-danger")}>{msgDoc.texto}</p>}
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Bairro</label>
              <input name="bairro" defaultValue={e?.bairro ?? ""} className="border rounded px-3 py-2 w-full" placeholder="Ex.: Centro" />
            </div>

            {/* Município + UF */}
            <div>
              <label className="text-xs text-gray-500 block mb-1">Município</label>
              <input name="municipio" defaultValue={e?.municipio ?? ""} className="border rounded px-3 py-2 w-full" placeholder="Ex.: Itajaí" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">UF</label>
              <Selecao name="uf" value={uf} onChange={(ev) => setUf(ev.target.value)} className="border rounded px-3 py-2 w-full">
                <option value="">—</option>
                {UF_LIST.map((u) => <option key={u} value={u}>{u}</option>)}
              </Selecao>
            </div>

            {/* Contato + Telefone */}
            <div>
              <label className="text-xs text-gray-500 block mb-1">Contato (responsável)</label>
              <input name="contato" defaultValue={e?.contato ?? ""} className="border rounded px-3 py-2 w-full" placeholder="Ex.: João da Silva" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Telefone / Fone</label>
              <input name="telefone" defaultValue={e?.telefone ?? ""} className="border rounded px-3 py-2 w-full" placeholder="(47) 3000-0000" />
            </div>

            {/* WhatsApp + Especialidade */}
            <div>
              <label className="text-xs text-gray-500 block mb-1">WhatsApp</label>
              <input name="whatsapp" defaultValue={(e as any)?.whatsapp ?? ""} className="border rounded px-3 py-2 w-full" placeholder="(47) 90000-0000" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Especialidade</label>
              <input name="especialidade" defaultValue={(e as any)?.especialidade ?? ""} className="border rounded px-3 py-2 w-full" placeholder="Ex: Hidráulica, Impermeabilização, Elétrica…" />
            </div>

            {/* E-mail */}
            <div className="sm:col-span-2">
              <label className="text-xs text-gray-500 block mb-1">E-mail</label>
              <input type="email" name="email" defaultValue={e?.email ?? ""} className="border rounded px-3 py-2 w-full" placeholder="contato@empresa.com.br" />
            </div>

            {/* Observações */}
            <div className="sm:col-span-2">
              <label className="text-xs text-gray-500 block mb-1">Observações</label>
              <textarea name="observacoes" defaultValue={e?.observacoes ?? ""} className="border rounded px-3 py-2 w-full h-16 resize-none" placeholder="Informações adicionais…" />
            </div>

            <div className="sm:col-span-2 flex gap-2">
              <button className="bg-primary text-white rounded px-5 py-2">
                {e ? "Salvar alterações" : "Cadastrar empresa"}
              </button>
              {e && (
                <a href="/admin/empresas" className="border rounded px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
                  Cancelar
                </a>
              )}
            </div>
          </form>
        </PainelCadastro>

        {/* Lista */}
        <div className="card !p-0 overflow-hidden">
          <TabelaPaginada por={15} className="w-full text-sm tab-cartao" cabecalho={
<thead className="bg-gray-50 text-left text-gray-400 text-xs uppercase tracking-wide">
              <tr>
                <th className="p-3">Empresa</th>
                <th className="p-3">CNPJ / Insc. Mun.</th>
                <th className="p-3">Localização</th>
                <th className="p-3">Contato / Fone</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-center">Ações</th>
              </tr>
            </thead>
}>
              {(empresas ?? []).length === 0 && (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-gray-400">Nenhuma empresa cadastrada ainda.</td>
                </tr>
              )}
              {(empresas ?? []).map((emp) => (
                <tr key={emp.id} className={`border-t ${!emp.ativo ? "opacity-50" : ""}`}>
                  <td className="p-3">
                    <span className="font-medium block">{emp.nome}</span>
                    {emp.nome_empresarial && <span className="text-xs text-gray-400 block">{emp.nome_empresarial}</span>}
                    {(emp as any).especialidade && (
                      <span className="inline-block text-[11px] bg-primary/10 text-primaryDark rounded px-1.5 py-0.5 mt-0.5">{(emp as any).especialidade}</span>
                    )}
                    {emp.observacoes && <span className="text-xs text-gray-400 italic block truncate max-w-[180px]">{emp.observacoes}</span>}
                    {qtdContratos[emp.id] && (
                      <a href={`/contratos?empresa=${emp.id}&status=`} className="text-xs text-primary underline block mt-0.5">
                        {qtdContratos[emp.id].total} contrato(s) · {qtdContratos[emp.id].ativos} ativo(s)
                      </a>
                    )}
                  </td>
                  <td data-rot="CNPJ / Insc. Mun." className="p-3 text-gray-600 text-xs">
                    {emp.cnpj && <span className="block">{emp.cnpj}</span>}
                    {emp.inscricao_municipal && <span className="block text-gray-400">Insc. {emp.inscricao_municipal}</span>}
                    {!emp.cnpj && !emp.inscricao_municipal && "—"}
                  </td>
                  <td data-rot="Localização" className="p-3 text-xs text-gray-600">
                    {emp.municipio ? (
                      <>
                        <span className="block">{emp.municipio}{emp.uf ? ` / ${emp.uf}` : ""}</span>
                        {emp.bairro && <span className="block text-gray-400">{emp.bairro}</span>}
                      </>
                    ) : "—"}
                  </td>
                  <td data-rot="Contato / Fone" className="p-3 text-xs">
                    <span className="block">{emp.contato ?? "—"}</span>
                    {emp.telefone && <span className="text-gray-400 block">{emp.telefone}</span>}
                    {(emp as any).whatsapp && <span className="text-gray-400 block">WhatsApp: {(emp as any).whatsapp}</span>}
                    {emp.email && <span className="text-gray-400 block">{emp.email}</span>}
                  </td>
                  <td data-rot="Status" className="p-3 text-center">
                    <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-semibold ${emp.ativo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {emp.ativo ? "Ativa" : "Inativa"}
                    </span>
                  </td>
                  <td data-rot="Ações" className="p-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button type="button" onClick={() => { setEditarId(emp.id); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="btn-acao-editar" title="Editar" aria-label="Editar"><Pencil className="w-4 h-4" aria-hidden /></button>
                      <form action={toggleEmpresaAtivo}>
                        <input type="hidden" name="id" value={emp.id} />
                        <input type="hidden" name="ativo" value={String(emp.ativo)} />
                        <button type="submit" className={emp.ativo ? "btn-acao-congelar" : "btn-acao-descongelar"} title={emp.ativo ? "Desativar (congelar)" : "Reativar (descongelar)"} aria-label={emp.ativo ? "Desativar" : "Reativar"}>{emp.ativo ? <Snowflake className="w-4 h-4" aria-hidden /> : <Sun className="w-4 h-4" aria-hidden />}</button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </TabelaPaginada>
        </div>
    </div>
  );
}
