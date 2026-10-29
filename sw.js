// Service worker Catetan Kebon Ibu — versi cache; naikkan nomor ini setiap
// kali ingin memaksa semua perangkat membuang cache lama.
const VERSI = "kebon-ibu-v1";
const BERKAS_INTI = [
  "./",
  "index.html",
  "admin.html",
  "manifest.webmanifest",
  "aset/tailwind.css",
  "aset/gaya-utama.css",
  "aset/gaya-admin.css",
  "aset/aplikasi.js",
  "aset/admin.js",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(VERSI).then((c) => c.addAll(BERKAS_INTI)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSI).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // Hanya urus berkas milik aplikasi sendiri; API Supabase, cuaca, dan CDN
  // selalu langsung ke jaringan supaya data tidak pernah basi.
  if (e.request.method !== "GET" || url.origin !== self.location.origin) return;
  const adalahHalaman = e.request.mode === "navigate" || url.pathname.endsWith(".html");
  if (adalahHalaman) {
    // Halaman: utamakan jaringan (selalu versi terbaru), cache hanya cadangan.
    e.respondWith(
      fetch(e.request)
        .then((r) => {
          const salinan = r.clone();
          caches.open(VERSI).then((c) => c.put(e.request, salinan));
          return r;
        })
        .catch(() => caches.match(e.request, { ignoreSearch: true }))
    );
  } else {
    // Berkas statis: layani dari cache sambil memperbarui di belakang layar.
    e.respondWith(
      caches.match(e.request, { ignoreSearch: true }).then((tersimpan) => {
        const jaringan = fetch(e.request)
          .then((r) => {
            const salinan = r.clone();
            caches.open(VERSI).then((c) => c.put(e.request, salinan));
            return r;
          })
          .catch(() => tersimpan);
        return tersimpan || jaringan;
      })
    );
  }
});
