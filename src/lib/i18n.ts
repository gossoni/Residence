/* ------------------------------------------------------------------ */
/* i18n — Français / العربية                                          */
/*                                                                     */
/* MÉCANISME DE SÉCURITÉ POUR L'AVENIR :                              */
/* `export type Dictionary = typeof fr` puis `export const ar: Dictionary` */
/* garantit que les deux langues partagent EXACTEMENT les mêmes clés.  */
/* Ajouter une clé au français sans la traduire en arabe (ou           */
/* inversement) provoque une ERREUR DE COMPILATION TypeScript.         */
/* ------------------------------------------------------------------ */

export const LOCALES = ["fr", "ar"] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_COOKIE = "mr_locale";
export const DEFAULT_LOCALE: Locale = "fr";

export function isLocale(value: string | null | undefined): value is Locale {
  return value === "fr" || value === "ar";
}

export function dirFor(locale: Locale): "ltr" | "rtl" {
  return locale === "ar" ? "rtl" : "ltr";
}

export function isRtl(locale: Locale): boolean {
  return locale === "ar";
}

export function localeLabel(locale: Locale): string {
  return locale === "ar" ? "العربية" : "Français";
}

/* ------------------------------------------------------------------ */
/* Dictionnaire Français (source de vérité du contrat de clés)         */
/* ------------------------------------------------------------------ */

export const fr = {
  meta: {
    appName: "Ma Résidence",
    tagline: "Copropriété",
    residenceName: "Résidence Les Horizons",
    description:
      "Plateforme de gestion de la copropriété : publications, votes pondérés, validation des comptes et modération communautaire.",
  },
  nav: {
    feed: "Fil d’actualité",
    publish: "Publier",
    dashboard: "Tableau de bord",
    profile: "Mon profil",
    login: "Connexion",
    register: "S’inscrire",
    logout: "Se déconnecter",
    menu: "Menu",
    notifications: "Notifications",
    markAllRead: "Tout marquer comme lu",
    noNotifications: "Aucune notification.",
    language: "Langue",
    backHome: "Retour à l’accueil",
  },
  common: {
    save: "Enregistrer",
    cancel: "Annuler",
    send: "Envoyer",
    all: "Tout",
    actions: "Action",
    seeAll: "Voir tout",
    download: "Télécharger le fichier",
    attachedFile: "Fichier joint",
    archiveZip: "Archive ZIP",
    createdAt: "Créée le",
    publishedAt: "publiée le",
    memberSince: "Membre depuis",
    location: "Localisation",
    status: "Statut",
    role: "Rôle",
    account: "Compte",
    email: "Adresse e-mail",
    phone: "Téléphone (WhatsApp)",
    lastName: "Nom",
    firstName: "Prénom",
    apartment: "N° Appartement",
    building: "Immeuble",
    gh: "Groupe d’Habitation",
    apply: "Appliquer",
    votes: "voix",
    majorityRequired: "Majorité absolue requise",
    autoValidationHint:
      "En cas d’expiration du délai sans rejet majoritaire, la publication est validée automatiquement.",
    totalUsers: "comptes",
  },
  auth: {
    loginTitle: "Bon retour parmi nous",
    loginSubtitle: "Connectez-vous pour accéder à votre espace copropriété.",
    password: "Mot de passe",
    login: "Se connecter",
    noAccount: "Pas encore de compte ?",
    createAccount: "Créer un compte propriétaire",
    alreadyAccount: "Déjà inscrit ?",
    registerTitle: "Créer mon compte propriétaire",
    registerSubtitle:
      "Votre identité sera vérifiée par le Responsable de votre immeuble avant activation de votre accès.",
    register: "Créer mon compte",
    passwordHint: "8 caractères minimum",
    demoAccounts: "Comptes de démonstration",
    demoPassword: "Mot de passe",
    registerInfo:
      "Après validation de votre identité par le Responsable de votre immeuble, votre compte passera au statut Actif et vous pourrez accéder au fil de la résidence.",
    waitingTitle: "Compte en attente de validation",
    waitingBody:
      "Votre compte propriétaire a bien été créé. Il doit maintenant être vérifié par le Responsable de votre immeuble (ou un administrateur).",
    step1: "Inscription publique complétée",
    step2: "Vérification d’identité par le Responsable d’Immeuble (tableau de bord).",
    step3:
      "Statut Actif — accès complet au fil, aux votes et aux commentaires.",
    blockedTitle: "Compte bloqué",
    blockedBody:
      "Votre compte a été bloqué par la modération. Contactez le Président de la résidence pour toute réclamation.",
    invalidCredentials: "Identifiants invalides.",
    accountBlocked:
      "Votre compte est bloqué. Contactez le Président de la résidence pour plus d’informations.",
  },
  feed: {
    title: "Fil d’actualité",
    subtitle: "Publications validées visibles dans votre périmètre.",
    filterAll: "Tout",
    filterResidence: "🏘️ Résidence",
    filterGroup: "🏢 Mon GH",
    filterBuilding: "🏠 Mon Immeuble",
    empty: "Aucune publication pour le moment",
    emptyDesc:
      "Les publications validées de votre résidence, de votre groupe ou de votre immeuble apparaîtront ici.",
    pendingHint:
      "Les contenus en attente de validation apparaissent dans votre tableau de bord.",
    hereLink: "tableau de bord",
  },
  dashboard: {
    badge: "Tableau de bord",
    hello: "Bonjour",
    newPublication: "📝 Nouvelle publication",
    perimeter: "Périmètre",
    statsActive: "Comptes actifs",
    statsPending: "En attente",
    statsBlocked: "Bloqués",
    statsPublished: "Publications publiées",
    statsValidation: "En validation",
    statsReports: "Signalements ouverts",
    accountsToValidate: "🪪 Comptes propriétaires à valider",
    accountsToValidateEmpty: "Aucun compte en attente",
    accountsToValidateEmptyDesc: "Toutes les demandes d’inscription ont été traitées.",
    pending: "en attente",
    scrutins: "🗳️ Votes & validations en cours",
    scrutinsEmpty: "Aucun scrutin en attente",
    scrutinsEmptyDesc:
      "Les publications soumises au vote des responsables apparaîtront ici jusqu’à leur décision ou l’expiration du délai.",
    vote: "Voter",
    moderation: "🚩 File de modération",
    moderationEmpty: "Aucun signalement dans votre périmètre",
    moderationEmptyDesc:
      "Les contenus signalés par les membres de la communauté apparaîtront ici.",
    reportsCount: "signalement(s)",
    reportedBy: "Signalé par",
    reason: "Motif",
    examine: "Examiner",
    userManagement: "👥 Gestion des utilisateurs",
    roleAssigned: "Rôle attribué",
    membersPerimeter: "Membres de mon périmètre",
    noMembers: "Aucun membre actif dans votre périmètre",
    configTitle: "⚙️ Configuration générale",
    configSubtitle: "Délais de validation & seuils de modération",
    recentPubs: "📰 Dernières publications",
    nothingToShow: "Rien à afficher pour l’instant",
    by: "par",
  },
  pub: {
    newTitle: "📝 Nouvelle publication",
    type: "Type de publication",
    typeText: "📝 Texte",
    typeFile: "📎 Fichier (PDF / Image / ZIP)",
    typeTask: "📅 Tâche / Événement",
    title: "Titre",
    titlePlaceholder: "Titre de la publication",
    content: "Contenu",
    contentPlaceholder: "Décrivez votre publication…",
    fileLabel: "Fichier joint (PDF, image ou archive ZIP, max 20 Mo)",
    fileHint:
      "💡 Utilisez une archive ZIP pour regrouper plusieurs documents (photos, PDF, plans…) dans une seule pièce jointe téléchargeable.",
    eventDate: "Date de l’événement / échéance",
    scope: "Portée",
    targetGh: "Groupe d’Habitation",
    targetBuilding: "Immeuble",
    publish: "Publier",
    immediatePublish:
      "✅ Publication de votre périmètre : validation immédiate et diffusion automatique.",
    presidentialPublish: "✅ Publication présidentielle : validation immédiate et diffusion automatique.",
    voteRequired: "⏳ Cette publication sera soumise au vote des responsables",
    voteRequiredResidence:
      "(12 Responsables de Groupe + Président, majorité absolue 8 voix sur 14)",
    voteRequiredGroup:
      "(autres Responsables d’Immeuble du groupe + Responsable de Groupe)",
    autoValidateSuffix:
      "Sans rejet majoritaire sous le délai configuré, elle sera validée automatiquement.",
    votePanel: "🗳️ Scrutin de validation",
    noDeadline: "Sans délai",
    approve: "✅ Approuver",
    reject: "❌ Rejeter",
    approvedLabel: "✅ Approuvé",
    rejectedLabel: "❌ Rejeté",
    voteRecorded: "Vote enregistré",
    voteChangeAllowed:
      "Vous pouvez modifier votre vote jusqu’à la clôture du scrutin.",
    onlyManagersVote: "Seuls les responsables concernés par ce scrutin peuvent voter.",
    comments: "💬 Commentaires",
    writeComment: "Écrire un commentaire… (visible immédiatement)",
    comment: "Commenter",
    noComments: "Aucun commentaire pour l’instant. Soyez le premier à réagir !",
    commentsClosed:
      "Les commentaires seront ouverts une fois cette publication validée et diffusée.",
    commentHidden: "Commentaire masqué",
    report: "Signaler",
    reportTitle: "Signaler ce contenu",
    reportReason: "Motif du signalement",
    reportDetails: "Précisions (facultatif)",
    reportDetailsPlaceholder: "Décrivez le problème…",
    sendReport: "Envoyer le signalement",
    moderation: "Modération",
    blockPublication: "🚫 Bloquer cette publication",
    restorePublication: "✅ Restaurer la publication",
    blockDefinitely: "Bloquer définitivement",
    manualApprove: "✅ Valider manuellement",
    manualReject: "⛔ Rejeter manuellement",
    blockComment: "Bloquer",
    restoreComment: "Restaurer",
    justification: "Justification",
    justificationVisible: "Justification (visible par l’auteur)",
    justificationPlaceholder: "Motif du blocage…",
    block: "Bloquer",
    statusLabel: "Statut",
    contentUnavailable: "Contenu indisponible",
    contentUnavailableDesc:
      "Cette publication est hors de votre périmètre, en attente de validation ou a été retirée par la modération.",
    openReports: "signalement(s) ouvert(s)",
  },
  roles: {
    admin: "Administrateur",
    president: "Président",
    gh_manager: "Responsable de Groupe",
    building_manager: "Responsable d’Immeuble",
    owner: "Propriétaire",
  },
  userStatus: {
    provisoire: "En attente de validation",
    actif: "Actif",
    bloque: "Bloqué",
  },
  pubStatus: {
    en_validation: "En cours de validation",
    publiee: "Publiée",
    rejetee: "Rejetée",
    masquee: "Masquée (signalements)",
    bloquee: "Bloquée",
  },
  scopes: {
    residence: "Résidence",
    groupe: "Groupe",
    immeuble: "Immeuble",
  },

  settings: {
    delayLabel: "Délai de validation (heures)",
    delayHelp:
      "Après ce délai, une publication sans rejet majoritaire est validée automatiquement.",
    thresholdLabel: "Seuil de signalements (masquage auto)",
    save: "Enregistrer les paramètres",
    saved: "Paramètres enregistrés ✅",
  },
  roleManager: {
    owner: "Propriétaire",
    building_manager: "Resp. d’Immeuble",
    gh_manager: "Resp. de Groupe",
    president: "Président",
  },
  profile: {
    title: "Mon profil",
    editTitle: "Modifier mes informations",
    changePassword: "Changer de mot de passe",
    currentPassword: "Mot de passe actuel",
    newPassword: "Nouveau mot de passe",
    passwordOptional:
      "Laissez ces champs vides si vous ne souhaitez pas changer de mot de passe.",
    updated: "Profil mis à jour ✅",
  },
  admin: {
    section: "🛡️ Administration",
    title: "Contrôle de l’application",
    subtitle:
      "L’Administrateur contrôle l’ensemble des modifications de l’application et initialise les comptes de la résidence.",
    createAccount: "➕ Créer un compte",
    createAccountSubtitle:
      "Créez manuellement le Président et les Responsables (phase d’initialisation).",
    resetPassword: "🔑 Réinitialiser un mot de passe",
    resetPasswordSubtitle:
      "Définissez un nouveau mot de passe pour un utilisateur, à sa demande.",
    appLock: "🔒 Verrouillage global des modifications",
    appLockHelp:
      "Lorsque le verrou est actif, aucune modification n’est acceptée (publications, votes, commentaires, signalements, modération) — seul l’Administrateur peut agir.",
    lockOn: "Verrouiller l’application",
    lockOff: "Déverrouiller l’application",
    lockActive: "Application verrouillée — modifications bloquées",
    auditLog: "📜 Journal d’audit",
    auditEmpty: "Aucune action enregistrée pour le moment.",
    actor: "Acteur",
    action: "Action",
    target: "Cible",
    details: "Détails",
    date: "Date",
    newPassword: "Nouveau mot de passe",
    generatePassword: "Générer automatiquement",
    passwordGenerated: "Mot de passe généré",
    copyWarning:
      "Notez ce mot de passe maintenant : il ne sera plus affiché ensuite.",
    accountCreated: "Compte créé",
    role: "Rôle",
    chooseRole: "Choisir un rôle",
    createdBy: "Créé par l’Administrateur",
    allAccounts: "Tous les comptes",
  },
  errors: {
    appLocked:
      "L’application est actuellement verrouillée par l’Administrateur : aucune modification n’est possible.",
    forbidden: "Vous n’êtes pas autorisé à effectuer cette action.",
  },
  branding: {
    section: "🏷️ Identité de la résidence",
    title: "Nom et logo",
    subtitle:
      "Le nom et le logo s’affichent dans l’en-tête de toutes les pages, dans les deux langues.",
    nameFr: "Nom de la résidence (français)",
    nameAr: "Nom de la résidence (arabe)",
    logo: "Logo",
    logoHint:
      "PNG, JPG, WEBP ou SVG — carré recommandé (max 2 Mo). Laissez vide pour conserver l’icône par défaut 🏘️.",
    uploadLogo: "Choisir un fichier…",
    removeLogo: "Supprimer le logo",
    saved: "Identité enregistrée ✅",
    preview: "Aperçu",
  },
  forcePassword: {
    title: "Changement de mot de passe requis",
    subtitle:
      "Votre mot de passe actuel est provisoire : il a été défini par l’Administrateur. Choisissez votre propre mot de passe pour continuer.",
    current: "Mot de passe provisoire",
    newLabel: "Nouveau mot de passe",
    confirm: "Confirmer le nouveau mot de passe",
    submit: "Définir mon mot de passe",
    success: "Mot de passe défini ✅",
    mismatch: "Les deux mots de passe ne correspondent pas.",
    tooShort: "Le mot de passe doit contenir au moins 8 caractères.",
    sameAsOld: "Le nouveau mot de passe doit être différent du provisoire.",
    banner:
      "🔑 Vous utilisez un mot de passe provisoire. Vous devez le changer avant de continuer.",
    provisional: "Mot de passe provisoire — à changer à la première connexion",
    provisionalHint:
      "Le mot de passe sera marqué comme provisoire : l’utilisateur devra le remplacer par le sien à sa première connexion.",
    provisionalToggle: "Mot de passe provisoire (changement obligatoire à la 1re connexion)",
    unlock: "Débloquer l’accès de ce compte",
    unlockHint:
      "À utiliser si un compte reste bloqué sur l’écran de changement de mot de passe ou si son mot de passe a été perdu.",
    unlockDone: "Accès débloqué ✅",
    pendingBadge: "Mot de passe provisoire en attente",
  },
  batch: {
    title: "👥 Création par lot",
    subtitle:
      "Créez plusieurs comptes d’un coup (un par ligne). Un mot de passe provisoire est imposé à chaque compte créé.",
    lines: "Comptes à créer (une ligne par personne)",
    linesPlaceholder: "Prénom ; Nom ; email ; téléphone\nExemple :\nAmine ; Bennani ; amine@exemple.fr ; +212 6 12 34 56 78",
    linesHelp: "Format accepté : prénom ; nom ; e-mail ; téléphone (facultatif). Séparateurs : ; , | ou tabulation.",
    submit: "Créer les comptes",
    created: "Comptes créés",
    failed: "Lignes ignorées",
    passwordShared: "Mot de passe commun au lot (facultatif)",
    passwordSharedHelp:
      "Laissez vide pour générer un mot de passe unique par compte. ⚠️ Dans tous les cas, chaque utilisateur devra changer son mot de passe à sa première connexion.",
    mandatoryNotice:
      "🔑 Règle : après toute création (unitaire ou par lot), le changement de mot de passe est obligatoire à la première connexion.",
    count: "compte(s) créé(s)",
    noLine: "Aucune ligne valide.",
  },
  manage: {
    section: "🧹 Gestion des comptes et du contenu",
    selected: "sélectionné(s)",
    selectAll: "Tout sélectionner",
    batchActions: "Actions par lot",
    archive: "🗄️ Archiver",
    archiveAndDelete: "🗄️ Archiver puis supprimer",
    delete: "🗑️ Supprimer",
    deleteSelected: "🗑️ Supprimer la sélection",
    confirmDeleteUsers:
      "Supprimer définitivement le ou les comptes sélectionnés ? Toutes leurs publications, commentaires et votes seront également supprimés. Action irréversible.",
    confirmArchiveAndDelete:
      "Une archive ZIP complète sera créée, puis le ou les comptes seront supprimés. Continuer ?",
    confirmDeleteUser:
      "Supprimer définitivement ce compte et tout son contenu ? Action irréversible.",
    archiveUser: "🗄️ Archiver",
    deleteUser: "🗑️",
    archives: "🗄️ Archives générées",
    archivesEmpty: "Aucune archive générée pour le moment.",
    archivesHint:
      "Chaque archive ZIP (profil, publications, commentaires, votes) est automatiquement supprimée du serveur après avoir été téléchargée.",
    download: "⬇️ Télécharger",
    size: "Taille",
    pendingDownload: "En attente de téléchargement",
    downloaded: "Téléchargée",
    archiveCreated: "Archive créée ✅",
    deleted: "Supprimé ✅",
    deletePublication: "🗑️ Supprimer la publication",
    archivePublication: "🗄️ Archiver",
    deleteComment: "🗑️ Supprimer",
    archiveComment: "🗄️ Archiver",
    confirmDeletePublication:
      "Supprimer définitivement cette publication et tous ses commentaires, votes et signalements ?",
    moderationActions: "Actions",
    noReports: "Aucun signalement à traiter.",
    protectAdmin: "Les comptes Administrateur ne peuvent pas être supprimés.",
    protectedSelf: "Vous ne pouvez pas supprimer votre propre compte.",
  },
  weights: {
    section: "⚖️ Poids de voix",
    title: "Multiplicateurs de voix",
    subtitle:
      "Définissez le nombre de voix attribué à chaque rôle. Les majorités des scrutins sont recalculées automatiquement.",
    president: "Président",
    gh_manager: "Responsable de Groupe",
    building_manager: "Responsable d’Immeuble",
    owner: "Propriétaire (votes de sondage)",
    admin: "Administrateur",
    hint: "Entier de 0 à 100. Exemples : Président = 2 (double voix), Resp. de Groupe = 1.",
    warning:
      "⚠️ Le Président et le Responsable de Groupe ne peuvent pas valoir tous deux 0 : aucun scrutin de résidence ne pourrait aboutir.",
    groupContext:
      "Dans la validation de son propre groupe, le Responsable de Groupe reçoit le poids le plus élevé entre le sien et celui du Président.",
    saved: "Poids de voix enregistrés ✅",
    current: "Configuration actuelle",
    residenceExample: "Scrutin de résidence",
    groupExample: "Scrutin de groupe",
  },
  pubTypes: {
    section: "📝 Types de publication",
    title: "Activer / désactiver les types",
    subtitle:
      "Décochez un type pour qu’il n’apparaisse plus dans le formulaire de création.",
    texte: "Texte",
    fichier: "Fichier (PDF / image / ZIP)",
    tache_evenement: "Tâche / Événement",
    sondage: "Sondage",
    saved: "Types de publication enregistrés ✅",
    disabledNotice: "Ce type a été désactivé par l’Administrateur.",
  },
  ownPassword: {
    title: "🔑 Mon mot de passe",
    subtitle: "Changez immédiatement votre mot de passe pour votre prochaine session.",
    current: "Mot de passe actuel",
    newPassword: "Nouveau mot de passe",
    confirm: "Confirmer le nouveau mot de passe",
    submit: "Changer mon mot de passe",
    saved: "Mot de passe changé ✅ Il sera utilisé dès votre prochaine connexion.",
    hint: "Le changement prend effet immédiatement et n’invalide pas votre session en cours.",
  },
  poll: {
    type: "📊 Sondage",
    options: "Options proposées",
    optionPlaceholder: "Option",
    addOption: "➕ Ajouter une option",
    removeOption: "Supprimer",
    multiple: "Autoriser plusieurs choix",
    multipleHint: "Sinon, chaque participant ne peut choisir qu’une seule option.",
    endsAt: "Date de clôture (facultatif)",
    needTwo: "Au moins deux options différentes sont nécessaires.",
    participate: "Participer au sondage",
    myVote: "Mon choix",
    changeVote: "Modifier mon choix",
    results: "Résultats",
    votes: "vote(s)",
    participants: "participant(s)",
    closed: "Sondage clôturé",
    open: "Sondage ouvert",
    noOptions: "Aucune option définie.",
    yourChoice: "Votre choix",
    submitVote: "Voter",
    voted: "Votre vote a été enregistré ✅",
    allMembers: "Tous les membres actifs peuvent participer, y compris les propriétaires.",
    percent: "des votes",
  },
  hierarchy: {
    title: "⚖️ Hiérarchie des pouvoirs",
    subtitle:
      "Chaque responsable peut créer et supprimer uniquement dans son périmètre, et seulement des comptes de rang inférieur.",
    yourPowers: "Vos pouvoirs",
    canCreate: "Vous pouvez créer",
    canDelete: "Vous pouvez supprimer / gérer",
    yourScope: "Votre périmètre",
    rank: "Ordre de responsabilité",
    rankList:
      "Administrateur > Président > Responsable de Groupe > Responsable d’Immeuble > Propriétaire",
    immune: "L’Administrateur ne peut être supprimé ni modifié par personne.",
    ownerRule:
      "Les simples propriétaires ne peuvent que créer leur propre compte, provisoirement, en attente de validation par le Responsable de leur immeuble.",
    residence: "Toute la résidence",
    yourGroup: "Votre groupe (GH)",
    yourBuilding: "Votre immeuble",
    nothing: "Aucun pouvoir de gestion",
    selfRegister: "Création de son propre compte uniquement (provisoire)",
  },
  userInfo: {
    title: "Mon compte",
    welcome: "Bonjour",
    role: "Rôle",
    status: "Statut",
    location: "Localisation",
    viewProfile: "Voir mon profil",
    connectedAs: "Connecté en tant que",
  },
};

export type Dictionary = typeof fr;

/* ------------------------------------------------------------------ */
/* Dictionnaire العربية (contraint par le même type que `fr`)          */
/* ------------------------------------------------------------------ */

export const ar: Dictionary = {
  meta: {
    appName: "إقامتي",
    tagline: "الملكية المشتركة",
    residenceName: "إقامة الأفق",
    description:
      "منصة لإدارة الملكية المشتركة: المنشورات، التصويت المرجّح، المصادقة على الحسابات، والإشراف المجتمعي.",
  },
  nav: {
    feed: "آخر الأخبار",
    publish: "نشر",
    dashboard: "لوحة التحكم",
    profile: "ملفي الشخصي",
    login: "تسجيل الدخول",
    register: "إنشاء حساب",
    logout: "تسجيل الخروج",
    menu: "القائمة",
    notifications: "الإشعارات",
    markAllRead: "تعليم الكل كمقروء",
    noNotifications: "لا توجد إشعارات.",
    language: "اللغة",
    backHome: "العودة إلى الصفحة الرئيسية",
  },
  common: {
    save: "حفظ",
    cancel: "إلغاء",
    send: "إرسال",
    all: "الكل",
    actions: "إجراء",
    seeAll: "عرض الكل",
    download: "تنزيل الملف",
    attachedFile: "ملف مرفق",
    archiveZip: "ملف مضغوط ZIP",
    createdAt: "أُنشئ في",
    publishedAt: "نُشر في",
    memberSince: "عضو منذ",
    location: "الموقع",
    status: "الحالة",
    role: "الدور",
    account: "الحساب",
    email: "البريد الإلكتروني",
    phone: "الهاتف (واتساب)",
    lastName: "الاسم العائلي",
    firstName: "الاسم الشخصي",
    apartment: "رقم الشقة",
    building: "العمارة",
    gh: "مجموعة السكن",
    apply: "تطبيق",
    votes: "صوت",
    majorityRequired: "الأغلبية المطلوبة",
    autoValidationHint:
      "في حال انتهاء المهلة دون رفض بالأغلبية، يتم قبول المنشور تلقائياً.",
    totalUsers: "حساب",
  },
  auth: {
    loginTitle: "مرحباً بعودتك",
    loginSubtitle: "سجّل الدخول للوصول إلى مساحتك في الملكية المشتركة.",
    password: "كلمة المرور",
    login: "تسجيل الدخول",
    noAccount: "ليس لديك حساب؟",
    createAccount: "إنشاء حساب مالك",
    alreadyAccount: "لديك حساب بالفعل؟",
    registerTitle: "إنشاء حسابي كمالك",
    registerSubtitle:
      "سيتم التحقق من هويتك من قبل مسؤول عمارتك قبل تفعيل حسابك.",
    register: "إنشاء حسابي",
    passwordHint: "8 أحرف على الأقل",
    demoAccounts: "حسابات تجريبية",
    demoPassword: "كلمة المرور",
    registerInfo:
      "بعد التحقق من هويتك من قبل مسؤول العمارة، سيصبح حسابك نشطاً ويمكنك الوصول إلى أخبار الإقامة.",
    waitingTitle: "الحساب في انتظار المصادقة",
    waitingBody:
      "تم إنشاء حسابك بنجاح. يجب الآن التحقق منه من قبل مسؤول عمارتك (أو أحد المديرين).",
    step1: "اكتمل التسجيل العام",
    step2: "التحقق من الهوية من قبل مسؤول العمارة (لوحة التحكم).",
    step3: "حالة نشط — وصول كامل للأخبار والتصويت والتعليقات.",
    blockedTitle: "الحساب محجوب",
    blockedBody:
      "تم حجب حسابك من قبل الإشراف. تواصل مع رئيس الإقامة لأي شكوى.",
    invalidCredentials: "بيانات الدخول غير صحيحة.",
    accountBlocked:
      "حسابك محجوب. تواصل مع رئيس الإقامة لمزيد من المعلومات.",
  },
  feed: {
    title: "آخر الأخبار",
    subtitle: "المنشورات المصادق عليها الظاهرة في نطاقك.",
    filterAll: "الكل",
    filterResidence: "🏘️ الإقامة",
    filterGroup: "🏢 مجموعتي",
    filterBuilding: "🏠 عمارتي",
    empty: "لا توجد منشورات حالياً",
    emptyDesc: "ستظهر هنا المنشورات المصادق عليها لإقامتك أو مجموعتك أو عمارتك.",
    pendingHint: "المحتوى قيد المصادقة يظهر في لوحة التحكم الخاصة بك.",
    hereLink: "لوحة التحكم",
  },
  dashboard: {
    badge: "لوحة التحكم",
    hello: "مرحباً",
    newPublication: "📝 منشور جديد",
    perimeter: "النطاق",
    statsActive: "حسابات نشطة",
    statsPending: "في الانتظار",
    statsBlocked: "محجوبة",
    statsPublished: "منشورات منشورة",
    statsValidation: "قيد المصادقة",
    statsReports: "إشعارات بلاغ مفتوحة",
    accountsToValidate: "🪪 حسابات المالكين للمصادقة",
    accountsToValidateEmpty: "لا توجد حسابات في الانتظار",
    accountsToValidateEmptyDesc: "تمت معالجة جميع طلبات التسجيل.",
    pending: "في الانتظار",
    scrutins: "🗳️ التصويتات والمصادقات الجارية",
    scrutinsEmpty: "لا يوجد تصويت في الانتظار",
    scrutinsEmptyDesc:
      "ستظهر هنا المنشورات المقدمة لتصويت المسؤولين حتى صدور قرارهم أو انتهاء المهلة.",
    vote: "تصويت",
    moderation: "🚩 قائمة الإشراف",
    moderationEmpty: "لا توجد بلاغات في نطاقك",
    moderationEmptyDesc: "ستظهر هنا المحتويات المُبلّغ عنها من أعضاء المجتمع.",
    reportsCount: "بلاغ/بلاغات",
    reportedBy: "أبلغ عنه",
    reason: "السبب",
    examine: "فحص",
    userManagement: "👥 إدارة المستخدمين",
    roleAssigned: "الدور الممنوح",
    membersPerimeter: "أعضاء نطاقي",
    noMembers: "لا يوجد أعضاء نشطون في نطاقك",
    configTitle: "⚙️ الإعدادات العامة",
    configSubtitle: "مهلات المصادقة وعتبات الإشراف",
    recentPubs: "📰 آخر المنشورات",
    nothingToShow: "لا يوجد ما يُعرض حالياً",
    by: "بواسطة",
  },
  pub: {
    newTitle: "📝 منشور جديد",
    type: "نوع المنشور",
    typeText: "📝 نص",
    typeFile: "📎 ملف (PDF / صورة / ZIP)",
    typeTask: "📅 مهمة / حدث",
    title: "العنوان",
    titlePlaceholder: "عنوان المنشور",
    content: "المحتوى",
    contentPlaceholder: "صف منشورك…",
    fileLabel: "ملف مرفق (PDF أو صورة أو ملف ZIP، بحد أقصى 20 ميغابايت)",
    fileHint:
      "💡 استخدم ملف ZIP لتجميع عدة مستندات (صور، PDF، مخططات…) في مرفق واحد قابل للتنزيل.",
    eventDate: "تاريخ الحدث / الموعد النهائي",
    scope: "النطاق",
    targetGh: "مجموعة السكن",
    targetBuilding: "العمارة",
    publish: "نشر",
    immediatePublish: "✅ نشر في نطاقك: مصادقة فورية ونشر تلقائي.",
    presidentialPublish: "✅ نشر رئاسي: مصادقة فورية ونشر تلقائي.",
    voteRequired: "⏳ سيُعرض هذا المنشور على تصويت المسؤولين",
    voteRequiredResidence:
      "(12 مسؤول مجموعة + الرئيس، الأغلبية المطلقة 8 أصوات من 14)",
    voteRequiredGroup: "(بقية مسؤولي العمارات في المجموعة + مسؤول المجموعة)",
    autoValidateSuffix:
      "في حال عدم وجود رفض بالأغلبية خلال المهلة المحددة، سيتم قبوله تلقائياً.",
    votePanel: "🗳️ تصويت المصادقة",
    noDeadline: "بدون مهلة",
    approve: "✅ موافقة",
    reject: "❌ رفض",
    approvedLabel: "✅ تمت الموافقة",
    rejectedLabel: "❌ تم الرفض",
    voteRecorded: "تم تسجيل التصويت",
    voteChangeAllowed: "يمكنك تغيير تصويتك حتى إغلاق الاقتراع.",
    onlyManagersVote: "المسؤولون المعنيون بهذا الاقتراع فقط هم من يمكنهم التصويت.",
    comments: "💬 التعليقات",
    writeComment: "اكتب تعليقاً… (يظهر فوراً)",
    comment: "تعليق",
    noComments: "لا توجد تعليقات حتى الآن. كن أول من يتفاعل!",
    commentsClosed: "ستُفتح التعليقات بعد مصادقة هذا المنشور ونشره.",
    commentHidden: "تعليق محجوب",
    report: "إبلاغ",
    reportTitle: "الإبلاغ عن هذا المحتوى",
    reportReason: "سبب البلاغ",
    reportDetails: "توضيحات (اختياري)",
    reportDetailsPlaceholder: "صف المشكلة…",
    sendReport: "إرسال البلاغ",
    moderation: "الإشراف",
    blockPublication: "🚫 حجب هذا المنشور",
    restorePublication: "✅ استعادة المنشور",
    blockDefinitely: "حجب نهائياً",
    manualApprove: "✅ مصادقة يدوية",
    manualReject: "⛔ رفض يدوي",
    blockComment: "حجب",
    restoreComment: "استعادة",
    justification: "التبرير",
    justificationVisible: "التبرير (يظهر للمؤلف)",
    justificationPlaceholder: "سبب الحجب…",
    block: "حجب",
    statusLabel: "الحالة",
    contentUnavailable: "المحتوى غير متاح",
    contentUnavailableDesc:
      "هذا المنشور خارج نطاقك، أو قيد المصادقة، أو تم سحبه من قبل الإشراف.",
    openReports: "بلاغ/بلاغات مفتوحة",
  },
  roles: {
    admin: "مدير النظام",
    president: "الرئيس",
    gh_manager: "مسؤول المجموعة",
    building_manager: "مسؤول العمارة",
    owner: "مالك",
  },
  userStatus: {
    provisoire: "في انتظار المصادقة",
    actif: "نشط",
    bloque: "محجوب",
  },
  pubStatus: {
    en_validation: "قيد المصادقة",
    publiee: "منشور",
    rejetee: "مرفوض",
    masquee: "محجوب (بلاغات)",
    bloquee: "محجوب",
  },
  scopes: {
    residence: "الإقامة",
    groupe: "المجموعة",
    immeuble: "العمارة",
  },

  settings: {
    delayLabel: "مهلة المصادقة (ساعات)",
    delayHelp: "بعد هذه المهلة، يُقبل المنشور تلقائياً إذا لم يُرفض بالأغلبية.",
    thresholdLabel: "عتبة البلاغات (حجب تلقائي)",
    save: "حفظ الإعدادات",
    saved: "تم حفظ الإعدادات ✅",
  },
  roleManager: {
    owner: "مالك",
    building_manager: "مسؤول عمارة",
    gh_manager: "مسؤول مجموعة",
    president: "الرئيس",
  },
  profile: {
    title: "ملفي الشخصي",
    editTitle: "تعديل معلوماتي",
    changePassword: "تغيير كلمة المرور",
    currentPassword: "كلمة المرور الحالية",
    newPassword: "كلمة المرور الجديدة",
    passwordOptional: "اترك هذه الحقول فارغة إذا لم ترغب في تغيير كلمة المرور.",
    updated: "تم تحديث الملف الشخصي ✅",
  },
  admin: {
    section: "🛡️ إدارة النظام",
    title: "التحكم في التطبيق",
    subtitle:
      "يتحكم مدير النظام في جميع تعديلات التطبيق ويُنشئ حسابات الإقامة.",
    createAccount: "➕ إنشاء حساب",
    createAccountSubtitle: "أنشئ يدوياً الرئيس والمسؤولين (مرحلة التهيئة).",
    resetPassword: "🔑 إعادة تعيين كلمة مرور",
    resetPasswordSubtitle: "حدد كلمة مرور جديدة لمستخدم، بناءً على طلبه.",
    appLock: "🔒 القفل الشامل للتعديلات",
    appLockHelp:
      "عند تفعيل القفل، لا يُقبل أي تعديل (منشورات، تصويت، تعليقات، بلاغات، إشراف) — مدير النظام فقط من يمكنه التصرف.",
    lockOn: "قفل التطبيق",
    lockOff: "إلغاء قفل التطبيق",
    lockActive: "التطبيق مقفل — التعديلات محجوبة",
    auditLog: "📜 سجل التدقيق",
    auditEmpty: "لم يتم تسجيل أي إجراء حتى الآن.",
    actor: "المنفّذ",
    action: "الإجراء",
    target: "الهدف",
    details: "التفاصيل",
    date: "التاريخ",
    newPassword: "كلمة المرور الجديدة",
    generatePassword: "توليد تلقائي",
    passwordGenerated: "كلمة المرور المُولّدة",
    copyWarning: "دوّن كلمة المرور الآن: لن تُعرض مرة أخرى.",
    accountCreated: "تم إنشاء الحساب",
    role: "الدور",
    chooseRole: "اختر دوراً",
    createdBy: "أنشأه مدير النظام",
    allAccounts: "جميع الحسابات",
  },
  errors: {
    appLocked:
      "التطبيق مقفل حالياً من قبل مدير النظام: لا يمكن إجراء أي تعديل.",
    forbidden: "غير مصرح لك بتنفيذ هذا الإجراء.",
  },
  branding: {
    section: "🏷️ هوية الإقامة",
    title: "الاسم والشعار",
    subtitle: "يظهر الاسم والشعار في رأس جميع الصفحات، باللغتين.",
    nameFr: "اسم الإقامة (بالفرنسية)",
    nameAr: "اسم الإقامة (بالعربية)",
    logo: "الشعار",
    logoHint:
      "PNG أو JPG أو WEBP أو SVG — يُفضل مربعاً (بحد أقصى 2 ميغابايت). اتركه فارغاً للاحتفاظ بالأيقونة الافتراضية 🏘️.",
    uploadLogo: "اختيار ملف…",
    removeLogo: "حذف الشعار",
    saved: "تم حفظ الهوية ✅",
    preview: "معاينة",
  },
  forcePassword: {
    title: "تغيير كلمة المرور مطلوب",
    subtitle:
      "كلمة المرور الحالية مؤقتة: حددها مدير النظام. اختر كلمة مرور خاصة بك للمتابعة.",
    current: "كلمة المرور المؤقتة",
    newLabel: "كلمة المرور الجديدة",
    confirm: "تأكيد كلمة المرور الجديدة",
    submit: "تعيين كلمة المرور",
    success: "تم تعيين كلمة المرور ✅",
    mismatch: "كلمتا المرور غير متطابقتين.",
    tooShort: "يجب أن تحتوي كلمة المرور على 8 أحرف على الأقل.",
    sameAsOld: "يجب أن تكون كلمة المرور الجديدة مختلفة عن المؤقتة.",
    banner: "🔑 أنت تستخدم كلمة مرور مؤقتة. يجب تغييرها قبل المتابعة.",
    provisional: "كلمة مرور مؤقتة — يجب تغييرها عند أول تسجيل دخول",
    provisionalHint:
      "ستُعلَّم كلمة المرور كمؤقتة: سيتعين على المستخدم استبدالها بكلمة مرور خاصة به عند أول دخول.",
    provisionalToggle: "كلمة مرور مؤقتة (تغيير إلزامي عند أول دخول)",
    unlock: "إلغاء حجب وصول هذا الحساب",
    unlockHint:
      "استخدم هذا إذا بقي حساب محجوباً على شاشة تغيير كلمة المرور أو فقدت كلمة مروره.",
    unlockDone: "تم إلغاء حجب الوصول ✅",
    pendingBadge: "كلمة مرور مؤقتة في الانتظار",
  },
  batch: {
    title: "👥 إنشاء جماعي",
    subtitle:
      "أنشئ عدة حسابات دفعة واحدة (سطر لكل شخص). تُفرض كلمة مرور مؤقتة على كل حساب يتم إنشاؤه.",
    lines: "الحسابات المطلوب إنشاؤها (سطر لكل شخص)",
    linesPlaceholder: "الاسم الشخصي ; الاسم العائلي ; البريد ; الهاتف\nمثال:\nأمين ; بناني ; amine@exemple.fr ; +212 6 12 34 56 78",
    linesHelp: "الصيغة المقبولة: الاسم الشخصي ; الاسم العائلي ; البريد ; الهاتف (اختياري). الفواصل: ; , | أو Tab.",
    submit: "إنشاء الحسابات",
    created: "الحسابات المُنشأة",
    failed: "الأسطر المتجاهلة",
    passwordShared: "كلمة مرور مشتركة للدفعة (اختياري)",
    passwordSharedHelp:
      "اتركها فارغة لتوليد كلمة مرور فريدة لكل حساب. ⚠️ في جميع الحالات، سيتعين على كل مستخدم تغيير كلمة مروره عند أول تسجيل دخول.",
    mandatoryNotice:
      "🔑 قاعدة: بعد أي إنشاء (فردي أو جماعي)، يكون تغيير كلمة المرور إلزامياً عند أول تسجيل دخول.",
    count: "حساب/حسابات تم إنشاؤها",
    noLine: "لا يوجد سطر صالح.",
  },
  manage: {
    section: "🧹 إدارة الحسابات والمحتوى",
    selected: "محدد",
    selectAll: "تحديد الكل",
    batchActions: "إجراءات جماعية",
    archive: "🗄️ أرشفة",
    archiveAndDelete: "🗄️ أرشفة ثم حذف",
    delete: "🗑️ حذف",
    deleteSelected: "🗑️ حذف المحدد",
    confirmDeleteUsers:
      "حذف الحسابات المحددة نهائياً؟ ستُحذف أيضاً جميع منشوراتها وتعليقاتها وأصواتها. إجراء لا يمكن التراجع عنه.",
    confirmArchiveAndDelete:
      "سيتم إنشاء أرشيف ZIP كامل، ثم حذف الحسابات. هل تريد المتابعة؟",
    confirmDeleteUser: "حذف هذا الحساب وكل محتواه نهائياً؟ إجراء لا يمكن التراجع عنه.",
    archiveUser: "🗄️ أرشفة",
    deleteUser: "🗑️",
    archives: "🗄️ الأرشيفات المُنشأة",
    archivesEmpty: "لم يتم إنشاء أي أرشيف حتى الآن.",
    archivesHint:
      "يُحذف كل أرشيف ZIP (الملف الشخصي، المنشورات، التعليقات، الأصوات) تلقائياً من الخادم بعد تنزيله.",
    download: "⬇️ تنزيل",
    size: "الحجم",
    pendingDownload: "في انتظار التنزيل",
    downloaded: "تم التنزيل",
    archiveCreated: "تم إنشاء الأرشيف ✅",
    deleted: "تم الحذف ✅",
    deletePublication: "🗑️ حذف المنشور",
    archivePublication: "🗄️ أرشفة",
    deleteComment: "🗑️ حذف",
    archiveComment: "🗄️ أرشفة",
    confirmDeletePublication:
      "حذف هذا المنشور نهائياً مع جميع تعليقاته وأصواته وبلاغاته؟",
    moderationActions: "إجراءات",
    noReports: "لا توجد بلاغات لمعالجتها.",
    protectAdmin: "لا يمكن حذف حسابات مدير النظام.",
    protectedSelf: "لا يمكنك حذف حسابك الخاص.",
  },
  weights: {
    section: "⚖️ أوزان الأصوات",
    title: "مضاعفات الأصوات",
    subtitle:
      "حدد عدد الأصوات الممنوح لكل دور. تُعاد حساب أغلبيات التصويت تلقائياً.",
    president: "الرئيس",
    gh_manager: "مسؤول المجموعة",
    building_manager: "مسؤول العمارة",
    owner: "المالك (أصوات الاستطلاع)",
    admin: "مدير النظام",
    hint: "عدد صحيح من 0 إلى 100. أمثلة: الرئيس = 2 (صوت مزدوج)، مسؤول المجموعة = 1.",
    warning:
      "⚠️ لا يمكن أن يكون الرئيس ومسؤول المجموعة كلاهما 0: لن يمكن إنجاز أي تصويت على مستوى الإقامة.",
    groupContext:
      "في المصادقة على مجموعته الخاصة، يحصل مسؤول المجموعة على الوزن الأعلى بين وزنه ووزن الرئيس.",
    saved: "تم حفظ أوزان الأصوات ✅",
    current: "الإعداد الحالي",
    residenceExample: "تصويت الإقامة",
    groupExample: "تصويت المجموعة",
  },
  pubTypes: {
    section: "📝 أنواع المنشورات",
    title: "تفعيل / تعطيل الأنواع",
    subtitle: "أزل تحديد نوع لكي لا يظهر بعد ذلك في نموذج الإنشاء.",
    texte: "نص",
    fichier: "ملف (PDF / صورة / ZIP)",
    tache_evenement: "مهمة / حدث",
    sondage: "استطلاع",
    saved: "تم حفظ أنواع المنشورات ✅",
    disabledNotice: "تم تعطيل هذا النوع من قبل مدير النظام.",
  },
  ownPassword: {
    title: "🔑 كلمة المرور الخاصة بي",
    subtitle: "غيّر كلمة مرورك فوراً لجلستك القادمة.",
    current: "كلمة المرور الحالية",
    newPassword: "كلمة المرور الجديدة",
    confirm: "تأكيد كلمة المرور الجديدة",
    submit: "تغيير كلمة المرور",
    saved: "تم تغيير كلمة المرور ✅ وستُستخدم في تسجيل دخولك القادم.",
    hint: "يسري التغيير فوراً ولا يُبطل جلستك الحالية.",
  },
  poll: {
    type: "📊 استطلاع",
    options: "الخيارات المقترحة",
    optionPlaceholder: "خيار",
    addOption: "➕ إضافة خيار",
    removeOption: "حذف",
    multiple: "السماح بخيارات متعددة",
    multipleHint: "وإلا، يمكن لكل مشارك اختيار خيار واحد فقط.",
    endsAt: "تاريخ الإغلاق (اختياري)",
    needTwo: "يلزم خياران مختلفان على الأقل.",
    participate: "المشاركة في الاستطلاع",
    myVote: "اختياري",
    changeVote: "تعديل اختياري",
    results: "النتائج",
    votes: "صوت/أصوات",
    participants: "مشارك/مشاركون",
    closed: "أُغلق الاستطلاع",
    open: "الاستطلاع مفتوح",
    noOptions: "لم تُحدد أي خيارات.",
    yourChoice: "اختيارك",
    submitVote: "تصويت",
    voted: "تم تسجيل صوتك ✅",
    allMembers: "يمكن لجميع الأعضاء النشطين المشاركة، بما في ذلك المالكون.",
    percent: "من الأصوات",
  },
  hierarchy: {
    title: "⚖️ تراتبية الصلاحيات",
    subtitle:
      "كل مسؤول يمكنه الإنشاء والحذف فقط داخل نطاقه، وفقط لحسابات من رتبة أدنى.",
    yourPowers: "صلاحياتك",
    canCreate: "يمكنك إنشاء",
    canDelete: "يمكنك حذف / إدارة",
    yourScope: "نطاقك",
    rank: "ترتيب المسؤولية",
    rankList: "مدير النظام > الرئيس > مسؤول المجموعة > مسؤول العمارة > المالك",
    immune: "لا يمكن حذف مدير النظام أو تعديله من قبل أي أحد.",
    ownerRule:
      "يمكن للمالكين فقط إنشاء حسابهم الخاص، مؤقتاً، في انتظار مصادقة مسؤول عمارتهم.",
    residence: "كل الإقامة",
    yourGroup: "مجموعتك",
    yourBuilding: "عمارتك",
    nothing: "لا صلاحيات إدارة",
    selfRegister: "إنشاء حسابه الخاص فقط (مؤقت)",
  },
  userInfo: {
    title: "حسابي",
    welcome: "مرحباً",
    role: "الدور",
    status: "الحالة",
    location: "الموقع",
    viewProfile: "عرض ملفي الشخصي",
    connectedAs: "متصل بصفتك",
  },
};

export const dictionaries: Record<Locale, Dictionary> = { fr, ar };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE];
}

/* ------------------------------------------------------------------ */
/* Helpers de libellés (remplacent les anciennes maps statiques FR)    */
/* ------------------------------------------------------------------ */

export function roleLabel(d: Dictionary, role: string): string {
  return (d.roles as Record<string, string>)[role] ?? role;
}

export function userStatusLabel(d: Dictionary, status: string): string {
  return (d.userStatus as Record<string, string>)[status] ?? status;
}

export function pubStatusLabel(d: Dictionary, status: string): string {
  return (d.pubStatus as Record<string, string>)[status] ?? status;
}

export function scopeLabel(d: Dictionary, scope: string): string {
  return (d.scopes as Record<string, string>)[scope] ?? scope;
}

export function pubTypeLabel(d: Dictionary, type: string): string {
  return (d.pubTypes as Record<string, string>)[type] ?? type;
}

export function reportReasonLabel(reason: string): string {
  const key = reason.split(" — ")[0];
  const map: Record<string, { fr: string; ar: string }> = {
    spam: { fr: "Spam ou publicité", ar: "رسائل مزعجة أو إعلانات" },
    abusif: { fr: "Contenu abusif ou haineux", ar: "محتوى مسيء أو كراهية" },
    hors_sujet: { fr: "Hors sujet", ar: "خارج الموضوع" },
    desinformation: { fr: "Désinformation", ar: "تضليل" },
    autre: { fr: "Autre", ar: "أخرى" },
  };
  return map[key]?.fr ?? reason;
}

export const REPORT_REASONS_I18N = [
  { value: "spam", fr: "Spam ou publicité", ar: "رسائل مزعجة أو إعلانات" },
  { value: "abusif", fr: "Contenu abusif ou haineux", ar: "محتوى مسيء أو كراهية" },
  { value: "hors_sujet", fr: "Hors sujet", ar: "خارج الموضوع" },
  { value: "desinformation", fr: "Désinformation", ar: "تضليل" },
  { value: "autre", fr: "Autre", ar: "أخرى" },
] as const;
