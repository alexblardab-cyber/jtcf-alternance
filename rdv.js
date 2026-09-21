/* ==========================================================================
   JTCF — Prise de rendez-vous avec l'équipe pédagogique
   --------------------------------------------------------------------------
   Deux mécanismes complémentaires :

   1. CRÉNEAUX — chacun publie ses disponibilités. L'apprenant en choisit
      une, elle se réserve aussitôt. Personne ne prend le même créneau deux fois.

   2. DEMANDES — si rien ne convient, l'apprenant décrit son besoin et ses
      disponibilités. L'équipe confirme en proposant un moment.

   3. CONVOCATIONS — le sens inverse : l'équipe propose une date à un
      apprenant précis. Il accepte, ou il indique qu'il ne peut pas venir
      en expliquant pourquoi. Rien n'est imposé sans son accord.

   Un rendez-vous peut réunir PLUSIEURS personnes : un entretien à deux, ou
   toute l'équipe pédagogique. Le champ « par » reste une simple chaîne —
   « EF » ou « AB,MG,EF » — ce qui garde lisibles les créneaux déjà créés.

   Le calendrier est PARTAGÉ : chacun bascule entre son propre planning et
   celui de toute l'équipe.

   Trois nœuds Firebase :
      creneaux/     → les disponibilités publiées
      rdvDemandes/  → les demandes venant des apprenants
      convocations/ → les propositions venant de l'équipe

   Ce fichier ne connaît pas Firebase : la page qui l'utilise lui prête deux
   fonctions de lecture/écriture. Il sert donc aussi bien au livret de
   l'apprenant qu'au panneau de l'équipe.

   Chargé par : livret.html · livret-fc.html · livret-stage.html
                admin.html · formatrice.html · cip.html
   ========================================================================== */
(function (global) {
  'use strict';

  /* ---- L'équipe ----------------------------------------------------------- */

  var CONSEILLERS = {
    AB: { nom: 'Alexandre Blard', role: 'Conseiller en Formation / Assistant de Direction', couleur: '#2C6E9B' },
    MG: { nom: 'Marine Grondin', role: 'Conseillère en Insertion Professionnelle / ARH', couleur: '#6b46c1' },
    EF: { nom: 'Emilie Fontaine', role: 'Formatrice', couleur: '#2f855a' }
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
  var annuaire = [];   // [{ id, nom, type }] — les personnes que l'on peut convoquer

  // rdv.js va chercher la liste lui-même : aucune page n'a à la lui fournir.
  async function chargerAnnuaire() {
    if (annuaire.length) return annuaire;
    var lots = await Promise.all([
      api.lire('alternants'), api.lire('stagiairesFC'), api.lire('stagiaires')
    ]);
    var types = ['alt', 'fc', 'stg'];
    annuaire = [];
    lots.forEach(function (o, i) {
      Object.keys(o || {}).forEach(function (k) {
        annuaire.push({ id: k, nom: (o[k] && o[k].nom) || k, type: types[i] });
      });
    });
    return annuaire;
  }

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
    return CONSEILLERS[code] || { nom: code || 'L\'équipe', role: '', couleur: '#718096' };
  }

  /* ---- Plusieurs participants --------------------------------------------- */

  function codes(par) {
    return String(par || '').split(',').map(function (c) { return c.trim(); }).filter(Boolean);
  }

  function estEquipe(par) {
    return codes(par).length >= Object.keys(CONSEILLERS).length;
  }

  function libelleParticipants(par) {
    var l = codes(par);
    if (!l.length) return 'L\'équipe';
    if (l.length === 1) return conseiller(l[0]).nom;
    if (estEquipe(par)) return 'Toute l\'équipe pédagogique';
    return l.map(function (c) { return conseiller(c).nom.split(' ')[0]; }).join(' et ');
  }

  function detailParticipants(par) {
    var l = codes(par);
    if (l.length <= 1) return conseiller(l[0] || '').role;
    return l.map(function (c) { return conseiller(c).nom; }).join(' · ');
  }

  function couleurDe(par) {
    var l = codes(par);
    return l.length === 1 ? conseiller(l[0]).couleur : '#4A5568';
  }

  function participe(par, role) {
    return role === 'admin' || codes(par).indexOf(role) >= 0;
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
    var convocs  = objetVersListe(await api.lire('convocations'));
    var auj = isoAujourdhui();

    // Une convocation en attente de réponse passe avant tout le reste.
    var maConvoc = convocs.filter(function (c) {
      return c.pour === moi.id && c.etat === 'propose' && c.date >= auj;
    }).sort(trierCreneaux)[0];

    var convocAcceptee = convocs.filter(function (c) {
      return c.pour === moi.id && c.etat === 'accepte' && c.date >= auj;
    }).sort(trierCreneaux)[0];

    var monCreneau = creneaux.filter(function (c) {
      return c.pris && c.pris.id === moi.id && c.date >= auj;
    }).sort(trierCreneaux)[0];

    var maDemande = demandes.filter(function (d) {
      return d.qui === moi.id && (d.etat === 'demande' || d.etat === 'confirme');
    }).sort(function (a, b) { return (b.le || '').localeCompare(a.le || ''); })[0];

    var html = '';
    if (maConvoc) html += carteConvocation(maConvoc);
    if (convocAcceptee) html += carteConvocAcceptee(convocAcceptee);

    if (monCreneau) html += carteMonRdv(monCreneau);
    else if (maDemande) html += carteMaDemande(maDemande);
    else if (!maConvoc && !convocAcceptee) html += blocExplication();

    if (!monCreneau && !maConvoc) {
      var libres = creneaux.filter(function (c) { return !c.pris && c.date >= auj; }).sort(trierCreneaux);
      html += blocCreneaux(libres);
      if (!maDemande) html += blocDemande(libres.length);
    }

    boite.innerHTML = html;
    brancherApprenant(boite);
  }

  // L'équipe propose une date : l'apprenant répond. Rien n'est imposé.
  function carteConvocation(c) {
    return '<div class="card" style="border-left:4px solid #dd6b20;">'
      + '<div class="card-title">📣 Proposition de rendez-vous</div>'
      + '<div style="font-size:12.5px;color:#4a5568;line-height:1.6;margin-bottom:10px;">'
      + ech(libelleParticipants(c.par)) + ' souhaite vous rencontrer. '
      + 'Dites-nous si cette date vous convient.</div>'
      + '<div style="font-size:17px;font-weight:800;color:var(--bleu-fonce);">'
      + joli(c.date) + ' à ' + ech(c.heure) + '</div>'
      + '<div style="font-size:12px;color:#718096;margin-top:6px;">📍 ' + ech(c.lieu || LIEU_DEFAUT) + '</div>'
      + '<div style="font-size:12px;color:#718096;margin-top:4px;">💬 ' + ech(c.motif || 'Point sur votre parcours') + '</div>'
      + (c.message ? '<div style="margin-top:10px;padding:10px 12px;background:var(--or-pale);'
          + 'border-left:3px solid var(--or);border-radius:0 8px 8px 0;font-size:12.5px;color:#744210;'
          + 'line-height:1.6;">' + ech(c.message) + '</div>' : '')
      + '<button class="btn-convoc-oui" data-c="' + c._id + '" '
      + 'style="width:100%;margin-top:14px;padding:13px;background:#38a169;color:#fff;border:none;'
      + 'border-radius:11px;font-size:14px;font-weight:800;cursor:pointer;font-family:inherit;">'
      + '✅ Je serai présent(e)</button>'
      + '<button class="btn-convoc-non" data-c="' + c._id + '" '
      + 'style="width:100%;margin-top:8px;padding:11px;background:#fff;color:#4a5568;'
      + 'border:2px solid #e2e8f0;border-radius:11px;font-size:13px;font-weight:700;cursor:pointer;'
      + 'font-family:inherit;">Je ne peux pas ce jour-là</button>'
      + '</div>';
  }

  function carteConvocAcceptee(c) {
    return '<div class="card" style="border-left:4px solid #38a169;">'
      + '<div class="card-title">✅ Votre rendez-vous</div>'
      + '<div style="font-size:17px;font-weight:800;color:var(--bleu-fonce);">'
      + joli(c.date) + ' à ' + ech(c.heure) + '</div>'
      + '<div style="font-size:13px;color:#4a5568;margin-top:6px;">avec <strong>'
      + ech(libelleParticipants(c.par)) + '</strong></div>'
      + '<div style="font-size:12px;color:#718096;margin-top:8px;">📍 ' + ech(c.lieu || LIEU_DEFAUT) + '</div>'
      + '<div style="font-size:12px;color:#718096;margin-top:4px;">💬 ' + ech(c.motif || '—') + '</div>'
      + '<button class="btn-convoc-annuler" data-c="' + c._id + '" '
      + 'style="width:100%;margin-top:14px;padding:11px;background:#fff5f5;color:#e53e3e;'
      + 'border:1px solid #fed7d7;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;'
      + 'font-family:inherit;">Prévenir que je ne pourrai pas venir</button>'
      + '</div>';
  }

  function carteMonRdv(c) {
    return '<div class="card" style="border-left:4px solid ' + couleurDe(c.par) + ';">'
      + '<div class="card-title">✅ Votre rendez-vous</div>'
      + '<div style="font-size:17px;font-weight:800;color:var(--bleu-fonce);">'
      + joli(c.date) + ' à ' + ech(c.heure) + '</div>'
      + '<div style="font-size:13px;color:#4a5568;margin-top:6px;">avec <strong>'
      + ech(libelleParticipants(c.par)) + '</strong></div>'
      + '<div style="font-size:12px;color:#718096;margin-top:2px;">' + ech(detailParticipants(c.par)) + '</div>'
      + '<div style="font-size:12px;color:#718096;margin-top:8px;">📍 ' + ech(c.lieu || LIEU_DEFAUT) + '</div>'
      + (c.pris.motif ? '<div style="font-size:12px;color:#718096;margin-top:4px;">💬 ' + ech(c.pris.motif) + '</div>' : '')
      + '<button class="btn-annuler-rdv" data-creneau="' + c._id + '" '
      + 'style="width:100%;margin-top:14px;padding:11px;background:#fff5f5;color:#e53e3e;'
      + 'border:1px solid #fed7d7;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;">'
      + 'Annuler ce rendez-vous</button></div>';
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
      + ech(d.avec === '?' ? 'peu importe' : libelleParticipants(d.avec)) + '</div>'
      + '<div style="font-size:12px;color:#718096;margin-top:2px;">Motif : ' + ech(d.motif) + '</div>'
      + (d.reponse ? '<div style="margin-top:10px;padding:10px 12px;background:var(--or-pale);'
          + 'border-left:3px solid var(--or);border-radius:0 8px 8px 0;font-size:12.5px;color:#744210;">'
          + ech(d.reponse) + '</div>' : '')
      + '<button class="btn-annuler-demande" data-demande="' + d._id + '" '
      + 'style="width:100%;margin-top:14px;padding:11px;background:#fff5f5;color:#e53e3e;'
      + 'border:1px solid #fed7d7;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;">'
      + 'Annuler ma demande</button></div>';
  }

  // Rappel permanent : l'onglet est nouveau, tout le monde ne devinera pas
  // à quoi il sert. Volontairement court et sans jargon.
  function blocExplication() {
    return '<div style="background:linear-gradient(135deg,var(--bleu-fonce),var(--bleu));'
      + 'color:#fff;border-radius:14px;padding:16px;margin-bottom:14px;">'
      + '<div style="font-size:14px;font-weight:800;color:var(--or);">📅 Besoin de nous voir ?</div>'
      + '<div style="font-size:12.5px;line-height:1.6;margin-top:7px;opacity:.92;">'
      + 'Choisissez un créneau ci-dessous, ou dites-nous quand vous êtes disponible. '
      + 'Suivi de parcours, question sur votre contrat, difficulté personnelle, absence à justifier : '
      + 'tout motif est recevable.</div>'
      + '<div style="font-size:11.5px;line-height:1.6;margin-top:8px;opacity:.75;">'
      + 'Ce que vous nous confiez reste entre nous.</div>'
      + '<button id="rdvRevoir" style="margin-top:11px;background:rgba(255,255,255,.15);'
      + 'border:1px solid rgba(255,255,255,.3);color:#fff;font-size:11.5px;font-weight:700;'
      + 'padding:7px 12px;border-radius:8px;cursor:pointer;">Comment ça marche ?</button>'
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
        var multi = codes(c.par).length > 1;
        h += '<button class="btn-creneau" data-creneau="' + c._id + '" '
          + 'style="width:100%;display:flex;align-items:center;gap:11px;padding:11px 12px;margin-bottom:7px;'
          + 'background:#fff;border:2px solid #edf2f7;border-left:4px solid ' + couleurDe(c.par) + ';'
          + 'border-radius:11px;cursor:pointer;text-align:left;font-family:inherit;">'
          + '<div style="font-size:15px;font-weight:800;color:var(--bleu-fonce);min-width:46px;">' + ech(c.heure) + '</div>'
          + '<div style="flex:1;min-width:0;">'
          + '<div style="font-size:13px;font-weight:700;color:#2d3748;">'
          + (multi ? '👥 ' : '') + ech(libelleParticipants(c.par)) + '</div>'
          + '<div style="font-size:11px;color:#718096;">' + ech(detailParticipants(c.par)) + '</div>'
          + '</div>'
          + '<div style="font-size:11px;color:#a0aec0;white-space:nowrap;">' + (c.duree || 30) + ' min</div>'
          + '</button>';
      });
    });

    return h + '</div>';
  }

  function blocDemande(nbLibres) {
    var cases = '';
    Object.keys(CONSEILLERS).forEach(function (k) {
      cases += '<label style="display:flex;align-items:center;gap:9px;padding:9px 11px;margin-bottom:6px;'
        + 'border:2px solid #edf2f7;border-radius:10px;cursor:pointer;">'
        + '<input type="checkbox" class="rdv-qui" value="' + k + '" style="width:17px;height:17px;flex-shrink:0;" />'
        + '<span style="flex:1;min-width:0;">'
        + '<span style="display:block;font-size:13px;font-weight:700;color:#2d3748;">' + ech(CONSEILLERS[k].nom) + '</span>'
        + '<span style="display:block;font-size:11px;color:#718096;">' + ech(CONSEILLERS[k].role) + '</span>'
        + '</span></label>';
    });

    var motifs = '<option value="">— Choisir —</option>';
    MOTIFS.forEach(function (m) { motifs += '<option value="' + ech(m) + '">' + ech(m) + '</option>'; });

    return '<div class="card">'
      + '<div class="card-title">✍️ ' + (nbLibres ? 'Aucun créneau ne vous convient ?' : 'Demander un rendez-vous') + '</div>'
      + '<div style="font-size:12.5px;color:#718096;line-height:1.6;margin-bottom:12px;">'
      + 'Décrivez votre besoin et vos disponibilités. Nous revenons vers vous rapidement.</div>'

      + '<div class="form-field"><label class="form-label">Avec qui ?</label>'
      + '<div style="font-size:11.5px;color:#718096;margin-bottom:8px;">'
      + 'Cochez une ou plusieurs personnes. Ne rien cocher revient à dire « peu importe ».</div>'
      + cases + '</div>'

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

    boite.querySelectorAll('.btn-convoc-oui').forEach(function (b) {
      b.addEventListener('click', function () { repondreConvocation(b.getAttribute('data-c'), true, boite); });
    });
    boite.querySelectorAll('.btn-convoc-non, .btn-convoc-annuler').forEach(function (b) {
      b.addEventListener('click', function () { repondreConvocation(b.getAttribute('data-c'), false, boite); });
    });
    var rev = boite.querySelector('#rdvRevoir');
    if (rev && global.JTCF_NEWS) rev.addEventListener('click', function () { global.JTCF_NEWS.revoir(); });
  }

  async function reserver(cid, boite) {
    var c = await api.lire('creneaux/' + cid);
    if (!c) { alert('Ce créneau n\'existe plus.'); return rendreApprenant(boite); }
    if (c.pris) { alert('Ce créneau vient d\'être réservé par quelqu\'un d\'autre.'); return rendreApprenant(boite); }

    var motif = prompt('Rendez-vous avec ' + libelleParticipants(c.par) + '\n'
      + joli(c.date) + ' à ' + c.heure + '\n\n'
      + 'En quelques mots, le motif de votre demande :', '');
    if (motif === null) return;

    await api.ecrire('creneaux/' + cid + '/pris', {
      id: moi.id, nom: moi.nom, type: moi.type,
      motif: (motif || '').trim(), le: new Date().toISOString()
    });
    alert('✅ Rendez-vous confirmé\n\n' + joli(c.date) + ' à ' + c.heure
      + '\navec ' + libelleParticipants(c.par));
    rendreApprenant(boite);
  }

  async function repondreConvocation(cid, accepte, boite) {
    if (accepte) {
      await api.ecrire('convocations/' + cid + '/etat', 'accepte');
      await api.ecrire('convocations/' + cid + '/repondu', new Date().toISOString());
      await api.ecrire('convocations/' + cid + '/notifieReponse', false);
      alert('✅ C\'est noté, nous vous attendons.');
    } else {
      var raison = prompt('Vous ne pouvez pas venir à cette date.\n\n'
        + 'Dites-nous pourquoi, et quand vous seriez disponible :', '');
      if (raison === null) return;
      await api.ecrire('convocations/' + cid + '/etat', 'refuse');
      await api.ecrire('convocations/' + cid + '/reponse', (raison || '').trim());
      await api.ecrire('convocations/' + cid + '/repondu', new Date().toISOString());
      await api.ecrire('convocations/' + cid + '/notifieReponse', false);
      alert('C\'est noté. Nous revenons vers vous avec une autre proposition.');
    }
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
    var choisis = [];
    boite.querySelectorAll('.rdv-qui').forEach(function (c) { if (c.checked) choisis.push(c.value); });
    var avec = choisis.length ? choisis.join(',') : '?';

    var motif = boite.querySelector('#rdvMotif').value;
    var dispo = boite.querySelector('#rdvDispo').value.trim();
    var message = boite.querySelector('#rdvMessage').value.trim();

    if (!motif) { alert('Merci d\'indiquer le motif de votre demande.'); return; }

    bouton.disabled = true;
    bouton.textContent = '⏳ Envoi...';
    try {
      await api.ecrire('rdvDemandes/' + id('d'), {
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
     Un mois d'un coup d'œil. Partagé : la bascule « Toute l'équipe » montre
     les rendez-vous de chacun, avec une pastille de couleur par personne.
     ------------------------------------------------------------------------ */

  var calAnnee = new Date().getFullYear();
  var calMois = new Date().getMonth();
  var calJour = null;
  var vueEquipe = 'liste';
  var portee = 'moi';     // 'moi' ou 'equipe'

  function calendrierHTML(creneaux) {
    var nbJours = new Date(calAnnee, calMois + 1, 0).getDate();
    var decalage = (new Date(calAnnee, calMois, 1).getDay() + 6) % 7;   // semaine du lundi
    var auj = isoAujourdhui();

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
      var estAuj = iso === auj;
      var actif = iso === calJour;
      var weekend = [0, 6].indexOf(new Date(calAnnee, calMois, d).getDay()) >= 0;

      // Une pastille par personne concernée ce jour-là, plus une pour le libre.
      var quiPris = {}, aLibre = false;
      liste.forEach(function (c) {
        if (c.pris) codes(c.par).forEach(function (k) { quiPris[k] = true; });
        else aLibre = true;
      });

      var pastilles = '';
      Object.keys(quiPris).forEach(function (k) {
        pastilles += '<span style="width:5px;height:5px;border-radius:50%;background:'
          + (actif ? '#fff' : conseiller(k).couleur) + ';"></span>';
      });
      if (aLibre) pastilles += '<span style="width:5px;height:5px;border-radius:50%;border:1.5px solid '
        + (actif ? '#fff' : 'var(--or)') + ';"></span>';

      var fond = actif ? 'var(--bleu-fonce)' : (estAuj ? 'var(--or-pale)' : (weekend ? '#fafbfc' : '#fff'));
      var texte = actif ? '#fff' : (weekend ? '#cbd5e0' : '#2d3748');
      var bord = actif ? 'var(--bleu-fonce)' : (estAuj ? 'var(--or)' : '#edf2f7');

      h += '<button class="cal-jour" data-iso="' + iso + '" '
        + 'style="aspect-ratio:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;'
        + 'background:' + fond + ';border:1.5px solid ' + bord + ';border-radius:9px;cursor:pointer;'
        + 'font-family:inherit;padding:0;">'
        + '<div style="font-size:12.5px;font-weight:' + (estAuj || actif ? '800' : '600') + ';color:' + texte + ';">' + d + '</div>'
        + '<div style="display:flex;gap:2px;height:6px;align-items:center;">' + pastilles + '</div>'
        + '</button>';
    }

    h += '</div>';

    // Légende : les couleurs de l'équipe
    h += '<div style="display:flex;flex-wrap:wrap;gap:12px;justify-content:center;margin-top:10px;font-size:10.5px;color:#718096;">';
    Object.keys(CONSEILLERS).forEach(function (k) {
      h += '<span><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:'
        + CONSEILLERS[k].couleur + ';margin-right:4px;"></span>' + ech(CONSEILLERS[k].nom.split(' ')[0]) + '</span>';
    });
    h += '<span><span style="display:inline-block;width:6px;height:6px;border-radius:50%;'
      + 'border:1.5px solid var(--or);margin-right:4px;"></span>Libre</span></div>';

    if (calJour) {
      var duJour = (parJour[calJour] || []).sort(trierCreneaux);
      h += '<div style="margin-top:14px;padding-top:12px;border-top:1px solid #edf2f7;">'
        + '<div style="font-size:12px;font-weight:800;color:var(--bleu-fonce);margin-bottom:8px;">' + joli(calJour) + '</div>';
      if (!duJour.length) {
        h += '<div style="font-size:12.5px;color:#718096;">Aucun créneau ce jour-là.</div>';
      } else {
        duJour.forEach(function (c) {
          h += '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #f7fafc;">'
            + '<div style="font-size:13px;font-weight:800;color:' + couleurDe(c.par) + ';min-width:46px;">' + ech(c.heure) + '</div>'
            + '<div style="flex:1;min-width:0;">'
            + (c.pris
                ? '<div style="font-size:12.5px;font-weight:700;color:var(--bleu-fonce);">' + ech(c.pris.nom) + '</div>'
                  + '<div style="font-size:11px;color:#718096;">' + ech(libelleParticipants(c.par))
                    + (c.pris.motif ? ' · ' + ech(c.pris.motif) : '') + '</div>'
                : '<div style="font-size:12.5px;color:#a0aec0;font-style:italic;">Libre — '
                  + ech(libelleParticipants(c.par)) + '</div>')
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

  function bouton(id, libelle, actif) {
    return '<button id="' + id + '" style="flex:1;padding:10px;border-radius:10px;font-size:13px;'
      + 'font-weight:700;cursor:pointer;font-family:inherit;border:2px solid '
      + (actif ? 'var(--bleu-fonce);background:var(--bleu-fonce);color:#fff;'
               : '#e2e8f0;background:#fff;color:#718096;')
      + '">' + libelle + '</button>';
  }

  async function rendreEquipe(boite, role) {
    boite.innerHTML = '<div class="loading">Chargement...</div>';

    var creneaux = objetVersListe(await api.lire('creneaux'));
    var demandes = objetVersListe(await api.lire('rdvDemandes'));
    var convocs  = objetVersListe(await api.lire('convocations'));
    await chargerAnnuaire();
    var auj = isoAujourdhui();

    // Le calendrier est partagé : chacun bascule entre son planning et celui
    // de toute l'équipe. L'admin voit tout dans les deux cas.
    function retenu(x) {
      if (role === 'admin' || portee === 'equipe') return true;
      if (x.avec === '?') return true;               // demande laissée au choix
      return participe(x.par || x.avec, role);
    }

    var enAttente = demandes.filter(function (d) { return d.etat === 'demande' && retenu(d); })
      .sort(function (a, b) { return (a.le || '').localeCompare(b.le || ''); });
    var prochains = creneaux.filter(function (c) { return c.pris && c.date >= auj && retenu(c); }).sort(trierCreneaux);
    var libres = creneaux.filter(function (c) { return !c.pris && c.date >= auj && retenu(c); }).sort(trierCreneaux);

    var h = '';

    // Deux bascules : ce que je regarde, et comment je le regarde.
    if (role !== 'admin') {
      h += '<div style="display:flex;gap:7px;margin-bottom:8px;">'
        + bouton('porteeMoi', '👤 Mon planning', portee === 'moi')
        + bouton('porteeEquipe', '👥 Toute l\'équipe', portee === 'equipe')
        + '</div>';
    }
    h += '<div style="display:flex;gap:7px;margin-bottom:14px;">'
      + bouton('vueListe', '📋 Liste', vueEquipe === 'liste')
      + bouton('vueCal', '🗓️ Calendrier', vueEquipe === 'calendrier')
      + '</div>';

    if (vueEquipe === 'calendrier') h += calendrierHTML(creneaux.filter(retenu));

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
          + ech(d.avec === '?' ? 'peu importe' : libelleParticipants(d.avec)) + '</div>'
          + '<div style="display:flex;gap:7px;margin-top:9px;">'
          + '<button class="rdv-confirmer" data-d="' + d._id + '" style="flex:1;padding:9px;background:#38a169;'
          + 'color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;">Confirmer</button>'
          + '<button class="rdv-refuser" data-d="' + d._id + '" style="flex:1;padding:9px;background:#edf2f7;'
          + 'color:#4a5568;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;">Répondre autrement</button>'
          + '</div></div>';
      });
    }
    h += '</div>';

    if (vueEquipe === 'liste') {
      h += '<div class="card"><div class="card-title">📅 Prochains rendez-vous</div>';
      if (!prochains.length) {
        h += '<div style="font-size:13px;color:#718096;padding:6px 0;">Aucun rendez-vous à venir.</div>';
      } else {
        prochains.forEach(function (c) {
          h += '<div style="display:flex;gap:11px;padding:10px 0;border-bottom:1px solid #f0f2f5;">'
            + '<div style="min-width:52px;"><div style="font-size:14px;font-weight:800;color:' + couleurDe(c.par) + ';">'
            + ech(c.heure) + '</div><div style="font-size:10px;color:#a0aec0;">'
            + ech(c.date.slice(8) + '/' + c.date.slice(5, 7)) + '</div></div>'
            + '<div style="flex:1;min-width:0;">'
            + '<div style="font-size:13px;font-weight:700;color:var(--bleu-fonce);">' + ech(c.pris.nom) + '</div>'
            + '<div style="font-size:11px;color:#718096;">' + ech(libelleParticipants(c.par))
              + (c.pris.motif ? ' · ' + ech(c.pris.motif) : '') + '</div>'
            + '</div>'
            + '<button class="rdv-liberer" data-c="' + c._id + '" title="Annuler ce rendez-vous" '
            + 'style="background:none;border:none;color:#e53e3e;font-size:15px;cursor:pointer;">✕</button>'
            + '</div>';
        });
      }
      h += '</div>';
    }

    // Convocations : ce que j'ai proposé, et où ça en est
    var mesConvocs = convocs.filter(function (c) {
      return retenu(c) && c.date >= auj && c.etat !== 'annule';
    }).sort(trierCreneaux);
    var refusees = convocs.filter(function (c) {
      return retenu(c) && c.etat === 'refuse';
    }).sort(function (a, b) { return (b.repondu || '').localeCompare(a.repondu || ''); });

    if (refusees.length) {
      h += '<div class="card"><div class="card-title">\u21a9\ufe0f Propositions d\u00e9clin\u00e9es'
        + '<span style="float:right;font-size:10.5px;font-weight:800;padding:3px 10px;border-radius:20px;'
        + 'background:#fffaf0;color:#dd6b20;">' + refusees.length + '</span></div>';
      refusees.forEach(function (c) {
        h += '<div style="padding:11px 12px;margin-bottom:8px;background:#fffaf0;'
          + 'border-left:3px solid #dd6b20;border-radius:8px;">'
          + '<div style="font-size:13px;font-weight:800;color:var(--bleu-fonce);">' + ech(c.nom) + '</div>'
          + '<div style="font-size:11.5px;color:#718096;margin-top:2px;">'
          + 'Propos\u00e9 le ' + joli(c.date) + ' \u00e0 ' + ech(c.heure) + '</div>'
          + (c.reponse ? '<div style="font-size:12.5px;color:#4a5568;margin-top:5px;line-height:1.55;">'
              + '\ud83d\udcac ' + ech(c.reponse) + '</div>' : '')
          + '<button class="convoc-classer" data-c="' + c._id + '" style="margin-top:9px;padding:7px 13px;'
          + 'background:#edf2f7;color:#4a5568;border:none;border-radius:8px;font-size:12px;'
          + 'font-weight:700;cursor:pointer;font-family:inherit;">Classer</button>'
          + '</div>';
      });
      h += '</div>';
    }

    // Convoquer un apprenant
    var options = '<option value="">\u2014 Choisir une personne \u2014</option>';
    if (annuaire.length) {
      var parType = { alt: [], fc: [], stg: [] };
      annuaire.forEach(function (p) { (parType[p.type] || parType.alt).push(p); });
      var titres = { alt: 'Alternants', fc: 'Formation continue', stg: 'Stagiaires' };
      ['alt', 'fc', 'stg'].forEach(function (t) {
        if (!parType[t].length) return;
        options += '<optgroup label="' + titres[t] + '">';
        parType[t].sort(function (a, b) { return (a.nom || '').localeCompare(b.nom || ''); })
          .forEach(function (p) {
            options += '<option value="' + ech(p.id) + '|' + ech(p.type) + '|' + ech(p.nom) + '">'
              + ech(p.nom) + '</option>';
          });
        options += '</optgroup>';
      });
    }

    var casesC = '';
    Object.keys(CONSEILLERS).forEach(function (k) {
      var coche = (role === k) || (role === 'admin' && k === 'AB');
      casesC += '<label style="display:inline-flex;align-items:center;gap:7px;padding:7px 11px;'
        + 'margin:0 6px 6px 0;border:2px solid #edf2f7;border-radius:20px;cursor:pointer;font-size:12px;'
        + 'font-weight:700;color:#2d3748;">'
        + '<input type="checkbox" class="cv-qui" value="' + k + '"' + (coche ? ' checked' : '')
        + ' style="width:15px;height:15px;" />' + ech(CONSEILLERS[k].nom.split(' ')[0]) + '</label>';
    });

    var motifsC = '<option value="">\u2014 Choisir \u2014</option>';
    MOTIFS.forEach(function (m) { motifsC += '<option value="' + ech(m) + '">' + ech(m) + '</option>'; });

    h += '<div class="card"><div class="card-title">\ud83d\udce3 Convoquer un apprenant</div>'
      + '<div style="font-size:12px;color:#718096;line-height:1.6;margin-bottom:12px;">'
      + 'Vous proposez une date. La personne la voit dans son livret et r\u00e9pond : '
      + 'elle accepte, ou elle explique pourquoi elle ne peut pas venir.</div>';

    if (!annuaire.length) {
      h += '<div style="font-size:12.5px;color:#dd6b20;">Aucun apprenant enregistr\u00e9 '
        + 'pour le moment.</div></div>';
    } else {
      h += '<div class="form-field"><label class="form-label">Qui convoquer ?</label>'
        + '<select class="form-select" id="cvQui">' + options + '</select></div>'
        + '<div class="form-field"><label class="form-label">De la part de</label>'
        + '<div>' + casesC + '</div></div>'
        + '<div style="display:flex;gap:10px;">'
        + '<div class="form-field" style="flex:1.4;"><label class="form-label">Date</label>'
        + '<input class="form-input" type="date" id="cvDate" style="text-transform:none;" /></div>'
        + '<div class="form-field" style="flex:1;"><label class="form-label">Heure</label>'
        + '<input class="form-input" type="time" id="cvHeure" value="14:00" style="text-transform:none;" /></div>'
        + '</div>'
        + '<div class="form-field"><label class="form-label">Motif</label>'
        + '<select class="form-select" id="cvMotif">' + motifsC + '</select></div>'
        + '<div class="form-field"><label class="form-label">Message (facultatif)</label>'
        + '<textarea class="form-input" id="cvMessage" rows="3" style="text-transform:none;resize:vertical;'
        + 'font-family:inherit;" placeholder="Ce que vous souhaitez aborder"></textarea></div>'
        + '<div class="form-field"><label class="form-label">Lieu</label>'
        + '<input class="form-input" id="cvLieu" value="' + ech(LIEU_DEFAUT) + '" style="text-transform:none;" /></div>'
        + '<button id="cvEnvoyer" class="btn-primary" style="width:100%;padding:12px;border:none;'
        + 'border-radius:11px;font-size:14px;font-weight:800;cursor:pointer;'
        + 'background:linear-gradient(135deg,var(--bleu-fonce),var(--bleu));color:#fff;">'
        + 'Envoyer la proposition</button></div>';
    }

    // Suivi des propositions envoyées
    if (vueEquipe === 'liste' && mesConvocs.length) {
      h += '<div class="card"><div class="card-title">\ud83d\udce4 Propositions envoy\u00e9es</div>';
      mesConvocs.forEach(function (c) {
        var et = c.etat === 'accepte' ? ['\u2705 Accept\u00e9e', '#38a169']
               : (c.etat === 'refuse' ? ['\u21a9\ufe0f D\u00e9clin\u00e9e', '#dd6b20']
               : ['\u23f3 En attente', '#a0aec0']);
        h += '<div style="display:flex;gap:11px;padding:10px 0;border-bottom:1px solid #f0f2f5;">'
          + '<div style="min-width:52px;"><div style="font-size:14px;font-weight:800;color:' + couleurDe(c.par) + ';">'
          + ech(c.heure) + '</div><div style="font-size:10px;color:#a0aec0;">'
          + ech(c.date.slice(8) + '/' + c.date.slice(5, 7)) + '</div></div>'
          + '<div style="flex:1;min-width:0;">'
          + '<div style="font-size:13px;font-weight:700;color:var(--bleu-fonce);">' + ech(c.nom) + '</div>'
          + '<div style="font-size:11px;color:' + et[1] + ';font-weight:700;">' + et[0]
          + (c.motif ? ' \u00b7 ' + ech(c.motif) : '') + '</div>'
          + '</div>'
          + '<button class="convoc-retirer" data-c="' + c._id + '" title="Retirer" '
          + 'style="background:none;border:none;color:#e53e3e;font-size:15px;cursor:pointer;">\u2715</button>'
          + '</div>';
      });
      h += '</div>';
    }

    // Publication de créneaux — une ou plusieurs personnes
    var cases = '';
    Object.keys(CONSEILLERS).forEach(function (k) {
      var coche = (role === k) || (role === 'admin' && k === 'AB');
      cases += '<label style="display:flex;align-items:center;gap:9px;padding:9px 11px;margin-bottom:6px;'
        + 'border:2px solid #edf2f7;border-radius:10px;cursor:pointer;">'
        + '<input type="checkbox" class="cr-qui" value="' + k + '"' + (coche ? ' checked' : '')
        + ' style="width:17px;height:17px;flex-shrink:0;" />'
        + '<span style="flex:1;min-width:0;">'
        + '<span style="display:block;font-size:13px;font-weight:700;color:#2d3748;">' + ech(CONSEILLERS[k].nom) + '</span>'
        + '<span style="display:block;font-size:11px;color:#718096;">' + ech(CONSEILLERS[k].role) + '</span>'
        + '</span></label>';
    });

    h += '<div class="card"><div class="card-title">➕ Ouvrir des créneaux</div>'
      + '<div style="font-size:12px;color:#718096;line-height:1.6;margin-bottom:12px;">'
      + 'Indiquez une plage horaire : l\'application la découpe en rendez-vous de la durée choisie. '
      + 'Cochez plusieurs personnes pour un entretien à plusieurs — toute l\'équipe, par exemple.</div>'
      + '<div class="form-field"><label class="form-label">Qui reçoit ?</label>' + cases + '</div>'
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
            var multi = codes(c.par).length > 1;
            h += '<span title="' + ech(libelleParticipants(c.par)) + '" '
              + 'style="display:inline-flex;align-items:center;gap:6px;padding:5px 10px;'
              + 'background:#f7fafc;border:1px solid #e2e8f0;border-left:3px solid ' + couleurDe(c.par) + ';'
              + 'border-radius:8px;font-size:12px;font-weight:700;color:#2d3748;">'
              + (multi ? '👥 ' : '') + ech(c.heure)
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

    var pm = boite.querySelector('#porteeMoi'), pe = boite.querySelector('#porteeEquipe');
    if (pm) pm.addEventListener('click', function () { portee = 'moi'; recharger(); });
    if (pe) pe.addEventListener('click', function () { portee = 'equipe'; recharger(); });

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

    boite.querySelectorAll('.convoc-classer').forEach(function (b) {
      b.addEventListener('click', async function () {
        await api.ecrire('convocations/' + b.getAttribute('data-c') + '/etat', 'annule');
        recharger();
      });
    });

    boite.querySelectorAll('.convoc-retirer').forEach(function (b) {
      b.addEventListener('click', async function () {
        if (!confirm('Retirer cette proposition ?')) return;
        await api.ecrire('convocations/' + b.getAttribute('data-c'), null);
        recharger();
      });
    });

    var cv = boite.querySelector('#cvEnvoyer');
    if (cv) cv.addEventListener('click', async function () {
      var choix = boite.querySelector('#cvQui').value;
      if (!choix) { alert('Choisissez la personne à convoquer.'); return; }

      var qui = [];
      boite.querySelectorAll('.cv-qui').forEach(function (c) { if (c.checked) qui.push(c.value); });
      if (!qui.length) { alert('Indiquez de la part de qui.'); return; }

      var date = boite.querySelector('#cvDate').value;
      var heure = boite.querySelector('#cvHeure').value;
      var motif = boite.querySelector('#cvMotif').value;
      if (!date || !heure) { alert('Indiquez la date et l\'heure.'); return; }
      if (!motif) { alert('Indiquez le motif — la personne doit savoir pourquoi.'); return; }

      var p = choix.split('|');
      var par = qui.join(',');

      if (!confirm('Proposer à ' + p[2] + '\n'
        + joli(date) + ' à ' + heure + '\n'
        + 'de la part de ' + libelleParticipants(par) + ' ?')) return;

      cv.disabled = true; cv.textContent = '⏳ Envoi...';
      try {
        await api.ecrire('convocations/' + id('v'), {
          pour: p[0], type: p[1], nom: p[2],
          par: par, date: date, heure: heure,
          motif: motif,
          message: boite.querySelector('#cvMessage').value.trim(),
          lieu: boite.querySelector('#cvLieu').value.trim() || LIEU_DEFAUT,
          etat: 'propose', reponse: '', repondu: '',
          le: new Date().toISOString(), notifie: false, notifieReponse: true
        });
        alert('✅ Proposition envoyée\n\n' + p[2] + ' la verra dans son livret et vous répondra.');
        recharger();
      } catch (e) {
        alert('Envoi impossible : ' + e.message);
      } finally {
        cv.disabled = false; cv.textContent = 'Envoyer la proposition';
      }
    });

    var pub = boite.querySelector('#crPublier');
    if (pub) pub.addEventListener('click', async function () {
      var qui = [];
      boite.querySelectorAll('.cr-qui').forEach(function (c) { if (c.checked) qui.push(c.value); });
      if (!qui.length) { alert('Cochez au moins une personne.'); return; }

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

      var par = qui.join(',');
      if (!confirm('Publier ' + nb + ' créneau(x) de ' + duree + ' minutes\n'
        + 'le ' + joli(date) + '\navec ' + libelleParticipants(par) + ' ?')) return;

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
    var lots = await Promise.all([api.lire('rdvDemandes'), api.lire('convocations')]);
    var demandes = objetVersListe(lots[0]);
    var convocs = objetVersListe(lots[1]);

    var n = demandes.filter(function (d) {
      if (d.etat !== 'demande') return false;
      if (role === 'admin') return true;
      if (d.avec === '?') return true;
      return participe(d.avec, role);
    }).length;

    // Une proposition déclinée demande aussi une action de notre part.
    n += convocs.filter(function (c) {
      if (c.etat !== 'refuse') return false;
      return role === 'admin' || participe(c.par, role);
    }).length;

    return n;
  }

  /* ---- Publication -------------------------------------------------------- */

  global.JTCF_RDV = {
    CONSEILLERS: CONSEILLERS,
    MOTIFS: MOTIFS,
    codes: codes,
    libelleParticipants: libelleParticipants,
    connecter: function (adaptateur) { api = adaptateur; },
    apprenant: function (profil, boite) { moi = profil; return rendreApprenant(boite); },
    equipe: function (boite, role) { return rendreEquipe(boite, role || 'admin'); },
    enAttente: nombreEnAttente
  };
})(window);
