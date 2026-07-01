"use client";

import { useState } from "react";

export default function PwaInstallGuide() {
  const [aberto, setAberto] = useState(false);

  return (
    <div className="mt-4 border-t pt-4">
      <button
        onClick={() => setAberto(!aberto)}
        className="w-full flex items-center justify-between text-sm text-primaryDark font-medium"
      >
        <span>📱 Como instalar o app no celular</span>
        <span className="text-gray-400">{aberto ? "▲" : "▼"}</span>
      </button>

      {aberto && (
        <div className="mt-3 space-y-4 text-sm">
          {/* iOS */}
          <div className="bg-gray-50 rounded-lg p-3 border">
            <p className="font-semibold text-gray-700 mb-2 flex items-center gap-1">
              <span>🍎</span> iPhone / iPad (Safari)
            </p>
            <ol className="space-y-2 text-gray-600">
              <li className="flex gap-2">
                <span className="font-bold text-primaryDark min-w-[20px]">1.</span>
                <span>Abra o site no <strong>Safari</strong> (não funciona no Chrome do iPhone)</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-primaryDark min-w-[20px]">2.</span>
                <span>Toque no ícone de compartilhar <strong>⎋</strong> na barra inferior</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-primaryDark min-w-[20px]">3.</span>
                <span>Role para baixo e toque em <strong>"Adicionar à Tela de Início"</strong></span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-primaryDark min-w-[20px]">4.</span>
                <span>Toque em <strong>"Adicionar"</strong> no canto superior direito</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-primaryDark min-w-[20px]">5.</span>
                <span>Abra o app pela tela inicial e ative as notificações quando solicitado</span>
              </li>
            </ol>
            <p className="text-xs text-gray-400 mt-2">
              ⚠️ Notificações push no iOS exigem iOS 16.4 ou superior e o app instalado na tela inicial.
            </p>
          </div>

          {/* Android */}
          <div className="bg-gray-50 rounded-lg p-3 border">
            <p className="font-semibold text-gray-700 mb-2 flex items-center gap-1">
              <span>🤖</span> Android (Chrome)
            </p>
            <ol className="space-y-2 text-gray-600">
              <li className="flex gap-2">
                <span className="font-bold text-primaryDark min-w-[20px]">1.</span>
                <span>Abra o site no <strong>Chrome</strong></span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-primaryDark min-w-[20px]">2.</span>
                <span>Toque nos <strong>três pontos ⋮</strong> no canto superior direito</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-primaryDark min-w-[20px]">3.</span>
                <span>Toque em <strong>"Adicionar à tela inicial"</strong> ou <strong>"Instalar app"</strong></span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-primaryDark min-w-[20px]">4.</span>
                <span>Confirme tocando em <strong>"Instalar"</strong> ou <strong>"Adicionar"</strong></span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-primaryDark min-w-[20px]">5.</span>
                <span>O app aparecerá na tela inicial e as notificações serão ativadas automaticamente</span>
              </li>
            </ol>
          </div>

          <p className="text-xs text-gray-400 text-center">
            Após instalar, o app funciona como um aplicativo nativo e você receberá notificações de novos lançamentos, aprovações e rejeições.
          </p>
        </div>
      )}
    </div>
  );
}
