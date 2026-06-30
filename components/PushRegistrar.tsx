"use client";

import { useEffect, useState } from "react";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

async function registrarSubscription() {
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });
  const json = sub.toJSON();
  await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(json),
  });
}

export default function PushRegistrar() {
  const [mostrar, setMostrar] = useState(false);
  const [status, setStatus] = useState<"idle" | "ok" | "negado">("idle");

  useEffect(() => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return;

    const perm = Notification.permission;
    if (perm === "granted") {
      // Já tem permissão — só registrar silenciosamente
      registrarSubscription().catch(() => null);
      return;
    }
    if (perm === "denied") return; // usuário negou antes
    // "default" = nunca perguntado → mostrar botão
    setMostrar(true);
  }, []);

  async function ativar() {
    try {
      const perm = await Notification.requestPermission();
      if (perm === "granted") {
        await registrarSubscription();
        setStatus("ok");
        setTimeout(() => setMostrar(false), 2500);
      } else {
        setStatus("negado");
        setTimeout(() => setMostrar(false), 3000);
      }
    } catch {
      setMostrar(false);
    }
  }

  if (!mostrar) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 16,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,
        background: "#2c6975",
        color: "#fff",
        borderRadius: 12,
        padding: "12px 20px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
        fontSize: 14,
        maxWidth: "90vw",
      }}
    >
      {status === "ok" ? (
        <span>✅ Notificações ativadas!</span>
      ) : status === "negado" ? (
        <span>❌ Permissão negada.</span>
      ) : (
        <>
          <span>🔔 Receber notificações do app?</span>
          <button
            onClick={ativar}
            style={{
              background: "#f4dd3d",
              color: "#1c474f",
              border: "none",
              borderRadius: 8,
              padding: "6px 14px",
              fontWeight: 700,
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            Ativar
          </button>
          <button
            onClick={() => setMostrar(false)}
            style={{
              background: "transparent",
              color: "#fff",
              border: "none",
              cursor: "pointer",
              fontSize: 18,
              lineHeight: 1,
              padding: 0,
            }}
          >
            ×
          </button>
        </>
      )}
    </div>
  );
}
