import webpush from "web-push";
import { createServiceClient } from "@/lib/supabase/service";

function initWebPush() {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails("mailto:notificacoessbj@gmail.com", pub, priv);
  return true;
}

async function enviarParaIds(userIds: string[], payload: { title: string; body: string; url?: string }) {
  if (!userIds.length || !initWebPush()) return;
  const supabase = createServiceClient();

  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("*")
    .in("user_id", userIds);

  if (!subs?.length) return;

  const mensagem = JSON.stringify(payload);

  await Promise.allSettled(
    subs.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        mensagem
      ).catch(() => null)
    )
  );
}

export async function notificarAdmins(payload: { title: string; body: string; url?: string }) {
  const supabase = createServiceClient();

  const { data: admins } = await supabase
    .from("perfis")
    .select("id")
    .eq("setor", "ADMIN")
    .eq("status", "aprovado");

  if (!admins?.length) return;
  await enviarParaIds(admins.map((a) => a.id), payload);
}

export async function notificarUsuarios(userIds: string[], payload: { title: string; body: string; url?: string }) {
  await enviarParaIds(userIds, payload);
}
