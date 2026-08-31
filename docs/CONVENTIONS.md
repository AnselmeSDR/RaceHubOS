# Règles d'usage

Ce guide n'est pas une liste de préférences. **Chaque règle vient d'un incident réel de ce projet** — un PC de course qui refuse de démarrer un soir de course, des milliers de tours disparus des statistiques, une base réécrite sans prévenir. Le pourquoi compte autant que la règle : c'est lui qui permet de juger un cas que ce guide n'a pas prévu.

Les règles marquées **`[vérifié]`** sont contrôlées mécaniquement par `npm run check`. Les autres relèvent du jugement.

```bash
npm run check        # avant de développer, et pendant
npm run check:push   # avant de pousser (ajoute les règles de version et d'installeur)
```

**Avant de développer** : lire les règles du domaine concerné. **Avant de pousser** : `npm run check:push` et `npm test -w @racehubos/backend`.

---

## Les données

### Le schéma ne change que par une migration `[vérifié]`

`prisma db push` réécrit la base pour la faire ressembler au schéma. Il ajoute une colonne sans rien casser, mais un renommage ou un changement de type **supprime les données concernées sans prévenir**. Une migration décrit la transformation, donc la conserve.

```bash
npm run prisma:migrate -w @racehubos/backend   # crée la migration, à commiter
```

Le fichier produit dans `prisma/migrations/` est versionné et appliqué à l'identique sur chaque poste. `migrateSchema()` baseline automatiquement les bases antérieures aux migrations ; une base qui ne correspond à aucun état connu n'est pas touchée et le démarrage s'interrompt.

> Corollaire vérifié : `schema.prisma` ne doit décrire aucun schéma qu'une migration ne produit. Si le contrôle échoue, la migration a été oubliée.

### Une valeur d'un ensemble fermé n'est jamais écrite en toutes lettres `[vérifié]`

Les quatre types de session étaient réécrits à la main dans 24 fichiers. Résultat : l'**équilibrage a existé en base pendant des mois sans apparaître dans le filtre des statistiques**, parce que chaque liste de types était une liste indépendante et que personne ne pouvait toutes les retrouver.

Toute valeur que le serveur et l'interface doivent connaître vit dans **`packages/shared`** (`@racehubos/shared`), et l'enum Prisma correspondant est déclaré dans `schema.prisma` pour que le client refuse d'écrire une valeur inconnue.

Restent à traiter (TASK-04) : `Session.status`, `Championship.status`, `Championship.mode`, `Session.fuelMode`.

### Une suppression en cascade porte un horodatage partagé

Supprimer un objet masque tout ce qui en dépend, avec **le même `deletedAt`** pour toute la cascade. C'est ce qui rend la restauration exacte : restaurer un circuit ramène précisément les tours qu'il avait, et pas ceux supprimés indépendamment avant lui.

Rien n'est effacé : `deletedAt` masque, il ne détruit pas.

### Toute opération risquée sauvegarde d'abord

Mise à jour, migration, réparation, installation : la base part dans `packages/backend/prisma/db-old/` avant d'être touchée (`VACUUM INTO`, cohérent serveur allumé). Les dix dernières sont conservées.

---

## Le code

### Ce que les deux côtés connaissent vit dans `packages/shared`

Ni dupliqué, ni redéclaré côté interface « pour éviter la dépendance ». Deux définitions divergent toujours, et la divergence se découvre en course.

### Un build réussi ne prouve pas que le code s'exécute `[vérifié]`

**Vite compile sans broncher un fichier qui utilise un symbole non importé** — ce n'est pas une erreur de compilation en JavaScript, seulement une `ReferenceError` au moment où l'écran s'affiche. Lors du passage aux types partagés, **15 fichiers auraient planté en course** alors que le build était vert.

Après un refactoring qui déplace des symboles : `npm run check`, jamais le seul build.

### Un binaire npm lancé par `execFile` porte son nom Windows `[vérifié]`

Sous Windows, `npx` est un `.cmd`, et `execFileSync` ne résout pas cette extension : `spawnSync npx ENOENT`. Rien n'apparaît sur macOS ni sur Linux — le défaut ne se voit que sur le PC de course, et il s'y est vu **en pleine migration**, bloquant la mise à jour.

```js
import { NPX } from './npx.js'
execFileSync(NPX, ['prisma', 'migrate', 'deploy'])
```

`execSync` et `exec` passent par un shell et n'ont pas ce problème ; seule la famille `execFile` / `spawn` est concernée.

### Les validations sortent tôt

```js
if (!session) return null
if (session.status !== SessionStatus.ACTIVE) return null
// le vrai travail, sans imbrication
```

### Nommage

`camelCase` pour les fonctions, paramètres et variables.

> **Écart connu, à trancher** : les query params devraient être en `snake_case`, or sept sont en `camelCase` (`driverId`, `sessionType`, `sortBy`, `sortOrder`, `carId`, `championshipId`, `trackId`) contre un seul en `snake_case`. Les corriger demande de changer serveur et interface ensemble. Non automatisé tant que la décision n'est pas prise.

---

## Les traductions

### Une clé, un seul endroit

Les libellés d'une valeur partagée vivent dans `glossary` et nulle part ailleurs. Trois fichiers dupliquaient les libellés de types de session ; deux d'entre eux ignoraient l'équilibrage, qui s'affichait donc en texte brut.

### Chaque clé existe en français et en anglais `[vérifié]`

Une clé ajoutée d'un seul côté s'affiche telle quelle à l'écran — le nom technique, en plein écran de course.

---

## Le déploiement

### `INSTALLER_VERSION` s'incrémente dès qu'un installeur change `[vérifié]`

L'installeur du bureau se met à jour lui-même en comparant **son numéro**, pas son contenu : Git for Windows convertit les fins de ligne au clone, donc le fichier du bureau n'est jamais identique à celui de GitHub, et comparer les contenus le relancerait en boucle.

Ne pas incrémenter ce numéro, c'est laisser chaque poste avec son installeur périmé **pour toujours**. C'est exactement ce qui est arrivé : celui du PC de course datait de cinq mois et recopiait l'ancien `prisma/` par-dessus le neuf, mettant un `schema.prisma` refusé par Prisma 7 dans une version toute fraîche.

### Dans un `.bat`, un commentaire à l'intérieur d'un bloc s'écrit `REM` `[vérifié]`

`cmd.exe` refuse un label `::` dans un bloc parenthésé. L'erreur est invisible partout ailleurs que sur Windows, en pleine installation. Les parenthèses doivent aussi être équilibrées.

### Remplacer un script en cours d'exécution tient sur une seule ligne

`cmd` comme `bash` lisent une ligne entière avant de l'exécuter. Réparties sur plusieurs lignes, les commandes qui suivent l'écrasement sont relues **dans le nouveau fichier, à un décalage arbitraire**.

### Version incrémentée et changelog écrit `[vérifié au push]`

`package.json` à la racine fait foi. Le changelog dit ce qui change **pour l'utilisateur**, et pourquoi — pas la liste des fichiers touchés.

---

## Les tests

### Ils ne touchent qu'à une base de test `[vérifié]`

`src/__tests__/setup.js` vide toutes les tables. Lancé sur `dev.db`, il efface les vraies courses — c'est déjà arrivé. Toujours `npm test -w @racehubos/backend`, qui fixe `DATABASE_URL` sur `test.db`, recréée à chaque lancement puis supprimée.

### Playwright sert à tester l'interface, rien d'autre

Une règle métier se teste côté serveur, sur base de test. Les sélecteurs s'appuient sur des `data-testid`, jamais sur une classe CSS ou une position — les tests avaient cassé sur un `.bg-white` disparu et sur « la dernière carte ».

### Un test doit échouer quand la règle est violée

Un test qui passe avant et après le bug ne protège rien. Après avoir écrit un test de non-régression : casser volontairement le code, vérifier que le test tombe, remettre.

---

## Quand une règle gêne

Une règle qui empêche un travail légitime est une règle à discuter, pas à contourner en silence. Si l'exception est justifiée, elle s'écrit ici avec sa raison.
