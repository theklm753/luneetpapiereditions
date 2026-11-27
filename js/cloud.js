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
