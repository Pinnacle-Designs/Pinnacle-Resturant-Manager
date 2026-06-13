self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SHOW_NOTIFICATIONS") {
    const insights = event.data.insights || [];
    insights.forEach((insight) => {
      self.registration.showNotification(insight.title, {
        body: insight.description,
        icon: "/logo.png",
        badge: "/logo.png",
        tag: `insight-${insight.title}`,
        data: { url: "/insights" },
      });
    });
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/insights";
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
