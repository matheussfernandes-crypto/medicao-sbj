import webpush from "web-push";
import { createServiceClient } from "@/lib/supabase/service";

function initWebPush(): boolean {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  try {
    webpush.setVapidDetails("mailto:notificacoessbj@gmail.com", pub, priv);
    return true;
  } catch {
    return false;
  }
}

async function enviarParaIds(
  userIds: string[],
  payload: { title: string; body: string; url?: string }
) {
  if (!userIds.length || !initWebPush()) return;

  let supabase;
  try {
    supabase = createServiceClient();
  } catch {
    return; // sem service role key: silencioso
  }

  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .in("user_id", userIds);

  if (!subs?.length) return;

  const mensagem = JSON.stringify(payload);

  await Promise.allSettled(
    subs.map((sub) =>
      webpush
        .sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          mensagem
        )
        .catch(() => null)
    )
  );
}

export async function notificarAdmins(payload: {
  title: string;
  body: string;
  url?: string;
}) {
  try {
    const supabase = createServiceClient();
    const { data: admins } = await supabase
      .from("perfis")
      .select("id")
      .eq("setor", "ADMIN")
      .eq("status", "aprovado");

    if (!admins?.length) return;
    await enviarParaIds(admins.map((a) => a.id), payload);
  } catch {
    // silencioso — não quebrar o fluxo principal
  }
}

export async function notificarUsuarios(
  userIds: string[],
  payload: { title: string; body: string; url?: string }
) {
  try {
    await enviarParaIds(userIds, payload);
  } catch {
    // silencioso
  }
}
