# PROMPT FINAL — APPLICATION DE GESTION DE RÉSIDENCE « MA RÉSIDENCE »

> Spécification consolidée intégrant l'ensemble des décisions et raffinements
> apportés depuis la conception initiale. Ce document fait foi pour toute
> reprise, évolution ou reconstruction du projet.

---

## 1. CONTEXTE ET OBJECTIF

Développer une application web complète, sécurisée et bilingue pour la gestion
d'une copropriété résidentielle. L'application gère une hiérarchie complexe de
responsabilités, des workflows de validation à délais, des votes pondérés
configurables, des sondages communautaires, une modération avec signalements,
et une administration complète incluant l'archivage et le journal d'audit.

**Publics visés** : Administrateur technique, Président du conseil syndical,
12 Responsables de Groupe, 53 Responsables d'Immeuble, et l'ensemble des
propriétaires.

---

## 2. STACK TECHNIQUE

| Élément | Choix | Contrainte |
|---|---|---|
| Framework | **Next.js 16 (App Router) + TypeScript strict** | Server Components + Server Actions |
| Styling | **Tailwind CSS v4** | Mobile-first |
| UI | Composants maison type shadcn/ui (`src/components/ui.tsx`) | Accessibles, sans dépendance externe |
| Base | **PostgreSQL / Supabase** via **Drizzle ORM** | Voir §4 |
| Auth | Sessions en base + hachage **scrypt** natif Node | Cookie httpOnly `mr_session` (30 j) |
| i18n | Dictionnaires typés FR + AR | Voir §9 |
| Temps réel | **Server-Sent Events** (`/api/notifications/stream`) | Repli par polling 20 s |
| Archives ZIP | **`node:zlib` natif** (`src/lib/zip.ts`) | ⚠️ **AUCUNE dépendance externe** (pas de jszip) |
| Hébergement | Vercel + Supabase (ou VPS/Railway/Render) | Voir §11 |

**Règle impérative** : minimiser les dépendances externes. Tout module doit
pouvoir fonctionner après une simple récupération du code **sans** `npm install`
de paquets additionnels.

---

## 3. STRUCTURE DE LA RÉSIDENCE (FIXE)

12 Groupes d'Habitation (GH), chacun avec ses immeubles :

```
GH1 : A B C D E        (5)     GH7  : A B            (2)
GH2 : A B C D          (4)     GH8  : A B C D        (4)
GH3 : A B C D E F      (6)     GH9  : A B C          (3)
GH4 : A B C D          (4)     GH10 : A B C D        (4)
GH5 : A B C D          (4)     GH11 : A B C D        (4)
GH6 : A B C D E F      (6)     GH12 : A B C D E F G  (7)
```

**Total : 53 immeubles.** Cette structure est codée en dur dans
`src/lib/structure.ts` (`GH_BUILDINGS`) et ne doit jamais être modifiable
depuis l'interface.

---

## 4. SCHÉMA DE DONNÉES (aligné Supabase)

### 4.1 Tables

| Table | Rôle | Colonnes notables |
|---|---|---|
| `users` | Comptes | `email`, `password_hash`, `nom`, `prenom`, `telephone`, `gh`, `immeuble`, `appartement`, `role` (enum), `status` (enum), **`must_change_password`** bool, `validated_by`, `validated_at` |
| `publications` | Contenus | `type` (enum), `titre`, `contenu`, `file_url/name/mime/size`, `scope` (enum), `gh`, `immeuble`, `event_at`, **`poll_options` jsonb**, **`poll_multiple`** bool, **`poll_ends_at`** timestamptz, `status` (enum), `votes_pour`, `votes_contre`, `total_voix`, `majorite`, `deadline`, `published_at`, `moderation_reason` |
| `votes` | Scrutins de validation | `publication_id`, `user_id`, `choix` (enum oui/non), `poids` — **index unique** `(publication_id, user_id)` |
| `poll_votes` | **Sondages** | `publication_id`, `user_id`, `option_index` — **contrainte unique** `(publication_id, user_id, option_index)` |
| `comments` | Commentaires | `contenu`, `blocked`, `blocked_by`, `blocked_reason` |
| `reports` | Signalements | `publication_id?`, `comment_id?`, `reason`, `status` (ouvert/traite) |
| `notifications` | Notifications | `type`, `titre`, `body`, `link`, `read` |
| `settings` | Réglages clé/valeur | Voir §7 |
| `sessions` | Sessions | `token` (PK), `user_id`, `expires_at` |
| `admin_audit` | **Journal d'audit** | `actor_id`, `action`, **`target` texte**, `details`, `created_at` |
| `data_archives` | **Archives ZIP** | `kind`, `title`, `filename`, **`payload` texte (base64)**, `downloaded_at`, `created_by` |

### 4.2 Enums

```sql
user_role          : admin | president | gh_manager | building_manager | owner
user_status        : provisoire | actif | bloque
publication_type   : texte | fichier | tache_evenement | sondage
publication_scope  : residence | groupe | immeuble
publication_status : en_validation | publiee | rejetee | masquee | bloquee
vote_choice        : oui | non
report_status      : ouvert | traite
```

### 4.3 ⚠️ Convention de nommage critique

Les noms de colonnes doivent être **exactement** ceux ci-dessus. Des
divergences de nommage entre versions du code ont déjà causé des erreurs de
production (`poll_choices` vs `poll_options`). L'outil
`npx tsx src/db/sync-schema.ts` détecte et corrige ces divergences avec leurs
alias historiques.

### 4.4 Stockage des fichiers

| Donnée | Stockage | Justification |
|---|---|---|
| **Fichiers joints** (PDF, images, ZIP) | Système de fichiers `public/uploads` avec repli `.uploads`, servis par **`/api/uploads/[name]`** | Certains hébergeurs figent `public/` au build : la route API lit à la demande |
| **Logo** | Idem, URL en base (`settings.logo_url`) | — |
| **Archives ZIP** | **En base** (`data_archives.payload`, base64) | Supabase/Vercel n'ont pas de système de fichiers persistant |

---

## 5. RÔLES ET HIÉRARCHIE DES POUVOIRS

### 5.1 Ordre de responsabilité décroissant

```
Administrateur (4) > Président (3) > Resp. de Groupe (2) > Resp. d'Immeuble (1) > Propriétaire (0)
```

Centralisé dans `src/lib/hierarchy.ts` : `ROLE_RANK`, `canManageUser()`,
`canCreateUser()`, `creatableRoles()`, `scopeCovers()`, `canManageContent()`,
`isImmune()`, `manageUserDenyReason()`, `isSuperiorOrEqualScope()`.

### 5.2 Tableau des pouvoirs

| Rôle | Périmètre | Peut créer | Peut supprimer/gérer | Immunité |
|---|---|---|---|---|
| **Administrateur** | Toute la résidence | Président, Resp. GH, Resp. Immeuble, Propriétaire | **Tout le monde** | **Ne peut être supprimé, bloqué ni rétrogradé par personne** |
| **Président** | Toute la résidence | Resp. GH, Resp. Immeuble, Propriétaire | Resp. GH, Resp. Immeuble, Propriétaire | — |
| **Resp. de Groupe** | Son GH uniquement | Resp. Immeuble, Propriétaire (dans son GH) | Resp. Immeuble et Propriétaires de son GH | — |
| **Resp. d'Immeuble** | Son immeuble | Propriétaire (dans son immeuble) | Propriétaires de son immeuble | — |
| **Propriétaire** | — | **Rien** (uniquement son propre compte, provisoire) | Rien | — |

### 5.3 Règles absolues

1. **Personne ne peut se bloquer, se supprimer ou se rétrograder soi-même.**
2. **Personne ne peut agir sur un compte de rang supérieur ou égal au sien.**
3. **L'Administrateur est immuable** : aucun autre rôle ne peut le modifier.
4. Un Responsable de Groupe/Immeuble ne voit dans son tableau de bord **que
   les membres de son périmètre**.
5. Le formulaire de création ne propose **que les rôles autorisés** et
   **verrouille le GH/immeuble** hors périmètre.
6. L'unicité des postes est automatique : nommer un Responsable déjà pourvu
   rétrograde et notifie l'ancien titulaire.
7. La suppression d'un utilisateur est **en cascade** : sessions, notifications,
   votes, commentaires, signalements, publications (et leurs dépendances).

### 5.4 Sections du tableau de bord par rôle

| Section | Admin | Président | Resp. GH | Resp. Immeuble | Propriétaire |
|---|---|---|---|---|---|
| ⚖️ Hiérarchie des pouvoirs (explication) | ✅ | ✅ | ✅ | ✅ | ❌ |
| ➕ Créer un compte (unitaire) | ✅ | ✅ | ✅ | ✅ | ❌ |
| 👥 Création par lot | ✅ | ✅ | ✅ | ✅ | ❌ |
| 🔑 Réinitialiser un mot de passe | ✅ | ✅ | ✅ | ✅ | ❌ |
| 🔓 Débloquer un compte (mot de passe) | ✅ | ✅ | ✅ | ✅ | ❌ |
| 🗑️ Gestion des comptes (unitaire + lot) | ✅ | ✅ | ✅ | ✅ | ❌ |
| 🏷️ Identité de la résidence (nom + logo) | ✅ | ❌ | ❌ | ❌ | ❌ |
| 🔒 Verrouillage global | ✅ | ❌ | ❌ | ❌ | ❌ |
| ⚖️ Poids de voix | ✅ | ❌ | ❌ | ❌ | ❌ |
| 📝 Types de publication | ✅ | ❌ | ❌ | ❌ | ❌ |
| 🗄️ Archives générées | ✅ | ❌ | ❌ | ❌ | ❌ |
| 📜 Journal d'audit | ✅ | ❌ | ❌ | ❌ | ❌ |
| 🪪 Comptes à valider | ✅ | ✅ | ✅ | ✅ | ❌ |
| 🗳️ Votes & validations en cours | ✅ | ✅ | ✅ | ✅ | ❌ |
| 🚩 File de modération | ✅ | ✅ | ✅ | ✅ | ❌ |
| 🔑 Mon mot de passe | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 6. WORKFLOW D'INSCRIPTION

1. **Inscription publique** (`/register`) : Nom, Prénom, Téléphone (WhatsApp),
   GH (select 1-12), **Immeuble (select dynamique selon GH)**, N° Appartement,
   mot de passe (≥ 8 caractères).
2. Statut initial : **`provisoire`**. L'utilisateur peut se connecter mais ne
   voit **aucun contenu** (écran dédié expliquant les étapes).
3. **Notification automatique** aux responsables d'immeuble compétents dès la
   demande d'inscription.
4. Validation par le Responsable d'Immeuble (ou supérieur) → statut `actif`.
5. Un compte `bloque` voit un écran explicite et ne peut plus se connecter.

---

## 7. RÉGLAGES (table `settings`, modifiables par l'Administrateur)

| Clé | Rôle | Défaut |
|---|---|---|
| `validation_delay_hours` | Délai avant auto-validation d'une publication | 48 |
| `report_threshold` | Seuil de signalements → masquage automatique | 5 |
| `app_locked` | Verrou global : bloque **toutes** les mutations sauf pour l'Admin | false |
| `vote_weight_president` | Voix du Président | 2 |
| `vote_weight_gh_manager` | Voix du Resp. de Groupe | 1 |
| `vote_weight_building_manager` | Voix du Resp. d'Immeuble | 1 |
| `vote_weight_owner` | Voix du Propriétaire (sondages) | 0 |
| `vote_weight_admin` | Voix de l'Administrateur | 2 |
| `pub_type_texte` / `pub_type_fichier` / `pub_type_tache_evenement` / `pub_type_sondage` | Activer/désactiver un type de publication | true |
| `residence_name_fr` | Nom de la résidence (français) | Résidence Les Horizons |
| `residence_name_ar` | Nom de la résidence (arabe) | إقامة الأفق |
| `logo_url` | Logo (URL) | null → icône 🏘️ |

Une clé absente vaut « activé » pour les types, et la valeur par défaut pour
les poids.

---

## 8. PUBLICATIONS

### 8.1 Types (chacun activable/désactivable par l'Admin)

| Type | Description | Contraintes |
|---|---|---|
| `texte` | Publication textuelle | — |
| `fichier` | PDF, image ou **archive ZIP** | **20 Mo max**, upload via `/api/upload` |
| `tache_evenement` | Tâche ou événement daté | `event_at` obligatoire |
| `sondage` | **Sondage communautaire** | ≥ 2 options distinctes, choix unique ou multiple, clôture facultative |

⚠️ Le filtrage des types est **doublement appliqué** : le formulaire ne les
propose pas **et** la soumission serveur est refusée.

### 8.2 Workflow de validation

| Auteur | Portée | Validation |
|---|---|---|
| Président / Admin | Toute | **Immédiate** |
| Resp. de Groupe | Son GH ou immeuble du GH | **Immédiate** |
| Resp. de Groupe | Résidence | **Vote** (12 Resp. GH + Président) |
| Resp. d'Immeuble | Son immeuble | **Immédiate** |
| Resp. d'Immeuble | Son groupe | **Vote** (Resp. Immeubles du GH + Resp. GH) |
| Propriétaire | — | Ne publie pas (commentaires et sondages seulement) |

### 8.3 Majorités

- **Résidence** (défaut) : 14 voix (12 Resp. GH × 1 + Président × 2), majorité
  absolue **8**.
- **Groupe** (défaut) : nombre d'immeubles du GH + 2 (Resp. GH = double voix).
- ⚠️ **Calcul dynamique** (`computeMajority()`) : les majorités sont recalculées
  à partir des **poids configurés** et du **nombre réel de votants actifs**.
  Exemple vérifié : Président = 3, Resp. GH = 2, 12 responsables actifs
  → 27 voix, majorité 14.

**Poids par contexte** (`voteWeightFor()`) : dans la validation de **son propre
groupe**, le Resp. de Groupe reçoit le poids le plus élevé entre le sien et
celui du Président.

### 8.4 Délais et auto-validation

Si le délai (paramétrable) expire **sans rejet majoritaire**, la publication
est **validée automatiquement**. Si un rejet majoritaire est atteint, elle est
rejetée.

**Tâche planifiée** : `sweepExpiredPublications()` est exécutée au chargement
du fil et du tableau de bord. Elle est **non bloquante** (toute erreur SQL est
journalisée sans interrompre le rendu). En production, elle peut être déclenchée
par un cron externe appelant la même logique.

### 8.5 Sondages — spécificités

Contrairement aux scrutins de validation, **les sondages sont ouverts à TOUS
les membres actifs, y compris les simples propriétaires** :

- `canVoteInPoll()` : statut `actif` + sondage ouvert (date de clôture non
  dépassée) + publication publiée.
- Comptage par option avec **barres de progression et pourcentages** en direct.
- Compteur de **votes** et de **participants distincts**.
- Marqueur 👤 sur les options choisies par l'utilisateur.
- **Modification du vote autorisée** (l'ancien choix est remplacé).
- Choix multiple refusé sur un sondage à choix unique.
- Statut « Sondage ouvert » / « Sondage clôturé ».

---

## 9. INTERNATIONALISATION (FR + العربية)

- Sélecteur **FR / ع** dans l'en-tête, mémorisé par le cookie `mr_locale` (1 an).
- `<html lang dir>` : `dir="rtl"` pour l'arabe.
- Le dictionnaire français est la **source de vérité** :
  ```ts
  export const fr = { ... };
  export type Dictionary = typeof fr;
  export const ar: Dictionary = { ... };   // ← contraint par le même type
  ```
  ⚠️ **Toute clé ajoutée/modifiée/supprimée doit l'être dans les DEUX langues**,
  sinon erreur de compilation. Il est impossible de livrer une langue
  désynchronisée.
- Accès : `getT()` côté serveur (`src/lib/i18n-server.ts`),
  `useT()` / `useLocale()` côté client (`src/components/locale-provider.tsx`).
- Le **nom de la résidence** et le **logo** sont dynamiques et bilingues (§7).

---

## 10. MODÉRATION ET INTERACTIONS

| Fonction | Règle |
|---|---|
| **Commentaires** | Visibles immédiatement dès publication validée |
| **Signalements** | Bouton 🚩 pour tous. Motif obligatoire. Anti-doublon par utilisateur et par cible |
| **Masquage auto** | Au-delà du seuil configurable → publication `masquee` ou commentaire bloqué, + notification aux modérateurs |
| **Modération manuelle** | Blocage **avec justification obligatoire** (visible par l'auteur), restauration, validation/rejet manuels forcés |
| **Suppression** | Selon la hiérarchie (§5) ; Admin peut supprimer toute publication/commentaire signalé |
| **Votes de scrutin** | ✅ Approuver / ❌ Rejeter, modifiables jusqu'à la clôture |

---

## 11. NOTIFICATIONS

**Temps réel** via Server-Sent Events (`/api/notifications/stream`), avec
repli automatique par polling (20 s) en cas d'échec. Indicateur vert 🟢 quand
le flux est actif, badge de compteur non-lus.

**Événements notifiés** : validation de compte, approbation/rejet de
publication, nouveau commentaire, signalement, blocage, changement de rôle,
création de compte, réinitialisation de mot de passe, rétablissement d'accès,
nouvelle demande d'inscription, vote requis.

---

## 12. ARCHIVAGE ET JOURNAL D'AUDIT

### 12.1 Archives ZIP (Admin et responsables dans leur périmètre)

| Cible | Contenu de l'archive |
|---|---|
| **Utilisateur** | `utilisateur/profil.json` (**sans le hash du mot de passe**), `publications.json`, `commentaires.json`, `votes.json`, `signalements-emis.json`, `commentaires-recus.json`, `LISEZ-MOI.txt` |
| **Publication** | `publication/publication.json` : publication, auteur, commentaires, votes, signalements |

- Génération par `src/lib/zip.ts` (**zlib natif**, CRC-32, DEFLATE, UTF-8).
- Stockage **en base** (`data_archives.payload`, base64).
- **Téléchargement unique** : `/api/archives/[id]` sert le ZIP puis
  **supprime automatiquement** l'enregistrement. Second accès → 404.
- Accès réservé à l'Administrateur (401 sinon).
- Chaque téléchargement est journalisé.

### 12.2 Journal d'audit (`admin_audit`)

Toute action sensible est tracée : `actor_id`, `action`, `target` (texte,
ex. `user#12`), `details`, horodatage. Consultable uniquement par
l'Administrateur. Actions tracées : créations/suppressions (unitaires et par
lot), changements de rôles, blocages/déblocages, réinitialisations de mot de
passe, archivages, téléchargements, modifications de réglages, verrouillage,
changement de mot de passe.

---

## 13. MOTS DE PASSE

| Cas | Règle |
|---|---|
| **Auto-inscription** (`/register`) | L'utilisateur choisit son mot de passe → `must_change_password = false` |
| **Toute création par un responsable** (unitaire **ou par lot**) | ⚠️ **`must_change_password = true` OBLIGATOIRE** — changement forcé à la première connexion |
| **Réinitialisation par un responsable** | Provsoire par défaut (case optionnelle pour un mot de passe définitif) |
| **Blocage forcé** | À la connexion, redirection vers `/changer-mdp` ; **toutes** les autres pages inaccessibles (307) ; bannière 🔑 ; contrôles : mot de passe provisoire correct, longueur ≥ 8, confirmation, différence avec l'ancien ; accès restauré immédiatement après |
| **Changement volontaire** | Section « Mon mot de passe » dans le tableau de bord (tous rôles), sans invalidation de la session en cours |
| **Déblocage** | Bouton 🔓 pour lever l'obligation (si mot de passe perdu), journalisé et notifié |

---

## 14. OUTILS EN LIGNE DE COMMANDE

```bash
npx tsx src/db/seed.ts            # Jeu de démonstration complet (⚠️ EFFACE les données)
npx tsx src/db/check.ts           # Diagnostic complet de la base
npx tsx src/db/sync-schema.ts     # Diagnostic du schéma (ne modifie rien)
npx tsx src/db/sync-schema.ts --fix  # Détecte ET corrige les divergences (alias inclus)
npx tsx src/db/make-admin.ts [email] [mdp]        # Crée/promeut l'Admin SANS effacer
npx tsx src/db/reset-password.ts <email> [mdp] [--final]  # Récupération d'urgence
npx tsx src/db/verify-login.ts [email] [mdp]      # Vérifie compte + mot de passe
```

**Migration** : `supabase/migration.sql` — **idempotente** (relançable), ne
supprime aucune donnée, **réconcilie les nomenclatures historiques**
(`poll_choices` → `poll_options`, etc.).

**Comptes de démonstration** (mot de passe `Residence2025!`) :
`admin@residence.app`, `president@residence.app`, `gh1@residence.app`,
`gh1-a@residence.app`, `proprietaire@residence.app`, `nouveau@residence.app`
(provisoire).

---

## 15. INTERFACE UTILISATEUR

- **Design** : épuré, professionnel, **mobile-first**, Tailwind v4.
- **Navigation** : bureau + **tiroir latéral mobile** (hamburger).
- **Carte d'informations utilisateur** en haut du fil d'actualité : initiales,
  « Bonjour + nom », e-mail, rôle, statut, localisation, ancienneté, lien
  « Voir mon profil » — **sans devoir ouvrir le tableau de bord**.
- **Fil d'actualité** filtrable : Tout / Résidence / Mon GH / Mon Immeuble.
- **Logo** : 44→56 px par défaut, 48→64 px pour un logo personnalisé.
- **Création par lot** : une ligne par personne
  (`Prénom ; Nom ; email ; téléphone`), séparateurs `;` `,` `|` ou tabulation,
  100 comptes max, tableau des mots de passe générés + liste des lignes
  ignorées avec la raison.
- **Formulaire de sondage** : ajout/suppression dynamique d'options,
  choix multiple, date de clôture.

---

## 16. EXIGENCES NON FONCTIONNELLES

1. **Résilience** : aucune erreur de base de données ne doit faire planter une
   page. Les messages d'erreur sont **actionables** (indiquent la commande de
   correction).
2. **Sécurité** : hachage scrypt, sessions httpOnly, protection contre le
   parcours de répertoire, validation des types MIME par octets magiques,
   jamais de hash de mot de passe exporté.
3. **Traçabilité** : journal d'audit exhaustif.
4. **Zéro dépendance externe** pour les fonctions critiques (ZIP).
5. **Portabilité** : le code doit fonctionner sur Vercel/Supabase (stockage en
   base) **et** sur un VPS (système de fichiers).
6. **Bilingue par construction** : impossible de désynchroniser les langues.

---

## 17. ARBORESCENCE DE RÉFÉRENCE

```
src/
  app/
    page.tsx                     Landing
    login/ register/             Authentification
    feed/                        Fil d'actualité + carte utilisateur
    dashboard/                   Tableau de bord (sections par rôle)
    publications/nouvelle/       Création
    publications/[id]/           Détail + scrutin + sondage + commentaires
    profil/                      Profil
    changer-mdp/                 Changement de mot de passe forcé
    api/
      health/                    Healthcheck
      upload/                    Upload (détection par octets magiques)
      uploads/[name]/            Service des fichiers
      archives/[id]/             Téléchargement d'archives (unique)
      notifications/             Polling
      notifications/stream/      SSE temps réel
    actions.ts                   Server Actions
  components/
    ui.tsx                       Kit UI
    client-forms.tsx             Formulaires client
    admin-ui.tsx                 Composants d'administration
    locale-provider.tsx          i18n client
    publication-card.tsx         Carte de publication
    user-info-card.tsx           Carte utilisateur
    mobile-nav.tsx               Navigation mobile
  db/
    schema.ts index.ts seed.ts   Schéma, connexion, démo
    check.ts sync-schema.ts      Diagnostics
    make-admin.ts reset-password.ts verify-login.ts
    ensure.ts zip.ts
  lib/
    logic.ts                     Logique métier (votes, sondages, réglages)
    hierarchy.ts                 ⚠️ Hiérarchie des pouvoirs (source unique)
    archive.ts                   Archivage
    structure.ts i18n.ts i18n-server.ts
    auth.ts password.ts events.ts format.ts cn.ts queries.ts
supabase/migration.sql
```

---

## 18. CRITÈRES D'ACCEPTATION

- [ ] Les 12 GH et leurs 53 immeubles sont fixes et conformes à §3.
- [ ] Aucun rôle ne peut se bloquer, se supprimer ou se rétrograder soi-même.
- [ ] Aucun rôle ne peut agir sur un rang supérieur ou égal.
- [ ] L'Administrateur ne peut être supprimé, bloqué ni rétrogradé.
- [ ] Un propriétaire ne peut que s'inscrire provisoirement.
- [ ] Toute création de compte (unitaire ou par lot) force le changement de
      mot de passe à la première connexion.
- [ ] Les majorités sont calculées à partir des poids configurés.
- [ ] L'Admin peut activer/désactiver chaque type de publication (double
      contrôle UI + serveur).
- [ ] Les sondages sont accessibles aux propriétaires.
- [ ] Les archives ZIP sont valides, stockées en base, téléchargeables une
      seule fois, et ne contiennent jamais de hash de mot de passe.
- [ ] Toute action sensible figure dans `admin_audit`.
- [ ] L'interface est intégralement disponible en français et en arabe (RTL).
- [ ] Le nom de la résidence et le logo sont personnalisables et bilingues.
- [ ] La suppression d'un utilisateur est réellement en cascade.
- [ ] Aucune dépendance externe n'est requise pour les archives.
- [ ] `npx tsx src/db/sync-schema.ts` ne rapporte aucune divergence.
- [ ] `next typegen`, `tsc --noEmit`, `next build` et le healthcheck passent.
