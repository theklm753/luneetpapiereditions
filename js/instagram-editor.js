// ============================================================
// UTILITAIRE SLIDE COURANTE
// ============================================================
function getCurrentSlide() {
  if (!currentEditorSlides.length) {
    currentEditorSlides = [createEmptySlide()];
    currentSlideIndex = 0;
  }
  if (currentSlideIndex < 0) currentSlideIndex = 0;
  if (currentSlideIndex >= currentEditorSlides.length) currentSlideIndex = currentEditorSlides.length - 1;
  return currentEditorSlides[currentSlideIndex];
}

// ============================================================
// HISTORIQUE ANNULER (BOUTON PRÉCÉDENT) DANS L'ÉDITEUR
// ============================================================
function captureEditorSnapshot() {
  return {
    title: document.getElementById("postTitle").value,
    date: document.getElementById("postDate").value,
    time: document.getElementById("postTime").value,
    format: document.getElementById("postFormat").value,
    pilier: document.getElementById("postPilier").value,
    statut: document.getElementById("postStatut").value,
    canvaUrl: document.getElementById("postCanvaUrl").value,
    metaUrl: document.getElementById("postMetaUrl").value,
    objectif: document.getElementById("postObjectif").value,
    cta: document.getElementById("postCta").value,
    caption: document.getElementById("postCaption").value,
    slides: structuredClone(currentEditorSlides),
    slideIndex: currentSlideIndex,
    checklist: structuredClone(currentEditorChecklist),
    stats: getEditorStatsFromInputs()
  };
}

function updateUndoButtonState() {
  const btn = document.getElementById("btnUndoPost");
  if (!btn) return;
  btn.disabled = editorUndoStack.length <= 1;
}

function resetEditorUndoHistory() {
  clearTimeout(undoDebounceTimer);
  editorUndoStack = [captureEditorSnapshot()];
  updateUndoButtonState();
}

function pushEditorUndoSnapshot() {
  if (isRestoringUndo) return;
  clearTimeout(undoDebounceTimer);
  const snap = captureEditorSnapshot();
  const last = editorUndoStack[editorUndoStack.length - 1];
  if (last && JSON.stringify(last) === JSON.stringify(snap)) {
    return;
  }
  editorUndoStack.push(snap);
  if (editorUndoStack.length > 50) {
    editorUndoStack.shift();
  }
  updateUndoButtonState();
}

function scheduleEditorUndoSnapshot() {
  if (isRestoringUndo) return;
  clearTimeout(undoDebounceTimer);
  undoDebounceTimer = setTimeout(() => {
    pushEditorUndoSnapshot();
  }, 450);
}

function restoreEditorSnapshot(snap) {
  if (!snap) return;
  isRestoringUndo = true;
  try {
    document.getElementById("postTitle").value = snap.title || "";
    document.getElementById("postDate").value = snap.date || "";
    document.getElementById("postTime").value = snap.time || "18:00";
    document.getElementById("postFormat").value = normalizeFormat(snap.format);
    document.getElementById("postPilier").value = snap.pilier || "Pédagogie";
    document.getElementById("postStatut").value = snap.statut || "Idée";
    document.getElementById("postCanvaUrl").value = snap.canvaUrl || "";
    document.getElementById("postMetaUrl").value = snap.metaUrl || "";
    document.getElementById("postObjectif").value = snap.objectif || "";
    document.getElementById("postCta").value = snap.cta || "";
    document.getElementById("postCaption").value = snap.caption || "";

    currentEditorSlides = structuredClone(snap.slides || [createEmptySlide()]);
    currentSlideIndex = Math.min(Math.max(0, snap.slideIndex || 0), currentEditorSlides.length - 1);
    currentEditorChecklist = normalizeChecklist(snap.checklist);

    const st = normalizeStats(snap.stats);
    document.getElementById("perfReach").value = st.reach;
    document.getElementById("perfLikes").value = st.likes;
    document.getElementById("perfComments").value = st.comments;
    document.getElementById("perfSaves").value = st.saves;
    document.getElementById("perfShares").value = st.shares;
    document.getElementById("perfClicks").value = st.clicks;
    updatePerfSummaryPreview();

    const fmt = normalizeFormat(snap.format);
    document.getElementById("editorHeading").textContent = editingPostId
      ? `Préparer la publication : ${getFormatEmoji(fmt)} ${snap.title || "Sans titre"}`
      : "Créer une nouvelle publication";

    renderPostChecklist();
    updateEditorForFormat();
  } finally {
    isRestoringUndo = false;
  }
}

document.getElementById("btnUndoPost").addEventListener("click", () => {
  clearTimeout(undoDebounceTimer);
  const current = captureEditorSnapshot();
  const top = editorUndoStack[editorUndoStack.length - 1];
  if (top && JSON.stringify(current) !== JSON.stringify(top)) {
    restoreEditorSnapshot(top);
  } else if (editorUndoStack.length > 1) {
    editorUndoStack.pop();
    restoreEditorSnapshot(editorUndoStack[editorUndoStack.length - 1]);
  }
  updateUndoButtonState();
  showToast("Dernière modification annulée");
});

// ============================================================
// CHECKLIST "ÉTAPES AVANT PUBLICATION"
// ============================================================
function renderPostChecklist() {
  const { done, total, pct } = computeChecklistProgress(currentEditorChecklist);
  document.getElementById("postChecklistPctBadge").textContent = `${pct}% (${done}/${total})`;

  const bar = document.getElementById("postChecklistBarFill");
  bar.style.width = `${pct}%`;
  bar.classList.toggle("complete", pct === 100);

  const listEl = document.getElementById("postChecklistList");
  listEl.innerHTML = POST_CHECKLIST_STEPS.map((step) => {
    const isChecked = Boolean(currentEditorChecklist[step.key]);
    return `
      <div class="post-checklist-item ${isChecked ? "checked" : ""}" onclick="togglePostChecklistStep('${step.key}')">
        <span class="post-checklist-circle">${isChecked ? "✓" : ""}</span>
        <span class="post-checklist-text">${escapeHtml(step.label)}</span>
      </div>
    `;
  }).join("");
}

window.togglePostChecklistStep = function (stepKey) {
  currentEditorChecklist[stepKey] = !currentEditorChecklist[stepKey];
  renderPostChecklist();
  pushEditorUndoSnapshot();
};

// ============================================================
// GESTION MULTI-PHOTOS / SLIDES & STICKERS STORY
// ============================================================
window.selectSlide = function (idx) {
  if (idx < 0 || idx >= currentEditorSlides.length) return;
  currentSlideIndex = idx;
  syncEditorToCurrentSlide();
};

window.navigateSlide = function (delta) {
  if (currentEditorSlides.length <= 1) return;
  currentSlideIndex = (currentSlideIndex + delta + currentEditorSlides.length) % currentEditorSlides.length;
  syncEditorToCurrentSlide();
};

window.deleteSlide = function (idx, ev) {
  if (ev) ev.stopPropagation();
  if (currentEditorSlides.length <= 1) {
    currentEditorSlides[0].mediaId = "";
    currentEditorSlides[0].text = "";
    currentEditorSlides[0].stickers = [];
  } else {
    currentEditorSlides.splice(idx, 1);
    if (currentSlideIndex >= currentEditorSlides.length) {
      currentSlideIndex = currentEditorSlides.length - 1;
    }
  }
  syncEditorToCurrentSlide();
  pushEditorUndoSnapshot();
};

document.getElementById("btnAddEmptySlide").addEventListener("click", () => {
  currentEditorSlides.push(createEmptySlide());
  currentSlideIndex = currentEditorSlides.length - 1;
  syncEditorToCurrentSlide();
  pushEditorUndoSnapshot();
});

function renderSlidesStrip() {
  const strip = document.getElementById("slidesStrip");
  const format = document.getElementById("postFormat").value;
  const showMulti = format === "Story" || format === "Carrousel" || currentEditorSlides.length > 1;

  if (!showMulti || (currentEditorSlides.length === 1 && !currentEditorSlides[0].mediaId && format !== "Story")) {
    strip.style.display = "none";
    return;
  }

  strip.style.display = "flex";
  strip.innerHTML = currentEditorSlides
    .map((sl, idx) => {
      const media = getMediaById(sl.mediaId);
      const isActive = idx === currentSlideIndex;
      const delBtn = currentEditorSlides.length > 1
        ? `<button type="button" class="slide-chip-del" onclick="deleteSlide(${idx}, event)" title="Supprimer cette photo">✕</button>`
        : "";
      return `
        <div class="slide-chip ${isActive ? "active" : ""}" onclick="selectSlide(${idx})">
          <div class="slide-chip-thumb">
            ${media ? `<img src="\${media.src}" alt="Photo ${idx + 1}" />` : `<span>${idx + 1}</span>`}
          </div>
          <span>Photo ${idx + 1}</span>
          ${delBtn}
        </div>
      `;
    })
    .join("");
}

function syncEditorToCurrentSlide() {
  const slide = getCurrentSlide();
  const slideNum = currentSlideIndex + 1;
  const total = currentEditorSlides.length;
  const suffix = total > 1 ? ` (Photo ${slideNum} / ${total})` : "";

  document.getElementById("storyText").value = slide.text || "";
  document.getElementById("storyTextLabel").textContent = `Ajout de texte sur la Story${suffix}`;
  document.getElementById("storyStickersLabel").textContent = `Stickers & éléments interactifs${suffix}`;

  renderSlidesStrip();
  updateVisualIndicator();
  renderStoryStickersEditor();
  updateLivePreview();
}

window.addStorySticker = function (type) {
  const slide = getCurrentSlide();
  const defaults = {
    lieu: { value: "" },
    mention: { value: "@" },
    musique: { value: "", value2: "" },
    sondage: { value: "", value2: "Oui", value3: "Non" },
    lien: { value: "", value2: "" },
    hashtag: { value: "#" },
    curseur: { value: "", value2: "😍" },
    compte_a_rebours: { value: "", value2: "" }
  };
  slide.stickers.push({
    id: "st_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
    type,
    ...(defaults[type] || { value: "" })
  });
  renderStoryStickersEditor();
  updateLivePreview();
  pushEditorUndoSnapshot();
};

window.removeStorySticker = function (stickerId) {
  const slide = getCurrentSlide();
  slide.stickers = slide.stickers.filter((s) => s.id !== stickerId);
  renderStoryStickersEditor();
  updateLivePreview();
  pushEditorUndoSnapshot();
};

window.updateStoryStickerField = function (stickerId, field, newVal) {
  const slide = getCurrentSlide();
  const st = slide.stickers.find((s) => s.id === stickerId);
  if (st) {
    st[field] = newVal;
    updateLivePreview();
    scheduleEditorUndoSnapshot();
  }
};

function renderStoryStickersEditor() {
  const slide = getCurrentSlide();
  const container = document.getElementById("storyStickersEditorList");
  if (!slide.stickers.length) {
    container.innerHTML = `<div style="font-size: 12px; color: var(--muted);">Aucun sticker sur cette photo. Cliquez sur un bouton ci-dessus pour l'enrichir.</div>`;
    return;
  }

  container.innerHTML = slide.stickers
    .map((st) => {
      const meta = STICKER_META[st.type] || { label: st.type, placeholder: "Texte" };
      let fieldsHtml = `<input type="text" value="${escapeHtml(st.value || "")}" placeholder="${escapeHtml(meta.placeholder)}" oninput="updateStoryStickerField('${st.id}', 'value', this.value)" />`;

      if (meta.placeholder2) {
        fieldsHtml += `<input type="text" value="${escapeHtml(st.value2 || "")}" placeholder="${escapeHtml(meta.placeholder2)}" oninput="updateStoryStickerField('${st.id}', 'value2', this.value)" />`;
      }
      if (meta.placeholder3) {
        fieldsHtml += `<input type="text" value="${escapeHtml(st.value3 || "")}" placeholder="${escapeHtml(meta.placeholder3)}" oninput="updateStoryStickerField('${st.id}', 'value3', this.value)" />`;
      }

      return `
        <div class="sticker-editor-item">
          <div class="sticker-editor-head">
            <span>${meta.label}</span>
            <button type="button" class="sm danger" onclick="removeStorySticker('${st.id}')">✕</button>
          </div>
          <div class="sticker-editor-fields">${fieldsHtml}</div>
        </div>
      `;
    })
    .join("");
}

function renderStoryStickerPreview(st) {
  switch (st.type) {
    case "lieu":
      return `<div class="ig-sticker-pill">📍 ${escapeHtml(st.value || "Lieu")}</div>`;
    case "mention": {
      const txt = st.value ? (st.value.startsWith("@") ? st.value : "@" + st.value) : "@mention";
      return `<div class="ig-sticker-pill ig-sticker-mention">${escapeHtml(txt)}</div>`;
    }
    case "hashtag": {
      const txt = st.value ? (st.value.startsWith("#") ? st.value : "#" + st.value) : "#hashtag";
      return `<div class="ig-sticker-pill ig-sticker-hashtag">${escapeHtml(txt)}</div>`;
    }
    case "lien":
      return `<div class="ig-sticker-pill ig-sticker-link">🔗 ${escapeHtml(st.value || st.value2 || "Lien")}</div>`;
    case "musique":
      return `
        <div class="ig-sticker-music">
          <div class="ig-sticker-music-icon">🎵</div>
          <div>
            <div style="font-weight:700;">${escapeHtml(st.value || "Titre du morceau")}</div>
            <div style="color:var(--muted); font-size:10px;">${escapeHtml(st.value2 || "Artiste")}</div>
          </div>
        </div>`;
    case "sondage":
      return `
        <div class="ig-sticker-poll">
          <div class="ig-sticker-poll-q">${escapeHtml(st.value || "Votre question ?")}</div>
          <div class="ig-sticker-poll-opts">
            <span>${escapeHtml(st.value2 || "Oui")}</span>
            <span>${escapeHtml(st.value3 || "Non")}</span>
          </div>
        </div>`;
    case "curseur":
      return `
        <div class="ig-sticker-slider">
          <div class="ig-sticker-slider-q">${escapeHtml(st.value || "Votre avis ?")}</div>
          <div class="ig-sticker-slider-bar">
            <div class="ig-sticker-slider-fill"></div>
            <span class="ig-sticker-slider-emoji">${escapeHtml(st.value2 || "😍")}</span>
          </div>
        </div>`;
    case "compte_a_rebours":
      return `
        <div class="ig-sticker-countdown">
          <div class="ig-sticker-countdown-title">⏳ ${escapeHtml(st.value || "Compte à rebours")}</div>
          <div class="ig-sticker-countdown-val">${escapeHtml(st.value2 || "Bientôt disponible")}</div>
        </div>`;
    default:
      return "";
  }
}

function updateEditorForFormat() {
  const format = document.getElementById("postFormat").value;
  const isStory = format === "Story";
  const isMulti = isStory || format === "Carrousel";

  document.getElementById("standardCaptionBlock").style.display = isStory ? "none" : "block";
  document.getElementById("storyEditorBlock").style.display = isStory ? "block" : "none";
  document.getElementById("objectifCtaBlock").style.display = isStory ? "none" : "grid";
  document.getElementById("previewViewSwitch").style.display = isStory ? "none" : "inline-flex";
  document.getElementById("btnAddEmptySlide").style.display = isStory ? "inline-block" : "none";
  document.getElementById("btnCopyCaption").textContent = isStory ? "Copier le texte" : "Copier la légende";
  document.getElementById("btnUploadVisual").textContent = isMulti
    ? "🖼️ Importer une ou plusieurs photos"
    : "🖼️ Importer un visuel";

  if (isStory) {
    document.getElementById("previewFilContainer").style.display = "none";
    document.getElementById("previewFeedContainer").style.display = "none";
    document.getElementById("previewStoryContainer").style.display = "block";
    document.getElementById("previewPanelTitle").textContent = "Aperçu de la Story (9:16)";
  } else {
    document.getElementById("previewStoryContainer").style.display = "none";
    applyPreviewViewMode();
  }

  syncEditorToCurrentSlide();
}

document.getElementById("postFormat").addEventListener("change", () => {
  const titleVal = document.getElementById("postTitle").value.trim();
  const fmt = document.getElementById("postFormat").value;
  if (editingPostId) {
    document.getElementById("editorHeading").textContent =
      `Préparer la publication : ${getFormatEmoji(fmt)} ${titleVal || "Sans titre"}`;
  }
  updateEditorForFormat();
  pushEditorUndoSnapshot();
});

// ============================================================
// IMPORT VISUEL(S) VERS CLOUDINARY
// ============================================================
function updateVisualIndicator() {
  const slide = getCurrentSlide();
  const media = getMediaById(slide.mediaId);
  const nameEl = document.getElementById("currentVisualName");
  const removeBtn = document.getElementById("btnRemoveVisual");
  if (media) {
    nameEl.textContent = media.name || "Visuel importé";
    removeBtn.style.display = "inline-block";
  } else {
    nameEl.textContent = "Aucun visuel sur cette photo";
    removeBtn.style.display = "none";
  }
}

document.getElementById("btnUploadVisual").addEventListener("click", () => {
  document.getElementById("postMediaFileInput").click();
});

document.getElementById("postMediaFileInput").addEventListener("change", async (e) => {
  const files = Array.from(e.target.files || []);
  if (!files.length) return;

  const format = document.getElementById("postFormat").value;
  const allowMultiple = format === "Story" || format === "Carrousel";
  const filesToProcess = allowMultiple ? files : [files[0]];

  let firstNewIdx = currentSlideIndex;
  let uploadedCount = 0;

  showToast(filesToProcess.length > 1 ? "Envoi des photos en cours..." : "Envoi de la photo en cours...");
  setSyncStatus("syncing", "⏳ Envoi photo...");

  for (let i = 0; i < filesToProcess.length; i++) {
    const file = filesToProcess[i];
    try {
      const secureUrl = await uploadFileToCloudinary(file);
      const newMediaId = `m_${Date.now()}_${i}`;
      const mediaItem = {
        id: newMediaId,
        name: file.name,
        tags: [],
        ratioNote: "Visuel importé",
        src: secureUrl
      };

      state.media.unshift(mediaItem);
      await saveMediaToCloud(mediaItem);

      const activeSlide = getCurrentSlide();
      if (i === 0 && !activeSlide.mediaId) {
        activeSlide.mediaId = newMediaId;
        firstNewIdx = currentSlideIndex;
      } else if (!allowMultiple) {
        activeSlide.mediaId = newMediaId;
        firstNewIdx = currentSlideIndex;
      } else {
        currentEditorSlides.push(createEmptySlide(newMediaId, "", []));
        if (i === 0) firstNewIdx = currentEditorSlides.length - 1;
      }
      uploadedCount++;
    } catch (err) {
      console.error("Erreur import image :", err);
      showToast("Erreur lors de l'envoi d'une image");
    }
  }

  setSyncStatus("ok", "☁️ Synchronisé");
  currentSlideIndex = firstNewIdx;
  syncEditorToCurrentSlide();
  if (uploadedCount > 0) {
    pushEditorUndoSnapshot();
    showToast(uploadedCount > 1 ? `${uploadedCount} photos importées` : "Photo importée");
  }
  e.target.value = "";
});

document.getElementById("btnRemoveVisual").addEventListener("click", () => {
  const slide = getCurrentSlide();
  slide.mediaId = "";
  syncEditorToCurrentSlide();
  pushEditorUndoSnapshot();
});

// ============================================================
// LIENS EXTERNES (CANVA & META) + MODE FIL / FEED + KPIs
// ============================================================
function openExternalUrl(inputId, defaultUrl) {
  let url = document.getElementById(inputId).value.trim();
  if (!url) {
    url = defaultUrl;
  } else if (!/^https?:\/\//i.test(url)) {
    url = "https://" + url;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

document.getElementById("btnOpenCanva").addEventListener("click", () => {
  openExternalUrl("postCanvaUrl", "https://www.canva.com/");
});

document.getElementById("btnOpenMeta").addEventListener("click", () => {
  openExternalUrl("postMetaUrl", "https://business.facebook.com/");
});

function applyPreviewViewMode() {
  if (document.getElementById("postFormat").value === "Story") return;
  const isFil = previewViewMode === "fil";
  document.getElementById("previewFilContainer").style.display = isFil ? "block" : "none";
  document.getElementById("previewFeedContainer").style.display = isFil ? "none" : "block";
  document.getElementById("previewModeFil").classList.toggle("active", isFil);
  document.getElementById("previewModeFeed").classList.toggle("active", !isFil);
  document.getElementById("previewPanelTitle").textContent = isFil
    ? "Aperçu du post (Mode Fil)"
    : "Simulateur de grille (Mode Feed)";
}

document.getElementById("previewModeFil").addEventListener("click", () => {
  previewViewMode = "fil";
  applyPreviewViewMode();
});

document.getElementById("previewModeFeed").addEventListener("click", () => {
  previewViewMode = "feed";
  applyPreviewViewMode();
});

function getEditorStatsFrom
