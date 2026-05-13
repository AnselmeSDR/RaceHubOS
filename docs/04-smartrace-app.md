# SmartRace - Guide Complet

SmartRace est l'application tierce premium de référence pour Carrera Digital 132/124, offrant des fonctionnalités bien plus avancées que l'application officielle Carrera Race App.

---

## Vue d'ensemble

### Informations générales

| Caractéristique | Détail |
|----------------|--------|
| **Développeur** | Marc Buro (Allemagne) |
| **Version actuelle** | 6.1.5 (septembre 2025) |
| **Plateformes** | iOS, Android, macOS |
| **Prix base** | Version gratuite limitée + achats in-app |
| **Compatibilité** | Carrera Digital 132/124, systèmes analogiques |
| **Site officiel** | https://www.smartrace.de |

### Philosophie

SmartRace est conçu comme un **remplacement complet** de l'app officielle Carrera, avec:
- Interface plus intuitive
- Fonctionnalités professionnelles
- Support excellent et réactif
- Mises à jour régulières
- Communauté active

---

## Installation et Configuration

### Prérequis matériels

**Obligatoire**:
- Piste Carrera Digital 132 ou 124
- Control Unit 30352
- **AppConnect 30369** (adaptateur Bluetooth)

**Recommandé**:
- Tablette (écran plus grand qu'un smartphone)
- Réseau WiFi (pour SmartRace Connect)
- Apple TV ou ChromeCast (pour projection)

### Installation

1. **Télécharger l'app**:
   - **iOS**: App Store → Rechercher "SmartRace for Carrera Digital"
   - **Android**: Google Play → "SmartRace for Carrera Digital"
   - **macOS**: App Store (version Mac native)

2. **Première configuration**:
   ```
   Lancer app → Autoriser Bluetooth → Recherche AppConnect automatique
   ```

3. **Connexion**:
   ```
   AppConnect détecté → Connexion → Synchronisation Control Unit
   ```

4. **Configuration initiale**:
   - Langue (français disponible)
   - Unités (métrique/impérial)
   - Nombre de voitures
   - Noms des pilotes

### Versions et tarification

#### Version Gratuite

**Limitations**:
- Fonctionnalités de base uniquement
- Maximum 4 pilotes
- Pas de sauvegarde historique
- Pas d'export données
- Publicités occasionnelles

#### Version Pro (Achat unique)

**Prix**: ~10-15€ (selon plateforme)

**Débloques**:
- Jusqu'à 6 pilotes
- Historique illimité
- Export CSV/PDF
- Pas de publicités
- Widgets personnalisables
- Support complet

#### Champions Club (Abonnement)

**Prix**: ~4€/mois ou ~40€/an

**Inclut**:
- Tout de la version Pro
- Championnats
- Mode équipes
- Virtual Safety Car
- Simulation dégâts
- Simulation météo
- Système pénalités
- Fuel simulation avancée
- **SmartRace Connect** pour dispositifs illimités

---

## Interface et Navigation

### Écran principal

```
┌─────────────────────────────────────┐
│  [Menu] SmartRace      [Paramètres] │
├─────────────────────────────────────┤
│                                     │
│  Nouvelle Course                    │
│  ├─ Essais Libres                   │
│  ├─ Qualifications                  │
│  └─ Course                          │
│                                     │
│  Historique                         │
│  Base de données                    │
│  Championnats                       │
│  SmartRace Connect                  │
│                                     │
└─────────────────────────────────────┘
```

### Écran de course (exemple)

```
┌─────────────────────────────────────┐
│ 🏁 Course - 15:32 / 20:00          │
├──────────┬──────────────────────────┤
│ Pos  Nom │ Tours  Temps  Écart     │
├──────────┼──────────────────────────┤
│ 1 🟢 Marc│  24   15:32   Leader    │
│ 2 🔵 Anna│  24   15:35   +3.2s     │
│ 3 🟡 Paul│  23   15:38   -1 tour   │
│ 4 🔴 Lisa│  23   15:40   -1 tour   │
├──────────┴──────────────────────────┤
│ Dernier tour:                       │
│ Marc: 38.234s  Anna: 38.891s       │
│                                     │
│ [⏸️ Pause]  [⏹️ Stop]  [⚙️ Réglages]│
└─────────────────────────────────────┘
```

---

## Fonctionnalités Détaillées

### 1. Modes de Course

#### Essais Libres (Free Practice)

**Configuration**:
```
Durée: Illimitée ou limitée (ex: 15 min)
Voitures actives: 1-6
Carburant: ON/OFF
```

**Affichage**:
- Temps au tour en temps réel
- Meilleur tour de chaque pilote
- Record de piste (si existant)
- Niveau carburant

**Usage**:
- Découverte circuit
- Recherche setup optimal
- Entraînement

#### Qualifications

**Configuration**:
```
Durée: 5, 10, 15 minutes (personnalisable)
Système: Meilleur tour compte
Tours max: Illimité dans le temps imparti
```

**Fonctionnalités spéciales**:
- **Chronos individuels**: Chaque pilote peut voir uniquement ses temps
- **Ordre de sortie**: Séquentiel ou simultané
- **Temps d'attente**: Entre deux tentatives

**Résultat**:
- Grille de départ générée automatiquement
- Sauvegardée pour la course suivante

#### Course

**Configuration au temps**:
```
Durée: 10, 20, 30 min... (personnalisable)
Départ: Arrêté, lancé, ou Rolling Start
Carburant: ON/OFF/REAL
```

**Configuration aux tours**:
```
Nombre de tours: 20, 50, 100... (personnalisable)
Autres options identiques
```

**Événements en direct**:
- Changements de position (notifications)
- Pit stops (temps affiché)
- Meilleurs tours (annonce vocale)
- Incidents (pénalités)

---

### 2. Base de Données

#### Pilotes

**Informations stockées**:
```
- Nom, prénom
- Photo (de la galerie ou caméra)
- Couleur assignée
- Équipe (si mode équipes actif)
- Statistiques carrière:
  * Nombre de courses
  * Victoires
  * Podiums
  * Meilleur tour global
  * Record par circuit
```

**Avantage**: Historique complet de chaque pilote

#### Voitures

**Fiche par voiture**:
```
- Marque, modèle
- Année
- Photo
- Réglages préférés:
  * Vitesse max
  * Force freinage
  * Capacité réservoir
- Historique performances
- Meilleur tour
```

**Usage**:
- Charger setup rapidement
- Comparer performances voitures
- Équilibrage (BOP)

#### Circuits

**Fiche par circuit**:
```
- Nom (ex: "Monaco Grand Prix")
- Configuration (schéma ou photo)
- Longueur estimée
- Nombre de virages
- Record absolu (tous pilotes)
- Record par voiture
- Record par pilote
- Historique courses disputées
```

---

### 3. Statistiques et Analyses

#### Pendant la course

**Temps réel**:
- Position actuelle
- Temps au tour (actuel, dernier, meilleur)
- Écart avec leader
- Écart avec voiture devant/derrière
- Niveau carburant
- Nombre pit stops
- Pénalités en attente

#### Après la course

**Rapport détaillé**:
```
┌─────────────────────────────────────┐
│ Résultat Final                      │
├──────────────────────────────────────┤
│ 1. Marc    25 tours  20:00.123     │
│    Meilleur tour: 38.234s (T12)    │
│    Pit stops: 2 (T8, T18)          │
│    Vitesse moy.: 124.5 km/h        │
│                                     │
│ 2. Anna    25 tours  20:04.567     │
│    Écart: +4.444s                  │
│    ...                              │
└─────────────────────────────────────┘
```

**Graphiques**:
- Évolution positions tour par tour
- Écarts entre pilotes
- Consommation carburant
- Distribution temps au tour

#### Analyse comparative

**Comparaison pilotes**:
```
Pilote A vs Pilote B:
- Nombre de courses disputées ensemble
- Victoires de chacun
- Moyennes temps au tour
- Face-à-face direct
```

---

### 4. Tuning et Réglages

#### Interface de réglage

**Par voiture (granularité 1%)**:

```
┌─────────────────────────────────────┐
│ Voiture #1 - Ferrari 488 GT3       │
├─────────────────────────────────────┤
│ Vitesse maximum:                    │
│ [||||||||||||||||----] 85%          │
│                                     │
│ Force de freinage:                  │
│ [||||||||||----------] 60%          │
│                                     │
│ Capacité réservoir:                 │
│ [||||||||||||||||||||] 100 unités   │
│                                     │
│ [Sauvegarder] [Profil par défaut]  │
└─────────────────────────────────────┘
```

#### Profils de réglage

**Création de profils**:
```
Profil "Circuit rapide": Vitesse 100%, Freinage 50%, Tank 80
Profil "Circuit technique": Vitesse 90%, Freinage 80%, Tank 100
Profil "Endurance": Vitesse 85%, Freinage 70%, Tank 120
```

**Application rapide**:
```
Avant course → Sélectionner circuit → Charger profil approprié
```

#### Balance of Performance (BOP)

**Outil d'équilibrage**:

SmartRace peut calculer automatiquement les réglages pour égaliser les voitures:

```
1. Lancer tests avec toutes les voitures
2. SmartRace analyse performances
3. Propose ajustements:
   * Voiture rapide: Vitesse réduite
   * Voiture lente: Vitesse augmentée
4. Appliquer BOP
```

**Résultat**: Courses serrées même avec voitures différentes

---

### 5. Gestion du Carburant

#### Affichage en direct

**Pendant la course**:
```
Pilote: Marc
Tank: [||||||||||||--------] 60%
Estimation: 12 tours restants
Recommandation: Pit au tour 22
```

#### Calculs prédictifs

SmartRace analyse:
- Consommation moyenne par tour
- Tours restants dans course
- Prévision: "Pit stop nécessaire" ou "Tank suffisant"

#### Stratégies suggérées

**Simulation**:
```
Stratégie 1: 1 pit stop au tour 15
  → Temps total estimé: 20:15

Stratégie 2: 2 pits stops (T10, T20)
  → Temps total estimé: 20:22

Recommandation: Stratégie 1
```

---

### 6. SmartRace Connect (Multi-dispositifs)

#### Configuration

**Sur appareil maître (tablette)**:
```
Menu → SmartRace Connect → Activer serveur
→ Code de connexion affiché (ex: "1234-ABCD")
```

**Sur appareils clients (smartphones)**:
```
SmartRace Connect (app gratuite) → Se connecter
→ Entrer code → Choisir nom pilote → Confirmer
```

#### Interface pilote (smartphone client)

```
┌─────────────────────────────────────┐
│ Marc - Position: 2/6               │
├─────────────────────────────────────┤
│                                     │
│  Dernier tour: 38.234s              │
│  Meilleur tour: 37.891s (T8)       │
│                                     │
│  Écart leader: +3.2s                │
│  Écart #1: +3.2s                    │
│  Écart #3: -1.8s                    │
│                                     │
│  Tank: [||||||||||||---] 65%        │
│  Tours restants: ~14                │
│                                     │
│  [🛑 STOP]    [⚙️ Freinage]         │
│                                     │
└─────────────────────────────────────┘
```

**Fonctionnalités par pilote**:
- Voir ses statistiques en temps réel
- Ajuster son propre freinage
- Bouton STOP d'urgence (arrête toute la course)
- Consulter historique de ses tours

#### Avantages

**Pour les pilotes**:
- Chacun suit sa propre performance
- Pas de distraction en regardant grand écran
- Statistiques personnelles

**Pour l'organisateur**:
- Écran principal montre vue d'ensemble
- Moins de questions des pilotes
- Ambiance plus professionnelle

---

### 7. Championnats (Champions Club)

#### Création d'un championnat

**Configuration**:
```
Nom: "Championnat Hiver 2025"
Nombre de courses: 8
Système de points: F1 (25-18-15-12-10-8-6-4-2-1)
Circuits: Rotation ou fixe
Équipes: Oui/Non
```

#### Déroulement

**À chaque manche**:
```
1. Course disputée normalement
2. Résultats enregistrés automatiquement
3. Points attribués selon classement
4. Classement général mis à jour
```

**Classements parallèles**:
- Classement pilotes
- Classement équipes (si activé)
- Statistiques cumulées

#### Modes spéciaux

##### Car Swap Mode

**Principe**: Rotation automatique pour équité

**Configuration**:
```
4 pilotes, 4 voitures, 4 courses
→ SmartRace génère rotation automatique
→ Chaque pilote utilise chaque voiture 1 fois
```

**Classement final**: Basé sur cumul des points, élimine avantage matériel

##### Party Mode

**Pour soirées/événements**:
```
8 pilotes inscrits
→ SmartRace génère matchs automatiques
→ Tous s'affrontent au moins 1 fois
→ Classement général établi
```

---

### 8. Fonctionnalités Avancées (Champions Club)

#### Virtual Safety Car (VSC)

**Activation**:
```
Incident détecté → Bouton "VSC" → Tous limités à 70% vitesse
→ Incident résolu → Désactiver VSC → Vitesse normale
```

**Avantage**: Neutralisation sans voiture physique

#### Simulation de Dégâts

**Configuration**:
```
Dégâts légers: -5% vitesse, réparation 5 sec
Dégâts moyens: -15% vitesse, réparation 15 sec
Dégâts lourds: -30% vitesse, réparation 30 sec
```

**Détection**:
- Manuelle (bouton "Dégâts" par commissaire)
- Automatique si capteurs (non standard)

**Impact**:
- Voiture ralentie jusqu'au pit
- Temps réparation ajouté au pit stop
- Stratégie modifiée

#### Simulation Météo

**Conditions**:
```
Sec: 100% adhérence
Pluie légère: 90% adhérence, conso +5%
Pluie forte: 80% adhérence, conso +10%
```

**Changements dynamiques**:
```
Début course: Sec
Tour 15: Pluie légère arrive
Tour 25: Pluie forte
Tour 35: Assèchement progressif
```

**Stratégie**:
- Adapter vitesse selon conditions
- Timing pit stops modifié
- Plus réaliste

#### Système de Pénalités

**Types disponibles**:
```
+5 secondes
+10 secondes
+30 secondes
Drive-through (passage pit lane à vitesse limitée)
Stop & Go (arrêt 10 sec au stand)
```

**Attribution**:
```
Commissaire → Sélectionner pilote → Type pénalité → Appliquer
```

**Purge**:
- Automatique au prochain pit stop
- Temps ajouté visible en direct

---

### 9. Audio et Ambiance

#### Annonces vocales

**Configuration**:
```
Paramètres → Audio → Activer annonces → Choisir langue
```

**Événements annoncés**:
- Meilleur tour: "Marc, meilleur tour de la course, 37.891 secondes"
- Changement de leader: "Anna prend la tête de la course"
- Pit stop: "Marc au stand"
- Fin de course: "Drapeau à damier, Marc remporte la course"

**Voix**: Synthèse vocale, qualité excellente

#### Sons d'ambiance

**Bibliothèque de sons**:
- Ambiance Le Mans (bruit foule, haut-parleurs)
- Ambiance F1 (moteurs, stands)
- Ambiance NASCAR (public américain)
- Ambiance VLN (Nürburgring)
- Klaxon pit lane
- Cloche départ/arrivée

**Configuration**:
```
Paramètres → Audio → Sons d'ambiance → Choisir type → Volume
```

**Immersion**: Transforme la course en événement réaliste

---

### 10. Export et Partage

#### Export des résultats

**Formats disponibles**:

##### CSV (Excel)
```
Position,Nom,Tours,Temps Total,Meilleur Tour,Pits
1,Marc,25,20:00.123,37.891,2
2,Anna,25,20:04.567,38.234,2
...
```

**Usage**: Analyse détaillée dans Excel, graphiques personnalisés

##### PDF
```
Rapport complet formaté:
- En-tête avec logos
- Tableau résultats
- Graphiques
- Statistiques
- Prêt à imprimer
```

##### JSON
```json
{
  "race": {
    "date": "2025-11-21",
    "duration": "20:00",
    "drivers": [
      {
        "name": "Marc",
        "position": 1,
        "laps": 25,
        ...
      }
    ]
  }
}
```

**Usage**: Intégration avec autres systèmes, développement custom

#### Partage

**Méthodes**:
- Email (envoyer rapport PDF)
- AirDrop (iOS)
- Bluetooth (partage local)
- Cloud (sauvegarde Google Drive, iCloud)

**Réseaux sociaux**:
```
Bouton "Partager" → Génération image résultats → Post Facebook/Twitter
```

---

### 11. Mirroring et Projection

#### AirPlay (Apple)

**Configuration**:
```
1. iPad/iPhone et Apple TV sur même WiFi
2. SmartRace → Centre de contrôle → Recopie écran
3. Sélectionner Apple TV
4. Projection automatique
```

**Qualité**: 1080p ou 4K selon Apple TV

#### ChromeCast (Google)

**Configuration**:
```
1. Android/iOS et ChromeCast sur même WiFi
2. SmartRace → Bouton Cast → Sélectionner ChromeCast
3. Projection démarre
```

#### Mode Spectateur

**Écran projeté peut être différent**:
```
Sur tablette: Vue organisateur (contrôles complets)
Sur TV: Vue spectateurs (classement, stats, pas de contrôles)
```

---

### 12. Personnalisation

#### Thèmes et couleurs

**Thèmes prédéfinis**:
- Clair (jour)
- Sombre (nuit, réduit fatigue yeux)
- Contraste élevé (visibilité)

**Couleurs pilotes**:
- Assignation manuelle ou automatique
- 16 couleurs disponibles
- Cohérence sur tous les écrans

#### Widgets écran de course

**Éléments disponibles**:
- Classement en direct
- Temps au tour
- Carburant
- Graphique positions
- Météo (si activée)
- Timer course

**Personnalisation**:
```
Édition écran → Drag & drop widgets → Redimensionner → Sauvegarder
```

**Profils**:
```
Profil "Organisateur": Tous widgets, petits
Profil "Spectateur": Classement en grand
Profil "Pilote": Ses stats en grand
```

#### Unités

**Configuration**:
```
Distances: km ou miles
Vitesse: km/h ou mph
Carburant: Litres, gallons, ou unités
```

---

### 13. Support et Communauté

#### Support développeur

**Canaux**:
- Email: support@smartrace.de
- Forum officiel: https://www.smartrace.de/forum
- Facebook: Groupe SmartRace
- Réponse: Généralement <24h

#### Documentation

- Manuel utilisateur complet (EN, DE, FR)
- Tutoriels vidéo
- FAQ extensive
- Guide de dépannage

#### Mises à jour

**Fréquence**: Toutes les 4-8 semaines

**Contenus typiques**:
- Nouvelles fonctionnalités
- Corrections bugs
- Améliorations performances
- Compatibilité nouveaux OS

**Notifications**: Automatiques via App Store/Google Play

---

### 14. Comparaison avec Carrera Race App

| Fonctionnalité | Carrera Race App | SmartRace |
|---------------|-----------------|-----------|
| Prix | Gratuit | Gratuit + Pro |
| Interface | Basique | Professionnelle |
| Pilotes max | 6 | 6 |
| Historique | Limité | Illimité |
| Statistiques | Basiques | Détaillées |
| Export données | Non | CSV/PDF/JSON |
| Championnats | Non | Oui (Pro) |
| SmartRace Connect | Non | Oui (Pro) |
| VSC | Non | Oui (Pro) |
| Simulation dégâts | Non | Oui (Pro) |
| Météo | Non | Oui (Pro) |
| Sons ambiance | Non | Oui |
| Personnalisation | Limitée | Extensive |
| Support | Email | Multi-canal |
| Mises à jour | Rares | Régulières |

**Verdict**: SmartRace largement supérieur pour utilisateurs sérieux

---

### 15. Conseils d'utilisation

#### Pour débutants

1. **Commencer simple**:
   - Version gratuite
   - Mode essais libres
   - 2-3 pilotes seulement

2. **Progresser**:
   - Ajouter qualifications
   - Activer carburant
   - Découvrir statistiques

3. **Investir si passionné**:
   - Version Pro (~15€)
   - Champions Club si courses régulières

#### Pour clubs

1. **Configuration optimale**:
   - Tablette 10-12 pouces (maître)
   - Champions Club (championnats)
   - SmartRace Connect (tous les membres)
   - TV + ChromeCast/Apple TV

2. **Organisation**:
   - Créer profils tous les membres
   - Base de données voitures complète
   - Multiples configurations circuits
   - Sauvegarde régulière données

3. **Événements**:
   - Party Mode pour nouvelles personnes
   - Championnats pour membres réguliers
   - Projection sur grand écran
   - Rapports PDF après chaque manche

---

## Dépannage

### Problèmes courants

#### "AppConnect non détecté"

**Solutions**:
1. Vérifier AppConnect bien branché au Control Unit
2. Redémarrer Control Unit (off/on)
3. Désactiver/réactiver Bluetooth smartphone
4. Relancer SmartRace
5. Oublier appareil Bluetooth et reconnecter

#### "Temps au tour incohérents"

**Causes possibles**:
- Voiture pas bien codée
- Interférence électrique
- Connexions piste sales

**Solutions**:
- Recoder la voiture
- Nettoyer rails et contacts voiture
- Vérifier connexions électriques piste

#### "SmartRace Connect ne connecte pas"

**Vérifications**:
- Tous appareils sur MÊME réseau WiFi
- Code connexion correct (sensible casse)
- Firewall/sécurité réseau pas trop restrictif
- Version SmartRace à jour sur tous appareils

---

*SmartRace est l'outil indispensable pour transformer votre Carrera Digital 132 en système de course professionnel avec statistiques détaillées, gestion complète et expérience multi-joueurs moderne.*
