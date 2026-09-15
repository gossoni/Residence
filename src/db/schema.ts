import type { AnyPgColumn } from "drizzle-orm/pg-core";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/* Enums                                                               */
/* ------------------------------------------------------------------ */

export const userRole = pgEnum("user_role", [
  "admin",
  "president",
  "gh_manager",
  "building_manager",
  "owner",
]);

export const userStatus = pgEnum("user_status", [
  "provisoire",
  "actif",
  "bloque",
]);

export const publicationType = pgEnum("publication_type", [
  "texte",
  "fichier",
  "tache_evenement",
  "sondage",
]);

export const publicationScope = pgEnum("publication_scope", [
  "residence",
  "groupe",
  "immeuble",
]);

export const publicationStatus = pgEnum("publication_status", [
  "en_validation",
  "publiee",
  "rejetee",
  "masquee",
  "bloquee",
]);

export const voteChoice = pgEnum("vote_choice", ["oui", "non"]);

export const reportStatus = pgEnum("report_status", ["ouvert", "traite"]);

/* ------------------------------------------------------------------ */
/* Tables                                                              */
/* ------------------------------------------------------------------ */

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    nom: varchar("nom", { length: 120 }).notNull(),
    prenom: varchar("prenom", { length: 120 }).notNull(),
    telephone: varchar("telephone", { length: 40 }),
    gh: integer("gh").notNull(), // 1..12
    immeuble: varchar("immeuble", { length: 4 }), // A..G (null → résidence / président)
    appartement: varchar("appartement", { length: 20 }),
    role: userRole("role").notNull().default("owner"),
    status: userStatus("status").notNull().default("provisoire"),
    /** true = mot de passe provisoire défini par l'Admin, à changer à la 1re connexion. */
    mustChangePassword: boolean("must_change_password").notNull().default(false),
    validatedBy: integer("validated_by").references((): AnyPgColumn => users.id),
    validatedAt: timestamp("validated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("users_gh_idx").on(t.gh),
    index("users_status_idx").on(t.status),
  ],
);

export const publications = pgTable(
  "publications",
  {
    id: serial("id").primaryKey(),
    authorId: integer("author_id")
      .notNull()
      .references(() => users.id),
    type: publicationType("type").notNull().default("texte"),
    titre: text("titre").notNull(),
    contenu: text("contenu").notNull(),
    fileUrl: text("file_url"),
    fileName: text("file_name"),
    fileMime: text("file_mime"),
    fileSize: integer("file_size"),
    scope: publicationScope("scope").notNull().default("immeuble"),
    gh: integer("gh"),
    immeuble: varchar("immeuble", { length: 4 }),
    /** Options du sondage (type "sondage" uniquement). */
    pollOptions: jsonb("poll_options").$type<string[]>(),
    /** Sondage à choix multiples ? */
    pollMultiple: boolean("poll_multiple").notNull().default(false),
    /** Clôture du sondage. */
    pollEndsAt: timestamp("poll_ends_at", { withTimezone: true }),
    eventAt: timestamp("event_at", { withTimezone: true }),
    status: publicationStatus("status").notNull().default("en_validation"),
    votesPour: integer("votes_pour").notNull().default(0),
    votesContre: integer("votes_contre").notNull().default(0),
    totalVoix: integer("total_voix").notNull().default(0),
    majorite: integer("majorite").notNull().default(0),
    deadline: timestamp("deadline", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    moderationReason: text("moderation_reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("publications_status_idx").on(t.status),
    index("publications_scope_gh_idx").on(t.scope, t.gh),
  ],
);

/**
 * Votes de sondage : chaque participant choisit une ou plusieurs options.
 * Les propriétaires (comme tous les membres actifs) peuvent participer.
 */
export const pollVotes = pgTable(
  "poll_votes",
  {
    id: serial("id").primaryKey(),
    publicationId: integer("publication_id")
      .notNull()
      .references(() => publications.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    optionIndex: integer("option_index").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("poll_votes_unique").on(t.publicationId, t.userId, t.optionIndex),
    index("poll_votes_pub_idx").on(t.publicationId),
  ],
);

export const votes = pgTable(
  "votes",
  {
    id: serial("id").primaryKey(),
    publicationId: integer("publication_id")
      .notNull()
      .references(() => publications.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    choix: voteChoice("choix").notNull(),
    poids: integer("poids").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("votes_pub_user_unique").on(t.publicationId, t.userId)],
);

export const comments = pgTable(
  "comments",
  {
    id: serial("id").primaryKey(),
    publicationId: integer("publication_id")
      .notNull()
      .references(() => publications.id, { onDelete: "cascade" }),
    authorId: integer("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    contenu: text("contenu").notNull(),
    blocked: boolean("blocked").notNull().default(false),
    blockedBy: integer("blocked_by").references(() => users.id),
    blockedReason: text("blocked_reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("comments_pub_idx").on(t.publicationId)],
);

export const reports = pgTable(
  "reports",
  {
    id: serial("id").primaryKey(),
    publicationId: integer("publication_id").references(() => publications.id, {
      onDelete: "cascade",
    }),
    commentId: integer("comment_id").references(() => comments.id, {
      onDelete: "cascade",
    }),
    reporterId: integer("reporter_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(),
    status: reportStatus("status").notNull().default("ouvert"),
    resolvedBy: integer("resolved_by").references(() => users.id),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("reports_status_idx").on(t.status)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 40 }).notNull(),
    titre: text("titre").notNull(),
    body: text("body").notNull(),
    link: text("link"),
    read: boolean("read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("notifications_user_idx").on(t.userId)],
);

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

/**
 * Journal d'administration (table `admin_audit` côté Supabase).
 * Structure alignée sur la base existante : `target` est un libellé texte.
 */
export const adminAudit = pgTable(
  "admin_audit",
  {
    id: serial("id").primaryKey(),
    actorId: integer("actor_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    action: varchar("action", { length: 120 }).notNull(),
    target: text("target"),
    details: text("details"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("admin_audit_created_idx").on(t.createdAt)],
);

/**
 * Archives générées par l'Administrateur (table `data_archives` côté Supabase).
 * Le ZIP est stocké en base (base64 dans `payload`) : modèle adapté à
 * Supabase/Vercel où le système de fichiers n'est pas persistant.
 */
export const dataArchives = pgTable(
  "data_archives",
  {
    id: serial("id").primaryKey(),
    kind: varchar("kind", { length: 30 }).notNull(),
    title: text("title").notNull(),
    filename: text("filename").notNull(),
    payload: text("payload").notNull(),
    downloadedAt: timestamp("downloaded_at", { withTimezone: true }),
    createdBy: integer("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("data_archives_created_idx").on(t.createdAt)],
);

export const sessions = pgTable("sessions", {
  token: varchar("token", { length: 64 }).primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type DataArchive = typeof dataArchives.$inferSelect;
export type AdminAuditRow = typeof adminAudit.$inferSelect;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Publication = typeof publications.$inferSelect;
export type NewPublication = typeof publications.$inferInsert;
export type PollVote = typeof pollVotes.$inferSelect;
export type Vote = typeof votes.$inferSelect;
export type Comment = typeof comments.$inferSelect;
export type Report = typeof reports.$inferSelect;
export type NotificationRow = typeof notifications.$inferSelect;
export type Setting = typeof settings.$inferSelect;

