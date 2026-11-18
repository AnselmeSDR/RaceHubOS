# CU Firmware Werkstatt · RaceHubOS 1.27 · 0.6.1

Natives Add-on für die tatsächlich verwendete RaceHubOS-1.27-Installation. Die vorherige Version 0.2.0 lag nur im älteren Arbeitsstand RaceHubOS.

Installation als Entwicklerordner: diesen Ordner unter `RaceHubOS-1.27/addons/cu-firmware` verlinken, Frontend neu bauen, Anwendung neu starten. Es werden keine Core-Dateien ersetzt oder Datenbanken migriert. Die Wartungssperren sind kleine `@base`-Wrapper. Native Seitenleiste: **CU Firmware Werkstatt**. Flash-Journal: `addons/.data/cu-firmware/journal.json`.

Die Firmware-Basis ist Flatout-V339 mit Bot-Modul v339-bot.5. Fertige Hersteller-HMF-Dateien werden nicht mitgeliefert. Die Werkstatt kann lokale HMF-Dateien prüfen und Byte-Patches anwenden. Ein Flash startet nur über den Übertragen-Button, niemals beim Öffnen, Auswählen oder Prüfen einer Datei.

Nur Hardware 5/AVR wird unterstützt. Quittierte BLE-Blöcke, Versions-/Statusprüfung und bei bekannten Images Bot-Probe; kein vollständiger Firmware-Readback. Recovery erfordert ein vollständiges Image und einen funktionsfähigen Factory-Bootloader. Bei Abbruch wird nicht automatisch erneut geschrieben. Das Flash-Journal hält die Wartungssperre über einen Neustart aufrecht.

Die bisherige detaillierte Anleitung und die Quellrekonstruktion stehen unter `RaceHubOS/addons/cu-firmware/README-DE.md` beziehungsweise `RaceHubOS/addons/cu-firmware/vendor/flatout/`. Die Oberflächenprüfung erfolgt ohne Hardware-Flash.


## Prüfung auf der verwendeten Installation

RaceHubOS 1.27 wurde neu gestartet. Die native Seitenleistenroute `/addons/cu-firmware` lädt, ungültiges HMF wird abgewiesen, eine synthetische vollständige Datei wird mit 14.336 Bytes und 897 Zeilen geprüft. Editorimport und Statusaktualisierung funktionieren. Ohne Freigaben bleibt der Übertragen-Button deaktiviert. Keine Browserfehler. Testauswahlen wurden anschließend zurückgesetzt. Der reale Flash-Status blieb `idle`, ohne Flash-Journal. Die verbundene CU meldete bei einer reinen Versionsabfrage `5339` (Hardware 5, Firmware V339); Stock/Bot wird daraus allein nicht bestimmt.

Die nativen Simulationsprüfungen verwenden den tatsächlich aufgelösten `@base`-ControlUnit-Pfad und ein künstliches BLE-Objekt, keine reale CU:

```sh
# Aus dem Carrera-Workspace:
installation/node-v22.23.3-linux-x64/bin/node --import ./RaceHubOS-1.27/packages/backend/src/addons/preload.js addons/cu-firmware/tests/flash.test.mjs
```

## Einstellregler · 0.4.0

Die Werkstatt enthält jetzt lokal aus dem mitgelieferten C-Quellcode erzeugte V339-Stock- und Bot.5-Basisdateien. Der unveränderte Build mit AVR-GCC 5.4.0/Atmel 3.6.0, passenden Binutils und avr-libc 2.0.0 stimmt mit den Upstream-SHA-256-Werten überein. Diese Dateien sind keine Sicherung der angeschlossenen CU.

**Bedienung:** Firmware-Basis wählen → Geprüfte Basis laden → Regler einstellen → Firmware erstellen (ohne Flashen) → HMF und Prüfbericht separat speichern. Eigene, bereits so erzeugte HMF-Dateien lassen sich wieder importieren, ändern und auf Serienwerte zurücksetzen. Es wird dabei kein Flash-Endpunkt aufgerufen und keine Hardware geändert. Das Ergebnis wird auch nicht automatisch für eine Übertragung ausgewählt.

| Einstellung | Serienwert | Bereich | Bedeutung |
|---|---:|---:|---|
| Rundenerkennung / Ereignis-Mindestabstand | 501 ms gemäß Upstream-Zeitbasis | 101–5000 | Sensorereignisse desselben Fahrzeugs; betrifft auch Zwischenzeiten. Keine Mindest-Rundenzeit der Rennsoftware. |
| Sensorentprellung | 5 CU-Ticks | 1–20 | Beide CU-Sensoren; Änderung aller vier Reload-Konstanten, ohne die Größe der Sensorzustandsstruktur zu ändern. Keine pauschale ms-Umrechnung. |
| Bot-Watchdog | 13 Bahnzyklen, ca. 1 s | 7–40 | Nur Bot.5; bei fehlenden B-Gasbefehlen Gas 0. Laufzeit ca. 75 ms/Zyklus. Abschalten des Watchdogs wird nicht angeboten. |
| LED-Lauflicht nach Einstellungsänderungen | an | an/aus | Unterdrückt die reine `lights_chase_step`-Routine beim Speichern/Programmieren. Startampel, Fehleranzeigen und Schreibablauf bleiben erhalten. |

Unterstützte Profile werden anhand des vollständigen Anwendungsimages identifiziert. Bereits gesetzte Reglerwerte werden dekodiert und auf gültige AVR-Anweisungen, Wertebereiche, konsistente Sensorwerte und korrekte Intervallgrenzen geprüft. Alle übrigen Bytes müssen zur freigegebenen Stock-/Bot.5-Basis passen. Unbekannte oder anderweitig veränderte Firmware wird für die Regler abgewiesen; der bisherige Experteneditor bleibt verfügbar.

Geprüfte Stellen: Ereignisfilter 0x0F9E–0x0FAD (beide Grenzen des vom Compiler zusammengefassten 32-Bit-Vergleichs), Sensor-Reloads 0x0BB4/0x0C1A/0x0E2E/0x0E72, Bot-TTL 0x377A, LED-Chaser-Einstieg 0x1A2C. Bei ausgeschaltetem Lauflicht wird ausschließlich der erste Befehl der aus reinen Portzugriffen bestehenden Routine durch AVR-RET ersetzt; die Aufrufer führen ihre EEPROM-/Programmierarbeit weiter aus.

### Prüfung

```sh
installation/node-v22.23.3-linux-x64/bin/node addons/cu-firmware/tests/parameters.test.mjs
# Unabhängiger C-Vergleich, aus dem Carrera-Workspace:
PATH="$PWD/installation/avr-toolchain/usr/bin:$PWD/installation/node-v22.23.3-linux-x64/bin:$PATH" python3 addons/cu-firmware/tools/verify-parameter-patches.py
```

Die unabhängig neu kompilierten Varianten mit Ereignisabstand 701, Entprellung 7 und Watchdog 20 sind im gesamten Anwendungsbereich bytegleich zur Reglerausgabe (Stock und Bot.5). Zusätzlich prüfen die Tests Wertebereiche, Intervallarithmetik inklusive Überlauf, Reimport/Rücksetzen, Sperre fremder Images und unveränderte Startampel-/Sensorstruktur-Bytes. Das ersetzt keine Hardwareprüfung; es wurde nichts geflasht.

### CU-Ton

Laut [Carrera-Anleitung, Sound ON/OFF](https://backend.carrera-revell-toys.com/var/assets/coreshop/pdfs/General%20Introduction%20%28B%29%20D132%20%26%20Wireless.pdf) lassen sich Sensor-/Tasten-Bestätigungstöne abschalten: bei ausgeschalteter CU START/ENTER halten, einschalten, loslassen. Der Einschalt-Quittierungston bleibt. Die V339-Rekonstruktion verwendet dafür `cfg_sound_enable` vor der Tonwarteschlange; diese Abfrage hängt nicht vom Bluetooth-/USB-Transport ab. Ein separater eindeutig belegter Live-Stummschaltbefehl für die laufende Verbindung ist nicht implementiert. Ein simulierter START/ENTER-Tastendruck ist zustandsabhängig und kann das Rennen starten; dafür wird kein irreführender Stumm-Button angeboten.

Für zuverlässige Downloads auch im eingebetteten Browser werden erzeugte HMF-Datei und Prüfbericht auf ausdrückliches „Firmware erstellen“ an das lokale RaceHubOS-Backend übergeben. Dort werden unterstütztes Profil und Ergebnis-SHA-256 erneut geprüft; der Download erhält einen zufälligen, zehn Minuten gültigen Link. Maximal 20 Exporte liegen ausschließlich im Arbeitsspeicher. Es wird nichts auf der CU geändert und keine Firmware auf dem Server-Dateisystem abgelegt. Die Export-Routen haben keinen Verweis auf den CU-Dienst. Diese lokale Downloadvorbereitung ist zusätzlich zur clientseitigen Dateierzeugung erforderlich.


Oberflächenprüfung 12.11.2026: Stock- und Bot-Basis geladen; Watchdog bei Stock deaktiviert und bei Bot verfügbar. Regler 701/7/20 und LED-Lauflicht aus ergaben den erwarteten Prüfreport. HTTP-Download einer Stock-Datei mit Serienwerten und Lauflicht aus wurde im eingebetteten Browser gespeichert und anschließend unabhängig erneut als unterstütztes Profil eingelesen. Sechs neue automatisierte Parameter-/Exporttests und der unabhängige Vollvergleich mit dem C-Build sind erfolgreich. Lint der geänderten JS-Dateien ist fehlerfrei. Browserkonsole ohne Fehler; realer Flash-Status unverändert idle, running=false. Aktuelle Browseransicht enthält nur vorbereitete Reglerwerte, keine geladene Flash-Datei.


## CU-Piepton-Schalter · 0.5.0

**CU-Pieptöne zulassen** ist jetzt ein weiterer Firmware-Parameter. Aus ersetzt ausschließlich den ersten AVR-Befehl von `beep_queue_push` bei 0x0140 (`28 2f`, MOV r18,r24) durch `08 95` (RET). Die Funktion kehrt damit vor allen Queue-/Sound-/Transportabfragen zurück; es gibt keine Änderung an Bluetooth-/USB-Protokoll, Timer-Konfiguration, Startampel oder Sensoren. Dies betrifft alle Aufrufe dieser Tonwarteschlange, einschließlich Hinweis-/Warntönen, die sie verwenden. Andere Signalwege sind nicht zugesichert. An stellt den ursprünglichen Einstieg wieder her, sodass wieder die normale CU-Sound-Einstellung gilt.

Der Schalter ist **kein Live-Mute** der unveränderten CU: Er wirkt erst nach einem ausdrücklich separat vorgenommenen Firmware-Flash. In dieser Änderung wurde nichts geflasht und kein Stummschaltbefehl an die CU gesendet. Das Abschalten ist nicht auf die Verbindungsdauer beschränkt, sondern gilt in dieser Firmware allgemein.

`cuSound` wird in HMF-Reimport, Normalisierung gegen die vollständigen freigegebenen Stock-/Bot.5-Hashes, Wertevalidierung, Serienwert-Rücksetzung, Downloadprüfung und JSON-Bericht mitgeführt. Früher erzeugte Profile ohne Sound-Patch bleiben lesbar und ergeben `cuSound: true`. Die zusätzlichen Tests prüfen genau zwei geänderte Bytes, AVR-RET am Funktionseinstieg, identische Rückkehr zum Original-HMF und Kombination mit allen vorhandenen Einstellungen.

Oberflächenprüfung 12.11.2026 für 0.5.0: Checkbox Sound aus, Erzeugen und HTTP-Download erfolgreich. Die heruntergeladene Datei `v339-stock-angepasst (1).hmf` wurde erneut geparst; gegenüber Stock sind ausschließlich die Bytes 0x0140/0x0141 geändert, `cuSound=false`. Sieben Parameter- und ein Export-Test bestehen, Lint ist fehlerfrei. Browserkonsole ohne Fehler und Flash-Status weiterhin `idle`, `running=false`. Keine Hardware-Soundprüfung und kein Flash durchgeführt.

### 0.6.0 – Energiesparen und weitere Schalter

- Energiesparmodus abschaltbar: ausschließlich CLI am Eintritt des fehlerfreien Schlafpfads bei 0x1564 durch RET ersetzt. Fehlerzweig, ADC-Überlast-/Kurzschlusserkennung, Stromabschaltung und cfg_keep_awake bleiben bytegleich. Keine Überbrückung des Schutzes; keine Hardware-Fehlerprüfung durchgeführt.
- Sensorereignis-Töne separat abschaltbar (bei global stumm ohne zusätzliche Wirkung).
- Serien-PC-Fahrzeugsteuerung (C-Befehl) separat abschaltbar; Handregler und separates B-Bot-Modul bleiben unabhängig. Für Rennsoftware empfohlen eingeschaltet lassen.
- Erklärungen in der Werkstatt, strikte Erkennung aller Schalterstellen, Rückkehr zur bytegleichen Serienbasis und Schutzangaben im Prüfbericht.
- Prüfung: 9 Parameter-Tests, 9 simulierte Flash-/Recovery-Tests; keine CU geflasht. Ausgangswerte bleiben serienmäßig eingeschaltet, bis ein Profil gewählt wird.

### 0.6.1 – Englisch und Französisch

Die Werkstatt übernimmt die RaceHubOS-Sprache und bietet eine eigene Auswahl für Deutsch, Englisch und Französisch. Übersetzt sind Beschriftungen, Erklärungen, zugängliche Namen und UI-Meldungen. Ein Sprachwechsel innerhalb der Werkstatt lädt den Editor neu und verwirft ungespeicherte Werte; ein laufender Flash läuft serverseitig weiter. Technische JSON-Berichte und Diagnoseprotokolle behalten Schema und Originaltext. Firmware- und Flash-/Recovery-Logik unverändert.

22 Tests und Produktions-Build bestanden. Browserprüfung beider Sprachen mit identischer HMF-Prüfsumme; vier Screenshots unter `docs/screenshots`. Für diese Änderung wurde keine CU geflasht. Installation und englische/französische Hinweise: [README.md](README.md).
