"""
Bild des Tages von Bing als Panel-Hintergrund.

Laedt einmal taeglich das aktuelle Bing-Hintergrundbild herunter und legt es
unter www/<unterordner>/<dateiname> ab, damit das iPad es lokal aus Home
Assistant zieht statt bei jedem Seitenaufruf von bing.com. Faellt der Abruf aus,
bleibt einfach das Bild vom Vortag liegen - das Panel hat also nie einen leeren
Hintergrund.

Zusaetzlich wird ein Sensor mit Titel und Copyright gesetzt, damit sich eine
Bildunterschrift einblenden laesst.
"""

import json
import os
import shutil
import urllib.request
from datetime import datetime

import appdaemon.plugins.hass.hassapi as hass

BING_API = "https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1&mkt={markt}"
BING_HOST = "https://www.bing.com"

# Je nach Add-on-Version liegt das HA-Konfigverzeichnis anders im Container.
WWW_KANDIDATEN = ("/homeassistant/www", "/config/www", "/conf/www", "/haconfig/www")

TIMEOUT = 30


class BingWallpaper(hass.Hass):
    def initialize(self):
        self.markt = self.args.get("markt", "de-DE")
        self.aufloesung = self.args.get("aufloesung", "1920x1080")
        self.unterordner = self.args.get("unterordner", "ipad")
        self.dateiname = self.args.get("dateiname", "bg_today.jpg")
        self.sensor = self.args.get("sensor", "sensor.bing_wallpaper")
        laufzeit = self.args.get("laufzeit", "05:30:00")

        self.run_daily(self.hole_bild, laufzeit)
        # Beim Start einmal nachziehen, damit nach einem Neustart sofort ein
        # Bild und ein gesetzter Sensor da sind.
        self.run_in(self.hole_bild, 20)
        self.log(f"Bing-Wallpaper gestartet, taeglich um {laufzeit}", level="INFO")

    def www_verzeichnis(self):
        for pfad in WWW_KANDIDATEN:
            if os.path.isdir(pfad):
                return pfad
        return None

    def hole_bild(self, kwargs=None):
        basis = self.www_verzeichnis()
        if not basis:
            self.log(
                "Kein www-Verzeichnis gefunden (geprueft: "
                + ", ".join(WWW_KANDIDATEN)
                + ") - AppDaemon sieht das HA-Konfigverzeichnis nicht.",
                level="ERROR",
            )
            return

        try:
            meta = self.lade_metadaten()
        except Exception as err:
            self.log(f"Bing-Metadaten nicht abrufbar: {err}", level="WARNING")
            return

        ziel_dir = os.path.join(basis, self.unterordner)
        os.makedirs(ziel_dir, exist_ok=True)
        ziel = os.path.join(ziel_dir, self.dateiname)
        tmp = ziel + ".tmp"

        try:
            with urllib.request.urlopen(meta["bild_url"], timeout=TIMEOUT) as antwort:
                with open(tmp, "wb") as datei:
                    shutil.copyfileobj(antwort, datei)
            groesse = os.path.getsize(tmp)
            if groesse < 20000:
                # Bing liefert bei Problemen gern eine winzige Platzhaltergrafik.
                os.remove(tmp)
                self.log(f"Heruntergeladenes Bild nur {groesse} Byte - verworfen.", level="WARNING")
                return
            os.replace(tmp, ziel)
        except Exception as err:
            if os.path.exists(tmp):
                os.remove(tmp)
            self.log(f"Bild-Download fehlgeschlagen: {err}", level="WARNING")
            return

        self.set_state(
            self.sensor,
            state=meta["titel"][:255],
            attributes={
                "friendly_name": "Bing Bild des Tages",
                "icon": "mdi:image-filter-hdr",
                "copyright": meta["copyright"],
                "bild_url": meta["bild_url"],
                "lokaler_pfad": f"/local/{self.unterordner}/{self.dateiname}",
                "stand": meta["stand"],
                "aktualisiert": datetime.now().isoformat(timespec="seconds"),
            },
        )
        self.log(f"Bild des Tages geladen: {meta['titel']} ({groesse // 1024} KB)", level="INFO")

    def lade_metadaten(self):
        url = BING_API.format(markt=self.markt)
        with urllib.request.urlopen(url, timeout=TIMEOUT) as antwort:
            daten = json.loads(antwort.read().decode("utf-8"))
        bild = daten["images"][0]
        # urlbase liefert den Namen ohne Aufloesung - damit laesst sich jede
        # angebotene Groesse zusammenbauen.
        bild_url = f"{BING_HOST}{bild['urlbase']}_{self.aufloesung}.jpg"
        return {
            "bild_url": bild_url,
            "titel": bild.get("title") or "Bild des Tages",
            "copyright": bild.get("copyright", ""),
            "stand": bild.get("startdate", ""),
        }
