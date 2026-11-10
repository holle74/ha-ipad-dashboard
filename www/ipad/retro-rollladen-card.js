/**
 * Retro-Rollladen fuer das iPad-Panel (05.10.2026): Maschinentelegraf
 * wie auf der Schiffsbruecke, passend zu den Messing-Instrumenten.
 *
 * Je Rollladen eine Telegrafenscheibe mit den Stufen ZU · 1/4 · HALB · 3/4 · AUF.
 *   Hebel           Befehl: ziehen oder auf eine Stufe tippen, rastet auf der
 *                   naechsten Stufe ein und faehrt den Rollladen dorthin.
 *   roter Zeiger    Rueckmeldung: wo der Rollladen gerade ist. free@home meldet
 *                   waehrend der Fahrt keine Zwischenwerte, deshalb laeuft der
 *                   Zeiger mit der Fahrzeit mit und springt bei der Endmeldung
 *                   auf die echte Position.
 *   roter Knopf     Mitte der Scheibe: HALT.
 *   Fenster         unten in der Scheibe, Lamellen zeigen die Position.
 *
 * Optionen:
 *   entities   (Pflicht) Liste aus { entity, name } oder nur entity_id
 *   title      Gravur auf dem Messingschild, optional
 *   fahrzeit   Sekunden fuer eine volle Fahrt 0 -> 100 %, Standard 20
 *   alle       true = Leiste mit ALLE AUF / HALT / ALLE ZU, Standard true
 *
 * Ein Tipp auf das Namensschild oeffnet more-info.
 */

const MESSING = "linear-gradient(135deg, #f6e2a4 0%, #c99a43 32%, #8a6020 58%, #e4c172 82%, #a5772d 100%)";
const SERIF = `Georgia, "Times New Roman", serif`;

// Scheibengeometrie (SVG-Koordinaten)
const B = 260, CX = 130, CY = 132;
const R_RAND = 104, R_FACE = 93, R_BAND_AUSSEN = 90, R_BAND_INNEN = 56;
const WINKEL = 72; // Ausschlag des Hebels je Seite
const STUFEN = [
  { p: 0, text: "ZU" }, { p: 25, text: "¼" }, { p: 50, text: "HALB" },
  { p: 75, text: "¾" }, { p: 100, text: "AUF" },
];
const FENSTER = { x: CX - 42, y: 152, w: 84, h: 50 };

const winkelVon = (p) => -WINKEL + (p / 100) * 2 * WINKEL;
const pol = (r, grad) => {
  const w = (grad * Math.PI) / 180;
  return [CX + r * Math.sin(w), CY - r * Math.cos(w)];
};
const f = (n) => n.toFixed(2);

function sektor(r1, r2, a1, a2) {
  const [x1, y1] = pol(r2, a1), [x2, y2] = pol(r2, a2);
  const [x3, y3] = pol(r1, a2), [x4, y4] = pol(r1, a1);
  return `M${f(x1)} ${f(y1)} A${r2} ${r2} 0 0 1 ${f(x2)} ${f(y2)} L${f(x3)} ${f(y3)} A${r1} ${r1} 0 0 0 ${f(x4)} ${f(y4)} Z`;
}

function scheibe(i) {
  const breite = (2 * WINKEL) / (STUFEN.length - 1);
  const felder = STUFEN.map((s, k) => {
    const a = winkelVon(s.p);
    const ende = k === 0 || k === STUFEN.length - 1;
    const a1 = k === 0 ? -90 : a - breite / 2;
    const a2 = k === STUFEN.length - 1 ? 90 : a + breite / 2;
    const [tx, ty] = pol((R_BAND_AUSSEN + R_BAND_INNEN) / 2, a);
    return `
      <path class="feld${ende ? " ende" : ""}" d="${sektor(R_BAND_INNEN, R_BAND_AUSSEN, a1, a2)}"/>
      <text class="stufe${ende ? " ende" : ""}" x="${f(tx)}" y="${f(ty)}"
            transform="rotate(${a} ${f(tx)} ${f(ty)})">${s.text}</text>`;
  }).join("");
  const striche = Array.from({ length: 21 }, (_, k) => {
    const a = -90 + k * 9;
    const [x1, y1] = pol(R_BAND_AUSSEN, a), [x2, y2] = pol(R_BAND_AUSSEN + (k % 2 ? 2 : 3.5), a);
    return `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}"/>`;
  }).join("");
  const lamellen = Array.from({ length: 9 }, (_, k) =>
    `<rect x="${FENSTER.x}" y="${FENSTER.y + k * (FENSTER.h / 9)}" width="${FENSTER.w}" height="${FENSTER.h / 9 - 0.8}"/>`).join("");
  return `
  <svg class="scheibe" viewBox="0 0 ${B} ${B - 14}" data-i="${i}">
    <defs>
      <linearGradient id="ms${i}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#f6e2a4"/><stop offset="0.32" stop-color="#c99a43"/>
        <stop offset="0.58" stop-color="#8a6020"/><stop offset="0.82" stop-color="#e4c172"/>
        <stop offset="1" stop-color="#a5772d"/>
      </linearGradient>
      <radialGradient id="fa${i}" cx="0.42" cy="0.32" r="0.75">
        <stop offset="0" stop-color="#fdf8ea"/><stop offset="1" stop-color="#e2d2a8"/>
      </radialGradient>
      <radialGradient id="kn${i}" cx="0.35" cy="0.3" r="0.8">
        <stop offset="0" stop-color="#ff8a70"/><stop offset="0.45" stop-color="#b3200f"/>
        <stop offset="1" stop-color="#4a0a04"/>
      </radialGradient>
      <radialGradient id="gr${i}" cx="0.35" cy="0.3" r="0.8">
        <stop offset="0" stop-color="#6a5a4c"/><stop offset="0.5" stop-color="#241911"/>
        <stop offset="1" stop-color="#0a0604"/>
      </radialGradient>
      <clipPath id="cl${i}"><rect x="${FENSTER.x}" y="${FENSTER.y}" width="${FENSTER.w}" height="${FENSTER.h}"/></clipPath>
    </defs>
    <circle cx="${CX}" cy="${CY + 3}" r="${R_RAND}" fill="rgba(0,0,0,0.35)"/>
    <circle cx="${CX}" cy="${CY}" r="${R_RAND}" fill="url(#ms${i})" stroke="#4a3410"/>
    <circle cx="${CX}" cy="${CY}" r="${R_FACE + 1.5}" fill="#3b2a10"/>
    <circle cx="${CX}" cy="${CY}" r="${R_FACE}" fill="url(#fa${i})"/>
    <g class="felder">${felder}</g>
    <g class="striche">${striche}</g>

    <g class="fenster">
      <rect x="${FENSTER.x - 4}" y="${FENSTER.y - 4}" width="${FENSTER.w + 8}" height="${FENSTER.h + 8}" rx="3"
            fill="url(#ms${i})" stroke="#4a3410"/>
      <rect class="himmel" x="${FENSTER.x}" y="${FENSTER.y}" width="${FENSTER.w}" height="${FENSTER.h}"/>
      <circle class="gestirn" cx="${FENSTER.x + FENSTER.w - 16}" cy="${FENSTER.y + 14}" r="7"/>
      <g clip-path="url(#cl${i})"><g class="panzer">${lamellen}</g></g>
      <line x1="${CX}" y1="${FENSTER.y}" x2="${CX}" y2="${FENSTER.y + FENSTER.h}" stroke="#4a3410" stroke-width="2"/>
    </g>
    <circle class="lampe" cx="${CX}" cy="${FENSTER.y + FENSTER.h + 14}" r="4.5"/>

    <g class="hebel">
      <rect x="${CX - 4.5}" y="${CY - 112}" width="9" height="124" rx="4" fill="url(#ms${i})" stroke="#4a3410"/>
      <circle cx="${CX}" cy="${CY - 117}" r="12" fill="url(#gr${i})" stroke="#0a0604"/>
      <ellipse cx="${CX - 3.5}" cy="${CY - 121}" rx="4" ry="2.6" fill="rgba(255,255,255,0.35)"/>
    </g>
    <g class="zeiger">
      <path d="M${CX} ${CY - R_BAND_INNEN + 1} l-6 -12 h12 Z" fill="#b3200f" stroke="#4a0a04" stroke-width="0.8"/>
    </g>

    <circle cx="${CX}" cy="${CY}" r="21" fill="url(#ms${i})" stroke="#4a3410"/>
    <g class="halt">
      <circle cx="${CX}" cy="${CY}" r="14.5" fill="url(#kn${i})" stroke="#2a0502"/>
      <text x="${CX}" y="${CY + 2.4}">HALT</text>
    </g>
  </svg>`;
}

const STIL = `
  :host { display: block; }
  ha-card { padding: 10px; overflow: hidden; }
  .platte { position: relative; border-radius: 12px; padding: 14px 18px 16px; background: ${MESSING};
            border: 1px solid #5a3d10;
            box-shadow: inset 0 1px 0 rgba(255,243,196,0.8), inset 0 -2px 3px rgba(0,0,0,0.35); }
  .schraube { position: absolute; width: 9px; height: 9px; border-radius: 50%;
              background: radial-gradient(circle at 35% 35%, #fff3c4, #c99a43 45%, #5e400f);
              box-shadow: 0 1px 1px rgba(0,0,0,0.4); }
  .schraube::after { content: ""; position: absolute; left: 1px; right: 1px; top: 4px; height: 1px;
                     background: #4a3410; transform: rotate(40deg); }
  .platte > .lo { left: 6px; top: 6px; } .platte > .ro { right: 6px; top: 6px; }
  .platte > .lu { left: 6px; bottom: 6px; } .platte > .ru { right: 6px; bottom: 6px; }
  .titel { display: inline-block; margin: 0 0 6px 8px; padding: 3px 12px; border-radius: 4px;
           font-family: ${SERIF}; font-size: 11px; letter-spacing: 3px; color: #2a2118;
           background: radial-gradient(ellipse at 40% 30%, #fdf8ea, #e9dcb8);
           border: 1px solid #3b2a10; box-shadow: inset 0 1px 2px rgba(0,0,0,0.3); }
  button { font: inherit; border: 0; background: none; padding: 0; color: inherit; cursor: pointer;
           -webkit-tap-highlight-color: transparent; }
  .namensschild { display: block; max-width: 100%; margin: 2px auto 0; padding: 3px 10px; border-radius: 3px;
                  font-family: ${SERIF}; font-size: 13px; letter-spacing: 0.5px; color: #2a2118;
                  background: radial-gradient(ellipse at 40% 30%, #fdf8ea, #e6d7b0);
                  border: 1px solid #5a3d10; box-shadow: inset 0 1px 1px rgba(0,0,0,0.25);
                  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .status { margin-top: 5px; font-family: ${SERIF}; font-size: 12px; color: #2a1d0c; height: 15px;
            text-shadow: 0 1px 0 rgba(255,243,196,0.55); }

  .bruecke { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; gap: 10px; }
  .telegraf { display: flex; flex-direction: column; align-items: center; min-width: 0; }
  .telegraf.weg { opacity: 0.45; }
  .scheibe { width: 100%; max-width: 280px; display: block; touch-action: none; user-select: none;
             -webkit-user-select: none; -webkit-tap-highlight-color: transparent; }
  .feld { fill: transparent; stroke: #2a2118; stroke-width: 0.8; }
  .feld.ende { fill: #231b14; }
  .stufe { font-family: ${SERIF}; font-size: 12px; letter-spacing: 1px; fill: #2a2118;
           text-anchor: middle; dominant-baseline: central; cursor: pointer; }
  .stufe.ende { fill: #f3ead2; font-size: 11px; }
  .striche line { stroke: #2a2118; stroke-width: 1; }
  .himmel { fill: #9cc7e8; transition: fill 1s; }
  .gestirn { fill: #ffd76a; transition: fill 1s; }
  .nacht .himmel { fill: #1c2a48; }
  .nacht .gestirn { fill: #f2efe0; }
  .panzer { transition: transform 0.6s ease-out; }
  .faehrt .panzer { transition: transform 0.15s linear; }
  .panzer rect { fill: #b7ae9f; stroke: #7d7465; stroke-width: 0.6; }
  .lampe { fill: #3a3028; stroke: #1a120a; transition: fill 0.3s; }
  .faehrt .lampe { fill: #ffb347; animation: blinken 0.8s steps(2, jump-none) infinite; }
  @keyframes blinken { 50% { fill: #5a3a18; } }
  .hebel, .zeiger { transform-box: view-box; transform-origin: ${CX}px ${CY}px; }
  .hebel { cursor: grab; filter: drop-shadow(0 3px 2px rgba(0,0,0,0.45));
           transition: transform 0.45s cubic-bezier(.3,1.5,.5,1); }
  .zeiger { transition: transform 0.6s ease-out; }
  .ziehen .hebel { transition: none; cursor: grabbing; }
  .faehrt .zeiger { transition: transform 0.15s linear; }
  .halt { cursor: pointer; }
  .halt text { font-family: ${SERIF}; font-size: 6.5px; letter-spacing: 0.5px; fill: #f3ead2; text-anchor: middle; }
  .halt.druck circle { transform: translateY(1px); }

  .leiste { display: flex; justify-content: center; gap: 22px; margin-top: 14px; }
  .taster { display: flex; flex-direction: column; align-items: center; gap: 5px; }
  .taster .knopf { width: 34px; height: 34px; border-radius: 50%;
                   background: radial-gradient(circle at 35% 30%, #6a5a4c, #241911 50%, #0a0604);
                   border: 3px solid #c99a43; box-shadow: 0 3px 4px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.25);
                   transition: transform 0.08s; }
  .taster.rot .knopf { background: radial-gradient(circle at 35% 30%, #ff8a70, #b3200f 45%, #4a0a04); }
  .taster:active .knopf { transform: translateY(2px); box-shadow: 0 1px 2px rgba(0,0,0,0.5); }
  .taster span:last-child { padding: 2px 8px; border-radius: 3px; font-family: ${SERIF}; font-size: 10px;
                            letter-spacing: 1.5px; color: #2a2118;
                            background: radial-gradient(ellipse at 40% 30%, #fdf8ea, #e6d7b0);
                            border: 1px solid #5a3d10; }
`;

class RetroRollladenCard extends HTMLElement {
  setConfig(config) {
    if (!Array.isArray(config.entities) || !config.entities.length) throw new Error("entities fehlt");
    this._config = { fahrzeit: 20, alle: true, ...config };
    this._eintraege = config.entities.map((e) => (typeof e === "string" ? { entity: e } : e));
    this._gebaut = false;
    this._soll = {};   // Befehl je Rollladen: { p, bis }
    this._fahrt = {};  // laufende Fahrt: { von, richtung, seit }
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._gebaut) this._bauen();
    this._aktualisieren();
  }

  getCardSize() { return 6; }

  disconnectedCallback() {
    clearInterval(this._takt);
    this._takt = null;
  }

  connectedCallback() {
    if (this._gebaut) this._aktualisieren();
  }

  _name(e) {
    const st = this._hass.states[e.entity];
    return e.name || (st && st.attributes.friendly_name) || e.entity;
  }

  _bauen() {
    const c = this._config;
    const root = this.shadowRoot || this.attachShadow({ mode: "open" });
    const titel = c.title ? `<div class="titel">${String(c.title).toUpperCase()}</div>` : "";
    const leiste = c.alle ? `
      <div class="leiste">
        <button class="taster" data-alle="auf"><span class="knopf"></span><span>ALLE AUF</span></button>
        <button class="taster rot" data-alle="halt"><span class="knopf"></span><span>HALT</span></button>
        <button class="taster" data-alle="zu"><span class="knopf"></span><span>ALLE ZU</span></button>
      </div>` : "";
    root.innerHTML = `
      <style>${STIL}</style>
      <ha-card>
        <div class="platte">
          <span class="schraube lo"></span><span class="schraube ro"></span>
          <span class="schraube lu"></span><span class="schraube ru"></span>
          ${titel}
          <div class="bruecke">${this._eintraege.map((e, i) => `
            <div class="telegraf" data-i="${i}">
              ${scheibe(i)}
              <button class="namensschild" data-i="${i}">${this._name(e)}</button>
              <div class="status"></div>
            </div>`).join("")}
          </div>
          ${leiste}
        </div>
      </ha-card>`;

    root.querySelectorAll(".scheibe").forEach((s) => this._bedienen(s));
    root.querySelectorAll(".namensschild").forEach((b) =>
      b.addEventListener("click", () => this._mehrInfo(+b.dataset.i)));
    root.querySelectorAll(".taster").forEach((b) =>
      b.addEventListener("click", () => this._alle(b.dataset.alle)));
    this._gebaut = true;
  }

  _mehrInfo(i) {
    const ev = new Event("hass-more-info", { bubbles: true, composed: true });
    ev.detail = { entityId: this._eintraege[i].entity };
    this.dispatchEvent(ev);
  }

  // Zeiger auf der Scheibe -> Winkel und Abstand zur Hebelachse
  _punkt(svg, ev) {
    const r = svg.getBoundingClientRect();
    const x = ((ev.clientX - r.left) * B) / r.width - CX;
    const y = ((ev.clientY - r.top) * B) / r.width - CY;
    return { abstand: Math.hypot(x, y), winkel: (Math.atan2(x, -y) * 180) / Math.PI, y };
  }

  _bedienen(svg) {
    const i = +svg.dataset.i;
    const t = svg.closest(".telegraf");
    const halt = svg.querySelector(".halt");
    let aktiv = false, haltGedrueckt = false;

    svg.addEventListener("pointerdown", (ev) => {
      const st = this._hass.states[this._eintraege[i].entity];
      if (!st || st.state === "unavailable") return;
      const pt = this._punkt(svg, ev);
      if (pt.abstand < 20) { haltGedrueckt = true; halt.classList.add("druck"); return; }
      // Nur die obere Haelfte (Stufenfeld und Hebelgriff) bedient den Hebel
      if (pt.y > 8 || pt.abstand > 132) return;
      aktiv = true;
      svg.setPointerCapture(ev.pointerId);
      t.classList.add("ziehen");
      this._hebel(i, this._ausWinkel(pt.winkel));
    });
    svg.addEventListener("pointermove", (ev) => {
      if (!aktiv) return;
      this._hebel(i, this._ausWinkel(this._punkt(svg, ev).winkel));
    });
    const loslassen = (ev) => {
      if (haltGedrueckt) {
        haltGedrueckt = false;
        halt.classList.remove("druck");
        if (ev.type === "pointerup") this._halt(i);
        return;
      }
      if (!aktiv) return;
      aktiv = false;
      t.classList.remove("ziehen");
      if (ev.type !== "pointerup") { this._aktualisieren(); return; }
      // Auf die naechste Stufe einrasten
      const p = this._ausWinkel(this._punkt(svg, ev).winkel);
      const stufe = STUFEN.reduce((a, s) => (Math.abs(s.p - p) < Math.abs(a.p - p) ? s : a)).p;
      this._fahren(i, stufe);
    };
    svg.addEventListener("pointerup", loslassen);
    svg.addEventListener("pointercancel", loslassen);
  }

  _ausWinkel(w) {
    return Math.min(100, Math.max(0, ((w + WINKEL) / (2 * WINKEL)) * 100));
  }

  _fahren(i, p) {
    const id = this._eintraege[i].entity;
    this._soll[i] = { p, bis: Date.now() + (this._config.fahrzeit + 15) * 1000 };
    if (p >= 100) this._hass.callService("cover", "open_cover", { entity_id: id });
    else if (p <= 0) this._hass.callService("cover", "close_cover", { entity_id: id });
    else this._hass.callService("cover", "set_cover_position", { entity_id: id, position: p });
    this._aktualisieren();
  }

  _halt(i) {
    delete this._soll[i];
    this._hass.callService("cover", "stop_cover", { entity_id: this._eintraege[i].entity });
  }

  _alle(was) {
    const ids = this._eintraege.map((e) => e.entity);
    if (was === "halt") {
      this._soll = {};
      this._hass.callService("cover", "stop_cover", { entity_id: ids });
      return;
    }
    const p = was === "auf" ? 100 : 0;
    const bis = Date.now() + (this._config.fahrzeit + 15) * 1000;
    ids.forEach((_, i) => { this._soll[i] = { p, bis }; });
    this._hass.callService("cover", was === "auf" ? "open_cover" : "close_cover", { entity_id: ids });
    this._aktualisieren();
  }

  _hebel(i, p) {
    const t = this.shadowRoot.querySelector(`.telegraf[data-i="${i}"]`);
    t.querySelector(".hebel").style.transform = `rotate(${winkelVon(p)}deg)`;
  }

  _position(st) {
    const p = Number(st && st.attributes.current_position);
    if (Number.isFinite(p)) return p;
    return st && st.state === "open" ? 100 : 0;
  }

  // Rueckmeldung: echte Position, waehrend der Fahrt mit der Fahrzeit hochgerechnet
  _ist(i, st) {
    const p = this._position(st);
    const richtung = st.state === "opening" ? 1 : st.state === "closing" ? -1 : 0;
    if (!richtung) { delete this._fahrt[i]; return { p, faehrt: false }; }
    let fa = this._fahrt[i];
    if (!fa || fa.richtung !== richtung) {
      // Mitten in eine Fahrt hineingeladen: Beginn aus last_changed, gegen Uhrabweichung begrenzt
      const jetzt = Date.now();
      const beginn = this._gebautUm && jetzt - this._gebautUm > 1500
        ? jetzt
        : Math.min(jetzt, Math.max(jetzt - this._config.fahrzeit * 1000, Date.parse(st.last_changed) || jetzt));
      fa = this._fahrt[i] = { von: p, richtung, seit: beginn };
    }
    const s = this._soll[i];
    const ziel = s ? s.p : richtung > 0 ? 100 : 0;
    const weg = ((Date.now() - fa.seit) / 1000) * (100 / this._config.fahrzeit);
    const q = richtung > 0 ? Math.min(ziel, fa.von + weg) : Math.max(ziel, fa.von - weg);
    return { p: Math.min(100, Math.max(0, q)), faehrt: true, richtung };
  }

  _aktualisieren() {
    if (!this._hass || !this._gebaut) return;
    if (!this._gebautUm) this._gebautUm = Date.now();
    const root = this.shadowRoot;
    const jetzt = Date.now();
    const sonne = this._hass.states["sun.sun"];
    const nacht = !!sonne && sonne.state === "below_horizon";
    let irgendwoFahrt = false;

    this._eintraege.forEach((e, i) => {
      const t = root.querySelector(`.telegraf[data-i="${i}"]`);
      const st = this._hass.states[e.entity];
      const weg = !st || st.state === "unavailable";
      t.classList.toggle("weg", weg);
      t.querySelector(".scheibe").classList.toggle("nacht", nacht);
      if (weg) { t.querySelector(".status").textContent = "nicht erreichbar"; return; }

      const ist = this._ist(i, st);
      irgendwoFahrt = irgendwoFahrt || ist.faehrt;
      t.classList.toggle("faehrt", ist.faehrt);

      // Befehl gilt, bis die Endmeldung passt oder die Zeit um ist
      let s = this._soll[i];
      if (s && (s.bis < jetzt || (!ist.faehrt && Math.abs(this._position(st) - s.p) <= 3))) {
        delete this._soll[i];
        s = null;
      }
      if (!t.classList.contains("ziehen")) {
        const hebel = s ? s.p : ist.faehrt ? (ist.richtung > 0 ? 100 : 0) : ist.p;
        this._hebel(i, hebel);
      }
      t.querySelector(".zeiger").style.transform = `rotate(${winkelVon(ist.p)}deg)`;
      t.querySelector(".panzer").style.transform =
        `translateY(${(-ist.p / 100) * FENSTER.h}px)`;

      const pr = Math.round(ist.p);
      t.querySelector(".status").textContent = ist.faehrt
        ? (ist.richtung > 0 ? "fährt hoch …" : "fährt runter …")
        : pr >= 100 ? "offen" : pr <= 0 ? "geschlossen" : `${pr} % offen`;
    });

    // Waehrend einer Fahrt den Rueckmeldezeiger selbst weiterlaufen lassen
    if (irgendwoFahrt && !this._takt) this._takt = setInterval(() => this._aktualisieren(), 150);
    if (!irgendwoFahrt && this._takt) { clearInterval(this._takt); this._takt = null; }
  }
}

customElements.define("retro-rollladen-card", RetroRollladenCard);
window.customCards = window.customCards || [];
window.customCards.push({
  type: "retro-rollladen-card",
  name: "Retro-Rollladen",
  description: "Rollladen als Maschinentelegraf im Messing-Stil, mit Rueckmeldezeiger und Lamellenfenster",
});
