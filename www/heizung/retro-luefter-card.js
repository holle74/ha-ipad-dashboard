/**
 * Retro-Luefter der Avarma-Ausseneinheit im Messing-Stil (09.10.2026).
 *
 * Breite Messingtafel mit drei Feldern:
 *   links   Luefterrad hinter Schutzgitter. Dreht sich mit der gemeldeten Drehzahl
 *           (sichtbar verlangsamt), laeuft traege an und aus. Unter 0 °C
 *           Lamellentemperatur legt sich Reif auf das Gitter.
 *   mitte   Drehzahlskala: schwarzer Zeiger = Ist, roter = Soll, Strich = Maximum.
 *   rechts  Thermometer fuer die Lamellen-(Verdampfer-)temperatur, daneben Umgebung
 *           und die Differenz Umgebung - Lamelle (daran macht die Avarma den Abtaustart fest).
 *
 * Optionen:
 *   entity            (Pflicht) Drehzahl in RPM, z.B. sensor.esphome_web_avarma_lufter_1_drehzahl
 *   setpoint_entity   Soll-Drehzahl (roter Zeiger), optional
 *   max_entity        Maximaldrehzahl der Anlage (Strich auf der Skala), optional
 *   lamelle_entity    Lamellen-/Verdampfertemperatur, optional
 *   umgebung_entity   Umgebungstemperatur am Geraet, optional
 *   online_entity     Verbindungssensor (z.B. Modbus online); "off" -> Lampe rot, Werte gedimmt
 *   abtau_entity      Betriebsstatus der Anlage; ist abtau_bit gesetzt, blinkt im Gravurschild
 *                     neben dem Titel "ABTAUUNG" (09.10.2026)
 *   abtau_bit         Bitmaske fuer "Abtauen", Standard 16 (Avarma-Betriebsstatus)
 *   max               Skalenende Drehzahl, Standard 1000
 *   temp_min/temp_max Thermometerbereich, Standard -20 / 30
 *   title             Gravur ueber dem Luefter, Standard "Verdampfer-Luefter"
 *   maker             kleine Gravur, optional
 *
 * Tipp auf ein Feld oeffnet den Verlauf (more-info) des jeweiligen Werts.
 */

const LCX = 118;   // Mitte des Luefters im eigenen Zeichenraum (r 100)
const LCY = 112;
// Seit 09.10.2026 flachere Tafel (840 x 176) fuer das kleine iPad: der Luefter wird als Ganzes
// auf 78 % verkleinert und nach (100, 88) geschoben, seine Innenmasse bleiben unveraendert.
const LUEFTER_LAGE = `translate(100 88) scale(0.78) translate(${-LCX} ${-LCY})`;
const SKALA_X0 = 222;
const SKALA_X1 = 494;
const SKALA_Y = 122;
const TH_X = 572;  // Thermometerroehre
const TH_Y0 = 28;
const TH_Y1 = 136;

// Drehzahl -> sichtbare Winkelgeschwindigkeit (Grad/s). Echt waeren 900 RPM = 5400 °/s,
// das flimmert nur. 900 RPM ergeben hier ~1,7 Umdrehungen/s.
const SICHT_FAKTOR = 2 / 3;
const TRAEGHEIT_S = 2.2;

const STIL = `
  :host { display: block; }
  ha-card { padding: 6px 8px; overflow: hidden; -webkit-tap-highlight-color: transparent; }
  svg { display: block; width: 100%; height: auto; }
  .feld { cursor: pointer; }
  .schrift { font-family: Georgia, "Times New Roman", serif; fill: #2a2118; }
  .gravur { font-size: 9px; letter-spacing: 3px; text-anchor: middle; fill: #3d2a0c; }
  .gravur-klein { font-size: 6px; letter-spacing: 2px; text-anchor: middle; fill: #5a4320; }
  .titel { font-size: 11px; letter-spacing: 3px; text-anchor: middle; }
  .ziffer { font-size: 12px; text-anchor: middle; }
  .ziffer-klein { font-size: 10px; text-anchor: end; dominant-baseline: central; }
  .gross { font-size: 30px; text-anchor: middle; }
  .einheit { font-size: 12px; font-style: italic; text-anchor: middle; }
  .wert { font-size: 13px; }
  .wert-gross { font-size: 19px; }
  .marke { transition: transform 1.6s cubic-bezier(.3,1.45,.55,1); }
  .quecksilber { transition: fill 1.6s; }
  .reif { transition: opacity 3s; }
  .gedimmt { opacity: 0.45; transition: opacity 0.6s; }
  .lampe-aus { opacity: 0.25; }
  .blinkt { animation: blinken 1.2s steps(2, jump-none) infinite; }
  .abtau-text { font-size: 8.5px; letter-spacing: 2px; fill: #ffc160; font-weight: bold; }
  .abtau { animation: glimmen 1.6s ease-in-out infinite; }
  @keyframes glimmen { 0%,100% { opacity: 1; } 50% { opacity: 0.6; } }
  @keyframes blinken { from { opacity: 1; } to { opacity: 0.2; } }
`;

function fluegel() {
  // fuenf geschwungene Fluegel, Spitze in Drehrichtung vorgezogen
  let s = "";
  for (let i = 0; i < 5; i++) {
    s += `<path transform="rotate(${i * 72} ${LCX} ${LCY})"
            d="M${LCX + 6},${LCY - 12}
               C${LCX + 30},${LCY - 30} ${LCX + 66},${LCY - 36} ${LCX + 78},${LCY - 14}
               C${LCX + 82},${LCY - 4} ${LCX + 70},${LCY + 6} ${LCX + 52},${LCY + 6}
               C${LCX + 34},${LCY + 6} ${LCX + 18},${LCY + 2} ${LCX + 10},${LCY + 2} Z"
            fill="url(#fluegel)" stroke="#2b2620" stroke-width="0.8"/>`;
  }
  return s;
}

function gitter() {
  let s = "";
  for (const r of [24, 40, 56, 72, 86]) {
    s += `<circle cx="${LCX}" cy="${LCY}" r="${r}" fill="none" stroke="url(#messing)"
            stroke-width="${r === 86 ? 2.4 : 1.6}"/>`;
  }
  for (let i = 0; i < 6; i++) {
    const a = (i * 60 + 15) * Math.PI / 180;
    const x0 = LCX + 14 * Math.cos(a), y0 = LCY + 14 * Math.sin(a);
    const x1 = LCX + 86 * Math.cos(a), y1 = LCY + 86 * Math.sin(a);
    s += `<line x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}"
            stroke="url(#messing)" stroke-width="2"/>`;
  }
  return s;
}

function schraube(x, y, winkel) {
  const a = winkel * Math.PI / 180, dx = 2.4 * Math.cos(a), dy = 2.4 * Math.sin(a);
  return `<circle cx="${x}" cy="${y}" r="3.4" fill="url(#nabe)" stroke="#4a3410" stroke-width="0.5"/>
          <line x1="${(x - dx).toFixed(1)}" y1="${(y - dy).toFixed(1)}" x2="${(x + dx).toFixed(1)}"
                y2="${(y + dy).toFixed(1)}" stroke="#4a3410" stroke-width="0.8"/>`;
}

class RetroLuefterCard extends HTMLElement {
  setConfig(config) {
    if (!config.entity) throw new Error("entity fehlt");
    this._config = {
      max: 1000, temp_min: -20, temp_max: 30, abtau_bit: 16,
      title: "Verdampfer-Lüfter",
      ...config,
    };
    this._gebaut = false;
    this._letzte = null;
    this._winkel = 0;
    this._tempo = 0;      // aktuelle sichtbare Winkelgeschwindigkeit
    this._zielTempo = 0;
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._gebaut) this._bauen();
    this._aktualisieren();
  }

  getCardSize() { return 4; }
  getGridOptions() { return { columns: 12, min_columns: 8 }; }

  connectedCallback() {
    this._laeuft = true;
    this._antreiben();
  }

  disconnectedCallback() {
    this._laeuft = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
  }

  // ---------- Aufbau ----------

  _skala() {
    const max = this._config.max;
    const schritt = max <= 1000 ? 50 : 100;
    const gross = schritt * 4;
    let s = "";
    for (let v = 0; v <= max + 0.01; v += schritt) {
      const x = this._x(v);
      const g = v % gross === 0, m = !g && v % (gross / 2) === 0;
      const len = g ? 13 : m ? 9 : 5;
      s += `<line x1="${x.toFixed(1)}" y1="${SKALA_Y}" x2="${x.toFixed(1)}" y2="${SKALA_Y - len}"
              stroke="#2a2118" stroke-width="${g ? 2 : m ? 1.3 : 0.8}" stroke-linecap="round"/>`;
      if (g) s += `<text class="schrift ziffer" x="${x.toFixed(1)}" y="${SKALA_Y - 18}">${v}</text>`;
    }
    s += `<line x1="${SKALA_X0}" y1="${SKALA_Y}" x2="${SKALA_X1}" y2="${SKALA_Y}" stroke="#2a2118" stroke-width="1.2"/>`;
    return s;
  }

  _thermoSkala() {
    const { temp_min, temp_max } = this._config;
    let s = "";
    for (let t = Math.ceil(temp_min / 2) * 2; t <= temp_max; t += 2) {
      const y = this._ty(t);
      const g = t % 10 === 0;
      s += `<line x1="${TH_X - 8}" y1="${y.toFixed(1)}" x2="${TH_X - (g ? 17 : 12)}" y2="${y.toFixed(1)}"
              stroke="#2a2118" stroke-width="${g ? 1.6 : 0.8}"/>`;
      if (g) s += `<text class="schrift ziffer-klein" x="${TH_X - 20}" y="${y.toFixed(1)}">${t}</text>`;
    }
    // Frostlinie
    const y0 = this._ty(0);
    s += `<line x1="${TH_X - 7}" y1="${y0.toFixed(1)}" x2="${TH_X + 7}" y2="${y0.toFixed(1)}"
            stroke="#2c5f8d" stroke-width="1" stroke-dasharray="2 1.5"/>`;
    return s;
  }

  _bauen() {
    const c = this._config;
    const root = this.shadowRoot || this.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>${STIL}</style>
      <ha-card>
        <svg viewBox="0 0 840 176" role="img" aria-label="${c.title}">
          <defs>
            <linearGradient id="messing" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stop-color="#f6e2a4"/>
              <stop offset="0.32" stop-color="#c99a43"/>
              <stop offset="0.58" stop-color="#8a6020"/>
              <stop offset="0.82" stop-color="#e4c172"/>
              <stop offset="1" stop-color="#a5772d"/>
            </linearGradient>
            <linearGradient id="platte" x1="0" y1="0" x2="0.15" y2="1">
              <stop offset="0" stop-color="#e9cf8a"/>
              <stop offset="0.45" stop-color="#c39443"/>
              <stop offset="1" stop-color="#9c7130"/>
            </linearGradient>
            <radialGradient id="blatt" cx="0.5" cy="0.35" r="0.8">
              <stop offset="0" stop-color="#fdf8ea"/>
              <stop offset="0.7" stop-color="#f1e6c8"/>
              <stop offset="1" stop-color="#d9c79c"/>
            </radialGradient>
            <radialGradient id="nabe" cx="0.35" cy="0.35" r="0.7">
              <stop offset="0" stop-color="#fff3c4"/>
              <stop offset="0.45" stop-color="#c99a43"/>
              <stop offset="1" stop-color="#5e400f"/>
            </radialGradient>
            <radialGradient id="schacht" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stop-color="#2b2620"/>
              <stop offset="0.8" stop-color="#16130f"/>
              <stop offset="1" stop-color="#0b0907"/>
            </radialGradient>
            <linearGradient id="fluegel" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stop-color="#d9d4c8"/>
              <stop offset="0.5" stop-color="#9d978a"/>
              <stop offset="1" stop-color="#5f5a50"/>
            </linearGradient>
            <radialGradient id="reif" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0.15" stop-color="#eaf6ff" stop-opacity="0.15"/>
              <stop offset="0.75" stop-color="#d6ecfb" stop-opacity="0.65"/>
              <stop offset="1" stop-color="#ffffff" stop-opacity="0.9"/>
            </radialGradient>
            <radialGradient id="lampe-gruen" cx="0.35" cy="0.35" r="0.7">
              <stop offset="0" stop-color="#d8ffd0"/><stop offset="0.5" stop-color="#3fae3a"/>
              <stop offset="1" stop-color="#14501a"/>
            </radialGradient>
            <radialGradient id="lampe-rot" cx="0.35" cy="0.35" r="0.7">
              <stop offset="0" stop-color="#ffd6cc"/><stop offset="0.5" stop-color="#d23a22"/>
              <stop offset="1" stop-color="#5e130a"/>
            </radialGradient>
            <filter id="hof" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="2"/></filter>
            <radialGradient id="lampe-abtau" cx="0.35" cy="0.35" r="0.7">
              <stop offset="0" stop-color="#fff0c8"/><stop offset="0.5" stop-color="#f0962a"/>
              <stop offset="1" stop-color="#6a3a08"/>
            </radialGradient>
            <linearGradient id="glas" x1="0" y1="0" x2="0.7" y2="1">
              <stop offset="0" stop-color="#fff" stop-opacity="0.55"/>
              <stop offset="1" stop-color="#fff" stop-opacity="0"/>
            </linearGradient>
            <filter id="schatten" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="1.4" dy="2" stdDeviation="1.2" flood-color="#000" flood-opacity="0.35"/>
            </filter>
            <filter id="innen" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="1.5" stdDeviation="2" flood-color="#000" flood-opacity="0.5"/>
            </filter>
            <clipPath id="schacht-clip"><circle cx="${LCX}" cy="${LCY}" r="86"/></clipPath>
          </defs>

          <!-- Messingtafel -->
          <rect x="3" y="3" width="834" height="170" rx="12" fill="url(#platte)" stroke="#5a3d10" stroke-width="1"/>
          <rect x="7" y="7" width="826" height="162" rx="9" fill="none" stroke="#fff3c4" stroke-width="0.7" opacity="0.55"/>
          ${schraube(18, 18, 30)}${schraube(822, 18, -20)}${schraube(18, 158, 75)}${schraube(822, 158, 10)}

          <!-- Feld 1: Luefter -->
          <g class="feld" data-entity="${c.entity}" transform="${LUEFTER_LAGE}">
            <circle cx="${LCX}" cy="${LCY}" r="100" fill="url(#messing)" stroke="#4a3410" stroke-width="1"
                    filter="url(#schatten)"/>
            <circle cx="${LCX}" cy="${LCY}" r="93" fill="none" stroke="#fff3c4" stroke-width="0.7" opacity="0.6"/>
            <circle cx="${LCX}" cy="${LCY}" r="88" fill="url(#schacht)" stroke="#3b2a10" stroke-width="1.2"/>
            <g clip-path="url(#schacht-clip)">
              <g class="rad">${fluegel()}</g>
              <circle class="unschaerfe" cx="${LCX}" cy="${LCY}" r="80" fill="#8f897d" opacity="0"/>
            </g>
            <circle cx="${LCX}" cy="${LCY}" r="15" fill="url(#nabe)" stroke="#4a3410" stroke-width="0.8"/>
            <circle cx="${LCX}" cy="${LCY}" r="3" fill="#4a3410"/>
            ${gitter()}
            <circle class="reif" cx="${LCX}" cy="${LCY}" r="88" fill="url(#reif)" opacity="0" pointer-events="none"/>
            ${[45, 135, 225, 315].map((w) => {
              const a = w * Math.PI / 180;
              return schraube(+(LCX + 95 * Math.cos(a)).toFixed(1), +(LCY + 95 * Math.sin(a)).toFixed(1), w);
            }).join("")}
            <!-- Glasreflex -->
            <path d="M40,80 A86,86 0 0 1 150,28 Q90,40 40,80 Z" fill="url(#glas)" opacity="0.45" pointer-events="none"/>
          </g>

          <!-- Gravurschild -->
          <rect x="196" y="9" width="324" height="18" rx="3" fill="#2a2118" opacity="0.88"/>
          <text class="schrift gravur titel-schild" x="358" y="21.5" style="fill:#e9cf8a">${String(c.title).toUpperCase()}</text>
          <g class="abtau" style="display:none">
            <circle cx="444" cy="18" r="7" fill="#f0962a" opacity="0.45" filter="url(#hof)"/>
            <circle cx="444" cy="18" r="3.6" fill="url(#lampe-abtau)" stroke="#4a3410" stroke-width="0.5"/>
            <text class="schrift abtau-text" x="452" y="21">ABTAUUNG</text>
          </g>

          <!-- Feld 2: Drehzahl -->
          <g class="feld" data-entity="${c.entity}">
            <rect x="196" y="32" width="324" height="134" rx="8" fill="url(#blatt)" stroke="#3b2a10"
                  stroke-width="1.2" filter="url(#innen)"/>
            <text class="schrift titel" x="358" y="48">DREHZAHL</text>
            <g class="werte">
              <text class="schrift gross ist-gross" x="358" y="76">–</text>
              <text class="schrift einheit" x="358" y="89">U/min</text>
              ${this._skala()}
              <g class="max-marke" style="display:none">
                <line class="max-linie" x1="0" y1="${SKALA_Y - 16}" x2="0" y2="${SKALA_Y + 3}"
                      stroke="#7a1712" stroke-width="2.2"/>
              </g>
              <g class="marke soll" style="display:${c.setpoint_entity ? "inline" : "none"}">
                <polygon points="0,${SKALA_Y - 1} -5,${SKALA_Y - 11} 5,${SKALA_Y - 11}" fill="#b3261e"
                         filter="url(#schatten)"/>
              </g>
              <g class="marke ist">
                <polygon points="0,${SKALA_Y + 1} -7,${SKALA_Y + 21} 7,${SKALA_Y + 21}" fill="#1b1712"
                         filter="url(#schatten)"/>
              </g>
              <g class="schrift wert">
                <circle cx="218" cy="154" r="3.6" fill="#b3261e"/>
                <text class="soll-text" x="226" y="158.5"></text>
                <rect x="358" y="151" width="9" height="2.6" fill="#7a1712"/>
                <text class="max-text" x="372" y="158.5"></text>
              </g>
            </g>
            ${c.maker ? `<text class="schrift gravur-klein" x="508" y="159" style="text-anchor:end">${String(c.maker).toUpperCase()}</text>` : ""}
          </g>

          <!-- Feld 3: Lamelle -->
          <g class="feld" data-entity="${c.lamelle_entity || c.entity}">
            <rect x="532" y="32" width="294" height="134" rx="8" fill="url(#blatt)" stroke="#3b2a10"
                  stroke-width="1.2" filter="url(#innen)"/>
            <g class="werte">
              ${this._thermoSkala()}
              <rect x="${TH_X - 5}" y="${TH_Y0 + 14}" width="10" height="${TH_Y1 - TH_Y0 - 10}" rx="5"
                    fill="#f7f2e6" stroke="#6b5a40" stroke-width="1"/>
              <rect class="quecksilber" x="${TH_X - 2.6}" y="${TH_Y1}" width="5.2" height="0" fill="#b3261e"/>
              <circle class="kugel" cx="${TH_X}" cy="${TH_Y1 + 13}" r="10" fill="#b3261e" stroke="#6b5a40"
                      stroke-width="1"/>
              <rect x="${TH_X - 3}" y="${TH_Y0 + 16}" width="2" height="${TH_Y1 - TH_Y0 - 16}" fill="#fff" opacity="0.5"/>
              <text class="schrift titel" x="704" y="50">LAMELLE</text>
              <text class="schrift wert-gross lam-text" x="704" y="74" style="text-anchor:middle">–</text>
              <line x1="626" y1="86" x2="790" y2="86" stroke="#6b5a40" stroke-width="0.6"/>
              <text class="schrift wert umg-text" x="630" y="106"></text>
              <text class="schrift wert diff-text" x="630" y="126"></text>
              <text class="schrift gravur-klein frost-text" x="704" y="150" style="fill:#2c5f8d"></text>
            </g>
          </g>

          <!-- Verbindungslampe -->
          <g class="verbindung" style="display:${c.online_entity ? "inline" : "none"}">
            <circle class="lampe" cx="808" cy="18" r="5" fill="url(#lampe-gruen)" stroke="#4a3410" stroke-width="0.8"/>
            <text class="schrift gravur-klein verb-text" x="798" y="20" style="text-anchor:end">MODBUS</text>
          </g>

        </svg>
      </ha-card>`;

    root.querySelectorAll(".feld").forEach((el) => {
      el.addEventListener("click", () => {
        const ev = new Event("hass-more-info", { bubbles: true, composed: true });
        ev.detail = { entityId: el.dataset.entity };
        this.dispatchEvent(ev);
      });
    });
    this._rad = root.querySelector(".rad");
    this._unschaerfe = root.querySelector(".unschaerfe");
    this._gebaut = true;
  }

  // ---------- Hilfen ----------

  _x(v) {
    const f = Math.min(1.02, Math.max(-0.02, v / this._config.max));
    return SKALA_X0 + f * (SKALA_X1 - SKALA_X0);
  }

  _ty(t) {
    const { temp_min, temp_max } = this._config;
    const f = Math.min(1.03, Math.max(-0.03, (t - temp_min) / (temp_max - temp_min)));
    return TH_Y1 - f * (TH_Y1 - TH_Y0 - 16);
  }

  _zahl(id) {
    const st = id && this._hass.states[id];
    const v = st ? parseFloat(st.state) : NaN;
    return isNaN(v) ? null : v;
  }

  _text(v, nachkomma) {
    return v.toLocaleString("de-DE", { minimumFractionDigits: nachkomma, maximumFractionDigits: nachkomma });
  }

  // ---------- Animation ----------

  _antreiben() {
    if (this._raf || !this._laeuft || !this._rad) return;
    let zuletzt = null;
    const schritt = (t) => {
      if (!this._laeuft) { this._raf = null; return; }
      const dt = zuletzt === null ? 0 : Math.min(0.1, (t - zuletzt) / 1000);
      zuletzt = t;
      this._tempo += (this._zielTempo - this._tempo) * Math.min(1, dt / TRAEGHEIT_S);
      this._winkel = (this._winkel + this._tempo * dt) % 360;
      this._rad.setAttribute("transform", `rotate(${this._winkel.toFixed(2)} ${LCX} ${LCY})`);
      // ab etwa 1 U/s verschwimmen die Fluegel leicht
      this._unschaerfe.setAttribute("opacity", Math.min(0.35, Math.max(0, (this._tempo - 300) / 900)).toFixed(3));
      if (this._zielTempo === 0 && this._tempo < 0.5) {
        this._tempo = 0;
        this._raf = null;
        return;
      }
      this._raf = requestAnimationFrame(schritt);
    };
    this._raf = requestAnimationFrame(schritt);
  }

  // ---------- Aktualisieren ----------

  _aktualisieren() {
    if (!this._hass || !this._gebaut) return;
    const c = this._config;
    const rpm = this._zahl(c.entity);
    const soll = this._zahl(c.setpoint_entity);
    const maxA = this._zahl(c.max_entity);
    const lam = this._zahl(c.lamelle_entity);
    const umg = this._zahl(c.umgebung_entity);
    const onl = c.online_entity && this._hass.states[c.online_entity];
    // fehlt der Verbindungssensor oder ist er unbekannt, gilt "online" - wie in der Regelung
    const offline = !!onl && onl.state === "off";
    const status = this._zahl(c.abtau_entity);
    const abtau = status !== null && (Math.round(status) & c.abtau_bit) !== 0;
    const schluessel = [rpm, soll, maxA, lam, umg, offline, abtau].join("|");
    if (schluessel === this._letzte) return;
    this._letzte = schluessel;
    const root = this.shadowRoot;

    // Luefterrad
    this._zielTempo = rpm && rpm > 0 ? rpm * SICHT_FAKTOR : 0;
    this._antreiben();

    // Drehzahlfeld
    root.querySelector(".ist-gross").textContent = rpm === null ? "–" : this._text(Math.round(rpm), 0);
    root.querySelector(".marke.ist").style.transform = `translateX(${this._x(rpm ?? 0).toFixed(1)}px)`;
    root.querySelector(".marke.soll").style.transform = `translateX(${this._x(soll ?? 0).toFixed(1)}px)`;
    root.querySelector(".soll-text").textContent = !c.setpoint_entity ? "" :
      soll === null ? "SOLL –" : `SOLL ${this._text(Math.round(soll), 0)}`;
    const mm = root.querySelector(".max-marke");
    mm.style.display = maxA === null ? "none" : "inline";
    if (maxA !== null) mm.style.transform = `translateX(${this._x(maxA).toFixed(1)}px)`;
    root.querySelector(".max-text").textContent = maxA === null ? "" : `MAX ${this._text(Math.round(maxA), 0)}`;

    // Thermometer
    const qs = root.querySelector(".quecksilber");
    const kugel = root.querySelector(".kugel");
    const farbe = lam !== null && lam <= 0 ? "#2c6fa8" : "#b3261e";
    if (lam === null) {
      qs.setAttribute("y", TH_Y1); qs.setAttribute("height", 4);
    } else {
      const y = this._ty(lam);
      qs.setAttribute("y", y.toFixed(1));
      qs.setAttribute("height", (TH_Y1 + 6 - y).toFixed(1));
    }
    qs.setAttribute("fill", farbe);
    kugel.setAttribute("fill", farbe);
    root.querySelector(".lam-text").textContent = lam === null ? "–" : `${this._text(lam, 1)} °C`;
    root.querySelector(".umg-text").textContent = !c.umgebung_entity ? "" :
      umg === null ? "Umgebung –" : `Umgebung ${this._text(umg, 1)} °C`;
    root.querySelector(".diff-text").textContent = umg === null || lam === null ? "" :
      `Differenz ${this._text(umg - lam, 1)} K`;
    root.querySelector(".frost-text").textContent = lam !== null && lam <= 0 ? "REIFBILDUNG MÖGLICH" : "";

    // Reif auf dem Gitter: ab 0 °C beginnend, bei -6 °C voll
    root.querySelector(".reif").setAttribute("opacity",
      lam === null ? 0 : Math.min(1, Math.max(0, -lam / 6)).toFixed(2));

    // Abtauung: Lampe + Schriftzug im Gravurschild, Titel ruckt dafuer nach links
    root.querySelector(".abtau").style.display = abtau ? "inline" : "none";
    root.querySelector(".titel-schild").setAttribute("x", abtau ? "320" : "358");

    // Verbindung
    if (c.online_entity) {
      const lampe = root.querySelector(".lampe");
      lampe.setAttribute("fill", offline ? "url(#lampe-rot)" : "url(#lampe-gruen)");
      lampe.classList.toggle("blinkt", offline);
      root.querySelector(".verb-text").textContent = offline ? "MODBUS GETRENNT" : "MODBUS";
      root.querySelectorAll(".werte").forEach((el) => el.classList.toggle("gedimmt", offline));
    }
  }
}

customElements.define("retro-luefter-card", RetroLuefterCard);
window.customCards = window.customCards || [];
window.customCards.push({
  type: "retro-luefter-card",
  name: "Retro-Lüfter",
  description: "Lüfter der Außeneinheit im Messing-Stil mit Drehzahl und Lamellentemperatur",
});
