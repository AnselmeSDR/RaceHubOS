# Carrera Digital 124/132 Control Unit (30352) — Référence technique

Document de référence consolidé à partir de :
- **carreralib** (lib Python) : `cu.py`, `protocol.py`, `__main__.py`
- **Notice officielle** : `Carrera-30352-Control-Unit-Manual.pdf` (section anglaise pp. 8-13)
- **Implémentation locale** : `packages/backend/src/services/controlUnit.js`, `protocol.js`
- **Simulateur OpenLap** (`demo.ts`) pour le comportement fuel non-documenté

---

## 1. Vue d'ensemble

Le Control Unit 30352 est l'unité centrale qui pilote la course. Il :
- Détecte les passages de voitures sur la piste (capteurs ligne d'arrivée + check lanes)
- Programme les voitures (vitesse max, freinage, carburant)
- Gère la séquence de départ (lights)
- Détecte le pit lane et gère le carburant
- Communique en BLE (SERVICE `39df7777-…`) ou série

**Adresses contrôleurs (slots)** :
- `0-5` = voitures pilote 1 à 6
- `6` = voiture autonome
- `7` = pace car (carburant toujours à 0)

---

## 2. Boutons physiques (1-8)

Envoi via commande `T` + ID nibble :
```
press(buttonId) → protocol.pack("cYC", b"T", buttonId)
```

| ID | Nom | Fonction principale | Notes |
|----|-----|---------------------|-------|
| **1** | PACE CAR / ESC | Active/désactive la pace car ; sert aussi d'annulation | Toggle on/off |
| **2** | START / ENTER | Avance la séquence de départ ; confirme dans les menus | Chaque appui : 0→1→2→3→4→5→0 (GO) |
| **3** | — | Non exposé | Réservé/interne |
| **4** | — | Non exposé | Réservé/interne |
| **5** | SPEED | Programmation/réglage de la vitesse max d'une voiture | Cycle dans le menu speed |
| **6** | BRAKE | Programmation du freinage | Cycle dans le menu brake |
| **7** | FUEL | Programmation de la capacité du réservoir | Seulement si fuel mode activé |
| **8** | CODE | Entrée du mode code/configuration | Active la programmation par voiture |

**Comportement dépendant de l'état** :
- Pendant la séquence lights (start 1-7), START avance les lights
- Pendant la course (start=0), pressing START arrête/réinitialise selon firmware
- Les boutons 5/6/7 ne fonctionnent que dans le mode programmation (après CODE)

---

## 3. États du CU (champ `start`, 0-9)

Le champ `start` du Status renvoie l'état courant :

| Valeur | État | Comportement | Transitions |
|--------|------|--------------|-------------|
| **0** | IDLE / RACING (GO!) | Course en cours OU au repos après extinction des lights | press(START) si idle → 1 ; suite à 5 lights → 0 (GO) |
| **1** | L1 — 1/5 lights | Première light allumée | press(START) → 2 |
| **2** | L2 — 2/5 lights | Deux lights | press(START) → 3 |
| **3** | L3 — 3/5 lights | Trois lights | press(START) → 4 |
| **4** | L4 — 4/5 lights | Quatre lights | press(START) → 5 |
| **5** | L5 — 5/5 lights | Toutes lights allumées | press(START) → 0 (GO !) |
| **6** | FALSE START | Lights clignotent — un pilote a accéléré avant le GO | Manuel ou auto-recovery |
| **7** | TRANSITIONNEL | État transitoire pendant la séquence | Bref, vers 0 |
| **8-9** | STOPPED / inconnu | Rarement observé ; certains firmware utilisent 8+ comme "stopped" | — |

**Note pratique** : dans le code RaceHubOS, on considère :
- `start === 0` → course en cours (Racing)
- `start >= 1 && start <= 7` → séquence lights
- `start >= 8` → CU en stopped (cars sans courant)

**Reset implicite** : quand le CU entre en state 1 (L1), le timer interne est remis à zéro.

---

## 4. LEDs physiques

| Groupe | Localisation | Pattern | Signification |
|--------|--------------|---------|---------------|
| **Start Lights** (5 LEDs ambrées) | Haut du boîtier | 0 éteintes = idle/race ; 1 à 5 allumées = countdown ; clignotement = false start | Reflète directement `start` |
| **LED milieu** | Centre | Allumée fixe = confirmation menu/réglage accepté | Feedback de programmation |
| **LEDs Speed/Brake/Fuel** | À côté des boutons | 1 LED = niveau bas, 5 LEDs = niveau haut. Clignotement = niveau en cours de réglage | Affichage des paliers (10 niveaux via 5 LEDs : 5 fixes + 5 clignotants) |
| **Sound LED** | Selon firmware | Allumée si son actif | — |

**Encodage des 10 niveaux sur 5 LEDs** (utilisé pour speed/brake/fuel programming) :
- Niveau 1 : 1 LED clignote
- Niveau 2 : 1 LED fixe
- Niveau 3 : 2 LEDs clignotent
- Niveau 4 : 2 LEDs fixes
- … jusqu'à niveau 10 : 5 LEDs fixes

---

## 5. Modes (champ `mode`, bitmask 4 bits)

Le champ `mode` indique quel matériel est connecté ET quelles fonctions sont actives :

| Bit | Hex | Constante | Signification | Matériel requis |
|-----|-----|-----------|---------------|-----------------|
| 0 | `0x1` | `FUEL_MODE` | Carburant consommé pendant la course (mode arcade) | Aucun — toggle CU |
| 1 | `0x2` | `REAL_MODE` | Mode REAL : la vitesse max et le freinage dépendent du niveau de carburant | Pit Lane 30356 + Pit Stop Adapter 30361 |
| 2 | `0x4` | `PIT_LANE_MODE` | Adaptateur pit lane connecté (détection de passage dans la voie des stands) | Pit Lane 30356 |
| 3 | `0x8` | `LAP_COUNTER_MODE` | Position Tower / lap counter connecté | Position Tower 30357 |

**Activation** :
- `FUEL_MODE` / `REAL_MODE` : via **interrupteur à glissière** sur le CU (composant 2 — `OFF` / `ON` / `REAL`)
- `PIT_LANE_MODE` : automatique quand le Pit Lane 30356 est branché
- `LAP_COUNTER_MODE` : automatique quand la Position Tower est branchée

**Vérification dans le code** :
```javascript
if (status.mode & 0x4) {
  // Pit lane détecté, status.pit est exploitable
}
```

---

## 6. Réponse Status (poll `?`)

Quand on poll le CU et qu'aucun event timer n'est en attente, on reçoit un Status :

```python
Status(fuel, start, mode, pit, display)
```

| Champ | Type | Plage | Signification |
|-------|------|-------|---------------|
| `fuel` | tuple de 8 ints | 0-15 chacun | Niveau carburant de chaque slot (0-7). **0 si Pit Lane non connecté** |
| `start` | int | 0-9 | État lights (voir §3) |
| `mode` | int | 0-15 (bitmask) | Modes actifs (voir §5) |
| `pit` | tuple de 8 bools | true/false | Voiture dans la pit lane ou non |
| `display` | int | 6 ou 8 | Nombre de voitures affichées sur la Position Tower |

**Format protocole** (réponse BLE après `?`) :
```
?:[8 nibbles fuel][start][mode][2 bytes pit][display][checksum]
```
- Format unpack : `"2x8YYYBYC"` (parfois `"2x8YYYBYxxC"` avec 2 bytes inconnus pour les firmwares récents)

**⚠️ Particularité fuel** : `Status.fuel` reste à `(0,0,0,0,0,0,0,0)` tant que `PIT_LANE_MODE` n'est pas détecté (le CU ne reporte les niveaux que si le Pit Lane 30356 est physiquement connecté).

---

## 7. Événements Timer (passages de capteurs)

Au lieu d'un Status, le CU peut renvoyer un Timer si une voiture vient de croiser un capteur :

```python
Timer(address, timestamp, sector)
```

| Champ | Plage | Signification |
|-------|-------|---------------|
| `address` | 0-7 | Slot voiture (0-indexed dans le code, transmis 1-indexed sur le fil) |
| `timestamp` | 0 - 2^32 ms | Temps absolu depuis le power-on du CU (~49 jours avant overflow) |
| `sector` | 1, 2, 3 | Capteur traversé |

**Sectors** :
- `1` = ligne d'arrivée / start-finish (tour complet)
- `2` = check lane 2 (capteur intermédiaire optionnel)
- `3` = check lane 3 (capteur intermédiaire optionnel)

**Format protocole** : `"xYIYC"` (skip, address nibble, timestamp 32 bits, sector nibble, checksum)

Calcul du temps au tour : différence entre deux `timestamp` successifs sur sector=1.

---

## 8. Commandes de programmation (`setword`)

Commande `J` qui écrit dans un "mot de commande" du CU. Format :
```
setword(word, address, value, repeat=1)
→ protocol.pack("cBYYC", b"J", word | (address << 5), value, repeat)
```

- `word` : 0-31 (5 bits) — identifiant du paramètre
- `address` : 0-7 — slot voiture concerné
- `value` : 0-15 (nibble) — valeur
- `repeat` : 1-15 — nombre d'envois (souvent 2 pour fiabilité)

**Mots utilisés** :

| Word | Helper | Address | Value | Repeat | Effet | Défaut usine |
|------|--------|---------|-------|--------|-------|--------------|
| **0** | `setspeed(addr, v)` | 0-5 | 0-15 | 2 | Vitesse max programmée | 10 |
| **1** | `setbrake(addr, v)` | 0-5 | 0-15 | 2 | Freinage | 10 |
| **2** | `setfuel(addr, v)` | 0-5 | 0-15 | 2 | Niveau/capacité carburant | 7 |
| **6** | `setpos(addr, p)` / `clrpos()` | 0-7 | 1-8 ou 9 | 1 | Position affichée sur Position Tower (9 = clear) | — |
| **17** | `setlap_hi(v)` | 7 | 0-15 | 1 | Nibble haut du compteur de tours | — |
| **18** | `setlap_lo(v)` | 7 | 0-15 | 1 | Nibble bas du compteur de tours | — |

**Plages user-facing** : bien que le protocole accepte 0-15, l'UI physique CU affiche 1-10 paliers. **Au-delà de 10, le firmware clamp probablement à 10**. La valeur usine pour speed/brake est 10 (max UI).

**Setlap (lap counter sur Position Tower)** :
```python
cu.setlap(42)  # 0x2A → setlap_hi(2) puis setlap_lo(10)
```

**Persistance** : les valeurs sont stockées dans la mémoire du CU. Elles **survivent** au reset timer (`=`) et restent jusqu'au prochain `setword` ou au reset usine (ESC + ON simultanés selon manuel).

---

## 9. Système de carburant (fuel) — DÉTAILS COMPLETS

### 9.1 Modes (récap)

| Switch CU | Mode bits | Comportement |
|-----------|-----------|--------------|
| `OFF` | 0 | Pas de consommation, fuel reste figé |
| `ON` | `FUEL_MODE` (0x1) | **Mode arcade** : consommation activée, mais vitesse/freinage inchangés |
| `REAL` | `FUEL_MODE | REAL_MODE` (0x3) | **Mode REAL** : consommation + voiture pleine = plus lente/moins de freinage, voiture vide = plus rapide/plus de freinage |

### 9.2 Consommation

**Modèle (déduit du simulateur OpenLap, comportement firmware non documenté officiellement)** :
- Basée sur le **temps écoulé par sector** (donc indirectement liée à la vitesse — plus on roule vite, plus on consomme par tour)
- Décrément aléatoire `0x04` à `0x10` (4-16) par sector validé
- En mode REAL : la consommation est la même, mais la vitesse max effective varie inversement au niveau (plein = lent, vide = rapide)

> **Citation notice (p.10)** : *"When driving in 'REAL-mode' the car with a full tank is 'heavier', drives slowlier and shows a lower braking effect; a car with an empty tank is 'lighter', drives faster and shows a higher braking effect."*

### 9.3 Capacité du réservoir (programmation)

**Procédure manuelle sur le CU** (notice p.10, "Setting fuel tank capacity") :
1. Allumer le CU
2. Mettre les voitures à régler sur la piste
3. Basculer le switch en `ON` ou `REAL`
4. Appuyer **FUEL (7)** une fois → les LEDs montrent le niveau actuel
5. Appuyer FUEL répété pour ajuster (10 niveaux possibles)
6. Confirmer avec **START/ENTER (3)** → LED centrale s'allume fixe

**Caractéristique importante** : la capacité réglée par cette procédure est **GLOBALE pour toutes les voitures simultanément**.

**Réglage individuel** au lancement (p.10, fig. 11-14) :
1. Au début de course, presser START/ENTER (3)
2. Toutes les 5 LEDs CU s'allument fixe
3. Le bar du Driver Display 30353 clignote
4. Pour chaque voiture : cliquer le bouton lane-change de la manette pour modifier le niveau de départ
5. Re-confirmer avec START/ENTER (3)

**Programmatique via API** :
```javascript
controlUnit.setFuel(address, value)  // value 0-15
```

### 9.4 Refueling (ravitaillement)

**Matériel requis** :
- **Pit Lane 30356** (rail de piste avec capteur de ravitaillement) — **OBLIGATOIRE**
- **Driver Display 30353** (barre 5 LEDs vertes + 2 rouges) pour la visualisation
- **Pit Stop Adapter Unit 30361** (optionnel, pour le comptage des arrêts)

**Procédure physique** (notice p.10-11, fig. 7-10) :
1. La voiture entre dans la pit lane, passe sur le capteur
2. Le bar du Driver Display **se met à clignoter** → voiture détectée en pit
3. Le pilote **maintient appuyé le bouton lane-change** de sa manette
4. Le carburant remplit pendant que le bouton est tenu
5. Les LEDs jaunes/vertes clignotent/montent pour indiquer la progression

**Vitesse de refill** (simulateur, valeurs CU réelles non documentées) :
- `+0x10` (16) par tick de 500ms
- Sortie de pit automatique entre 75% et 94% du réservoir

**Refuel via API** :
```javascript
controlUnit.setFuel(address, 15)  // remplit le réservoir directement (slot addr)
```
Cette commande fonctionne **pendant la course** (pas seulement en mode programmation), basé sur la structure du protocole. Pas de documentation explicite sur les éventuels effets de bord.

### 9.5 Lecture du niveau

- `Status.fuel[addr]` retourne le niveau actuel **uniquement si `mode & PIT_LANE_MODE`**
- Plage 0-15 (4 bits)
- 0 = vide, 15 = plein
- Driver Display 30353 affiche : 5 LEDs vertes = capacité restante, 2 LEDs rouges = warning bas niveau

### 9.6 Fuel à 0 — conséquences

D'après la notice et le comportement observé :
- La voiture **continue à rouler** (pas de coupure de courant)
- En mode REAL, elle est à sa vitesse max théorique (voiture "vide" = légère)
- **La voiture n'est plus comptabilisée** dans les tours par la Position Tower 30357 (cf. notice : *"cars with an empty tank are disregarded for lap-counting"*)
- Pas de retour automatique au pit : il faut amener la voiture manuellement

### 9.7 Pace car (slot 7)

Le pace car (`address=7`) a une particularité : **son fuel reste toujours à 0**. C'est un slot dédié, pas une vraie voiture pilote.

---

## 10. Séquences typiques

### 10.1 Démarrage de course (avec lights)

```
État initial : start=0 (idle)
press(2 = START) → start=1 (L1) — RESET du timer interne
press(2)         → start=2 (L2)
press(2)         → start=3 (L3)
press(2)         → start=4 (L4)
press(2)         → start=5 (L5)
press(2)         → start=0 (GO! — la course commence)
```

Les events Timer (passages de capteurs) ne sont émis qu'après le GO.

### 10.2 False start

Si une voiture accélère pendant la séquence lights, `start` passe à `6` (clignotement) et la séquence doit être reprise.

### 10.3 Pit stop

```
Voiture entre en pit lane
Status.pit[addr] passe à true
Le pilote tient le bouton lane-change → setFuel auto par incréments
Voiture quitte le pit lane
Status.pit[addr] repasse à false
```

### 10.4 Reset

```javascript
controlUnit.reset()  // → protocol.pack("cYYC", b"=", 1, 0)
```

Effet :
- Timer interne du CU remis à 0
- Tours en cours effacés
- **Carburant inchangé**
- **`start` inchangé** (faut press(START) séparément pour relancer)

### 10.5 Clear Position Tower

```javascript
controlUnit.clearPosition()  // → setword(6, 0, 9)
```

### 10.6 Reset usine (firmware)

Selon notice : maintenir ESC + allumer le CU. Restaure :
- speed = 10
- brake = 10
- fuel capacity = 7
- son = ON
- pace car = OFF

---

## 11. Options / Toggles

Le CU n'a pas d'options "logicielles" toggleables via le protocole BLE — toutes les options sont :
- **Soit pilotées par hardware** (présence d'accessoires)
- **Soit pilotées par bouton physique** (CODE + un autre bouton sur le CU)

| Option | Comment l'activer | Effet |
|--------|-------------------|-------|
| Son ON/OFF | Bouton physique du CU (cycle via menu) | Bip aux pressions de bouton |
| Pace car ON/OFF | Bouton 1 (PACE CAR/ESC) en course | Active la voiture autonome |
| Fuel mode OFF/ON/REAL | Switch physique sur le CU | Voir §9.1 |
| Lap counter | Brancher Position Tower 30357 | mode bit 0x8 actif |
| Pit lane | Brancher Pit Lane 30356 | mode bit 0x4 actif |
| Sound on lap | Programmation via menu | — |

---

## 12. Table récapitulative du protocole BLE

| Byte | Nom | Format pack | But | Réponse |
|------|-----|-------------|-----|---------|
| `0` | VERSION | `0C` | Lire la version firmware | `0[4 chars version]C` |
| `?` | POLL | `?C` | Lire status ou timer event | Status (`?:` prefix) ou Timer (`?` prefix) |
| `T` | BUTTON | `cYC` (`T` + buttonId + chk) | Simuler appui bouton | Echo `TC` |
| `J` | SETWORD | `cBYYC` (`J` + word_addr + val + repeat + chk) | Programmer un paramètre | Echo `JC` |
| `=` | RESET | `cYYC` (`=` + 1 + 0 + chk) | Reset timer | Echo `=C` |
| `:` | IGNORE | `cBC` (`:` + mask + chk) | Ignorer certains slots | Echo `:C` |
| `G` | FWU_START | `ccC` | Début update firmware | — |
| `E` | FWU_END | `cC` | Fin update | — |
| `F` | FWU_BLOCK | `cr…s` | Bloc de firmware (BLE only) | — |

**Caractéristiques BLE** :
- Service UUID : `39df7777-b1b4-b90b-57f1-7144ae4e4a6a`
- Output (write) : `39df8888-b1b4-b90b-57f1-7144ae4e4a6a`
- Notify (read) : `39df9999-b1b4-b90b-57f1-7144ae4e4a6a`

**Encodage** : tous les nibbles sont encodés en ASCII (base 0x30). Une valeur 10 = `:` (0x3A). Le checksum est `sum(bytes) & 0x0F` puis encodé en nibble ASCII.

**Différence série vs BLE** :
- Série : framing avec `"` au début et `$` à la fin
- BLE : **pas de framing**, on envoie les bytes bruts (le `$` apparaît dans certaines réponses BLE mais c'est un terminateur de notification, pas du protocole)

---

## 13. Quirks et particularités notables

1. **`Status.fuel` reste à zéro sans Pit Lane 30356 branché** — non documenté dans la notice officielle, découvert via le commentaire de `carreralib/__main__.py`.

2. **Mode REAL exige du matériel** : sans Pit Lane 30356 + Pit Stop Adapter 30361, le switch REAL n'a pas d'effet visible.

3. **Plage 0-15 vs 1-10** : le protocole accepte 0-15, mais l'UI physique du CU affiche 10 paliers. Les valeurs 11-15 semblent clamper à 10 d'après le firmware (non confirmé).

4. **Repeat=2 systématique pour speed/brake/fuel** : `carreralib` envoie ces commandes en double (paramètre `repeat`). Le CU les reçoit en une seule trame mais la duplication interne est gérée par le firmware.

5. **Adresse 1-indexed sur le fil** : un timer event reçu avec `address=1` correspond au slot 0 dans le code. `carreralib` fait la conversion (`address - 1`).

6. **2 bytes inconnus dans certains Status** : les firmware récents (à partir de v5337 environ) renvoient 2 bytes supplémentaires avant le checksum. `carreralib` essaie `"2x8YYYBYC"` puis fallback `"2x8YYYBYxxC"`.

7. **Pas de "stop race" dédié** : pour arrêter une course, on simule press(START button 2) qui toggle Racing → Stopped, ou on coupe le courant aux voitures avec `setSpeed(addr, 0)` pour chacune.

8. **ESC ne stoppe pas la course** : ESC/PACE CAR allume uniquement la LED pace car. Pour stopper il faut pressEnter ou couper les vitesses.

9. **Le pit lane bitmask peut être partiel** : si un firmware ne supporte que 6 voitures, les bits 6-7 du masque pit sont undefined.

---

## 14. Sources

- `carreralib/src/carreralib/cu.py` — API du CU, helpers `setspeed/setbrake/setfuel/setpos/setlap`, constantes mode
- `carreralib/src/carreralib/protocol.py` — Format binaire (`pack`/`unpack`), checksum
- `carreralib/src/carreralib/__main__.py` — RMS exemple, mapping clavier, commentaire `FUEL_MASK = PIT_LANE_MODE`
- `carreralib/src/carreralib/ble.py` — UUIDs BLE, send/recv
- `Carrera-30352-Control-Unit-Manual.pdf` (anglais pp. 8-13) — Notice officielle
- `openlap/src/app/backend/demo.ts` — Simulateur (référence pour le comportement fuel non documenté)
- `packages/backend/src/services/controlUnit.js`, `ble.js`, `protocol.js` — Implémentation locale

---

*Document généré le 2026-05-13. Tout détail non documenté officiellement est marqué comme "déduit" ou "non documenté".*
