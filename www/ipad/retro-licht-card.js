/**
 * Retro-Lichtschalter fuer das iPad-Panel (03.10.2026), passend zu den
 * Messing-Instrumenten der Heizungsseite.
 *
 * mode: dimmer   Lichtstellpult wie im alten Theater: senkrechte Schieberegler mit
 *                Bakelitknopf, Skala 0-10, darueber eine Gluehbirne, die mit der
 *                Helligkeit aufglimmt. Ziehen stellt die Helligkeit (0 = aus),
 *                Tipp auf die Birne schaltet um.
 * mode: schalter Porzellan-Wippschalter mit Bakelitwippe und Kontrolllampe.
 *                Tipp schaltet um.
 *
 * Optionen:
 *   entities   (Pflicht) Liste aus { entity, name } oder nur entity_id
 *   mode       "dimmer" oder "schalter", Standard "schalter"
 *   title      Gravur auf dem Messingschild, optional
 *   columns    Spalten (nur schalter), Standard 6
 *
 * Langes Druecken (0,6 s) auf Birne, Schalter oder Namensschild oeffnet more-info.
 */

const MESSING = "linear-gradient(135deg, #f6e2a4 0%, #c99a43 32%, #8a6020 58%, #e4c172 82%, #a5772d 100%)";
const SERIF = `Georgia, "Times New Roman", serif`;

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
  .titel { display: inline-block; margin: 0 0 12px 8px; padding: 3px 12px; border-radius: 4px;
           font-family: ${SERIF}; font-size: 11px; letter-spacing: 3px; color: #2a2118;
           background: radial-gradient(ellipse at 40% 30%, #fdf8ea, #e9dcb8);
           border: 1px solid #3b2a10; box-shadow: inset 0 1px 2px rgba(0,0,0,0.3); }
  button { font: inherit; border: 0; background: none; padding: 0; color: inherit; cursor: pointer;
           -webkit-tap-highlight-color: transparent; }
  .namensschild { display: block; max-width: 100%; margin: 8px auto 0; padding: 3px 7px; border-radius: 3px;
                  font-family: ${SERIF}; font-size: 11px; letter-spacing: 0.5px; color: #2a2118;
                  background: radial-gradient(ellipse at 40% 30%, #fdf8ea, #e6d7b0);
                  border: 1px solid #5a3d10; box-shadow: inset 0 1px 1px rgba(0,0,0,0.25);
                  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  /* ---------- Lichtstellpult ---------- */
  .pult { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; gap: 6px; }
  .kanal { display: flex; flex-direction: column; align-items: center; min-width: 0; }
  .kanal.weg { opacity: 0.45; }
  .kanal .namensschild { width: 100%; height: 32px; white-space: normal; line-height: 1.15;
                         display: flex; align-items: center; justify-content: center; text-align: center; }
  .birne { position: relative; width: 30px; height: 30px; border-radius: 50%;
           background: radial-gradient(circle at 35% 35%, #fff3c4, #c99a43 45%, #5e400f);
           box-shadow: 0 1px 2px rgba(0,0,0,0.45); }
  .birne .glas { position: absolute; inset: 5px; border-radius: 50%;
                 background: radial-gradient(circle at 38% 35%, #6a5d50, #2e2620 70%);
                 box-shadow: inset 0 0 2px #000; transition: background 0.4s, box-shadow 0.4s; }
  .birne .glas::after { content: ""; position: absolute; left: 4px; top: 3px; width: 6px; height: 5px;
                        border-radius: 50%; background: rgba(255,255,255,0.55); }
  .prozent { margin: 5px 0 6px; font-family: ${SERIF}; font-size: 12px; color: #2a1d0c; height: 15px;
             text-shadow: 0 1px 0 rgba(255,243,196,0.55); }
  .schiene { position: relative; width: 74px; height: 168px; touch-action: none; cursor: grab;
             border-radius: 8px; background: radial-gradient(ellipse at 40% 30%, #fdf8ea, #e6d7b0);
             border: 1px solid #3b2a10; box-shadow: inset 0 2px 4px rgba(0,0,0,0.3); }
  .schiene:active { cursor: grabbing; }
  .strich { position: absolute; left: 7px; height: 1px; background: #2a2118; }
  .zahl { position: absolute; left: 25px; font-family: ${SERIF}; font-size: 9px; color: #2a2118;
          transform: translateY(-50%); }
  .schlitz { position: absolute; left: 47px; top: 14px; bottom: 14px; width: 6px; border-radius: 3px;
             background: linear-gradient(90deg, #1a120a, #3a2a1a 50%, #1a120a);
             box-shadow: inset 0 1px 2px #000, 0 1px 0 rgba(255,255,255,0.6); }
  .knopf { position: absolute; left: 33px; width: 34px; height: 28px; border-radius: 5px;
           background: linear-gradient(180deg, #5a4c40 0%, #2b2018 45%, #120d09 100%);
           border: 1px solid #0d0907; box-shadow: 0 3px 4px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.25);
           transition: top 0.35s cubic-bezier(.3,1.3,.5,1); }
  .knopf::before { content: ""; position: absolute; left: 4px; right: 4px; top: 12px; height: 3px;
                   border-radius: 2px; background: #f3ead2; }
  .knopf::after { content: ""; position: absolute; left: -1px; right: -1px; bottom: -5px; height: 5px;
                  border-radius: 0 0 4px 4px; background: ${MESSING}; border: 1px solid #4a3410; border-top: 0; }
  .ziehen .knopf { transition: none; }

  /* ---------- Wippschalter ---------- */
  .reihe { display: grid; gap: 12px 10px; }
  .schalter { display: flex; flex-direction: column; align-items: center; min-width: 0; width: 100%; }
  .schalter.weg { opacity: 0.45; }
  .dose { position: relative; width: 86px; height: 86px; border-radius: 12px;
          background: radial-gradient(ellipse at 35% 25%, #fffdf5 0%, #f1e8d2 60%, #d8c9a6 100%);
          border: 1px solid #8a7550;
          box-shadow: 0 3px 5px rgba(0,0,0,0.45), inset 0 -2px 3px rgba(0,0,0,0.15), inset 0 1px 0 #fff; }
  .dose .schraube { width: 7px; height: 7px; left: 50%; margin-left: -3.5px; }
  .dose .schraube::after { top: 3px; }
  .dose .o { top: 5px; } .dose .u { bottom: 5px; }
  .fenster { position: absolute; right: 9px; top: 9px; width: 8px; height: 8px; border-radius: 50%;
             background: radial-gradient(circle at 35% 35%, #8a7a66, #3a3028 70%);
             box-shadow: inset 0 0 1px #000; transition: background 0.3s, box-shadow 0.3s; }
  .wippe { position: absolute; left: 22px; top: 16px; width: 42px; height: 54px; border-radius: 6px;
           transform: perspective(160px) rotateX(-20deg);
           background: linear-gradient(180deg, #6b5240 0%, #3c2a1e 48%, #24170f 52%, #4a3526 100%);
           border: 1px solid #1a100a;
           box-shadow: 0 4px 4px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.25);
           transition: transform 0.18s ease-out, background 0.18s; }
  .wippe span { position: absolute; left: 0; right: 0; text-align: center; font-family: ${SERIF};
                font-size: 11px; color: rgba(243,234,210,0.75); }
  .wippe .i { top: 4px; } .wippe .null { bottom: 4px; }
  /* Glimmfenster in der Wippe wie bei alten Kontrollschaltern */
  .wippe::after { content: ""; position: absolute; left: 12px; right: 12px; top: 21px; height: 9px;
                  border-radius: 2px; background: #1a110b; box-shadow: inset 0 1px 2px #000;
                  transition: background 0.25s, box-shadow 0.25s; }
  .schalter.an .wippe::after { background: linear-gradient(#fff2c8, #ffb347 45%, #e07a10);
                               box-shadow: 0 0 10px 2px rgba(255,170,60,0.9); }
  .schalter.an .wippe .i { color: #ffd27a; }
  .dose { transition: box-shadow 0.3s; }
  .schalter.an .dose { box-shadow: 0 0 22px 6px rgba(255,176,64,0.6), 0 3px 5px rgba(0,0,0,0.45),
                                   inset 0 -2px 3px rgba(0,0,0,0.15), inset 0 1px 0 #fff; }
  .schalter .namensschild { transition: background 0.3s, box-shadow 0.3s; }
  .kanal .namensschild { transition: background 0.3s, box-shadow 0.3s; }
  .kanal.an .namensschild,
  .schalter.an .namensschild { background: linear-gradient(#fff4d6, #ffd27a); font-weight: bold;
                               box-shadow: 0 0 10px rgba(255,176,64,0.7), inset 0 1px 1px rgba(255,255,255,0.6); }
  .schalter.an .wippe { transform: perspective(160px) rotateX(20deg);
           background: linear-gradient(180deg, #24170f 0%, #3c2a1e 48%, #4a3526 52%, #6b5240 100%);
           box-shadow: 0 -2px 4px rgba(0,0,0,0.3), inset 0 -1px 0 rgba(255,255,255,0.2); }
  .schalter.an .fenster, .kanal.an .birne .glas { background: radial-gradient(circle at 38% 35%, #fff6d8 0 18%, #ffb347 55%, #c46a12 100%); }
  .schalter.an .fenster { box-shadow: 0 0 8px #ffb347; }
`;

class RetroLichtCard extends HTMLElement {
  setConfig(config) {
    if (!Array.isArray(config.entities) || !config.entities.length) throw new Error("entities fehlt");
    this._config = { mode: "schalter", columns: 6, ...config };
    this._eintraege = config.entities.map((e) => (typeof e === "string" ? { entity: e } : e));
    this._gebaut = false;
    this._vorgabe = {}; // Helligkeit/Zustand, bis HA die Aenderung bestaetigt
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._gebaut) this._bauen();
    this._aktualisieren();
  }

  getCardSize() { return this._config.mode === "dimmer" ? 5 : 3; }

  _name(e) {
    const st = this._hass.states[e.entity];
    return e.name || (st && st.attributes.friendly_name) || e.entity;
  }

  _bauen() {
    const c = this._config;
    const root = this.shadowRoot || this.attachShadow({ mode: "open" });
    const titel = c.title ? `<div class="titel">${String(c.title).toUpperCase()}</div>` : "";
    let inhalt;
    if (c.mode === "dimmer") {
      const skala = [10, 5, 0].map((z) => {
        const y = 14 + 14 + (1 - z / 10) * (168 - 28 - 28);
        return `<span class="zahl" style="top:${y}px">${z}</span>`;
      }).join("") + Array.from({ length: 11 }, (_, k) => {
        const y = 14 + 14 + (k / 10) * (168 - 28 - 28);
        return `<span class="strich" style="top:${y}px; width:${k % 5 === 0 ? 14 : 8}px"></span>`;
      }).join("");
      inhalt = `<div class="pult">${this._eintraege.map((e, i) => `
        <div class="kanal" data-i="${i}">
          <button class="birne" data-i="${i}"><span class="glas"></span></button>
          <div class="prozent"></div>
          <div class="schiene" data-i="${i}">${skala}<div class="schlitz"></div><div class="knopf"></div></div>
          <button class="namensschild" data-i="${i}">${this._name(e)}</button>
        </div>`).join("")}</div>`;
    } else {
      inhalt = `<div class="reihe" style="grid-template-columns: repeat(${c.columns}, 1fr)">${this._eintraege.map((e, i) => `
        <button class="schalter" data-i="${i}">
          <div class="dose">
            <span class="schraube o"></span><span class="schraube u"></span>
            <span class="fenster"></span>
            <div class="wippe"><span class="i">I</span><span class="null">0</span></div>
          </div>
          <span class="namensschild">${this._name(e)}</span>
        </button>`).join("")}</div>`;
    }
    root.innerHTML = `
      <style>${STIL}</style>
      <ha-card>
        <div class="platte">
          <span class="schraube lo"></span><span class="schraube ro"></span>
          <span class="schraube lu"></span><span class="schraube ru"></span>
          ${titel}
          ${inhalt}
        </div>
      </ha-card>`;

    if (c.mode === "dimmer") {
      root.querySelectorAll(".birne").forEach((b) => this._tippHalten(b, () => this._umschalten(+b.dataset.i)));
      root.querySelectorAll(".namensschild").forEach((b) => this._tippHalten(b, () => this._mehrInfo(+b.dataset.i), true));
      root.querySelectorAll(".schiene").forEach((s) => this._schieben(s));
    } else {
      root.querySelectorAll(".schalter").forEach((b) => this._tippHalten(b, () => this._umschalten(+b.dataset.i)));
    }
    this._gebaut = true;
  }

  // Tipp = aktion, langes Druecken = more-info (oder nur more-info bei nurInfo)
  _tippHalten(el, aktion, nurInfo = false) {
    let timer = null, gehalten = false;
    el.addEventListener("pointerdown", () => {
      gehalten = false;
      clearTimeout(timer);
      timer = setTimeout(() => { gehalten = true; this._mehrInfo(+el.dataset.i); }, 600);
    });
    const ende = () => clearTimeout(timer);
    el.addEventListener("pointerup", ende);
    el.addEventListener("pointerleave", ende);
    el.addEventListener("pointercancel", ende);
    el.addEventListener("click", () => {
      if (gehalten) return;
      if (nurInfo) this._mehrInfo(+el.dataset.i); else aktion();
    });
  }

  _mehrInfo(i) {
    const ev = new Event("hass-more-info", { bubbles: true, composed: true });
    ev.detail = { entityId: this._eintraege[i].entity };
    this.dispatchEvent(ev);
  }

  _umschalten(i) {
    const id = this._eintraege[i].entity;
    const st = this._hass.states[id];
    if (!st || st.state === "unavailable") return;
    const an = st.state !== "on";
    // Beim Einschalten eines Dimmers waehlt die Lampe ihre letzte Helligkeit selbst - nichts vorgeben
    if (this._config.mode !== "dimmer") this._merken(i, an);
    else if (!an) this._merken(i, 0);
    this._hass.callService("light", an ? "turn_on" : "turn_off", { entity_id: id });
    this._aktualisieren();
  }

  _merken(i, wert) {
    this._vorgabe[i] = { wert, bis: Date.now() + 4000 };
  }

  _prozent(st) {
    if (!st || st.state !== "on") return 0;
    const b = st.attributes.brightness;
    return b == null ? 100 : Math.max(1, Math.round((b / 255) * 100));
  }

  // Geometrie der Schiene: Knopf 28 px, je 14 px Rand oben und unten
  _knopfTop(p) { return 14 + (1 - p / 100) * (168 - 28 - 28); }

  _schieben(schiene) {
    const i = +schiene.dataset.i;
    const kanal = schiene.closest(".kanal");
    const ausY = (ev) => {
      const r = schiene.getBoundingClientRect();
      const skal = r.height / 168; // falls die Karte skaliert dargestellt wird
      const y = (ev.clientY - r.top) / skal - 14 - 14;
      return Math.round(Math.min(100, Math.max(0, (1 - y / (168 - 28 - 28)) * 100)));
    };
    let aktiv = false;
    schiene.addEventListener("pointerdown", (ev) => {
      const st = this._hass.states[this._eintraege[i].entity];
      if (!st || st.state === "unavailable") return;
      aktiv = true;
      schiene.setPointerCapture(ev.pointerId);
      kanal.classList.add("ziehen");
      this._zeigeKanal(i, ausY(ev));
    });
    schiene.addEventListener("pointermove", (ev) => {
      if (aktiv) this._zeigeKanal(i, ausY(ev));
    });
    const loslassen = (ev) => {
      if (!aktiv) return;
      aktiv = false;
      kanal.classList.remove("ziehen");
      const p = ausY(ev);
      const id = this._eintraege[i].entity;
      this._merken(i, p);
      if (p <= 0) this._hass.callService("light", "turn_off", { entity_id: id });
      else this._hass.callService("light", "turn_on", { entity_id: id, brightness_pct: p });
      this._zeigeKanal(i, p);
    };
    schiene.addEventListener("pointerup", loslassen);
    schiene.addEventListener("pointercancel", loslassen);
  }

  _zeigeKanal(i, p) {
    const k = this.shadowRoot.querySelector(`.kanal[data-i="${i}"]`);
    k.classList.toggle("an", p > 0);
    k.querySelector(".knopf").style.top = this._knopfTop(p) + "px";
    k.querySelector(".prozent").textContent = p > 0 ? `${p} %` : "AUS";
    // Gluehbirne glimmt mit der Helligkeit
    const glas = k.querySelector(".glas");
    glas.style.boxShadow = p > 0 ? `0 0 ${4 + p / 6}px ${p / 12}px rgba(255,179,71,${0.25 + p / 160})` : "";
    glas.style.opacity = p > 0 ? String(0.55 + p / 220) : "";
  }

  _aktualisieren() {
    if (!this._hass || !this._gebaut) return;
    const root = this.shadowRoot;
    const jetzt = Date.now();
    this._eintraege.forEach((e, i) => {
      const st = this._hass.states[e.entity];
      const weg = !st || st.state === "unavailable";
      const v = this._vorgabe[i];
      if (this._config.mode === "dimmer") {
        const k = root.querySelector(`.kanal[data-i="${i}"]`);
        if (k.classList.contains("ziehen")) return;
        k.classList.toggle("weg", weg);
        let p = this._prozent(st);
        if (v && v.bis > jetzt && Math.abs(v.wert - p) > 2) p = v.wert;
        else delete this._vorgabe[i];
        this._zeigeKanal(i, p);
        if (weg) k.querySelector(".prozent").textContent = "–";
      } else {
        const b = root.querySelector(`.schalter[data-i="${i}"]`);
        b.classList.toggle("weg", weg);
        let an = !!st && st.state === "on";
        if (v && v.bis > jetzt && v.wert !== an) an = v.wert;
        else delete this._vorgabe[i];
        b.classList.toggle("an", an);
      }
    });
  }
}

customElements.define("retro-licht-card", RetroLichtCard);
window.customCards = window.customCards || [];
window.customCards.push({
  type: "retro-licht-card",
  name: "Retro-Lichtschalter",
  description: "Lichtstellpult mit Schiebereglern oder Porzellan-Wippschalter im Messing-Stil",
});
