/**
 * Zweispaltiges Panel-Layout: feste Sidebar links, Inhalt rechts.
 * Ersetzt die card-mod-Bastelei am horizontal-stack/grid - die HA-Container-
 * karten haben keine ha-card, an die card-mod seine Styles haengen koennte.
 *
 * Optionen:
 *   sidebar        (Pflicht) Kartenkonfiguration fuer die linke Spalte
 *   content        (Pflicht) Kartenkonfiguration fuer die rechte Spalte
 *   sidebar_width  Standard "250px"
 *   background     Bildpfad fuer den Hintergrund, z.B. "/local/ipad/bg.jpg".
 *                  Wechselt die Datei taeglich unter gleichem Namen, sorgt der
 *                  angehaengte Tagesstempel dafuer, dass der Browser neu laedt.
 *   caption_entity Sensor mit Titel des Bildes (Attribut "copyright") fuer die
 *                  Bildzeile unten. Reicht der Inhalt bis in diese Zeile (kleines
 *                  iPad, langer View), blendet sie sich aus, statt darueber zu liegen.
 *                  dezente Bildunterschrift unten rechts
 *   background_overlay  CSS-Farbe/Verlauf ueber dem Bild. Pflicht bei taeglich
 *                  wechselnden Bildern: ohne ihn verschwindet heller Text vor
 *                  einem hellen Motiv. "none" schaltet ihn ab.
 *   content_shadow  Schlagschatten hinter den Inhalten, als CSS-filter. Greift
 *                  anders als text-shadow auch in die Shadow-Roots der
 *                  Kind-Karten hinein. "none" schaltet ihn ab.
 *   nav            Navigationsliste als [{name, icon, path, count_entities?,
 *                  count_state?}]. Traegt ein Eintrag count_entities, zeigt die
 *                  Karte die Anzahl der Entities in count_state (Standard "on";
 *                  auch als Liste, z.B. ["on", "run"] - noetig, wenn eine Gruppe
 *                  gemischte Entitytypen enthaelt: binary_sensor melden "on",
 *                  Home-Connect-Betriebszustaende "run")
 *                  als Zahl neben dem Namen - und blendet sie bei 0 aus.
 *                  Ein `path`, der mit "/" beginnt, gilt als absolutes Ziel und
 *                  bekommt kein nav_base davor - so laesst sich auch auf ein
 *                  anderes Dashboard wechseln. `divider_before: true` setzt eine
 *                  Trennlinie ueber den Eintrag.
 *                  Die Karte rendert
 *                  sie unter der Sidebar und markiert den aktiven Eintrag selbst
 *                  (27.09.2026) `info: [{entity, label?, decimals?, unit?, states?}]` zeigt
 *                  (`states` seit 02.10.2026: {on: "an", off: "aus"} fuer Text statt Zahl)
 *                  kleine Messwerte hinter dem Namen, z.B. "EG 20,7° · OG 21,5°".
 *                  anhand der URL - damit ist die Liste in jeder View identisch
 *                  und muss nicht pro Seite von Hand umgestellt werden.
 *   nav_base       Pfad des Dashboards, z.B. "/ipad-home"
 *   corner         Optionale Kartenkonfig, fest in der rechten unteren Ecke
 *                  des Inhaltsbereichs - ausserhalb des normalen Kartenflusses
 *   dialogs        Map von URL-Hash auf { name, icon, cards, width }. Oeffnet sich,
 *                  sobald der Hash gesetzt wird - eine Karte darin braucht also
 *                  nur tap_action: navigate auf "#name". Nutzt ein natives
 *                  <dialog> im Top-Layer, weil Bubble Cards eigenes Pop-up sein
 *                  Overlay in den View-Container haengt und aus dieser Shadow-
 *                  Root heraus unbedienbar bleibt (grauer Schleier davor).
 *                  `width` ist optional (CSS-Wert, z.B. "min(760px, 94vw)"),
 *                  Standard sind 460 px.
 *   standby_after  Minuten ohne Berührung, nach denen sich ein dunkles Standby-
 *                  Bild mit Uhr über das Panel legt. 0 oder fehlend = aus.
 *                  Die erste Berührung weckt nur auf und wird NICHT an die Karten
 *                  darunter weitergegeben - sonst schaltet man im Dunkeln
 *                  versehentlich eine Lampe.
 *   standby_entity Optionaler Sensor, dessen Wert im Standby unter dem Datum steht
 *   standby_ziel   Optional: {jahr, entity, attribut, feld} - zeigt im Standby eine
 *                  spanische Flagge mit der Jahreszahl und dem Fortschritt in
 *                  Prozent. `attribut` ist das Attribut der Entity, `feld` der
 *                  Schluessel darin (z.B. plan -> fortschritt_pct).
 *   standby_label  Beschriftung davor, z.B. "Draußen". Ohne sie steht dort nur der
 *                  Wert - der friendly_name technischer Entities ist als Aufschrift
 *                  unbrauchbar ("Außentemperatur Avarma korrigiert")
 *   sidebar_background / content_padding  Feinjustierung
 */
class IpadPanelLayout extends HTMLElement {
  setConfig(config) {
    if (!config || !config.sidebar || !config.content) {
      throw new Error("ipad-panel-layout braucht 'sidebar' und 'content'");
    }
    this._config = config;
    this._cards = {};
    this._dialogKarten = {};
    this._renderShell();
    this._buildChildren();
    this._pruefeHash();
  }

  connectedCallback() {
    if (!this._hoeheAbo) {
      this._hoeheAbo = () => this._passeHoeheAn();
      window.addEventListener("resize", this._hoeheAbo);
      window.addEventListener("orientationchange", this._hoeheAbo);
    }
    // Die Listener gehoeren hierher, nicht in setConfig: disconnectedCallback
    // meldet sie ab, wenn HA die Karte beim View-Wechsel aushaengt. Wird sie
    // spaeter wiederverwendet, laeuft setConfig nicht erneut - die Navigation
    // wuesste dann nichts mehr von Seitenwechseln und bliebe auf der alten
    // Seite markiert.
    if (!this._hashAbo && this._config && (this._config.dialogs || this._config.nav)) {
      // Drei Quellen noetig: HA's navigate-Action laeuft ueber history.pushState
      // und feuert damit KEIN hashchange - dafuer das eigene location-changed.
      // hashchange/popstate decken Browsernavigation und den Zurueck-Knopf ab.
      this._hashAbo = () => this._pruefeHash();
      window.addEventListener("hashchange", this._hashAbo);
      window.addEventListener("location-changed", this._hashAbo);
      window.addEventListener("popstate", this._hashAbo);
    }
    if (!this._aktivAbo) {
      // capture=true, damit die Berührung auch dann ankommt, wenn eine Karte
      // darunter das Ereignis stoppt.
      this._aktivAbo = (ev) => this._aktivitaet(ev);
      for (const typ of ["pointerdown", "keydown", "wheel"]) {
        window.addEventListener(typ, this._aktivAbo, true);
      }
    }
    this._standbyPlanen();
    this._pruefeHash();
    this._passeHoeheAn();
  }

  /** Jede Berührung verschiebt das Standby. Ist es gerade aktiv, weckt sie das
   *  Panel und wird verworfen, statt an die Karte darunter durchzuschlagen. */
  _aktivitaet(ev) {
    if (this._standbyAktiv) {
      ev.stopPropagation();
      if (ev.cancelable) ev.preventDefault();
      this._standbyBeenden();
    }
    this._standbyPlanen();
  }

  _standbyPlanen() {
    const min = Number(this._config && this._config.standby_after);
    clearTimeout(this._standbyTimer);
    if (!min || min <= 0) return;
    this._standbyTimer = setTimeout(() => this._standbyZeigen(), min * 60000);
  }

  _standbyZeigen() {
    if (!this._standby || this._standbyAktiv) return;
    if (this._dialog && this._dialog.open) return;   // offener Dialog geht vor
    this._standbyAktiv = true;
    this._standbyMalen();
    this._standby.hidden = false;
    this._standbyTakt = setInterval(() => this._standbyMalen(), 15000);
  }

  _standbyBeenden() {
    if (!this._standby) return;
    this._standbyAktiv = false;
    this._standby.hidden = true;
    clearInterval(this._standbyTakt);
    this._standbyTakt = null;
  }

  _standbyMalen() {
    if (!this._standby) return;
    const jetzt = new Date();
    const wd = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
    const mo = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August",
                "September", "Oktober", "November", "Dezember"];
    const zz = (n) => String(n).padStart(2, "0");
    this._standby.querySelector(".sb-zeit").textContent =
      `${zz(jetzt.getHours())}:${zz(jetzt.getMinutes())}`;
    this._standby.querySelector(".sb-datum").textContent =
      `${wd[jetzt.getDay()]}, ${jetzt.getDate()}. ${mo[jetzt.getMonth()]}`;
    const extra = this._standby.querySelector(".sb-extra");
    const id = this._config.standby_entity;
    const st = id && this._hass ? this._hass.states[id] : null;
    if (st && st.state && st.state !== "unavailable" && st.state !== "unknown") {
      const einheit = (st.attributes && st.attributes.unit_of_measurement) || "";
      const label = this._config.standby_label || "";
      // Dezimalpunkt zu Komma, aber nur bei reinen Zahlen.
      const wert = /^-?\d+(\.\d+)?$/.test(st.state) ? st.state.replace(".", ",") : st.state;
      extra.textContent = `${label ? label + "  " : ""}${wert} ${einheit}`.trim();
    } else {
      extra.textContent = "";
    }
    this._standbyZiel();
  }

  /** Fortschrittsflagge im Standby. Bewusst ohne Verlinkung - das Standby soll
   *  nur wecken, nicht navigieren. */
  _standbyZiel() {
    const el = this._standby ? this._standby.querySelector(".sb-flagge") : null;
    if (!el) return;
    const z = this._config.standby_ziel;
    if (!z || !this._hass) { el.hidden = true; return; }
    const st = this._hass.states[z.entity];
    const quelle = st && z.attribut ? st.attributes[z.attribut] : null;
    const wert = quelle && z.feld ? quelle[z.feld] : null;
    if (wert === null || wert === undefined || isNaN(Number(wert))) { el.hidden = true; return; }
    el.querySelector(".sb-jahr").textContent = z.jahr || "";
    el.querySelector(".sb-pct").textContent =
      Number(wert).toFixed(2).replace(".", ",") + " %";
    el.hidden = false;
  }

  /** Navigation aus der Konfiguration bauen. Der aktive Eintrag ergibt sich aus
   *  der URL, nicht aus der Konfiguration - deshalb ist die Liste in jeder View
   *  identisch. */
  _zeichneNav() {
    if (!this._nav) return;
    const eintraege = this._config.nav || [];
    const basis = (this._config.nav_base || "").replace(/\/$/, "");
    this._nav.replaceChildren();
    for (const e of eintraege) {
      const rohpfad = String(e.path || "");
      // Absolutes Ziel (fuehrender Slash) bleibt unangetastet - damit sind auch
      // andere Dashboards erreichbar, nicht nur Views dieses einen.
      const ziel = rohpfad.startsWith("/") ? rohpfad : basis + "/" + rohpfad;
      const a = document.createElement("a");
      a.href = ziel;
      const name = document.createElement("span");
      name.textContent = e.name || "";
      const icon = document.createElement("ha-icon");
      icon.setAttribute("icon", e.icon || "mdi:circle-small");
      const zahl = document.createElement("span");
      zahl.className = "nav-zahl";
      zahl.hidden = true;
      if (Array.isArray(e.count_entities) && e.count_entities.length) {
        const zust = e.count_state || "on";
        zahl.dataset.entities = e.count_entities.join(",");
        zahl.dataset.state = Array.isArray(zust) ? zust.join(",") : String(zust);
      }
      const info = document.createElement("span");
      info.className = "nav-info";
      if (Array.isArray(e.info) && e.info.length) info.dataset.info = JSON.stringify(e.info);
      a.append(name, info, zahl, icon);
      if (e.divider_before) a.classList.add("trenner");
      a.addEventListener("click", (ev) => {
        ev.preventDefault();
        if (window.location.pathname === ziel) return;
        history.pushState(null, "", ziel);
        window.dispatchEvent(new CustomEvent("location-changed", { bubbles: true, composed: true }));
        this._markiereNav();
      });
      this._nav.appendChild(a);
    }
    this._markiereNav();
    this._zaehleNav();
  }

  /** Zahlen an den Navigationseintraegen nachfuehren. Laeuft bei jedem
   *  hass-Update, schreibt aber nur ins DOM, wenn sich der Wert geaendert hat. */
  _zaehleNav() {
    if (!this._nav || !this._hass) return;
    for (const a of this._nav.children) {
      const zahl = a.querySelector(".nav-zahl");
      if (!zahl || !zahl.dataset.entities) continue;
      const gesucht = (zahl.dataset.state || "on").split(",");
      let n = 0;
      for (const id of zahl.dataset.entities.split(",")) {
        const st = this._hass.states[id];
        if (st && gesucht.includes(st.state)) n++;
      }
      const text = n > 0 ? String(n) : "";
      if (zahl.textContent !== text) zahl.textContent = text;
      zahl.hidden = n === 0;
    }
    this._infoNav();
  }

  /** Messwerte hinter Navigationseintraegen (Option `info`), deutsches Komma. */
  _infoNav() {
    if (!this._nav || !this._hass) return;
    for (const span of this._nav.querySelectorAll(".nav-info[data-info]")) {
      let teile = [];
      try {
        for (const i of JSON.parse(span.dataset.info)) {
          const st = this._hass.states[i.entity];
          // `states` uebersetzt Zustaende in Text, z.B. {on: "an", off: "aus"} (02.10.2026)
          if (i.states) {
            if (st && st.state in i.states) teile.push((i.label ? i.label + " " : "") + i.states[st.state]);
            continue;
          }
          const wert = st ? parseFloat(st.state) : NaN;
          if (isNaN(wert)) continue;
          const zahlText = wert.toFixed(i.decimals ?? 1).replace(".", ",");
          teile.push((i.label ? i.label + " " : "") + zahlText + (i.unit ?? "°"));
        }
      } catch (err) { teile = []; }
      const text = teile.join(" · ");
      if (span.textContent !== text) span.textContent = text;
    }
  }

  _markiereNav() {
    if (!this._nav) return;
    const hier = window.location.pathname.replace(/\/$/, "");
    for (const a of this._nav.children) {
      const ziel = new URL(a.href, window.location.origin).pathname.replace(/\/$/, "");
      if (ziel === hier) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    }
  }

  /** Verfuegbare Hoehe aus der eigenen Position im Viewport ableiten. Deckt
   *  Header sichtbar, Header per kiosk-mode ausgeblendet und Drehung gleich ab. */
  _passeHoeheAn() {
    if (!this._grid) return;
    requestAnimationFrame(() => {
      if (!this._grid || !this.isConnected) return;
      const oben = this.getBoundingClientRect().top;
      const rest = Math.max(320, window.innerHeight - Math.max(0, oben) - 4);
      this._grid.style.height = rest + "px";
      this._pruefeCaption();
    });
  }

  disconnectedCallback() {
    clearTimeout(this._standbyTimer);
    this._standbyBeenden();
    if (this._aktivAbo) {
      for (const typ of ["pointerdown", "keydown", "wheel"]) {
        window.removeEventListener(typ, this._aktivAbo, true);
      }
      this._aktivAbo = null;
    }
    if (this._hoeheAbo) {
      window.removeEventListener("resize", this._hoeheAbo);
      window.removeEventListener("orientationchange", this._hoeheAbo);
      this._hoeheAbo = null;
    }
    if (this._hashAbo) {
      window.removeEventListener("hashchange", this._hashAbo);
      window.removeEventListener("location-changed", this._hashAbo);
      window.removeEventListener("popstate", this._hashAbo);
      this._hashAbo = null;
    }
  }

  _pruefeHash() {
    if (!this._config) return;
    this._markiereNav();
    const hash = window.location.hash;
    const def = this._config.dialogs ? this._config.dialogs[hash] : null;
    if (def) {
      this._oeffneDialog(hash, def);
    } else if (this._dialog && this._dialog.open) {
      this._dialog.close();
    }
  }

  async _oeffneDialog(hash, def) {
    if (!this._dialog) return;
    const titel = this._dialog.querySelector(".dlg-titel");
    const koerper = this._dialog.querySelector(".dlg-koerper");
    titel.textContent = def.name || "";
    this._dialog.style.width = def.width || "";
    if (!this._dialogKarten[hash]) {
      const helpers = await window.loadCardHelpers();
      const wrap = document.createElement("div");
      for (const cfg of def.cards || []) {
        const el = await helpers.createCardElement(cfg);
        if (this._hass) el.hass = this._hass;
        wrap.appendChild(el);
      }
      this._dialogKarten[hash] = wrap;
    }
    koerper.replaceChildren(this._dialogKarten[hash]);
    if (!this._dialog.open) this._dialog.showModal();
  }

  /** Hash entfernen, ohne einen Eintrag in der History zu hinterlassen. */
  _schliesseDialog() {
    if (this._dialog && this._dialog.open) this._dialog.close();
    if (window.location.hash) {
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }

  set hass(hass) {
    this._hass = hass;
    for (const key of this._slotNamen()) {
      if (this._cards[key]) this._cards[key].hass = hass;
    }
    for (const wrap of Object.values(this._dialogKarten || {})) {
      for (const el of wrap.children) el.hass = hass;
    }
    this._updateCaption();
    this._pruefeCaption();
    this._zaehleNav();
  }

  _slotNamen() {
    return this._config.corner ? ["sidebar", "content", "corner"] : ["sidebar", "content"];
  }

  _renderShell() {
    if (!this._root) this._root = this.attachShadow({ mode: "open" });
    const c = this._config;
    const width = c.sidebar_width || "250px";
    const sbBg = c.sidebar_background || "rgba(10,14,24,0.55)";
    const pad = c.content_padding || "20px 26px";
    const overlay = c.background_overlay === undefined
      ? "linear-gradient(to right, rgba(6,10,18,0.86) 0%, rgba(6,10,18,0.72) 26%, rgba(6,10,18,0.62) 60%, rgba(6,10,18,0.68) 100%)"
      : c.background_overlay;
    const overlayCss = (!c.background || overlay === "none") ? "display: none;" : `background: ${overlay};`;
    const schatten = c.content_shadow === undefined
      ? "drop-shadow(0 1px 2px rgba(0,0,0,0.9))"
      : c.content_shadow;
    const schattenCss = (!c.background || schatten === "none") ? "" : `filter: ${schatten};`;
    const bg = c.background
      ? `background-image: url("${this._bustCache(c.background)}"); background-size: cover; background-position: center;`
      : "";
    this._root.innerHTML = `
      <style>
        :host { display: block; }
        .grid {
          display: grid;
          grid-template-columns: ${width} minmax(0, 1fr);
          /* Startwert; die echte Hoehe misst _passeHoeheAn() zur Laufzeit,
             weil kiosk-mode den Header ausblendet, --header-height aber stehen
             laesst - blind gerechnet bliebe unten ein dunkler Streifen. */
          height: calc(100vh - var(--header-height, 0px) - 8px);
          ${bg}
        }
        .overlay {
          position: absolute;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          ${overlayCss}
        }
        .sidebar {
          position: relative;
          z-index: 1;
          background: ${sbBg};
          padding: 24px 14px;
          box-sizing: border-box;
          overflow-y: auto;
          backdrop-filter: blur(8px);
        }
        .content {
          position: relative;
          z-index: 1;
          ${schattenCss}
          padding: ${pad};
          box-sizing: border-box;
          overflow-y: auto;
          min-width: 0;
        }
        .sidebar::-webkit-scrollbar, .content::-webkit-scrollbar { width: 0; }
        .nav { display: flex; flex-direction: column; gap: 2px; margin-top: 2px; }
        .nav a {
          display: flex; align-items: center; justify-content: space-between; gap: 10px;
          height: 36px; padding: 0 12px; border-radius: 10px;
          color: #c9d3e0; font-size: 15px; text-decoration: none;
          -webkit-tap-highlight-color: transparent;
        }
        .nav a > span:first-child { flex: 1; min-width: 0; }
        .nav a ha-icon { --mdc-icon-size: 24px; color: #8a94a6; flex-shrink: 0; }
        .nav-zahl {
          flex-shrink: 0;
          min-width: 20px;
          padding: 1px 6px;
          border-radius: 9px;
          background: rgba(245,166,35,0.9);
          color: #10131b;
          font-size: 11.5px;
          font-weight: 600;
          line-height: 1.5;
          text-align: center;
          font-variant-numeric: tabular-nums;
        }
        .nav-zahl[hidden] { display: none; }
        .nav-info { font-size: 12px; color: #8a94a6; white-space: nowrap; margin-right: 8px; }
        .nav-info:empty { display: none; }
        .nav a[aria-current="page"] .nav-info { color: #8fb8e8; }
        .nav a[aria-current="page"] { background: rgba(56,130,246,0.22); color: #5aa9ff; }
        .nav a[aria-current="page"] ha-icon { color: #5aa9ff; }
        .nav a:focus-visible { outline: 2px solid #5aa9ff; outline-offset: -2px; }
        .nav a.trenner {
          margin-top: 8px;
          padding-top: 8px;
          border-top: 1px solid rgba(255,255,255,0.12);
          border-radius: 0 10px 10px 0;
        }
        /* Kleine iPads (mini: Fenster ~744 px, Layout ~688 px): Navigation enger, sonst wird der
           letzte Eintrag (Ruecksprung ins Hauptdashboard) abgeschnitten. Grosses iPad bleibt gleich. */
        @media (max-height: 790px) {
          .nav { gap: 1px; }
          .nav a { height: 31px; font-size: 14.5px; }
          .nav a ha-icon { --mdc-icon-size: 21px; }
          .nav a.trenner { margin-top: 5px; padding-top: 5px; }
        }
        .corner {
          position: absolute;
          right: 20px;
          bottom: 14px;
          z-index: 2;
        }
        .caption {
          position: absolute;
          z-index: 2;
          /* Beginnt erst hinter der Sidebar, damit die Zeile das Seitenpanel
             nicht ueberlagert, und sitzt darin mittig. */
          left: ${width};
          right: 0;
          bottom: 10px;
          padding: 0 90px 0 26px;
          text-align: center;
          font-size: 11px;
          line-height: 1.35;
          color: rgba(255,255,255,0.62);
          text-shadow: 0 1px 3px rgba(0,0,0,0.75);
          pointer-events: none;
        }
        .caption b { font-weight: 500; color: rgba(255,255,255,0.8); }
        .caption { transition: opacity 0.3s; }
        .caption.verdeckt { opacity: 0; }
        .standby {
          position: absolute;
          inset: 0;
          z-index: 5;
          background: rgba(2,4,7,0.985);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: #e8eef7;
          user-select: none;
          cursor: none;
        }
        .standby[hidden] { display: none; }
        .sb-zeit {
          font-size: clamp(64px, 13vw, 132px);
          font-weight: 200;
          line-height: 1;
          letter-spacing: -0.02em;
          font-variant-numeric: tabular-nums;
        }
        .sb-datum { font-size: 19px; color: #8a94a6; margin-top: 10px; }
        .sb-extra { font-size: 15px; color: #6b7688; margin-top: 26px; }
        .sb-flagge {
          margin-top: 34px;
          /* 3:2 - das Seitenverhaeltnis der spanischen Flagge */
          width: 168px;
          height: 112px;
          border-radius: 6px;
          overflow: hidden;
          border: 1px solid rgba(0,0,0,0.4);
          background: linear-gradient(to bottom, #AA151B 0 22%, #F1BF00 22% 78%, #AA151B 78% 100%);
          text-align: center;
          box-shadow: 0 2px 12px rgba(0,0,0,0.55);
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        .sb-flagge[hidden] { display: none; }
        /* Beide Zeilen dicht beieinander, damit der Block in den mittleren
           50 % der Flagge bleibt - dem goldenen Streifen. */
        .sb-jahr { font-size: 30px; font-weight: 700; line-height: 0.85; color: #000000; }
        .sb-pct { font-size: 12px; font-weight: 600; margin-top: -2px; line-height: 1; color: #000000; }
        dialog.dlg {
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 22px;
          background: rgba(16,21,32,0.96);
          color: #e8eef7;
          padding: 0;
          width: min(460px, 92vw);
          max-height: 96vh;
          overflow-y: auto;
          box-shadow: 0 18px 50px rgba(0,0,0,0.6);
        }
        dialog.dlg::backdrop { background: rgba(0,0,0,0.55); }
        .dlg-kopf {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 18px 6px 20px;
        }
        .dlg-titel { font-size: 19px; font-weight: 500; }
        .dlg-zu {
          border: none;
          background: rgba(255,255,255,0.08);
          color: #e8eef7;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          font-size: 17px;
          line-height: 1;
          cursor: pointer;
        }
        .dlg-koerper { padding: 4px 14px 16px 14px; }
      </style>
      <div class="grid">
        <div class="overlay"></div>
        <div class="sidebar"><div class="sb-karten"></div><nav class="nav"></nav></div>
        <div class="content"></div>
        <div class="corner"></div>
        <div class="caption"></div>
        <div class="standby" hidden>
          <div class="sb-zeit"></div>
          <div class="sb-datum"></div>
          <div class="sb-extra"></div>
          <div class="sb-flagge" hidden>
            <div class="sb-jahr"></div>
            <div class="sb-pct"></div>
          </div>
        </div>
      </div>
      <dialog class="dlg">
        <div class="dlg-kopf">
          <span class="dlg-titel"></span>
          <button class="dlg-zu" aria-label="Schliessen">&times;</button>
        </div>
        <div class="dlg-koerper"></div>
      </dialog>
    `;
    this._slots = {
      sidebar: this._root.querySelector(".sb-karten"),
      content: this._root.querySelector(".content"),
      corner: this._root.querySelector(".corner"),
    };
    this._grid = this._root.querySelector(".grid");
    this._nav = this._root.querySelector(".nav");
    this._zeichneNav();
    this._caption = this._root.querySelector(".caption");
    this._slots.content.addEventListener("scroll", () => this._pruefeCaption(), { passive: true });
    this._standby = this._root.querySelector(".standby");
    this._dialog = this._root.querySelector("dialog.dlg");
    this._dialog.querySelector(".dlg-zu").addEventListener("click", () => this._schliesseDialog());
    // Schliessen ueber Esc oder Klick auf den Backdrop soll den Hash mitnehmen,
    // sonst laesst sich derselbe Dialog danach nicht wieder oeffnen.
    this._dialog.addEventListener("cancel", (e) => { e.preventDefault(); this._schliesseDialog(); });
    this._dialog.addEventListener("click", (e) => {
      if (e.target === this._dialog) this._schliesseDialog();
    });
    this._root.querySelector(".grid").style.position = "relative";
  }

  /** Tagesstempel an den Bildpfad haengen, damit ein taeglich ersetztes Bild
   *  unter gleichem Dateinamen nicht aus dem Browsercache kommt. */
  _bustCache(pfad) {
    if (!pfad || pfad.includes("?")) return pfad;
    const d = new Date();
    const stempel = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
    return `${pfad}?v=${stempel}`;
  }

  /** Bildzeile nur zeigen, wenn der Inhalt (an der aktuellen Scrollposition)
   *  oberhalb von ihr endet - sonst laege der Text auf den Karten. */
  _pruefeCaption() {
    const inhalt = this._slots && this._slots.content;
    if (!this._caption || !inhalt || !this.isConnected) return;
    // Gemessen an einer leeren Markierung hinter der Karte: scrollHeight zaehlt
    // den unteren Innenabstand nicht in jedem Browser gleich mit.
    const marke = inhalt.querySelector(":scope > .inhalt-ende");
    if (!marke) return;
    // Der Stack kann kuerzer gemeldet werden als seine Kinder (09.10.2026, Heizung:
    // Stack-Unterkante 692, letzte Karte 727) - dann saesse die Markierung zu hoch.
    // Deshalb zusaetzlich die Unterkanten der Kindkarten im Shadow-Root heranziehen.
    let unten = marke.getBoundingClientRect().top;
    const rootEl = this._cards.content && this._cards.content.shadowRoot
      && this._cards.content.shadowRoot.querySelector("#root");
    if (rootEl) {
      for (const kind of rootEl.children) unten = Math.max(unten, kind.getBoundingClientRect().bottom);
    }
    const frei = unten <= this._caption.getBoundingClientRect().top - 4;
    this._caption.classList.toggle("verdeckt", !frei);
  }

  _updateCaption() {
    if (!this._caption) return;
    const id = this._config.caption_entity;
    const st = id && this._hass ? this._hass.states[id] : null;
    if (!st || !st.state || st.state === "unavailable" || st.state === "unknown") {
      this._caption.textContent = "";
      return;
    }
    const rechte = (st.attributes && st.attributes.copyright) || "";
    this._caption.innerHTML = rechte
      ? `<b>${st.state}</b><br>${rechte}`
      : `<b>${st.state}</b>`;
  }

  async _buildChildren() {
    const helpers = await window.loadCardHelpers();
    for (const key of this._slotNamen()) {
      const el = await helpers.createCardElement(this._config[key]);
      if (this._hass) el.hass = this._hass;
      this._cards[key] = el;
      this._slots[key].replaceChildren(el);
      if (key === "content") {
        const marke = document.createElement("div");
        marke.className = "inhalt-ende";
        this._slots[key].append(marke);
        // Kindkarten koennen auch nach den festen Pruefzeiten unten noch wachsen
        // (Resources laden spaet nach, 09.10.2026 Heizung auf dem kleinen iPad) -
        // deshalb zusaetzlich bei jeder Groessenaenderung der Inhaltskarte pruefen.
        if (this._groesseAbo) this._groesseAbo.disconnect();
        this._groesseAbo = new ResizeObserver(() => this._pruefeCaption());
        this._groesseAbo.observe(el);
      }
    }
    this._passeHoeheAn();
    // Kindkarten rendern asynchron nach; ihre endgueltige Hoehe steht erst spaeter fest
    for (const ms of [500, 1500, 4000]) setTimeout(() => this._pruefeCaption(), ms);
  }

  getCardSize() { return 12; }
  static getStubConfig() { return { sidebar_width: "250px" }; }
}

customElements.define("ipad-panel-layout", IpadPanelLayout);
window.customCards = window.customCards || [];
window.customCards.push({
  type: "ipad-panel-layout",
  name: "iPad Panel-Layout",
  description: "Feste Sidebar links, Inhalt rechts",
});

/**
 * ipad-rahmen (27.09.2026): Rahmen um eine oder mehrere Karten - Ersatz fuer
 * custom:vertical-stack-in-card, das auf Home und Haushaltsgeraete nach dem Laden
 * oft falsch dastand, bis man die Seite neu zog.
 *
 * Warum eigen: vertical-stack-in-card baut seine Kinder asynchron und reicht
 * `hass` nur an Karten weiter, die zu dem Zeitpunkt schon fertig sind; eine Karte,
 * deren Code erst spaeter geladen wird (trash-card, clock-weather-card), meldet sich
 * per `ll-rebuild`, und danach wird der ganze Stapel noch einmal umgebaut. Auf dem
 * iPad mit langsamerem Laden reisst diese Kette gern ab. Hier gilt: jedes Kind
 * bekommt `hass` sofort und nach dem Einhaengen noch einmal, ein `ll-rebuild` baut
 * neu, und ein veralteter Bauvorgang wird verworfen (Token), statt einen neueren zu
 * ueberschreiben.
 *
 *   type: custom:ipad-rahmen
 *   style: "background: ...; border-radius: 16px; ..."   # CSS fuer den Rahmen (ha-card)
 *   cards: [ ... ]                                         # oder: card: { ... }
 */
class IpadRahmen extends HTMLElement {
  setConfig(config) {
    if (!config || (!config.card && !Array.isArray(config.cards))) {
      throw new Error("ipad-rahmen braucht 'card' oder 'cards'");
    }
    this._config = config;
    this._baue();
  }

  async _baue() {
    const token = (this._bauToken = (this._bauToken || 0) + 1);
    const helpers = await window.loadCardHelpers();
    const liste = this._config.cards || [this._config.card];
    const karten = [];
    for (const cfg of liste) {
      const el = await helpers.createCardElement(cfg);
      el.addEventListener("ll-rebuild", (ev) => { ev.stopPropagation(); this._baue(); }, { once: true });
      if (this._hass) el.hass = this._hass;
      karten.push(el);
    }
    if (token !== this._bauToken) return;
    const rahmen = document.createElement("ha-card");
    rahmen.setAttribute("style", "display:flex;flex-direction:column;overflow:hidden;" + (this._config.style || ""));
    for (const el of karten) rahmen.appendChild(el);
    const root = this.shadowRoot || this.attachShadow({ mode: "open" });
    root.replaceChildren(rahmen);
    this._karten = karten;
    // hass kann waehrend der awaits gekommen sein - danach allen Kindern geben.
    if (this._hass) for (const el of karten) el.hass = this._hass;
  }

  set hass(hass) {
    this._hass = hass;
    for (const el of this._karten || []) el.hass = hass;
  }

  getCardSize() { return 3; }
}

if (!customElements.get("ipad-rahmen")) customElements.define("ipad-rahmen", IpadRahmen);
window.customCards.push({
  type: "ipad-rahmen",
  name: "iPad Rahmen",
  description: "Rahmen um eine oder mehrere Karten (Ersatz fuer vertical-stack-in-card)",
});
