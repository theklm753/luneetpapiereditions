// ============================================================
// GESTION DES PROJETS (LISTE + DRAG & DROP + VUE DÉTAIL)
// ============================================================
function renderProjectsSection() {
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
  saveProjectToCloud(project);
  renderProjectsSection();

  const meta = PROJECT_STATUSES.find((s) => s.key === targetStatusKey);
  showToast(`Projet déplacé dans « ${meta ? meta.label : targetStatusKey} »`);
};

window.openProjectDetail = function (projectId) {
  activeProjectId = projectId;
  renderProjectDetail();
};

window.closeProjectDetail = function () {
  activeProjectId = null;
  renderProjectsSection();
};

function getActiveProject() {
  return (state.projects || []).find((p) => p.id === activeProjectId) || null;
}

function renderProjectDetail() {
  const proj = getActiveProject();
  if (!proj) {
    closeProjectDetail();
    return;
  }

  document.getElementById("projectsListView").style.display = "none";
  document.getElementById("projectDetailView").style.display = "block";

  if (!Array.isArray(proj.items)) proj.items = [];
  const pct = computeProjectProgress(proj);
  proj.progress = pct;

  document.getElementById("projDetailTitle").textContent = proj.title;

  const barEl = document.getElementById("projDetailProgressBar");
  barEl.style.width = pct + "%";
  barEl.className = `project-progress-fill fill-${proj.status}`;

  const pctEl = document.getElementById("projDetailProgressPct");
  pctEl.textContent = pct + "%";
  const statusMeta = PROJECT_STATUSES.find((s) => s.key === proj.status);
  pctEl.className = `project-detail-pct-big ${statusMeta ? statusMeta.kpiClass : "kpi-yellow"}`;

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
      return `
        <div class="illus-card">
          <div class="illus-image-box" onclick="triggerProjectIllusUpload('${it.id}')" title="Cliquez pour importer une illustration">
            ${it.imageSrc ? `<img src="${it.imageSrc}" alt="Illustration ${idx + 1}" />` : `<span>🖼️ Importer l'illustration ${idx + 1}</span>`}
            <div class="illus-upload-overlay">${it.imageSrc ? "Changer l'illustration" : "Importer une illustration"}</div>
          </div>

          <div class="illus-card-controls">
            <select class="illus-status-select illus-status-${it.illusStatus}" onchange="updateProjectItemField('${it.id}', 'illusStatus', this.value)" title="Statut de l'illustration">
              <option value="a_demarrer" ${it.illusStatus === "a_demarrer" ? "selected" : ""}>Illustration : à démarrer</option>
              <option value="en_cours" ${it.illusStatus === "en_cours" ? "selected" : ""}>Illustration : en cours</option>
              <option value="finalise" ${it.illusStatus === "finalise" ? "selected" : ""}>Illustration : finalisée</option>
            </select>
            <button type="button" class="sm danger" onclick="deleteProjectItem('${it.id}')" title="Supprimer cette page">✕</button>
          </div>

          <textarea
            class="illus-text-area"
            placeholder="Il était une fois..."
            oninput="updateProjectItemText('${it.id}', this.value)"
          >${escapeHtml(it.text || "")}</textarea>

          <div class="illus-card-controls">
            <select class="illus-status-select illus-status-${it.textStatus}" onchange="updateProjectItemField('${it.id}', 'textStatus', this.value)" title="Statut du texte">
              <option value="a_demarrer" ${it.textStatus === "a_demarrer" ? "selected" : ""}>Texte : à démarrer</option>
              <option value="en_cours" ${it.textStatus === "en_cours" ? "selected" : ""}>Texte : en cours</option>
              <option value="finalise" ${it.textStatus === "finalise" ? "selected" : ""}>Texte : finalisé</option>
            </select>
            <span style="font-size: 11px; font-weight: 700; color: #5b4ce6;">Page ${idx + 1}</span>
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
}

window.addProjectIllustration = function () {
  const proj = getActiveProject();
  if (!proj) return;
  if (!Array.isArray(proj.items)) proj.items = [];
  proj.items.push(createEmptyProjectItem());
  proj.progress = computeProjectProgress(proj);
  saveProjectToCloud(proj);
  renderProjectDetail();
  showToast("Illustration ajoutée");
};

window.deleteProjectItem = function (itemId) {
  const proj = getActiveProject();
  if (!proj) return;
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
  saveProjectToCloud(proj);
  renderProjectDetail();
};

let projectTextSaveTimer = null;
window.updateProjectItemText = function (itemId, value) {
  const proj = getActiveProject();
  if (!proj) return;
  const item = (proj.items || []).find((i) => i.id === itemId);
  if (!item) return;
  item.text = value;
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
  const proj = getActiveProject();
  if (!proj) return;
  const item = (proj.items || []).find((i) => i.id === pendingUploadItemId);
  if (!item) return;

  showToast("Envoi de l'illustration en cours...");
  setSyncStatus("syncing", "⏳ Envoi photo...");
  try {
    const secureUrl = await uploadFileToCloudinary(file);
    item.imageSrc = secureUrl;
    await saveProjectToCloud(proj);
    renderProjectDetail();
    showToast("Illustration enregistrée dans le Cloud !");
  } catch (err) {
    console.error("Erreur import illustration :", err);
    setSyncStatus("error", "⚠️ Erreur photo");
    showToast("Erreur lors de l'envoi de l'illustration");
  } finally {
    pendingUploadItemId = null;
    e.target.value = "";
  }
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
  const notes = document.getElementById("projNotes").value.trim();

  if (!Array.isArray(state.projects)) state.projects = [];

  let savedProj;
  if (editingProjectId) {
    const idx = state.projects.findIndex((p) => p.id === editingProjectId);
    if (idx !== -1) {
      state.projects[idx] = { ...state.projects[idx], title, status, notes };
      savedProj = state.projects[idx];
    }
  } else {
    savedProj = {
      id: "proj_" + Date.now(),
      title,
      status,
      progress: 0,
      notes,
      items: [createEmptyProjectItem()]
    };
    state.projects.push(savedProj);
    activeProjectId = savedProj.id;
  }

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
