/* ==========================================================================
   JTCF — Annonce des nouveautés
   --------------------------------------------------------------------------
   À la connexion, l'apprenant voit une fois — une seule — l'explication
   de ce qui vient d'arriver dans son livret. Ensuite elle ne revient plus.

   Pour annoncer autre chose plus tard : ajoutez un bloc en tête du tableau
   NOUVEAUTES avec un identifiant neuf. Celui du dessus est toujours celui
   qui s'affiche.

   Chargé par : livret.html · livret-fc.html · livret-stage.html
   ========================================================================== */
(function (global) {
  'use strict';

  var NOUVEAUTES = [
    {
      id: 'rdv-2026-09',
      emoji: '📅',
      titre: 'Nouveau : prendre rendez-vous',
      accroche: 'Un onglet Rendez-vous vient d\'arriver dans votre livret.',
      points: [
        ['🗓️', 'Choisir un créneau',
         'Vous voyez les moments où l\'équipe est disponible. Vous cliquez sur celui qui vous arrange, '
         + 'et c\'est réservé. Pas besoin d\'appeler ni d\'attendre une réponse.'],
        ['✍️', 'Ou faire une demande',
         'Si aucun créneau ne vous convient, dites-nous quand vous êtes disponible et pourquoi '
         + 'vous souhaitez nous voir. Nous vous répondons dans votre livret.'],
        ['👥', 'Avec qui vous voulez',
         'Alexandre, Marine, votre formatrice — ou plusieurs d\'entre nous en même temps. '
         + 'Vous cochez simplement les personnes concernées.'],
        ['💬', 'Pour quoi ?',
         'Le suivi de votre parcours, une difficulté personnelle, une question sur votre contrat '
         + 'ou votre rémunération, une absence à justifier, la préparation d\'un examen, '
         + 'la relation avec votre entreprise. Ou autre chose : vous l\'écrivez.']
      ],
      final: 'Rien n\'est obligatoire. Cet onglet existe pour que vous puissiez nous joindre '
           + 'facilement, quand vous en avez besoin.'
    }
  ];

  var CLE = 'jtcf_vues';

  function vues() {
    try { return (localStorage.getItem(CLE) || '').split(',').filter(Boolean); }
    catch (e) { return []; }
  }

  function marquerVue(id) {
    try {
      var l = vues();
      if (l.indexOf(id) < 0) l.push(id);
      localStorage.setItem(CLE, l.join(','));
    } catch (e) { }
  }

  function fermer() {
    var f = document.getElementById('jtcfNouveaute');
    if (f) f.remove();
  }

  function ouvrir(n) {
    // La demande d'adresse e-mail passe avant : on ne superpose pas deux fenêtres.
    if (document.getElementById('jtcfAdresseModale')) {
      setTimeout(function () { ouvrir(n); }, 2500);
      return;
    }
    fermer();

    var fond = document.createElement('div');
    fond.id = 'jtcfNouveaute';
    fond.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:10001;' +
      'display:flex;align-items:center;justify-content:center;padding:18px;';

    var lignes = n.points.map(function (p) {
      return '<div style="display:flex;gap:11px;padding:11px 0;border-bottom:1px solid #f0f2f5;">'
        + '<div style="font-size:19px;line-height:1.2;flex-shrink:0;">' + p[0] + '</div>'
        + '<div style="flex:1;min-width:0;">'
        + '<div style="font-size:13.5px;font-weight:700;color:#2d3748;">' + p[1] + '</div>'
        + '<div style="font-size:12.5px;color:#4a5568;line-height:1.55;margin-top:3px;">' + p[2] + '</div>'
        + '</div></div>';
    }).join('');

    var boite = document.createElement('div');
    boite.style.cssText =
      'background:#fff;border-radius:18px;padding:0;max-width:400px;width:100%;' +
      'max-height:86vh;overflow-y:auto;box-shadow:0 12px 44px rgba(0,0,0,.32);';

    boite.innerHTML =
      '<div style="background:linear-gradient(135deg,var(--bleu-fonce,#14395C),var(--bleu,#2C6E9B));'
      + 'color:#fff;padding:22px 20px 18px;text-align:center;border-radius:18px 18px 0 0;">'
      + '<div style="font-size:34px;">' + n.emoji + '</div>'
      + '<div style="font-size:17px;font-weight:800;margin-top:6px;">' + n.titre + '</div>'
      + '<div style="font-size:12.5px;opacity:.85;margin-top:4px;line-height:1.5;">' + n.accroche + '</div>'
      + '</div>'
      + '<div style="padding:6px 20px 0;">' + lignes + '</div>'
      + '<div style="padding:14px 20px 0;">'
      + '<div style="background:var(--or-pale,#FDF6E3);border-left:3px solid var(--or,#C9A227);'
      + 'border-radius:0 8px 8px 0;padding:11px 13px;font-size:12.5px;color:#744210;line-height:1.6;">'
      + n.final + '</div></div>'
      + '<div style="padding:14px 20px 20px;">'
      + '<button id="jtcfNouveauteOk" style="width:100%;padding:14px;'
      + 'background:var(--bleu-fonce,#14395C);color:#fff;border:none;border-radius:12px;'
      + 'font-size:15px;font-weight:800;cursor:pointer;-webkit-appearance:none;">J\'ai compris</button>'
      + '</div>';

    fond.appendChild(boite);
    document.body.appendChild(fond);

    document.getElementById('jtcfNouveauteOk').addEventListener('click', function () {
      marquerVue(n.id);
      fermer();
    });
  }

  /**
   * Affiche la nouveauté la plus récente que cette personne n'a pas encore vue.
   * Ne fait rien si tout a déjà été lu.
   */
  function verifier(delai) {
    var deja = vues();
    for (var i = 0; i < NOUVEAUTES.length; i++) {
      if (deja.indexOf(NOUVEAUTES[i].id) < 0) {
        var n = NOUVEAUTES[i];
        setTimeout(function () { ouvrir(n); }, delai || 1400);
        return true;
      }
    }
    return false;
  }

  global.JTCF_NEWS = {
    verifier: verifier,
    // Pour revoir l'explication à la demande : JTCF_NEWS.revoir()
    revoir: function (id) {
      var n = id ? NOUVEAUTES.filter(function (x) { return x.id === id; })[0] : NOUVEAUTES[0];
      if (n) ouvrir(n);
    }
  };
})(window);
