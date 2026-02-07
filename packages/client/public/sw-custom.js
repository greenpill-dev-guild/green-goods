const GREEN_GOODS_SYNC_TAG = "green-goods-sync";

async function notifyClients(payload) {
  const windowClients = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });

  windowClients.forEach((client) => {
    client.postMessage({
      type: "BACKGROUND_SYNC",
      payload: {
        ...payload,
        timestamp: Date.now(),
      },
    });
  });
}

self.addEventListener("message", (event) => {
  const type = event.data?.type;

  if (type === "REGISTER_SYNC") {
    event.waitUntil(
      (async () => {
        if (!self.registration?.sync) {
          await notifyClients({ tag: GREEN_GOODS_SYNC_TAG, fallback: true });
          return;
        }

        try {
          await self.registration.sync.register(GREEN_GOODS_SYNC_TAG);
        } catch {
          await notifyClients({ tag: GREEN_GOODS_SYNC_TAG, fallback: true });
        }
      })()
    );
  }

  if (type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("sync", (event) => {
  if (event.tag !== GREEN_GOODS_SYNC_TAG) {
    return;
  }

  event.waitUntil(notifyClients({ tag: GREEN_GOODS_SYNC_TAG }));
});
