# Fonctionnalités Avancées - Carrera Digital 132

Le système Carrera Digital 132 va bien au-delà d'une simple piste de slot car, offrant des fonctionnalités dignes de simulations de course professionnelles.

---

## 1. Changement de Voie Numérique

### Principe de base

Contrairement aux pistes analogiques où chaque voiture reste dans sa voie, le système Digital 132 permet le changement de voie stratégique.

```
Voie 1: ═══════╗     ╔════════
               ║     ║
Voie 2: ═══════╚═════╝════════

        Aiguillage numérique
```

### Fonctionnement

**Commande**:
- Bouton "Lane Change" sur la manette
- Chaque appui = tentative de changement de voie

**Détection**:
- Aiguillages équipés de capteurs
- Communication instantanée avec Control Unit
- Moteur d'aiguillage actionné en <100ms

**Stratégie**:
- Dépassement des adversaires
- Évitement d'obstacles
- Optimisation de trajectoire
- Entrée/sortie pit lane

### Limitations

- Impossible de changer si une voiture occupe déjà l'emplacement
- Nombre d'aiguillages dépend de la configuration de piste
- Ghost Cars et Pace Cars ont comportements spéciaux

---

## 2. Système de Carburant (FUEL)

### Modes de carburant

Le Control Unit propose 3 modes via le switch "FUEL":

#### Mode OFF
- Carburant désactivé
- Voitures roulent indéfiniment
- Pas de pit stops nécessaires
- **Usage**: Débutants, essais libres

#### Mode ON
- Consommation active de carburant
- Basée sur position gâchette (plus d'accélération = plus de consommation)
- Tank vide = ralentissement automatique + lumières clignotantes
- **Usage**: Course standard avec stratégie pit

#### Mode REAL
- Comme mode ON
- **PLUS**: Voiture avec réservoir plein est plus lourde et donc légèrement plus lente
- Simule le poids réel du carburant
- **Usage**: Course réaliste, compétitions avancées

### Gestion du carburant

**Capacité du réservoir**:
- Programmable par voiture (via Control Unit ou app)
- Valeurs typiques: 50-150 "unités"
- Impact direct sur stratégie course

**Consommation**:
```
Gâchette à 100% → Consommation maximale
Gâchette à 50%  → Consommation réduite
Gâchette à 0%   → Pas de consommation
```

**Indicateurs**:
- LED sur voiture (selon modèle)
- Affichage temps réel sur app
- Clignotement quand critique (<10%)

### Stratégies de course

**Stratégie agressive**:
- Accélération maximale constante
- Pit stop fréquents (2-3 par course)
- Risque de tomber en panne

**Stratégie économique**:
- Gestion douce de l'accélération
- 1 seul pit stop
- Tours potentiellement plus lents

**Stratégie mixte**:
- Attaque en début de stint
- Économie en fin de stint
- Optimisation mathématique

---

## 3. Pit Lane et Pit Stop

### Composants du Pit Lane

#### Aiguillages spéciaux
- **Entrée pit**: Aiguillage commandé par pilote
- **Sortie pit**: Aiguillage automatique ou commandé
- **Protection**: Ghost Cars ne peuvent pas activer ces aiguillages

#### PSAU (Pit Stop Adapter Unit)

Section de piste spéciale avec:
- **Capteur FUEL**: Détecte passage voiture
- **Zone de ravitaillement**: Active le mode "au stand"
- **Signalisation**: LED ou indicateurs

### Procédure de pit stop

1. **Entrée**:
   ```
   Pilote appuie sur bouton changement de voie → Entrée pit lane
   ```

2. **Positionnement**:
   ```
   Voiture roule jusqu'au capteur PSAU → Détection automatique
   ```

3. **Ravitaillement**:
   ```
   Mode "au stand" activé → Bouton rouge pressé → Tank se remplit
   ```

4. **Sortie**:
   ```
   Gâchette >50% → Voiture quitte mode stand → Sortie pit lane
   ```

### Pénalités au stand

Via SmartRace, possibilité d'ajouter:
- **Pénalités de temps**: Voiture doit rester X secondes au stand
- **Pénalités de tours**: X tours à purger (mode avancé)
- **Dégâts simulés**: Temps de réparation

### Durée d'un pit stop

**Physique** (temps réel):
- Entrée pit: ~3-5 secondes
- Positionnement: ~1-2 secondes
- Ravitaillement: ~2-3 secondes (appui bouton)
- Sortie pit: ~3-5 secondes
- **Total**: 9-15 secondes

**Avec app** (configurable):
- Temps minimum imposé
- Pénalités ajoutables
- Simulation dégâts

---

## 4. Ghost Cars (Voitures Autonomes)

### Concept

Les Ghost Cars sont des voitures programmables qui roulent de façon autonome sans pilote humain.

### Programmation d'une Ghost Car

**Méthode via Control Unit**:

1. **Activer mode Ghost**:
   ```
   Maintenir bouton spécifique sur Control Unit
   ```

2. **Placer voiture sur piste**:
   ```
   Voiture se met en mode programmation
   ```

3. **Définir vitesse**:
   ```
   Via potentiomètre ou boutons → Vitesse constante définie
   ```

4. **Lancer**:
   ```
   Voiture roule indéfiniment à vitesse programmée
   ```

**Méthode via SmartRace** (plus simple):
```
App → Ajouter Ghost Car → Choisir vitesse (0-100%) → Lancer
```

### Comportement

- **Vitesse**: Constante dans virages ET lignes droites
- **Changements de voie**: Automatiques et aléatoires OU programmables
- **Pit lane**: N'entre JAMAIS au stand
- **Carburant**: Infini (pas de consommation)
- **Dégâts**: Aucun

### Usages

**Ajout de trafic**:
- Rendre courses plus difficiles
- Simulation de doublement
- Ambiance plus réaliste

**Entraînement**:
- Référence de rythme
- Apprentissage trajectoires
- Objectif à dépasser

**Démonstration**:
- Voiture d'exposition tournant en continu
- Événements publics

**Limite importante**: Les Ghost Cars occupent un "slot" de pilote (max 6 voitures total).

---

## 5. Pace Car / Safety Car

### Concept

La Pace Car est une voiture de sécurité qui contrôle la vitesse de la course, typique en sport automobile.

### Programmation

**Procédure complète**:

1. **Activation mode Pace Car**:
   ```
   Double-clic bouton Control Unit
   ```

2. **Placement**:
   ```
   Lever voiture, attendre 1/4 seconde, placer sur piste
   ```

3. **Confirmation**:
   ```
   Double-clic, pause, double-clic
   ```

4. **Définition vitesse**:
   ```
   Accélérer manuellement jusqu'à vitesse désirée
   ```

5. **Verrouillage**:
   ```
   Appui bouton changement de voie → Vitesse verrouillée
   ```

### Comportement pendant course

**En roulant**:
- Ignore tous les aiguillages normaux
- Vitesse constante programmée
- Ne peut pas être dépassée (règle à respecter manuellement)

**Fin de neutralisation**:
- Appui second bouton "Pace Car" sur Control Unit
- Pace Car prend TOUS les aiguillages qu'elle rencontre
- Entre automatiquement au pit lane
- **S'arrête immédiatement** (détection tension modifiée)

### Usages

**Neutralisation après incident**:
```
Sortie de piste → Pace Car déployée → Tous suivent à vitesse réduite →
Voiture replacée → Pace Car rentre → Course reprend
```

**Départ course type Le Mans**:
```
Pace Car mène le peloton → 1 tour de chauffe →
Pace Car rentre au stand → Départ lancé
```

**Simulation professionnelle**:
- Ambiance course réelle
- Stratégie pit stops modifiée
- Tension accrue

---

## 6. Réglages Personnalisés par Voiture

### Via Control Unit (Basique)

**Paramètres ajustables**:
- **Vitesse maximale**: 0-100%
- **Force de freinage**: 0-100%
- **Capacité réservoir**: Variable

**Méthode**:
```
Sélectionner voiture (1-6) → Modifier paramètre → Enregistrer
```

### Via App (Avancé)

SmartRace et Carrera Race App offrent réglages bien plus précis:

#### Vitesse
- **Contrôle fin**: Incréments de 1%
- **Profils**: Sauvegarde configurations par voiture
- **Équilibrage**: Égaliser performances pour équité

#### Freinage
- **Agressivité**: Léger à brutal
- **Progressivité**: Linéaire vs exponentiel
- **Par pilote**: Adaptation au style de conduite

#### Réservoir
- **Capacité exacte**: En unités ou litres virtuels
- **Consommation**: Facteur multiplicateur
- **Stratégie**: Prédiction pit stops

### Équilibrage des performances (BOP)

**Balance of Performance** - Égaliser voitures de performances différentes:

```
Voiture A (très rapide):  Vitesse 85%, Réservoir 80 unités
Voiture B (moyenne):      Vitesse 95%, Réservoir 100 unités
Voiture C (lente):        Vitesse 100%, Réservoir 120 unités
```

**Résultat**: Courses serrées malgré voitures différentes

---

## 7. Modes de Course

### Essais Libres (Free Practice)

- Pas de limite de temps
- Pas de classement officiel
- Enregistrement temps au tour
- Recherche du setup optimal

### Qualifications

- Temps limité (ex: 5 minutes)
- Meilleur tour compte
- Définit grille de départ course
- Chrono individuel par pilote

### Course

**Au temps**:
```
Durée fixe (ex: 20 minutes) → Vainqueur = plus de distance parcourue
```

**Au nombre de tours**:
```
Distance fixe (ex: 50 tours) → Vainqueur = premier à finir
```

### Championnats (SmartRace)

**Système de points**:
```
1er: 25 points
2e:  18 points
3e:  15 points
...
```

**Multiple courses**:
- Points cumulés sur saison
- Classement général
- Champion déterminé en fin de saison

---

## 8. Fonctionnalités SmartRace Premium

### Virtual Safety Car (VSC)

**Simulation numérique**:
- Pas de voiture physique
- Tous les pilotes limités à vitesse réduite (ex: 70%)
- Décompte temps réel
- Fin VSC = vitesse normale

**Usage**: Incident sans avoir Pace Car physique

### Simulation de Dégâts

**Système de dommages**:
- Sortie de piste = dégâts légers (5 sec pénalité)
- Contact simulé = dégâts moyens (10 sec)
- Accident grave = dégâts lourds (pit stop obligatoire)

**Impact**:
- Vitesse réduite si dégâts
- Réparation au pit
- Stratégie modifiée

### Simulation Météo

**Conditions variables**:
- **Sec**: Adhérence normale
- **Pluie**: Vitesse max réduite, consommation modifiée
- **Changements**: Météo évolue pendant course

**Stratégie**:
- Adaptation pilotage
- Choix moments pit stops

### Système de Pénalités

**Types**:
- **Temps**: +5, +10, +30 secondes
- **Tours**: Tour de pénalité (passage au stand sans arrêt)
- **Drive-through**: Pit lane à vitesse limitée

**Application**:
- Manuel (commissaire)
- Automatique (sortie piste détectée)

**Purge**:
- Au pit stop (ajouté au temps)
- Tour de pénalité à effectuer

---

## 9. Modes Multi-joueurs Avancés

### Car Swap Mode

**Principe**:
- Rotation automatique des voitures
- Chaque pilote utilise chaque voiture au moins une fois
- Élimine avantage matériel

**Exemple** (4 pilotes, 4 voitures):
```
Course 1: A→V1, B→V2, C→V3, D→V4
Course 2: A→V2, B→V3, C→V4, D→V1
Course 3: A→V3, B→V4, C→V1, D→V2
Course 4: A→V4, B→V1, C→V2, D→V3
```

**Classement**: Cumul des points toutes courses

### Party Mode

**Génération automatique de matchs**:
- Tous les pilotes s'affrontent au moins 1 fois
- Courses par paires ou petits groupes
- Idéal pour tournois

**Exemple** (6 pilotes):
```
Course 1: A vs B vs C
Course 2: D vs E vs F
Course 3: A vs D
Course 4: B vs E
...
```

### Team Racing

**Équipes**:
- 2+ pilotes par équipe
- Points cumulés
- Stratégie d'équipe (sacrifice, couverture)

**Classements parallèles**:
- Classement individuel pilotes
- Classement équipes
- Champion pilote ≠ Équipe championne possible

---

## 10. Codage et Décodage des Voitures

### Codage (Association voiture ↔ contrôleur)

**Procédure**:
```
1. Maintenir bouton contrôleur (position 1-6)
2. Placer voiture sur piste
3. LED voiture clignote → Codage réussi
4. Relâcher bouton
```

**Chaque voiture** = Un seul contrôleur à la fois

### Décodage (Réassociation)

**Pourquoi**:
- Changer de contrôleur
- Voiture ne répond plus
- Reset après problème

**Procédure Control Unit**:
```
Bouton "Code/Decode" → Sélectionner voiture → Decode → Recoder
```

**Procédure App**:
```
Paramètres → Voitures → Sélectionner → Décoder → Nouveau codage
```

### Multi-voitures par pilote

**Possible** mais une seule voiture active à la fois:
```
Pilote A contrôle V1 → Code V2 → V1 ne répond plus, V2 active
```

**Usage**: Changement de voiture entre courses

---

## 11. Enregistrement et Replay (SmartRace)

### Données enregistrées

**Par tour**:
- Temps au tour précis (millisecondes)
- Position dans course
- Niveau carburant
- Événements (pit, pénalité, dépassement)

**Par course**:
- Classement final
- Meilleur tour
- Historique complet positions
- Statistiques détaillées

### Export des données

**Formats disponibles**:
- **CSV**: Import Excel, Google Sheets
- **PDF**: Rapport imprimable
- **JSON**: Analyse programmatique

### Historique illimité

SmartRace conserve:
- Toutes les courses jamais disputées
- Évolution performances dans le temps
- Records personnels par circuit

---

## 12. Personnalisation Avancée

### Profils de pilotes

**Informations**:
- Nom, photo
- Statistiques carrière
- Voiture préférée
- Records personnels

### Base de données voitures

**Par voiture**:
- Modèle, marque
- Photo
- Réglages favoris
- Historique performances

### Base de données circuits

**Par circuit**:
- Nom, configuration
- Photo/schéma
- Record absolu
- Record par voiture

### Widgets personnalisables

**Écran de course configurable**:
- Taille éléments
- Position (drag & drop)
- Informations affichées
- Thème couleurs

---

*Les fonctionnalités avancées du Carrera Digital 132 permettent de transformer chaque course en une expérience professionnelle et stratégique digne des plus grandes compétitions motorsport.*
