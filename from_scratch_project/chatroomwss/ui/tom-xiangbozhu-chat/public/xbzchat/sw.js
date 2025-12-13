self.addEventListener("push", event => {
  let data = {};
  try {
    data = event.data.json();
  } catch {}

  event.waitUntil(
    self.registration.showNotification(
      data.title || "新消息 💬",
      {
        body: data.body || "",
        icon: "/icon-192.png",
        badge: "/badge.png",
        data: data.url || "/"
      }
    )
  );
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data)
  );
});
