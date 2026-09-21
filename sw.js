/* ==========================================================================
   JTCF — Service worker
   --------------------------------------------------------------------------
   Deux rôles, et un seul principe : ne JAMAIS servir une version périmée
   de l'application.

   1. Rendre l'application installable sur ordinateur et sur Android.
   2. Afficher une page lisible quand il n'y a pas de réseau.

   Stratégie « réseau d'abord » : chaque page est demandée au serveur.
   Le cache ne sert que de secours hors connexion. C'est volontaire —
   une mise à jour déposée sur GitHub doit arriver tout de suite.
   ========================================================================== */

const CACHE = 'jtcf-v3';

// On ne met en cache que l'habillage, jamais les données.
const BASE = [
  './',
  './index.html',
  './manifest.json',
  './icone-192.png',
  './icone-512.png'
];

self.addEventListener('install', function (e) {
  // La nouvelle version prend la main sans attendre la fermeture des onglets.
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return c.addAll(BASE).catch(function () { /* un fichier manquant ne bloque pas */ });
    })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (noms) {
      return Promise.all(noms.map(function (n) {
        if (n !== CACHE) return caches.delete(n);   // on efface les anciennes versions
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  const req = e.request;

  // On ne touche ni à Firebase, ni aux scripts externes, ni aux écritures.
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    fetch(req)
      .then(function (rep) {
        // Copie de secours pour le mode hors connexion.
        if (rep && rep.status === 200) {
          const copie = rep.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copie); });
        }
        return rep;
      })
      .catch(function () {
        return caches.match(req).then(function (c) {
          if (c) return c;
          return new Response(
            '<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">'
            + '<meta name="viewport" content="width=device-width,initial-scale=1">'
            + '<title>Hors connexion</title></head>'
            + '<body style="font-family:Segoe UI,sans-serif;background:#2a3f4e;color:#fff;'
            + 'display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px;">'
            + '<div style="text-align:center;max-width:320px;">'
            + '<div style="font-size:40px;">📡</div>'
            + '<div style="font-size:18px;font-weight:800;color:#C9A227;margin-top:10px;">Pas de connexion</div>'
            + '<div style="font-size:13px;line-height:1.6;margin-top:10px;opacity:.85;">'
            + 'Votre émargement a besoin d\'Internet pour être enregistré. '
            + 'Reconnectez-vous au wifi du centre, puis réessayez.</div>'
            + '</div></body></html>',
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          );
        });
      })
  );
});
