// ============================================================
// LES 4 TRACKERS QUOTIDIENS + TRACKER GLOBAL (0/4 -> 4/4)
// ============================================================
let selectedTrackerDate = getTodayIso();
let trackerViewRange = "week"; // "week" | "month"

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

function renderGlobalTrackerSummary(dateIso) {
  const box = document.getElementById("globalTrackerCard");
  if (!box) return;

  const completedCount = TRACKER_DEFS.filter((def) =>
    Boolean(getTrackerDayEntry(def.key, dateIso).active)
  ).length;
  const totalCount = TRACKER_DEFS.length;

  const levelLabels = {
    0: "Aucun tracker complété",
    1: "1 tracker complété sur 4",
    2: "2 trackers complétés sur 4",
    3: "3 trackers complétés sur 4",
    4: "Tous les trackers complétés !"
  };

  box.className = `global-tracker-card gt-level-${completedCount}`;
  box.innerHTML = `
    <div class="gt-top">
      <span>Tracker global</span>
      <span>${formatDateFrSlash(dateIso)}</span>
    </div>
    <div class="gt-score">${completedCount} / ${totalCount}</div>
    <div class="gt-sub">${escapeHtml(levelLabels[completedCount] || "")}</div>
  `;
}

function renderDashboardTrackers() {
  renderGlobalTrackerSummary(selectedTrackerDate);

  const grid = document.getElementById("dashboardTrackersGrid");
  if (!grid) return;

  const dateInput = document.getElementById("trackerDateInput");
  if (dateInput) dateInput.value = selectedTrackerDate;

  const rangeSelect = document.getElementById("trackerRangeSelect");
  if (rangeSelect) rangeSelect.value = trackerViewRange;

  const windowDates = getTrackerWindowDates(selectedTrackerDate, trackerViewRange);

  grid.innerHTML = TRACKER_DEFS.map((def) => {
    const streak = computeTrackerStreak(def.key, selectedTrackerDate);

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
          <span class="tracker-streak-row" style="margin:0; padding:4px 9px;">🔥 ${streak} j</span>
        </div>

        <div class="tracker-mini-cal">${calHtml}</div>
      </div>
    `;
  }).join("");
}

window.selectAndToggleTrackerDay = function (trackerKey, isoDate) {
  selectedTrackerDate = isoDate;
  const current = Boolean(getTrackerDayEntry(trackerKey, isoDate).active);
  setTrackerDayActive(trackerKey, isoDate, !current);
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
