// ============================================================
// JTCF — Service Worker v1.0
// Notifications push locales — rappels signature émargement
// ============================================================

const CACHE_NAME = 'jtcf-sw-v1';

self.addEventListener('install', function(e) {
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil(clients.claim());
});

// Réception d'un message depuis l'appli
self.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'PROGRAMMER_NOTIFS') {
    programmerNotifications(e.data.jourCentre, e.data.nom);
  }
});

// Notification push reçue depuis le serveur (future extension FCM)
self.addEventListener('push', function(e) {
  const data = e.data ? e.data.json() : {};
  e.waitUntil(
    self.registration.showNotification(data.title || '✍️ JTCF — Émargement', {
      body: data.body || 'N\'oubliez pas de signer votre feuille d\'émargement !',
      icon: 'https://alexblardab-cyber.github.io/jtcf-alternance/icon-192.png',
      badge: 'https://alexblardab-cyber.github.io/jtcf-alternance/icon-192.png',
      vibrate: [200, 100, 200],
      tag: 'jtcf-emargement',
      requireInteraction: true,
      data: { url: e.data ? data.url : 'https://alexblardab-cyber.github.io/jtcf-alternance/' }
    })
  );
});

// Clic sur notification → ouvrir l'appli
self.addEventListener('notificationclick', function(e) {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url)
    || 'https://alexblardab-cyber.github.io/jtcf-alternance/';
  e.waitUntil(clients.openWindow(url));
});

// ── Programmation des rappels locaux ──────────────────────────
function programmerNotifications(jourCentre, nom) {
  const jourMap = { Lundi:1, Mardi:2, Mercredi:3, Jeudi:4, Vendredi:5 };
  const jourNum = jourMap[jourCentre];
  if (!jourNum) return;

  const maintenant = new Date();
  const jourActuel = maintenant.getDay();

  // Si c'est bien le jour de centre
  if (jourActuel !== jourNum) return;

  // Rappel matin — 8h30
  const matin = new Date(maintenant);
  matin.setHours(8, 30, 0, 0);
  const delaiMatin = matin - maintenant;

  // Rappel après-midi — 13h30
  const aprem = new Date(maintenant);
  aprem.setHours(13, 30, 0, 0);
  const delaiAprem = aprem - maintenant;

  if (delaiMatin > 0) {
    setTimeout(function() {
      self.registration.showNotification('✍️ JTCF — Rappel signature matin', {
        body: nom ? `${nom}, pensez à signer votre émargement du matin !` : 'Pensez à signer votre émargement du matin !',
        icon: 'https://alexblardab-cyber.github.io/jtcf-alternance/icon-192.png',
        badge: 'https://alexblardab-cyber.github.io/jtcf-alternance/icon-192.png',
        vibrate: [200, 100, 200],
        tag: 'jtcf-matin',
        requireInteraction: true,
        data: { url: 'https://alexblardab-cyber.github.io/jtcf-alternance/livret.html' }
      });
    }, delaiMatin);
  }

  if (delaiAprem > 0) {
    setTimeout(function() {
      self.registration.showNotification('✍️ JTCF — Rappel signature après-midi', {
        body: nom ? `${nom}, pensez à signer votre émargement de l'après-midi !` : 'Pensez à signer votre émargement de l\'après-midi !',
        icon: 'https://alexblardab-cyber.github.io/jtcf-alternance/icon-192.png',
        badge: 'https://alexblardab-cyber.github.io/jtcf-alternance/icon-192.png',
        vibrate: [200, 100, 200],
        tag: 'jtcf-aprem',
        requireInteraction: true,
        data: { url: 'https://alexblardab-cyber.github.io/jtcf-alternance/livret.html' }
      });
    }, delaiAprem);
  }
}
