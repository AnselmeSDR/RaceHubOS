# Spécifications Techniques - Carrera Digital 132

## Système de base

### Échelle et dimensions
- **Voitures**: 1:32
- **Piste**: 1:24 (largeur)
- **Type**: Slot car numérique avec rails conducteurs

### Capacité système
- **Nombre maximum de voitures**: 6 simultanément
- **Voies physiques**: 1 ou 2 (avec changement de voie numérique)
- **Contrôleurs supportés**: Jusqu'à 6

---

## Control Unit 30352 (Boîtier de contrôle)

### Connecteurs et ports

**Face avant / principaux**
- **Connecteur 1**: Manette, extension manettes ou récepteur WIRELESS+
- **Connecteur 2**: WIRELESS Tower 10108
- **Connecteurs 3 et 4**: Manettes filaires

**Face arrière / auxiliaires**
- **Port Lap Counter**: Pour compteur de tours 30342
- **Port PC-Unit**: Pour PC-Unit ou Lap Counter 30355
- **Port alimentation**: Transformateur (voir ci-dessous)
- **Port chargeur**: Pour le chargeur des manettes sans fil

### Alimentation

| Système | Tension requise |
|---------|----------------|
| Digital 132 | 14.8V |
| Digital 124 | 18V |

### Fonctions programmables

Via les boutons du boîtier, on peut configurer:
- Vitesse maximale par voiture
- Force de freinage
- Capacité du réservoir de carburant
- Activation Pace Car (voiture de sécurité)
- Fonction Pit Stop
- Codage/décodage des voitures aux contrôleurs

---

## Manettes et contrôleurs

### Manettes filaires
- **Connexion**: Câble jack vers Control Unit
- **Fonctions**:
  - Gâchette analogique (accélération progressive)
  - Bouton changement de voie
- **Avantages**: Pas de pile, réponse instantanée
- **Inconvénients**: Mobilité limitée autour de la piste

### Manettes sans fil

#### Wireless+ (première génération)
- **Technologie**: Radio 2.4 GHz
- **Portée**: Jusqu'à 15 mètres
- **Pilotes simultanés**: Jusqu'à 6
- **Anti-interférence**: Frequency hopping (saut de fréquence)
- **Alimentation**: Batteries rechargeables
- **Référence**: Kit 10109 (Duo), 10110 (Single)

#### Wireless 2.0 (génération actuelle)
- **Technologie**: Radio 2.4 GHz améliorée
- **Portée**: Jusqu'à 15 mètres
- **Pilotes simultanés**: Jusqu'à 6
- **Garantie**: Action ininterrompue à toutes distances
- **Référence**: 20010109 (Duo), 20010110 (Single), 20010120 (Wireless 2.0 Set Duo)

**Note importante**: Les contrôleurs sans fil n'utilisent PAS Bluetooth, mais une technologie radio 2.4 GHz dédiée.

---

## AppConnect 30369 (Adaptateur Bluetooth)

### Spécifications

| Caractéristique | Détail |
|----------------|--------|
| **Référence** | 30369 / 20030369 |
| **Code-barres** | 4007486303690 |
| **Technologie** | Bluetooth Low Energy (BLE) |
| **Compatibilité systèmes** | Digital 132, Digital 124 |
| **Connexion** | Se branche sur le Control Unit 30352 |

### Compatibilité appareils

**iOS**
- iPhone 4S et supérieur
- iPad 3 et supérieur
- iOS 7.0 minimum

**Android**
- Android 4.3 minimum
- Bluetooth LE requis
- Tous appareils compatibles BLE

### Protocoles de communication

```
Smartphone/Tablette ←→ [Bluetooth LE] ←→ AppConnect ←→ Control Unit ←→ Piste
```

Pour multi-joueurs (SmartRace Connect):
```
Smartphone pilote 1 ←→ [WiFi] ←→ Smartphone maître ←→ [Bluetooth] ←→ AppConnect
Smartphone pilote 2 ←→ [WiFi] ←→ Smartphone maître
Smartphone pilote 3 ←→ [WiFi] ←→ Smartphone maître
```

---

## Voitures Digital 132

### Caractéristiques électriques
- **Double tresse**: Connectivité électrique améliorée
- **Chipset numérique**: Communication avec le Control Unit
- **LED d'état**: Indicateurs de niveau carburant, dégâts, etc.

### Modes de fonctionnement

**Mode numérique (par défaut)**
- Communication bidirectionnelle avec le Control Unit
- Changement de voie actif
- Gestion carburant
- Statistiques temps réel

**Mode analogique**
- Commutateur sur le châssis
- Compatible pistes Carrera EVOLUTION
- Pas de changement de voie
- Pas de fonctions numériques

### Codage des voitures

Chaque voiture doit être "codée" à un contrôleur spécifique (position 1-6):
1. Maintenir le bouton du contrôleur
2. Placer la voiture sur la piste
3. La voiture s'associe au contrôleur
4. LED ou signal confirmant le codage

**Décodage**: Permet de réassocier une voiture à un autre contrôleur.

---

## Composants de piste

### Sections standards
- Rails droits (diverses longueurs)
- Virages (rayons variés)
- Aiguillages numériques (changement de voie)
- Sections électrifiées

### Pit Lane (Stand)

#### Kit complet (30356)
- Sections de piste pit lane
- Aiguillages d'entrée/sortie spéciaux
- Capteur Pit Stop Adapter Unit (PSAU)
- Bouton rouge de ravitaillement

#### PSAU seul (30030361)
- **Pit Stop Adapter Unit**
- Capteur FUEL intégré
- Détection passage voiture
- Signal arrêt/départ pit

**Caractéristique spéciale**: Les aiguillages pit lane ne peuvent pas être activés par les Ghost Cars, évitant les entrées accidentelles.

### Accessoires électroniques

#### Lap Counter (Compteurs de tours)
- **30342**: Compteur de tours basique
- **30355**: Compteur avec connexion PC

#### Wireless Tower (10108)
- Tour de transmission pour système sans fil
- Se connecte au connecteur 2 du Control Unit
- Améliore la réception des contrôleurs sans fil

---

## Compatibilité et conversions

### Compatibilité native

| Système source | Compatible Digital 132 | Notes |
|---------------|----------------------|-------|
| Carrera Evolution | Oui | Voitures D132 avec commutateur analogique |
| Carrera Go!!! | Non | Échelle différente |
| Carrera Digital 124 | Partiel | Même électronique, échelle différente |

### Conversions possibles

#### Scalextric vers Carrera Digital 132
- **Voitures**: Scalextric Digital Plug Ready (DPR)
- **Adaptateur**: Carson 500707130 Digital Plug
- **Installation**: Retirer puce Scalextric, installer puce Carrera

#### Slot.it / Policar vers Carrera Digital 132
- **Voitures**: Slot.it, Policar (analogiques)
- **Adaptateur**: SP43 Universal Carrera Digital Chip
- **Installation**: Installation puce universelle dans châssis

---

## Caractéristiques de sécurité

### Protection électrique
- Circuit de protection contre courts-circuits
- Coupure automatique en cas de surcharge
- Signalisation LED d'erreur sur Control Unit

### Sécurité mécanique
- Voitures équipées de guide magnétique
- Bords de piste pour prévenir les sorties
- Connexions électriques sécurisées

---

## Dimensions et poids

### Voitures (exemples moyens)
- **Longueur**: 13-15 cm
- **Largeur**: 5-6 cm
- **Poids**: 80-120g

### Piste
- **Largeur rail**: Standard Carrera 1:24
- **Espacement rails**: Compatible changements de voie

### Control Unit
- **Dimensions**: Environ 20 x 15 x 5 cm
- **Poids**: ~500g

---

## Besoins en alimentation

### Control Unit
- **Entrée**: 14.8V DC (Digital 132)
- **Consommation**: Variable selon nombre de voitures actives
- **Transformateur**: Fourni avec kits de démarrage

### Manettes sans fil
- **Type**: Batteries rechargeables
- **Chargeur**: Connecté au Control Unit
- **Autonomie**: Plusieurs heures de course

---

*Note: Spécifications basées sur informations officielles Carrera et documentation utilisateur 2025*
