// Service worker mínimo — solo existe para que el CMS cumpla el requisito de
// "instalable" como PWA. A propósito NO cachea páginas ni respuestas de la
// API: este es un panel de administración con datos que cambian todo el
// tiempo (contenido en revisión, automatizaciones corriendo) — servir una
// versión vieja desde caché sería peor que no tener caché. Solo el shell
// estático (íconos, manifest) se guarda para que el ícono/splash de la app
// instalada se vea bien incluso sin conexión.
const SHELL_CACHE = "cms-shell-v1";
const SHELL_ASSETS = [
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-192-maskable.png",
  "/icons/icon-512-maskable.png",
  "/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== SHELL_CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  if (!SHELL_ASSETS.includes(url.pathname)) return;

  event.respondWith(caches.match(event.request).then((cached) => cached ?? fetch(event.request)));
});
