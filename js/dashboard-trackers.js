// ============================================================
// LES 4 TRACKERS QUOTIDIENS (INSTA, CREATIV, EDIT, ENGAGEMENT)
// ============================================================
let selectedTrackerDate = getTodayIso();
let trackerViewRange = "week"; // "week" | "month"
let trackerNoteSaveTimer = null;

function ensureTrackersState() {
  state.trackers = normalizeTrackers(state.trackers);
  return state.trackers;
}

function recordTrackerAction(trackerKey, isoDate = getTodayIso()) {
  const trackers = ensureTrackersState();
  if (!trackers[trackerKey]) trackers[trackerKey] = {};
  const prev = trackers[trackerKey][isoDate] || { active: false, note: "" };
  if (!prev.active) {
    trackers[trackerKey][isoDate] = { active: true, note: prev.note || "" };
    saveMetaToCloud();
  }
}

function setTrackerDayActive(trackerKey, isoDate, active) {
  const trackers = ensureTrackersState();
  if (!trackers[trackerKey]) trackers[trackerKey] = {};
  const prev = trackers[trackerKey][isoDate] || { active: false, note: "" };
  trackers[trackerKey][isoDate] = { active: Boolean(active), note: prev.note || "" };
  saveMetaToCloud();
  renderDashboardTrackers();
}

function getTrackerDayEntry(trackerKey, isoDate) {
  const trackers = ensureTrackersState();
  return trackers[trackerKey]?.[isoDate] || { active: false, note: "" };
}

function computeTrackerStreak(trackerKey, refIso) {
  let streak = 0;
  const base = new Date(refIso + "T00:00:00");
  for (let i = 0; i < 365; i++) {
    const dt = new Date(base);
    dt.setDate(dt.getDate() - i);
    const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    if (getTrackerDayEntry(trackerKey, iso).active) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

function getTrackerWindowDates(refIso, rangeMode) {
  const base = new Date(refIso + "T00:00:00");
  const out = [];

  if (rangeMode === "month") {
    const y = base.getFullYear();
    const m = base.getMonth();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      out.push(`${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
    }
    return out;
  }

  // Semaine en cours (lundi -> dimanche)
  const day = base.getDay();
  const diffToMon = (day + 6) % 7;
  const monday = new Date(base);
  monday.setDate(base.getDate() - diffToMon);

  for (let i = 0; i < 7; i++) {
    const dt = new Date(monday);
    dt.setDate(monday.getDate() + i);
    out.push(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`);
  }
  return out;
}

function renderDashboardTrackers() {
  const grid = document.getElementById("dashboardTrackersGrid");
  if (!grid) return;

  const dateInput = document.getElementById("trackerDateInput");
  if (dateInput) dateInput.value = selectedTrackerDate;

  const rangeSelect = document.getElementById("trackerRangeSelect");
  if (rangeSelect) rangeSelect.value = trackerViewRange;

  const windowDates = getTrackerWindowDates(selectedTrackerDate, trackerViewRange);

  grid.innerHTML = TRACKER_DEFS.map((def) => {
    const entry = getTrackerDayEntry(def.key, selectedTrackerDate);
    const isOk = Boolean(entry.active);
    const streak = computeTrackerStreak(def.key, selectedTrackerDate);
    const okCount = windowDates.filter((d) => getTrackerDayEntry(def.key, d).active).length;
    const ratePct = windowDates.length ? Math.round((okCount / windowDates.length) * 100) : 0;

    const calHtml = windowDates
      .map((iso) => {
        const dayOk = Boolean(getTrackerDayEntry(def.key, iso).active);
        const dayNum = Number(iso.split("-")[2]);
        const isSel = iso === selectedTrackerDate;
        return `
          <div
            class="tracker-day-cell ${dayOk ? "cal-ok" : "cal-ko"} ${isSel ? "selected" : ""}"
            title="${iso} : ${dayOk ? "Action faite" : "Aucune action"}"
            onclick="selectAndToggleTrackerDay('${def.key}', '${iso}')"
          >${dayNum}</div>
        `;
      })
      .join("");

    return `
      <div class="tracker-card">
        <div class="tracker-card-top">
          <h3 class="tracker-card-title">${def.icon} ${escapeHtml(def.label)}</h3>
          <span class="tracker-status-pill ${isOk ? "is-ok" : "is-ko"}">
            ${isOk ? "● Fait" : "● À faire"}
          </span>
        </div>

        <p class="tracker-desc">${escapeHtml(def.desc)}</p>

        <div class="tracker-streak-row">
          <span>🔥 Série : ${streak} j</span>
          <span>${ratePct}% (${okCount}/${windowDates.length})</span>
        </div>

        <div class="tracker-mini-cal">${calHtml}</div>

        <div style="display:flex; gap:6px; align-items:center;">
          <button
            type="button"
            class="sm ${isOk ? "" : "primary"}"
            style="flex:1;"
            onclick="setTrackerDayActive('${def.key}', '${selectedTrackerDate}', ${!isOk})"
          >${isOk ? "Passer en rouge" : "Marquer vert"}</button>
        </div>

        <input
          type="text"
          class="tracker-note-input"
          value="${escapeHtml(entry.note || "")}"
          placeholder="Note rapide du jour (${selectedTrackerDate})..."
          oninput="updateTrackerNote('${def.key}', '${selectedTrackerDate}', this.value)"
        />
      </div>
    `;
  }).join("");
}

window.selectAndToggleTrackerDay = function (trackerKey, isoDate) {
  selectedTrackerDate = isoDate;
  const current = Boolean(getTrackerDayEntry(trackerKey, isoDate).active);
  setTrackerDayActive(trackerKey, isoDate, !current);
};

window.updateTrackerNote = function (trackerKey, isoDate, noteVal) {
  const trackers = ensureTrackersState();
  if (!trackers[trackerKey]) trackers[trackerKey] = {};
  const prev = trackers[trackerKey][isoDate] || { active: false, note: "" };
  trackers[trackerKey][isoDate] = { active: prev.active, note: noteVal };
  clearTimeout(trackerNoteSaveTimer);
  trackerNoteSaveTimer = setTimeout(() => {
    saveMetaToCloud();
  }, 500);
};

document.getElementById("trackerDateInput")?.addEventListener("change", (e) => {
  if (e.target.value) {
    selectedTrackerDate = e.target.value;
    renderDashboardTrackers();
  }
});

document.getElementById("btnTrackerToday")?.addEventListener("click", () => {
  selectedTrackerDate = getTodayIso();
  renderDashboardTrackers();
});

document.getElementById("trackerRangeSelect")?.addEventListener("change", (e) => {
  trackerViewRange = e.target.value;
  renderDashboardTrackers();
});
