/**
 * Schlichte analoge Uhr fuer das iPad-Panel.
 * Duenner heller Ring, weisse Stunden-/Minutenzeiger, roter Sekundenzeiger.
 * Keine Ziffern, keine Teilstriche - bewusst ruhig gehalten.
 */
class IpadAnalogClock extends HTMLElement {
  setConfig(config) {
    this.config = config || {};
    this._size = this.config.size || 200;
    this._render();
  }

  connectedCallback() {
    this._start();
  }

  disconnectedCallback() {
    this._stop();
  }

  _start() {
    if (this._timer) return;
    this._tick();
    this._timer = setInterval(() => this._tick(), 1000);
  }

  _stop() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  _render() {
    if (this._root) return;
    this._root = this.attachShadow({ mode: "open" });
    const s = this._size;
    const c = s / 2;
    this._root.innerHTML = `
      <style>
        :host { display: block; }
        .wrap { display: flex; justify-content: center; }
        svg { overflow: visible; }
        .ring   { fill: rgba(255,255,255,0.04); stroke: rgba(255,255,255,0.35); stroke-width: 1.5; }
        .hand   { stroke: #ffffff; stroke-linecap: round; }
        .hour   { stroke-width: 4; }
        .minute { stroke-width: 3; }
        .second { stroke: #e04a4a; stroke-width: 1.4; stroke-linecap: round; }
        .pin    { fill: #ffffff; }
      </style>
      <div class="wrap">
        <svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
          <circle class="ring" cx="${c}" cy="${c}" r="${c - 2}"></circle>
          <line class="hand hour"   id="h" x1="${c}" y1="${c}" x2="${c}" y2="${c - s * 0.26}"></line>
          <line class="hand minute" id="m" x1="${c}" y1="${c}" x2="${c}" y2="${c - s * 0.38}"></line>
          <line class="second"      id="s" x1="${c}" y1="${c + s * 0.06}" x2="${c}" y2="${c - s * 0.40}"></line>
          <circle class="pin" cx="${c}" cy="${c}" r="3.5"></circle>
        </svg>
      </div>
    `;
    this._h = this._root.getElementById("h");
    this._m = this._root.getElementById("m");
    this._s = this._root.getElementById("s");
  }

  _tick() {
    if (!this._h) return;
    const now = new Date();
    const sec = now.getSeconds();
    const min = now.getMinutes() + sec / 60;
    const hr = (now.getHours() % 12) + min / 60;
    const c = this._size / 2;
    const turn = (el, deg) => el.setAttribute("transform", `rotate(${deg} ${c} ${c})`);
    turn(this._h, hr * 30);
    turn(this._m, min * 6);
    turn(this._s, sec * 6);
  }

  getCardSize() {
    return Math.ceil(this._size / 50);
  }

  static getConfigElement() { return null; }
  static getStubConfig() { return { size: 200 }; }
}

customElements.define("ipad-analog-clock", IpadAnalogClock);
window.customCards = window.customCards || [];
window.customCards.push({
  type: "ipad-analog-clock",
  name: "iPad Analoguhr",
  description: "Schlichte analoge Uhr ohne Ziffern",
});
