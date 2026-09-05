/* ==========================================================================
   JTCF — Collecte de l'adresse e-mail
   --------------------------------------------------------------------------
   À la connexion, si l'apprenant n'a pas encore d'adresse enregistrée,
   une fenêtre la lui demande. Elle part directement dans Firebase, et
   l'administration n'a plus à la réclamer une par une.

   La fenêtre ne bloque pas l'émargement : un apprenant pressé peut
   remettre à plus tard. Elle réapparaîtra à la connexion suivante,
   tant que l'adresse n'est pas renseignée.

   Chargé par : livret.html · livret-fc.html
   ========================================================================== */
(function (global) {
  'use strict';

  var CLE_REPORT = 'jtcf_adresse_report';

  function valide(e) {
    return !!e && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(e).trim());
  }

  // Toutes les adresses sont acceptées, quel que soit le fournisseur :
  // iCloud, Hotmail, Yahoo et les autres fonctionnent avec le partage Drive.
  // La seule vérification porte sur la forme de l'adresse.

  function fermer() {
    var f = document.getElementById('jtcfAdresseModale');
    if (f) f.remove();
  }

  /**
   * Affiche la fenêtre de saisie.
   * @param {Object} o
   * @param {string} o.nom        Nom de la personne (affiché).
   * @param {string} o.adresse    Adresse déjà connue, si elle existe.
   * @param {Function} o.enregistrer  async (adresse) => void
   * @param {boolean} o.modification  true si l'apprenant vient la corriger lui-même.
   */
  function ouvrir(o) {
    fermer();

    var dejaLa = valide(o.adresse);
    var titre = o.modification || dejaLa ? 'Mon adresse e-mail' : 'Une dernière chose…';

    var intro = dejaLa
      ? 'Cette adresse sert à vous donner accès à votre dossier de documents. '
        + 'Vous pouvez la corriger si elle a changé.'
      : 'Pour recevoir l\'accès à votre dossier de documents — attestations, '
        + 'convocations et supports de formation — indiquez-nous l\'adresse '
        + 'e-mail que vous consultez le plus souvent.';

    var fond = document.createElement('div');
    fond.id = 'jtcfAdresseModale';
    fond.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:10000;' +
      'display:flex;align-items:center;justify-content:center;padding:18px;';

    var boite = document.createElement('div');
    boite.style.cssText =
      'background:#fff;border-radius:18px;padding:22px 20px;max-width:390px;width:100%;' +
      'box-shadow:0 12px 44px rgba(0,0,0,.32);';

    boite.innerHTML =
      '<div style="font-size:30px;text-align:center;margin-bottom:6px;">📧</div>' +
      '<div style="font-size:17px;font-weight:800;color:#2d3748;text-align:center;">' + titre + '</div>' +
      (o.nom ? '<div style="font-size:12px;color:#718096;text-align:center;margin-top:2px;">' + o.nom + '</div>' : '') +
      '<div style="font-size:13px;color:#4a5568;line-height:1.55;margin:14px 0 12px;">' + intro + '</div>' +
      '<input id="jtcfAdresseInput" type="email" inputmode="email" autocomplete="email" ' +
      'placeholder="prenom.nom@exemple.com" value="' + (o.adresse ? String(o.adresse).replace(/"/g, '&quot;') : '') + '" ' +
      'style="width:100%;padding:13px 14px;border:2px solid #e2e8f0;border-radius:12px;' +
      'font-size:15px;box-sizing:border-box;-webkit-appearance:none;" />' +
      '<div id="jtcfAdresseMsg" style="font-size:11.5px;min-height:16px;margin:7px 2px 0;color:#e53e3e;"></div>' +
      '<button id="jtcfAdresseOk" style="width:100%;margin-top:8px;padding:14px;' +
      'background:var(--bleu-fonce,#14395C);color:#fff;border:none;border-radius:12px;' +
      'font-size:15px;font-weight:800;cursor:pointer;-webkit-appearance:none;">Enregistrer</button>' +
      '<button id="jtcfAdressePlusTard" style="width:100%;margin-top:8px;padding:11px;' +
      'background:transparent;color:#718096;border:none;font-size:13px;font-weight:600;cursor:pointer;">'
      + (o.modification || dejaLa ? 'Annuler' : 'Plus tard') + '</button>';

    fond.appendChild(boite);
    document.body.appendChild(fond);

    var champ = document.getElementById('jtcfAdresseInput');
    var msg = document.getElementById('jtcfAdresseMsg');
    var btn = document.getElementById('jtcfAdresseOk');

    setTimeout(function () { try { champ.focus(); } catch (e) { } }, 120);

    async function valider() {
      var v = (champ.value || '').trim().toLowerCase();

      // Seule vérification : que l'adresse soit correctement formée.
      // Aucun jugement sur le fournisseur — iCloud, Hotmail et les autres
      // sont acceptés sans commentaire.
      if (!valide(v)) {
        msg.style.color = '#e53e3e';
        msg.textContent = 'Cette adresse ne semble pas correcte. Vérifiez le @ et le point.';
        champ.style.borderColor = '#e53e3e';
        return;
      }

      btn.disabled = true;
      btn.textContent = '⏳ Enregistrement…';
      try {
        await o.enregistrer(v);
        try { localStorage.removeItem(CLE_REPORT); } catch (e) { }
        boite.innerHTML =
          '<div style="font-size:34px;text-align:center;">✅</div>' +
          '<div style="font-size:16px;font-weight:800;color:#2d3748;text-align:center;margin-top:8px;">Adresse enregistrée</div>' +
          '<div style="font-size:13px;color:#4a5568;text-align:center;line-height:1.55;margin-top:8px;">'
          + v + '<br><br>Le centre pourra vous partager votre dossier Drive.</div>';
        setTimeout(fermer, 2200);
      } catch (err) {
        btn.disabled = false;
        btn.textContent = 'Enregistrer';
        msg.style.color = '#e53e3e';
        msg.textContent = 'Enregistrement impossible : ' + (err && err.message ? err.message : 'réessayez.');
      }
    }

    btn.addEventListener('click', valider);
    champ.addEventListener('keydown', function (e) { if (e.key === 'Enter') valider(); });
    champ.addEventListener('input', function () {
      champ.style.borderColor = '#e2e8f0';
      msg.textContent = '';
    });

    document.getElementById('jtcfAdressePlusTard').addEventListener('click', function () {
      try { localStorage.setItem(CLE_REPORT, new Date().toDateString()); } catch (e) { }
      fermer();
    });
  }

  /**
   * À appeler une fois le profil chargé. N'ouvre la fenêtre que si nécessaire.
   */
  function verifier(o) {
    if (valide(o.adresse)) return false;

    // Reportée aujourd'hui ? On ne harcèle pas dans la même journée.
    var report = null;
    try { report = localStorage.getItem(CLE_REPORT); } catch (e) { }
    if (report === new Date().toDateString()) return false;

    setTimeout(function () { ouvrir(o); }, 900);   // laisse la page s'afficher d'abord
    return true;
  }

  global.JTCF_ADRESSE = { verifier: verifier, ouvrir: ouvrir, valide: valide };
})(window);
