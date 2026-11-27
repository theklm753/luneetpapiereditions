// ============================================================
// NAVIGATION PRINCIPALE (TABLEAU DE BORD / INSTAGRAM / PROJETS)
// ============================================================
window.switchMainSection = function (sectionKey) {
  if (document.getElementById("tab-preparation").classList.contains("active")) {
    saveCurrentPost({ silent: true, reloadEditor: false });
  }
  document.querySelectorAll(".main-nav-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.main === sectionKey);
  });
  document.querySelectorAll(".main-view").forEach((view) => {
    view.classList.toggle("active", view.id === "main-" + sectionKey);
  });
  if (sectionKey === "tableau") renderDashboard();
  if (sectionKey === "projets") {
    if (activeProjectId) {
      renderProjectDetail();
    } else {
      renderProjectsSection();
    }
  }
  if (sectionKey === "instagram") renderInstagramAll();
};

document.querySelectorAll(".main-nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => switchMainSection(btn.dataset.main));
});

// ============================================================
// NAVIGATION ONGLETS INSTAGRAM
// ============================================================
function switchToTab(tabName, options = {}) {
  const wasEditing = document.getElementById("tab-preparation").classList.contains("active");
  if (wasEditing && tabName !== "preparation" && !options.skipAutoSave) {
    saveCurrentPost({ silent: true, reloadEditor: false });
  }
  document.querySelectorAll(".tab-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === tabName);
  });
  document.querySelectorAll(".section").forEach((s) => s.classList.remove("active"));
  const target = document.getElementById("tab-" + tabName);
  if (target) target.classList.add("active");
  renderInstagramAll();
}

document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => switchToTab(btn.dataset.tab));
});

document.getElementById("btnBackToCalendar").addEventListener("click", () => {
  saveCurrentPost({ silent: true, reloadEditor: false });
  switchToTab("calendrier", { skipAutoSave: true });
  showToast("Modifications enregistrées automatiquement !");
});

// ============================================================
// RENDU GLOBAL & DÉMARRAGE
// ============================================================
function renderInstagramAll() {
  updateFormatFilterLabel();
  renderPostsGrid();
  applyCalendarViewMode();
  updateEditorForFormat();
  renderStatisticsSection();
}

function renderAll() {
  renderDashboard();
  renderInstagramAll();
  if (activeProjectId) {
    renderProjectDetail();
  } else {
    renderProjectsSection();
  }
}

loadPostIntoEditor(editingPostId);
renderAll();
startRealtimeSync();
