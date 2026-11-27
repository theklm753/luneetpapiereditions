// ============================================================
// TABLEAU DE BORD : DATE + TO-DO (RÉCURRENTES + AUTO INSTAGRAM)
// ============================================================
function isManualTaskDueToday(task, todayIso) {
  if (!task.date) return true;
  if (task.date > todayIso) return false;
  if (task.recurrence === "daily") return true;
  if (task.recurrence === "weekly") {
    const start = new Date(task.date + "T00:00:00");
    const today = new Date(todayIso + "T00:00:00");
    return start.getDay() === today.getDay();
  }
  if (task.recurrence === "monthly") {
    const startDay = Number(task.date.split("-")[2]);
    const todayDay = Number(todayIso.split("-")[2]);
    return startDay === todayDay;
  }
  if (task.date === todayIso) return true;
  return !(task.completedDates || []).length;
}

function formatShortFrenchDate(isoDate) {
  if (!isoDate) return "";
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return isoDate;
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
}

function getAutoInstagramTasks(todayIso) {
  const today = new Date(todayIso + "T00:00:00");
  const limit = new Date(today);
  limit.setDate(limit.getDate() + 14);
  const limitIso = `${limit.getFullYear()}-${String(limit.getMonth() + 1).padStart(2, "0")}-${String(limit.getDate()).padStart(2, "0")}`;

  const actionByStatus = {
    "Idée": "Préparer",
    "Préparation": "Finaliser",
    "Validé": "Programmer",
    "Programmé": "Vérifier"
  };

  const articleByFormat = {
    "Story": "la story",
    "Carrousel": "le carrousel",
    "Reel": "le reel"
  };

  return state.posts
    .filter((p) => p.statut !== "Publié" && p.date && p.date <= limitIso)
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""))
    .map((p) => {
      const action = actionByStatus[p.statut] || "Préparer";
      const art = articleByFormat[p.format] || "la publication";
      const dateFr = formatShortFrenchDate(p.date);
      const autoKey = `auto_${p.id}_${p.statut}`;
      return {
        autoKey,
        postId: p.id,
        title: `${action} ${art} du ${dateFr}`,
        subtitle: `${getFormatEmoji(p.format)} ${p.title || ""}`,
        overdue: isPostOverdue(p),
        done: (state.completedAutoTasks || []).includes(autoKey)
      };
    });
}

function renderDashboard() {
  const now = new Date();
  const todayIso = getTodayIso();

  document.getElementById("dashDayNumber").textContent = now.getDate();
  const monthYear = now.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  document.getElementById("dashMonthYear").textContent =
    monthYear.charAt(0).toUpperCase() + monthYear.slice(1);

  const container = document.getElementById("dashboardTodoList");
  const manualTasks = (state.tasks || []).filter((t) => isManualTaskDueToday(t, todayIso));
  const autoTasks = getAutoInstagramTasks(todayIso);

  if (!manualTasks.length && !autoTasks.length) {
    container.innerHTML = `<div style="color: var(--muted); font-size: 14px; padding: 12px 4px;">Aucune tâche prévue aujourd'hui. Cliquez sur <strong>+ ajouter une tâche</strong> pour en programmer une.</div>`;
    return;
  }

  const manualHtml = manualTasks
    .map((t) => {
      const isDone = (t.completedDates || []).includes(todayIso);
      const recBadge = t.recurrence !== "none"
        ? `<span class="todo-badge">🔁 ${RECURRENCE_LABELS[t.recurrence]}</span>`
        : (t.date < todayIso && !isDone ? `<span class="todo-badge overdue">En retard</span>` : "");
      return `
        <div class="todo-item ${isDone ? "done" : ""}">
          <div class="todo-item-left">
            <button type="button" class="todo-circle ${isDone ? "checked" : ""}" onclick="toggleManualTask('${t.id}')" title="Marquer comme fait">
              ${isDone ? "✓" : ""}
            </button>
            <div class="todo-text-wrap">
              <span class="todo-title">${escapeHtml(t.title)}</span>
              ${recBadge ? `<div class="todo-meta">${recBadge}</div>` : ""}
            </div>
          </div>
          <div class="todo-actions">
            <button type="button" class="sm" onclick="openTaskModal('${t.id}')" title="Modifier">✏️</button>
          </div>
        </div>
      `;
    })
    .join("");

  const autoHtml = autoTasks
    .map((at) => {
      return `
        <div class="todo-item ${at.done ? "done" : ""}">
          <div class="todo-item-left">
            <button type="button" class="todo-circle ${at.done ? "checked" : ""}" onclick="toggleAutoTask('${at.autoKey}')" title="Marquer comme fait">
              ${at.done ? "✓" : ""}
            </button>
            <div class="todo-text-wrap">
              <span class="todo-title">${escapeHtml(at.title)}</span>
              <div class="todo-meta">
                <span class="todo-badge auto-ig">Calendrier édito</span>
                ${at.overdue ? `<span class="todo-badge overdue">Date dépassée</span>` : ""}
                <span>${escapeHtml(at.subtitle)}</span>
              </div>
            </div>
          </div>
          <div class="todo-actions">
            <button type="button" class="sm" onclick="openPostFromDashboard('${at.postId}')" title="Ouvrir le post">Ouvrir ↗</button>
          </div>
        </div>
      `;
    })
    .join("");

  container.innerHTML = manualHtml + autoHtml;
}

window.toggleManualTask = function (taskId) {
  const todayIso = getTodayIso();
  const task = (state.tasks || []).find((t) => t.id === taskId);
  if (!task) return;
  if (!Array.isArray(task.completedDates)) task.completedDates = [];
  if (task.completedDates.includes(todayIso)) {
    task.completedDates = task.completedDates.filter((d) => d !== todayIso);
  } else {
    task.completedDates.push(todayIso);
  }
  saveTaskToCloud(task);
  renderDashboard();
};

window.toggleAutoTask = function (autoKey) {
  if (!Array.isArray(state.completedAutoTasks)) state.completedAutoTasks = [];
  if (state.completedAutoTasks.includes(autoKey)) {
    state.completedAutoTasks = state.completedAutoTasks.filter((k) => k !== autoKey);
  } else {
    state.completedAutoTasks.push(autoKey);
  }
  saveMetaToCloud();
  renderDashboard();
};

window.openPostFromDashboard = function (postId) {
  switchMainSection("instagram");
  editPost(postId);
};

window.openTaskModal = function (taskId = null) {
  const task = taskId ? (state.tasks || []).find((t) => t.id === taskId) : null;
  editingTaskId = task ? task.id : null;

  document.getElementById("taskModalTitle").textContent = task ? "Modifier la tâche" : "Ajouter une tâche";
  document.getElementById("taskTitle").value = task?.title || "";
  document.getElementById("taskDate").value = task?.date || getTodayIso();
  document.getElementById("taskRecurrence").value = task?.recurrence || "none";
  document.getElementById("btnDeleteTask").style.display = task ? "inline-block" : "none";

  document.getElementById("taskModal").classList.add("open");
};

function closeTaskModal() {
  document.getElementById("taskModal").classList.remove("open");
}

document.getElementById("btnAddTask").addEventListener("click", () => openTaskModal(null));
document.getElementById("btnCloseTaskModal").addEventListener("click", closeTaskModal);
document.getElementById("btnCancelTask").addEventListener("click", closeTaskModal);
document.getElementById("taskModal").addEventListener("click", (e) => {
  if (e.target.id === "taskModal") closeTaskModal();
});

document.getElementById("btnSaveTask").addEventListener("click", () => {
  const title = document.getElementById("taskTitle").value.trim();
  if (!title) {
    showToast("Veuillez saisir un intitulé de tâche");
    return;
  }
  const date = document.getElementById("taskDate").value || getTodayIso();
  const recurrence = document.getElementById("taskRecurrence").value;

  if (!Array.isArray(state.tasks)) state.tasks = [];

  let savedTask;
  if (editingTaskId) {
    const idx = state.tasks.findIndex((t) => t.id === editingTaskId);
    if (idx !== -1) {
      state.tasks[idx] = { ...state.tasks[idx], title, date, recurrence };
      savedTask = state.tasks[idx];
    }
  } else {
    savedTask = {
      id: "task_" + Date.now(),
      title,
      date,
      recurrence,
      completedDates: []
    };
    state.tasks.push(savedTask);
  }

  if (savedTask) saveTaskToCloud(savedTask);
  renderDashboard();
  closeTaskModal();
  showToast("Tâche enregistrée !");
});

document.getElementById("btnDeleteTask").addEventListener("click", () => {
  if (!editingTaskId) return;
  const toDelete = editingTaskId;
  state.tasks = (state.tasks || []).filter((t) => t.id !== toDelete);
  editingTaskId = null;
  deleteTaskFromCloud(toDelete);
  renderDashboard();
  closeTaskModal();
  showToast("Tâche supprimée");
});
