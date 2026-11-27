// ============================================================
// CONFIGURATION FIREBASE & CLOUDINARY
// ============================================================
const firebaseConfig = {
  apiKey: "AIzaSyDrz5hriNQabvBBYcjWTEQN0uPzGdS3GoQ",
  authDomain: "anne-sophie-studio.firebaseapp.com",
  projectId: "anne-sophie-studio",
  storageBucket: "anne-sophie-studio.firebasestorage.app",
  messagingSenderId: "82588723051",
  appId: "1:82588723051:web:0268c39460e08fc3af8e2e"
};

// Ancien projet Firebase (utilisé uniquement pour "Importer ancien compte")
const legacyFirebaseConfig = {
  apiKey: "AIzaSyAW2-LNY0BwYGLL4QtVyx-GDgehNGwanrk",
  authDomain: "my-budget-7f064.firebaseapp.com",
  projectId: "my-budget-7f064",
  storageBucket: "my-budget-7f064.firebasestorage.app",
  messagingSenderId: "920185528208",
  appId: "1:920185528208:web:5144375fdb938bbc2ddd15"
};

const CLOUDINARY_CLOUD_NAME = "flj4ecvc";
const CLOUDINARY_UPLOAD_PRESET = "studio_photos";
const CLOUDINARY_FOLDER = "anne_sophie_studio";

firebase.initializeApp(firebaseConfig);
const dbFirestore = firebase.firestore();

// Cache hors-ligne natif (IndexedDB)
dbFirestore.enablePersistence({ synchronizeTabs: true }).catch((err) => {
  console.warn("Persistance hors-ligne Firestore :", err.code);
});

// ============================================================
// CONSTANTES & RÉFÉRENTIELS
// ============================================================
const COL_POSTS = "studio_posts";
const COL_PROJECTS = "studio_projects";
const COL_TASKS = "studio_tasks";
const COL_MEDIA = "studio_media";
const COL_META = "studio_meta";
const META_DOC_ID = "config";
const SCHEMA_VERSION = 3;
const STORAGE_KEY = "as_studio_cache_v3";

const VALID_FORMATS = ["Carrousel", "Reel", "Story"];
const VALID_PILIERS = ["Pédagogie", "Coulisses", "Offre / Produit", "Preuve sociale"];
const VALID_STATUTS = ["Idée", "Préparation", "Validé", "Programmé", "Publié"];

const POST_CHECKLIST_STEPS = [
  { key: "date_validee", label: "Date de publication validée" },
  { key: "heure_validee", label: "Heure de publication validée" },
  { key: "idees_visuels", label: "Idées des visuels" },
  { key: "visuels_definitifs", label: "Visuels définitifs" },
  { key: "idees_texte", label: "Idées du texte" },
  { key: "texte_definitif", label: "Texte définitif" },
  { key: "cta_hashtag", label: "CTA / engagement et hashtag" },
  { key: "post_programme", label: "Post programmé à être publié" }
];

const FORMAT_EMOJI = {
  "Story": "✏️",
  "Carrousel": "🎠",
  "Reel": "🎥"
};

const PROJECT_STATUSES = [
  { key: "a_demarrer", label: "Projets à démarrer", kpiClass: "kpi-red" },
  { key: "en_cours", label: "Projets en cours", kpiClass: "kpi-yellow" },
  { key: "finalise", label: "Projets finalisés", kpiClass: "kpi-blue" },
  { key: "envoye", label: "Projets envoyés aux maisons d'éditions", kpiClass: "kpi-lightgreen" },
  { key: "edite", label: "Projets édités", kpiClass: "kpi-darkgreen" }
];

const PROJECT_GROUP_ORDER = ["en_cours", "a_demarrer", "finalise", "envoye", "edite"];

const RECURRENCE_LABELS = {
  none: "Ponctuelle",
  daily: "Tous les jours",
  weekly: "Chaque semaine",
  monthly: "Chaque mois"
};

const STICKER_META = {
  lieu: { label: "📍 Lieu", placeholder: "Ex. Paris, France" },
  mention: { label: "@ Mention", placeholder: "Ex. @editions_jeunesse" },
  musique: { label: "🎵 Musique", placeholder: "Titre du morceau", placeholder2: "Artiste" },
  sondage: { label: "📊 Sondage", placeholder: "Question du sondage", placeholder2: "Option 1", placeholder3: "Option 2" },
  lien: { label: "🔗 Lien", placeholder: "Texte du bouton (ex. Voir l'album)", placeholder2: "https://..." },
  hashtag: { label: "# Hashtag", placeholder: "Ex. #illustrationjeunesse" },
  curseur: { label: "😍 Curseur", placeholder: "Question du curseur", placeholder2: "Emoji (ex. 😍)" },
  compte_a_rebours: { label: "⏳ Compte à rebours", placeholder: "Nom de l'événement", placeholder2: "Date / heure (ex. 15/12 à 18h)" }
};

// ============================================================
// UTILITAIRES GÉNÉRAUX & NORMALISATION
// ============================================================
function setSyncStatus(mode, text) {
  const el = document.getElementById("cloudSyncStatus");
  if (!el) return;
  el.className = "sync-pill" + (mode === "syncing" ? " syncing" : mode === "error" ? " error" : "");
  el.textContent = text;
}

function showToast(msg) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 3200);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getFormatEmoji(format) {
  return FORMAT_EMOJI[format] || "🎠";
}

function getTodayIso() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `\${y}-${m}-${d}`;
}

function isPostOverdue(post) {
  if (!post || post.statut === "Publié" || !post.date) return false;
  const timeStr = post.time && /^\d{2}:\d{2}/.test(post.time) ? post.time.slice(0, 5) : "23:59";
  const scheduled = new Date(`${post.date}T${timeStr}:00`);
  if (Number.isNaN(scheduled.getTime())) return false;
  return scheduled.getTime() < Date.now();
}

function getStatusColorClass(post) {
  if (isPostOverdue(post)) return "st-retard";
  switch (post?.statut) {
    case "Idée": return "st-idee";
    case "Préparation": return "st-prepa";
    case "Validé": return "st-valide";
    case "Programmé": return "st-programme";
    case "Publié": return "st-publie";
    default: return "st-idee";
  }
}

function getStatusDisplayLabel(post) {
  if (isPostOverdue(post)) {
    return `En retard (\${post.statut})`;
  }
  return post?.statut || "Idée";
}

function createEmptyChecklist() {
  const cl = {};
  POST_CHECKLIST_STEPS.forEach((step) => {
    cl[step.key] = false;
  });
  return cl;
}

function normalizeChecklist(raw) {
  const cl = createEmptyChecklist();
  if (raw && typeof raw === "object") {
    POST_CHECKLIST_STEPS.forEach((step) => {
      cl[step.key] = Boolean(raw[step.key]);
    });
  }
  return cl;
}

function computeChecklistProgress(checklist) {
  const normalized = normalizeChecklist(checklist);
  const total = POST_CHECKLIST_STEPS.length;
  const done = POST_CHECKLIST_STEPS.filter((s) => normalized[s.key]).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return { done, total, pct };
}

function createEmptySlide(mediaId = "", text = "", stickers = []) {
  return {
    id: "sl_" + Date.now() + "_" + Math.floor(Math.random() * 10000),
    mediaId: mediaId || "",
    text: text || "",
    stickers: Array.isArray(stickers) ? structuredClone(stickers) : []
  };
}

function createEmptyProjectItem(text = "", illusStatus = "a_demarrer", textStatus = "a_demarrer") {
  return {
    id: "item_" + Date.now() + "_" + Math.floor(Math.random() * 10000),
    imageSrc: "",
    illusStatus,
    text,
    textStatus
  };
}

function computeProjectProgress(project) {
  const items = Array.isArray(project?.items) ? project.items : [];
  if (!items.length) return Number(project?.progress) || 0;
  const scoreMap = { a_demarrer: 0, en_cours: 0.5, finalise: 1 };
  let totalScore = 0;
  items.forEach((it) => {
    totalScore += scoreMap[it.illusStatus] ?? 0;
    totalScore += scoreMap[it.textStatus] ?? 0;
  });
  return Math.round((totalScore / (items.length * 2)) * 100);
}

function computeEngagementRate(st) {
  const reach = Number(st.reach) || 0;
  if (reach <= 0) return "0.0%";
  const interactions =
    (Number(st.likes) || 0) +
    (Number(st.comments) || 0) +
    (Number(st.saves) || 0) +
    (Number(st.shares) || 0);
  return ((interactions / reach) * 100).toFixed(1) + "%";
}

function normalizeStats(s) {
  return {
    reach: Number(s?.reach) || 0,
    likes: Number(s?.likes) || 0,
    comments: Number(s?.comments) || 0,
    saves: Number(s?.saves) || 0,
    shares: Number(s?.shares) || 0,
    clicks: Number(s?.clicks) || 0
  };
}

function normalizeFormat(fmt) {
  return VALID_FORMATS.includes(fmt) ? fmt : "Carrousel";
}

function normalizeSlides(p) {
  if (Array.isArray(p?.slides) && p.slides.length > 0) {
    return p.slides.map((sl, idx) => ({
      id: sl.id || `sl_${p.id \vert{}\vert{} "x"}_${
