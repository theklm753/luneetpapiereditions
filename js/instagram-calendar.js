// ============================================================
// FILTRE MULTI-SÉLECTION DE FORMATS (INSTAGRAM)
// ============================================================
let draggedPostId = null;

function getSelectedFormats() {
  return Array.from(document.querySelectorAll(".fmt-checkbox:checked")).map((cb) => cb.value);
}

function updateFormatFilterLabel() {
  const selected = getSelectedFormats();
  const labelEl = document.getElementById("formatFilterLabel");
  if (selected.length === VALID_FORMATS.length) {
    labelEl.textContent = "Tous les formats";
  } else if (selected.length === 0) {
    labelEl.textContent = "Aucun format";
  } else {
    labelEl.textContent = selected.map((f) => `${getFormatEmoji(f)} ${f}`).join(" + ");
  }
}

const formatFilterBtn = document.getElementById("formatFilterBtn");
const formatFilterMenu = document.getElementById("formatFilterMenu");

formatFilterBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  formatFilterMenu.classList.toggle("open");
});

formatFilterMenu.addEventListener("click", (e) => {
  e.stopPropagation();
});

document.addEventListener("click", () => {
  formatFilterMenu.classList.remove("open");
});

document.querySelectorAll(".fmt-checkbox").forEach((cb) => {
  cb.addEventListener("change", () => {
    updateFormatFilterLabel();
    renderPostsGrid();
    if (calendarViewMode === "month") renderCalendarMonthView();
  });
});

document.getElementById("btnFmtSelectAll").addEventListener("click", () => {
  document.querySelectorAll(".fmt-checkbox").forEach((cb) => { cb.checked = true; });
  updateFormatFilterLabel();
  renderPostsGrid();
  if (calendarViewMode === "month") renderCalendarMonthView();
});

document.getElementById("btnFmtNoStory").addEventListener("click", () => {
  document.querySelectorAll(".fmt-checkbox").forEach((cb) => {
    cb.checked = cb.value !== "Story";
  });
  updateFormatFilterLabel();
  renderPostsGrid();
  if (calendarViewMode === "month") renderCalendarMonthView();
});

// ============================================================
// EXPORT MODÈLE EXCEL (.xlsx) & IMPORT EXCEL (.xlsx/.xls/.csv)
// ============================================================
function downloadExcelTemplate() {
  if (typeof XLSX === "undefined") {
    showToast("Bibliothèque Excel indisponible (vérifiez votre connexion internet)");
    return;
  }

  const headers = [
    "Titre",
    "Date (AAAA-MM-JJ)",
    "Heure (HH:MM)",
    "Format",
    "Pilier",
    "Statut",
    "Objectif",
    "CTA",
    "Légende Instagram"
  ];

  const exampleRow = [
    "Exemple : Les coulisses de mon nouvel album",
    "2026-12-01",
    "18:00",
    "Carrousel",
    "Coulisses",
    "Préparation",
    "Créer de la proximité avant la sortie",
    "Enregistre ce post pour suivre la sortie",
    "Voici comment naît une illustration étape par étape ✨\n\nDu premier croquis au crayon jusqu'à la mise en couleur finale.\n\n👉 Enregistre ce post pour ne pas manquer la sortie !\n\n#illustration #jeunesse #coulisses"
  ];

  const wsPosts = XLSX.utils.aoa_to_sheet([headers, exampleRow]);
  wsPosts["!cols"] = [
    { wch: 36 }, { wch: 18 }, { wch: 14 }, { wch: 15 },
    { wch: 18 }, { wch: 15 }, { wch: 32 }, { wch: 32 }, { wch: 65 }
  ];

  const instructions = [
    ["Colonne", "Obligatoire", "Format / Valeurs acceptées"],
    ["Titre", "Oui", "Texte libre (titre interne de la publication)"],
    ["Date (AAAA-MM-JJ)", "Oui", "Format AAAA-MM-JJ (ex : 2026-12-05) ou date Excel standard"],
    ["Heure (HH:MM)", "Non", "Format HH:MM (ex : 18:00). Par défaut : 18:00"],
    ["Format", "Oui", "Carrousel | Reel | Story"],
    ["Pilier", "Oui", "Pédagogie | Coulisses | Offre / Produit | Preuve sociale"],
    ["Statut", "Oui", "Idée | Préparation | Validé | Programmé | Publié"],
    ["Objectif", "Non", "Objectif principal (Carrousel / Reel)"],
    ["CTA", "Non", "Appel à l'action (Carrousel / Reel)"],
    ["Légende Instagram", "Oui", "Légende complète (ou texte principal si le format est Story)"],
    ["", "", ""],
    ["Consigne pour Gemini :", "", "Remplis l'onglet 'Calendrier_Posts' en remplaçant la ligne d'exemple par les publications du calendrier éditorial, tout en conservant exactement les titres de colonnes en ligne 1."]
  ];

  const wsGuide = XLSX.utils.aoa_to_sheet(instructions);
  wsGuide["!cols"] = [{ wch: 24 }, { wch: 14 }, { wch: 70 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsPosts, "Calendrier_Posts");
  XLSX.utils.book_append_sheet(wb, wsGuide, "Instructions_Gemini");

  XLSX.writeFile(wb, "modele-calendrier-instagram.xlsx");
  showToast("Modèle Excel téléchargé !");
}

function normalizeKey(str) {
  return String(str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function matchAllowedValue(rawVal, allowedList, fallback) {
  const cleaned = normalizeKey(rawVal);
  if (!cleaned) return fallback;
  const exact = allowedList.find((item) => normalizeKey(item) === cleaned);
  if (exact) return exact;
  const partial = allowedList.find(
    (item) => normalizeKey(item).includes(cleaned) || cleaned.includes(normalizeKey(item))
  );
  return partial || fallback;
}

function parseExcelDate(val) {
  if (val === null || val === undefined || val === "") return "";
  if (typeof val === "number" && typeof XLSX !== "undefined" && XLSX.SSF) {
    const parsed = XLSX.SSF.parse_date_code(val);
    if (parsed && parsed.y && parsed.m && parsed.d) {
      return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
    }
  }
  const str = String(val).trim();
  let m = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) {
    return `${m[1]}-${String(m[2]).padStart(2, "0")}-${String(m[3]).padStart(2, "0")}`;
  }
  m = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (m) {
    return `${m[3]}-${String(m[2]).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}`;
  }
  return "";
}

function parseExcelTime(val) {
  if (val === null || val === undefined || val === "") return "18:00";
  if (typeof val === "number") {
    const totalMinutes = Math.round((val % 1) * 24 * 60);
    const h = Math.floor(totalMinutes / 60) % 24;
    const min = totalMinutes % 60;
    return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  }
  const str = String(val).trim();
  const m = str.match(/(\d{1,2})\s*[:hH]\s*(\d{1,2})?/);
  if (m) {
    const h = Math.min(23, Math.max(0, Number(m[1])));
    const min = Math.min(59, Math.max(0, Number(m[2] || 0)));
    return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  }
  return "18:00";
}

function getFieldFromRow(row, possiblePrefixes) {
  for (const [key, value] of Object.entries(row)) {
    const nk = normalizeKey(key);
    if (possiblePrefixes.some((p) => nk.includes(p))) {
      return value;
    }
  }
  return "";
}

function handleExcelImport(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  if (typeof XLSX === "undefined") {
    showToast("Bibliothèque Excel indisponible (vérifiez votre connexion internet)");
    event.target.value = "";
    return;
  }

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: "array" });

      const sheetName = workbook.SheetNames.includes("Calendrier_Posts")
        ? "Calendrier_Posts"
        : workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      if (!rows.length) {
        showToast("Le fichier Excel ne contient aucune ligne à importer.");
        return;
      }

      let importedCount = 0;
      let firstImportedDate = "";
      const baseTs = Date.now();
      const createdPosts = [];

      rows.forEach((row, idx) => {
        const rawTitle = String(getFieldFromRow(row, ["titre", "title", "sujet"]) || "").trim();
        const rawCaption = String(getFieldFromRow(row, ["legende", "caption", "texte", "description"]) || "").trim();
        const rawDate = getFieldFromRow(row, ["date"]);
        const rawTime = getFieldFromRow(row, ["heure", "time", "horaire"]);
        const rawFormat = getFieldFromRow(row, ["format", "type"]);
        const rawPilier = getFieldFromRow(row, ["pilier", "theme", "categorie"]);
        const rawStatut = getFieldFromRow(row, ["statut", "status", "etat"]);
        const rawObjectif = String(getFieldFromRow(row, ["objectif"]) || "").trim();
        const rawCta = String(getFieldFromRow(row, ["cta", "appel"]) || "").trim();

        if (!rawTitle && !rawCaption && !rawDate) return;

        const parsedDate = parseExcelDate(rawDate) || getTodayIso();
        if (!firstImportedDate && parsedDate) firstImportedDate = parsedDate;

        const matchedFormat = matchAllowedValue(rawFormat, VALID_FORMATS, "Carrousel");
        const isStory = matchedFormat === "Story";

        const newPost = {
          id: `p_${baseTs}_${idx}`,
          title: rawTitle || "Publication sans titre",
          date: parsedDate,
          time: parseExcelTime(rawTime),
          format: matchedFormat,
          pilier: matchAllowedValue(rawPilier, VALID_PILIERS, "Pédagogie"),
          statut: matchAllowedValue(rawStatut, VALID_STATUTS, "Préparation"),
          mediaId: "",
          objectif: isStory ? "" : rawObjectif,
          cta: isStory ? "" : rawCta,
          canvaUrl: "",
          metaUrl: "",
          caption: isStory ? "" : rawCaption,
          slides: [createEmptySlide("", isStory ? rawCaption : "", [])],
          storyText: isStory ? rawCaption : "",
          storyStickers: [],
          checklist: createEmptyChecklist(),
          stats: normalizeStats({})
        };

        state.posts.push(newPost);
        createdPosts.push(newPost);
        importedCount++;
      });

      if (importedCount === 0) {
        showToast("Aucun post valide trouvé dans le fichier Excel.");
        return;
      }

      if (firstImportedDate) {
        const [y, m] = firstImportedDate.split("-").map(Number);
        if (y && m) {
          currentCalendarDate = new Date(y, m - 1, 1);
        }
      }

      await Promise.all(createdPosts.map((p) => savePostToCloud(p)));
      switchToTab("calendrier", { skipAutoSave: true });
      renderDashboard();
      showToast(`${importedCount} publication(s) importée(s) et enregistrée(s) !`);
    } catch (err) {
      console.error("Erreur import Excel :", err);
      showToast("Impossible de lire ce fichier Excel.");
    } finally {
      event.target.value = "";
    }
  };

  reader.readAsArrayBuffer(file);
}

document.getElementById("btnDownloadExcelTemplate").addEventListener("click", downloadExcelTemplate);
document.getElementById("btnImportExcel").addEventListener("click", () => {
  document.getElementById("importExcelInput").click();
});
document.getElementById("importExcelInput").addEventListener("change", handleExcelImport);

// ============================================================
// FILTRES, VUE CARTES & VUE CALENDRIER MENSUEL (AVEC DRAG & DROP)
// ============================================================
function getFilteredPosts() {
  const statut = document.getElementById("filterStatut").value;
  const selectedFormats = getSelectedFormats();
  const pilier = document.getElementById("filterPilier").value;
  const q = document.getElementById("filterSearch").value.trim().toLowerCase();

  return state.posts
    .filter((p) => {
      if (!statut) return true;
      if (statut === "__RETARD__") return isPostOverdue(p);
      return p.statut === statut;
    })
    .filter((p) => selectedFormats.includes(p.format))
    .filter((p) => !pilier || p.pilier === pilier)
    .filter((p) => {
      if (!q) return true;
      const allSlidesText = (p.slides || []).map((s) => s.text || "").join(" ").toLowerCase();
      return (
        (p.title || "").toLowerCase().includes(q) ||
        (p.caption || "").toLowerCase().includes(q) ||
        allSlidesText.includes(q) ||
        (p.pilier || "").toLowerCase().includes(q)
      );
    })
    .sort((a, b) => ((a.date || "") + (a.time || "")).localeCompare((b.date || "") + (b.time || "")));
}

function renderPostsGrid() {
  const filtered = getFilteredPosts();
  const grid = document.getElementById("postsGrid");

  if (!filtered.length) {
    grid.innerHTML = `<div class="panel" style="grid-column: 1 / -1;">Aucune publication ne correspond aux filtres sélectionnés.</div>`;
    return;
  }

  grid.innerHTML = filtered
    .map((post) => {
      const slides = normalizeSlides(post);
      const firstMediaId = slides.find((s) => s.mediaId)?.mediaId || post.mediaId;
      const media = getMediaById(firstMediaId);
      const statusClass = getStatusColorClass(post);
      const statusLabel = getStatusDisplayLabel(post);
      const fmtEmoji = getFormatEmoji(post.format);
      const previewText = post.format === "Story"
        ? (slides.find((s) => s.text)?.text || post.storyText || "")
        : (post.caption || "");
      const totalStickers = slides.reduce((acc, s) => acc + (s.stickers?.length || 0), 0);
      const { done, total, pct } = computeChecklistProgress(post.checklist);

      return `
        <article class="post-card card-${statusClass}">
          <div class="post-thumb">
            <span class="format-pill">${fmtEmoji} ${post.format}</span>
            ${media ? `<img src="${media.src}" alt="${escapeHtml(post.title)}" />` : `<span>Sans visuel</span>`}
          </div>
          <div class="post-body">
            <div class="post-meta-top">
              <span>${post.date || "Date à définir"} • ${post.time || "--:--"}</span>
              <span class="status-badge ${statusClass}">${escapeHtml(statusLabel)}</span>
            </div>
            <h3 class="post-title">${fmtEmoji} ${escapeHtml(post.title || "Sans titre")}</h3>
            <div class="post-caption-preview">${escapeHtml(previewText)}</div>
            <div class="tag-row">
              <span class="mini-tag">${post.pilier}</span>
              ${slides.length > 1 ? `<span class="mini-tag">🖼️ ${slides.length} photos</span>` : ""}
              ${post.format === "Story" && totalStickers ? `<span class="mini-tag">✨ ${totalStickers} sticker(s)</span>` : ""}
            </div>
            <div class="card-progress-wrap" title="Avancement avant publication : ${done}/${total} étapes">
              <div class="card-progress-head">
                <span>Avancement (${done}/${total})</span>
                <span>${pct}%</span>
              </div>
              <div class="card-progress-track">
                <div class="card-progress-fill ${pct === 100 ? "complete" : ""}" style="width: ${pct}%;"></div>
              </div>
            </div>
            <div class="post-actions">
              <button class="sm primary" onclick="editPost('${post.id}')">Préparer / Éditer</button>
              <button class="sm danger" onclick="deletePost('${post.id}')">Supprimer</button>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function toIsoDate(year, monthIndex, day) {
  const m = String(monthIndex + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

function renderCalendarMonthView() {
  const year = currentCalendarDate.getFullYear();
  const month = currentCalendarDate.getMonth();
  const label = currentCalendarDate.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  document.getElementById("calendarMonthLabel").textContent = label;

  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const filteredPosts = getFilteredPosts();
  const todayIso = getTodayIso();

  const cells = [];

  for (let i = startOffset - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i;
    const prevMonthDate = new Date(year, month - 1, d);
    const iso = toIsoDate(prevMonthDate.getFullYear(), prevMonthDate.getMonth(), d);
    cells.push({ day: d, iso, muted: true });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const iso = toIsoDate(year, month, d);
    cells.push({ day: d, iso, muted: false });
  }

  while (cells.length % 7 !== 0) {
    const nextIndex = cells.length - (startOffset + daysInMonth) + 1;
    const nextMonthDate = new Date(year, month + 1, nextIndex);
    const iso = toIsoDate(nextMonthDate.getFullYear(), nextMonthDate.getMonth(), nextIndex);
    cells.push({ day: nextIndex, iso, muted: true });
  }

  document.getElementById("calendarDaysGrid").innerHTML = cells
    .map((c) => {
      const dayPosts = filteredPosts.filter((p) => p.date === c.iso);
      const isToday = c.iso === todayIso;
      return `
        <div
          class="cal-day ${c.muted ? "muted-day" : ""} ${isToday ? "today" : ""}"
          data-date="${c.iso}"
          ondragover="handleCalendarDragOver(event)"
          ondragleave="handleCalendarDragLeave(event)"
          ondrop="handleCalendarDrop(event, '${c.iso}')"
        >
          <div class="cal-day-num">
            <span>${c.day}</span>
            ${dayPosts.length ? `<span>${dayPosts.length}</span>` : ""}
          </div>
          ${dayPosts
            .map((p) => {
              const statusClass = getStatusColorClass(p);
              const statusLabel = getStatusDisplayLabel(p);
              const fmtEmoji = getFormatEmoji(p.format);
              const { done, total, pct } = computeChecklistProgress(p.checklist);
              const tooltip = `${fmtEmoji} [${p.format} • ${statusLabel} • Avancement ${pct}% (${done}/${total})] ${p.time ? p.time + " — " : ""}${p.title || ""}`;
              const labelText = `${fmtEmoji} ${p.time ? p.time + " " : ""}${p.title || p.format}`;
              return `
                <div
                  class="cal-event-wrap"
                  draggable="true"
                  ondragstart="handleCalendarDragStart(event, '${p.id}')"
                  ondragend="handleCalendarDragEnd(event)"
                >
                  <button type="button" class="cal-event ${statusClass}" title="${escapeHtml(tooltip)}" onclick="editPost('${p.id}')">${escapeHtml(labelText)}</button>
                  <div class="cal-event-progress" title="Avancement : ${pct}% (${done}/${total} étapes)">
                    <div class="cal-event-progress-track">
                      <div class="cal-event-progress-fill ${pct === 100 ? "complete" : ""}" style="width: ${pct}%;"></div>
                    </div>
                    <span class="cal-event-progress-pct">${pct}%</span>
                  </div>
                </div>
              `;
            })
            .join("")}
        </div>
      `;
    })
    .join("");
}

window.handleCalendarDragStart = function (event, postId) {
  draggedPostId = postId;
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", postId);
  event.currentTarget.classList.add("dragging");
};

window.handleCalendarDragEnd = function (event) {
  draggedPostId = null;
  event.currentTarget.classList.remove("dragging");
  document.querySelectorAll(".cal-day.drag-over").forEach((el) => {
    el.classList.remove("drag-over");
  });
};

window.handleCalendarDragOver = function (event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
  event.currentTarget.classList.add("drag-over");
};

window.handleCalendarDragLeave = function (event) {
  const dayEl = event.currentTarget;
  if (!dayEl.contains(event.relatedTarget)) {
    dayEl.classList.remove("drag-over");
  }
};

window.handleCalendarDrop = function (event, targetIsoDate) {
  event.preventDefault();
  document.querySelectorAll(".cal-day.drag-over").forEach((el) => {
    el.classList.remove("drag-over");
  });

  const postId = draggedPostId || event.dataTransfer.getData("text/plain");
  draggedPostId = null;
  if (!postId) return;

  const post = state.posts.find((p) => p.id === postId);
  if (!post || post.date === targetIsoDate) return;

  post.date = targetIsoDate;
  savePostToCloud(post);
  renderCalendarMonthView();
  renderPostsGrid();
  renderDashboard();
  renderStatisticsSection();

  showToast(`Post déplacé au ${formatShortFrenchDate(targetIsoDate)}`);
};

function applyCalendarViewMode() {
  const showMonth = calendarViewMode === "month";
  document.getElementById("postsGrid").style.display = showMonth ? "none" : "grid";
  document.getElementById("calendarMonthView").style.display = showMonth ? "block" : "none";
  document.getElementById("viewModeCards").classList.toggle("active", !showMonth);
  document.getElementById("viewModeMonth").classList.toggle("active", showMonth);
  if (showMonth) renderCalendarMonthView();
}

document.getElementById("viewModeCards").addEventListener("click", () => {
  calendarViewMode = "cards";
  applyCalendarViewMode();
});

document.getElementById("viewModeMonth").addEventListener("click", () => {
  calendarViewMode = "month";
  applyCalendarViewMode();
});

document.getElementById("btnPrevMonth").addEventListener("click", () => {
  currentCalendarDate = new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth() - 1, 1);
  renderCalendarMonthView();
});

document.getElementById("btnNextMonth").addEventListener("click", () => {
  currentCalendarDate = new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth() + 1, 1);
  renderCalendarMonthView();
});

["filterStatut", "filterPilier", "filterSearch"].forEach((id) => {
  document.getElementById(id).addEventListener("input", () => {
    renderPostsGrid();
    if (calendarViewMode === "month") renderCalendarMonthView();
  });
  document.getElementById(id).addEventListener("change", () => {
    renderPostsGrid();
    if (calendarViewMode === "month") renderCalendarMonthView();
  });
});

// ============================================================
// SUIVI DES STATISTIQUES
// ============================================================
function renderStatisticsSection() {
  let totalReach = 0;
  let totalInteractions = 0;
  let totalSaves = 0;
  let totalClicks = 0;

  state.posts.forEach((p) => {
    const st = normalizeStats(p.stats);
    totalReach += st.reach;
    totalInteractions += st.likes + st.comments + st.saves + st.shares;
    totalSaves += st.saves;
    totalClicks += st.clicks;
  });

  const avgEng = totalReach > 0 ? ((totalInteractions / totalReach) * 100).toFixed(1) + "%" : "0.0%";

  document.getElementById("statsKpis").innerHTML = `
    <div class="kpi"><div class="label">Portée cumulée</div><div class="value">${totalReach.toLocaleString("fr-FR")}</div></div>
    <div class="kpi"><div class="label">Interactions totales</div><div class="value">${totalInteractions.toLocaleString("fr-FR")}</div></div>
    <div class="kpi"><div class="label">Enregistrements totaux</div><div class="value">${totalSaves.toLocaleString("fr-FR")}</div></div>
    <div class="kpi"><div class="label">Clics totaux</div><div class="value">${totalClicks.toLocaleString("fr-FR")}</div></div>
    <div class="kpi"><div class="label">Engagement moyen / portée</div><div class="value">${avgEng}</div></div>
  `;

  const tbody = document.getElementById("statsTableBody");
  if (!state.posts.length) {
    tbody.innerHTML = `<tr><td colspan="13">Aucune publication à afficher.</td></tr>`;
    return;
  }

  tbody.innerHTML = state.posts
    .map((p) => {
      const st = normalizeStats(p.stats);
      const statusClass = getStatusColorClass(p);
      const statusLabel = getStatusDisplayLabel(p);
      const fmtEmoji = getFormatEmoji(p.format);
      return `
        <tr>
          <td><strong>${fmtEmoji} ${escapeHtml(p.title || "Sans titre")}</strong></td>
          <td>${escapeHtml(p.date || "—")}</td>
          <td><span class="format-badge">${fmtEmoji} ${escapeHtml(p.format)}</span></td>
          <td><span class="status-badge ${statusClass}">${escapeHtml(statusLabel)}</span></td>
          <td>${escapeHtml(p.pilier)}</td>
          <td><input type="number" min="0" id="st-reach-${p.id}" value="${st.reach}" /></td>
          <td><input type="number" min="0" id="st-likes-${p.id}" value="${st.likes}" /></td>
          <td><input type="number" min="0" id="st-comments-${p.id}" value="${st.comments}" /></td>
          <td><input type="number" min="0" id="st-saves-${p.id}" value="${st.saves}" /></td>
          <td><input type="number" min="0" id="st-shares-${p.id}" value="${st.shares}" /></td>
          <td><input type="number" min="0" id="st-clicks-${p.id}" value="${st.clicks}" /></td>
          <td><strong>${computeEngagementRate(st)}</strong></td>
          <td><button class="sm primary" onclick="savePostStats('${p.id}')">Enregistrer</button></td>
        </tr>
      `;
    })
    .join("");
}

window.savePostStats = function (postId) {
  const idx = state.posts.findIndex((p) => p.id === postId);
  if (idx === -1) return;

  state.posts[idx].stats = {
    reach: Number(document.getElementById(`st-reach-${postId}`).value) || 0,
    likes: Number(document.getElementById(`st-likes-${postId}`).value) || 0,
    comments: Number(document.getElementById(`st-comments-${postId}`).value) || 0,
    saves: Number(document.getElementById(`st-saves-${postId}`).value) || 0,
    shares: Number(document.getElementById(`st-shares-${postId}`).value) || 0,
    clicks: Number(document.getElementById(`st-clicks-${postId}`).value) || 0
  };

  savePostToCloud(state.posts[idx]);
  renderStatisticsSection();
  showToast("Statistiques mises à jour");
};
