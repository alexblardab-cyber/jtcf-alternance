/* ==========================================================================
   JTCF — Thèmes saisonniers réunionnais + moments de l'année
   --------------------------------------------------------------------------
   Un seul fichier, chargé par toutes les pages de l'application.

   1. Le THÈME change tout seul au fil des quatre saisons de La Réunion.
   2. Les MOMENTS (Fét Kaf, fin d'année, 1er mai, rentrée) se superposent
      quelques jours par an et remplacent l'accent de couleur.

   L'utilisateur ouvre le sélecteur en cliquant sur la pastille affichée
   sous le titre, dans l'en-tête.

   Pour ajuster une couleur ou une date : tout se règle ci-dessous.
   Aucune intervention n'est nécessaire dans les pages HTML.
   ========================================================================== */
(function () {
  'use strict';

  /* ---- 1. Les quatre saisons -------------------------------------------- */

  var SAISONS = [
    {
      id: 'pluies',
      nom: 'Saison des pluies',
      emoji: '🌿',
      mois: [0, 1, 2],                 // janvier · février · mars
      note: 'Les hauts sont verts, la chaleur est humide.',
      fonce: '#14532D', mid: '#2D6A4F', clair: '#E9F5EE',
      accent: '#E08A3C', accentClair: '#F6C99B', accentPale: '#FDF4EA'
    },
    {
      id: 'canne',
      nom: 'Récolte de la canne',
      emoji: '🌾',
      mois: [3, 4, 5],                 // avril · mai · juin
      note: 'Les champs jaunissent, les journées raccourcissent.',
      fonce: '#5C4326', mid: '#8B6B3E', clair: '#F7F1E6',
      accent: '#C9A227', accentClair: '#F0D98A', accentPale: '#FDF6E3'
    },
    {
      id: 'baleines',
      nom: 'Hiver austral',
      emoji: '🐋',
      mois: [6, 7, 8],                 // juillet · août · septembre
      note: 'Air sec et frais, les baleines longent la côte.',
      fonce: '#14395C', mid: '#2C6E9B', clair: '#E8F2F9',
      accent: '#1F9E98', accentClair: '#9BE0DC', accentPale: '#EDFAF9'
    },
    {
      id: 'flamboyants',
      nom: 'Flamboyants',
      emoji: '🌺',
      mois: [9, 10, 11],               // octobre · novembre · décembre
      note: 'Les arbres rougissent, les letchis arrivent.',
      fonce: '#7A1F1F', mid: '#B23A2E', clair: '#FCEDEA',
      accent: '#E4A11B', accentClair: '#F8D68A', accentPale: '#FEF7E8'
    }
  ];

  /* ---- 2. Les moments de l'année ----------------------------------------
     Ordre = priorité. Le premier qui correspond à la date l'emporte.
     « optionnel: true » ⇒ désactivé tant que l'utilisateur ne l'active pas.
     Pour décaler la rentrée, modifiez RENTREE ci-dessous.               */

  var RENTREE = { mois: 8, jour: 7, duree: 7 };   // 7 septembre, pendant 7 jours

  var MOMENTS = [
    {
      id: 'fetkaf',
      nom: 'Fét Kaf',
      note: 'Abolition de l\'esclavage · 20 décembre',
      ornement: '🥁',
      bandeau: 'Fét Kaf · 20 décembre',
      accent: '#D62828', accentClair: '#F5B7B1', accentPale: '#FDEDEC',
      quand: function (d) {
        return d.getMonth() === 11 && d.getDate() >= 19 && d.getDate() <= 21;
      }
    },
    {
      id: 'finannee',
      nom: 'Fêtes de fin d\'année',
      note: 'Du 15 décembre au 2 janvier',
      ornement: '🎄',
      bandeau: 'Bonnes fêtes',
      accent: '#C9A227', accentClair: '#F0D98A', accentPale: '#FDF6E3',
      quand: function (d) {
        var m = d.getMonth(), j = d.getDate();
        return (m === 11 && j >= 15) || (m === 0 && j <= 2);
      }
    },
    {
      id: 'premiermai',
      nom: '1er mai',
      note: 'Fête du travail',
      ornement: '🌿',
      bandeau: '1er mai · Fête du travail',
      accent: '#2F855A', accentClair: '#A7E3C0', accentPale: '#EFFAF3',
      quand: function (d) { return d.getMonth() === 4 && d.getDate() === 1; }
    },
    {
      id: 'rentree',
      nom: 'Rentrée',
      note: 'La semaine de reprise',
      ornement: '🎒',
      bandeau: 'Bonne rentrée',
      accent: '#2B6CB0', accentClair: '#A9CBEC', accentPale: '#EEF5FC',
      quand: function (d) {
        if (d.getMonth() !== RENTREE.mois) return false;
        return d.getDate() >= RENTREE.jour && d.getDate() < RENTREE.jour + RENTREE.duree;
      }
    },
    {
      id: 'halloween',
      nom: 'Halloween',
      note: 'Désactivé par défaut · à vous de voir',
      ornement: '🎃',
      bandeau: 'Halloween',
      optionnel: true,
      accent: '#DD6B20', accentClair: '#F6C08A', accentPale: '#FEF4EA',
      quand: function (d) {
        return d.getMonth() === 9 && d.getDate() >= 30;
      }
    }
  ];

  var CLE = 'jtcf_theme';
  var CLE_OPT = 'jtcf_moments';

  /* ---- Lecture des préférences ------------------------------------------ */

  function lire(cle, defaut) {
    try { var v = localStorage.getItem(cle); return v === null ? defaut : v; }
    catch (e) { return defaut; }
  }
  function ecrire(cle, valeur) {
    try { localStorage.setItem(cle, valeur); } catch (e) { }
  }
  function momentsActives() {
    var brut = lire(CLE_OPT, '');
    return brut ? brut.split(',') : [];
  }
  function estActive(m) {
    return !m.optionnel || momentsActives().indexOf(m.id) >= 0;
  }

  function saisonDuMois(m) {
    for (var i = 0; i < SAISONS.length; i++) {
      if (SAISONS[i].mois.indexOf(m) >= 0) return SAISONS[i];
    }
    return SAISONS[1];
  }

  function saisonChoisie() {
    var force = lire(CLE, 'auto');
    if (force && force !== 'auto') {
      for (var i = 0; i < SAISONS.length; i++) {
        if (SAISONS[i].id === force) return SAISONS[i];
      }
    }
    return saisonDuMois(new Date().getMonth());
  }

  function momentDuJour() {
    var d = new Date();
    for (var i = 0; i < MOMENTS.length; i++) {
      if (estActive(MOMENTS[i]) && MOMENTS[i].quand(d)) return MOMENTS[i];
    }
    return null;
  }

  /* ---- Application ------------------------------------------------------- */

  function appliquer() {
    var s = saisonChoisie();
    var m = momentDuJour();

    var accent = m ? m.accent : s.accent;
    var accentClair = m ? m.accentClair : s.accentClair;
    var accentPale = m ? m.accentPale : s.accentPale;

    var css =
      ':root{' +
      '--bleu-fonce:' + s.fonce + ';' +
      '--bleu:' + s.mid + ';' +
      '--bleu-clair:' + s.clair + ';' +
      '--or:' + accent + ';' +
      '--or-clair:' + accentClair + ';' +
      '--or-pale:' + accentPale + ';' +
      '}';

    var bal = document.getElementById('jtcfThemeStyle');
    if (!bal) {
      bal = document.createElement('style');
      bal.id = 'jtcfThemeStyle';
      document.head.appendChild(bal);
    }
    bal.textContent = css;

    // Couleur de la barre système sur mobile et en application installée.
    var meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', s.fonce);

    document.documentElement.setAttribute('data-saison', s.id);
    document.documentElement.setAttribute('data-moment', m ? m.id : '');
    window.JTCF_SAISON = s;
    window.JTCF_MOMENT = m;

    majEntete();
  }

  /* ---- En-tête : ornement + pastille ------------------------------------- */

  function majEntete() {
    var entete = document.querySelector('.header');
    if (!entete) return;

    var s = window.JTCF_SAISON, m = window.JTCF_MOMENT;

    // Ornement collé au logo (bonnet, citrouille, cartable…)
    var logo = entete.querySelector('.logo');
    var orn = document.getElementById('jtcfOrnement');
    if (m && logo) {
      if (!orn) {
        orn = document.createElement('span');
        orn.id = 'jtcfOrnement';
        orn.style.cssText = 'margin-right:6px;font-size:1.05em;vertical-align:-2px;';
        logo.insertBefore(orn, logo.firstChild);
      }
      orn.textContent = m.ornement;
      orn.title = m.nom + ' — ' + m.note;
    } else if (orn) {
      orn.remove();
    }

    // Pastille cliquable
    var b = document.getElementById('jtcfSaison');
    if (!b) {
      b = document.createElement('div');
      b.id = 'jtcfSaison';
      b.style.cssText =
        'margin-top:6px;font-size:11px;font-weight:700;opacity:.9;cursor:pointer;' +
        'display:inline-block;padding:3px 10px;border-radius:20px;' +
        'background:rgba(255,255,255,.15);color:#fff;user-select:none;';
      b.addEventListener('click', ouvrirChoix);
      var ancre = entete.querySelector('.logo-sub');
      if (ancre && ancre.parentNode) ancre.parentNode.insertBefore(b, ancre.nextSibling);
      else entete.appendChild(b);
    }
    if (m) {
      b.textContent = m.ornement + ' ' + m.bandeau;
      b.title = m.nom + ' — ' + m.note + '  (cliquer pour changer)';
    } else {
      b.textContent = s.emoji + ' ' + s.nom;
      b.title = s.note + '  (cliquer pour changer)';
    }
  }

  /* ---- Sélecteur ---------------------------------------------------------- */

  function ouvrirChoix() {
    if (document.getElementById('jtcfThemeModale')) return;

    var actuel = lire(CLE, 'auto');
    var opt = momentsActives();

    var html =
      '<div style="font-size:15px;font-weight:800;color:#2d3748;margin-bottom:4px;">Apparence de l\'application</div>' +
      '<div style="font-size:12px;color:#718096;margin-bottom:14px;">Le thème suit les saisons de La Réunion. Vous pouvez aussi en fixer un.</div>';

    html += ligneChoix('auto', '🔄', 'Automatique', 'Change seul au fil des saisons', actuel === 'auto');
    SAISONS.forEach(function (s) {
      html += ligneChoix(s.id, s.emoji, s.nom, s.note, actuel === s.id);
    });

    var optionnels = MOMENTS.filter(function (m) { return m.optionnel; });
    if (optionnels.length) {
      html += '<div style="font-size:13px;font-weight:800;color:#2d3748;margin:16px 0 4px;">Habillages ponctuels</div>' +
        '<div style="font-size:11px;color:#718096;margin-bottom:10px;">Fét Kaf, les fêtes de fin d\'année, le 1er mai et la rentrée s\'affichent toujours. Ceux-ci sont à votre main.</div>';
      optionnels.forEach(function (m) {
        var on = opt.indexOf(m.id) >= 0;
        html += '<div data-moment-id="' + m.id + '" style="display:flex;align-items:center;gap:12px;' +
          'padding:11px 12px;margin-bottom:7px;border-radius:11px;cursor:pointer;' +
          'border:2px solid ' + (on ? '#DD6B20' : '#edf2f7') + ';' +
          'background:' + (on ? '#FEF4EA' : '#fff') + ';">' +
          '<div style="font-size:20px;">' + m.ornement + '</div>' +
          '<div style="flex:1;min-width:0;">' +
          '<div style="font-size:13px;font-weight:700;color:#2d3748;">' + m.nom + '</div>' +
          '<div style="font-size:11px;color:#718096;">' + m.note + '</div>' +
          '</div>' +
          '<div style="font-size:12px;font-weight:800;color:' + (on ? '#DD6B20' : '#a0aec0') + ';">' +
          (on ? 'Activé' : 'Désactivé') + '</div>' +
          '</div>';
      });
    }

    html += '<button id="jtcfThemeFermer" style="width:100%;margin-top:14px;padding:12px;' +
      'background:#e2e8f0;color:#2d3748;border:none;border-radius:10px;' +
      'font-size:14px;font-weight:700;cursor:pointer;">Fermer</button>';

    var fond = document.createElement('div');
    fond.id = 'jtcfThemeModale';
    fond.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;' +
      'display:flex;align-items:center;justify-content:center;padding:20px;';

    var boite = document.createElement('div');
    boite.style.cssText =
      'background:#fff;border-radius:16px;padding:18px;max-width:380px;width:100%;' +
      'max-height:82vh;overflow-y:auto;box-shadow:0 10px 40px rgba(0,0,0,.3);';
    boite.innerHTML = html;
    fond.appendChild(boite);
    document.body.appendChild(fond);

    boite.querySelectorAll('[data-saison-id]').forEach(function (el) {
      el.addEventListener('click', function () {
        ecrire(CLE, el.getAttribute('data-saison-id'));
        appliquer();
        fond.remove();
      });
    });

    boite.querySelectorAll('[data-moment-id]').forEach(function (el) {
      el.addEventListener('click', function () {
        var id = el.getAttribute('data-moment-id');
        var liste = momentsActives();
        var i = liste.indexOf(id);
        if (i >= 0) liste.splice(i, 1); else liste.push(id);
        ecrire(CLE_OPT, liste.join(','));
        appliquer();
        fond.remove();
        ouvrirChoix();
      });
    });

    document.getElementById('jtcfThemeFermer').addEventListener('click', function () { fond.remove(); });
    fond.addEventListener('click', function (e) { if (e.target === fond) fond.remove(); });
  }

  function ligneChoix(id, emoji, nom, note, actif) {
    return '<div data-saison-id="' + id + '" style="display:flex;align-items:center;gap:12px;' +
      'padding:11px 12px;margin-bottom:7px;border-radius:11px;cursor:pointer;' +
      'border:2px solid ' + (actif ? '#2C6E9B' : '#edf2f7') + ';' +
      'background:' + (actif ? '#f0f7fc' : '#fff') + ';">' +
      '<div style="font-size:20px;">' + emoji + '</div>' +
      '<div style="flex:1;min-width:0;">' +
      '<div style="font-size:13px;font-weight:700;color:#2d3748;">' + nom + '</div>' +
      '<div style="font-size:11px;color:#718096;">' + note + '</div>' +
      '</div>' +
      (actif ? '<div style="font-size:15px;color:#2C6E9B;font-weight:800;">✓</div>' : '') +
      '</div>';
  }

  /* ---- Démarrage ---------------------------------------------------------- */

  appliquer();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', majEntete);
  } else {
    majEntete();
  }

  // Si l'application reste ouverte plusieurs jours, on revérifie la date.
  setInterval(appliquer, 60 * 60 * 1000);

  window.JTCF_THEME = {
    saisons: SAISONS,
    moments: MOMENTS,
    appliquer: function (id) { ecrire(CLE, id); appliquer(); },
    ouvrir: ouvrirChoix,
    // Aperçu sans attendre la date : JTCF_THEME.essayer('finannee')
    essayer: function (idMoment) {
      var m = null;
      MOMENTS.forEach(function (x) { if (x.id === idMoment) m = x; });
      if (!m) { console.log('Moment inconnu. Disponibles :', MOMENTS.map(function (x) { return x.id; }).join(', ')); return; }
      window.JTCF_MOMENT = m;
      var bal = document.getElementById('jtcfThemeStyle');
      if (bal) bal.textContent = bal.textContent
        .replace(/--or:[^;]+;/, '--or:' + m.accent + ';')
        .replace(/--or-clair:[^;]+;/, '--or-clair:' + m.accentClair + ';')
        .replace(/--or-pale:[^;]+;/, '--or-pale:' + m.accentPale + ';');
      majEntete();
    }
  };
})();
