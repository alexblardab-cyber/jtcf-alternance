/* ==========================================================================
   JTCF — Prise de rendez-vous avec l'équipe pédagogique
   --------------------------------------------------------------------------
   Deux mécanismes complémentaires :

   1. CRÉNEAUX — vous publiez vos disponibilités depuis l'admin.
      L'apprenant en choisit une, elle se réserve aussitôt. Personne ne
      peut prendre le même créneau deux fois.

   2. DEMANDES — si rien ne convient, l'apprenant décrit son besoin et
      ses disponibilités. Vous confirmez en proposant un moment.

   Deux nœuds Firebase :
      creneaux/     → les disponibilités publiées
      rdvDemandes/  → les demandes libres

   Ce fichier ne connaît pas Firebase : la page qui l'utilise lui fournit
   trois fonctions de lecture/écriture. Il sert donc aussi bien au livret
   de l'apprenant qu'au panneau de l'équipe.

   Chargé par : livret.html · livret-fc.html · livret-stage.html
                admin.html · formatrice.html
   ========================================================================== */
(function (global) {
  'use strict';

  /* ---- L'équipe ----------------------------------------------------------- */

  var CONSEILLERS = {
    AB: { nom: 'Alexandre Blard', role: 'Conseiller en Formation / Assistant de Direction', emoji: '👤', couleur: '#2C6E9B' },
    MG: { nom: 'Marine Grondin', role: 'Conseillère en Insertion Professionnelle / ARH', emoji: '👤', couleur: '#6b46c1' },
    EF: { nom: 'Emilie Fontaine', role: 'Formatrice', emoji: '👩‍🏫', couleur: '#2f855a' }
  };

  var MOTIFS = [
    'Suivi de mon parcours',
    'Difficulté personnelle',
    'Question administrative (contrat, rémunération)',
    'Relation avec mon entreprise',
    'Recherche d\'entreprise ou d\'emploi',
    'Préparation d\'un examen',
    'Justifier une absence ou un retard',
    'Autre'
  ];

  var LIEU_DEFAUT = 'Bureau JTCF — 20a rue du Général Lambert';

  /* ---- Utilitaires -------------------------------------------------------- */

  var api = null;      // { lire(chemin), ecrire(chemin, valeur) }
  var moi = null;      // { id, nom, type }

  function id(prefixe) {
    return prefixe + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function ech(t) {
    return String(t == null ? '' : t)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function isoAujourdhui() {
    var d = new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }

  var JOURS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
              'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

  function joli(iso) {
    var p = String(iso || '').split('-');
    if (p.length !== 3) return iso || '—';
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    return JOURS[d.getDay()] + ' ' + (+p[2]) + ' ' + MOIS[+p[1] - 1];
  }

  function conseiller(code) {
    return CONSEILLERS[code] || { nom: code || 'L\'équipe', role: '', emoji: '👤', couleur: '#718096' };
  }

  function objetVersListe(o) {
    if (!o) return [];
    return Object.keys(o).map(function (k) { var v = o[k] || {}; v._id = k; return v; });
  }

  function trierCreneaux(a, b) {
    return (a.date + a.heure).localeCompare(b.date + b.heure);
  }

  /* ---- Côté apprenant ----------------------------------------------------- */

  async function rendreApprenant(boite) {
    boite.innerHTML = '<div class="loading">Chargement des disponibilités...</div>';

    var creneaux = objetVersListe(await api.lire('creneaux'));
    var demandes = objetVersListe(await api.lire('rdvDemandes'));
    var auj = isoAujourdhui();

    // Mon rendez-vous en cours, s'il existe
    var monCreneau = creneaux.filter(function (c) {
      return c.pris && c.pris.id === moi.id && c.date >= auj;
    }).sort(trierCreneaux)[0];

    var maDemande = demandes.filter(function (d) {
      return d.qui === moi.id && (d.etat === 'demande' || d.etat === 'confirme');
    }).sort(function (a, b) { return (b.le || '').localeCompare(a.le || ''); })[0];

    var html = '';

    if (monCreneau) {
      html += carteMonRdv(monCreneau);
    } else if (maDemande) {
      html += carteMaDemande(maDemande);
    }

    if (!monCreneau) {
      var libres = creneaux.filter(function (c) { return !c.pris && c.date >= auj; }).sort(trierCreneaux);
      html += blocCreneaux(libres);
      if (!maDemande) html += blocDemande(libres.length);
    }

    boite.innerHTML = html;
    brancherApprenant(boite);
  }

  function carteMonRdv(c) {
    var p = conseiller(c.par);
    return '<div class="card" style="border-left:4px solid ' + p.couleur + ';">'
      + '<div class="card-title">✅ Votre rendez-vous</div>'
      + '<div style="font-size:17px;font-weight:800;color:var(--bleu-fonce);">'
      + joli(c.date) + ' à ' + ech(c.heure) + '</div>'
      + '<div style="font-size:13px;color:#4a5568;margin-top:6px;">avec <strong>' + ech(p.nom) + '</strong></div>'
      + '<div style="font-size:12px;color:#718096;margin-top:2px;">' + ech(p.role) + '</div>'
      + '<div style="font-size:12px;color:#718096;margin-top:8px;">📍 ' + ech(c.lieu || LIEU_DEFAUT) + '</div>'
      + (c.pris.motif ? '<div style="font-size:12px;color:#718096;margin-top:4px;">💬 ' + ech(c.pris.motif) + '</div>' : '')
      + '<button class="btn-annuler-rdv" data-creneau="' + c._id + '" '
      + 'style="width:100%;margin-top:14px;padding:11px;background:#fff5f5;color:#e53e3e;'
      + 'border:1px solid #fed7d7;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;">'
      + 'Annuler ce rendez-vous</button>'
      + '</div>';
  }

  function carteMaDemande(d) {
    var confirme = d.etat === 'confirme';
    var coul = confirme ? '#38a169' : '#dd6b20';
    return '<div class="card" style="border-left:4px solid ' + coul + ';">'
      + '<div class="card-title">' + (confirme ? '✅ Rendez-vous confirmé' : '⏳ Demande envoyée') + '</div>'
      + (confirme
          ? '<div style="font-size:17px;font-weight:800;color:var(--bleu-fonce);">' + ech(d.quand || '—') + '</div>'
          : '<div style="font-size:13px;color:#4a5568;line-height:1.6;">Votre demande a bien été transmise. '
            + 'L\'équipe vous répondra rapidement, ici même et par téléphone si nécessaire.</div>')
      + '<div style="font-size:12px;color:#718096;margin-top:8px;">Avec : '
      + ech(d.avec === '?' ? 'peu importe' : conseiller(d.avec).nom) + '</div>'
      + '<div style="font-size:12px;color:#718096;margin-top:2px;">Motif : ' + ech(d.motif) + '</div>'
      + (d.reponse ? '<div style="margin-top:10px;padding:10px 12px;background:var(--or-pale);'
          + 'border-left:3px solid var(--or);border-radius:0 8px 8px 0;font-size:12.5px;color:#744210;">'
          + ech(d.reponse) + '</div>' : '')
      + '<button class="btn-annuler-demande" data-demande="' + d._id + '" '
      + 'style="width:100%;margin-top:14px;padding:11px;background:#fff5f5;color:#e53e3e;'
      + 'border:1px solid #fed7d7;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;">'
      + 'Annuler ma demande</button>'
      + '</div>';
  }

  function blocCreneaux(libres) {
    var h = '<div class="card"><div class="card-title">📅 Créneaux disponibles</div>';

    if (!libres.length) {
      return h + '<div style="font-size:13px;color:#718096;line-height:1.6;padding:6px 0;">'
        + 'Aucun créneau n\'est ouvert pour le moment. Faites une demande ci-dessous, '
        + 'l\'équipe vous proposera un moment.</div></div>';
    }

    var parDate = {};
    libres.forEach(function (c) { (parDate[c.date] = parDate[c.date] || []).push(c); });

    Object.keys(parDate).sort().forEach(function (date) {
      h += '<div style="font-size:11px;font-weight:800;color:var(--bleu);text-transform:uppercase;'
        + 'letter-spacing:1px;margin:14px 0 8px;">' + joli(date) + '</div>';
      parDate[date].forEach(function (c) {
        var p = conseiller(c.par);
        h += '<button class="btn-creneau" data-creneau="' + c._id + '" '
          + 'style="width:100%;display:flex;align-items:center;gap:11px;padding:11px 12px;margin-bottom:7px;'
          + 'background:#fff;border:2px solid #edf2f7;border-left:4px solid ' + p.couleur + ';'
          + 'border-radius:11px;cursor:pointer;text-align:left;font-family:inherit;">'
          + '<div style="font-size:15px;font-weight:800;color:var(--bleu-fonce);min-width:46px;">' + ech(c.heure) + '</div>'
          + '<div style="flex:1;min-width:0;">'
          + '<div style="font-size:13px;font-weight:700;color:#2d3748;">' + ech(p.nom) + '</div>'
          + '<div style="font-size:11px;color:#718096;">' + ech(p.role) + '</div>'
          + '</div>'
          + '<div style="font-size:11px;color:#a0aec0;white-space:nowrap;">' + (c.duree || 30) + ' min</div>'
          + '</button>';
      });
    });

    return h + '</div>';
  }

  function blocDemande(nbLibres) {
    var options = '<option value="?">Peu importe</option>';
    Object.keys(CONSEILLERS).forEach(function (k) {
      options += '<option value="' + k + '">' + ech(CONSEILLERS[k].nom) + '</option>';
    });
    var motifs = '<option value="">— Choisir —</option>';
    MOTIFS.forEach(function (m) { motifs += '<option value="' + ech(m) + '">' + ech(m) + '</option>'; });

    return '<div class="card">'
      + '<div class="card-title">✍️ ' + (nbLibres ? 'Aucun créneau ne vous convient ?' : 'Demander un rendez-vous') + '</div>'
      + '<div style="font-size:12.5px;color:#718096;line-height:1.6;margin-bottom:12px;">'
      + 'Décrivez votre besoin et vos disponibilités. Nous revenons vers vous rapidement.</div>'

      + '<div class="form-field"><label class="form-label">Avec qui ?</label>'
      + '<select class="form-select" id="rdvAvec">' + options + '</select></div>'

      + '<div class="form-field"><label class="form-label">Motif</label>'
      + '<select class="form-select" id="rdvMotif">' + motifs + '</select></div>'

      + '<div class="form-field"><label class="form-label">Vos disponibilités</label>'
      + '<input class="form-input" id="rdvDispo" placeholder="Ex : plutôt le matin, ou mardi après-midi" '
      + 'style="text-transform:none;" /></div>'

      + '<div class="form-field"><label class="form-label">Précisions (facultatif)</label>'
      + '<textarea class="form-input" id="rdvMessage" rows="3" placeholder="Ce que vous souhaitez aborder" '
      + 'style="text-transform:none;resize:vertical;font-family:inherit;"></textarea></div>'

      + '<button id="rdvEnvoyer" class="btn-primary" style="width:100%;padding:13px;border:none;'
      + 'border-radius:12px;font-size:14px;font-weight:800;cursor:pointer;'
      + 'background:linear-gradient(135deg,var(--bleu-fonce),var(--bleu));color:#fff;">'
      + 'Envoyer ma demande</button>'

      + '<div style="font-size:11px;color:#a0aec0;line-height:1.6;margin-top:10px;text-align:center;">'
      + 'En cas d\'urgence, appelez directement l\'équipe depuis l\'onglet Contacts.</div>'
      + '</div>';
  }

  function brancherApprenant(boite) {
    boite.querySelectorAll('.btn-creneau').forEach(function (b) {
      b.addEventListener('click', function () { reserver(b.getAttribute('data-creneau'), boite); });
    });
    var a1 = boite.querySelector('.btn-annuler-rdv');
    if (a1) a1.addEventListener('click', function () { annulerCreneau(a1.getAttribute('data-creneau'), boite); });
    var a2 = boite.querySelector('.btn-annuler-demande');
    if (a2) a2.addEventListener('click', function () { annulerDemande(a2.getAttribute('data-demande'), boite); });
    var env = boite.querySelector('#rdvEnvoyer');
    if (env) env.addEventListener('click', function () { envoyerDemande(boite, env); });
  }

  async function reserver(cid, boite) {
    var c = await api.lire('creneaux/' + cid);
    if (!c) { alert('Ce créneau n\'existe plus.'); return rendreApprenant(boite); }
    if (c.pris) { alert('Ce créneau vient d\'être réservé par quelqu\'un d\'autre.'); return rendreApprenant(boite); }

    var p = conseiller(c.par);
    var motif = prompt('Rendez-vous avec ' + p.nom + '\n'
      + joli(c.date) + ' à ' + c.heure + '\n\n'
      + 'En quelques mots, le motif de votre demande :', '');
    if (motif === null) return;

    await api.ecrire('creneaux/' + cid + '/pris', {
      id: moi.id, nom: moi.nom, type: moi.type,
      motif: (motif || '').trim(), le: new Date().toISOString()
    });
    alert('✅ Rendez-vous confirmé\n\n' + joli(c.date) + ' à ' + c.heure + '\navec ' + p.nom);
    rendreApprenant(boite);
  }

  async function annulerCreneau(cid, boite) {
    if (!confirm('Annuler ce rendez-vous ?\n\nLe créneau redeviendra disponible pour quelqu\'un d\'autre.')) return;
    await api.ecrire('creneaux/' + cid + '/pris', null);
    rendreApprenant(boite);
  }

  async function annulerDemande(did, boite) {
    if (!confirm('Annuler votre demande de rendez-vous ?')) return;
    await api.ecrire('rdvDemandes/' + did + '/etat', 'annule');
    rendreApprenant(boite);
  }

  async function envoyerDemande(boite, bouton) {
    var avec = boite.querySelector('#rdvAvec').value;
    var motif = boite.querySelector('#rdvMotif').value;
    var dispo = boite.querySelector('#rdvDispo').value.trim();
    var message = boite.querySelector('#rdvMessage').value.trim();

    if (!motif) { alert('Merci d\'indiquer le motif de votre demande.'); return; }

    bouton.disabled = true;
    bouton.textContent = '⏳ Envoi...';
    try {
      var did = id('d');
      await api.ecrire('rdvDemandes/' + did, {
        qui: moi.id, nom: moi.nom, type: moi.type,
        avec: avec, motif: motif, dispo: dispo, message: message,
        etat: 'demande', reponse: '', quand: '',
        le: new Date().toISOString(), notifie: false
      });
      alert('✅ Demande envoyée\n\nL\'équipe vous répondra rapidement.');
      rendreApprenant(boite);
    } catch (e) {
      bouton.disabled = false;
      bouton.textContent = 'Envoyer ma demande';
      alert('Envoi impossible : ' + e.message);
    }
  }

  /* ---- Vue calendrier -----------------------------------------------------
     Un mois d'un coup d'œil : les jours qui portent des rendez-vous se
     repèrent immédiatement. Un clic sur un jour déplie son détail.
     ------------------------------------------------------------------------ */

  var calAnnee = new Date().getFullYear();
  var calMois = new Date().getMonth();
  var calJour = null;
  var vueEquipe = 'liste';

  function calendrierHTML(creneaux) {
    var premier = new Date(calAnnee, calMois, 1);
    var nbJours = new Date(calAnnee, calMois + 1, 0).getDate();
    var decalage = (premier.getDay() + 6) % 7;      // semaine commençant le lundi
    var auj = isoAujourdhui();

    // Regroupement par date
    var parJour = {};
    creneaux.forEach(function (c) { (parJour[c.date] = parJour[c.date] || []).push(c); });

    var h = '<div class="card"><div class="card-title">🗓️ ' + MOIS[calMois] + ' ' + calAnnee
      + '<span style="float:right;">'
      + '<button id="calPrec" style="background:none;border:none;font-size:17px;color:var(--bleu);cursor:pointer;padding:0 6px;">‹</button>'
      + '<button id="calAuj" style="background:none;border:none;font-size:11px;font-weight:700;color:var(--bleu);cursor:pointer;padding:0 6px;">aujourd\'hui</button>'
      + '<button id="calSuiv" style="background:none;border:none;font-size:17px;color:var(--bleu);cursor:pointer;padding:0 6px;">›</button>'
      + '</span></div>';

    h += '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;margin-bottom:4px;">';
    ['L', 'M', 'M', 'J', 'V', 'S', 'D'].forEach(function (j) {
      h += '<div style="text-align:center;font-size:10px;font-weight:800;color:#a0aec0;padding:3px 0;">' + j + '</div>';
    });
    h += '</div><div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;">';

    for (var i = 0; i < decalage; i++) h += '<div></div>';

    for (var d = 1; d <= nbJours; d++) {
      var iso = calAnnee + '-' + ('0' + (calMois + 1)).slice(-2) + '-' + ('0' + d).slice(-2);
      var liste = parJour[iso] || [];
      var pris = liste.filter(function (c) { return c.pris; }).length;
      var libres = liste.length - pris;
      var estAuj = iso === auj;
      var actif = iso === calJour;
      var weekend = [0, 6].indexOf(new Date(calAnnee, calMois, d).getDay()) >= 0;

      var fond = actif ? 'var(--bleu-fonce)' : (estAuj ? 'var(--or-pale)' : (weekend ? '#fafbfc' : '#fff'));
      var texte = actif ? '#fff' : (weekend ? '#cbd5e0' : '#2d3748');
      var bord = actif ? 'var(--bleu-fonce)' : (estAuj ? 'var(--or)' : '#edf2f7');

      h += '<button class="cal-jour" data-iso="' + iso + '" '
        + 'style="aspect-ratio:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;'
        + 'background:' + fond + ';border:1.5px solid ' + bord + ';border-radius:9px;cursor:pointer;'
        + 'font-family:inherit;padding:0;">'
        + '<div style="font-size:12.5px;font-weight:' + (estAuj || actif ? '800' : '600') + ';color:' + texte + ';">' + d + '</div>'
        + '<div style="display:flex;gap:2px;height:5px;align-items:center;">'
        + (pris ? '<span style="width:5px;height:5px;border-radius:50%;background:' + (actif ? '#9AE6B4' : '#38a169') + ';"></span>' : '')
        + (libres ? '<span style="width:5px;height:5px;border-radius:50%;background:' + (actif ? '#FAF089' : 'var(--or)') + ';"></span>' : '')
        + '</div></button>';
    }

    h += '</div>';
    h += '<div style="display:flex;gap:14px;justify-content:center;margin-top:10px;font-size:10.5px;color:#718096;">'
      + '<span><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#38a169;margin-right:4px;"></span>Réservé</span>'
      + '<span><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--or);margin-right:4px;"></span>Libre</span>'
      + '</div>';

    // Détail du jour sélectionné
    if (calJour) {
      var duJour = (parJour[calJour] || []).sort(trierCreneaux);
      h += '<div style="margin-top:14px;padding-top:12px;border-top:1px solid #edf2f7;">'
        + '<div style="font-size:12px;font-weight:800;color:var(--bleu-fonce);margin-bottom:8px;">' + joli(calJour) + '</div>';
      if (!duJour.length) {
        h += '<div style="font-size:12.5px;color:#718096;">Aucun créneau ce jour-là.</div>';
      } else {
        duJour.forEach(function (c) {
          var p = conseiller(c.par);
          h += '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #f7fafc;">'
            + '<div style="font-size:13px;font-weight:800;color:' + p.couleur + ';min-width:46px;">' + ech(c.heure) + '</div>'
            + '<div style="flex:1;min-width:0;">'
            + (c.pris
                ? '<div style="font-size:12.5px;font-weight:700;color:var(--bleu-fonce);">' + ech(c.pris.nom) + '</div>'
                  + '<div style="font-size:11px;color:#718096;">' + ech(p.nom) + (c.pris.motif ? ' · ' + ech(c.pris.motif) : '') + '</div>'
                : '<div style="font-size:12.5px;color:#a0aec0;font-style:italic;">Libre — ' + ech(p.nom) + '</div>')
            + '</div></div>';
        });
      }
      h += '</div>';
    }

    return h + '</div>';
  }

  function brancherCalendrier(boite, role) {
    function recharger() { rendreEquipe(boite, role); }
    var p = boite.querySelector('#calPrec'), s = boite.querySelector('#calSuiv'), a = boite.querySelector('#calAuj');
    if (p) p.addEventListener('click', function () {
      calMois--; if (calMois < 0) { calMois = 11; calAnnee--; } calJour = null; recharger();
    });
    if (s) s.addEventListener('click', function () {
      calMois++; if (calMois > 11) { calMois = 0; calAnnee++; } calJour = null; recharger();
    });
    if (a) a.addEventListener('click', function () {
      var n = new Date(); calAnnee = n.getFullYear(); calMois = n.getMonth(); calJour = isoAujourdhui(); recharger();
    });
    boite.querySelectorAll('.cal-jour').forEach(function (b) {
      b.addEventListener('click', function () {
        var iso = b.getAttribute('data-iso');
        calJour = (calJour === iso) ? null : iso;
        recharger();
      });
    });
  }

  /* ---- Côté équipe -------------------------------------------------------- */

  async function rendreEquipe(boite, role) {
    boite.innerHTML = '<div class="loading">Chargement...</div>';

    var creneaux = objetVersListe(await api.lire('creneaux'));
    var demandes = objetVersListe(await api.lire('rdvDemandes'));
    var auj = isoAujourdhui();

    var mien = function (c) { return role === 'admin' || c.par === role || c.avec === role || c.avec === '?'; };

    var enAttente = demandes.filter(function (d) { return d.etat === 'demande' && mien(d); })
      .sort(function (a, b) { return (a.le || '').localeCompare(b.le || ''); });

    var prochains = creneaux.filter(function (c) { return c.pris && c.date >= auj && mien(c); }).sort(trierCreneaux);
    var libres = creneaux.filter(function (c) { return !c.pris && c.date >= auj && mien(c); }).sort(trierCreneaux);

    var h = '';

    // Bascule entre les deux lectures : la liste pour agir, le calendrier pour voir venir.
    h += '<div style="display:flex;gap:7px;margin-bottom:14px;">'
      + '<button id="vueListe" style="flex:1;padding:10px;border-radius:10px;font-size:13px;font-weight:700;'
      + 'cursor:pointer;font-family:inherit;border:2px solid '
      + (vueEquipe === 'liste' ? 'var(--bleu-fonce);background:var(--bleu-fonce);color:#fff;' : '#e2e8f0;background:#fff;color:#718096;')
      + '">📋 Liste</button>'
      + '<button id="vueCal" style="flex:1;padding:10px;border-radius:10px;font-size:13px;font-weight:700;'
      + 'cursor:pointer;font-family:inherit;border:2px solid '
      + (vueEquipe === 'calendrier' ? 'var(--bleu-fonce);background:var(--bleu-fonce);color:#fff;' : '#e2e8f0;background:#fff;color:#718096;')
      + '">🗓️ Calendrier</button></div>';

    if (vueEquipe === 'calendrier') {
      h += calendrierHTML(creneaux.filter(mien));
    }

    // Demandes à traiter
    h += '<div class="card"><div class="card-title">📨 Demandes à traiter'
      + '<span style="float:right;font-size:10.5px;font-weight:800;padding:3px 10px;border-radius:20px;'
      + (enAttente.length ? 'background:#fffaf0;color:#dd6b20;' : 'background:#f0fff4;color:#38a169;')
      + '">' + (enAttente.length || 'aucune') + '</span></div>';
    if (!enAttente.length) {
      h += '<div style="font-size:13px;color:#38a169;font-weight:600;padding:6px 0;">✓ Rien en attente.</div>';
    } else {
      enAttente.forEach(function (d) {
        h += '<div style="padding:12px;margin-bottom:9px;background:#fffaf0;border-left:3px solid #dd6b20;border-radius:8px;">'
          + '<div style="font-size:13px;font-weight:800;color:var(--bleu-fonce);">' + ech(d.nom)
          + ' <span style="font-size:10px;color:#718096;font-weight:600;">' + ech(d.qui) + '</span></div>'
          + '<div style="font-size:12px;color:#4a5568;margin-top:3px;">' + ech(d.motif) + '</div>'
          + (d.dispo ? '<div style="font-size:11.5px;color:#718096;margin-top:3px;">🕐 ' + ech(d.dispo) + '</div>' : '')
          + (d.message ? '<div style="font-size:11.5px;color:#718096;margin-top:3px;">💬 ' + ech(d.message) + '</div>' : '')
          + '<div style="font-size:11px;color:#a0aec0;margin-top:3px;">Souhaite voir : '
          + ech(d.avec === '?' ? 'peu importe' : conseiller(d.avec).nom) + '</div>'
          + '<div style="display:flex;gap:7px;margin-top:9px;">'
          + '<button class="rdv-confirmer" data-d="' + d._id + '" style="flex:1;padding:9px;background:#38a169;'
          + 'color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;">Confirmer</button>'
          + '<button class="rdv-refuser" data-d="' + d._id + '" style="flex:1;padding:9px;background:#edf2f7;'
          + 'color:#4a5568;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;">Répondre autrement</button>'
          + '</div></div>';
      });
    }
    h += '</div>';

    // Rendez-vous pris
    if (vueEquipe === 'liste') {
    h += '<div class="card"><div class="card-title">📅 Prochains rendez-vous</div>';
    if (!prochains.length) {
      h += '<div style="font-size:13px;color:#718096;padding:6px 0;">Aucun rendez-vous à venir.</div>';
    } else {
      prochains.forEach(function (c) {
        var p = conseiller(c.par);
        h += '<div style="display:flex;gap:11px;padding:10px 0;border-bottom:1px solid #f0f2f5;">'
          + '<div style="min-width:52px;"><div style="font-size:14px;font-weight:800;color:' + p.couleur + ';">'
          + ech(c.heure) + '</div><div style="font-size:10px;color:#a0aec0;">' + ech(c.date.slice(8) + '/' + c.date.slice(5, 7)) + '</div></div>'
          + '<div style="flex:1;min-width:0;">'
          + '<div style="font-size:13px;font-weight:700;color:var(--bleu-fonce);">' + ech(c.pris.nom) + '</div>'
          + '<div style="font-size:11px;color:#718096;">' + ech(p.nom) + (c.pris.motif ? ' · ' + ech(c.pris.motif) : '') + '</div>'
          + '</div>'
          + '<button class="rdv-liberer" data-c="' + c._id + '" title="Annuler ce rendez-vous" '
          + 'style="background:none;border:none;color:#e53e3e;font-size:15px;cursor:pointer;">✕</button>'
          + '</div>';
      });
    }
    h += '</div>';
    }

    // Publication de créneaux
    var opts = '';
    Object.keys(CONSEILLERS).forEach(function (k) {
      if (role !== 'admin' && k !== role) return;
      opts += '<option value="' + k + '">' + ech(CONSEILLERS[k].nom) + '</option>';
    });

    h += '<div class="card"><div class="card-title">➕ Ouvrir des créneaux</div>'
      + '<div style="font-size:12px;color:#718096;line-height:1.6;margin-bottom:12px;">'
      + 'Indiquez une plage horaire : l\'application la découpe en rendez-vous de la durée choisie.</div>'
      + '<div class="form-field"><label class="form-label">Pour</label>'
      + '<select class="form-select" id="crPar">' + opts + '</select></div>'
      + '<div class="form-field"><label class="form-label">Date</label>'
      + '<input class="form-input" type="date" id="crDate" style="text-transform:none;" /></div>'
      + '<div style="display:flex;gap:10px;">'
      + '<div class="form-field" style="flex:1;"><label class="form-label">De</label>'
      + '<input class="form-input" type="time" id="crDebut" value="14:00" style="text-transform:none;" /></div>'
      + '<div class="form-field" style="flex:1;"><label class="form-label">À</label>'
      + '<input class="form-input" type="time" id="crFin" value="16:00" style="text-transform:none;" /></div>'
      + '<div class="form-field" style="flex:1;"><label class="form-label">Durée</label>'
      + '<select class="form-select" id="crDuree"><option value="15">15 min</option>'
      + '<option value="30" selected>30 min</option><option value="45">45 min</option>'
      + '<option value="60">1 heure</option></select></div>'
      + '</div>'
      + '<div class="form-field"><label class="form-label">Lieu</label>'
      + '<input class="form-input" id="crLieu" value="' + ech(LIEU_DEFAUT) + '" style="text-transform:none;" /></div>'
      + '<button id="crPublier" class="btn-primary" style="width:100%;padding:12px;border:none;border-radius:11px;'
      + 'font-size:14px;font-weight:800;cursor:pointer;background:linear-gradient(135deg,var(--bleu-fonce),var(--bleu));color:#fff;">'
      + 'Publier ces créneaux</button></div>';

    // Créneaux libres publiés
    if (vueEquipe === 'liste') {
    h += '<div class="card"><div class="card-title">🕐 Créneaux ouverts non réservés</div>';
    if (!libres.length) {
      h += '<div style="font-size:13px;color:#718096;padding:6px 0;">Aucun créneau ouvert.</div>';
    } else {
      var parDate = {};
      libres.forEach(function (c) { (parDate[c.date] = parDate[c.date] || []).push(c); });
      Object.keys(parDate).sort().forEach(function (date) {
        h += '<div style="font-size:11px;font-weight:800;color:var(--bleu);text-transform:uppercase;'
          + 'letter-spacing:1px;margin:12px 0 6px;">' + joli(date) + '</div>'
          + '<div style="display:flex;flex-wrap:wrap;gap:6px;">';
        parDate[date].forEach(function (c) {
          var p = conseiller(c.par);
          h += '<span style="display:inline-flex;align-items:center;gap:6px;padding:5px 10px;'
            + 'background:#f7fafc;border:1px solid #e2e8f0;border-left:3px solid ' + p.couleur + ';'
            + 'border-radius:8px;font-size:12px;font-weight:700;color:#2d3748;">' + ech(c.heure)
            + '<button class="rdv-supprimer" data-c="' + c._id + '" title="Retirer" '
            + 'style="background:none;border:none;color:#a0aec0;cursor:pointer;font-size:13px;padding:0;">✕</button>'
            + '</span>';
        });
        h += '</div>';
      });
    }
    h += '</div>';
    }

    boite.innerHTML = h;
    brancherEquipe(boite, role);
    brancherCalendrier(boite, role);
  }

  function brancherEquipe(boite, role) {
    function recharger() { rendreEquipe(boite, role); }

    var bl = boite.querySelector('#vueListe'), bc = boite.querySelector('#vueCal');
    if (bl) bl.addEventListener('click', function () { vueEquipe = 'liste'; recharger(); });
    if (bc) bc.addEventListener('click', function () { vueEquipe = 'calendrier'; recharger(); });

    boite.querySelectorAll('.rdv-confirmer').forEach(function (b) {
      b.addEventListener('click', async function () {
        var quand = prompt('Quand recevez-vous cette personne ?\n\n'
          + 'Écrivez-le simplement, elle le verra dans son livret.\n'
          + 'Exemple : Mardi 22 septembre à 14h00', '');
        if (quand === null || !quand.trim()) return;
        var did = b.getAttribute('data-d');
        await api.ecrire('rdvDemandes/' + did + '/etat', 'confirme');
        await api.ecrire('rdvDemandes/' + did + '/quand', quand.trim());
        await api.ecrire('rdvDemandes/' + did + '/reponse',
          'Rendez-vous confirmé : ' + quand.trim() + '. À ' + LIEU_DEFAUT + '.');
        recharger();
      });
    });

    boite.querySelectorAll('.rdv-refuser').forEach(function (b) {
      b.addEventListener('click', async function () {
        var msg = prompt('Votre réponse à cette personne :\n\n'
          + 'Exemple : Je ne suis pas disponible cette semaine, je vous appelle lundi.', '');
        if (msg === null || !msg.trim()) return;
        var did = b.getAttribute('data-d');
        await api.ecrire('rdvDemandes/' + did + '/etat', 'refuse');
        await api.ecrire('rdvDemandes/' + did + '/reponse', msg.trim());
        recharger();
      });
    });

    boite.querySelectorAll('.rdv-liberer').forEach(function (b) {
      b.addEventListener('click', async function () {
        if (!confirm('Annuler ce rendez-vous ?\n\nLe créneau redeviendra disponible.')) return;
        await api.ecrire('creneaux/' + b.getAttribute('data-c') + '/pris', null);
        recharger();
      });
    });

    boite.querySelectorAll('.rdv-supprimer').forEach(function (b) {
      b.addEventListener('click', async function () {
        await api.ecrire('creneaux/' + b.getAttribute('data-c'), null);
        recharger();
      });
    });

    var pub = boite.querySelector('#crPublier');
    if (pub) pub.addEventListener('click', async function () {
      var par = boite.querySelector('#crPar').value;
      var date = boite.querySelector('#crDate').value;
      var deb = boite.querySelector('#crDebut').value;
      var fin = boite.querySelector('#crFin').value;
      var duree = parseInt(boite.querySelector('#crDuree').value, 10);
      var lieu = boite.querySelector('#crLieu').value.trim();

      if (!date) { alert('Choisissez une date.'); return; }
      if (!deb || !fin) { alert('Indiquez la plage horaire.'); return; }

      var m1 = (+deb.slice(0, 2)) * 60 + (+deb.slice(3, 5));
      var m2 = (+fin.slice(0, 2)) * 60 + (+fin.slice(3, 5));
      if (m2 <= m1) { alert('L\'heure de fin doit suivre l\'heure de début.'); return; }

      var nb = Math.floor((m2 - m1) / duree);
      if (!nb) { alert('La plage est trop courte pour un créneau de ' + duree + ' minutes.'); return; }
      if (!confirm('Publier ' + nb + ' créneau(x) de ' + duree + ' minutes\nle ' + joli(date) + ' ?')) return;

      pub.disabled = true; pub.textContent = '⏳ Publication...';
      try {
        for (var i = 0; i < nb; i++) {
          var t = m1 + i * duree;
          var heure = ('0' + Math.floor(t / 60)).slice(-2) + ':' + ('0' + (t % 60)).slice(-2);
          await api.ecrire('creneaux/' + id('c'), {
            par: par, date: date, heure: heure, duree: duree,
            lieu: lieu || LIEU_DEFAUT, pris: null, le: new Date().toISOString()
          });
        }
        recharger();
      } catch (e) {
        alert('Publication impossible : ' + e.message);
      } finally {
        pub.disabled = false; pub.textContent = 'Publier ces créneaux';
      }
    });
  }

  /* ---- Compteur pour la pastille de l'onglet ------------------------------ */

  async function nombreEnAttente(role) {
    var demandes = objetVersListe(await api.lire('rdvDemandes'));
    return demandes.filter(function (d) {
      if (d.etat !== 'demande') return false;
      return role === 'admin' || d.avec === role || d.avec === '?';
    }).length;
  }

  /* ---- Publication -------------------------------------------------------- */

  global.JTCF_RDV = {
    CONSEILLERS: CONSEILLERS,
    MOTIFS: MOTIFS,
    // adaptateur : { lire(chemin) -> valeur, ecrire(chemin, valeur) }
    connecter: function (adaptateur) { api = adaptateur; },
    apprenant: function (profil, boite) {
      moi = profil;
      return rendreApprenant(boite);
    },
    equipe: function (boite, role) { return rendreEquipe(boite, role || 'admin'); },
    enAttente: nombreEnAttente
  };
})(window);
