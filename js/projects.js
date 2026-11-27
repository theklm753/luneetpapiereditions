// ============================================================
// ÉTAT LOCAL PROJETS (CHRONOS, INSPIRATIONS, DRAG & DROP)
// ============================================================
let inspoFolderOpen = false;
let draggedIllusItemId = null;
let activeIllusModalItemId = null;
let timerIntervalId = null;
let projectTextSaveTimer = null;

function loadActiveTimer() {
  try {
    const raw = localStorage.getItem(ACTIVE_TIMER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.projectId && parsed.itemId && parsed.startedAt) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function saveActiveTimer(timerObj) {
  activeTimer = timerObj;
  try {
    if (timerObj) {
      localStorage.setItem(ACTIVE_TIMER_KEY, JSON.stringify(timerObj));
    } else {
      localStorage.removeItem(ACTIVE_TIMER_KEY);
    }
  } catch {}
}

let activeTimer = loadActiveTimer();

function getRunningElapsedSeconds(projectId, itemId) {
  if (!activeTimer) return 0;
  if (activeTimer.projectId !== projectId || activeTimer.itemId !== itemId) return 0;
  return Math.max(0, Math.floor((Date.now() - Number(activeTimer.startedAt)) / 1000));
}

function isTimerRunningFor(projectId, itemId) {
  return Boolean(activeTimer && activeTimer.projectId === projectId && activeTimer.itemId === itemId);
}

function ensureTimerTicking() {
  if (timerIntervalId) clearInterval(timerIntervalId);
  if (!activeTimer) return;
  timerIntervalId = setInterval(updateLiveTimerDisplays, 1000);
}

function updateLiveTimerDisplays() {
  if (!activeTimer) {
    if (timerIntervalId) {
      clearInterval(timerIntervalId);
      timerIntervalId = null;
    }
    return;
  }

  const proj = (state.projects || []).find((p) => p.id === activeTimer.projectId);
  if (!proj) return;
  const item = (proj.items || []).find((i) => i.id === activeTimer.itemId);
  if (!item) return;

  const runningSec = getRunningElapsedSeconds(proj.id, item.id);
  const itemTotal = computeItemTotalSeconds(item) + runningSec;
  const projTotal = computeProjectTotalSeconds(proj) + runningSec;

  document.querySelectorAll(`[data-timer-item="${item.id}"]`).forEach((el) => {
    el.textContent = `⏱️ ${formatDuration(itemTotal, true)}`;
  });

  document.querySelectorAll(`[data-project-total-time="${proj.id}"]`).forEach((el) => {
    el.textContent = `⏱️ Temps projet : ${formatDuration(projTotal, true)}`;
  });
}

// ============================================================
// FIL D'ARIANE (BREADCRUMB) EN-TÊTE GESTION DES PROJETS
// ============================================================
function updateProjectsBreadcrumb(project = null) {
  const el = document.getElementById("projectsBreadcrumb");
  if (!el) return;
  if (!project) {
    el.innerHTML = `Gestion des projets`;
  } else {
    el.innerHTML = `
      <span class="breadcrumb-link" onclick="closeProjectDetail()">Gestion des projets</span>
      <span class="breadcrumb-sep">&gt;</span>
      <span class="breadcrumb-current">${escapeHtml(project.title)}</span>
    `;
  }
}

// ============================================================
// VUE GLOBALE : LISTE DES PROJETS + DRAG & DROP
// ============================================================
function renderProjectsSection() {
  updateProjectsBreadcrumb(null);
  document.getElementById("projectsListView").style.display = "block";
  document.getElementById("projectDetailView").style.display = "none";

  const projects = state.projects || [];

  const kpiContainer = document.getElementById("projectsKpiGrid");
  kpiContainer.innerHTML = PROJECT_STATUSES.map((st) => {
    const count = projects.filter((p) => p.status === st.key).length;
    return `
      <div class="project-kpi-col">
        <div class="project-kpi-box ${st.kpiClass}">${count}</div>
        <div class="project-kpi-label">${escapeHtml(st.label)}</div>
      </div>
    `;
  }).join("");

  const groupsContainer = document.getElementById("projectsGroupsContainer");
  let html = "";

  PROJECT_GROUP_ORDER.forEach((statusKey) => {
    const meta = PROJECT_STATUSES.find((s) => s.key === statusKey);
    const items = projects.filter((p) => p.status === statusKey);

    const listContent = items.length
      ? items
          .map((pr) => {
            const pct = computeProjectProgress(pr);
            const countIllus = (pr.items || []).length;
            const runningExtra =
              activeTimer && activeTimer.projectId === pr.id
                ? getRunningElapsedSeconds(pr.id, activeTimer.itemId)
                : 0;
            const totalSec = computeProjectTotalSeconds(pr) + runningExtra;

            return `
              <div
                class="project-row"
                draggable="true"
                data-project-id="${pr.id}"
                ondragstart="handleProjectDragStart(event, '${pr.id}')"
                ondragend="handleProjectDragEnd(event)"
                onclick="openProjectDetail('${pr.id}')"
              >
                <span class="project-drag-handle" title="Glisser pour déplacer dans une autre catégorie">⋮⋮</span>
                <div class="project-row-info">
                  <div class="project-row-title">${escapeHtml(pr.title)}</div>
                  <div class="project-row-meta">
                    ${countIllus ? `${countIllus} illustration(s) / texte(s)` : "Aucune illustration ajoutée"}
                    ${pr.notes ? ` • ${escapeHtml(pr.notes)}` : ""}
                  </div>
                  <div class="project-badges-row">
                    ${pr.technique ? `<span class="project-badge">🎨 ${escapeHtml(pr.technique)}</span>` : ""}
                    <span class="project-badge time-badge" data-project-total-time="${pr.id}">⏱️ Temps projet : ${formatDuration(totalSec, runningExtra > 0)}</span>
                  </div>
                </div>
                <div class="project-progress-wrap">
                  <div class="project-progress-track">
                    <div class="project-progress-fill fill-${statusKey}" style="width: ${pct}%;"></div>
                  </div>
                  <span class="project-progress-pct">${pct}%</span>
                </div>
              </div>
            `;
          })
          .join("")
      : `<div class="project-empty-dropzone">Aucun projet dans cette catégorie — glissez un projet ici</div>`;

    html += `
      <div
        class="project-group"
        data-status="${statusKey}"
        ondragover="handleProjectDragOver(event)"
        ondragleave="handleProjectDragLeave(event)"
        ondrop="handleProjectDrop(event, '${statusKey}')"
      >
        <div class="project-group-header group-${statusKey}">
          <span>${escapeHtml(meta.label)}</span>
          <span class="project-group-count">${items.length}</span>
        </div>
        <div class="project-list">
          ${listContent}
        </div>
      </div>
    `;
  });

  groupsContainer.innerHTML = html;
  ensureTimerTicking();
}

window.handleProjectDragStart = function (event, projectId) {
  draggedProjectId = projectId;
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", projectId);
  event.currentTarget.classList.add("dragging");
};

window.handleProjectDragEnd = function (event) {
  draggedProjectId = null;
  event.currentTarget.classList.remove("dragging");
  document.querySelectorAll(".project-group.drag-over").forEach((el) => {
    el.classList.remove("drag-over");
  });
};

window.handleProjectDragOver = function (event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
  event.currentTarget.classList.add("drag-over");
};

window.handleProjectDragLeave = function (event) {
  const groupEl = event.currentTarget;
  if (!groupEl.contains(event.relatedTarget)) {
    groupEl.classList.remove("drag-over");
  }
};

window.handleProjectDrop = function (event, targetStatusKey) {
  event.preventDefault();
  document.querySelectorAll(".project-group.drag-over").forEach((el) => {
    el.classList.remove("drag-over");
  });

  const projId = draggedProjectId || event.dataTransfer.getData("text/plain");
  draggedProjectId = null;
  if (!projId) return;

  const project = (state.projects || []).find((p) => p.id === projId);
  if (!project || project.status === targetStatusKey) return;

  project.status = targetStatusKey;
  if (typeof recordTrackerAction === "function") recordTrackerAction("edit");
  saveProjectToCloud(project);
  renderProjectsSection();

  const meta = PROJECT_STATUSES.find((s) => s.key === targetStatusKey);
  showToast(`Projet déplacé dans « ${meta ? meta.label : targetStatusKey} »`);
};

// ============================================================
// VUE DÉTAIL D'UN PROJET
// ============================================================
window.openProjectDetail = function (projectId) {
  activeProjectId = projectId;
  renderProjectDetail();
};

window.closeProjectDetail = function () {
  activeProjectId = null;
  closeIllusDetailModal();
  renderProjectsSection();
};

function getActiveProject() {
  return (state.projects || []).find((p) => p.id === activeProjectId) || null;
}

function renderProjectInspirations(proj) {
  const panel = document.getElementById("projectInspoPanel");
  if (!panel) return;

  const inspos = Array.isArray(proj.inspirations) ? proj.inspirations : [];
  const gridHtml = inspos.length
    ? `<div class="inspo-grid">
        ${inspos
          .map(
            (ins) => `
          <div class="inspo-item">
            <img src="${ins.src}" alt="${escapeHtml(ins.name || "Inspiration")}" onclick="window.open('${ins.src}', '_blank')" title="Cliquez pour agrandir" />
            <button type="button" class="inspo-item-del" onclick="deleteProjectInspiration('${ins.id}')" title="Supprimer">✕</button>
          </div>
        `
          )
          .join("")}
      </div>`
    : `<div style="font-size: 13px; color: var(--muted);">Aucune inspiration enregistrée. Importez des images ou faites <strong>Coller / Ctrl+V</strong> pour ajouter une image.</div>`;

  panel.innerHTML = `
    <div class="inspo-header" onclick="toggleInspoFolder()">
      <div class="inspo-header-left">
        <span>${inspoFolderOpen ? "📂" : "📁"} Inspiration graphique</span>
        <span class="project-badge">${inspos.length} image(s)</span>
      </div>
      <div class="inspo-actions" onclick="event.stopPropagation()">
        <button type="button" class="sm" onclick="triggerInspoUpload()">🖼️ Importer</button>
        <button type="button" class="sm" onclick="pasteImageFromClipboard('inspo')">📥 Coller image</button>
        <button type="button" class="sm" onclick="toggleInspoFolder()">${inspoFolderOpen ? "Masquer ▲" : "Ouvrir ▼"}</button>
      </div>
    </div>
    ${inspoFolderOpen ? `<div class="inspo-body">${gridHtml}</div>` : ""}
  `;
}

window.toggleInspoFolder = function () {
  inspoFolderOpen = !inspoFolderOpen;
  const proj = getActiveProject();
  if (proj) renderProjectInspirations(proj);
};

window.triggerInspoUpload = function () {
  inspoFolderOpen = true;
  document.getElementById("projectInspoFileInput").click();
};

document.getElementById("projectInspoFileInput").addEventListener("change", async (e) => {
  const files = Array.from(e.target.files || []);
  if (!files.length) return;
  const proj = getActiveProject();
  if (!proj) return;
  if (!Array.isArray(proj.inspirations)) proj.inspirations = [];

  showToast(files.length > 1 ? "Envoi des inspirations en cours..." : "Envoi de l'inspiration en cours...");
  setSyncStatus("syncing", "⏳ Envoi photo...");

  let added = 0;
  for (let i = 0; i < files.length; i++) {
    try {
      const secureUrl = await uploadFileToCloudinary(files[i]);
      proj.inspirations.push({
        id: `insp_${Date.now()}_${i}`,
        src: secureUrl,
        name: files[i].name || "Inspiration",
        createdAt: new Date().toISOString()
      });
      added++;
    } catch (err) {
      console.error("Erreur upload inspiration :", err);
    }
  }

  if (added > 0) {
    if (typeof recordTrackerAction === "function") recordTrackerAction("creativ");
    await saveProjectToCloud(proj);
    inspoFolderOpen = true;
    renderProjectInspirations(proj);
    showToast(`${added} inspiration(s) ajoutée(s) !`);
  }
  setSyncStatus("ok", "☁️ Synchronisé");
  e.target.value = "";
});

window.deleteProjectInspiration = function (inspoId) {
  const proj = getActiveProject();
  if (!proj) return;
  proj.inspirations = (proj.inspirations || []).filter((i) => i.id !== inspoId);
  if (typeof recordTrackerAction === "function") recordTrackerAction("creativ");
  saveProjectToCloud(proj);
  renderProjectInspirations(proj);
  showToast("Inspiration supprimée");
};

function renderProjectDetail() {
  const proj = getActiveProject();
  if (!proj) {
    closeProjectDetail();
    return;
  }

  updateProjectsBreadcrumb(proj);
  document.getElementById("projectsListView").style.display = "none";
  document.getElementById("projectDetailView").style.display = "block";

  if (!Array.isArray(proj.items)) proj.items = [];
  const pct = computeProjectProgress(proj);
  proj.progress = pct;

  document.getElementById("projDetailTitle").textContent = proj.title;

  const runningExtra =
    activeTimer && activeTimer.projectId === proj.id
      ? getRunningElapsedSeconds(proj.id, activeTimer.itemId)
      : 0;
  const projTotalSec = computeProjectTotalSeconds(proj) + runningExtra;

  document.getElementById("projDetailBadges").innerHTML = `
    ${proj.technique ? `<span class="project-badge">🎨 Technique : ${escapeHtml(proj.technique)}</span>` : `<span class="project-badge" style="cursor:pointer;" onclick="openProjectModal('${proj.id}')">+ Définir la technique</span>`}
    <span class="project-badge time-badge" data-project-total-time="${proj.id}">⏱️ Temps projet : ${formatDuration(projTotalSec, runningExtra > 0)}</span>
  `;

  const barEl = document.getElementById("projDetailProgressBar");
  barEl.style.width = pct + "%";
  barEl.className = `project-progress-fill fill-${proj.status}`;

  const pctEl = document.getElementById("projDetailProgressPct");
  pctEl.textContent = pct + "%";
  const statusMeta = PROJECT_STATUSES.find((s) => s.key === proj.status);
  pctEl.className = `project-detail-pct-big ${statusMeta ? statusMeta.kpiClass : "kpi-yellow"}`;

  renderProjectInspirations(proj);

  const total = proj.items.length;
  const illusTodo = proj.items.filter((i) => i.illusStatus === "a_demarrer").length;
  const illusDoing = proj.items.filter((i) => i.illusStatus === "en_cours").length;
  const illusDone = proj.items.filter((i) => i.illusStatus === "finalise").length;

  const textTodo = proj.items.filter((i) => i.textStatus === "a_demarrer").length;
  const textDoing = proj.items.filter((i) => i.textStatus === "en_cours").length;
  const textDone = proj.items.filter((i) => i.textStatus === "finalise").length;

  document.getElementById("statIllusTotal").textContent = total;
  document.getElementById("statIllusTodo").textContent = illusTodo;
  document.getElementById("statIllusDoing").textContent = illusDoing;
  document.getElementById("statIllusDone").textContent = illusDone;

  document.getElementById("statTextTotal").textContent = total;
  document.getElementById("statTextTodo").textContent = textTodo;
  document.getElementById("statTextDoing").textContent = textDoing;
  document.getElementById("statTextDone").textContent = textDone;

  const grid = document.getElementById("projectIllustrationsGrid");
  const cardsHtml = proj.items
    .map((it, idx) => {
      const running = isTimerRunningFor(proj.id, it.id);
      const itemSec = computeItemTotalSeconds(it) + (running ? getRunningElapsedSeconds(proj.id, it.id) : 0);
      const versionsCount = Array.isArray(it.versions) ? it.versions.length : 0;

      return `
        <div
          class="illus-card"
          draggable="true"
          data-item-id="${it.id}"
          ondragstart="handleIllusDragStart(event, '${it.id}')"
          ondragover="handleIllusDragOver(event)"
          ondragleave="handleIllusDragLeave(event)"
          ondrop="handleIllusDrop(event, '${it.id}')"
          ondragend="handleIllusDragEnd(event)"
        >
          <div class="illus-card-topbar">
            <span class="illus-drag-handle" title="Glisser pour déplacer cette carte">⋮⋮ Page ${idx + 1}</span>
            <div style="display: flex; gap: 5px;">
              <button type="button" class="sm" onclick="openIllusDetailModal('${it.id}')" title="Voir les versions et les chronos">
                🗂️ Versions (${versionsCount}) & chronos
              </button>
              <button type="button" class="sm danger" onclick="deleteProjectItem('${it.id}')" title="Supprimer cette page">✕</button>
            </div>
          </div>

          <div class="illus-image-box" onclick="triggerProjectIllusUpload('${it.id}')" title="Cliquez pour importer une illustration">
            ${it.imageSrc ? `<img src="${it.imageSrc}" alt="Illustration ${idx + 1}" />` : `<span>🖼️ Importer l'illustration ${idx + 1}</span>`}
            <div class="illus-upload-overlay">${it.imageSrc ? "Ajouter une nouvelle version" : "Importer une illustration"}</div>
          </div>

          <div class="illus-timer-bar">
            <span class="illus-timer-display ${running ? "running" : ""}" data-timer-item="${it.id}">
              ⏱️ ${formatDuration(itemSec, running)}
            </span>
            <div class="illus-timer-btns">
              ${
                running
                  ? `<button type="button" class="btn-timer-stop" onclick="stopIllusTimer('${it.id}')">⏹ Arrêter & enregistrer</button>`
                  : `<button type="button" class="btn-timer-start" onclick="startIllusTimer('${it.id}')">▶ Démarrer</button>`
              }
            </div>
          </div>

          <div class="illus-card-controls">
            <select class="illus-status-select illus-status-${it.illusStatus}" onchange="updateProjectItemField('${it.id}', 'illusStatus', this.value)" title="Statut de l'illustration">
              <option value="a_demarrer" ${it.illusStatus === "a_demarrer" ? "selected" : ""}>Illustration : à démarrer</option>
              <option value="en_cours" ${it.illusStatus === "en_cours" ? "selected" : ""}>Illustration : en cours</option>
              <option value="finalise" ${it.illusStatus === "finalise" ? "selected" : ""}>Illustration : finalisée</option>
            </select>
            <div style="display: flex; gap: 5px;">
              ${it.imageSrc ? `<button type="button" class="sm" onclick="copyImageToClipboard('${it.imageSrc}')" title="Copier l'image">📋 Copier</button>` : ""}
              <button type="button" class="sm" onclick="pasteImageFromClipboard('item', '${it.id}')" title="Coller une image depuis le presse-papiers">📥 Coller</button>
            </div>
          </div>

          <textarea
            class="illus-text-area"
            placeholder="Il était une fois..."
            onfocus="this.closest('.illus-card').draggable=false"
            onblur="this.closest('.illus-card').draggable=true"
            oninput="updateProjectItemText('${it.id}', this.value)"
          >${escapeHtml(it.text || "")}</textarea>

          <div class="illus-card-footer-actions">
            <select class="illus-status-select illus-status-${it.textStatus}" onchange="updateProjectItemField('${it.id}', 'textStatus', this.value)" title="Statut du texte">
              <option value="a_demarrer" ${it.textStatus === "a_demarrer" ? "selected" : ""}>Texte : à démarrer</option>
              <option value="en_cours" ${it.textStatus === "en_cours" ? "selected" : ""}>Texte : en cours</option>
              <option value="finalise" ${it.textStatus === "finalise" ? "selected" : ""}>Texte : finalisé</option>
            </select>
          </div>
        </div>
      `;
    })
    .join("");

  const addCardHtml = `
    <div class="illus-add-card" onclick="addProjectIllustration()" title="Ajouter une nouvelle illustration">
      <span class="illus-add-plus">+</span>
    </div>
  `;

  grid.innerHTML = cardsHtml + addCardHtml;

  if (typeof renderProjectEditionSection === "function") {
    renderProjectEditionSection(proj);
  }

  ensureTimerTicking();
}

// ============================================================
// DRAG & DROP DES CARTES ILLUSTRATION + TEXTE
// ============================================================
window.handleIllusDragStart = function (event, itemId) {
  if (event.target.closest("textarea, select, input, button")) {
    event.preventDefault();
    return;
  }
  draggedIllusItemId = itemId;
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", itemId);
  event.currentTarget.classList.add("dragging");
};

window.handleIllusDragOver = function (event) {
  if (!draggedIllusItemId) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
  event.currentTarget.classList.add("drag-over");
};

window.handleIllusDragLeave = function (event) {
  const card = event.currentTarget;
  if (!card.contains(event.relatedTarget)) {
    card.classList.remove("drag-over");
  }
};

window.handleIllusDrop = function (event, targetItemId) {
  event.preventDefault();
  document.querySelectorAll(".illus-card.drag-over").forEach((el) => el.classList.remove("drag-over"));

  const sourceId = draggedIllusItemId || event.dataTransfer.getData("text/plain");
  draggedIllusItemId = null;
  if (!sourceId || sourceId === targetItemId) return;

  const proj = getActiveProject();
  if (!proj || !Array.isArray(proj.items)) return;

  const fromIdx = proj.items.findIndex((i) => i.id === sourceId);
  const toIdx = proj.items.findIndex((i) => i.id === targetItemId);
  if (fromIdx === -1 || toIdx === -1) return;

  const [moved] = proj.items.splice(fromIdx, 1);
  proj.items.splice(toIdx, 0, moved);

  if (typeof recordTrackerAction === "function") recordTrackerAction("creativ");
  saveProjectToCloud(proj);
  renderProjectDetail();
  showToast("Ordre des illustrations mis à jour !");
};

window.handleIllusDragEnd = function (event) {
  draggedIllusItemId = null;
  event.currentTarget.classList.remove("dragging");
  document.querySelectorAll(".illus-card.drag-over").forEach((el) => el.classList.remove("drag-over"));
};

// ============================================================
// CHRONOMÈTRE PAR ILLUSTRATION
// ============================================================
window.startIllusTimer = function (itemId) {
  const proj = getActiveProject();
  if (!proj) return;

  if (activeTimer && (activeTimer.projectId !== proj.id || activeTimer.itemId !== itemId)) {
    stopActiveTimerAndSave();
  }

  saveActiveTimer({
    projectId: proj.id,
    itemId,
    startedAt: Date.now()
  });

  if (typeof recordTrackerAction === "function") recordTrackerAction("creativ");
  ensureTimerTicking();
  renderProjectDetail();
  if (activeIllusModalItemId === itemId) renderIllusDetailModal();
  showToast("Chrono démarré !");
};

function stopActiveTimerAndSave() {
  if (!activeTimer) return 0;
  const elapsed = Math.max(1, Math.floor((Date.now() - Number(activeTimer.startedAt)) / 1000));
  const targetProj = (state.projects || []).find((p) => p.id === activeTimer.projectId);
  const targetItem = targetProj ? (targetProj.items || []).find((i) => i.id === activeTimer.itemId) : null;

  saveActiveTimer(null);
  if (timerIntervalId) {
    clearInterval(timerIntervalId);
    timerIntervalId = null;
  }

  if (targetProj && targetItem) {
    if (!Array.isArray(targetItem.sessions)) targetItem.sessions = [];
    targetItem.sessions.unshift({
      id: "ses_" + Date.now(),
      date: new Date().toISOString(),
      durationSeconds: elapsed,
      note: ""
    });
    if (typeof recordTrackerAction === "function") recordTrackerAction("creativ");
    saveProjectToCloud(targetProj);
  }
  return elapsed;
}

window.stopIllusTimer = function (itemId) {
  const elapsed = stopActiveTimerAndSave();
  renderProjectDetail();
  if (activeIllusModalItemId === itemId) renderIllusDetailModal();
  showToast(`Session enregistrée : ${formatDuration(elapsed, true)}`);
};

// ============================================================
// MODALE DÉTAIL ILLUSTRATION (VERSIONS & HISTORIQUE CHRONOS)
// ============================================================
window.openIllusDetailModal = function (itemId) {
  activeIllusModalItemId = itemId;
  renderIllusDetailModal();
  document.getElementById("illusDetailModal").classList.add("open");
};

function closeIllusDetailModal() {
  activeIllusModalItemId = null;
  const modal = document.getElementById("illusDetailModal");
  if (modal) modal.classList.remove("open");
}

document.getElementById("btnCloseIllusDetailModal").addEventListener("click", closeIllusDetailModal);
document.getElementById("illusDetailModal").addEventListener("click", (e) => {
  if (e.target.id === "illusDetailModal") closeIllusDetailModal();
});

function renderIllusDetailModal() {
  const proj = getActiveProject();
  if (!proj || !activeIllusModalItemId) return;
  const idx = (proj.items || []).findIndex((i) => i.id === activeIllusModalItemId);
  if (idx === -1) {
    closeIllusDetailModal();
    return;
  }
  const item = proj.items[idx];
  const running = isTimerRunningFor(proj.id, item.id);
  const totalSec = computeItemTotalSeconds(item) + (running ? getRunningElapsedSeconds(proj.id, item.id) : 0);

  document.getElementById("illusDetailModalTitle").textContent = `Page ${idx + 1} — Versions & Chronos`;

  const versions = Array.isArray(item.versions) ? item.versions : [];
  const versionsHtml = versions.length
    ? `<div class="versions-grid">
        ${versions
          .map((v, vIdx) => {
            const isCurrent = v.src === item.imageSrc;
            const dateStr = v.createdAt
              ? new Date(v.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" })
              : "";
            return `
              <div class="version-card ${isCurrent ? "is-current" : ""}">
                <img src="${v.src}" alt="${escapeHtml(v.label || `Version ${vIdx + 1}`)}" onclick="window.open('${v.src}', '_blank')" title="Agrandir" />
                <div class="version-card-meta">
                  <strong>${escapeHtml(v.label || `Étape ${vIdx + 1}`)} ${isCurrent ? "⭐" : ""}</strong>
                  ${dateStr ? `<span style="color:var(--muted);">${dateStr}</span>` : ""}
                  <div class="version-card-actions">
                    ${!isCurrent ? `<button type="button" class="sm" onclick="setMainIllusVersion('${item.id}', '${v.id}')">Afficher</button>` : `<span style="color:var(--primary); font-weight:700;">Principale</span>`}
                    <button type="button" class="sm" onclick="copyImageToClipboard('${v.src}')" title="Copier">📋</button>
                    <button type="button" class="sm danger" onclick="deleteIllusVersion('${item.id}', '${v.id}')" title="Supprimer">✕</button>
                  </div>
                </div>
              </div>
            `;
          })
          .join("")}
      </div>`
    : `<div style="font-size: 13px; color: var(--muted);">Aucune version enregistrée. Importez une image ou faites <strong>Coller / Ctrl+V</strong> pour ajouter une étape.</div>`;

  const sessions = Array.isArray(item.sessions) ? item.sessions : [];
  const sessionsHtml = sessions.length
    ? `<div class="sessions-list">
        ${sessions
          .map((s) => {
            const dt = s.date
              ? new Date(s.date).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
              : "Session";
            return `
              <div class="session-row">
                <span>📅 ${dt} ${s.note ? `— ${escapeHtml(s.note)}` : ""}</span>
                <div style="display:flex; align-items:center; gap:8px;">
                  <strong>${formatDuration(s.durationSeconds, true)}</strong>
                  <button type="button" class="sm danger" onclick="deleteIllusSession('${item.id}', '${s.id}')" title="Supprimer cette session">✕</button>
                </div>
              </div>
            `;
          })
          .join("")}
      </div>`
    : `<div style="font-size: 13px; color: var(--muted);">Aucune session enregistrée pour cette illustration.</div>`;

  document.getElementById("illusDetailModalBody").innerHTML = `
    <div class="illus-modal-section">
      <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap;">
        <h3>🖼️ Versions / Étapes de l'illustration (${versions.length})</h3>
        <div style="display:flex; gap:6px; flex-wrap:wrap;">
          <button type="button" class="sm primary" onclick="triggerIllusVersionUpload()">+ Ajouter une version</button>
          <button type="button" class="sm" onclick="pasteImageFromClipboard('item', '${item.id}')">📥 Coller (Ctrl+V)</button>
        </div>
      </div>
      ${versionsHtml}
    </div>

    <div class="illus-modal-section">
      <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; margin-bottom:10px;">
        <h3>⏱️ Chronomètre & Sessions — Total : <span data-timer-item="${item.id}">${formatDuration(totalSec, running)}</span></h3>
        <div>
          ${
            running
              ? `<button type="button" class="btn-timer-stop" onclick="stopIllusTimer('${item.id}')">⏹ Arrêter & enregistrer</button>`
              : `<button type="button" class="btn-timer-start" onclick="startIllusTimer('${item.id}')">▶ Démarrer le chrono</button>`
          }
        </div>
      </div>

      <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-bottom:10px;">
        <input type="number" id="manualSessionMinutes" min="1" placeholder="Minutes (ex. 30)" style="width:140px;" />
        <input type="text" id="manualSessionNote" placeholder="Note optionnelle (ex. Croquis, encrage...)" style="flex:1; min-width:160px;" />
        <button type="button" class="sm" onclick="addManualIllusSession('${item.id}')">+ Ajouter temps</button>
      </div>

      ${sessionsHtml}
    </div>
  `;
}

window.triggerIllusVersionUpload = function () {
  document.getElementById("illusVersionFileInput").click();
};

document.getElementById("illusVersionFileInput").addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file || !activeIllusModalItemId) return;
  await uploadImageToProjectItem(activeIllusModalItemId, file);
  e.target.value = "";
});

window.setMainIllusVersion = function (itemId, versionId) {
  const proj = getActiveProject();
  if (!proj) return;
  const item = (proj.items || []).find((i) => i.id === itemId);
  if (!item) return;
  const ver = (item.versions || []).find((v) => v.id === versionId);
  if (!ver) return;
  item.imageSrc = ver.src;
  if (typeof recordTrackerAction === "function") recordTrackerAction("creativ");
  saveProjectToCloud(proj);
  renderProjectDetail();
  renderIllusDetailModal();
  showToast("Version définie comme image principale");
};

window.deleteIllusVersion = function (itemId, versionId) {
  const proj = getActiveProject();
  if (!proj) return;
  const item = (proj.items || []).find((i) => i.id === itemId);
  if (!item) return;
  const deleted = (item.versions || []).find((v) => v.id === versionId);
  item.versions = (item.versions || []).filter((v) => v.id !== versionId);
  if (deleted && item.imageSrc === deleted.src) {
    item.imageSrc = item.versions.length ? item.versions[item.versions.length - 1].src : "";
  }
  if (typeof recordTrackerAction === "function") recordTrackerAction("creativ");
  saveProjectToCloud(proj);
  renderProjectDetail();
  renderIllusDetailModal();
  showToast("Version supprimée");
};

window.addManualIllusSession = function (itemId) {
  const mins = Number(document.getElementById("manualSessionMinutes")?.value);
  const note = (document.getElementById("manualSessionNote")?.value || "").trim();
  if (!mins || mins <= 0) {
    showToast("Saisissez un nombre de minutes valide");
    return;
  }
  const proj = getActiveProject();
  if (!proj) return;
  const item = (proj.items || []).find((i) => i.id === itemId);
  if (!item) return;
  if (!Array.isArray(item.sessions)) item.sessions = [];
  item.sessions.unshift({
    id: "ses_" + Date.now(),
    date: new Date().toISOString(),
    durationSeconds: Math.round(mins * 60),
    note
  });
  if (typeof recordTrackerAction === "function") recordTrackerAction("creativ");
  saveProjectToCloud(proj);
  renderProjectDetail();
  renderIllusDetailModal();
  showToast(`+${mins} min ajoutées !`);
};

window.deleteIllusSession = function (itemId, sessionId) {
  const proj = getActiveProject();
  if (!proj) return;
  const item = (proj.items || []).find((i) => i.id === itemId);
  if (!item) return;
  item.sessions = (item.sessions || []).filter((s) => s.id !== sessionId);
  saveProjectToCloud(proj);
  renderProjectDetail();
  renderIllusDetailModal();
  showToast("Session supprimée");
};

// ============================================================
// COPIER / COLLER UNE IMAGE (PRESSE-PAPIERS & CTRL+V)
// ============================================================
async function uploadImageToProjectItem(itemId, file) {
  const proj = getActiveProject();
  if (!proj) return;
  const item = (proj.items || []).find((i) => i.id === itemId);
  if (!item) return;

  showToast("Envoi de l'illustration en cours...");
  setSyncStatus("syncing", "⏳ Envoi photo...");
  try {
    const secureUrl = await uploadFileToCloudinary(file);
    if (!Array.isArray(item.versions)) item.versions = [];
    const nextNum = item.versions.length + 1;
    item.versions.push({
      id: "ver_" + Date.now(),
      src: secureUrl,
      label: `Version ${nextNum}`,
      createdAt: new Date().toISOString()
    });
    item.imageSrc = secureUrl;
    if (typeof recordTrackerAction === "function") recordTrackerAction("creativ");
    await saveProjectToCloud(proj);
    renderProjectDetail();
    if (activeIllusModalItemId === itemId) renderIllusDetailModal();
    showToast("Illustration enregistrée dans le Cloud !");
  } catch (err) {
    console.error("Erreur import illustration :", err);
    setSyncStatus("error", "⚠️ Erreur photo");
    showToast("Erreur lors de l'envoi de l'illustration");
  }
}

window.copyImageToClipboard = async function (imageUrl) {
  if (!imageUrl) return;
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = imageUrl;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext("2d").drawImage(img, 0, 0);

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (blob && navigator.clipboard && window.ClipboardItem) {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      showToast("Image copiée dans le presse-papiers !");
      return;
    }
    throw new Error("ClipboardItem indisponible");
  } catch {
    try {
      await navigator.clipboard.writeText(imageUrl);
      showToast("Lien de l'image copié dans le presse-papiers !");
    } catch {
      showToast("Impossible de copier automatiquement l'image");
    }
  }
};

window.pasteImageFromClipboard = async function (targetType, itemId = null) {
  if (!navigator.clipboard || !navigator.clipboard.read) {
    showToast("Utilisez Ctrl+V pour coller votre image !");
    return;
  }
  try {
    const clipItems = await navigator.clipboard.read();
    for (const ci of clipItems) {
      const imgType = ci.types.find((t) => t.startsWith("image/"));
      if (imgType) {
        const blob = await ci.getType(imgType);
        const ext = imgType.split("/")[1] || "png";
        const file = new File([blob], `colle-${Date.now()}.${ext}`, { type: imgType });
        await handlePastedImageFile(file, targetType, itemId);
        return;
      }
    }
    showToast("Aucune image trouvée dans le presse-papiers");
  } catch (err) {
    console.warn("Lecture presse-papiers :", err);
    showToast("Faites Ctrl+V directement pour coller votre image !");
  }
};

async function handlePastedImageFile(file, targetType, itemId = null) {
  const proj = getActiveProject();
  if (!proj) return;

  if (targetType === "inspo") {
    showToast("Envoi de l'image collée...");
    setSyncStatus("syncing", "⏳ Envoi photo...");
    try {
      const secureUrl = await uploadFileToCloudinary(file);
      if (!Array.isArray(proj.inspirations)) proj.inspirations = [];
      proj.inspirations.push({
        id: `insp_${Date.now()}`,
        src: secureUrl,
        name: file.name || "Inspiration collée",
        createdAt: new Date().toISOString()
      });
      if (typeof recordTrackerAction === "function") recordTrackerAction("creativ");
      await saveProjectToCloud(proj);
      inspoFolderOpen = true;
      renderProjectInspirations(proj);
      showToast("Image collée dans Inspiration graphique !");
    } catch {
      showToast("Erreur lors du collage de l'image");
    } finally {
      setSyncStatus("ok", "☁️ Synchronisé");
    }
  } else if (targetType === "item" && itemId) {
    await uploadImageToProjectItem(itemId, file);
  }
}

window.addEventListener("paste", async (e) => {
  const isProjectsActive = document.getElementById("main-projets")?.classList.contains("active");
  if (!isProjectsActive || !activeProjectId) return;

  const items = Array.from(e.clipboardData?.items || []);
  const imgItem = items.find((it) => it.type && it.type.startsWith("image/"));
  if (!imgItem) return;

  const file = imgItem.getAsFile();
  if (!file) return;

  if (activeIllusModalItemId) {
    e.preventDefault();
    await handlePastedImageFile(file, "item", activeIllusModalItemId);
  } else if (inspoFolderOpen) {
    e.preventDefault();
    await handlePastedImageFile(file, "inspo");
  }
});

// ============================================================
// ACTIONS SUR LES ITEMS & MODALE PARAMÈTRES PROJET
// ============================================================
window.addProjectIllustration = function () {
  const proj = getActiveProject();
  if (!proj) return;
  if (!Array.isArray(proj.items)) proj.items = [];
  proj.items.push(createEmptyProjectItem());
  proj.progress = computeProjectProgress(proj);
  if (typeof recordTrackerAction === "function") recordTrackerAction("creativ");
  saveProjectToCloud(proj);
  renderProjectDetail();
  showToast("Illustration ajoutée");
};

window.deleteProjectItem = function (itemId) {
  const proj = getActiveProject();
  if (!proj) return;
  if (isTimerRunningFor(proj.id, itemId)) {
    saveActiveTimer(null);
  }
  proj.items = (proj.items || []).filter((i) => i.id !== itemId);
  proj.progress = computeProjectProgress(proj);
  saveProjectToCloud(proj);
  renderProjectDetail();
  showToast("Page supprimée");
};

window.updateProjectItemField = function (itemId, field, value) {
  const proj = getActiveProject();
  if (!proj) return;
  const item = (proj.items || []).find((i) => i.id === itemId);
  if (!item) return;
  item[field] = value;
  proj.progress = computeProjectProgress(proj);
  if (typeof recordTrackerAction === "function") {
    recordTrackerAction(field === "textStatus" ? "edit" : "creativ");
  }
  saveProjectToCloud(proj);
  renderProjectDetail();
};

window.updateProjectItemText = function (itemId, value) {
  const proj = getActiveProject();
  if (!proj) return;
  const item = (proj.items || []).find((i) => i.id === itemId);
  if (!item) return;
  item.text = value;
  if (typeof recordTrackerAction === "function") recordTrackerAction("edit");
  clearTimeout(projectTextSaveTimer);
  projectTextSaveTimer = setTimeout(() => {
    saveProjectToCloud(proj);
  }, 600);
};

window.triggerProjectIllusUpload = function (itemId) {
  pendingUploadItemId = itemId;
  document.getElementById("projectIllusFileInput").click();
};

document.getElementById("projectIllusFileInput").addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file || !pendingUploadItemId) return;
  const targetId = pendingUploadItemId;
  pendingUploadItemId = null;
  await uploadImageToProjectItem(targetId, file);
  e.target.value = "";
});

document.getElementById("btnEditCurrentProjectMeta").addEventListener("click", () => {
  if (activeProjectId) openProjectModal(activeProjectId);
});

window.openProjectModal = function (projectId = null) {
  const proj = projectId ? (state.projects || []).find((p) => p.id === projectId) : null;
  editingProjectId = proj ? proj.id : null;

  document.getElementById("projectModalTitle").textContent = proj ? "Paramètres du projet" : "Nouveau projet";
  document.getElementById("projTitle").value = proj?.title || "";
  document.getElementById("projStatus").value = proj?.status || "a_demarrer";
  document.getElementById("projTechnique").value = proj?.technique || "";
  document.getElementById("projNotes").value = proj?.notes || "";
  document.getElementById("btnDeleteProject").style.display = proj ? "inline-block" : "none";

  document.getElementById("projectModal").classList.add("open");
};

function closeProjectModal() {
  document.getElementById("projectModal").classList.remove("open");
}

document.getElementById("btnNewProject").addEventListener("click", () => openProjectModal(null));
document.getElementById("btnCloseProjectModal").addEventListener("click", closeProjectModal);
document.getElementById("btnCancelProject").addEventListener("click", closeProjectModal);

document.getElementById("projectModal").addEventListener("click", (e) => {
  if (e.target.id === "projectModal") closeProjectModal();
});

document.getElementById("btnSaveProject").addEventListener("click", () => {
  const title = document.getElementById("projTitle").value.trim();
  if (!title) {
    showToast("Veuillez renseigner le nom du projet");
    return;
  }
  const status = document.getElementById("projStatus").value;
  const technique = document.getElementById("projTechnique").value.trim();
  const notes = document.getElementById("projNotes").value.trim();

  if (!Array.isArray(state.projects)) state.projects = [];

  let savedProj;
  if (editingProjectId) {
    const idx = state.projects.findIndex((p) => p.id === editingProjectId);
    if (idx !== -1) {
      state.projects[idx] = { ...state.projects[idx], title, status, technique, notes };
      savedProj = state.projects[idx];
    }
  } else {
    savedProj = {
      id: "proj_" + Date.now(),
      title,
      status,
      progress: 0,
      technique,
      notes,
      inspirations: [],
      submissions: [],
      items: [createEmptyProjectItem()]
    };
    state.projects.push(savedProj);
  }

  if (typeof recordTrackerAction === "function") recordTrackerAction("edit");
  if (savedProj) saveProjectToCloud(savedProj);
  closeProjectModal();
  if (activeProjectId) {
    renderProjectDetail();
  } else {
    renderProjectsSection();
  }
  showToast("Projet enregistré !");
});

document.getElementById("btnDeleteProject").addEventListener("click", () => {
  if (!editingProjectId) return;
  const toDelete = editingProjectId;
  state.projects = (state.projects || []).filter((p) => p.id !== toDelete);
  if (activeProjectId === toDelete) activeProjectId = null;
  editingProjectId = null;
  deleteProjectFromCloud(toDelete);
  renderProjectsSection();
  closeProjectModal();
  showToast("Projet supprimé");
});
