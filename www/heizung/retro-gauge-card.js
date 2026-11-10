/**
 * Retro-Zeigerinstrument im Stil alter Dampfmaschinen-Manometer (03.10.2026).
 *
 * Halbkreis-Skala mit Farbband (kalt blau -> heiss rot), schwarzer Zeiger = Ist,
 * roter Zeiger = Soll. Messinggehaeuse, cremefarbenes Zifferblatt, Glasreflex.
 * Die Zeiger federn beim Verstellen leicht nach; laeuft das Geraet
 * (vibrate_entity = on), zittert der Ist-Zeiger wie bei einer echten Maschine.
 *
 * Optionen:
 *   entity          (Pflicht) Ist-Wert, z.B. sensor.esphome_web_avarma_vorlauftemperatur
 *   setpoint_entity Soll-Wert (roter Zeiger), optional
 *   min / max       Skalenbereich, Standard 10 / 50
 *   major / minor   Teilung der grossen / kleinen Striche, Standard 10 / 2
 *   title           Aufschrift auf dem Zifferblatt, Standard "Vorlauf"
 *   unit            Einheit, Standard "°C"
 *   maker           kleine Gravur unter der Einheit, optional
 *   decimals        Nachkommastellen der Ist-Ablesung, Standard 1
 *   setpoint_decimals  Nachkommastellen der Soll-Ablesung, Standard 0
 *   label / setpoint_label  Beschriftung der Ablesung, Standard "Ist" / "Soll"
 *   readout_unit    Einheit hinter den Ablesewerten, Standard "°" bei °C, sonst " " + unit
 *   vibrate_entity  Zeiger zittert, solange diese Entity "on" ist, optional
 *   stops           Farbverlauf als [[wert, farbe], ...], Standard blau -> rot
 *   max_height      Hoechsthoehe des Instruments in px; das Instrument wird dann zentriert
 *                   und die Karte bekommt weniger Innenabstand (09.10.2026, kleines iPad)
 *
 * Tipp auf die Karte oeffnet den Verlauf (more-info) des Ist-Werts.
 */

const STOPS = [
  [10, "#2c5f8d"],
  [20, "#4f8fae"],
  [30, "#d6a536"],
  [40, "#cc6a2a"],
  [50, "#a51d1d"],
];

const CX = 150;
const CY = 158;

const STIL = `
  :host { display: block; }
  ha-card { padding: 14px 14px 10px; overflow: hidden; cursor: pointer;
            -webkit-tap-highlight-color: transparent; }
  svg { display: block; width: 100%; height: auto; }
  .zeiger { transform-box: view-box; transform-origin: ${CX}px ${CY}px;
            transition: transform 1.8s cubic-bezier(.3,1.45,.55,1); }
  .zittern { transform-box: view-box; transform-origin: ${CX}px ${CY}px; }
  .zittern.an { animation: zittern 0.16s ease-in-out infinite alternate; }
  .schrift { font-family: Georgia, "Times New Roman", serif; fill: #2a2118; }
  .ziffer { font-size: 16px; text-anchor: middle; dominant-baseline: central; }
  .titel { font-size: 11px; letter-spacing: 3px; text-anchor: middle; }
  .einheit { font-size: 12px; font-style: italic; text-anchor: middle; }
  .gravur { font-size: 6px; letter-spacing: 2px; text-anchor: middle; fill: #6b5a40; }
  .wert { font-size: 13px; dominant-baseline: central; }
  @keyframes zittern { from { transform: rotate(-0.45deg); } to { transform: rotate(0.45deg); } }
`;

function mischen(a, b, t) {
  const ha = a.replace("#", ""), hb = b.replace("#", "");
  const k = [0, 2, 4].map((i) => {
    const x = parseInt(ha.substr(i, 2), 16), y = parseInt(hb.substr(i, 2), 16);
    return Math.round(x + (y - x) * t).toString(16).padStart(2, "0");
  });
  return "#" + k.join("");
}

function punkt(r, frac) {
  // frac 0 = links (min), 1 = rechts (max), Bogen oben herum
  const a = Math.PI * (1 - frac);
  return [CX + r * Math.cos(a), CY - r * Math.sin(a)];
}

class RetroGaugeCard extends HTMLElement {
  setConfig(config) {
    if (!config.entity) throw new Error("entity fehlt");
    this._config = {
      min: 10, max: 50, major: 10, minor: 2,
      title: "Vorlauf", unit: "°C", stops: STOPS,
      decimals: 1, setpoint_decimals: 0, label: "Ist", setpoint_label: "Soll",
      ...config,
    };
    if (!config.stops) {
      // Standardverlauf auf den eigenen Skalenbereich strecken
      const { min, max } = this._config;
      this._config.stops = STOPS.map(([v, f]) => [min + (v - 10) / 40 * (max - min), f]);
    }
    if (this._config.readout_unit === undefined) {
      const u = this._config.unit;
      this._config.readout_unit = u === "°C" ? "°" : u ? " " + u : "";
    }
    this._gebaut = false;
    this._letzte = null;
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._gebaut) this._bauen();
    this._aktualisieren();
  }

  getCardSize() { return 4; }
  getGridOptions() { return { columns: 6, min_columns: 4 }; }

  _frac(v) {
    const { min, max } = this._config;
    return Math.min(1.025, Math.max(-0.025, (v - min) / (max - min)));
  }

  _farbe(v) {
    const s = this._config.stops;
    if (v <= s[0][0]) return s[0][1];
    for (let i = 1; i < s.length; i++) {
      if (v <= s[i][0]) {
        return mischen(s[i - 1][1], s[i][1], (v - s[i - 1][0]) / (s[i][0] - s[i - 1][0]));
      }
    }
    return s[s.length - 1][1];
  }

  _skala() {
    const { min, max, major, minor } = this._config;
    let svg = "";

    // Farbband aus vielen kleinen Bogenstuecken, damit der Verlauf dem Bogen folgt
    const n = 72, r = 117;
    for (let i = 0; i < n; i++) {
      const f0 = i / n, f1 = Math.min(1, (i + 1) / n + 0.003);
      const [x0, y0] = punkt(r, f0), [x1, y1] = punkt(r, f1);
      const farbe = this._farbe(min + (max - min) * (i + 0.5) / n);
      svg += `<path d="M${x0.toFixed(2)},${y0.toFixed(2)} A${r},${r} 0 0 1 ${x1.toFixed(2)},${y1.toFixed(2)}"
                stroke="${farbe}" stroke-width="10" fill="none" opacity="0.9"/>`;
    }
    // feine Begrenzungslinien des Bandes
    for (const rb of [112, 122]) {
      const [xa, ya] = punkt(rb, 0), [xb, yb] = punkt(rb, 1);
      svg += `<path d="M${xa},${ya} A${rb},${rb} 0 0 1 ${xb},${yb}" stroke="#3b2f22"
                stroke-width="0.6" fill="none" opacity="0.55"/>`;
    }

    // Teilstriche und Ziffern
    const schritte = Math.round((max - min) / minor);
    const proGross = Math.max(1, Math.round(major / minor));
    const stellen = (String(major).split(".")[1] || "").length;
    for (let i = 0; i <= schritte; i++) {
      const v = min + i * minor;
      const f = (v - min) / (max - min);
      const gross = i % proGross === 0;
      const mittel = !gross && proGross % 2 === 0 && i % (proGross / 2) === 0;
      const len = gross ? 15 : mittel ? 10 : 6;
      const [xa, ya] = punkt(111, f), [xb, yb] = punkt(111 - len, f);
      svg += `<line x1="${xa.toFixed(2)}" y1="${ya.toFixed(2)}" x2="${xb.toFixed(2)}" y2="${yb.toFixed(2)}"
                stroke="#2a2118" stroke-width="${gross ? 2.4 : mittel ? 1.5 : 0.9}" stroke-linecap="round"/>`;
      if (gross) {
        // Endziffern etwas anheben, sonst liegt der ruhende Zeiger genau darauf
        const [xt, y0] = punkt(85, f);
        const yt = i === 0 || i === schritte ? y0 - 12 : y0;
        svg += `<text class="schrift ziffer" x="${xt.toFixed(2)}" y="${yt.toFixed(2)}">${this._text(v, stellen)}</text>`;
      }
    }

    // Anschlagstift links unter dem Skalenanfang
    const [xs, ys] = punkt(104, -0.025);
    svg += `<circle cx="${xs.toFixed(2)}" cy="${ys.toFixed(2)}" r="2.6" fill="url(#messing)"
              stroke="#4a3410" stroke-width="0.6"/>`;
    return svg;
  }

  _bauen() {
    const c = this._config;
    const root = this.shadowRoot || this.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>${STIL}${c.max_height ? `ha-card { padding: 6px 8px; } svg { width: min(100%, ${c.max_height * 1.5}px); margin: 0 auto; }` : ""}</style>
      <ha-card>
        <svg viewBox="0 0 300 200" role="img" aria-label="${c.title}">
          <defs>
            <linearGradient id="messing" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stop-color="#f6e2a4"/>
              <stop offset="0.32" stop-color="#c99a43"/>
              <stop offset="0.58" stop-color="#8a6020"/>
              <stop offset="0.82" stop-color="#e4c172"/>
              <stop offset="1" stop-color="#a5772d"/>
            </linearGradient>
            <radialGradient id="blatt" cx="${CX}" cy="${CY - 20}" r="150" gradientUnits="userSpaceOnUse">
              <stop offset="0" stop-color="#fdf8ea"/>
              <stop offset="0.7" stop-color="#f1e6c8"/>
              <stop offset="1" stop-color="#d9c79c"/>
            </radialGradient>
            <radialGradient id="nabe" cx="0.35" cy="0.35" r="0.7">
              <stop offset="0" stop-color="#fff3c4"/>
              <stop offset="0.45" stop-color="#c99a43"/>
              <stop offset="1" stop-color="#5e400f"/>
            </radialGradient>
            <linearGradient id="glas" x1="0" y1="0" x2="0.7" y2="1">
              <stop offset="0" stop-color="#fff" stop-opacity="0.55"/>
              <stop offset="1" stop-color="#fff" stop-opacity="0"/>
            </linearGradient>
            <filter id="schatten" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="1.6" dy="2.2" stdDeviation="1.3" flood-color="#000" flood-opacity="0.35"/>
            </filter>
            <filter id="innen" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="1.5" stdDeviation="2" flood-color="#000" flood-opacity="0.5"/>
            </filter>
          </defs>

          <!-- Messinggehaeuse -->
          <path d="M4,${CY} A146,146 0 0 1 296,${CY} L296,186 Q296,196 286,196 L14,196 Q4,196 4,186 Z"
                fill="url(#messing)" stroke="#5a3d10" stroke-width="1"/>
          <path d="M9,${CY} A141,141 0 0 1 291,${CY}" fill="none" stroke="#fff3c4"
                stroke-width="0.8" opacity="0.6"/>
          <circle cx="22" cy="191" r="3" fill="url(#nabe)" stroke="#4a3410" stroke-width="0.5"/>
          <circle cx="278" cy="191" r="3" fill="url(#nabe)" stroke="#4a3410" stroke-width="0.5"/>
          <line x1="20" y1="189.3" x2="24" y2="192.7" stroke="#4a3410" stroke-width="0.7"/>
          <line x1="276" y1="192.7" x2="280" y2="189.3" stroke="#4a3410" stroke-width="0.7"/>

          <!-- Zifferblatt -->
          <path d="M16,${CY} A134,134 0 0 1 284,${CY} L284,182 Q284,186 280,186 L20,186 Q16,186 16,182 Z"
                fill="url(#blatt)" stroke="#3b2a10" stroke-width="1.2" filter="url(#innen)"/>

          ${this._skala()}

          <text class="schrift titel" x="${CX}" y="100">${String(c.title).toUpperCase()}</text>
          <text class="schrift einheit" x="${CX}" y="117">${c.unit}</text>
          ${c.maker ? `<text class="schrift gravur" x="${CX}" y="136">${String(c.maker).toUpperCase()}</text>` : ""}

          <!-- Ablesung unten -->
          <g class="schrift wert">
            <circle cx="38" cy="177" r="3.6" fill="#1b1712"/>
            <text class="ist-text" x="46" y="177.5"></text>
            <circle cx="${c.setpoint_entity ? 178 : -20}" cy="177" r="3.6" fill="#b3261e"/>
            <text class="soll-text" x="186" y="177.5"></text>
          </g>

          <!-- Soll-Zeiger (rot) -->
          <g class="zeiger soll" style="display:${c.setpoint_entity ? "inline" : "none"}">
            <g filter="url(#schatten)">
              <polygon points="38,${CY} 132,${CY - 1.8} 166,${CY - 1.2} 166,${CY + 1.2} 132,${CY + 1.8}" fill="#b3261e"/>
              <polygon points="160,${CY} 167,${CY - 4} 174,${CY} 167,${CY + 4}" fill="#b3261e"/>
            </g>
          </g>

          <!-- Ist-Zeiger (schwarz) -->
          <g class="zeiger ist">
            <g class="zittern">
              <g filter="url(#schatten)">
                <polygon points="44,${CY} 58,${CY - 4.2} 56,${CY - 2.2} 132,${CY - 3.4} 164,${CY - 2.2}
                                 164,${CY + 2.2} 132,${CY + 3.4} 56,${CY + 2.2} 58,${CY + 4.2}" fill="#1b1712"/>
                <circle cx="166" cy="${CY}" r="6" fill="#1b1712"/>
              </g>
            </g>
          </g>

          <!-- Nabe -->
          <circle cx="${CX}" cy="${CY}" r="10" fill="url(#nabe)" stroke="#4a3410" stroke-width="0.8"
                  filter="url(#schatten)"/>
          <circle cx="${CX}" cy="${CY}" r="2.4" fill="#4a3410"/>

          <!-- Glasreflex -->
          <path d="M26,${CY - 4} A124,124 0 0 1 196,40 Q104,58 26,${CY - 4} Z" fill="url(#glas)" opacity="0.5"
                pointer-events="none"/>
        </svg>
      </ha-card>`;
    root.querySelector("ha-card").addEventListener("click", () => {
      const ev = new Event("hass-more-info", { bubbles: true, composed: true });
      ev.detail = { entityId: this._config.entity };
      this.dispatchEvent(ev);
    });
    this._gebaut = true;
  }

  _zahl(id) {
    const st = id && this._hass.states[id];
    const v = st ? parseFloat(st.state) : NaN;
    return isNaN(v) ? null : v;
  }

  _text(v, nachkomma) {
    return v.toLocaleString("de-DE", {
      minimumFractionDigits: nachkomma, maximumFractionDigits: nachkomma,
    });
  }

  _aktualisieren() {
    if (!this._hass || !this._gebaut) return;
    const c = this._config;
    const ist = this._zahl(c.entity);
    const soll = this._zahl(c.setpoint_entity);
    const vib = c.vibrate_entity && this._hass.states[c.vibrate_entity];
    const zittert = !!vib && vib.state === "on";
    const schluessel = `${ist}|${soll}|${zittert}`;
    if (schluessel === this._letzte) return;
    this._letzte = schluessel;

    const root = this.shadowRoot;
    // ohne Wert faellt der Zeiger auf den Anschlagstift zurueck
    const winkel = (v) => `rotate(${(this._frac(v === null ? -1e9 : v) * 180).toFixed(2)}deg)`;
    root.querySelector(".zeiger.ist").style.transform = winkel(ist);
    root.querySelector(".zeiger.soll").style.transform = winkel(soll);
    root.querySelector(".zittern").classList.toggle("an", zittert && ist !== null);

    const e = c.readout_unit;
    const li = c.label.toUpperCase(), ls = c.setpoint_label.toUpperCase();
    root.querySelector(".ist-text").textContent =
      ist === null ? `${li} –` : `${li} ${this._text(ist, c.decimals)}${e}`;
    root.querySelector(".soll-text").textContent = !c.setpoint_entity ? "" :
      soll === null ? `${ls} –` : `${ls} ${this._text(soll, c.setpoint_decimals)}${e}`;
  }
}

customElements.define("retro-gauge-card", RetroGaugeCard);
window.customCards = window.customCards || [];
window.customCards.push({
  type: "retro-gauge-card",
  name: "Retro-Zeigerinstrument",
  description: "Halbkreis-Manometer im Dampfmaschinen-Stil mit Ist- und Soll-Zeiger",
});
