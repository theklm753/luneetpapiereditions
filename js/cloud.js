// ============================================================
// SAUVEGARDE DÉCOUPÉE DANS FIRESTORE (1 DOC = 1 ÉLÉMENT)
// ============================================================
async function savePostToCloud(post) {
  saveLocalCache();
  setSyncStatus("syncing", "⏳ Enregistrement...");
  try {
    const payload = cleanForFirestore({ ...normalizePost(post), updatedAt: new Date().toISOString() });
    await dbFirestore.collection(COL_POSTS).doc(payload.id).set(payload, { merge: true });
    setSyncStatus("ok", "☁️ Synchronisé");
  } catch (err) {
    console.error("Erreur sauvegarde post :", err);
    setSyncStatus("error", "⚠️ Erreur sync");
    showToast("Erreur lors de la sauvegarde Cloud du post");
  }
}

async function deletePostFromCloud(postId) {
  saveLocalCache();
  setSyncStatus("syncing", "⏳ Suppression...");
  try {
    await dbFirestore.collection(COL_POSTS).doc(postId).delete();
    setSyncStatus("ok", "☁️ Synchronisé");
  } catch (err) {
    console.error("Erreur suppression post :", err);
    setSyncStatus("error", "⚠️ Erreur sync");
  }
}

async function saveProjectToCloud(project) {
  saveLocalCache();
  setSyncStatus("syncing", "⏳ Enregistrement...");
  try {
    const payload = cleanForFirestore({ ...normalizeProject(project), updatedAt: new Date().toISOString() });
    await dbFirestore.collection(COL_PROJECTS).doc(payload.id).set(payload, { merge: true });
    setSyncStatus("ok", "☁️ Synchronisé");
  } catch (err) {
    console.error("Erreur sauvegarde projet :", err);
    setSyncStatus("error", "⚠️ Erreur sync");
    showToast("Erreur lors de la sauvegarde Cloud du projet");
  }
}

async function deleteProjectFromCloud(projectId) {
  saveLocalCache();
  setSyncStatus("syncing", "⏳ Suppression...");
  try {
    await dbFirestore.collection(COL_PROJECTS).doc(projectId).delete();
    setSyncStatus("ok", "☁️ Synchronisé");
  } catch (err) {
    console.error("Erreur suppression projet :", err);
    setSyncStatus("error", "⚠️ Erreur sync");
  }
}

async function saveTaskToCloud(task) {
  saveLocalCache();
  setSyncStatus("syncing", "⏳ Enregistrement...");
  try {
    const payload = cleanForFirestore({ ...normalizeTask(task), updatedAt: new Date().toISOString() });
    await dbFirestore.collection(COL_TASKS).doc(payload.id).set(payload, { merge: true });
    setSyncStatus("ok", "☁️ Synchronisé");
  } catch (err) {
    console.error("Erreur sauvegarde tâche :", err);
    setSyncStatus("error", "⚠️ Erreur sync");
    showToast("Erreur lors de la sauvegarde Cloud de la tâche");
  }
}

async function deleteTaskFromCloud(taskId) {
  saveLocalCache();
  setSyncStatus("syncing", "⏳ Suppression...");
  try {
    await dbFirestore.collection(COL_TASKS).doc(taskId).delete();
    setSyncStatus("ok", "☁️ Synchronisé");
  } catch (err) {
    console.error("Erreur suppression tâche :", err);
    setSyncStatus("error", "⚠️ Erreur sync");
  }
}

async function saveMediaToCloud(mediaItem) {
  saveLocalCache();
  try {
    const payload = cleanForFirestore({ ...normalizeMediaItem(mediaItem), updatedAt: new Date().toISOString() });
    await dbFirestore.collection(COL_MEDIA).doc(payload.id).set(payload, { merge: true });
  } catch (err) {
    console.error("Erreur sauvegarde média :", err);
  }
}

async function saveMetaToCloud() {
  saveLocalCache();
  try {
    await dbFirestore.collection(COL_META).doc(META_DOC_ID).set({
      completedAutoTasks: state.completedAutoTasks || [],
      pillars: normalizePillars(state.pillars),
      followersHistory: normalizeFollowersHistory(state.followersHistory),
      schemaVersion: SCHEMA_VERSION,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (err) {
    console.error("Erreur sauvegarde meta :", err);
  }
}

// ============================================================
// SYNCHRONISATION TEMPS RÉEL (PC <-> TÉLÉPHONE)
// ============================================================
function startRealtimeSync() {
  setSyncStatus("syncing", "⏳ Connexion Cloud...");

  dbFirestore.collection(COL_POSTS).onSnapshot((snap) => {
    state.posts = snap.docs.map((d) => normalizePost({ id: d.id, ...d.data() }));
    saveLocalCache();
    setSyncStatus("ok", "☁️ Synchronisé");

    const isEditingPost = document.getElementById("tab-preparation").classList.contains("active");
    if (!isEditingPost) {
      renderPostsGrid();
      if (calendarViewMode === "month") renderCalendarMonthView();
    }
    if (typeof renderStatisticsSection === "function") {
      renderStatisticsSection();
    }
    renderDashboard();
  }, (err) => {
    console.error("Erreur sync posts :", err);
    setSyncStatus("error", "⚠️ Hors-ligne");
  });

  dbFirestore.collection(COL_PROJECTS).onSnapshot((snap) => {
    state.projects = snap.docs.map((d, i) => normalizeProject({ id: d.id, ...d.data() }, i));
    saveLocalCache();
    setSyncStatus("ok", "☁️ Synchronisé");

    const activeEl = document.activeElement;
    const isTypingProjectText = activeEl && activeEl.classList && activeEl.classList.contains("illus-text-area");
    if (!isTypingProjectText) {
      if (activeProjectId) {
        renderProjectDetail();
      } else {
        renderProjectsSection();
      }
    }
  }, (err) => {
    console.error("Erreur sync projets :", err);
  });

  dbFirestore.collection(COL_TASKS).onSnapshot((snap) => {
    state.tasks = snap.docs.map((d, i) => normalizeTask({ id: d.id, ...d.data() }, i));
    saveLocalCache();
    renderDashboard();
  }, (err) => {
    console.error("Erreur sync tâches :", err);
  });

  dbFirestore.collection(COL_MEDIA).onSnapshot((snap) => {
    state.media = snap.docs.map((d, i) => normalizeMediaItem({ id: d.id, ...d.data() }, i));
    saveLocalCache();
    const isEditingPost = document.getElementById("tab-preparation").classList.contains("active");
    if (!isEditingPost) {
      renderPostsGrid();
    } else {
      renderSlidesStrip();
      updateVisualIndicator();
      updateLivePreview();
    }
  }, (err) => {
    console.error("Erreur sync médias :", err);
  });

  dbFirestore.collection(COL_META).doc(META_DOC_ID).onSnapshot((doc) => {
    if (doc.exists) {
      const data = doc.data();
      state.completedAutoTasks = Array.isArray(data.completedAutoTasks) ? data.completedAutoTasks : [];
      state.pillars = normalizePillars(data.pillars);
      state.followersHistory = normalizeFollowersHistory(data.followersHistory);
      saveLocalCache();
      renderDashboard();
      if (typeof populatePillarSelects === "function") {
        populatePillarSelects();
      }
      renderPostsGrid();
      if (calendarViewMode === "month") renderCalendarMonthView();
      if (typeof renderStatisticsSection === "function") {
        renderStatisticsSection();
      }
    }
  });
}

// ============================================================
// ENVOI DES PHOTOS SUR CLOUDINARY & COMPRESSION
// ============================================================
function compressImageDataUrl(dataUrl, maxDim = 2400, quality = 0.88) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let w = img.width;
      let h = img.height;
      if (w > maxDim || h > maxDim) {
        if (w >= h) {
          h = Math.round((h * maxDim) / w);
          w = maxDim;
        } else {
          w = Math.round((w * maxDim) / h);
          h = maxDim;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);
      try {
        resolve(canvas.toDataURL("image/jpeg", quality));
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => resolve(ev.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function prepareFileForCloudinary(file) {
  if (file.size <= 9.5 * 1024 * 1024) return file;

  const dataUrl = await readFileAsDataUrl(file);
  const compressedUrl = await compressImageDataUrl(dataUrl, 2400, 0.88);
  const res = await fetch(compressedUrl);
  const blob = await res.blob();
  return new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" });
}

async function uploadFileToCloudinary(file) {
  const readyFile = await prepareFileForCloudinary(file);
  const formData = new FormData();
  formData.append("file", readyFile);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  formData.append("folder", CLOUDINARY_FOLDER);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/\${CLOUDINARY_CLOUD_NAME}/image/upload`,
    { method: "POST", body: formData }
  );
  if (!response.ok) {
    const errTxt = await response.text();
    throw new Error("Erreur Cloudinary : " + errTxt);
  }
  const data = await response.json();
  return data.secure_url;
}

async function uploadDataUrlToCloudinary(dataUrl) {
  const formData = new FormData();
  formData.append("file", dataUrl);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  formData.append("folder", CLOUDINARY_FOLDER);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, { method: "POST", body: formData } ); if (!response.ok) { throw new Error("Échec transfert image Cloudinary"); } const data = await response.json(); return data.secure_url; }  function isLargeBase64Image(src) { return typeof src === "string" && src.startsWith("data:image/") && !src.startsWith("data:image/svg+xml"); }  // ============================================================ // SAUVEGARDE / RESTAURATION JSON & MIGRATION ANCIEN FIREBASE // ============================================================ document.getElementById("btnExportJson").addEventListener("click", () => { const backup = { exportedAt: new Date().toISOString(), schemaVersion: SCHEMA_VERSION, ...state }; const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `sauvegarde-studio-${getTodayIso()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("Sauvegarde JSON téléchargée !");
});

document.getElementById("btnImportJson").addEventListener("click", () => {
  document.getElementById("importJsonInput").click();
});

document.getElementById("importJsonInput").addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (ev) => {
    try {
      const parsed = JSON.parse(ev.target.result);
      if (!confirm("Voulez-vous restaurer ces données dans votre Studio Cloud ? (Les éléments existants ayant un ID différent seront conservés.)")) {
        return;
      }
      setSyncStatus("syncing", "⏳ Restauration...");
      showToast("Restauration en cours...");

      const posts = Array.isArray(parsed.posts) ? parsed.posts.map(normalizePost) : [];
      const projects = Array.isArray(parsed.projects) ? parsed.projects.map(normalizeProject) : [];
      const tasks = Array.isArray(parsed.tasks) ? parsed.tasks.map(normalizeTask) : [];
      const media = Array.isArray(parsed.media) ? parsed.media.map(normalizeMediaItem) : [];

      for (const m of media) {
        if (isLargeBase64Image(m.src)) {
          try { m.src = await uploadDataUrlToCloudinary(m.src); } catch {}
        }
        await saveMediaToCloud(m);
      }
      for (const pr of projects) {
        for (const it of pr.items || []) {
          if (isLargeBase64Image(it.imageSrc)) {
            try { it.imageSrc = await uploadDataUrlToCloudinary(it.imageSrc); } catch {}
          }
        }
        await saveProjectToCloud(pr);
      }
      for (const p of posts) {
        await savePostToCloud(p);
      }
      for (const t of tasks) {
        await saveTaskToCloud(t);
      }
      if (Array.isArray(parsed.completedAutoTasks)) {
        state.completedAutoTasks = parsed.completedAutoTasks;
      }
      if (Array.isArray(parsed.pillars)) {
        state.pillars = normalizePillars(parsed.pillars);
      }
      if (parsed.followersHistory) {
        state.followersHistory = normalizeFollowersHistory(parsed.followersHistory);
      }
      await saveMetaToCloud();

      setSyncStatus("ok", "☁️ Synchronisé");
      showToast("Restauration terminée avec succès !");
    } catch (err) {
      console.error("Erreur restauration JSON :", err);
      setSyncStatus("error", "⚠️ Erreur");
      showToast("Fichier JSON invalide ou erreur de restauration.");
    } finally {
      e.target.value = "";
    }
  };
  reader.readAsText(file);
});

document.getElementById("btnMigrateLegacy").addEventListener("click", async () => {
  if (!confirm("Voulez-vous importer vos anciens posts, projets, tâches et photos depuis votre ancien projet Firebase (my-budget-7f064) vers votre nouveau Studio ?")) {
    return;
  }

  setSyncStatus("syncing", "⏳ Importation...");
  showToast("Récupération de vos anciennes données en cours...");

  try {
    let legacyApp = firebase.apps.find((a) => a.name === "legacyApp");
    if (!legacyApp) {
      legacyApp = firebase.initializeApp(legacyFirebaseConfig, "legacyApp");
    }
    const legacyDb = legacyApp.firestore();
    const docSnap = await legacyDb.collection("instagram_studio").doc("mon_compte").get();

    if (!docSnap.exists) {
      showToast("Aucune donnée trouvée dans l'ancien compte.");
      setSyncStatus("ok", "☁️ Synchronisé");
      return;
    }

    const oldData = docSnap.data() || {};
    const oldPosts = Array.isArray(oldData.posts) ? oldData.posts.map(normalizePost) : [];
    const oldProjects = Array.isArray(oldData.projects) ? oldData.projects.map(normalizeProject) : [];
    const oldTasks = Array.isArray(oldData.tasks) ? oldData.tasks.map(normalizeTask) : [];
    const oldMedia = Array.isArray(oldData.media) ? oldData.media.map(normalizeMediaItem) : [];

    for (const m of oldMedia) {
      if (isLargeBase64Image(m.src)) {
        try {
          m.src = await uploadDataUrlToCloudinary(m.src);
        } catch (e) {
          console.warn("Impossible de transférer une ancienne image média :", e);
        }
      }
      await saveMediaToCloud(m);
    }

    for (const pr of oldProjects) {
      for (const it of pr.items || []) {
        if (isLargeBase64Image(it.imageSrc)) {
          try {
            it.imageSrc = await uploadDataUrlToCloudinary(it.imageSrc);
          } catch (e) {
            console.warn("Impossible de transférer une illustration :", e);
          }
        }
      }
      await saveProjectToCloud(pr);
    }

    for (const p of oldPosts) {
      await savePostToCloud(p);
    }
    for (const t of oldTasks) {
      await saveTaskToCloud(t);
    }

    if (Array.isArray(oldData.completedAutoTasks)) {
      state.completedAutoTasks = Array.from(
        new Set([...(state.completedAutoTasks || []), ...oldData.completedAutoTasks])
      );
      await saveMetaToCloud();
    }

    setSyncStatus("ok", "☁️ Synchronisé");
    showToast(`Import réussi : \${oldPosts.length} post(s), ${oldProjects.length} projet(s),${oldTasks.length} tâche(s) !`);
  } catch (err) {
    console.error("Erreur migration ancien compte :", err);
    setSyncStatus("error", "⚠️ Erreur import");
    showToast("Erreur lors de l'importation depuis l'ancien compte.");
  }
});
