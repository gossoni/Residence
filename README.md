# 🏘️ Ma Résidence — Gestion de copropriété

> 📋 **Spécification complète** : voir [`PROMPT-FINAL.md`](./PROMPT-FINAL.md) —
> document de référence consolidant l'ensemble des décisions fonctionnelles et
> techniques (hiérarchie des pouvoirs, poids de voix, sondages, archivage,
> bilinguisme, stockage, outils de maintenance).

Application Next.js (App Router) + TypeScript + Drizzle ORM + PostgreSQL pour la gestion
d'une résidence : publications par portée, votes pondérés, validation des comptes,
signalements et modération.

---

## 1. Prérequis

- **Node.js 20+** (recommandé 20 LTS ou plus récent) et npm
- **PostgreSQL 14+** accessible localement (ou via Docker)
- Un terminal (bash / zsh / PowerShell)

Vérifiez vos versions :

```bash
node -v
npm -v
```

---

## 2. Installation locale

### 2.1. Installer les dépendances

```bash
npm install
```

### 2.2. Préparer une base PostgreSQL locale

**Option A — PostgreSQL déjà installé sur votre machine :**

```bash
createdb app_db
```

**Option B — via Docker (le plus simple) :**

```bash
docker run --name residence-db -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=app_db \
  -p 5432:5432 -d postgres:16
```

### 2.3. Configurer les variables d'environnement

Le fichier `.env` à la racine contient déjà :

```
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/app_db
```

Adaptez `DATABASE_URL` si votre PostgreSQL utilise un autre hôte/port/utilisateur/mot de passe.
Aucune autre variable d'environnement n'est nécessaire (aucune clé API externe n'est utilisée).

### 2.4. Créer les tables (schéma Drizzle)

```bash
npx drizzle-kit push
```

Cette commande lit `src/db/schema.ts` et crée/synchronise les tables dans PostgreSQL.

**⚠️ Si cette commande signale une erreur** (par exemple `type "user_role" already exists`),
c'est généralement le signe qu'un premier essai a été interrompu et a laissé la base dans un état
partiel. Consultez la section [7. Erreur « Failed query… » lors de la connexion](#7-erreur--failed-query--lors-de-la-connexion) plus bas.

### 2.4bis. Vérifier que tout est bien en place (fortement recommandé)

Avant de lancer l'application, exécutez le script de diagnostic fourni :

```bash
npx tsx src/db/check.ts
```

Il affiche, ligne par ligne : la connexion réseau, la base ciblée, la présence de chaque table et
enum, et rejoue la requête de connexion exacte pour révéler l'éventuelle erreur PostgreSQL réelle
(masquée par défaut dans l'écran d'erreur de Next.js). **Ne passez à l'étape suivante que lorsque
toutes les lignes affichent ✔.**

### 2.5. Charger des données de démonstration (recommandé)

```bash
npx tsx src/db/seed.ts
```

Cela crée automatiquement :
- 1 Président, 12 Responsables de Groupe, 53 Responsables d'Immeuble
- Plusieurs propriétaires (actifs, en attente, bloqué)
- Des publications, votes, commentaires, signalements et notifications d'exemple

**Mot de passe commun pour tous les comptes de démo : `Residence2025!`**

| Compte | Rôle |
|---|---|
| `admin@residence.app` | **Administrateur** (contrôle total de l’application) |
| `president@residence.app` | Président |
| `gh1@residence.app` | Responsable du GH1 |
| `gh1-a@residence.app` | Responsable de l'Immeuble A (GH1) |
| `proprietaire@residence.app` | Propriétaire actif |
| `nouveau@residence.app` | Propriétaire en attente de validation |

⚠️ Cette commande **réinitialise entièrement** les données existantes (`TRUNCATE`). Ne l'exécutez
pas sur une base contenant de vraies données de production.

### 2.6. Lancer le serveur de développement

```bash
npm run dev
```

Ouvrez ensuite [http://localhost:3000](http://localhost:3000).

---

## 3. Vérifier que tout fonctionne

Avant de déployer, validez toujours localement :

```bash
npx next typegen          # génère les types de routes Next.js
npm run typecheck         # vérification TypeScript stricte
npm run build              # build de production
npm run start               # démarre le serveur buildé (Ctrl+C pour arrêter)
```

Testez ensuite `http://localhost:3000/api/health` → doit répondre `{"ok":true}`.

---

## 4. Rendre l'application opérationnelle en ligne

Vous avez deux stratégies possibles, selon l'hébergeur choisi. **Point important** : cette
application enregistre les fichiers joints (PDF, images, ZIP) directement sur le disque, dans
`public/uploads/`. Cela fonctionne parfaitement sur un serveur classique (VPS, Railway, Render,
Docker…) mais **pas sur Vercel**, dont le système de fichiers est en lecture seule en production
(hors dossier `/tmp` éphémère, effacé à chaque redéploiement/mise en veille).

### 🟢 Option A — Hébergeur « full-stack » classique (recommandé, sans modification de code)

Compatible : **Railway**, **Render**, **Fly.io**, ou un **VPS** (Docker / PM2).

Étapes génériques :

1. Poussez votre code sur un dépôt Git (GitHub/GitLab).
2. Créez un service PostgreSQL managé chez le même hébergeur (ou utilisez un service externe
   comme [Neon](https://neon.tech) ou [Supabase](https://supabase.com)).
3. Créez un service "Web" à partir de votre dépôt :
   - Build command : `npm install && npx drizzle-kit push && npm run build`
   - Start command : `npm run start`
   - Variable d'environnement : `DATABASE_URL` = URL de connexion PostgreSQL fournie par l'hébergeur
4. Attachez un **volume persistant** monté sur `public/uploads` (ou équivalent) si l'hébergeur le
   permet, afin que les fichiers joints survivent aux redéploiements. Sur Railway/Render, ajoutez
   un "Persistent Disk" pointant vers ce chemin.
5. Une fois déployé, exécutez une fois (via la console de l'hébergeur ou un script "release") :
   ```bash
   npx tsx src/db/seed.ts   # optionnel : uniquement pour démarrer avec des données de démo
   ```
6. Vérifiez `https://votre-domaine/api/health`.

### 🔵 Option B — Vercel (gratuit) + base de données externe

1. Créez une base PostgreSQL managée gratuite chez [Neon](https://neon.tech) ou
   [Supabase](https://supabase.com) (copiez l'URL de connexion `postgresql://...`).
2. Importez le dépôt dans [Vercel](https://vercel.com/new).
3. Dans les paramètres du projet Vercel → **Environment Variables**, ajoutez :
   - `DATABASE_URL` = l'URL PostgreSQL obtenue à l'étape 1
4. Avant le premier déploiement (ou en local, connecté à cette même base), exécutez :
   ```bash
   DATABASE_URL="postgresql://...votre-url-neon-ou-supabase..." npx drizzle-kit push
   DATABASE_URL="postgresql://...votre-url-neon-ou-supabase..." npx tsx src/db/seed.ts
   ```
5. Lancez le déploiement Vercel (build command par défaut `npm run build`, aucune configuration
   supplémentaire n'est nécessaire).
6. **Limitation à connaître** : sur Vercel, l'envoi de fichiers (PDF/image/ZIP dans une
   publication) ne persistera pas de façon fiable, car `public/uploads/` n'est pas inscriptible en
   production serverless. Deux solutions :
   - Utiliser Vercel pour la partie « texte/votes/commentaires » uniquement (fonctionnera
     parfaitement), et éviter provisoirement les publications de type « Fichier ».
   - Ou migrer le stockage des fichiers vers un service objet (ex. **Vercel Blob**, **Supabase
     Storage**, **AWS S3**, **Cloudinary**) : je peux implémenter cette adaptation sur demande —
     il suffit de me le signaler et de fournir/activer les identifiants du service choisi.

### Après le déploiement, dans les deux cas

- Connectez-vous avec le compte `president@residence.app` (mot de passe `Residence2025!`) si vous
  avez chargé les données de démonstration, **puis changez immédiatement ce mot de passe** depuis
  « Mon profil ».
- Créez vos vrais comptes (Président, Responsables de Groupe/Immeuble) et désactivez/supprimez les
  comptes de démonstration avant une mise en production réelle.
- Le délai de validation des publications et le seuil de signalement se configurent depuis
  **Tableau de bord → Configuration générale** (visible uniquement pour le Président).

---

## 5. Commandes utiles (résumé)

| Commande | Rôle |
|---|---|
| `npm run dev` | Lancer en mode développement (hot reload) |
| `npm run build` | Build de production |
| `npm run start` | Démarrer le serveur buildé |
| `npm run typecheck` | Vérification TypeScript |
| `npx next typegen` | Génération des types de routes Next.js |
| `npx drizzle-kit push` | Synchroniser le schéma PostgreSQL |
| `npx tsx src/db/seed.ts` | Réinitialiser + charger les données de démonstration |
| `npx tsx src/db/check.ts` | Diagnostiquer un problème de connexion / schéma PostgreSQL |
| `npx tsx src/db/make-admin.ts` | Créer/promouvoir l’Administrateur **sans effacer les données** |
| `npx tsx src/db/verify-login.ts` | Vérifier qu’un compte existe et que son mot de passe est valide |
| `npx tsx src/db/reset-password.ts` | **Récupération d’urgence** d’un compte inaccessible (répare aussi le schéma) |

---

## 6. Structure du projet (repères)

```
src/
  app/                 → Pages App Router (feed, dashboard, publications, login, register…)
  app/actions.ts       → Server Actions (auth, publications, votes, modération, rôles…)
  app/api/             → Routes API (health, upload, notifications, notifications/stream SSE)
  components/          → Composants UI et formulaires client
  db/schema.ts         → Schéma Drizzle (tables PostgreSQL)
  db/seed.ts           → Script de données de démonstration
  db/check.ts          → Script de diagnostic de la base de données
  lib/                 → Logique métier (auth, votes, majorités, structure GH, notifications)
```

---

## 7. Erreur « Failed query… » lors de la connexion

Si vous obtenez une erreur du type :

```
Failed query: select "id", "email", ... from "users" where "users"."email" = $1 limit $2
```

Next.js **masque le message d'erreur PostgreSQL réel** derrière ce wrapper Drizzle générique.
Suivez cette procédure dans l'ordre :

### Étape 1 — Lancer le diagnostic

```bash
npx tsx src/db/check.ts
```

Ce script se connecte à la base ciblée par votre `.env`, vérifie l'existence de chaque table et
enum, puis rejoue exactement la requête qui échoue. Il affiche la **vraie cause PostgreSQL**.

### Étape 2 — Interpréter le résultat

| Message observé | Cause probable | Solution |
|---|---|---|
| `Impossible de se connecter à PostgreSQL` | Service PostgreSQL arrêté, mauvais port/hôte, mauvais mot de passe | Démarrez PostgreSQL (`pg_isready` / `docker ps`), vérifiez `DATABASE_URL` dans `.env` |
| Table(s) manquante(s) | Le schéma n'a jamais été poussé, ou a échoué | Relancez `npx drizzle-kit push` |
| `type "user_role" already exists` (ou enum similaire) lors du `push` | Un premier `push` a été interrompu, laissant des types orphelins | Voir « Réinitialisation complète » ci-dessous |
| Toutes les lignes ✔ mais utilisateur introuvable | Le schéma est bon mais aucune donnée n'a été chargée | Lancez `npx tsx src/db/seed.ts` |
| Toutes les lignes ✔ et la requête de test réussit | La base est saine | Redémarrez `npm run dev` (un ancien process a pu garder une connexion/config obsolète en mémoire) |

### Réinitialisation complète (en dernier recours)

Si la base est dans un état incohérent (tables ou enums partiellement créés), le plus sûr est de
repartir d'une base vierge :

```bash
# Option A — via psql, en supprimant tout le schéma public
psql "$DATABASE_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# Option B — via Docker, en supprimant complètement le conteneur/volume
docker rm -f residence-db
docker run --name residence-db -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=app_db \
  -p 5432:5432 -d postgres:16
```

Puis reprenez la procédure normale :

```bash
npx drizzle-kit push
npx tsx src/db/check.ts     # doit maintenant afficher uniquement des ✔
npx tsx src/db/seed.ts
npm run dev
```

### Autres vérifications utiles

- **Node.js** : utilisez impérativement Node 20+ (`node -v`). Une version trop ancienne peut
  provoquer des erreurs obscures avec `pg`/Drizzle.
- **Un seul fichier de config Drizzle** : le projet utilise `drizzle.config.ts` (qui lit
  `DATABASE_URL` depuis `.env`). Assurez-vous qu'aucun `drizzle.config.json` résiduel ne traîne
  encore à la racine — supprimez-le s'il existe, il serait prioritaire et pointerait vers une URL
  différente de votre `.env`.
- **Caractères spéciaux dans le mot de passe** : si votre mot de passe PostgreSQL contient des
  caractères comme `@ : / ? #`, encodez-les en URL (`%40`, `%3A`, etc.) dans `DATABASE_URL`.
- **Redémarrez toujours `npm run dev`** après une modification de `.env` ou du schéma : les
  variables d'environnement et le cache Turbopack ne se rechargent pas à chaud.

---

## 8. Bilingue Français / العربية (i18n)

L’interface est disponible en **français** et en **arabe** (avec passage automatique en
`dir="rtl"`). Un sélecteur **FR / ع** est présent dans la barre d’en-tête ; le choix est
mémorisé dans le cookie `mr_locale` pendant un an.

### ⚠️ Règle à respecter pour toute modification future

Les deux langues sont **verrouillées ensemble par le typage TypeScript** :

- Le dictionnaire français est la « source de vérité » : `src/lib/i18n.ts` définit
  `export const fr = { ... }` puis `export type Dictionary = typeof fr`.
- Le dictionnaire arabe est déclaré `export const ar: Dictionary = { ... }`.

**Conséquence : ajouter, renommer ou supprimer une clé dans `fr` sans faire de même dans
`ar` (ou inversement) provoque immédiatement une erreur de compilation** (`npm run typecheck`).
Il est donc impossible de livrer une langue désynchronisée de l’autre.

### Où intervenir

| Besoin | Fichier |
|---|---|
| Ajouter / modifier un libellé (les 2 langues !) | `src/lib/i18n.ts` |
| Lire la langue côté serveur (pages) | `src/lib/i18n-server.ts` → `getT()` |
| Lire le dictionnaire côté client (composants) | `src/components/locale-provider.tsx` → `useT()` / `useLocale()` |
| Libellés de rôle / statut / portée | helpers `roleLabel`, `userStatusLabel`, `scopeLabel`, `pubStatusLabel`, `pubTypeLabel` |

### Exemple d’ajout d’une clé

```ts
// src/lib/i18n.ts
export const fr = {
  // ...
  mySection: { myKey: "Enregistrer" },
};
export const ar: Dictionary = {
  // ... même structure
  mySection: { myKey: "حفظ" },   // obligatoire : sinon erreur de compilation
};
```

---

## 9. Rôle Administrateur 🛡️

Un rôle **Administrateur** (`admin`) surplombe le Président. Il est conçu pour contrôler
l’ensemble des modifications de l’application et pour **initialiser la résidence** avant la
mise en production.

### Depuis son tableau de bord, l’Administrateur peut :

| Capacité | Détail |
|---|---|
| **Créer les comptes** | Crée manuellement le Président, les 12 Responsables de Groupe et les Responsables d’Immeuble (phase pré-démo), avec GH / immeuble / appartement. |
| **Initialiser les mots de passe** | À la demande : saisit un mot de passe choisi ou en **génère un automatiquement** (affiché une seule fois, à communiquer au destinataire). |
| **Réinitialiser un mot de passe** | Pour n’importe quel utilisateur (sauf un autre Administrateur). |
| **Verrouiller l’application** | Bascule « mode maintenance » : **toutes** les mutations (publications, votes, commentaires, signalements, modération, changements de rôles, paramètres) sont refusées. Seul l’Administrateur conserve la main. |
| **Consulter le journal d’audit** | Trace horodatée de chaque action sensible : auteur, action, cible, détails. |
| **Tout voir et tout trancher** | Accès à toutes les portées, modération sur tout, vote sur tout scrutin (poids 2), changement du rôle du Président, blocage du Président. |

### Protections

- Le rôle **Administrateur ne peut pas être modifié ou bloqué** depuis l’interface.
- Un Administrateur ne peut pas réinitialiser le mot de passe d’un autre Administrateur.
- L’unicité des postes est automatique : nommer un Responsable de Groupe/Immeuble déjà pourvu
  rétrograde et notifie l’ancien titulaire.
- Toutes les actions sensibles sont **journalisées** dans la table `audit_log`.

### Flux d’initialisation recommandé (avant mise en production)

1. Se connecter en **Administrateur** (démo : `admin@residence.app` / `Residence2025!`).
2. **Changer immédiatement ce mot de passe** (Mon profil).
3. Créer le **Président**, puis les **Responsables de Groupe**, puis les **Responsables
   d’Immeuble** — en notant les mots de passe générés.
4. Vérifier le **délai de validation** et le **seuil de signalements** (Configuration générale).
5. Une fois la structure en place, éventuellement **verrouiller** l’application pendant la
   période de préparation, puis la déverrouiller au lancement.


---

## 10. « Identifiants invalides » avec le compte Administrateur

### Cause

Le compte `admin@residence.app` a été introduit avec le rôle **Administrateur**. Si votre base
de données locale a été initialisée **avant** cette évolution, le compte n’existe tout simplement
pas (l’ancien script de démonstration créait 71 comptes, sans Administrateur). Le message
« Identifiants invalides » signifie alors : *compte introuvable*, et non *mot de passe erroné*.

### Étape 1 — Diagnostiquer en 5 secondes

```bash
npx tsx src/db/verify-login.ts admin@residence.app Residence2025!
```

Trois résultats possibles :

| Message | Signification | Solution |
|---|---|---|
| `COMPTE INTROUVABLE en base` | Le compte n’a jamais été créé | Étape 2 (et 2bis) ci-dessous |
| `Compte trouvé … Mot de passe INVALIDE` | Le compte existe mais le mot de passe diffère | Étape 3 ci-dessous |
| `Compte trouvé … Mot de passe VALIDE` | Tout est correct | Le problème vient de la saisie (espace, clavier, majuscules) |

### Étape 2 — Créer l’Administrateur (recommandé, ne touche pas aux données)

```bash
npx tsx src/db/make-admin.ts
# ou avec vos propres identifiants :
npx tsx src/db/make-admin.ts admin@mondomaine.fr MonMotDePasse!
```

Ce script :
- répare le schéma si besoin (valeur d’enum `admin` + table `audit_log`) ;
- crée l’Administrateur, **ou promeut un compte existant** à ce rôle ;
- (ré)initialise son mot de passe.

Connectez-vous ensuite avec les identifiants affichés, **changez le mot de passe** (Mon profil),
puis créez le Président et les Responsables depuis
**Tableau de bord → 🛡️ Administration → ➕ Créer un compte**.

### Étape 2bis — Ou recharger le jeu de démonstration complet

⚠️ **Efface toutes les données** (utile uniquement en phase de pré-production) :

```bash
npx drizzle-kit push        # crée la table audit_log
npx tsx src/db/seed.ts      # 72 comptes dont l'Administrateur
```

Le script de seed **répare automatiquement le schéma** avant de s’exécuter (valeur d’enum
`admin` + table `audit_log`), ce qui évite le scénario où il échoue après avoir vidé les tables.

### Étape 3 — Réinitialiser un mot de passe oublié

```bash
# Sans passer par l'interface :
npx tsx src/db/make-admin.ts admin@residence.app NouveauMotDePasse!
```

Ou, si vous avez accès à un compte Administrateur fonctionnel :
**Tableau de bord → 🛡️ Administration → 🔑 Réinitialiser un mot de passe**.

### Après toute opération, vérifiez

```bash
npx tsx src/db/check.ts        # toutes les lignes doivent afficher ✔
npx tsx src/db/verify-login.ts admin@residence.app Residence2025!
```


---

## 11. Administration : mot de passe provisoire, nom et logo

### 🔑 Mots de passe provisoires (à changer à la 1re connexion)

Quand l’Administrateur **crée un compte** ou **réinitialise un mot de passe**, celui-ci est
marqué comme *provisoire*. Conséquences pour l’utilisateur concerné :

- à la connexion, il est **automatiquement redirigé** vers `/changer-mdp` ;
- **toutes les autres pages sont inaccessibles** (fil, tableau de bord, profil, publications) ;
- une bannière 🔑 lui rappelle l’obligation ;
- il doit saisir le mot de passe provisoire, puis deux fois son nouveau mot de passe
  (contrôles : ancienneté, longueur ≥ 8, correspondance, différence avec le provisoire) ;
- une fois le changement effectué, l’accès est **immédiatement restauré**.

Dans le tableau de bord, l’icône **🔑** signale les comptes encore concernés.

> L’Administrateur voit le mot deapse généré **une seule fois** (à copier/communiquer), avec un
> avertissement explicite. Le mot de passe n’est jamais stocké en clair.

### 🏷️ Nom et logo de la résidence

Depuis **Tableau de bord → 🛡️ Administration → 🏷️ Identité de la résidence**, l’Administrateur
peut définir :

- le **nom en français** et le **nom en arabe** (affichés selon la langue active) ;
- le **logo** (PNG / JPG / WEBP / SVG, 2 Mo max, carré recommandé), avec aperçu et suppression.

Le nom remplace l’ancienne valeur codée en dur **partout** : en-tête de toutes les pages,
onglet/titre du navigateur (`<title>`), et dans les deux langues. Sans logo, l’icône par
défaut 🏘️ est utilisée. Chaque modification est **journalisée** dans le journal d’audit.

### 📦 Service des fichiers joints (nouveau)

Les fichiers envoyés sont désormais servis par la route `/api/uploads/[nom]` au lieu du dossier
statique `public/`. Motif : certains hébergeurs prennent un instantané de `public/` au moment du
build, ce qui empêchait les fichiers ajoutés ensuite d’être servis. La route lit sur le disque à
la demande, avec :

- type MIME correct et mise en cache longue durée ;
- protection contre le parcours de répertoire (`../`, noms non conformes → 400) ;
- contrôles renforcés pour le logo (images uniquement, 2 Mo, réservé à l’Administrateur).

Les anciennes URL en `/uploads/...` restent acceptées pour compatibilité.


---

## 12. Compte Responsable devenu inaccessible

### Symptôme

Après une réinitialisation de mot de passe par l’Administrateur, un compte Responsable ne peut
plus se connecter (« Identifiants invalides »).

### Cause racine (vérifiée et reproduite)

La réinitialisation écrit la colonne `users.must_change_password`. **Si cette colonne n’existe
pas encore dans votre base**, l’ordre SQL échoue avec :

```
ERROR: column "must_change_password" of relation "users" does not exist
```

Or la colonne est créée par `npx drizzle-kit push`, qui **peut échouer silencieusement** quand
l’enum `user_role` est dans un état antérieur (avant l’ajout du rôle `admin`). Résultat : le
formulaire affiche un mot de passe « généré », mais **aucune écriture n’a eu lieu** — et ce mot
de passe ne correspond donc à rien.

### Correction immédiate (une seule commande)

```bash
npx tsx src/db/reset-password.ts gh1@residence.app
# ou avec votre propre mot de passe :
npx tsx src/db/reset-password.ts gh1@residence.app NouveauMotDePasse!
# sans obligation de changement à la première connexion :
npx tsx src/db/reset-password.ts gh1@residence.app NouveauMotDePasse! --final
```

Cet outil **répare d’abord le schéma** (enum `admin`, table `audit_log`, colonne
`must_change_password`), puis réinitialise le mot de passe du compte ciblé — sans effacer aucune
donnée. Il réactive aussi un compte bloqué le cas échéant.

Vérification : `npx tsx src/db/verify-login.ts gh1@residence.app "NouveauMotDePasse!"`

### Corrections apportées dans le code

1. **`src/db/ensure.ts`** répare désormais aussi la colonne `must_change_password` (c’était la
   pièce manquante). Cette réparation est exécutée par `reset-password.ts`, `make-admin.ts` et
   `seed.ts`.
2. **Nouveau bouton 🔓 « Débloquer l’accès de ce compte »** dans le tableau de bord de
   l’Administrateur, visible pour chaque compte dont le mot de passe est encore provisoire. Il
   lève l’obligation de changement (utile aussi si l’utilisateur a perdu son mot de passe
   provisoire). L’action est journalisée dans l’audit et notifie l’utilisateur.
3. **Case à cocher « mot de passe provisoire »** dans le formulaire de réinitialisation :
   l’Administrateur peut désormais délivrer un mot de passe définitif s’il ne souhaite pas
   imposer le changement.
4. Un **badge 🔑 « Mot de passe provisoire en attente »** signale ces comptes dans le tableau.

---

## 13. Règle `useActionState` / `startTransition`

L’avertissement suivant peut apparaître en console :

```
An async function with useActionState was called outside of a transition.
```

Il signifie que la fonction renvoyée par `useActionState` (une Action React) a été appelée
depuis un gestionnaire d’événement **sans transition** : `isPending` n’est alors pas mis à jour
correctement.

### Les deux usages corrects

```tsx
const [state, dispatch, pending] = useActionState(myAction, {});
const [, startTransition] = useTransition();

// ✅ 1. Via un formulaire : React gère la transition lui-même
<form action={dispatch}> … </form>

// ✅ 2. Appel programmatique (onChange, onClick, onSubmit…) : encapsuler
startTransition(() => {
  dispatch(formData);
});
```

### Appliqué dans ce projet

- `src/components/admin-ui.tsx` → `BrandingForm.onFile` (enregistrement immédiat du logo choisi)
- `src/components/client-forms.tsx` → `NewPublicationForm.onSubmit` (après l’upload du fichier)

Ces composants sont regroupés dans `src/components/admin-ui.tsx`, avec un bloc de documentation
en tête de fichier rappelant la règle pour toute évolution future.


---

## 14. Administration : archivage, suppression et informations utilisateur

### 🗄️ Archivage (export ZIP)

L’Administrateur peut générer une **archive ZIP complète** :

| Cible | Contenu de l’archive |
|---|---|
| **Utilisateur** | `profil.json` (sans le hash du mot de passe), `publications.json`, `commentaires.json`, `votes.json`, `signalements-emis.json`, `commentaires-recus.json`, `LISEZ-MOI.txt` |
| **Publication** | `publication.json` : la publication, son auteur, tous ses commentaires, votes et signalements |

Boutons disponibles : par ligne dans le tableau des comptes (« 🗄️ Archiver »), dans la file de
modération pour les contenus signalés, et via la barre d’actions par lot.

### ⬇️ Téléchargement et suppression automatique

La liste **« 🗄️ Archives générées »** du tableau de bord Administration recense les archives en
attente (libellé, nom de fichier, taille, date). Chaque archive est **automatiquement supprimée
du serveur** (fichier *et* enregistrement en base) dès la fin de son téléchargement :

- l’URL `/api/archives/<id>` sert le fichier une seule fois ;
- un second téléchargement renvoie `404` ;
- l’accès est réservé à l’Administrateur (`401` sinon) ;
- le chemin est validé pour empêcher tout parcours de répertoire ;
- chaque téléchargement est **journalisé** dans l’audit.

Les archives vivent dans le répertoire privé `.archives/` (non servi statiquement), configurable
via la variable d’environnement `ARCHIVE_DIR`.

### 🗑️ Suppressions

- **Comptes, individuellement** : bouton 🗑️ par ligne (avec confirmation).
- **Comptes, par lot** : cases à cocher + « Tout sélectionner », puis « 🗄️ Archiver puis
  supprimer » ou « 🗑️ Supprimer la sélection ».
- **Publications et commentaires signalés/bloqués** : boutons dédiés dans la file de modération.

La suppression d’un utilisateur est **réellement en cascade** (vérifié) : ses sessions,
notifications, votes, commentaires, signalements et publications (ainsi que les commentaires,
votes et signalements de ces publications) sont supprimés. Protections : les comptes
Administrateur ne peuvent pas être supprimés, ni son propre compte. Toute suppression est
journalisée dans l’audit.

### 👤 Informations de l’utilisateur connecté

Une **carte récapitulative** est désormais affichée en haut du **fil d’actualité** (page
d’accueil après connexion), sans avoir besoin d’ouvrir l’onglet « Tableau de bord » :
photo initiales, bonjour + nom complet, e-mail, rôle, statut, localisation (GH / immeuble /
appartement), date d’adhésion, et lien « Voir mon profil ». Elle s’affiche dans les deux langues
avec le sens d’écriture adapté (RTL pour l’arabe).


---

## 15. Hiérarchie des pouvoirs de création et de suppression

L’ordre de responsabilité est **strictement décroissant** :

```
Administrateur  >  Président  >  Responsable de Groupe  >  Responsable d’Immeuble  >  Propriétaire
```

### Tableau des pouvoirs

| Rôle | Périmètre | Peut créer | Peut supprimer / gérer |
|---|---|---|---|
| **Administrateur** | Toute la résidence | Président, Resp. de Groupe, Resp. d’Immeuble, Propriétaire | Tout le monde |
| **Président** | Toute la résidence | Resp. de Groupe, Resp. d’Immeuble, Propriétaire | Resp. de Groupe, Resp. d’Immeuble, Propriétaire |
| **Resp. de Groupe** | Son GH | Resp. d’Immeuble, Propriétaire (dans son GH) | Resp. d’Immeuble et Propriétaires de son GH |
| **Resp. d’Immeuble** | Son immeuble | Propriétaire (dans son immeuble) | Propriétaires de son immeuble |
| **Propriétaire** | — | **Rien** (uniquement son propre compte à l’inscription, provisoire) | Rien |

### Règles appliquées

- **Personne ne peut supprimer, bloquer ou rétrograder l’Administrateur.** Seul un Administrateur
  peut agir sur un autre Administrateur (et jamais sur lui-même pour la suppression).
- **Nul ne peut agir sur un responsable de rang supérieur ou égal au sien.**
- Les responsables de Groupe/Immeuble ne voient dans leur tableau de bord **que les membres de
  leur périmètre** (vérifié : GH1 → 10 comptes, GH1-A → 3 comptes, Resp. GH1-A ne voit que son immeuble).
- Le formulaire de création **n’propose que les rôles autorisés** et **verrouille le GH/immeuble**
  hors périmètre (vérifié : Admin → 4 rôles, Président → 3, Resp. GH → 2, Resp. Immeuble → 1).
- Les simples propriétaires **ne peuvent que créer leur propre compte**, en statut *provisoire*,
  en attente de validation par le Responsable de leur immeuble (qui reçoit une notification).
- La suppression reste **en cascade** (publications, commentaires, votes, signalements) et
  l’archivage ZIP reste disponible avant suppression.
- Toutes ces actions sont **journalisées** dans l’audit.

### Résumé des sections du tableau de bord

| Section | Admin | Président | Resp. GH | Resp. Immeuble | Propriétaire |
|---|---|---|---|---|---|
| ⚖️ Hiérarchie des pouvoirs | ✅ | ✅ | ✅ | ✅ | ❌ |
| ➕ Créer un compte | ✅ | ✅ | ✅ | ✅ | ❌ |
| 🔑 Réinitialiser un mot de passe | ✅ | ✅ | ✅ | ✅ | ❌ |
| 🗑️ Gestion des comptes (individuelle et par lot) | ✅ | ✅ | ✅ | ✅ | ❌ |
| 🏷️ Identité de la résidence (nom + logo) | ✅ | ❌ | ❌ | ❌ | ❌ |
| 🔒 Verrouillage global | ✅ | ❌ | ❌ | ❌ | ❌ |
| 🗄️ Archives générées | ✅ | ❌ | ❌ | ❌ | ❌ |
| 📜 Journal d’audit | ✅ | ❌ | ❌ | ❌ | ❌ |
| 🪪 Comptes à valider | ✅ | ✅ | ✅ | ✅ | ❌ |

Le module `src/lib/hierarchy.ts` centralise toute cette logique (`canManageUser`,
`canCreateUser`, `creatableRoles`, `scopeCovers`, `canManageContent`, `isImmune`), ce qui
garantit que les contrôles côté serveur et l’affichage côté interface restent toujours cohérents.


---

## 16. Règles strictes de blocage et de mot de passe obligatoire

### 🔒 Personne ne peut se bloquer soi-même

Vérifié pour les cinq rôles : la fonction `canManageUser()` refuse systématiquement toute action
sur son propre compte (`actor.id === target.id` → refus, motif `self`). Côté interface, la ligne
correspondant à l’utilisateur connecté **n’affiche aucun bouton** « Bloquer ».

### 🔒 Personne ne peut bloquer un périmètre supérieur

| Tentative | Résultat | Motif |
|---|---|---|
| Président bloque Administrateur | REFUSÉ | `immune` |
| Resp. GH bloque Administrateur | REFUSÉ | `immune` |
| Resp. GH bloque Président | REFUSÉ | `rank` |
| Resp. Immeuble bloque son Resp. de Groupe | REFUSÉ | `rank` |
| Resp. Immeuble bloque Président | REFUSÉ | `rank` |
| Resp. GH bloque un Resp. d’Immeuble de son groupe | AUTORISÉ | `allowed` |
| Administrateur bloque Président | AUTORISÉ | `allowed` |

Un garde **unifié** (`manageUserDenyReason`) est appliqué aux trois décisions de
`userStatusAction` (**valider**, **activer**, **bloquer**), ce qui supprime les anciens chemins
incohérents. Les messages d’erreur sont explicites selon le motif du refus.

### 🔑 Mot de passe obligatoirement provisoire après TOUTE création

**Nouvelle création par lot** (`adminBatchCreateUsersAction`) : plusieurs comptes d’un coup,
un par ligne, au format :

```
Prénom ; Nom ; email ; téléphone
Amine ; Bennani ; amine@exemple.fr ; +212 6 12 34 56 78
Karim ; Idrissi ; karim@exemple.fr
```

Séparateurs acceptés : `;` `,` `|` ou tabulation. Caractéristiques :

- **`mustChangePassword: true` est imposé à chaque compte créé** (unitaire *et* par lot) ;
- mot de passe : soit commun au lot (champ facultatif), soit **généré individuellement** ;
- le tableau des résultats affiche **tous les mots de passe générés** (avec avertissement
  « à noter maintenant ») et la liste des lignes ignorées avec la raison ;
- les contrôles de **hiérarchie** s’appliquent à l’identique (rôles créables + périmètre) ;
- l’unicité des postes est respectée (l’ancien titulaire est rétrogradé) ;
- maximum 100 comptes par lot ; l’opération est **journalisée** dans l’audit.

**Seule exception volontaire** : l’auto-inscription publique (`/register`) laisse
`mustChangePassword: false`, car l’utilisateur choisit lui-même son mot de passe à la création —
il n’y a donc rien à changer. Son compte reste en statut *provisoire* jusqu’à validation.


---

## 17. Réglages de l’Administrateur : poids de voix, types, mot de passe

### ⚖️ Poids de voix (multiplicateurs)

Depuis **Tableau de bord → ⚖️ Poids de voix**, l’Administrateur définit le nombre de voix de
chaque rôle : **Président**, **Responsable de Groupe**, **Responsable d’Immeuble**,
**Propriétaire** et **Administrateur** (entiers de 0 à 100).

- Les **majorités des scrutins sont recalculées automatiquement** à partir de ces poids et du
  nombre réel de votants actifs (`computeMajority`). Exemple vérifié : Président = 3 et
  Resp. de Groupe = 2 avec 12 responsables de groupe actifs → 27 voix, majorité absolue = 14.
- Garde-fou : le Président et le Responsable de Groupe ne peuvent pas valoir tous deux 0,
  sinon aucun scrutin de résidence ne pourrait aboutir.
- Dans la validation de **son propre groupe**, le Responsable de Groupe reçoit le poids le plus
  élevé entre le sien et celui du Président (règle de « double voix » préservée).

### 📝 Types de publication activables

Depuis **Tableau de bord → 📝 Types de publication**, l’Administrateur coche/décoche chaque
type : **Texte**, **Fichier**, **Tâche / Événement**, **Sondage**.

- Le formulaire de création **n’affiche plus les types désactivés**, avec un message explicatif.
- Le **contrôle est aussi appliqué côté serveur** : soumettre un type désactivé est refusé.
- Vérifié : après désactivation de « Tâche / Événement », seuls `texte`, `fichier` et `sondage`
  restent proposés.

### 🔑 Mot de passe de l’Administrateur (changement immédiat)

Nouvelle section **« Mon mot de passe »** dans le tableau de bord (visible par tous les rôles).
L’Administrateur peut changer son propre mot de passe **sans attendre**, avec vérification du
mot de passe actuel, confirmation, longueur ≥ 8 et différence avec l’ancien. Vérifié : l’ancien
mot de passe devient immédiatement invalide, le nouveau fonctionne, et **la session en cours
n’est pas invalidée**.

---

## 18. Sondages (nouveau type de publication)

Le type **📊 Sondage** s’ajoute aux types existants et **les propriétaires peuvent participer**,
contrairement aux scrutins de validation réservés aux responsables.

### Création

Dans le formulaire de création, le type « 📊 Sondage » affiche un éditeur d’options :

- ajout/suppression dynamique d’options (minimum **deux options différentes**) ;
- case **« Autoriser plusieurs choix »** (sinon choix unique) ;
- **date de clôture facultative**.

### Participation et résultats

Sur la page de la publication :

- options avec **cases à cocher** (choix multiple) ou **boutons radio** (choix unique) ;
- **barres de progression et pourcentages** en direct ;
- compteur de **votes** et de **participants** distincts ;
- marqueur 👤 sur les options choisies par l’utilisateur ;
- possibilité de **modifier son vote** (l’ancien choix est remplacé) ;
- statut **« Sondage ouvert »** / **« Sondage clôturé »** (selon la date de clôture).

### Règles vérifiées

| Test | Résultat |
|---|---|
| Propriétaire actif peut participer | ✔ AUTORISÉ |
| Responsable de Groupe peut participer | ✔ AUTORISÉ |
| Président (auteur) peut participer | ✔ AUTORISÉ |
| Compte bloqué | ✔ REFUSÉ |
| Choix multiple sur un sondage à choix unique | ✔ REFUSÉ |
| Changement de vote (remplacement) | ✔ conforme |
| Comptage des votes / participants distincts | ✔ conforme |

### Correction de l’envoi de logo

L’erreur générique « Erreur lors de l’envoi du fichier. » masquait la cause réelle. La route
`/api/upload` a été réécrite :

- **détection du type par octets magiques** (PNG, JPG, GIF, WEBP, PDF, ZIP) puis par
  contenu texte (SVG), puis par extension, puis par MIME — un navigateur envoyant un MIME
  **vide** ou `application/octet-stream` ne fait plus échouer l’envoi (vérifié) ;
- réglages distincts pour le logo (images uniquement, 2 Mo, réservé à l’Administrateur) ;
- **répertoire d’écriture avec repli** (`public/uploads` → `.uploads`) et test réel
  d’inscription avant d’écrire, avec un message clair si le disque est en lecture seule ;
- **journalisation de la cause réelle** dans les logs serveur, et message d’erreur
  reprenant le détail au lieu du texte générique.


---

## 19. Erreur « Module not found: Can’t resolve ‘jszip’ »

### Symptôme

```
⨯ ./src/lib/archive.ts:4:1
Error: Module not found: Can't resolve 'jszip'
GET /login 500
```

Toutes les pages renvoyaient une erreur 500, y compris `/login`.

### Cause

Le module externe `jszip` avait été ajouté pour générer les archives ZIP. Si le code est
récupéré **sans réinstaller les paquets** (`npm install`), ce module est absent de
`node_modules` et `src/lib/archive.ts` — importé indirectement par `src/app/actions.ts` —
fait échouer le rendu de toutes les pages.

### Correction (définitive)

**La dépendance `jszip` a été entièrement supprimée.** Les archives ZIP sont désormais
produites par le module natif `src/lib/zip.ts`, qui n’utilise que
**`node:zlib`** (inclus dans Node.js) et implémente le format ZIP lui-même :

- en-têtes locaux (`PK\x03\x04`) ;
- répertoire central (`PK\x01\x02`) ;
- fin de répertoire (`PK\x05\x06`) ;
- compression **DEFLATE** via `zlib.deflateRawSync` (niveau 6) ;
- calcul **CRC-32** intégré ;
- noms de fichiers encodés en **UTF-8** (flag `0x0800`) ;
- repli automatique en stockage non compressé si DEFLATE n’est pas bénéfique.

**Avantages :** plus aucune dépendance externe, donc plus jamais d’erreur de ce type ;
et `npm install` n’a plus besoin d’être relancé après une récupération du code.

### Archives validées

Les ZIP produits ont été vérifiés avec une implémentation **indépendante** (`zipfile` de
Python) :

| Vérification | Résultat |
|---|---|
| Signature ZIP (`504b0304`) | ✔ valide |
| Test d’intégrité (`testzip`) | ✔ aucune entrée corrompue |
| Lecture du contenu JSON | ✔ conforme |
| Compression DEFLATE | ✔ 544 → 306 octets |
| `LISEZ-MOI.txt` inclus | ✔ |
| **Hash du mot de passe exclu** | ✔ jamais exporté |

### Après récupération du code corrigé

```bash
npm run dev
```

Aucune installation, aucune migration de base de données : ce correctif ne touche que le
code applicatif. (Si vous aviez déjà lancé `npm install` avant, il est inutile de le refaire.)


---

## 20. Alignement sur le schéma Supabase (audit, archives) et migration

### Incohérences détectées

La base Supabase réelle différait du schéma utilisé par le code :

| Élément | Code (avant) | Base Supabase | Statut |
|---|---|---|---|
| Journal d’audit | `audit_log` | **`admin_audit`** | ✅ corrigé |
| Colonnes du journal | `actor_label`, `target_type`, `target_id` | **`target` (texte)** | ✅ corrigé |
| Table des archives | `archives` | **`data_archives`** | ✅ corrigé |
| Colonnes des archives | `file_path`, `size_bytes`, `label` | **`payload` (texte)** | ✅ corrigé |
| Valeur d’enum `sondage` | présente | **absente** | ✅ migration |
| Colonnes sondage (`poll_options`…) | présentes | **absentes** | ✅ migration |
| Table `poll_votes` | présente | **absente** | ✅ migration |

### Corrections apportées au code

1. **`src/db/schema.ts`** : tables renommées et restructurées pour correspondre exactement à la
   base (`admin_audit` avec `actor_id`/`action`/`target`/`details`, et `data_archives` avec
   `kind`/`title`/`filename`/`payload`).
2. **`src/lib/logic.ts`** — `logAudit(actor, action, target, details)` : la cible est désormais
   un **libellé texte** (`"user#12"`, `"archive#3"`, `"settings"`), conformément à la colonne
   `target`. Les 18 appels ont été adaptés.
3. **`src/lib/archive.ts`** : le ZIP est stocké **en base de données** (base64 dans `payload`)
   au lieu du système de fichiers. C’est le modèle correct pour Supabase/Vercel, où le disque
   n’est **pas persistant** — l’ancienne approche `.archives/` ne fonctionnait pas sur ces
   hébergeurs. `ARCHIVE_DIR` a été supprimé.
4. **`/api/archives/[id]`** : lit le contenu depuis la base, le décode et le sert, puis
   **supprime l’enregistrement** après téléchargement.
5. **Tableau de bord** : affichage du journal (`#id` de l’acteur, `target`) et de la liste des
   archives (taille déduite du base64).

### Migration à exécuter sur Supabase

Le fichier **`supabase/migration.sql`** est **idempotent** (relançable sans risque) et ne
supprime aucune donnée. À exécuter dans *Dashboard → SQL Editor* :

1. valeur d’enum `sondage` ;
2. colonnes `poll_options` (jsonb), `poll_multiple`, `poll_ends_at` sur `publications` ;
3. table `poll_votes` (+ séquence, clés étrangères, contrainte d’unicité, index) ;
4. création conditionnelle de `admin_audit` et `data_archives` si absentes ;
5. colonnes `payload` et `downloaded_at` sur `data_archives` ;
6. index d’accompagnement.

> ⚠️ Si l’ordre `ALTER TYPE ... ADD VALUE` renvoie « cannot be executed within a transaction
> block », exécutez cette seule ligne séparément.

Une requête de **vérification** est incluse en commentaire en fin de fichier : toutes les
valeurs attendues doivent valoir `1`.

### Vérifications effectuées

| Test | Résultat |
|---|---|
| Migration exécutée depuis un état identique à votre schéma | ✔ 9 éléments créés |
| Migration ré-exécutée une 2e fois (idempotence) | ✔ 0 erreur |
| Sondage : participation d’un propriétaire | ✔ |
| Sondage à choix multiple | ✔ 2 options enregistrées |
| Archive ZIP stockée en base (`payload`) | ✔ 1297 octets |
| ZIP décodé depuis la base : intégrité | ✔ valide, signature `504b0304` |
| Téléchargement puis suppression automatique | ✔ 1 → 0 archive |
| Second téléchargement | ✔ 404 |
| Accès non autorisé | ✔ 401 |
| Journalisation dans `admin_audit` | ✔ `target=user#69`, `archive#1` |
| Hash du mot de passe exclu des archives | ✔ |


---

## 21. Erreur `column "poll_choices" does not exist` et perte de connexion Supabase

Deux problèmes distincts ont été identifiés dans les logs.

### Problème 1 — Schéma désynchronisé (nomenclatures différentes)

```
error: column "poll_choices" does not exist
  at async sweepExpiredPublications (src/lib/logic.ts:316)
```

**Cause** : deux versions du code ont utilisé des noms de colonnes différents pour les mêmes
données de sondage — `poll_choices` (version Gemini) et `poll_options` (version actuelle).
La base contenait l'une, le code attendait l'autre.

**Correctif** : la migration `supabase/migration.sql` **réconcilie automatiquement** les deux
nomenclatures :

| État de la base | Action effectuée |
|---|---|
| `poll_choices` existe, `poll_options` absente | **renommage** (données conservées) |
| Les deux existent | **transfert des données** puis suppression de l'ancienne |
| Aucune des deux | création de `poll_options` |

Idem pour `poll_multiple` (alias `poll_multi`) et `poll_ends_at` (alias `poll_end_at`,
`poll_deadline`).

**Nouvel outil de synchronisation** :

```bash
npx tsx src/db/sync-schema.ts          # diagnostic seul, ne modifie rien
npx tsx src/db/sync-schema.ts --fix    # détecte ET corrige automatiquement
```

Il vérifie les colonnes (avec leurs alias historiques), les tables, les valeurs d'enum
(`publication_type.sondage`, `user_role.admin`) et répare sans perte de données. Testé depuis
un état reproduisant exactement l'erreur : détection ✔, correction ✔, données préservées ✔,
second passage « ✅ Schéma conforme au code » ✔.

### Problème 2 — `getaddrinfo ENOTFOUND aws-1-eu-west-1.pooler.supabase.com`

```
Error: getaddrinfo ENOTFOUND aws-1-eu-west-1.pooler.supabase.com
  code: 'ENOTFOUND', errno: -3008
```

**Ce n'est pas un bug de code** : c'est un échec de résolution DNS, c'est-à-dire un problème
de **connectivité réseau** (réseau instable, VPN/proxy, DNS indisponible, ou service Supabase
momentanément inaccessible). Les requêtes suivantes réussissaient d'ailleurs, ce qui confirme
le caractère intermittent.

**Ce qui a été amélioré côté code** (`src/db/index.ts`) :

- détection automatique de la cible (locale vs distante) ;
- **TLS activé** pour Supabase et les hébergeurs managés ;
- pool réduit (`max: 5`) car le pooler partagé de Supabase limite les connexions ;
- `idleTimeoutMillis` court (20 s) : les connexions inactives sont fermées avant que le
  serveur ne les coupe (`Connection terminated unexpectedly`) ;
- `connectionTimeoutMillis` explicite ;
- journalisation **explicite** des pertes de connexion avec le nom d'hôte et une indication
  actionnable (vérifier réseau / VPN / `DATABASE_URL`) au lieu d'un crash silencieux.

**À vérifier de votre côté** : connexion réseau, VPN, disponibilité de Supabase
(status.supabase.com), et validité de l'URL dans `.env`.

### Résilience applicative

`sweepExpiredPublications()` (appelée au chargement du fil et du tableau de bord) est
désormais **non bloquante** : en cas d'échec, l'erreur est journalisée avec un message
explicite — y compris l'invite `npx tsx src/db/sync-schema.ts --fix` quand une colonne
manque — et la page continue de s'afficher.
