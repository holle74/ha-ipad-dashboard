/**
 * Betriebsmodus-Schalter fuer die Waermepumpe (02.10.2026).
 *
 * Segmentschalter mit gleitender Markierung in der Farbe des Modus, darunter
 * eine Erklaerung, was der Modus gerade tut, und eine Statuszeile der Avarma.
 * Modi, die die KI-Regelung abschalten (confirm: true), fragen vorher inline nach.
 *
 * Optionen:
 *   entity        (Pflicht) input_select mit den Modi, z.B. input_select.wp_betriebsmodus
 *   title         Ueberschrift, Standard "Betriebsmodus"
 *   status        Live-Werte im Kopf, alle optional:
 *                   { wp, vorlauf, vorlauf_soll, kompressor, aussen, betriebsart }
 *   modes         Ersetzt die eingebaute Modusliste (gleiche Felder wie MODI unten)
 *   design        "retro" = Messing-Steuertafel mit Bakelit-Drehschalter und Signallampen
 *                 (passend zu retro-gauge-card), sonst der moderne Segmentschalter
 *   stoerung      (nur retro) Fehlerregister der Avarma als Liste, je 16 Bit:
 *                 [E01-E16, E17-E32]. Jedes gesetzte Bit laesst die rote Lampe blinken.
 *   kompakt       (nur retro) true = flachere Tafel: Drehschalter fest 220 px breit, weniger
 *                 Innenabstand (09.10.2026, damit die Heizung-View aufs kleine iPad passt)
 *
 * Die Modusnamen muessen exakt den Optionen des input_select entsprechen.
 */

const MODI = [
  {
    name: "KI Modus",
    kurz: "KI",
    icon: "mdi:robot-outline",
    rgb: "255,159,67",
    animation: "ki-puls 2.4s ease-in-out infinite",
    text: "Die KI regelt Vorlauf, Kompressor und Lüfter – mit Wetterprognose und " +
      "Vorladen vor Frostnächten. Wird es knapp, geben Schlafzimmer, Keller, Flur " +
      "und Yoga Wärme ab.",
  },
  {
    name: "KI Übergangszeit",
    kurz: "Übergang",
    icon: "mdi:leaf",
    rgb: "46,213,115",
    animation: "blatt 3s ease-in-out infinite",
    text: "Die KI regelt sparsam: Sie schaltet ab, sobald das EG {eg_aus} erreicht, " +
      "startet nicht zwischen 22:00 und 08:30 Uhr und sperrt Takten. Nur das " +
      "Wohnzimmer gibt bei Engpass Wärme ab.",
  },
  {
    name: "Kühlen",
    kurz: "Kühlen",
    icon: "mdi:snowflake",
    rgb: "84,160,255",
    animation: "drehen 9s linear infinite",
    confirm: true,
    text: "Die Avarma kühlt, die KI hält still. Die Wassertemperatur stellst du an " +
      "der Avarma ein – es gibt keinen Taupunktschutz, also nicht zu kalt.",
  },
  {
    name: "Manuell",
    kurz: "Manuell",
    icon: "mdi:hand-back-right-outline",
    rgb: "164,176,190",
    animation: "winken 2.6s ease-in-out infinite",
    confirm: true,
    text: "Die Avarma regelt allein, wie früher. Lüfter auf Automatik, " +
      "Kompressor-Deckel 90 Hz – den Vorlauf stellst du selbst ein.",
  },
];

const STIL = `
  :host { display: block; }
  ha-card { padding: 14px 14px 12px; container-type: inline-size; overflow: hidden; }
  .kopf { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
  .kopf ha-icon { --mdc-icon-size: 22px; color: var(--secondary-text-color); }
  .titel { font-size: 16px; font-weight: 600; flex: 1; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; justify-content: flex-end; }
  .chip { font-size: 11px; padding: 3px 8px; border-radius: 10px;
          background: rgba(255,255,255,0.07); color: var(--secondary-text-color);
          white-space: nowrap; display: inline-flex; align-items: center; gap: 5px; }
  .punkt { width: 7px; height: 7px; border-radius: 50%; background: #747d8c; }
  .punkt.an { background: #2ed573; box-shadow: 0 0 6px #2ed573; }

  .schalter { position: relative; display: grid; grid-template-columns: repeat(4, 1fr);
              background: rgba(0,0,0,0.25); border-radius: 16px; padding: 4px;
              border: 1px solid rgba(255,255,255,0.06); }
  .marke { position: absolute; top: 4px; bottom: 4px; left: 4px;
           width: calc((100% - 8px) / 4); border-radius: 12px;
           transition: transform 0.45s cubic-bezier(.65,0,.35,1), background 0.45s, box-shadow 0.45s; }
  .seg { position: relative; z-index: 1; border: 0; background: none; cursor: pointer;
         color: var(--secondary-text-color); font: inherit; padding: 10px 4px 8px;
         display: flex; flex-direction: column; align-items: center; gap: 4px;
         border-radius: 12px; transition: color 0.3s; -webkit-tap-highlight-color: transparent; }
  .seg ha-icon { --mdc-icon-size: 24px; transition: transform 0.3s; }
  .seg:active ha-icon { transform: scale(0.88); }
  .seg .name { font-size: 12px; font-weight: 600; line-height: 1.1; text-align: center; }
  .seg.aktiv { color: #fff; }
  .seg.wartet { animation: warten 1s ease-in-out infinite; }

  .info { margin-top: 12px; padding: 12px; border-radius: 14px; position: relative;
          background: rgba(255,255,255,0.04); border-left: 3px solid var(--farbe, #888);
          transition: border-color 0.45s; min-height: 64px; }
  .info-kopf { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
  .info-kopf ha-icon { --mdc-icon-size: 20px; color: var(--farbe); }
  .info-name { font-weight: 600; color: var(--farbe); }
  .info-text { font-size: 13px; line-height: 1.45; color: var(--secondary-text-color); }
  .zeile { margin-top: 8px; font-size: 11px; color: var(--secondary-text-color); opacity: 0.8; }

  .frage { position: absolute; inset: 0; border-radius: 14px; padding: 12px;
           background: rgba(20,22,28,0.94); display: none; flex-direction: column;
           justify-content: center; gap: 10px; }
  .frage.offen { display: flex; animation: einblenden 0.2s ease-out; }
  .frage-text { font-size: 13px; line-height: 1.4; }
  .knoepfe { display: flex; gap: 8px; justify-content: flex-end; }
  .knoepfe button { border: 0; border-radius: 10px; padding: 7px 14px; font: inherit;
                    font-size: 13px; font-weight: 600; cursor: pointer; }
  .nein { background: rgba(255,255,255,0.1); color: var(--primary-text-color); }
  .ja { color: #fff; }

  @container (max-width: 330px) {
    .seg .name { font-size: 10px; }
    .seg ha-icon { --mdc-icon-size: 20px; }
    .chips { display: none; }
  }
  @keyframes ki-puls { 0%,100% { transform: scale(1); } 50% { transform: scale(1.14); } }
  @keyframes blatt { 0%,100% { transform: rotate(-10deg); } 50% { transform: rotate(10deg); } }
  @keyframes drehen { from { transform: rotate(0); } to { transform: rotate(360deg); } }
  @keyframes winken { 0%,60%,100% { transform: rotate(0); } 70% { transform: rotate(-14deg); } 85% { transform: rotate(10deg); } }
  @keyframes warten { 0%,100% { opacity: 1; } 50% { opacity: 0.45; } }
  @keyframes einblenden { from { opacity: 0; } to { opacity: 1; } }
`;

// Drehschalter: Mittelpunkt und Radius der Beschriftung im SVG (viewBox 260 x 190)
const DREH = { cx: 130, cy: 122, r: 97, spanne: 135 };

const STIL_KOMPAKT = `
  ha-card { padding: 6px; }
  .platte { padding: 8px 14px; grid-template-columns: 220px 1fr; gap: 12px; }
  .emaille { min-height: 0; padding: 9px 14px; }
  .kopfzeile { padding-bottom: 5px; margin-bottom: 6px; }
  .info-text { font-size: 13px; line-height: 1.4; }
  .zeile { margin-top: 6px; }
  .stellung { padding: 2px 3px; }
  .stellung ha-icon { --mdc-icon-size: 17px; }
  .stellung .name { font-size: 9px; letter-spacing: 0.8px; }
`;

const STIL_RETRO = `
  :host { display: block; }
  ha-card { padding: 10px; container-type: inline-size; overflow: hidden; }
  .platte { position: relative; border-radius: 12px; padding: 16px 18px;
            background: linear-gradient(135deg, #f6e2a4 0%, #c99a43 32%, #8a6020 58%, #e4c172 82%, #a5772d 100%);
            box-shadow: inset 0 1px 0 rgba(255,243,196,0.8), inset 0 -2px 3px rgba(0,0,0,0.35);
            border: 1px solid #5a3d10;
            display: grid; grid-template-columns: minmax(220px, 300px) 1fr; gap: 16px; align-items: center; }
  .schraube { position: absolute; width: 9px; height: 9px; border-radius: 50%;
              background: radial-gradient(circle at 35% 35%, #fff3c4, #c99a43 45%, #5e400f);
              box-shadow: 0 1px 1px rgba(0,0,0,0.4); }
  .schraube::after { content: ""; position: absolute; left: 1px; right: 1px; top: 4px; height: 1px;
                     background: #4a3410; transform: rotate(40deg); }
  .schraube.lo { left: 6px; top: 6px; } .schraube.ro { right: 6px; top: 6px; }
  .schraube.lu { left: 6px; bottom: 6px; } .schraube.ru { right: 6px; bottom: 6px; }

  .dreh { position: relative; width: 100%; aspect-ratio: 260 / 190; }
  .dreh svg { position: absolute; inset: 0; width: 100%; height: 100%; }
  .knopf { transform-box: view-box; transform-origin: ${DREH.cx}px ${DREH.cy}px;
           transition: transform 0.7s cubic-bezier(.3,1.5,.5,1); }
  .glut { transition: opacity 0.5s; }
  .stellung { position: absolute; transform: translate(-50%, -50%); border: 0; background: none;
              cursor: pointer; padding: 4px 6px; display: flex; flex-direction: column; align-items: center;
              gap: 1px; color: #3b2a10; font-family: Georgia, "Times New Roman", serif;
              -webkit-tap-highlight-color: transparent; }
  .stellung ha-icon { --mdc-icon-size: 20px; transition: transform 0.3s; }
  .stellung .name { font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; white-space: nowrap;
                    text-shadow: 0 1px 0 rgba(255,243,196,0.55); }
  .stellung.aktiv { color: #1b1206; }
  .stellung.aktiv .name { font-weight: bold; }
  .stellung:active ha-icon { transform: scale(0.85); }
  .stellung.wartet { animation: warten 1s ease-in-out infinite; }

  .emaille { position: relative; border-radius: 10px; padding: 12px 16px 12px; min-height: 150px;
             background: radial-gradient(ellipse at 40% 30%, #fdf8ea 0%, #f1e6c8 70%, #e0cfa4 100%);
             border: 1px solid #3b2a10; box-shadow: inset 0 2px 5px rgba(0,0,0,0.35);
             font-family: Georgia, "Times New Roman", serif; color: #2a2118; }
  .kopfzeile { display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
               border-bottom: 1px solid rgba(59,42,16,0.35); padding-bottom: 7px; margin-bottom: 9px; }
  .schild { font-size: 11px; letter-spacing: 3px; flex: 1; }
  .status { font-size: 11px; letter-spacing: 1px; text-transform: uppercase; color: #4a3b28;
            display: inline-flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .lampe-wp { width: 9px; height: 9px; border-radius: 50%; display: inline-block;
              background: radial-gradient(circle at 35% 35%, #8a8070, #2e2620 70%);
              box-shadow: inset 0 0 1px #000; }
  .lampe-wp.an { background: radial-gradient(circle at 35% 35%, #eaffd8 0 15%, #3fbf4f 45%, #1d6b26 100%);
                 box-shadow: 0 0 8px #3fbf4f; }
  .modus { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
  .juwel { width: 16px; height: 16px; border-radius: 50%; flex: none;
           background: radial-gradient(circle at 35% 35%, #fff 0 12%, var(--farbe, #888) 45%, rgba(0,0,0,0.55) 100%);
           box-shadow: 0 0 10px var(--farbe, transparent), inset 0 0 2px rgba(0,0,0,0.6);
           transition: background 0.45s, box-shadow 0.45s; }
  .info-name { font-size: 20px; letter-spacing: 0.5px; }
  .info-text { font-size: 14px; line-height: 1.5; color: #3d3224; }
  .zeile { margin-top: 9px; font-size: 11px; letter-spacing: 1px; text-transform: uppercase; color: #6b5a40; }

  .frage { position: absolute; inset: 0; border-radius: 10px; padding: 14px 16px;
           background: radial-gradient(ellipse at 40% 30%, #fdf8ea 0%, #efe2c0 100%);
           display: none; flex-direction: column; justify-content: center; gap: 12px; }
  .frage.offen { display: flex; animation: einblenden 0.2s ease-out; }
  .frage-text { font-size: 14px; line-height: 1.45; }
  .knoepfe { display: flex; gap: 10px; justify-content: flex-end; }
  .knoepfe button { border: 1px solid #5a3d10; border-radius: 8px; padding: 7px 16px; cursor: pointer;
                    font-family: Georgia, "Times New Roman", serif; font-size: 13px; letter-spacing: 1px;
                    text-transform: uppercase; box-shadow: inset 0 1px 0 rgba(255,255,255,0.5), 0 2px 3px rgba(0,0,0,0.3); }
  .knoepfe button:active { transform: translateY(1px); box-shadow: inset 0 1px 2px rgba(0,0,0,0.4); }
  .nein { background: linear-gradient(#f6e2a4, #c99a43); color: #2a1d0c; }
  .ja { color: #fff; text-shadow: 0 1px 1px rgba(0,0,0,0.4); }

  @container (max-width: 560px) {
    .platte { grid-template-columns: 1fr; }
    .dreh { max-width: 300px; justify-self: center; }
  }
  @keyframes ki-puls { 0%,100% { transform: scale(1); } 50% { transform: scale(1.14); } }
  @keyframes blatt { 0%,100% { transform: rotate(-10deg); } 50% { transform: rotate(10deg); } }
  @keyframes drehen { from { transform: rotate(0); } to { transform: rotate(360deg); } }
  @keyframes winken { 0%,60%,100% { transform: rotate(0); } 70% { transform: rotate(-14deg); } 85% { transform: rotate(10deg); } }
  @keyframes warten { 0%,100% { opacity: 1; } 50% { opacity: 0.45; } }
  @keyframes blinken { 0%,100% { opacity: 1; } 50% { opacity: 0.25; } }
  @keyframes einblenden { from { opacity: 0; } to { opacity: 1; } }
`;

class WpModusCard extends HTMLElement {
  setConfig(config) {
    if (!config.entity) throw new Error("entity fehlt");
    this._config = config;
    this._modi = config.modes || MODI;
    this._ziel = null;
    this._frage = null;
    this._gebaut = false;
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._gebaut) this._bauen();
    this._aktualisieren();
  }

  // Platzhalter im Beschreibungstext mit Live-Werten der Regelung fuellen (07.11.2026:
  // die Abschaltschwelle stand fest auf "21 °C" und war nach der Kalibrierung veraltet)
  _text(m) {
    const st = this._hass && this._hass.states["sensor.wp_regelung_status"];
    const egAus = st && st.attributes.eg_aus;
    const wert = egAus !== undefined && egAus !== null
      ? `${Number(egAus).toLocaleString("de-DE", { minimumFractionDigits: 1 })} °C`
      : "die Abschaltschwelle";
    return String(m.text || "").replace("{eg_aus}", wert);
  }

  getCardSize() { return 4; }
  getGridOptions() { return { columns: 12, min_columns: 6 }; }

  _bauen() {
    if (this._config.design === "retro") return this._bauenRetro();
    const root = this.shadowRoot || this.attachShadow({ mode: "open" });
    const segs = this._modi.map((m, i) => `
      <button class="seg" data-i="${i}" title="${m.name}">
        <ha-icon icon="${m.icon}"></ha-icon>
        <span class="name">${m.kurz || m.name}</span>
      </button>`).join("");
    root.innerHTML = `
      <style>${STIL}</style>
      <ha-card>
        <div class="kopf">
          <ha-icon icon="mdi:heat-pump"></ha-icon>
          <div class="titel">${this._config.title || "Betriebsmodus"}</div>
          <div class="chips"></div>
        </div>
        <div class="schalter"><div class="marke"></div>${segs}</div>
        <div class="info">
          <div class="info-kopf"><ha-icon></ha-icon><span class="info-name"></span></div>
          <div class="info-text"></div>
          <div class="zeile"></div>
          <div class="frage">
            <div class="frage-text"></div>
            <div class="knoepfe">
              <button class="nein">Abbrechen</button>
              <button class="ja">Umschalten</button>
            </div>
          </div>
        </div>
      </ha-card>`;
    root.querySelectorAll(".seg").forEach((b) =>
      b.addEventListener("click", () => this._tippen(Number(b.dataset.i))));
    root.querySelector(".nein").addEventListener("click", () => this._frageZu());
    root.querySelector(".ja").addEventListener("click", () => {
      const i = this._frage;
      this._frageZu();
      if (i !== null) this._setzen(i);
    });
    this._gebaut = true;
  }

  _winkel(i) {
    const n = this._modi.length;
    return n < 2 ? 0 : -DREH.spanne / 2 + (i * DREH.spanne) / (n - 1);
  }

  _polar(r, grad) {
    const a = (grad * Math.PI) / 180;
    return [DREH.cx + r * Math.sin(a), DREH.cy - r * Math.cos(a)];
  }

  _signal(art, x, farbe, text) {
    const y = 160;
    return `
      <g class="signal ${art}">
        <circle cx="${x}" cy="${y}" r="12" fill="url(#messing)" stroke="#4a3410" stroke-width="1"/>
        <circle class="glut-${art}" cx="${x}" cy="${y}" r="15" fill="${farbe}" filter="url(#weich)" opacity="0"/>
        <circle class="lampe-${art}" cx="${x}" cy="${y}" r="8" fill="#2e2620" stroke="#2a1d0c" stroke-width="1"/>
        <circle cx="${x - 2.6}" cy="${y - 2.8}" r="2.4" fill="#fff" opacity="0.55"/>
        <text class="text-${art}" x="${x}" y="${y + 24}" text-anchor="middle" fill="#2a1d0c"
              font-family="Georgia, 'Times New Roman', serif" font-size="9" letter-spacing="1.5">${text.toUpperCase()}</text>
      </g>`;
  }

  // Liefert die gesetzten Fehler als ["E15", ...], [] ohne Stoerung, null ohne Daten
  _stoerungen() {
    const liste = this._config.stoerung || [];
    if (!liste.length) return null;
    const codes = [];
    let daten = false;
    liste.forEach((id, k) => {
      const st = this._hass.states[id];
      const v = st ? parseInt(st.state, 10) : NaN;
      if (isNaN(v)) return;
      daten = true;
      for (let bit = 0; bit < 16; bit++) {
        if (v & (1 << bit)) codes.push("E" + String(k * 16 + bit + 1).padStart(2, "0"));
      }
    });
    return daten ? codes : null;
  }

  _bauenRetro() {
    const root = this.shadowRoot || this.attachShadow({ mode: "open" });
    const { cx, cy, r } = DREH;
    let marken = "";
    let knoepfe = "";
    this._modi.forEach((m, i) => {
      const w = this._winkel(i);
      const [x1, y1] = this._polar(56, w), [x2, y2] = this._polar(64, w);
      const [lx, ly] = this._polar(74, w);
      // aeussere Stellungen seitlich neben die Lampe, sonst liegt die Lampe auf der Schrift
      let [bx, by] = this._polar(r, w);
      let verschieben = "translate(-50%, -50%)";
      if (Math.abs(w) > 45) {
        bx = lx + (w < 0 ? -10 : 10);
        by = ly;
        verschieben = w < 0 ? "translate(-100%, -50%)" : "translate(0, -50%)";
      }
      marken += `
        <line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"
              stroke="#2a1d0c" stroke-width="2" stroke-linecap="round"/>
        <circle class="glut" data-i="${i}" cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="10"
                fill="rgb(${m.rgb})" filter="url(#weich)" opacity="0"/>
        <circle class="lampe" data-i="${i}" cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="5.5"
                fill="#2e2620" stroke="#4a3410" stroke-width="1"/>
        <circle cx="${(lx - 1.6).toFixed(1)}" cy="${(ly - 1.8).toFixed(1)}" r="1.6" fill="#fff" opacity="0.6"/>`;
      knoepfe += `
        <button class="stellung" data-i="${i}" title="${m.name}"
                style="left:${(bx / 260 * 100).toFixed(2)}%; top:${(by / 190 * 100).toFixed(2)}%; transform:${verschieben}">
          <ha-icon icon="${m.icon}"></ha-icon>
          <span class="name">${m.kurz || m.name}</span>
        </button>`;
    });
    root.innerHTML = `
      <style>${STIL_RETRO}${this._config.kompakt ? STIL_KOMPAKT : ""}</style>
      <ha-card>
        <div class="platte">
          <span class="schraube lo"></span><span class="schraube ro"></span>
          <span class="schraube lu"></span><span class="schraube ru"></span>
          <div class="dreh">
            <svg viewBox="0 0 260 190" aria-hidden="true">
              <defs>
                <linearGradient id="messing" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stop-color="#f6e2a4"/><stop offset="0.32" stop-color="#c99a43"/>
                  <stop offset="0.58" stop-color="#8a6020"/><stop offset="0.82" stop-color="#e4c172"/>
                  <stop offset="1" stop-color="#a5772d"/>
                </linearGradient>
                <radialGradient id="emaille" cx="0.4" cy="0.3" r="0.8">
                  <stop offset="0" stop-color="#fdf8ea"/><stop offset="0.7" stop-color="#f1e6c8"/>
                  <stop offset="1" stop-color="#d9c79c"/>
                </radialGradient>
                <radialGradient id="bakelit" cx="0.35" cy="0.3" r="0.8">
                  <stop offset="0" stop-color="#5a4c40"/><stop offset="0.5" stop-color="#241b14"/>
                  <stop offset="1" stop-color="#0d0907"/>
                </radialGradient>
                <filter id="weich" x="-100%" y="-100%" width="300%" height="300%">
                  <feGaussianBlur stdDeviation="3"/>
                </filter>
                <filter id="schatten" x="-30%" y="-30%" width="160%" height="160%">
                  <feDropShadow dx="2" dy="3" stdDeviation="2.5" flood-color="#000" flood-opacity="0.45"/>
                </filter>
              </defs>
              <circle cx="${cx}" cy="${cy}" r="62" fill="url(#emaille)" stroke="#3b2a10" stroke-width="1.2"/>
              ${marken}
              ${this._signal("an", 52, "#3fbf4f", "Betrieb")}
              ${this._signal("stoer", 208, "#e0362c", "Störung")}
              <g class="knopf">
                <g filter="url(#schatten)">
                  <circle cx="${cx}" cy="${cy}" r="47" fill="url(#messing)" stroke="#4a3410" stroke-width="1"/>
                  <polygon points="${cx},${cy - 55} ${cx - 6},${cy - 45} ${cx + 6},${cy - 45}" fill="#2a1d0c"/>
                  <circle cx="${cx}" cy="${cy}" r="38" fill="url(#bakelit)"/>
                  <circle cx="${cx}" cy="${cy}" r="36" fill="none" stroke="#000" stroke-opacity="0.45"
                          stroke-width="4" stroke-dasharray="2.2 2.6"/>
                  <rect x="${cx - 2.5}" y="${cy - 34}" width="5" height="26" rx="2.5" fill="#f3ead2"/>
                  <circle cx="${cx}" cy="${cy}" r="9" fill="url(#messing)" stroke="#4a3410" stroke-width="0.8"/>
                </g>
              </g>
            </svg>
            ${knoepfe}
          </div>
          <div class="emaille">
            <div class="kopfzeile">
              <span class="schild">${String(this._config.title || "Betriebsmodus").toUpperCase()}</span>
              <span class="status"></span>
            </div>
            <div class="modus"><span class="juwel"></span><span class="info-name"></span></div>
            <div class="info-text"></div>
            <div class="zeile"></div>
            <div class="frage">
              <div class="frage-text"></div>
              <div class="knoepfe">
                <button class="nein">Abbrechen</button>
                <button class="ja">Umschalten</button>
              </div>
            </div>
          </div>
        </div>
      </ha-card>`;
    root.querySelectorAll(".stellung").forEach((b) =>
      b.addEventListener("click", () => this._tippen(Number(b.dataset.i))));
    root.querySelector(".nein").addEventListener("click", () => this._frageZu());
    root.querySelector(".ja").addEventListener("click", () => {
      const i = this._frage;
      this._frageZu();
      if (i !== null) this._setzen(i);
    });
    this._gebaut = true;
  }

  _aktualisierenRetro(zeige, m) {
    const root = this.shadowRoot;
    const wartet = this._ziel !== null;
    root.querySelectorAll(".stellung").forEach((b, i) => {
      const aktiv = i === zeige;
      b.classList.toggle("aktiv", aktiv);
      b.classList.toggle("wartet", aktiv && wartet);
      b.querySelector("ha-icon").style.animation = aktiv && m ? m.animation : "none";
    });
    root.querySelectorAll(".lampe").forEach((l) => {
      const i = Number(l.dataset.i);
      l.setAttribute("fill", i === zeige ? `rgb(${this._modi[i].rgb})` : "#2e2620");
      l.style.animation = i === zeige && wartet ? "blinken 0.8s ease-in-out infinite" : "none";
    });
    root.querySelectorAll(".glut").forEach((g) => {
      g.setAttribute("opacity", Number(g.dataset.i) === zeige ? "0.85" : "0");
    });
    const knopf = root.querySelector(".knopf");
    if (m) {
      knopf.style.transform = `rotate(${this._winkel(zeige)}deg)`;
      root.querySelector(".emaille").style.setProperty("--farbe", `rgb(${m.rgb})`);
      root.querySelector(".info-name").textContent = m.name + (wartet ? " – wird umgeschaltet …" : "");
      root.querySelector(".info-text").textContent = this._text(m);
    } else {
      root.querySelector(".emaille").style.setProperty("--farbe", "transparent");
      root.querySelector(".info-name").textContent = "Unbekannter Modus";
      root.querySelector(".info-text").textContent =
        `${this._config.entity} ist nicht verfügbar oder hat einen unbekannten Wert.`;
    }

    const s = this._config.status || {};
    const wp = s.wp && this._hass.states[s.wp];
    const an = !!wp && wp.state === "on";
    const offline = !!wp && (wp.state === "unavailable" || wp.state === "unknown");
    const codes = this._stoerungen();
    const stoer = offline || (codes !== null && codes.length > 0);
    root.querySelector(".lampe-an").setAttribute("fill", an ? "#3fbf4f" : "#2e2620");
    root.querySelector(".glut-an").setAttribute("opacity", an ? "0.9" : "0");
    const lr = root.querySelector(".lampe-stoer"), gr = root.querySelector(".glut-stoer");
    lr.setAttribute("fill", stoer ? "#e0362c" : "#2e2620");
    gr.setAttribute("opacity", stoer ? "0.9" : "0");
    lr.style.animation = gr.style.animation = stoer ? "blinken 1s ease-in-out infinite" : "none";
    root.querySelector(".text-stoer").textContent =
      offline ? "OFFLINE" : stoer ? codes.join(" ") : "STÖRUNG";

    const teile = [];
    if (wp) {
      teile.push(`<span class="lampe-wp ${wp.state === "on" ? "an" : ""}"></span>WP ${wp.state === "on" ? "an" : "aus"}`);
    }
    const vl = this._wert(s.vorlauf, 1, "°");
    const vls = this._wert(s.vorlauf_soll, 0, "°");
    if (vl) teile.push(`VL ${vl}${vls ? " → " + vls : ""}`);
    const at = this._wert(s.aussen, 1, "°");
    if (at) teile.push(`Außen ${at}`);
    root.querySelector(".status").innerHTML = teile.join(" <span>·</span> ");

    const zeile = [];
    const ba = s.betriebsart && this._hass.states[s.betriebsart];
    if (ba) zeile.push(`Avarma: ${ba.state}`);
    const hz = this._wert(s.kompressor, 0, " Hz");
    if (hz) zeile.push(`Kompressor ${hz}`);
    if (offline) zeile.push("Keine Verbindung zur Avarma");
    else if (stoer) zeile.push(`Störung ${codes.join(", ")}`);
    root.querySelector(".zeile").textContent = zeile.join(" · ");
  }

  _index() {
    const st = this._hass.states[this._config.entity];
    return st ? this._modi.findIndex((m) => m.name === st.state) : -1;
  }

  _tippen(i) {
    if (i === this._index()) return;
    const aktuell = this._modi[this._index()];
    // Nachfragen nur, wenn die KI dadurch abgeschaltet wird.
    if (this._modi[i].confirm && !(aktuell && aktuell.confirm)) {
      this._frageAuf(i);
    } else {
      this._setzen(i);
    }
  }

  _frageAuf(i) {
    const m = this._modi[i];
    const root = this.shadowRoot;
    this._frage = i;
    root.querySelector(".frage-text").textContent =
      `KI-Regelung ausschalten und auf „${m.name}“ wechseln? ${this._text(m)}`;
    const ja = root.querySelector(".ja");
    ja.style.background = `rgb(${m.rgb})`;
    root.querySelector(".frage").classList.add("offen");
    clearTimeout(this._frageTimer);
    this._frageTimer = setTimeout(() => this._frageZu(), 12000);
  }

  _frageZu() {
    this._frage = null;
    clearTimeout(this._frageTimer);
    this.shadowRoot.querySelector(".frage").classList.remove("offen");
  }

  _setzen(i) {
    this._ziel = i;
    clearTimeout(this._zielTimer);
    this._zielTimer = setTimeout(() => { this._ziel = null; this._aktualisieren(); }, 10000);
    this._hass.callService("input_select", "select_option", {
      entity_id: this._config.entity,
      option: this._modi[i].name,
    });
    this._aktualisieren();
  }

  _wert(id, nachkomma = 0, einheit = "") {
    const st = id && this._hass.states[id];
    if (!st || isNaN(parseFloat(st.state))) return null;
    return parseFloat(st.state).toLocaleString("de-DE", {
      minimumFractionDigits: nachkomma, maximumFractionDigits: nachkomma,
    }) + einheit;
  }

  _aktualisieren() {
    if (!this._hass || !this._gebaut) return;
    const root = this.shadowRoot;
    const idx = this._index();
    if (this._ziel !== null && this._ziel === idx) this._ziel = null;
    const zeige = this._ziel !== null ? this._ziel : idx;
    const m = this._modi[zeige];
    if (this._config.design === "retro") return this._aktualisierenRetro(zeige, m);

    const marke = root.querySelector(".marke");
    root.querySelectorAll(".seg").forEach((b, i) => {
      const aktiv = i === zeige;
      b.classList.toggle("aktiv", aktiv);
      b.classList.toggle("wartet", aktiv && this._ziel !== null);
      b.querySelector("ha-icon").style.animation = aktiv && m ? m.animation : "none";
    });
    if (m) {
      marke.style.opacity = "1";
      marke.style.transform = `translateX(${zeige * 100}%)`;
      marke.style.background = `linear-gradient(135deg, rgba(${m.rgb},0.85), rgba(${m.rgb},0.45))`;
      marke.style.boxShadow = `0 2px 14px rgba(${m.rgb},0.45)`;
      root.querySelector(".info").style.setProperty("--farbe", `rgb(${m.rgb})`);
      root.querySelector(".info-kopf ha-icon").setAttribute("icon", m.icon);
      root.querySelector(".info-name").textContent =
        m.name + (this._ziel !== null ? " – wird umgeschaltet …" : "");
      root.querySelector(".info-text").textContent = this._text(m);
    } else {
      marke.style.opacity = "0";
      root.querySelector(".info-name").textContent = "Unbekannter Modus";
      root.querySelector(".info-text").textContent =
        `${this._config.entity} ist nicht verfügbar oder hat einen unbekannten Wert.`;
    }

    // Kopf-Chips und Statuszeile
    const s = this._config.status || {};
    const chips = [];
    const wp = s.wp && this._hass.states[s.wp];
    if (wp) {
      chips.push(`<span class="chip"><span class="punkt ${wp.state === "on" ? "an" : ""}"></span>WP ${wp.state === "on" ? "an" : "aus"}</span>`);
    }
    const vl = this._wert(s.vorlauf, 1, "°");
    const vls = this._wert(s.vorlauf_soll, 0, "°");
    if (vl) chips.push(`<span class="chip">VL ${vl}${vls ? " → " + vls : ""}</span>`);
    const at = this._wert(s.aussen, 1, "°");
    if (at) chips.push(`<span class="chip">Außen ${at}</span>`);
    root.querySelector(".chips").innerHTML = chips.join("");

    const teile = [];
    const ba = s.betriebsart && this._hass.states[s.betriebsart];
    if (ba) teile.push(`Avarma: ${ba.state}`);
    const hz = this._wert(s.kompressor, 0, " Hz");
    if (hz) teile.push(`Kompressor ${hz}`);
    root.querySelector(".zeile").textContent = teile.join(" · ");
  }
}

customElements.define("wp-modus-card", WpModusCard);
window.customCards = window.customCards || [];
window.customCards.push({
  type: "wp-modus-card",
  name: "WP Betriebsmodus",
  description: "Modus-Schalter KI / Übergangszeit / Kühlen / Manuell für die Wärmepumpe",
});
