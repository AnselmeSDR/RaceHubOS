# Composants d'affichage des pilotes

Ce fichier contient tous les composants réutilisables pour afficher les pilotes dans différents contextes, inspirés des designs NASCAR et Formule 1.

## Vue d'ensemble

6 composants principaux sont disponibles :

1. **DriverProfileHeader** - En-tête de profil complet
2. **DriverListItem** - Format liste compact
3. **DriverGridPosition** - Grille de départ NASCAR
4. **DriverStanding** - Classement avec points
5. **DriverSelectCard** - Sélection multi-pilotes
6. **DriverBadge** - Badge compact

## Démo

Pour voir tous les composants en action, visitez : `/demo-displays`

## Utilisation

### 1. DriverProfileHeader

En-tête de profil détaillé avec photo, stats, et meilleur tour.

**Usage :**
```jsx
import { DriverProfileHeader } from '../components/DriverDisplays'

<DriverProfileHeader driver={driver} />
```

**Props :**
- `driver` (object, required) - Objet pilote avec toutes les informations

**Contexte d'usage :**
- Page de profil pilote
- Modal de détails pilote
- En-tête de statistiques

---

### 2. DriverListItem

Format horizontal compact pour listes et sélections.

**Usage :**
```jsx
import { DriverListItem } from '../components/DriverDisplays'

<DriverListItem
  driver={driver}
  position={1}
  selected={false}
  onClick={() => handleSelect(driver)}
  showStats={true}
/>
```

**Props :**
- `driver` (object, required) - Objet pilote
- `position` (number, optional) - Numéro de position à afficher
- `selected` (boolean, optional) - État de sélection
- `onClick` (function, optional) - Handler de clic
- `showStats` (boolean, optional) - Afficher les stats (courses, victoires)

**Contexte d'usage :**
- Liste de pilotes
- Sélection pour une session
- Menu déroulant
- Résultats de recherche

---

### 3. DriverGridPosition

Format grille de départ NASCAR avec ROW.

**Usage :**
```jsx
import { DriverGridPosition } from '../components/DriverDisplays'

<DriverGridPosition
  driver={driver}
  row={1}
  side="left"
/>
```

**Props :**
- `driver` (object, required) - Objet pilote
- `row` (number, required) - Numéro de rangée (ROW 1, 2, 3...)
- `side` (string, optional) - "left" ou "right" (défaut: "left")

**Contexte d'usage :**
- Configuration grille de départ
- Affichage pré-course
- Planning de session

**Exemple complet :**
```jsx
{drivers.map((driver, index) => {
  const row = Math.floor(index / 2) + 1
  const side = index % 2 === 0 ? 'left' : 'right'

  return (
    <div key={driver.id}>
      {side === 'left' && (
        <>
          <DriverGridPosition driver={driver} row={row} side="left" />
          <div className="row-label">ROW {row}</div>
        </>
      )}
      {side === 'right' && (
        <>
          <div className="row-label">ROW {row}</div>
          <DriverGridPosition driver={driver} row={row} side="right" />
        </>
      )}
    </div>
  )
})}
```

---

### 4. DriverStanding

Classement avec position, points et changement.

**Usage :**
```jsx
import { DriverStanding } from '../components/DriverDisplays'

<DriverStanding
  driver={driver}
  position={1}
  points={250}
  change={2}
/>
```

**Props :**
- `driver` (object, required) - Objet pilote
- `position` (number, required) - Position au classement (1, 2, 3...)
- `points` (number, optional) - Nombre de points
- `change` (number, optional) - Changement de position (+2, -1, 0)

**Contexte d'usage :**
- Classement de championnat
- Résultats de course
- Standings en temps réel

**Couleurs de position :**
- Position 1 : Or (bg-yellow-400)
- Position 2 : Argent (bg-gray-300)
- Position 3 : Bronze (bg-orange-400)
- Autres : Gris (bg-gray-100)

---

### 5. DriverSelectCard

Carte de sélection multi-pilotes style TV NASCAR.

**Usage :**
```jsx
import { DriverSelectCard } from '../components/DriverDisplays'

<DriverSelectCard
  driver={driver}
  selected={selectedDrivers.includes(driver.id)}
  onToggle={() => toggleDriver(driver.id)}
/>
```

**Props :**
- `driver` (object, required) - Objet pilote
- `selected` (boolean, required) - État de sélection
- `onToggle` (function, required) - Handler de toggle

**Contexte d'usage :**
- Configuration de session (sélection des pilotes)
- Multi-sélection pour une course
- Setup d'événement

**Exemple complet :**
```jsx
const [selectedDrivers, setSelectedDrivers] = useState([])

function toggleDriver(driverId) {
  setSelectedDrivers(prev =>
    prev.includes(driverId)
      ? prev.filter(id => id !== driverId)
      : [...prev, driverId]
  )
}

return (
  <div className="grid grid-cols-3 gap-4">
    {drivers.map(driver => (
      <DriverSelectCard
        key={driver.id}
        driver={driver}
        selected={selectedDrivers.includes(driver.id)}
        onToggle={() => toggleDriver(driver.id)}
      />
    ))}
  </div>
)
```

---

### 6. DriverBadge

Badge compact avec numéro pour affichages miniatures.

**Usage :**
```jsx
import { DriverBadge } from '../components/DriverDisplays'

<DriverBadge
  driver={driver}
  size="md"
  showName={true}
/>
```

**Props :**
- `driver` (object, required) - Objet pilote
- `size` (string, optional) - Taille : "sm", "md", "lg", "xl" (défaut: "md")
- `showName` (boolean, optional) - Afficher le nom (défaut: true)

**Tailles :**
- `sm` : 8x8 (2rem)
- `md` : 12x12 (3rem)
- `lg` : 16x16 (4rem)
- `xl` : 20x20 (5rem)

**Contexte d'usage :**
- Notifications
- Menu rapide
- Liste compacte
- Indicateur live
- Tooltip

**Exemples :**
```jsx
{/* Badge simple sans nom */}
<DriverBadge driver={driver} size="sm" showName={false} />

{/* Badge moyen avec nom */}
<DriverBadge driver={driver} size="md" showName={true} />

{/* Badge large pour affichage principal */}
<DriverBadge driver={driver} size="xl" showName={false} />
```

---

## Structure de l'objet Driver

Tous les composants attendent un objet `driver` avec cette structure minimale :

```javascript
{
  id: "abc123",                    // ID unique
  name: "Lewis Hamilton",          // Nom complet
  number: 44,                      // Numéro de course (1-999)
  email: "lewis@example.com",      // Email (optionnel)
  color: "#00D2BE",               // Couleur hex
  photo: "url/to/photo.jpg",      // URL photo (optionnel)

  // Team (optionnel)
  team: {
    id: "team123",
    name: "Mercedes",
    color: "#00D2BE"
  },

  // Stats (optionnelles)
  wins: 103,
  podiums: 195,
  bestLap: 84532,                 // en millisecondes

  // Counts (optionnels)
  _count: {
    sessions: 50,
    laps: 1234
  }
}
```

## Design Inspirations

### NASCAR
- Grands numéros en **italique** et **gras**
- Photo du pilote en buste
- Logo constructeur
- Bandes de couleur vives
- Format TV professionnel

### Formule 1
- Design épuré et moderne
- Bandes diagonales
- Logos d'équipe
- Typographie **uppercase**
- Dégradés subtils

## Principes de design

1. **Numéro proéminent** - Le numéro doit toujours être visible et lisible
2. **Couleur distinctive** - Chaque pilote a sa couleur qui définit son identité
3. **Hiérarchie visuelle** - Information importante en premier (numéro, nom, équipe)
4. **Responsive** - Tous les composants s'adaptent aux différentes tailles d'écran
5. **Accessibilité** - Bons contrastes, textes lisibles, états hover/focus clairs

## Personnalisation

Tous les composants utilisent des styles inline pour les couleurs des pilotes, ce qui permet une personnalisation totale.

Pour modifier les styles globaux, éditez directement les composants dans `DriverDisplays.jsx`.

## Exemples d'intégration

### Page de session avec grille de départ
```jsx
import { DriverGridPosition } from '../components/DriverDisplays'

function SessionStartingGrid({ drivers }) {
  return (
    <div className="space-y-4">
      {drivers.map((driver, index) => {
        const row = Math.floor(index / 2) + 1
        const side = index % 2 === 0 ? 'left' : 'right'

        return (
          <div key={driver.id} className="flex items-center gap-6">
            {side === 'left' && (
              <>
                <DriverGridPosition driver={driver} row={row} side="left" />
                <div className="text-center w-20">
                  <div className="text-2xl font-bold">ROW {row}</div>
                </div>
              </>
            )}
            {side === 'right' && (
              <>
                <div className="text-center w-20">
                  <div className="text-2xl font-bold">ROW {row}</div>
                </div>
                <DriverGridPosition driver={driver} row={row} side="right" />
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}
```

### Liste de sélection avec recherche
```jsx
import { DriverListItem } from '../components/DriverDisplays'

function DriverSelector({ drivers, onSelect }) {
  const [search, setSearch] = useState('')

  const filteredDrivers = drivers.filter(driver =>
    driver.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <input
        type="text"
        placeholder="Rechercher un pilote..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="space-y-2 mt-4">
        {filteredDrivers.map((driver, index) => (
          <DriverListItem
            key={driver.id}
            driver={driver}
            position={index + 1}
            onClick={() => onSelect(driver)}
            showStats={true}
          />
        ))}
      </div>
    </div>
  )
}
```

---

**Créé le 22 novembre 2024**
**Version 1.0**
