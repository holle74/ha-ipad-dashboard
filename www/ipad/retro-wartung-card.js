/**
 * Retro-Wartung fuer das iPad-Panel (07.10.2026): Wartungstafel im
 * Messing-Stil, passend zu Heizung, Beleuchtung und Beschattung.
 *
 * Die Karte besteht aus Messingplatten, jede mit einem `typ`:
 *
 *   verschleiss   Je Teil ein Oelstandsglas (Restanteil in %), darueber eine
 *                 Signallampe, darunter Reststunden und ein Messingknopf zum
 *                 Quittieren nach Tausch/Reinigung (zweimal tippen: der erste
 *                 Tipp fragt nach, der zweite drueckt den Reset-Button).
 *                 teile: [{ name, entity, rest?, reset?, knopf? }]
 *                 fehler: Entity fuer die Fehlerzeile im Kopf (optional)
 *
 *   meldungen     Meldeleuchten-Tableau, gruppiert nach Geraet. Je Lampe eine
 *                 `warn`- (bernstein) und/oder `alarm`-Entity (rot). Leuchtet,
 *                 solange der Zustand in `aktiv` steht (Standard: present,
 *                 confirmed - die Home-Connect-Ereignissensoren).
 *                 Optional je Stufe ein Merker (`warn_merker`, `alarm_merker`,
 *                 input_boolean): Home Connect meldet nur, solange das Geraet
 *                 an ist - der Merker haelt die Meldung fest (gesetzt von
 *                 automation.kuche_wartungsmeldungen_merken). Leuchtet eine
 *                 Lampe wegen eines Merkers, quittiert ein Doppeltipp ihn
 *                 (erster Tipp fragt "SICHER?"). Im Plattenkopf zeigt eine
 *                 Statuslampe gruen "nichts faellig" oder die Zahl der Meldungen.
 *                 gruppen: [{ name, lampen: [{ name, warn?, alarm?,
 *                            warn_merker?, alarm_merker? }] }]
 *
 *   system        Rollenzaehler fuer offene Updates (alle update.*), Emaille-
 *                 schild fuer das letzte/naechste Backup, zwei Zeigerinstrumente.
 *                 backup_letztes, backup_naechstes, backup_max_tage (8), cpu, ram
 *
 *   neustart      Leiste roter Pilztaster unter Messingkragen, zweimal tippen
 *                 wie beim Quittieren. Mit `entity` wird ein `button.*` gedrueckt,
 *                 dessen Zustand (Zeitpunkt des letzten Drucks) darunter steht;
 *                 alternativ `aktion` (z. B. "hassio.host_reboot") plus `text`.
 *                 knoepfe: [{ name, entity } | { name, aktion, text? }]
 *
 * Plattenoptionen fuer alle: titel, breit (true = volle Breite).
 * Kartenoptionen: platten (Pflicht), warnen_ab (20), faellig_ab (10) in %.
 * Ein Tipp auf Namensschild, Lampe oder Schild oeffnet more-info.
 */

const MESSING = "linear-gradient(135deg, #f6e2a4 0%, #c99a43 32%, #8a6020 58%, #e4c172 82%, #a5772d 100%)";
const SERIF = `Georgia, "Times New Roman", serif`;
const AKTIV = ["present", "confirmed"];
const ROEHRE = { w: 46, h: 124, x: 11, y: 14, iw: 24, ih: 96 };

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const zahl = (st) => { const n = Number(st && st.state); return st && Number.isFinite(n) ? n : null; };

// Fuellfarbe nach Restanteil: rot -> bernstein -> gruen
function fuellfarbe(p, warn, faellig) {
  if (p <= faellig) return ["#e0573a", "#8f1f0c"];
  if (p <= warn) return ["#f2b13c", "#a8620c"];
  return ["#8fcf6a", "#3f7a22"];
}

function roehre(k) {
  const { w, h, x, y, iw, ih } = ROEHRE;
  const striche = Array.from({ length: 11 }, (_, s) => {
    const yy = y + ih - (s * ih) / 10;
    const lang = s % 5 === 0;
    return `<line x1="${x + iw + 2}" y1="${yy}" x2="${x + iw + (lang ? 8 : 5)}" y2="${yy}"/>`;
  }).join("");
  return `
  <svg class="roehre" viewBox="0 0 ${w} ${h}">
    <defs>
      <linearGradient id="rm${k}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#f6e2a4"/><stop offset="0.32" stop-color="#c99a43"/>
        <stop offset="0.58" stop-color="#8a6020"/><stop offset="0.82" stop-color="#e4c172"/>
        <stop offset="1" stop-color="#a5772d"/>
      </linearGradient>
      <linearGradient id="rf${k}" x1="0" y1="0" x2="1" y2="0">
        <stop class="f1" offset="0"/><stop class="f2" offset="0.55"/><stop class="f1" offset="1"/>
      </linearGradient>
      <clipPath id="rc${k}"><rect x="${x}" y="${y}" width="${iw}" height="${ih}" rx="5"/></clipPath>
    </defs>
    <rect x="${x - 4}" y="${y - 4}" width="${iw + 8}" height="${ih + 8}" rx="8" fill="url(#rm${k})" stroke="#4a3410"/>
    <rect x="${x}" y="${y}" width="${iw}" height="${ih}" rx="5" fill="#1d1710"/>
    <g clip-path="url(#rc${k})">
      <rect class="pegel" x="${x}" y="${y}" width="${iw}" height="${ih}" fill="url(#rf${k})"/>
      <rect class="spiegel" x="${x}" y="${y}" width="${iw}" height="2.5" fill="rgba(255,255,255,0.45)"/>
      <rect x="${x + 4}" y="${y}" width="4" height="${ih}" fill="rgba(255,255,255,0.22)"/>
    </g>
    <g class="skala">${striche}</g>
    <rect x="${x - 6}" y="${y - 10}" width="${iw + 12}" height="8" rx="2" fill="url(#rm${k})" stroke="#4a3410"/>
    <rect x="${x - 6}" y="${y + ih + 2}" width="${iw + 12}" height="8" rx="2" fill="url(#rm${k})" stroke="#4a3410"/>
  </svg>`;
}

// Kleines Drehspul-Instrument 0..100 %
function instrument(k, titel) {
  const cx = 60, cy = 58, r = 44;
  const pol = (rr, a) => { const w = (a * Math.PI) / 180; return [cx + rr * Math.sin(w), cy - rr * Math.cos(w)]; };
  const striche = Array.from({ length: 11 }, (_, s) => {
    const a = -60 + s * 12, [x1, y1] = pol(r - (s % 5 ? 4 : 7), a), [x2, y2] = pol(r, a);
    return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`;
  }).join("");
  const bogen = (a1, a2, farbe) => {
    const [x1, y1] = pol(r + 2, a1), [x2, y2] = pol(r + 2, a2);
    return `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)} A${r + 2} ${r + 2} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}" stroke="${farbe}" stroke-width="3" fill="none"/>`;
  };
  return `
  <svg class="instrument" viewBox="0 0 120 78" data-k="${k}">
    <defs>
      <linearGradient id="im${k}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#f6e2a4"/><stop offset="0.32" stop-color="#c99a43"/>
        <stop offset="0.58" stop-color="#8a6020"/><stop offset="0.82" stop-color="#e4c172"/>
        <stop offset="1" stop-color="#a5772d"/>
      </linearGradient>
      <radialGradient id="if${k}" cx="0.45" cy="0.35" r="0.8">
        <stop offset="0" stop-color="#fdf8ea"/><stop offset="1" stop-color="#e2d2a8"/>
      </radialGradient>
    </defs>
    <rect x="2" y="2" width="116" height="74" rx="8" fill="url(#im${k})" stroke="#4a3410"/>
    <rect x="7" y="7" width="106" height="64" rx="5" fill="url(#if${k})" stroke="#3b2a10"/>
    ${bogen(-60, 24, "#7aa05a")}${bogen(24, 48, "#e0a23a")}${bogen(48, 60, "#c0392b")}
    <g class="skala">${striche}</g>
    <text class="itext" x="${cx}" y="${cy - 19}">${esc(titel)}</text>
    <text class="iwert" x="${cx}" y="${cy + 11}">–</text>
    <g class="nadel" style="transform-origin:${cx}px ${cy}px">
      <line x1="${cx}" y1="${cy + 4}" x2="${cx}" y2="${cy - r + 3}" stroke="#1a120a" stroke-width="1.6"/>
    </g>
    <circle cx="${cx}" cy="${cy}" r="4" fill="url(#im${k})" stroke="#4a3410"/>
  </svg>`;
}

const STIL = `
  :host { display: block; }
  ha-card { padding: 10px; overflow: hidden; }
  button { font: inherit; border: 0; background: none; padding: 0; color: inherit; cursor: pointer;
           -webkit-tap-highlight-color: transparent; }
  .tafel { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .platte { position: relative; border-radius: 12px; padding: 12px 18px 14px; background: ${MESSING};
            border: 1px solid #5a3d10; min-width: 0;
            box-shadow: inset 0 1px 0 rgba(255,243,196,0.8), inset 0 -2px 3px rgba(0,0,0,0.35); }
  .platte.breit { grid-column: 1 / -1; }
  .schraube { position: absolute; width: 9px; height: 9px; border-radius: 50%;
              background: radial-gradient(circle at 35% 35%, #fff3c4, #c99a43 45%, #5e400f);
              box-shadow: 0 1px 1px rgba(0,0,0,0.4); }
  .schraube::after { content: ""; position: absolute; left: 1px; right: 1px; top: 4px; height: 1px;
                     background: #4a3410; transform: rotate(40deg); }
  .lo { left: 6px; top: 6px; } .ro { right: 6px; top: 6px; }
  .lu { left: 6px; bottom: 6px; } .ru { right: 6px; bottom: 6px; }
  .kopf { display: flex; align-items: center; gap: 12px; margin: 0 4px 8px 8px; }
  .titel { padding: 3px 12px; border-radius: 4px; font-family: ${SERIF}; font-size: 11px;
           letter-spacing: 3px; color: #2a2118; background: radial-gradient(ellipse at 40% 30%, #fdf8ea, #e9dcb8);
           border: 1px solid #3b2a10; box-shadow: inset 0 1px 2px rgba(0,0,0,0.3); }
  .gravur { font-family: ${SERIF}; font-size: 12px; color: #2a1d0c; text-shadow: 0 1px 0 rgba(255,243,196,0.55); }
  .kopf .fehler { margin-left: auto; display: flex; align-items: center; gap: 6px; }
  .schild { display: block; max-width: 100%; padding: 2px 8px; border-radius: 3px; font-family: ${SERIF};
            font-size: 12px; color: #2a2118; background: radial-gradient(ellipse at 40% 30%, #fdf8ea, #e6d7b0);
            border: 1px solid #5a3d10; box-shadow: inset 0 1px 1px rgba(0,0,0,0.25);
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  /* Signallampen */
  .lampe { display: inline-block; width: 13px; height: 13px; border-radius: 50%; flex: none;
           background: radial-gradient(circle at 35% 30%, #6b5a48, #2a1f15 60%, #120c06);
           border: 2px solid #b8893a; box-shadow: inset 0 1px 2px rgba(0,0,0,0.6); transition: background 0.4s, box-shadow 0.4s; }
  .lampe.gruen { background: radial-gradient(circle at 35% 30%, #e6ffd0, #5fbf3a 45%, #1f5410);
                 box-shadow: 0 0 8px 2px rgba(110,220,70,0.55); }
  .lampe.warn { background: radial-gradient(circle at 35% 30%, #fff1c8, #f2a42a 45%, #7a4306);
                box-shadow: 0 0 9px 3px rgba(255,170,40,0.6); }
  .lampe.alarm { background: radial-gradient(circle at 35% 30%, #ffd2c4, #e2391c 45%, #6a0f04);
                 box-shadow: 0 0 10px 3px rgba(255,60,30,0.6); }
  .lampe.blink { animation: blinken 1s steps(2, jump-none) infinite; }
  @keyframes blinken { 50% { opacity: 0.35; } }

  /* Verschleiss */
  .reihe { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; gap: 6px; }
  .teil { display: flex; flex-direction: column; align-items: center; gap: 4px; min-width: 0; }
  .teil .lampe { margin-bottom: 1px; }
  .roehre { width: 46px; height: 124px; display: block; cursor: pointer; }
  .roehre .pegel { transition: y 0.8s ease-out, height 0.8s ease-out; }
  .roehre .spiegel { transition: y 0.8s ease-out; }
  .skala line { stroke: #2a2118; stroke-width: 1; }
  .prozent { font-family: ${SERIF}; font-size: 17px; color: #1e150a; text-shadow: 0 1px 0 rgba(255,243,196,0.6); line-height: 1; }
  .stunden { font-family: ${SERIF}; font-size: 11px; color: #3a2a12; height: 13px; }
  .teil .schild { font-size: 12px; }
  .quittung { display: flex; flex-direction: column; align-items: center; gap: 3px; margin-top: 2px; }
  .quittung .knopf { width: 26px; height: 26px; border-radius: 50%;
                     background: radial-gradient(circle at 35% 30%, #6a5a4c, #241911 50%, #0a0604);
                     border: 3px solid #c99a43; box-shadow: 0 2px 3px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.25);
                     transition: transform 0.08s; }
  .quittung:active .knopf { transform: translateY(2px); box-shadow: 0 1px 1px rgba(0,0,0,0.5); }
  .quittung .was { font-family: ${SERIF}; font-size: 9px; letter-spacing: 1.2px; color: #2a1d0c; }
  .quittung.frage .knopf { background: radial-gradient(circle at 35% 30%, #ff8a70, #b3200f 45%, #4a0a04);
                           animation: blinken 0.8s steps(2, jump-none) infinite; }
  .quittung.frage .was { color: #7a1505; font-weight: bold; }
  .quittung.ok .knopf { background: radial-gradient(circle at 35% 30%, #e6ffd0, #5fbf3a 45%, #1f5410); }

  /* Meldungen */
  .gruppe + .gruppe { margin-top: 10px; }
  .gruppe .gravur { display: block; margin: 0 0 5px 6px; letter-spacing: 1.5px; font-size: 11px; text-transform: uppercase; }
  .feld { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; padding: 8px; border-radius: 6px;
          background: #2a2016; box-shadow: inset 0 2px 4px rgba(0,0,0,0.6); }
  .meldung { display: flex; flex-direction: column; align-items: center; gap: 5px; padding: 6px 2px 5px;
             border-radius: 4px; min-width: 0; }
  .meldung .lampe { width: 22px; height: 22px; border-width: 3px; }
  .meldung .text { font-family: ${SERIF}; font-size: 11.5px; color: #e9dcb8; letter-spacing: 0.3px;
                   white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
  .meldung.an .text { color: #fff3d6; }
  .meldung.frage .text { color: #ff9a80; font-weight: bold; }
  .meldung.frage .lampe { animation: blinken 0.8s steps(2, jump-none) infinite; }

  /* System */
  .system { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 12px; align-items: start; }
  .zaehler { display: flex; flex-direction: column; align-items: center; gap: 5px; cursor: pointer; }
  .zaehler .kopfzeile { display: flex; align-items: center; gap: 6px; }
  .rollen { display: flex; gap: 2px; padding: 4px; border-radius: 5px; background: ${MESSING}; border: 1px solid #4a3410;
            box-shadow: 0 1px 2px rgba(0,0,0,0.4); }
  .rolle { width: 24px; height: 34px; display: flex; align-items: center; justify-content: center;
           font-family: ${SERIF}; font-size: 24px; color: #f3ead2; border-radius: 2px;
           background: linear-gradient(180deg, #050403 0%, #2b2520 22%, #3b342d 50%, #2b2520 78%, #050403 100%); }
  .liste { font-family: ${SERIF}; font-size: 11px; color: #2a1d0c; text-align: center; line-height: 1.35;
           max-width: 100%; overflow: hidden; }
  .liste div { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .emaille { padding: 8px 10px; border-radius: 6px; cursor: pointer; font-family: ${SERIF}; color: #f3ead2;
             background: radial-gradient(ellipse at 35% 25%, #2f4c78, #18294a 70%); border: 3px solid #c99a43;
             box-shadow: 0 2px 3px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(255,255,255,0.15); min-width: 0; }
  .emaille .zeile { display: flex; align-items: center; gap: 6px; font-size: 10px; letter-spacing: 1.5px; color: #c8d4e8; }
  .emaille .datum { font-size: 15px; margin: 2px 0 6px; white-space: nowrap; }
  .emaille .datum.klein { font-size: 13px; margin-bottom: 0; color: #dfe6f2; }
  .instrumente { grid-column: 1 / -1; display: flex; justify-content: space-around; gap: 10px; }
  .instrument { width: 132px; display: block; cursor: pointer; }
  .itext { font-family: ${SERIF}; font-size: 8px; letter-spacing: 1.5px; fill: #2a2118; text-anchor: middle; }
  .iwert { font-family: ${SERIF}; font-size: 10px; fill: #2a2118; text-anchor: middle; }
  .nadel { transition: transform 0.9s cubic-bezier(.3,1.4,.5,1); }
  .weg { opacity: 0.45; }

  /* Neustart */
  .platte.neustart { display: flex; align-items: center; gap: 14px; padding: 10px 18px; }
  .platte.neustart .kopf { margin: 0 0 0 8px; }
  .knoepfe { flex: 1; display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; gap: 8px; }
  .notaus { display: flex; align-items: center; gap: 8px; min-width: 0; text-align: left; }
  .notaus .kragen { flex: none; width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center;
                    justify-content: center; background: ${MESSING}; border: 1px solid #4a3410;
                    box-shadow: 0 2px 3px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,243,196,0.8); }
  .notaus .pilz { width: 26px; height: 26px; border-radius: 50%; transition: transform 0.08s;
                  background: radial-gradient(circle at 35% 30%, #ff8a70, #b3200f 45%, #4a0a04);
                  box-shadow: 0 2px 2px rgba(0,0,0,0.55); }
  .notaus:active .pilz { transform: translateY(2px) scale(0.96); box-shadow: 0 0 1px rgba(0,0,0,0.55); }
  .notaus.frage .pilz { animation: blinken 0.8s steps(2, jump-none) infinite; }
  .notaus.ok .pilz { background: radial-gradient(circle at 35% 30%, #e6ffd0, #5fbf3a 45%, #1f5410); }
  .notaus .texte { display: flex; flex-direction: column; min-width: 0; }
  .notaus .name { font-family: ${SERIF}; font-size: 13px; color: #1e150a; white-space: nowrap; overflow: hidden;
                  text-overflow: ellipsis; text-shadow: 0 1px 0 rgba(255,243,196,0.6); }
  .notaus .zuletzt { font-family: ${SERIF}; font-size: 10px; color: #3a2a12; white-space: nowrap; }
  .notaus.frage .zuletzt { color: #7a1505; font-weight: bold; letter-spacing: 1px; }

  /* Kleine iPads (mini 744, 10,2 Zoll 810 px hoch) - alles enger, damit die Seite ohne Scrollen passt */
  @media (max-height: 820px) {
    ha-card { padding: 8px; }
    .tafel { gap: 8px; }
    .platte { padding: 8px 14px 10px; }
    .kopf { margin-bottom: 4px; }
    .teil { gap: 2px; }
    .roehre { width: 34px; height: 92px; }
    .prozent { font-size: 15px; }
    .quittung { margin-top: 0; }
    .quittung .knopf { width: 22px; height: 22px; border-width: 2px; }
    .gruppe + .gruppe { margin-top: 5px; }
    .gruppe .gravur { margin-bottom: 3px; }
    .feld { padding: 5px; gap: 4px; }
    .meldung { padding: 3px 2px; gap: 3px; }
    .meldung .lampe { width: 17px; height: 17px; }
    .system { gap: 6px 10px; }
    .rolle { height: 28px; font-size: 20px; }
    .emaille { padding: 5px 9px; }
    .emaille .datum { font-size: 14px; margin: 1px 0 3px; }
    .instrument { width: 104px; }
    .platte.neustart { padding: 6px 14px; }
    .notaus .kragen { width: 32px; height: 32px; }
    .notaus .pilz { width: 22px; height: 22px; }
  }
  /* Schmale Bildschirme: Neustart-Namen nicht abschneiden */
  @media (max-width: 1150px) {
    .platte.neustart { gap: 8px; }
    .titel { letter-spacing: 2px; padding: 3px 9px; }
    .knoepfe { gap: 4px; }
    .notaus { gap: 5px; }
    .notaus .name { font-size: 12px; }
  }
`;

class RetroWartungCard extends HTMLElement {
  setConfig(config) {
    if (!Array.isArray(config.platten) || !config.platten.length) throw new Error("platten fehlt");
    this._config = { warnen_ab: 20, faellig_ab: 10, ...config };
    this._gebaut = false;
    this._fragen = {};
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._gebaut) this._bauen();
    this._aktualisieren();
  }

  getCardSize() { return 10; }

  disconnectedCallback() {
    Object.values(this._fragen).forEach(clearTimeout);
    this._fragen = {};
  }

  _st(id) { return id ? this._hass.states[id] : undefined; }

  _mehrInfo(id) {
    if (!id) return;
    const ev = new Event("hass-more-info", { bubbles: true, composed: true });
    ev.detail = { entityId: id };
    this.dispatchEvent(ev);
  }

  _bauen() {
    const root = this.shadowRoot || this.attachShadow({ mode: "open" });
    const platten = this._config.platten.map((p, i) => {
      const inhalt = p.typ === "verschleiss" ? this._htmlVerschleiss(p, i)
        : p.typ === "meldungen" ? this._htmlMeldungen(p, i)
        : p.typ === "system" ? this._htmlSystem(p, i)
        : p.typ === "neustart" ? this._htmlNeustart(p) : "";
      const fehler = p.fehler
        ? `<button class="fehler" data-info="${esc(p.fehler)}"><span class="lampe"></span><span class="gravur"></span></button>`
        : p.typ === "meldungen" ? `<span class="fehler status"><span class="lampe"></span><span class="gravur"></span></span>` : "";
      return `
        <div class="platte${p.breit || p.typ === "neustart" ? " breit" : ""}${p.typ === "neustart" ? " neustart" : ""}" data-p="${i}">
          <span class="schraube lo"></span><span class="schraube ro"></span>
          <span class="schraube lu"></span><span class="schraube ru"></span>
          <div class="kopf">${p.titel ? `<span class="titel">${esc(String(p.titel).toUpperCase())}</span>` : ""}${fehler}</div>
          ${inhalt}
        </div>`;
    }).join("");
    root.innerHTML = `<style>${STIL}</style><ha-card><div class="tafel">${platten}</div></ha-card>`;

    root.querySelectorAll("[data-info]").forEach((el) =>
      el.addEventListener("click", () => this._mehrInfo(el.dataset.info)));
    root.querySelectorAll(".quittung").forEach((el) =>
      el.addEventListener("click", () => this._quittieren(el)));
    root.querySelectorAll(".notaus").forEach((el) =>
      el.addEventListener("click", () => this._neustart(el)));
    root.querySelectorAll(".zaehler").forEach((el) =>
      el.addEventListener("click", () => this._mehrInfo(this._offeneUpdates()[0]?.entity_id)));
    this._gebaut = true;
  }

  _htmlVerschleiss(p, i) {
    const teile = (p.teile || []).map((t, k) => `
      <div class="teil" data-t="${k}">
        <span class="lampe"></span>
        <div data-info="${esc(t.entity)}">${roehre(`${i}_${k}`)}</div>
        <span class="prozent">–</span>
        <span class="stunden"></span>
        <button class="schild" data-info="${esc(t.entity)}">${esc(t.name || t.entity)}</button>
        ${t.reset ? `<button class="quittung" data-p="${i}" data-t="${k}"><span class="knopf"></span>
          <span class="was">${esc((t.knopf || "erledigt").toUpperCase())}</span></button>` : ""}
      </div>`).join("");
    return `<div class="reihe">${teile}</div>`;
  }

  _htmlMeldungen(p) {
    return (p.gruppen || []).map((g, gi) => `
      <div class="gruppe" data-g="${gi}">
        ${g.name ? `<span class="gravur">${esc(g.name)}</span>` : ""}
        <div class="feld">${(g.lampen || []).map((l, li) => `
          <button class="meldung" data-l="${li}"><span class="lampe"></span><span class="text">${esc(l.name)}</span></button>`).join("")}
        </div>
      </div>`).join("");
  }

  _htmlSystem(p, i) {
    return `
      <div class="system">
        <div class="zaehler">
          <div class="kopfzeile"><span class="lampe"></span><span class="gravur">UPDATES</span></div>
          <div class="rollen"><span class="rolle">0</span><span class="rolle">0</span></div>
          <div class="liste"></div>
        </div>
        <div class="emaille" data-info="${esc(p.backup_letztes || "")}">
          <div class="zeile"><span class="lampe"></span>LETZTE SICHERUNG</div>
          <div class="datum letzte">–</div>
          <div class="zeile">NÄCHSTE</div>
          <div class="datum klein naechste">–</div>
        </div>
        <div class="instrumente">
          ${p.cpu ? `<div data-info="${esc(p.cpu)}">${instrument(`c${i}`, "PROZESSOR")}</div>` : ""}
          ${p.ram ? `<div data-info="${esc(p.ram)}">${instrument(`r${i}`, "SPEICHER")}</div>` : ""}
        </div>
      </div>`;
  }

  _htmlNeustart(p) {
    return `<div class="knoepfe">${(p.knoepfe || []).map((k, ki) => `
      <button class="notaus" data-k="${ki}"><span class="kragen"><span class="pilz"></span></span>
        <span class="texte"><span class="name">${esc(k.name || k.entity || k.aktion)}</span><span class="zuletzt"></span></span>
      </button>`).join("")}</div>`;
  }

  // Wie beim Quittieren: erster Tipp fragt nach, zweiter loest aus
  _neustart(el) {
    const platte = this._config.platten[+el.closest(".platte").dataset.p];
    const k = platte.knoepfe[+el.dataset.k];
    const schluessel = `n${el.closest(".platte").dataset.p}_${el.dataset.k}`;
    clearTimeout(this._fragen[schluessel]);
    if (!el.classList.contains("frage")) {
      el.classList.add("frage");
      this._fragen[schluessel] = setTimeout(() => { el.classList.remove("frage"); this._aktualisieren(); }, 5000);
      this._aktualisieren();
      return;
    }
    el.classList.remove("frage");
    el.classList.add("ok");
    if (k.aktion) {
      const [domain, dienst] = k.aktion.split(".");
      this._hass.callService(domain, dienst, k.daten || {});
    } else {
      this._hass.callService(k.entity.split(".")[0], "press", { entity_id: k.entity });
    }
    this._fragen[schluessel] = setTimeout(() => { el.classList.remove("ok"); this._aktualisieren(); }, 5000);
    this._aktualisieren();
  }

  _neustartAnzeigen(el, p) {
    (p.knoepfe || []).forEach((k, ki) => {
      const knopf = el.querySelector(`.notaus[data-k="${ki}"]`);
      const st = this._st(k.entity);
      knopf.classList.toggle("weg", !k.aktion && (!st || st.state === "unavailable"));
      knopf.querySelector(".zuletzt").textContent = knopf.classList.contains("frage") ? "SICHER?"
        : knopf.classList.contains("ok") ? "ausgelöst"
        : k.aktion ? k.text || ""
        : this._kurz(st ? Date.parse(st.state) : NaN);
    });
  }

  // Zweistufig: erster Tipp fragt nach, zweiter drueckt den Reset-Button
  _quittieren(el) {
    const schluessel = `${el.dataset.p}_${el.dataset.t}`;
    const t = this._config.platten[+el.dataset.p].teile[+el.dataset.t];
    const was = el.querySelector(".was");
    const normal = (t.knopf || "erledigt").toUpperCase();
    if (!el.classList.contains("frage")) {
      el.classList.add("frage");
      was.textContent = "SICHER?";
      clearTimeout(this._fragen[schluessel]);
      this._fragen[schluessel] = setTimeout(() => {
        el.classList.remove("frage");
        was.textContent = normal;
      }, 5000);
      return;
    }
    clearTimeout(this._fragen[schluessel]);
    el.classList.remove("frage");
    el.classList.add("ok");
    was.textContent = "QUITTIERT";
    this._hass.callService("button", "press", { entity_id: t.reset });
    this._fragen[schluessel] = setTimeout(() => {
      el.classList.remove("ok");
      was.textContent = normal;
    }, 4000);
  }

  _offeneUpdates() {
    return Object.values(this._hass.states).filter((s) => s.entity_id.startsWith("update.") && s.state === "on");
  }

  _aktualisieren() {
    if (!this._hass || !this._gebaut) return;
    this._config.platten.forEach((p, i) => {
      const el = this.shadowRoot.querySelector(`.platte[data-p="${i}"]`);
      if (p.fehler) this._fehlerzeile(el, p.fehler);
      if (p.typ === "verschleiss") this._verschleiss(el, p);
      else if (p.typ === "meldungen") this._meldungen(el, p);
      else if (p.typ === "system") this._system(el, p);
      else if (p.typ === "neustart") this._neustartAnzeigen(el, p);
    });
  }

  _fehlerzeile(el, id) {
    const st = this._st(id);
    const ok = !st || ["no_error", "none", "ok", "0", "unknown", "unavailable"].includes(st.state);
    el.querySelector(".kopf .fehler .lampe").className = `lampe ${ok ? "gruen" : "alarm blink"}`;
    el.querySelector(".kopf .fehler .gravur").textContent = ok
      ? "kein Fehler" : `Fehler: ${String(st.state).replace(/_/g, " ")}`;
  }

  _verschleiss(el, p) {
    const { warnen_ab: warn, faellig_ab: faellig } = this._config;
    const { y, ih } = ROEHRE;
    (p.teile || []).forEach((t, k) => {
      const box = el.querySelector(`.teil[data-t="${k}"]`);
      const wert = zahl(this._st(t.entity));
      box.classList.toggle("weg", wert === null);
      const pr = wert === null ? 0 : Math.max(0, Math.min(100, wert));
      const [hell, dunkel] = fuellfarbe(pr, warn, faellig);
      const hoehe = (pr / 100) * ih;
      const pegel = box.querySelector(".pegel");
      pegel.setAttribute("y", y + ih - hoehe);
      pegel.setAttribute("height", hoehe);
      box.querySelector(".spiegel").setAttribute("y", y + ih - hoehe);
      box.querySelector(".spiegel").style.display = hoehe > 1 ? "" : "none";
      box.querySelectorAll(".f1").forEach((s) => s.setAttribute("stop-color", dunkel));
      box.querySelector(".f2").setAttribute("stop-color", hell);
      box.querySelector(".lampe").className = `lampe${wert === null ? "" : pr <= faellig ? " alarm" : pr <= warn ? " warn" : ""}`;
      box.querySelector(".prozent").textContent = wert === null ? "–" : `${Math.round(pr)} %`;
      const rest = zahl(this._st(t.rest));
      box.querySelector(".stunden").textContent = rest === null ? ""
        : pr <= faellig ? (t.knopf && /reinig/i.test(t.knopf) ? "reinigen" : "tauschen") : `noch ${Math.round(rest)} Std.`;
    });
  }

  _meldungen(el, p) {
    const aktiv = p.aktiv || AKTIV;
    const an = (id) => { const st = this._st(id); return !!st && aktiv.includes(st.state); };
    const gemerkt = (id) => { const st = this._st(id); return !!st && st.state === "on"; };
    let nWarn = 0, nAlarm = 0;
    (p.gruppen || []).forEach((g, gi) => {
      (g.lampen || []).forEach((l, li) => {
        const knopf = el.querySelector(`.gruppe[data-g="${gi}"] .meldung[data-l="${li}"]`);
        const alarm = an(l.alarm) || gemerkt(l.alarm_merker);
        const warn = an(l.warn) || gemerkt(l.warn_merker);
        if (alarm) nAlarm++; else if (warn) nWarn++;
        const ids = [l.alarm, l.warn].filter(Boolean);
        const weg = ids.length && ids.every((id) => { const st = this._st(id); return !st || st.state === "unavailable"; });
        // Quittierbar = mindestens ein gesetzter Merker
        knopf._merker = [l.alarm_merker, l.warn_merker].filter((id) => gemerkt(id));
        if (!knopf._merker.length && knopf.classList.contains("frage")) this._frageEnde(knopf);
        knopf.classList.toggle("an", alarm || warn);
        knopf.classList.toggle("weg", !!weg && !alarm && !warn);
        knopf.querySelector(".lampe").className = `lampe${alarm ? " alarm" : warn ? " warn" : ""}`;
        knopf.dataset.info = alarm ? (an(l.alarm) ? l.alarm : l.alarm_merker)
          : warn ? (an(l.warn) ? l.warn : l.warn_merker) : ids[0] || "";
        if (!knopf._klick) {
          knopf._klick = true;
          knopf._text = l.name;
          knopf.addEventListener("click", () => this._meldungTipp(knopf));
        }
      });
    });
    const status = el.querySelector(".kopf .status");
    if (status) {
      const n = nAlarm + nWarn;
      status.querySelector(".lampe").className = `lampe ${nAlarm ? "alarm" : nWarn ? "warn" : "gruen"}`;
      status.querySelector(".gravur").textContent = n === 0 ? "nichts fällig"
        : n === 1 ? "1 Meldung" : `${n} Meldungen`;
    }
  }

  // Ohne gesetzten Merker: more-info. Mit Merker: erster Tipp fragt, zweiter quittiert.
  _meldungTipp(knopf) {
    if (!knopf._merker || !knopf._merker.length) { this._mehrInfo(knopf.dataset.info); return; }
    if (!knopf.classList.contains("frage")) {
      knopf.classList.add("frage");
      knopf.querySelector(".text").textContent = "SICHER?";
      clearTimeout(knopf._frage);
      knopf._frage = setTimeout(() => this._frageEnde(knopf), 5000);
      return;
    }
    const ids = knopf._merker;
    this._frageEnde(knopf);
    this._hass.callService("input_boolean", "turn_off", { entity_id: ids });
  }

  _frageEnde(knopf) {
    clearTimeout(knopf._frage);
    knopf.classList.remove("frage");
    knopf.querySelector(".text").textContent = knopf._text || "";
  }

  _system(el, p) {
    // Updates
    const offen = this._offeneUpdates();
    const n = Math.min(99, offen.length);
    const rollen = el.querySelectorAll(".rolle");
    rollen[0].textContent = Math.floor(n / 10);
    rollen[1].textContent = n % 10;
    el.querySelector(".zaehler .lampe").className = `lampe ${n ? "warn" : "gruen"}`;
    const namen = offen.slice(0, 3).map((s) =>
      `<div>${esc(s.attributes.title || s.attributes.friendly_name || s.entity_id)}${
        s.attributes.latest_version ? ` ${esc(s.attributes.latest_version)}` : ""}</div>`);
    if (offen.length > 3) namen.push(`<div>und ${offen.length - 3} weitere</div>`);
    el.querySelector(".liste").innerHTML = n ? namen.join("") : "<div>alles aktuell</div>";

    // Backup
    const letzt = this._st(p.backup_letztes), naechst = this._st(p.backup_naechstes);
    const tLetzt = letzt ? Date.parse(letzt.state) : NaN, tNaechst = naechst ? Date.parse(naechst.state) : NaN;
    const maxTage = p.backup_max_tage || 8;
    const frisch = Number.isFinite(tLetzt) && Date.now() - tLetzt < maxTage * 86400000;
    el.querySelector(".emaille .lampe").className = `lampe ${frisch ? "gruen" : "alarm blink"}`;
    el.querySelector(".emaille .letzte").textContent = this._datum(tLetzt, true);
    el.querySelector(".emaille .naechste").textContent = this._datum(tNaechst, false);

    // Instrumente: -60 Grad = 0 %, +60 Grad = 100 %
    [["c", p.cpu], ["r", p.ram]].forEach(([kz, id]) => {
      if (!id) return;
      const svg = el.querySelector(`.instrument[data-k^="${kz}"]`);
      const wert = zahl(this._st(id));
      const pr = wert === null ? 0 : Math.max(0, Math.min(100, wert));
      svg.querySelector(".nadel").style.transform = `rotate(${-60 + pr * 1.2}deg)`;
      svg.querySelector(".iwert").textContent = wert === null ? "–" : `${Math.round(wert)} %`;
    });
  }

  // "02.10. 04:10" - fuer die schmalen Neustart-Schilder
  _kurz(t) {
    if (!Number.isFinite(t)) return "noch nie";
    const d = new Date(t);
    return `${d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })} ${
      d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`;
  }

  _datum(t, mitZeit) {
    if (!Number.isFinite(t)) return "–";
    const d = new Date(t);
    const tag = d.toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" });
    return mitZeit ? `${tag} · ${d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}` : tag;
  }
}

customElements.define("retro-wartung-card", RetroWartungCard);
window.customCards = window.customCards || [];
window.customCards.push({
  type: "retro-wartung-card",
  name: "Retro-Wartung",
  description: "Wartungstafel im Messing-Stil: Oelstandsglaeser fuer Verschleissteile, Meldeleuchten, Updates, Backup und Neustart",
});
