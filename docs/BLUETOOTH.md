# Intégration Bluetooth LE - Control Unit Carrera

## Vue d'ensemble

L'intégration Bluetooth LE permet à RaceHubOS de communiquer directement avec le Control Unit Carrera Digital 124/132 via AppConnect.

## Architecture

### Services créés

1. **protocol.js** - Protocole de communication Carrera
   - Encodage/décodage des messages selon le format Carrera
   - Calcul de checksum
   - Formats supportés: B (byte), I (integer 32 bits), Y (nibble), C (checksum), etc.

2. **ble.js** - Service Bluetooth LE (déjà existant)
   - Découverte du Control Unit
   - Connexion/déconnexion
   - Gestion des notifications BLE
   - Reconnexion automatique (max 10 tentatives)

3. **controlUnit.js** - Interface Control Unit
   - Équivalent Node.js de carreralib.ControlUnit (Python)
   - Commandes: poll(), version(), start(), reset()
   - Contrôle vitesse, frein, carburant par contrôleur
   - Parsing des événements Timer et Status

4. **trackSync.js** - Synchronisation piste ↔ BDD
   - Écoute des événements du Control Unit en temps réel
   - Enregistrement des tours dans la base de données
   - Calcul des positions en temps réel
   - Émission d'événements WebSocket vers le frontend
   - Gestion des sessions de course

### Routes API créées

#### `/api/bluetooth/status`
- **GET** - État de la connexion Bluetooth

#### `/api/bluetooth/scan`
- **POST** - Scanner pour trouver le Control Unit
- Body: `{ timeout?: number }`

#### `/api/bluetooth/connect`
- **POST** - Se connecter au Control Unit
- Body: `{ address?: string }`

#### `/api/bluetooth/disconnect`
- **POST** - Se déconnecter du Control Unit

#### `/api/bluetooth/version`
- **GET** - Version du Control Unit

#### `/api/bluetooth/start-polling`
- **POST** - Démarrer le polling des événements
- Body: `{ interval?: number }` (défaut: 100ms)

#### `/api/bluetooth/stop-polling`
- **POST** - Arrêter le polling

#### `/api/bluetooth/load-session`
- **POST** - Charger la session active

#### `/api/bluetooth/start-session`
- **POST** - Démarrer une session
- Body: `{ sessionId: string }`

#### `/api/bluetooth/stop-session`
- **POST** - Arrêter la session active

## Événements WebSocket

### Émis par le serveur

- `cu:connected` - Control Unit connecté
- `cu:disconnected` - Control Unit déconnecté
- `cu:reconnect-failed` - Échec de reconnexion
- `cu:status` - État du Control Unit (fuel, mode, pit, etc.)
- `lap:completed` - Tour complété
- `positions:updated` - Positions mises à jour
- `race:starting` - Course en démarrage (countdown)
- `session:started` - Session démarrée
- `session:stopped` - Session arrêtée

### Reçus du client

- `simulator:getState` - Demander l'état actuel

## Configuration

### Variables d'environnement

```bash
# .env
USE_MOCK_DEVICE=false  # true pour simulateur, false pour Control Unit réel
DATABASE_URL=file:./prisma/dev.db
PORT=3000
FRONTEND_URL=http://localhost:5173
```

## Utilisation

### Mode simulateur (développement)

```bash
USE_MOCK_DEVICE=true npm run dev
```

### Mode Control Unit réel

```bash
USE_MOCK_DEVICE=false npm run dev
```

## Workflow typique

1. **Scanner et connecter**
   ```
   POST /api/bluetooth/scan
   POST /api/bluetooth/connect
   ```

2. **Vérifier la connexion**
   ```
   GET /api/bluetooth/status
   GET /api/bluetooth/version
   ```

3. **Charger une session**
   ```
   POST /api/bluetooth/load-session
   ```

4. **Démarrer le polling**
   ```
   POST /api/bluetooth/start-polling
   ```

5. **Démarrer la course**
   ```
   POST /api/bluetooth/start-session
   { "sessionId": "xxx" }
   ```

6. **Les événements sont automatiquement synchronisés**
   - Tours enregistrés en BDD
   - Positions calculées en temps réel
   - Événements WebSocket émis

7. **Arrêter la course**
   ```
   POST /api/bluetooth/stop-session
   ```

## Protocole Carrera

### UUIDs BLE

- **Service**: `39df7777-b1b4-b90b-57f1-7144ae4e4a6a`
- **Output** (écriture): `39df8888-b1b4-b90b-57f1-7144ae4e4a6a`
- **Notify** (lecture): `39df9999-b1b4-b90b-57f1-7144ae4e4a6a`

### Format des messages

Les messages utilisent un encodage nibble (4 bits) avec base ASCII '0' (0x30).

Exemple:
- Byte 0x42 → deux nibbles: '2' (0x30 + 0x02), 'D' (0x30 + 0x04)

### Messages principaux

- `?` - Poll (récupérer événements)
- `0` - Version
- `T` + buttonId - Appuyer sur un bouton
- `=` + params - Reset timer
- `J` + params - Setword (contrôle vitesse, frein, fuel)

## Reconnexion automatique

Le service BLE gère automatiquement les reconnexions:
- Max 10 tentatives
- Délai de 3 secondes entre chaque tentative
- Événement `reconnect-failed` si échec

## Limitations connues

1. Le polling doit être actif pour recevoir les événements
2. Un seul Control Unit supporté à la fois
3. Bluetooth LE doit être disponible sur le système (noble/bleak)

## Références

- [carreralib (Python)](https://github.com/tkem/carreralib)
- [@abandonware/noble](https://github.com/abandonware/noble)
- [Documentation Carrera AppConnect](http://www.slotbaer.de/)
