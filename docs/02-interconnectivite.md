# Interconnectivité - Carrera Digital 132

Le système Carrera Digital 132 offre plusieurs niveaux de connectivité, permettant une expérience de course moderne avec statistiques détaillées, gestion multi-dispositifs et contrôle à distance.

---

## Vue d'ensemble des technologies

| Technologie | Usage | Portée | Nombre d'appareils |
|-------------|-------|--------|-------------------|
| **Radio 2.4 GHz** | Manettes sans fil | 15m | 6 contrôleurs |
| **Bluetooth LE** | Smartphone ↔ Piste | 10m | 1 appareil principal |
| **WiFi** | Multi-dispositifs | Réseau local | Illimité |

---

## 1. Connectivité Manettes Sans Fil (2.4 GHz)

### Technologie utilisée

**Protocole**: Radio 2.4 GHz propriétaire Carrera (NON Bluetooth)

**Caractéristiques techniques**:
- Frequency hopping (saut de fréquence)
- Résistance aux interférences
- Latence ultra-faible (<10ms)
- Connexion point-à-point dédiée

### Architecture de connexion

```
┌─────────────────┐
│ Control Unit    │
│    30352        │
└────────┬────────┘
         │
    ┌────┴────┐
    │ Wireless│
    │ Receiver│ (Connecteur 1)
    └────┬────┘
         │ 2.4 GHz
    ┌────┴─────────────────────┐
    │                          │
┌───▼───┐  ┌───────┐  ...  ┌───────┐
│Manette│  │Manette│       │Manette│
│  #1   │  │  #2   │       │  #6   │
└───────┘  └───────┘       └───────┘
```

### Avantages
- **Portée**: 15 mètres garantis
- **Réactivité**: Latence imperceptible
- **Fiabilité**: Pas d'interférence WiFi/Bluetooth
- **Mobilité**: Liberté totale autour de la piste

### Configuration
1. Brancher le récepteur WIRELESS+ au connecteur 1 du Control Unit
2. Optionnel: Ajouter Wireless Tower (10108) pour améliorer réception
3. Associer chaque manette (appui long bouton)
4. Recharger via port chargeur du Control Unit

---

## 2. Connectivité Bluetooth (AppConnect)

### L'adaptateur AppConnect 30369

**Fonction**: Pont entre smartphone/tablette et le système de piste

```
┌──────────────┐
│ Smartphone/  │
│  Tablette    │
└──────┬───────┘
       │ Bluetooth LE
┌──────▼───────┐
│  AppConnect  │
│    30369     │
└──────┬───────┘
       │ Câble propriétaire
┌──────▼───────┐
│ Control Unit │
│    30352     │
└──────────────┘
```

### Protocole de communication

**Bluetooth Low Energy (BLE)**
- Consommation minimale
- Portée: ~10 mètres
- Connexion sécurisée
- Reconnaissance automatique

### Données transmises

**Du Control Unit vers l'app**:
- Temps au tour en temps réel
- Position des voitures
- Niveau de carburant
- État des voitures (dégâts, pénalités)
- Événements (changement de leader, pit stop)

**De l'app vers le Control Unit**:
- Réglages voitures (vitesse max, freinage, réservoir)
- Commandes de course (start, pause, reset)
- Configuration Ghost Cars
- Activation Pace Car

### Configuration initiale

1. **Installation physique**:
   ```
   AppConnect → Port dédié Control Unit (généralement arrière)
   ```

2. **Pairing Bluetooth**:
   - Activer Bluetooth sur smartphone/tablette
   - Lancer l'application (Carrera Race App ou SmartRace)
   - Recherche automatique de l'AppConnect
   - Connexion sécurisée

3. **Vérification**:
   - LED sur AppConnect doit être allumée/clignotante
   - Application affiche "Connecté"
   - Temps au tour apparaissent en temps réel

### Compatibilité appareils

| Plateforme | Version minimum | Caractéristiques requises |
|-----------|----------------|--------------------------|
| **iOS** | 7.0 | iPhone 4S, iPad 3 ou supérieur |
| **Android** | 4.3 | Bluetooth LE supporté |
| **macOS** | Récent | Via SmartRace pour Mac |

### Limitations
- **Un seul appareil principal** en Bluetooth direct
- Portée limitée à ~10m
- Nécessite AppConnect physique (35-40€)

---

## 3. Connectivité WiFi Multi-dispositifs (SmartRace Connect)

### Architecture réseau

SmartRace Connect permet de connecter plusieurs smartphones/tablettes via WiFi:

```
                    ┌──────────────┐
                    │   Réseau     │
                    │   WiFi       │
                    │   Local      │
                    └──────┬───────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
┌───────▼────────┐  ┌──────▼───────┐  ┌──────▼───────┐
│  Smartphone    │  │ Smartphone   │  │ Smartphone   │
│  Pilote 1      │  │ Pilote 2     │  │ Pilote 3     │
│  (SmartRace    │  │ (SmartRace   │  │ (SmartRace   │
│   Connect)     │  │  Connect)    │  │  Connect)    │
└────────────────┘  └──────────────┘  └──────────────┘

                    ┌──────────────┐
                    │ Smartphone   │
                    │ MAÎTRE       │
                    │ (SmartRace)  │
                    └──────┬───────┘
                           │ Bluetooth LE
                    ┌──────▼───────┐
                    │  AppConnect  │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │ Control Unit │
                    └──────────────┘
```

### Principe de fonctionnement

1. **Appareil maître**:
   - Un smartphone/tablette avec SmartRace complet
   - Connecté via Bluetooth à l'AppConnect
   - Reçoit les données temps réel de la piste

2. **Appareils clients**:
   - Smartphones/tablettes avec SmartRace Connect (app gratuite)
   - Connectés via WiFi au même réseau que le maître
   - Reçoivent les données du maître via réseau local

3. **Synchronisation**:
   - Toutes les données synchronisées en temps réel
   - Chaque pilote voit son propre tableau de bord
   - Actions possibles: arrêt course, réglage freinage personnel

### Prérequis techniques

**Réseau WiFi**:
- Tous les appareils sur le MÊME réseau WiFi
- Router accessible (maison, club, hotspot mobile)
- Pas besoin d'Internet (réseau local suffit)

**Appareils**:
- Maître: iOS ou Android avec SmartRace
- Clients: iOS ou Android avec SmartRace Connect
- Mix iOS/Android possible

### Configuration étape par étape

1. **Sur l'appareil maître**:
   ```
   SmartRace → Paramètres → SmartRace Connect → Activer serveur
   ```
   L'app affiche un code/adresse de connexion

2. **Sur chaque appareil client**:
   ```
   SmartRace Connect → Se connecter → Entrer code affiché par maître
   ```

3. **Association pilote**:
   - Chaque client choisit son nom de pilote
   - Le maître valide les connexions
   - Tableau de bord personnalisé par pilote

### Données disponibles par client

Chaque pilote sur son propre appareil voit:
- **Ses temps au tour** (en gros, bien visible)
- Son classement actuel
- Écart avec le leader
- Niveau de carburant
- Nombre de tours restants
- Historique de ses tours

**Actions possibles**:
- Bouton STOP (arrêt urgence)
- Réglage de son freinage
- Consultation de ses statistiques

---

## 4. Connectivité PC (Optionnelle)

### PC-Unit Connection

Le Control Unit possède un port PC (connexion via Lap Counter 30355 ou direct):

```
┌──────────────┐
│   PC / Mac   │
└──────┬───────┘
       │ USB
┌──────▼───────┐
│  PC-Unit /   │
│ Lap Counter  │
│   30355      │
└──────┬───────┘
       │ Câble propriétaire
┌──────▼───────┐
│ Control Unit │
└──────────────┘
```

**Fonctionnalités**:
- Export données temps réel vers PC
- Logiciels tiers de gestion de course
- Enregistrement sessions pour analyse
- Affichage sur grand écran

---

## 5. Mirroring / Projection (AirPlay, ChromeCast)

### SmartRace vers TV/Projecteur

SmartRace supporte le mirroring sans fil:

```
┌──────────────┐
│ Smartphone   │
│ (SmartRace)  │
└──────┬───────┘
       │ AirPlay ou ChromeCast
┌──────▼───────────┐
│  Apple TV  ou    │
│  ChromeCast      │
└──────┬───────────┘
       │ HDMI
┌──────▼───────────┐
│  TV / Écran /    │
│  Projecteur      │
└──────────────────┘
```

**Avantages**:
- Affichage grand format pour spectateurs
- Tableau des scores visible par tous
- Ambiance professionnelle pour événements
- Replays et statistiques projetés

**Configuration**:
1. Assurer que smartphone et Apple TV/ChromeCast sont sur même WiFi
2. Dans SmartRace: Activer mirroring
3. Sélectionner appareil de destination
4. Écran de course projeté automatiquement

---

## 6. Intégration complète - Cas d'usage

### Scénario 1: Course entre amis (2-4 pilotes)

**Matériel**:
- Control Unit + piste
- AppConnect
- 1 smartphone avec SmartRace

**Connexions**:
- Manettes sans fil 2.4 GHz → Control Unit
- AppConnect → Control Unit
- Smartphone → AppConnect (Bluetooth)

**Résultat**: Statistiques détaillées, classement temps réel sur smartphone

---

### Scénario 2: Compétition de club (6 pilotes)

**Matériel**:
- Control Unit + grande piste
- AppConnect
- 1 tablette avec SmartRace (maître)
- 6 smartphones avec SmartRace Connect (pilotes)
- Apple TV + TV grand écran

**Connexions**:
- Manettes sans fil → Control Unit
- AppConnect → Control Unit → Tablette maître (Bluetooth)
- Tablette maître → WiFi local → 6 smartphones clients
- Tablette maître → AirPlay → Apple TV → TV

**Résultat**:
- Chaque pilote suit sa performance en direct
- Grand écran montre le classement général
- Ambiance professionnelle

---

### Scénario 3: Championnat avec multiple courses

**Matériel identique au scénario 2**

**Fonctionnalités supplémentaires**:
- SmartRace Champions Club activé
- Mode Championship avec points cumulés
- Équipes configurées
- Historique complet sauvegardé

**Résultat**:
- Gestion complète du championnat sur plusieurs soirées
- Classements pilotes et équipes
- Statistiques détaillées par circuit

---

## 7. Sécurité et stabilité des connexions

### Bluetooth (AppConnect)

**Problèmes potentiels**:
- Interférences avec autres appareils Bluetooth
- Déconnexion si trop loin (>10m)
- Latence occasionnelle

**Solutions**:
- Garder smartphone à proximité de la piste
- Désactiver autres appareils Bluetooth inutiles
- Reconnecter en cas de déconnexion (rapide)

### WiFi (SmartRace Connect)

**Problèmes potentiels**:
- Tous appareils doivent être sur même réseau
- Routeur faible peut causer latence
- Trop d'appareils sur réseau ralentissent

**Solutions**:
- Utiliser routeur WiFi 5GHz si disponible
- Réseau dédié pour la course (éviter streaming concurrent)
- Hotspot smartphone possible si pas de WiFi

### Radio 2.4 GHz (Manettes)

**Très stable** - Technologie la plus fiable du système
- Rarement de problèmes
- Si problème: Vérifier batteries, réassocier manette

---

## 8. Tableau récapitulatif des connexions

| Composant | Se connecte à | Via | Portée | Nb. simultanés |
|-----------|--------------|-----|--------|----------------|
| Manette filaire | Control Unit | Câble jack | 2-3m | 4 |
| Manette sans fil | Control Unit | Radio 2.4 GHz | 15m | 6 |
| AppConnect | Control Unit | Câble propriétaire | N/A | 1 |
| Smartphone (maître) | AppConnect | Bluetooth LE | 10m | 1 |
| Smartphones (clients) | Smartphone maître | WiFi | 30m+ | Illimité |
| Apple TV/ChromeCast | Smartphone | AirPlay/Cast | WiFi | 1 |
| PC-Unit | Control Unit | Câble propriétaire | N/A | 1 |

---

## 9. Mise à jour et maintenance

### Firmware Control Unit
- Généralement pas de mises à jour publiques
- Si nécessaire, via PC-Unit

### AppConnect
- Firmware dans le module
- Pas de mise à jour utilisateur nécessaire

### Applications
- **Carrera Race App**: Mises à jour via App Store / Google Play
- **SmartRace**: Mises à jour régulières (vérifier tous les mois)

---

*L'interconnectivité du Carrera Digital 132 transforme une piste slot car traditionnelle en un système de gestion de course professionnel avec statistiques en temps réel et expérience multi-joueurs moderne.*
