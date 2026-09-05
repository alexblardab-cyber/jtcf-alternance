/* ==========================================================================
   JTCF — Thèmes saisonniers réunionnais
   --------------------------------------------------------------------------
   Un seul fichier, chargé par toutes les pages de l'application.
   Le thème change tout seul au fil des saisons de La Réunion.
   L'utilisateur peut forcer un thème en cliquant sur le nom de la saison
   affiché sous le titre, dans l'en-tête.

   Pour modifier une couleur : éditez la palette concernée ci-dessous.
   Aucune autre intervention n'est nécessaire dans les pages HTML.
   ========================================================================== */
(function () {
  'use strict';

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

  var CLE = 'jtcf_theme';

  function saisonDuMois(m) {
    for (var i = 0; i < SAISONS.length; i++) {
      if (SAISONS[i].mois.indexOf(m) >= 0) return SAISONS[i];
    }
    return SAISONS[1];
  }

  function saisonChoisie() {
    var force = null;
    try { force = localStorage.getItem(CLE); } catch (e) { }
    if (force && force !== 'auto') {
      for (var i = 0; i < SAISONS.length; i++) {
        if (SAISONS[i].id === force) return SAISONS[i];
      }
    }
    return saisonDuMois(new Date().getMonth());
  }

  function appliquer(s) {
    var css =
      ':root{' +
      '--bleu-fonce:' + s.fonce + ';' +
      '--bleu:' + s.mid + ';' +
      '--bleu-clair:' + s.clair + ';' +
      '--or:' + s.accent + ';' +
      '--or-clair:' + s.accentClair + ';' +
      '--or-pale:' + s.accentPale + ';' +
      '--saison-nom:"' + s.nom + '";' +
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
    window.JTCF_SAISON = s;
  }

  /* ---- Sélecteur discret dans l'en-tête ---------------------------------- */

  function poserBandeau() {
    var entete = document.querySelector('.header');
    if (!entete || document.getElementById('jtcfSaison')) return;

    var s = window.JTCF_SAISON;
    var b = document.createElement('div');
    b.id = 'jtcfSaison';
    b.style.cssText =
      'margin-top:6px;font-size:11px;font-weight:700;opacity:.85;cursor:pointer;' +
      'display:inline-block;padding:3px 10px;border-radius:20px;' +
      'background:rgba(255,255,255,.15);color:#fff;user-select:none;';
    b.textContent = s.emoji + ' ' + s.nom;
    b.title = s.note + '  (cliquer pour changer)';
    b.addEventListener('click', ouvrirChoix);

    var ancre = entete.querySelector('.logo-sub');
    if (ancre && ancre.parentNode) ancre.parentNode.insertBefore(b, ancre.nextSibling);
    else entete.appendChild(b);
  }

  function ouvrirChoix() {
    if (document.getElementById('jtcfThemeModale')) return;

    var actuel = 'auto';
    try { actuel = localStorage.getItem(CLE) || 'auto'; } catch (e) { }

    var fond = document.createElement('div');
    fond.id = 'jtcfThemeModale';
    fond.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;' +
      'display:flex;align-items:center;justify-content:center;padding:20px;';

    var lignes = '<div style="font-size:15px;font-weight:800;color:#2d3748;margin-bottom:4px;">Apparence de l\'application</div>' +
      '<div style="font-size:12px;color:#718096;margin-bottom:14px;">Le thème suit les saisons de La Réunion. Vous pouvez aussi en fixer un.</div>';

    lignes += ligneChoix('auto', '🔄', 'Automatique', 'Change seul au fil des saisons', actuel === 'auto');
    SAISONS.forEach(function (s) {
      lignes += ligneChoix(s.id, s.emoji, s.nom, s.note, actuel === s.id);
    });

    lignes += '<button id="jtcfThemeFermer" style="width:100%;margin-top:14px;padding:12px;' +
      'background:#e2e8f0;color:#2d3748;border:none;border-radius:10px;' +
      'font-size:14px;font-weight:700;cursor:pointer;">Fermer</button>';

    var boite = document.createElement('div');
    boite.style.cssText =
      'background:#fff;border-radius:16px;padding:18px;max-width:380px;width:100%;' +
      'max-height:80vh;overflow-y:auto;box-shadow:0 10px 40px rgba(0,0,0,.3);';
    boite.innerHTML = lignes;
    fond.appendChild(boite);
    document.body.appendChild(fond);

    boite.querySelectorAll('[data-saison-id]').forEach(function (el) {
      el.addEventListener('click', function () {
        var id = el.getAttribute('data-saison-id');
        try { localStorage.setItem(CLE, id); } catch (e) { }
        appliquer(id === 'auto' ? saisonDuMois(new Date().getMonth()) : saisonChoisie());
        var b = document.getElementById('jtcfSaison');
        if (b) {
          b.textContent = window.JTCF_SAISON.emoji + ' ' + window.JTCF_SAISON.nom;
          b.title = window.JTCF_SAISON.note + '  (cliquer pour changer)';
        }
        fond.remove();
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

  /* ---- Démarrage --------------------------------------------------------- */

  appliquer(saisonChoisie());

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', poserBandeau);
  } else {
    poserBandeau();
  }

  window.JTCF_THEME = {
    saisons: SAISONS,
    appliquer: function (id) {
      try { localStorage.setItem(CLE, id); } catch (e) { }
      appliquer(id === 'auto' ? saisonDuMois(new Date().getMonth()) : saisonChoisie());
    },
    ouvrir: ouvrirChoix
  };
})();
