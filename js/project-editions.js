// ============================================================
// PARTIE 2 : GESTION ÉDITION & RÉFÉRENTIEL MAISONS D'ÉDITION
// ============================================================
let editionFilterStatus = "";
let editionSortField = "publisherName";
let editionSortAsc = true;
let editingSubmissionId = null;

function ensurePublishersCatalog() {
  state.publishersCatalog = normalizePublishersCatalog(state.publishersCatalog);
  return state.publishersCatalog;
}

function getEditionStatusMeta(statusKey) {
  return SUBMISSION_STATUSES.find((s) => s.key === statusKey) || SUBMISSION_STATUSES[0];
}

function renderProjectEditionSection(proj) {
  const container = document.getElementById("projectEditionSection");
  if (!container || !proj) return;

  const submissions = Array.isArray(proj.submissions) ? proj.submissions : [];

  const totalCount = submissions.length;
  const sentCount = submissions.filter((s) => s.sent).length;
  const pendingCount = submissions.filter((s) => s.status === "En attente de retour").length;
  const exchangeCount = submissions.filter((s) => s.status === "Échange en cours").length;
  const editedCount = submissions.filter((s) => s.status === "Édité").length;
  const refusedCount = submissions.filter((s) => s.status === "Refus").length;

  const filtered = submissions
    .filter((s) => !editionFilterStatus || s.status === editionFilterStatus)
    .sort((a, b) => {
      const va = String(a[editionSortField] || "").toLowerCase();
      const vb = String(b[editionSortField] || "").toLowerCase();
      const cmp = va.localeCompare(vb, "fr");
      return editionSortAsc ? cmp : -cmp;
    });

  const rowsHtml = filtered.length
    ? filtered
        .map((sub) => {
          const stMeta = getEditionStatusMeta(sub.status);
          const sentLabel = sub.sent
            ? `<span class="tracker-status-pill is-ok">Oui${sub.sentDate ? ` • ${formatDateFrSlash(sub.sentDate)}` : ""}</span>`
            : `<span class="tracker-status-pill is-ko">Non</span>`;

          const retLabel = sub.responseReceived
            ? `<span class="tracker-status-pill is-ok">Oui${sub.responseDate ? ` • ${formatDateFrSlash(sub.responseDate)}` : ""}</span>`
            : `<span style="color:var(--muted); font-size:12px;">Non</span>`;

          const statusOptions = SUBMISSION_STATUSES.map(
            (st) => `<option value="${escapeHtml(st.key)}" ${sub.status === st.key ? "selected" : ""}>${escapeHtml(st.label)}</option>`
          ).join("");

          return `
            <tr>
              <td>
                <strong style="cursor:pointer; color:var(--primary);" onclick="openSubmissionModal('${sub.id}')">${escapeHtml(sub.publisherName)}</strong>
                ${sub.contact ? `<div style="font-size:11px; color:var(--muted);">${escapeHtml(sub.contact)}</div>` : ""}
              </td>
              <td>
                <div><strong>${escapeHtml(sub.modality)}</strong></div>
                ${sub.modalityDetails ? `<div style="font-size:11px; color:var(--muted);">${escapeHtml(sub.modalityDetails)}</div>` : ""}
              </td>
              <td>${sentLabel}</td>
              <td>${retLabel}</td>
              <td>
                <select class="ed-status-badge ${stMeta.badgeClass}" style="border:none; cursor:pointer;" onchange="quickChangeSubmissionStatus('${sub.id}', this.value)">
                  ${statusOptions}
                </select>
              </td>
              <td>
                <div style="display:flex; gap:6px; align-items:center;">
                  <button type="button" class="sm" onclick="openSubmissionModal('${sub.id}')" title="Modifier / Notes">✏️ Éditer</button>
                  <button type="button" class="sm danger" onclick="deleteSubmission('${sub.id}')" title="Retirer">✕</button>
                </div>
                ${sub.notes ? `<div style="font-size:11px; color:var(--muted); margin-top:4px;">${escapeHtml(sub.notes)}</div>` : ""}
              </td>
            </tr>
          `;
        })
        .join("")
    : `<tr><td colspan="6" style="color:var(--muted);">Aucune maison d'édition associée pour ce filtre.</td></tr>`;

  container.innerHTML = `
    <div class="edition-panel">
      <div class="edition-header-row">
        <h2 style="margin:0;">📚 Gestion édition & Maisons d'édition</h2>
        <button type="button" class="primary" onclick="openSubmissionModal(null)">+ Ajouter / Associer une maison d'édition</button>
      </div>

      <div class="edition-kpis">
        <div class="edition-kpi-box"><div class="num">${totalCount}</div><div class="lbl">Total référencées</div></div>
        <div class="edition-kpi-box"><div class="num">${sentCount}</div><div class="lbl">Envoyées</div></div>
        <div class="edition-kpi-box"><div class="num">${pendingCount}</div><div class="lbl">En attente de retour</div></div>
        <div class="edition-kpi-box"><div class="num">${exchangeCount}</div><div class="lbl">Échanges en cours</div></div>
        <div class="edition-kpi-box"><div class="num">${editedCount}</div><div class="lbl">Éditées</div></div>
        <div class="edition-kpi-box"><div class="num">${refusedCount}</div><div class="lbl">Refusées</div></div>
      </div>

      <div class="edition-toolbar">
        <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
          <label style="font-size:12px; font-weight:700; color:var(--muted);">Filtrer par statut :</label>
          <select onchange="setEditionFilterStatus(this.value)">
            <option value="">Tous les statuts</option>
            ${SUBMISSION_STATUSES.map((st) => `<option value="${escapeHtml(st.key)}" ${editionFilterStatus === st.key ? "selected" : ""}>${escapeHtml(st.label)}</option>`).join("")}
          </select>
        </div>

        <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
          <span style="font-size:12px; font-weight:700; color:var(--muted);">Trier :</span>
          <button type="button" class="sm ${editionSortField === "publisherName" ? "primary" : ""}" onclick="setEditionSort('publisherName')">Maison</button>
          <button type="button" class="sm ${editionSortField === "status" ? "primary" : ""}" onclick="setEditionSort('status')">Statut</button>
          <button type="button" class="sm ${editionSortField === "sentDate" ? "primary" : ""}" onclick="setEditionSort('sentDate')">Date envoi</button>
          <button type="button" class="sm ${editionSortField === "responseDate" ? "primary" : ""}" onclick="setEditionSort('responseDate')">Date retour</button>
        </div>
      </div>

      <div class="table-wrap">
        <table class="stats-table">
          <thead>
            <tr>
              <th>Maison d'édition</th>
              <th>Modalité d'envoi</th>
              <th>Envoyé</th>
              <th>Retour</th>
              <th>Statut</th>
              <th>Actions / Notes</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    </div>
  `;
}

window.setEditionFilterStatus = function (val) {
  editionFilterStatus = val;
  const proj = getActiveProject();
  if (proj) renderProjectEditionSection(proj);
};

window.setEditionSort = function (field) {
  if (editionSortField === field) {
    editionSortAsc = !editionSortAsc;
  } else {
    editionSortField = field;
    editionSortAsc = true;
  }
  const proj = getActiveProject();
  if (proj) renderProjectEditionSection(proj);
};

window.quickChangeSubmissionStatus = function (subId, newStatus) {
  const proj = getActiveProject();
  if (!proj) return;
  const sub = (proj.submissions || []).find((s) => s.id === subId);
  if (!sub) return;

  sub.status = newStatus;
  if ((newStatus === "En attente de retour" || newStatus === "Échange en cours") && !sub.sent) {
    sub.sent = true;
    if (!sub.sentDate) sub.sentDate = getTodayIso();
  }
  if ((newStatus === "Refus" || newStatus === "Édité") && !sub.responseReceived) {
    sub.responseReceived = true;
    if (!sub.responseDate) sub.responseDate = getTodayIso();
  }

  if (typeof recordTrackerAction === "function") recordTrackerAction("edit");
  saveProjectToCloud(proj);
  renderProjectEditionSection(proj);
  showToast(`Statut mis à jour : ${newStatus}`);
};

function populateSubmissionModalSelects(existing = null) {
  const modalitySelect = document.getElementById("subModality");
  if (modalitySelect) {
    modalitySelect.innerHTML = SUBMISSION_MODALITIES.map(
      (m) => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`
    ).join("");
    modalitySelect.value = SUBMISSION_MODALITIES.includes(existing?.modality)
      ? existing.modality
      : SUBMISSION_MODALITIES[0];
  }

  const statusSelect = document.getElementById("subStatus");
  if (statusSelect) {
    statusSelect.innerHTML = SUBMISSION_STATUSES.map(
      (st) => `<option value="${escapeHtml(st.key)}">${escapeHtml(st.label)}</option>`
    ).join("");
    statusSelect.value = SUBMISSION_STATUSES.some((st) => st.key === existing?.status)
      ? existing.status
      : SUBMISSION_STATUSES[0].key;
  }
}

window.openSubmissionModal = function (subId = null) {
  const proj = getActiveProject();
  if (!proj) return;

  const catalog = ensurePublishersCatalog();
  const existing = subId ? (proj.submissions || []).find((s) => s.id === subId) : null;
  editingSubmissionId = existing ? existing.id : null;

  const catalogOptions =
    `<option value="">-- Nouvelle maison ou choisir dans le référentiel --</option>` +
    catalog
      .map(
        (pub) =>
          `<option value="${escapeHtml(pub.id)}" ${existing && existing.publisherId === pub.id ? "selected" : ""}>${escapeHtml(pub.name)} (${escapeHtml(pub.modality)})</option>`
      )
      .join("");

  document.getElementById("submissionModalTitle").textContent = existing
    ? `Suivi — ${existing.publisherName}`
    : "Ajouter / Associer une maison d'édition";

  document.getElementById("subCatalogSelect").innerHTML = catalogOptions;
  document.getElementById("subPublisherName").value = existing?.publisherName || "";
  populateSubmissionModalSelects(existing);
  document.getElementById("subModalityDetails").value = existing?.modalityDetails || "";
  document.getElementById("subContact").value = existing?.contact || "";
  document.getElementById("subSent").checked = Boolean(existing?.sent);
  document.getElementById("subSentDate").value = existing?.sentDate || "";
  document.getElementById("subResponse").checked = Boolean(existing?.responseReceived);
  document.getElementById("subResponseDate").value = existing?.responseDate || "";
  document.getElementById("subNotes").value = existing?.notes || "";
  document.getElementById("subPropagateCheck").checked = false;

  document.getElementById("submissionModal").classList.add("open");
};

function closeSubmissionModal() {
  document.getElementById("submissionModal").classList.remove("open");
}

document.getElementById("btnCloseSubmissionModal")?.addEventListener("click", closeSubmissionModal);
document.getElementById("btnCancelSubmission")?.addEventListener("click", closeSubmissionModal);
document.getElementById("submissionModal")?.addEventListener("click", (e) => {
  if (e.target.id === "submissionModal") closeSubmissionModal();
});

document.getElementById("subCatalogSelect")?.addEventListener("change", (e) => {
  const pubId = e.target.value;
  if (!pubId) return;
  const pub = ensurePublishersCatalog().find((p) => p.id === pubId);
  if (!pub) return;
  document.getElementById("subPublisherName").value = pub.name;
  populateSubmissionModalSelects(pub);
  document.getElementById("subModalityDetails").value = pub.modalityDetails || "";
  document.getElementById("subContact").value = pub.contact || "";
});

document.getElementById("subStatus")?.addEventListener("change", (e) => {
  const st = e.target.value;
  const sentCb = document.getElementById("subSent");
  const sentDateEl = document.getElementById("subSentDate");
  const respCb = document.getElementById("subResponse");
  const respDateEl = document.getElementById("subResponseDate");

  if ((st === "En attente de retour" || st === "Échange en cours") && !sentCb.checked) {
    sentCb.checked = true;
    if (!sentDateEl.value) sentDateEl.value = getTodayIso();
  }
  if ((st === "Refus" || st === "Édité") && !respCb.checked) {
    respCb.checked = true;
    if (!respDateEl.value) respDateEl.value = getTodayIso();
  }
});

document.getElementById("btnSaveSubmission")?.addEventListener("click", async () => {
  const proj = getActiveProject();
  if (!proj) return;

  const publisherName = (document.getElementById("subPublisherName")?.value || "").trim();
  if (!publisherName) {
    showToast("Le nom de la maison d'édition est obligatoire");
    return;
  }

  const catalogIdFromSelect = document.getElementById("subCatalogSelect")?.value || "";
  const modality = document.getElementById("subModality")?.value || SUBMISSION_MODALITIES[0];
  const modalityDetails = (document.getElementById("subModalityDetails")?.value || "").trim();
  const contact = (document.getElementById("subContact")?.value || "").trim();
  const sent = Boolean(document.getElementById("subSent")?.checked);
  const sentDate = document.getElementById("subSentDate")?.value || (sent ? getTodayIso() : "");
  const responseReceived = Boolean(document.getElementById("subResponse")?.checked);
  const responseDate = document.getElementById("subResponseDate")?.value || (responseReceived ? getTodayIso() : "");
  const status = document.getElementById("subStatus")?.value || SUBMISSION_STATUSES[0].key;
  const notes = (document.getElementById("subNotes")?.value || "").trim();
  const propagate = Boolean(document.getElementById("subPropagateCheck")?.checked);

  const catalog = ensurePublishersCatalog();
  let pubEntry = catalog.find(
    (p) => (catalogIdFromSelect && p.id === catalogIdFromSelect) || p.name.toLowerCase() === publisherName.toLowerCase()
  );

  if (pubEntry) {
    pubEntry.name = publisherName;
    pubEntry.modality = modality;
    pubEntry.modalityDetails = modalityDetails;
    pubEntry.contact = contact;
  } else {
    pubEntry = {
      id: "pub_" + Date.now(),
      name: publisherName,
      modality,
      modalityDetails,
      contact
    };
    catalog.push(pubEntry);
  }
  await saveMetaToCloud();

  if (!Array.isArray(proj.submissions)) proj.submissions = [];

  const subData = {
    id: editingSubmissionId || "sub_" + Date.now(),
    publisherId: pubEntry.id,
    publisherName,
    modality,
    modalityDetails,
    contact,
    sent,
    sentDate: sent ? sentDate : "",
    responseReceived,
    responseDate: responseReceived ? responseDate : "",
    status,
    notes
  };

  if (editingSubmissionId) {
    const idx = proj.submissions.findIndex((s) => s.id === editingSubmissionId);
    if (idx !== -1) proj.submissions[idx] = subData;
    else proj.submissions.push(subData);
  } else {
    proj.submissions.push(subData);
  }

  const otherProjectsToSave = [];
  if (propagate) {
    (state.projects || []).forEach((otherProj) => {
      if (otherProj.id === proj.id || !Array.isArray(otherProj.submissions)) return;
      let changed = false;
      otherProj.submissions.forEach((s) => {
        if (
          (s.publisherId && s.publisherId === pubEntry.id) ||
          s.publisherName.toLowerCase() === publisherName.toLowerCase()
        ) {
          s.publisherId = pubEntry.id;
          s.modality = modality;
          s.modalityDetails = modalityDetails;
          if (contact) s.contact = contact;
          changed = true;
        }
      });
      if (changed) otherProjectsToSave.push(otherProj);
    });
  }

  if (typeof recordTrackerAction === "function") recordTrackerAction("edit");
  await saveProjectToCloud(proj);
  if (otherProjectsToSave.length) {
    await Promise.all(otherProjectsToSave.map((p) => saveProjectToCloud(p)));
  }

  closeSubmissionModal();
  renderProjectEditionSection(proj);
  showToast("Suivi édition enregistré !");
});

window.deleteSubmission = function (subId) {
  const proj = getActiveProject();
  if (!proj) return;
  proj.submissions = (proj.submissions || []).filter((s) => s.id !== subId);
  saveProjectToCloud(proj);
  renderProjectEditionSection(proj);
  showToast("Association supprimée");
};
