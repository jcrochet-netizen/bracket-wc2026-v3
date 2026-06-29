# Bracket Coupe du Monde 2026 (16es → titre)

Widget interactif (1 fichier HTML par langue, sans dépendance). Le bracket démarre
directement aux **16es de finale** : les 32 équipes sont pré-placées (1er/2e de chaque
groupe + 8 meilleurs 3es, selon le classement final), le lecteur clique les vainqueurs
tour après tour jusqu'au titre, puis **partage** (X, Facebook, WhatsApp, e-mail) ou
**télécharge l'image** du bracket.

## Fichiers (1 par langue)

| Langue | Fichier | `lang` |
|---|---|---|
| Français | `bracket-wc2026.html` | `fr` |
| English | `bracket-wc2026-en.html` | `en` |
| Español | `bracket-wc2026-es.html` | `es` |
| Português (BR) | `bracket-wc2026-pt.html` | `pt-BR` |
| Italiano | `bracket-wc2026-it.html` | `it` |
| Čeština | `bracket-wc2026-cz.html` | `cs` |

Seuls le bloc de données équipes (`T`), les classements amorcés et les libellés d'interface
changent entre les langues : le moteur JS et la structure du bracket sont identiques.

Hébergé sur GitHub Pages : `https://jcrochet-netizen.github.io/bracket-wc2026-v3/<fichier>`.

## Résultats officiels en direct (SportMonks)

Une couche « live » fait avancer **automatiquement** le vainqueur de chaque match
joué (16es → finale) et le **verrouille** (l'utilisateur ne peut plus le changer) ;
il continue de pronostiquer librement les matchs à venir.

```
SportMonks API ─> fetch-results.js ─> results.json ─> widget (lit results.json, jamais le token)
  (token serveur)   (GitHub Action cron */15)          applique + VERROUILLE les matchs joués
```

- **`fetch-results.js`** (serveur) : lit les fixtures de la phase à élimination
  directe de la saison 26618 (stages *Round of 32 → Final*), désigne le vainqueur de
  chaque match terminé, et écrit `results.json` :
  `{ "updated": …, "matches": [ { "a":"GER", "b":"PAR", "w":"GER" }, … ] }` (codes équipes).
- **Le widget** lit `results.json` (toutes les 5 min, `fetch` côté client), puis via sa
  propre logique de bracket fait correspondre chaque résultat à la bonne rencontre **par
  paire d'équipes**, tour après tour : il fixe le vainqueur, le verrouille (cercle + ligne
  **verts**), et purge tout pronostic aval devenu invalide. Le token n'est **jamais** exposé.

Les matchs verrouillés affichent un bandeau « résultats officiels en direct » et le
vainqueur en vert ; les matchs non encore joués restent cliquables (pronostic, en bleu).

### Déploiement de la couche live
1. Secret `SPORTMONKS_API_TOKEN` dans **Settings → Secrets and variables → Actions**.
2. L'action `.github/workflows/refresh-results.yml` régénère `results.json` toutes les
   15 min et le commit s'il a changé (cron + bouton « Run workflow »).
3. En local : `cp .env.example .env` (renseigne le token) puis `node fetch-results.js`.

## Intégration WordPress (bloc « HTML personnalisé »)

Sur chaque page localisée, colle le bloc ci-dessous (remplace `src` + `title` + le texte
selon la langue — voir tableau plus bas).

```html
<!-- ① Contenu crawlable AUTOUR de l'iframe (le contenu d'une iframe n'est PAS
     attribué à la page par Google → il faut du vrai texte indexable ici). -->
<h2>Remplis ton bracket de la Coupe du Monde 2026</h2>
<p>Des 16es de finale jusqu'au titre : fais avancer chaque nation — Brésil, France,
Espagne, Argentine, Angleterre, Portugal… — clique les vainqueurs tour après tour et
partage ton pronostic complet du Mondial 2026.</p>

<!-- ② Le widget -->
<iframe
  id="wc2026-bracket"
  src="https://jcrochet-netizen.github.io/bracket-wc2026-v3/bracket-wc2026.html"
  title="Remplis ton bracket de la Coupe du Monde 2026"
  loading="lazy"
  scrolling="no"
  referrerpolicy="strict-origin-when-cross-origin"
  style="width:100%;max-width:820px;display:block;margin:0 auto;border:0;overflow:hidden;min-height:900px;"></iframe>

<script>
(function () {
  var ORIGIN = 'https://jcrochet-netizen.github.io';      // origine de confiance (hébergeur du widget)
  var frame  = document.getElementById('wc2026-bracket');
  window.addEventListener('message', function (e) {
    if (e.origin !== ORIGIN) return;                      // 1) n'accepte QUE les messages du widget
    var d = e.data; if (!d || !d.type) return;
    if (d.type === 'wc2026-resize') {                     // auto-resize (anti-CLS, pas de double-scroll)
      var h = parseInt(d.height, 10);
      if (h && h > 0 && frame) frame.style.height = h + 'px';
    }
    if (d.type === 'wc2026-getUrl' && e.source) {
      e.source.postMessage({ type: 'wc2026-url', url: location.href }, ORIGIN);  // URL réelle → partages précis
    }
  }, false);
})();
</script>
```

### Bonnes pratiques SEO appliquées
- **Texte crawlable autour de l'iframe** (H2 + intro + noms d'équipes) : le contenu de
  l'iframe appartient au domaine `github.io` et n'est **pas** attribué à la page WordPress.
- **Widget en `noindex, nofollow`** (déjà dans chaque fichier) → pas d'indexation
  concurrente / duplicate du contenu de l'iframe.
- **`referrerpolicy="strict-origin-when-cross-origin"`** + réponse `wc2026-url` : le widget
  utilise l'URL exacte de la page pour les partages.
- **Contrôle `e.origin`** : seul notre widget peut redimensionner l'iframe ; le message ne
  transporte qu'un entier.
- **`loading="lazy"`**, **`scrolling="no"` + `overflow:hidden`** (pas de double-scroll
  mobile), **`min-height`** de repli (anti-CLS), largeur centrée `max-width:820px`.
- **1 widget par page localisée** + `lang` correct dans chaque fichier → cohérent avec une
  stratégie **hreflang** (relie les 6 pages entre elles).

### Par langue — remplace `src`, `title` et le texte crawlable
| Langue | `src` (fichier) | `title` conseillé |
|---|---|---|
| FR | `bracket-wc2026.html` | Remplis ton bracket de la Coupe du Monde 2026 |
| EN | `bracket-wc2026-en.html` | Fill in your 2026 World Cup bracket |
| ES | `bracket-wc2026-es.html` | Completa tu bracket del Mundial 2026 |
| PT-BR | `bracket-wc2026-pt.html` | Monte sua tabela da Copa do Mundo de 2026 |
| IT | `bracket-wc2026-it.html` | Completa il tuo bracket del Mondiale 2026 |
| CZ | `bracket-wc2026-cz.html` | Vyplňte svůj bracket MS 2026 |

---
*Outil éditorial non officiel — Coupe du Monde 2026.*
