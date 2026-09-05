/* ==========================================================================
   JTCF — Règles métier communes
   --------------------------------------------------------------------------
   SEULE SOURCE DE VÉRITÉ pour :
     · les volumes horaires (alternance et formation continue)
     · les jours de centre et le jour en autonomie
     · les périodes de stage, de vacances et les jours fériés
     · les dates de début et de fin de parcours

   Ces règles étaient auparavant recopiées dans chaque page, ce qui a produit
   plusieurs incohérences (ASCA sans le vendredi, après-midi comptée 3h30).
   Elles ne vivent désormais qu'ici : une correction faite dans ce fichier
   s'applique partout, immédiatement.

   Chargé par : livret.html · livret-fc.html · formatrice.html · admin.html
   ========================================================================== */
(function (global) {
  'use strict';

  /* ---- Volumes horaires -------------------------------------------------- */

  // Alternance : 8h00–12h00 = 4 h · 13h00–16h00 = 3 h → 7 h par journée
  var MATIN_H = 4;
  var AM_H = 3;

  // Formation continue : 8h15–12h00 = 3,75 h · 13h00–15h15 = 2,25 h
  // → 6 h par journée, 30 h par semaine (5 journées dont une en autonomie)
  var MATIN_FC = 3.75;
  var AM_FC = 2.25;
  var JOUR_FC_H = 6;

  /* ---- Jours de présence ------------------------------------------------- */
  // ASCA (Comptabilité) : centre lundi, mercredi, jeudi, vendredi — mardi en autonomie
  // AD / CV / ACOM      : centre lundi, mardi, mercredi, jeudi   — vendredi en autonomie

  function estASCA(fc) {
    if (!fc) return false;
    if (fc.jours && fc.jours.indexOf && fc.jours.indexOf('Vendredi') >= 0) return true;
    if (fc.formation && fc.formation.indexOf('Comptabilit') >= 0) return true;
    return false;
  }

  function joursDeFC(fc) { return estASCA(fc) ? [1, 3, 4, 5] : [1, 2, 3, 4]; }

  function joursSelonFormation(formation) {
    return (formation || '').indexOf('Comptabilit') >= 0
      ? ['Lundi', 'Mercredi', 'Jeudi', 'Vendredi']
      : ['Lundi', 'Mardi', 'Mercredi', 'Jeudi'];
  }

  function jourAutonomieFC(fc) { return estASCA(fc) ? 2 : 5; }

  function estJourAutonomie(fc, d) { return d.getDay() === jourAutonomieFC(fc); }

  function nomJourAutonomie(fc) { return estASCA(fc) ? 'Mardi' : 'Vendredi'; }

  /* ---- Périodes hors centre ---------------------------------------------- */
  // Stages, vacances et jours fériés : ces journées ne sont ni des séances
  // en centre ni des journées en autonomie, elles sortent du décompte.

  var PERIODES_FC = {
    CV: {
      stages: [['2026-10-05', '2026-10-30'], ['2026-11-23', '2026-12-18']],
      vacances: [['2026-12-21', '2027-01-10']]
    },
    AD: {
      stages: [['2026-10-12', '2026-11-06']],
      vacances: [['2026-12-21', '2027-01-10']]
    },
    ACA: {
      stages: [['2026-10-12', '2026-11-06']],
      vacances: [['2026-12-21', '2027-01-10']]
    },
    ACOM: {
      stages: [['2026-10-05', '2026-10-30'], ['2027-01-18', '2027-02-12']],
      vacances: [['2026-12-21', '2027-01-08']]
    }
  };

  // Jours fériés à La Réunion sur la période de formation
  var FERIES_FC = [
    '2026-08-15', '2026-11-01', '2026-11-11', '2026-12-20', '2026-12-25',
    '2027-01-01', '2027-03-29', '2027-05-01', '2027-05-08', '2027-05-13',
    '2027-05-24', '2027-06-20', '2027-07-14'
  ];

  // Rattache un parcours à son groupe de planning.
  // Détection précise : avec seize intitulés, un simple mot-clé ne suffit plus.
  function groupeFC(fc) {
    var f = (fc && fc.formation) || '';
    if (f.indexOf('Comptabilit') >= 0 || f.indexOf('ACA') >= 0) return 'ACA';
    if (f.indexOf('Direction') >= 0) return 'AD';
    if (f.indexOf('Assistant') >= 0 && f.indexOf('Commercial') >= 0) return 'ACOM';
    if (f.indexOf('ACOM') >= 0) return 'ACOM';
    if (f.indexOf('Conseiller') >= 0 && f.indexOf('Vente') >= 0) return 'CV';
    if (f.indexOf('CV') >= 0) return 'CV';
    return 'CV';   // repli neutre : aucune période hors centre appliquée
  }

  function isoJour(d) {
    return d.getFullYear() + '-'
      + ('0' + (d.getMonth() + 1)).slice(-2) + '-'
      + ('0' + d.getDate()).slice(-2);
  }

  function horsCentreFC(fc, d) {
    var iso = isoJour(d);
    if (FERIES_FC.indexOf(iso) >= 0) return true;
    var p = PERIODES_FC[groupeFC(fc)];
    if (!p) return false;
    var listes = (p.stages || []).concat(p.vacances || []);
    for (var i = 0; i < listes.length; i++) {
      if (iso >= listes[i][0] && iso <= listes[i][1]) return true;
    }
    return false;
  }

  /* ---- Dates de parcours -------------------------------------------------- */
  // Chaque stagiaire peut avoir les siennes ; repli sur la promotion
  // de juillet 2026 quand le champ est vide.

  function bornesFC(fc) {
    function lire(s, defaut) {
      if (!s) return defaut;
      var t = String(s).trim();
      var p = t.split('/');
      if (p.length === 3) {
        var d = new Date(parseInt(p[2], 10), parseInt(p[1], 10) - 1, parseInt(p[0], 10));
        return isNaN(d) ? defaut : d;
      }
      var m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);   // tolère aussi aaaa-mm-jj
      if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
      return defaut;
    }
    return {
      debut: lire(fc && fc.debut, new Date(2026, 6, 13)),
      fin: lire(fc && fc.fin, new Date(2027, 5, 30))
    };
  }

  // Toutes les journées comptabilisables du parcours (centre + autonomie).
  function seancesDeFC(fc) {
    var out = [];
    var b = bornesFC(fc);
    var d = new Date(b.debut), fin = b.fin;
    while (d <= fin) {
      var j = d.getDay();
      if (j >= 1 && j <= 5 && !horsCentreFC(fc, d)) out.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }
    return out;
  }

  /* ---- Publication -------------------------------------------------------- */

  global.JTCF = {
    MATIN_H: MATIN_H, AM_H: AM_H,
    MATIN_FC: MATIN_FC, AM_FC: AM_FC, JOUR_FC_H: JOUR_FC_H,
    estASCA: estASCA,
    joursDeFC: joursDeFC,
    joursSelonFormation: joursSelonFormation,
    jourAutonomieFC: jourAutonomieFC,
    estJourAutonomie: estJourAutonomie,
    nomJourAutonomie: nomJourAutonomie,
    PERIODES_FC: PERIODES_FC,
    FERIES_FC: FERIES_FC,
    groupeFC: groupeFC,
    isoJour: isoJour,
    horsCentreFC: horsCentreFC,
    bornesFC: bornesFC,
    seancesDeFC: seancesDeFC
  };
})(window);
