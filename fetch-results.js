#!/usr/bin/env node
/**
 * Coupe du Monde 2026 — Bracket : récupérateur de RÉSULTATS de la phase finale.
 * ---------------------------------------------------------------------------
 * Source : API SportMonks (même token que BracketV2auto / FootballWhispers).
 *
 * Récupère les fixtures de la phase à élimination directe (16es → finale) de la
 * Coupe du Monde 2026, identifie pour chaque match TERMINÉ l'équipe qui s'est
 * qualifiée, et écrit `results.json` :
 *
 *   { "updated": "2026-…Z", "season": 26618,
 *     "matches": [ { "a":"GER", "b":"PAR", "w":"GER", "ga":2, "gb":0 }, … ] }
 *
 * Le widget lit `results.json` côté client (le token n'est JAMAIS exposé) et,
 * via sa propre logique de bracket, fait avancer + VERROUILLE l'équipe gagnante
 * au tour suivant. Relancer pour rafraîchir :  node fetch-results.js
 */

const fs = require("fs");
const path = require("path");

function loadDotEnv() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadDotEnv();

const API_TOKEN = process.env.SPORTMONKS_API_TOKEN;
if (!API_TOKEN) {
  console.error("✗ SPORTMONKS_API_TOKEN manquant (voir .env.example).");
  process.exit(1);
}

const BASE = "https://api.sportmonks.com/v3/football";
const SEASON_ID = 26618;                              // Coupe du Monde 2026
const LEAGUE_FILTER = 732;                            // World Cup
const KO_WINDOW = ["2026-06-28", "2026-07-20"];       // 16es de finale → finale
const FINISHED_STATES = new Set([5, 7, 8]);           // 5=FT, 7=AET, 8=FT pen.
// Stages à élimination directe (exclut "Group Stage" : des matchs de groupe
// reprogrammés peuvent tomber dans la fenêtre de dates).
const KO_STAGES = new Set([
  "Round of 32", "Round of 16", "Quarter-finals", "Semi-finals", "3rd Place Final", "Final"
]);

// Nom d'équipe SportMonks → code interne utilisé par le bracket (T{} du widget).
const NAME2CODE = {
  "Argentina": "ARG", "France": "FRA", "Spain": "ESP", "England": "ENG", "Brazil": "BRA",
  "Morocco": "MAR", "Portugal": "POR", "Netherlands": "NED", "Germany": "GER", "Belgium": "BEL",
  "Croatia": "CRO", "Mexico": "MEX", "Colombia": "COL", "United States": "USA", "Senegal": "SEN",
  "Japan": "JPN", "Uruguay": "URU", "Switzerland": "SUI", "Austria": "AUT", "Korea Republic": "KOR",
  "Australia": "AUS", "Iran": "IRN", "Türkiye": "PLC", "Norway": "NOR", "Ecuador": "ECU",
  "Egypt": "EGY", "Côte d'Ivoire": "CIV", "Algeria": "ALG", "Canada": "CAN", "Panama": "PAN",
  "Sweden": "PLB", "Scotland": "SCO", "Paraguay": "PAR", "Congo DR": "PL1", "Czech Republic": "PLD",
  "Qatar": "QAT", "Uzbekistan": "UZB", "Tunisia": "TUN", "Saudi Arabia": "KSA", "Iraq": "PL2",
  "South Africa": "RSA", "Bosnia and Herzegovina": "PLA", "Cape Verde Islands": "CPV", "Jordan": "JOR",
  "Ghana": "GHA", "New Zealand": "NZL", "Curacao": "CUW", "Haiti": "HAI"
};

async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`SportMonks ${res.status} ${res.statusText}`);
  return res.json();
}

function codeFor(name) {
  return NAME2CODE[name] || null;
}

/** Détermine le vainqueur d'une fixture terminée → code interne, ou null. */
function resolveWinner(fx) {
  const parts = fx.participants || [];
  if (parts.length !== 2) return null;
  const A = parts[0], B = parts[1];
  const ca = codeFor(A.name), cb = codeFor(B.name);
  if (!ca || !cb) return null;

  // 1) Signal officiel : participant.meta.winner.
  const wa = A.meta && A.meta.winner, wb = B.meta && B.meta.winner;
  let w = null;
  if (wa === true) w = ca;
  else if (wb === true) w = cb;

  // 2) Repli : score CURRENT (90'+prol.), puis tirs au but.
  const goals = {};
  const pens = {};
  for (const s of fx.scores || []) {
    if (!s.score || s.participant_id == null) continue;
    const d = (s.description || "").toUpperCase();
    if (d === "CURRENT") goals[s.participant_id] = s.score.goals;
    else if (d.includes("PEN")) pens[s.participant_id] = s.score.goals;
  }
  const ga = goals[A.id], gb = goals[B.id];
  if (w === null && ga != null && gb != null) {
    if (ga > gb) w = ca;
    else if (gb > ga) w = cb;
    else {
      const pa = pens[A.id], pb = pens[B.id];
      if (pa != null && pb != null && pa !== pb) w = pa > pb ? ca : cb;
    }
  }
  if (!w) return null;
  return { a: ca, b: cb, w, ga: ga != null ? ga : null, gb: gb != null ? gb : null };
}

async function main() {
  const [start, end] = KO_WINDOW;
  const out = [];
  const seen = new Set();
  let page = 1;
  for (;;) {
    const url =
      `${BASE}/fixtures/between/${start}/${end}` +
      `?api_token=${API_TOKEN}&include=participants;scores;stage&filters=fixtureLeagues:${LEAGUE_FILTER}` +
      `&per_page=50&page=${page}`;
    const json = await getJSON(url);
    const fixtures = json.data || [];
    for (const fx of fixtures) {
      if (!FINISHED_STATES.has(fx.state_id)) continue;
      if (!fx.stage || !KO_STAGES.has(fx.stage.name)) continue;   // KO uniquement
      const r = resolveWinner(fx);
      if (!r) continue;
      const key = [r.a, r.b].sort().join("|");
      if (seen.has(key)) continue;       // garde la 1re occurrence (anti-doublon)
      seen.add(key);
      out.push(r);
    }
    const pg = json.pagination || {};
    if (!pg.has_more) break;
    page++;
    if (page > 10) break;
  }

  const payload = {
    updated: new Date().toISOString(),
    season: SEASON_ID,
    source: "SportMonks",
    matches: out
  };
  const file = path.join(__dirname, "results.json");
  fs.writeFileSync(file, JSON.stringify(payload, null, 2) + "\n", "utf8");
  console.log(`✓ results.json — ${out.length} match(s) terminé(s) en phase finale.`);
  out.forEach((r) => console.log(`   ${r.a} ${r.ga}-${r.gb} ${r.b}  →  ${r.w}`));
}

main().catch((e) => { console.error("✗", e.message); process.exit(1); });
