self.addEventListener("push", (event) => {
  if (!event.data) return;
  const data = event.data.json();
  // iOS mostra: SBJ (bold) / from SBJ / body
  // Juntamos título e texto no body para ficar: "Tipo: Mensagem"
  const body = data.title && data.body
    ? `${data.title}: ${data.body}`
    : data.body || data.title || "";
  event.waitUntil(
    self.registration.showNotification("SBJ", {
      body,
      icon: "/apple-touch-icon.png",
      badge: "/icon-192.png",
      data: data.url ? { url: data.url } : {},
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
