// ============================================================
// ONGLET INSTAGRAM > STATISTIQUES (4 BLOCS + CHART.JS OPTIMISÉ)
// ============================================================
const statsCharts = {};
let statsPeriodInitialized = false;

function getStatsPeriodMode() {
  return document.getElementById("statsPeriodSelect")?.value || "avg_global";
}

function getStatsMonthsWindow() {
  return Number(document.getElementById("statsMonthsWindow")?.value) || 12;
}

function getPillarChartMetric() {
  return document.getElementById("statsPillarMetricSelect")?.value || "engagement";
}

function getAllKnownMonths() {
  const set = new Set();
  (state.posts || []).forEach((p) => {
    if (p.date && /^\d{4}-\d{2}/.test(p.date)) {
      set.add(p.date.slice(0, 7));
    }
  });
  Object.keys(state.followersHistory || {}).forEach((ym) => {
    if (/^\d{4}-\d{2}$/.test(ym)) set.add(ym);
  });
  return Array.from(set).sort();
}

function ensureStatsPeriodDefault() {
  const sel = document.getElementById("statsPeriodSelect");
  if (!sel) return;

  const prevVal = sel.value;
  const months = getAllKnownMonths();
  const latestMonth = months.length ? months[months.length - 1] : "";

  let html = `<option value="avg_global">📊 Moyenne mensuelle globale</option>`;
  html += `<option value="all_cumul">∑ Cumul — Tout l'historique</option>`;
  html += `<option value="last_3m">🗓️ Cumul — 3 derniers mois</option>`;
  html += `<option value="current_year">📅 Cumul — Année en cours (${new Date().getFullYear()})</option>`;

  if (months.length) {
    html += `<optgroup label="Mois précis">`;
    [...months].reverse().forEach((ym) => {
      html += `<option value="month:${ym}">${escapeHtml(formatMonthFr(ym))}</option>`;
    });
    html += `</optgroup>`;
  }

  sel.innerHTML = html;

  if (!statsPeriodInitialized) {
    statsPeriodInitialized = true;
    sel.value = latestMonth ? `month:${latestMonth}` : "avg_global";
  } else if (prevVal && Array.from(sel.options).some((o) => o.value === prevVal)) {
    sel.value = prevVal;
  } else if (latestMonth && prevVal?.startsWith("month:")) {
    sel.value = `month:${latestMonth}`;
  } else {
    sel.value = "avg_global";
  }
}

function getPostsForSelectedPeriod() {
  const mode = getStatsPeriodMode();
  const months = getAllKnownMonths();
  const posts = state.posts || [];

  if (mode.startsWith("month:")) {
    const targetYm = mode.replace("month:", "");
    return {
      mode,
      label: formatMonthFr(targetYm),
      months: [targetYm],
      posts: posts.filter((p) => (p.date || "").startsWith(targetYm))
    };
  }

  if (mode === "last_3m") {
    const last3 = months.slice(-3);
    const set3 = new Set(last3);
    return {
      mode,
      label: "3 derniers mois",
      months: last3,
      posts: posts.filter((p) => p.date && set3.has(p.date.slice(0, 7)))
    };
  }

  if (mode === "current_year") {
    const yr = String(new Date().getFullYear());
    const yrMonths = months.filter((m) => m.startsWith(yr + "-"));
    return {
      mode,
      label: `Année ${yr}`,
      months: yrMonths,
      posts: posts.filter((p) => (p.date || "").startsWith(yr + "-"))
    };
  }

  if (mode === "all_cumul") {
    return {
      mode,
      label: "Tout l'historique",
      months,
      posts
    };
  }

  return {
    mode: "avg_global",
    label: "Moyenne mensuelle globale",
    months,
    posts
  };
}

function renderDeltaBadge(delta) {
  if (delta === null || delta === undefined || Number.isNaN(delta)) {
    return `<span class="delta-badge delta-flat">—</span>`;
  }
  if (delta > 0) {
    return `<span class="delta-badge delta-up">↗ +${delta.toLocaleString("fr-FR")}</span>`;
  }
  if (delta < 0) {
    return `<span class="delta-badge delta-down">↘ ${delta.toLocaleString("fr-FR")}</span>`;
  }
  return `<span class="delta-badge delta-flat">→ 0</span>`;
}

function computeAvgEngagementFromPosts(posts) {
  const rates = posts
    .map((p) => computeEngagementRateValue(normalizeStats(p.stats)))
    .filter((v) => v !== null);
  if (!rates.length) return "—";
  const avg = rates.reduce((a, b) => a + b, 0) / rates.length;
  return avg.toFixed(2) + "%";
}

function renderStatsTopSection(periodData) {
  const posts = periodData.posts || [];
  const activeMonthsCount = Math.max(1, new Set(posts.map((p) => (p.date || "").slice(0, 7)).filter(Boolean)).size);
  const isAvg = periodData.mode === "avg_global";

  let reachSum = 0;
  let interactionsSum = 0;
  let savesSum = 0;
  let clicksSum = 0;

  posts.forEach((p) => {
    const st = normalizeStats(p.stats);
    reachSum += st.reach;
    interactionsSum += computeInteractions(st);
    savesSum += st.saves;
    clicksSum += st.clicks;
  });

  const reachDisplay = isAvg ? Math.round(reachSum / activeMonthsCount) : reachSum;
  const interactionsDisplay = isAvg ? Math.round(interactionsSum / activeMonthsCount) : interactionsSum;
  const savesDisplay = isAvg ? Math.round(savesSum / activeMonthsCount) : savesSum;
  const clicksDisplay = isAvg ? Math.round(clicksSum / activeMonthsCount) : clicksSum;
  const engAvgStr = computeAvgEngagementFromPosts(posts);

  const hist = normalizeFollowersHistory(state.followersHistory);
  const sortedYm = Object.keys(hist).sort();

  let latestFollowers = null;
  let periodDelta = null;
  let followersSub = "Aucun bilan saisi";

  if (sortedYm.length > 0) {
    latestFollowers = hist[sortedYm[sortedYm.length - 1]];
    const lastYm = sortedYm[sortedYm.length - 1];
    followersSub = `Dernier bilan : ${formatMonthShortFr(lastYm)}`;

    if (periodData.mode.startsWith("month:")) {
      const targetYm = periodData.mode.replace("month:", "");
      const idx = sortedYm.indexOf(targetYm);
      if (idx !== -1) {
        latestFollowers = hist[targetYm];
        periodDelta = idx > 0 ? hist[targetYm] - hist[sortedYm[idx - 1]] : 0;
        followersSub = formatMonthShortFr(targetYm);
      }
    } else if (periodData.months.length > 0) {
      const matched = periodData.months.filter((ym) => hist[ym] !== undefined);
      if (matched.length >= 2) {
        const firstVal = hist[matched[0]];
        const lastVal = hist[matched[matched.length - 1]];
        latestFollowers = lastVal;
        periodDelta = lastVal - firstVal;
      } else if (matched.length === 1) {
        const idx = sortedYm.indexOf(matched[0]);
        latestFollowers = hist[matched[0]];
        periodDelta = idx > 0 ? hist[matched[0]] - hist[sortedYm[idx - 1]] : 0;
      } else if (sortedYm.length >= 2) {
        periodDelta = hist[sortedYm[sortedYm.length - 1]] - hist[sortedYm[sortedYm.length - 2]];
      }
    }
  }

  const suffixLabel = isAvg ? " / mois" : "";

  document.getElementById("statsKpis").innerHTML = `
    <div class="kpi">
      <div class="label">Abonnés totaux</div>
      <div class="value">${latestFollowers !== null ? latestFollowers.toLocaleString("fr-FR") : "—"}</div>
      <div class="kpi-sub">${escapeHtml(followersSub)} ${renderDeltaBadge(periodDelta)}</div>
    </div>
    <div class="kpi">
      <div class="label">Portée${suffixLabel}</div>
      <div class="value">${reachDisplay.toLocaleString("fr-FR")}</div>
      <div class="kpi-sub">${posts.length} publication(s) • ${escapeHtml(periodData.label)}</div>
    </div>
    <div class="kpi">
      <div class="label">Interactions${suffixLabel}</div>
      <div class="value">${interactionsDisplay.toLocaleString("fr-FR")}</div>
      <div class="kpi-sub">Likes, coms, enreg., partages</div>
    </div>
    <div class="kpi">
      <div class="label">Enregistrements & Clics${suffixLabel}</div>
      <div class="value">${savesDisplay.toLocaleString("fr-FR")} <span style="font-size:15px; font-weight:600; color:var(--muted);">/ ${clicksDisplay.toLocaleString("fr-FR")}</span></div>
      <div class="kpi-sub">Enregistrements / Clics</div>
    </div>
    <div class="kpi">
      <div class="label">Engagement moyen / portée</div>
      <div class="value">${engAvgStr}</div>
      <div class="kpi-sub">Moyenne des posts de la période</div>
    </div>
  `;
}

// ============================================================
// BLOC 2 : SUIVI MENSUEL DES ABONNÉS + GRAPHIQUE COMBINÉ
// ============================================================
function renderFollowersSection() {
  const hist = normalizeFollowersHistory(state.followersHistory);
  const sortedYm = Object.keys(hist).sort();

  const monthInput = document.getElementById("followerMonthInput");
  if (monthInput && !monthInput.value) {
    monthInput.value = getTodayIso().slice(0, 7);
  }

  const listEl = document.getElementById("followersHistoryList");
  if (!sortedYm.length) {
    listEl.innerHTML = `<div style="font-size:12px; color:var(--muted);">Aucun bilan mensuel enregistré. Saisissez un mois et un total d'abonnés ci-dessus.</div>`;
  } else {
    listEl.innerHTML = [...sortedYm]
      .reverse()
      .map((ym, revIdx) => {
        const origIdx = sortedYm.length - 1 - revIdx;
        const currVal = hist[ym];
        const delta = origIdx > 0 ? currVal - hist[sortedYm[origIdx - 1]] : null;
        return `
          <div class="followers-row">
            <div>
              <strong>${escapeHtml(formatMonthFr(ym))}</strong>
              <span style="margin-left:8px; font-weight:700; color:var(--primary);">${currVal.toLocaleString("fr-FR")}</span>
            </div>
            <div style="display:flex; align-items:center; gap:6px;">
              ${renderDeltaBadge(delta)}
              <button type="button" class="sm danger" onclick="deleteFollowerMonth('${ym}')" title="Supprimer">✕</button>
            </div>
          </div>
        `;
      })
      .join("");
  }

  const labels = sortedYm.map(formatMonthShortFr);
  const totals = sortedYm.map((ym) => hist[ym]);
  const deltas = sortedYm.map((ym, i) => (i > 0 ? hist[ym] - hist[sortedYm[i - 1]] : 0));

  renderChart("followersComboChart", {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          type: "line",
          label: "Abonnés totaux",
          data: totals,
          borderColor: "#5b4ce6",
          backgroundColor: "rgba(91, 76, 230, 0.14)",
          borderWidth: 2.5,
          tension: 0.3,
          yAxisID: "y",
          fill: false
        },
        {
          type: "bar",
          label: "Gain / perte net (Δ)",
          data: deltas,
          backgroundColor: deltas.map((d) => (d >= 0 ? "rgba(22, 138, 84, 0.72)" : "rgba(220, 38, 38, 0.72)")),
          borderRadius: 5,
          yAxisID: "y1"
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: "index", intersect: false },
      scales: {
        y: {
          type: "linear",
          position: "left",
          beginAtZero: false,
          title: { display: true, text: "Total abonnés" }
        },
        y1: {
          type: "linear",
          position: "right",
          grid: { drawOnChartArea: false },
          title: { display: true, text: "Évolution nette (Δ)" }
        }
      }
    }
  });
}

document.getElementById("btnSaveFollowerMonth")?.addEventListener("click", async () => {
  const ym = (document.getElementById("followerMonthInput")?.value || "").trim();
  const countRaw = document.getElementById("followerCountInput")?.value;
  const count = Number(countRaw);

  if (!/^\d{4}-\d{2}$/.test(ym)) {
    showToast("Sélectionnez un mois valide (AAAA-MM)");
    return;
  }
  if (countRaw === "" || Number.isNaN(count) || count < 0) {
    showToast("Saisissez un nombre d'abonnés valide");
    return;
  }

  state.followersHistory = normalizeFollowersHistory(state.followersHistory);
  state.followersHistory[ym] = Math.round(count);
  await saveMetaToCloud();
  ensureStatsPeriodDefault();
  renderStatisticsSection();
  showToast(`Abonnés enregistrés pour ${formatMonthFr(ym)}`);
});

window.deleteFollowerMonth = async function (ym) {
  if (!state.followersHistory || state.followersHistory[ym] === undefined) return;
  delete state.followersHistory[ym];
  await saveMetaToCloud();
  ensureStatsPeriodDefault();
  renderStatisticsSection();
  showToast("Bilan mensuel supprimé");
};

// ============================================================
// BLOC 3 : 4 GRAPHIQUES MENSUELS DES PERFORMANCES
// ============================================================
function getWindowedMonths() {
  const n = getStatsMonthsWindow();
  const all = getAllKnownMonths();
  if (n >= 999) return all;
  return all.slice(-n);
}

function aggregateByMonth(months) {
  return months.map((ym) => {
    const monthPosts = (state.posts || []).filter((p) => (p.date || "").startsWith(ym));
    let reach = 0;
    let views = 0;
    let likes = 0;
    let comments = 0;
    let saves = 0;
    let shares = 0;
    let clicks = 0;
    const rates = [];

    monthPosts.forEach((p) => {
      const st = normalizeStats(p.stats);
      reach += st.reach;
      views += st.views;
      likes += st.likes;
      comments += st.comments;
      saves += st.saves;
      shares += st.shares;
      clicks += st.clicks;
      const r = computeEngagementRateValue(st);
      if (r !== null) rates.push(r);
    });

    const avgEng = rates.length ? Number((rates.reduce((a, b) => a + b, 0) / rates.length).toFixed(2)) : 0;

    return { ym, reach, views, likes, comments, saves, shares, clicks, avgEng };
  });
}

function renderMonthlyPerformanceCharts(months) {
  const agg = aggregateByMonth(months);
  const labels = agg.map((d) => formatMonthShortFr(d.ym));

  renderChart("chartReachViews", {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Portée cumulée",
          data: agg.map((d) => d.reach),
          backgroundColor: "rgba(91, 76, 230, 0.78)",
          borderRadius: 6
        },
        {
          label: "Vues cumulées",
          data: agg.map((d) => d.views),
          backgroundColor: "rgba(219, 39, 119, 0.65)",
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      scales: { y: { beginAtZero: true } }
    }
  });

  renderChart("chartInteractionsStacked", {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "Likes", data: agg.map((d) => d.likes), backgroundColor: "#5b4ce6" },
        { label: "Commentaires", data: agg.map((d) => d.comments), backgroundColor: "#009fe3" },
        { label: "Enregistrements", data: agg.map((d) => d.saves), backgroundColor: "#168a54" },
        { label: "Partages", data: agg.map((d) => d.shares), backgroundColor: "#f59e0b" }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      scales: {
        x: { stacked: true },
        y: { stacked: true, beginAtZero: true }
      }
    }
  });

  renderChart("chartSavesClicks", {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Enregistrements",
          data: agg.map((d) => d.saves),
          borderColor: "#168a54",
          backgroundColor: "rgba(22, 138, 84, 0.12)",
          borderWidth: 2.5,
          tension: 0.3
        },
        {
          label: "Clics",
          data: agg.map((d) => d.clicks),
          borderColor: "#1877f2",
          backgroundColor: "rgba(24, 119, 242, 0.12)",
          borderWidth: 2.5,
          tension: 0.3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      scales: { y: { beginAtZero: true } }
    }
  });

  renderChart("chartEngagementRate", {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Engagement moyen / portée (%)",
          data: agg.map((d) => d.avgEng),
          borderColor: "#db2777",
          backgroundColor: "rgba(219, 39, 119, 0.14)",
          borderWidth: 2.5,
          tension: 0.3,
          fill: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: { callback: (v) => v + "%" }
        }
      }
    }
  });
}

// ============================================================
// BLOC 4 : COMPARATIFS PAR FORMAT & PAR PILIER ÉDITORIAL
// ============================================================
function renderFormatComparison(periodData, windowedMonths) {
  const posts = periodData.posts || [];
  const formatPalette = {
    "Post simple": "#009fe3",
    "Carrousel": "#5b4ce6",
    "Reel": "#db2777",
    "Story": "#f59e0b"
  };

  const rows = VALID_FORMATS.map((fmt) => {
    const fPosts = posts.filter((p) => p.format === fmt);
    const count = fPosts.length;
    let reach = 0;
    let interactions = 0;
    let saves = 0;
    let clicks = 0;
    const rates = [];

    fPosts.forEach((p) => {
      const st = normalizeStats(p.stats);
      reach += st.reach;
      interactions += computeInteractions(st);
      saves += st.saves;
      clicks += st.clicks;
      const r = computeEngagementRateValue(st);
      if (r !== null) rates.push(r);
    });

    const avgReach = count > 0 ? Math.round(reach / count) : 0;
    const avgEngVal = rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : null;

    return {
      format: fmt,
      count,
      reach,
      avgReach,
      interactions,
      saves,
      clicks,
      avgEngVal,
      avgEngStr: avgEngVal !== null ? avgEngVal.toFixed(2) + "%" : "—"
    };
  });

  const activeRows = rows.filter((r) => r.count > 0);
  let bestEngFmt = null;
  let bestReachFmt = null;

  activeRows.forEach((r) => {
    if (r.avgEngVal !== null && (!bestEngFmt || r.avgEngVal > bestEngFmt.avgEngVal)) {
      bestEngFmt = r;
    }
    if (!bestReachFmt || r.reach > bestReachFmt.reach) {
      bestReachFmt = r;
    }
  });

  const tbody = document.getElementById("formatComparisonBody");
  if (tbody) {
    tbody.innerHTML = rows
      .map((r) => {
        const isTopEng = bestEngFmt && bestEngFmt.format === r.format && r.avgEngVal > 0;
        const isTopReach = bestReachFmt && bestReachFmt.format === r.format && r.reach > 0;
        return `
          <tr>
            <td>
              <span class="format-badge">${getFormatEmoji(r.format)} ${escapeHtml(r.format)}</span>
              ${isTopEng ? `<span class="top-badge eng">★ Top engagement</span>` : ""}
              ${isTopReach ? `<span class="top-badge reach">▲ Top portée</span>` : ""}
            </td>
            <td><strong>${r.count}</strong></td>
            <td>${r.reach.toLocaleString("fr-FR")} <span style="color:var(--muted); font-size:11px;">(moy. ${r.avgReach.toLocaleString("fr-FR")})</span></td>
            <td>${r.interactions.toLocaleString("fr-FR")}</td>
            <td>${r.saves.toLocaleString("fr-FR")}</td>
            <td>${r.clicks.toLocaleString("fr-FR")}</td>
            <td><strong>${r.avgEngStr}</strong></td>
          </tr>
        `;
      })
      .join("");
  }

  const labels = windowedMonths.map(formatMonthShortFr);
  const datasets = VALID_FORMATS.map((fmt) => {
    const data = windowedMonths.map((ym) => {
      const mPosts = (state.posts || []).filter((p) => (p.date || "").startsWith(ym) && p.format === fmt);
      const rates = mPosts
        .map((p) => computeEngagementRateValue(normalizeStats(p.stats)))
        .filter((v) => v !== null);
      if (!rates.length) return 0;
      return Number((rates.reduce((a, b) => a + b, 0) / rates.length).toFixed(2));
    });
    return {
      label: fmt,
      data,
      borderColor: formatPalette[fmt] || "#5b4ce6",
      backgroundColor: formatPalette[fmt] || "#5b4ce6",
      borderWidth: 2.2,
      tension: 0.3
    };
  });

  renderChart("chartFormatMonthly", {
    type: "line",
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: { callback: (v) => v + "%" }
        }
      }
    }
  });
}

function renderPillarComparison(periodData, windowedMonths) {
  const posts = periodData.posts || [];
  const pillars = getPillarList();
  const metric = getPillarChartMetric();

  const rows = pillars.map((pil) => {
    const pPosts = posts.filter((p) => p.pilier === pil.name);
    const count = pPosts.length;
    let reach = 0;
    let interactions = 0;
    let saves = 0;
    let clicks = 0;
    const rates = [];

    pPosts.forEach((p) => {
      const st = normalizeStats(p.stats);
      reach += st.reach;
      interactions += computeInteractions(st);
      saves += st.saves;
      clicks += st.clicks;
      const r = computeEngagementRateValue(st);
      if (r !== null) rates.push(r);
    });

    const avgEngVal = rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : null;

    return {
      id: pil.id,
      name: pil.name,
      color: pil.color,
      count,
      reach,
      interactions,
      saves,
      clicks,
      avgEngVal,
      avgEngStr: avgEngVal !== null ? avgEngVal.toFixed(2) + "%" : "—"
    };
  });

  const tbody = document.getElementById("pillarComparisonBody");
  if (tbody) {
    tbody.innerHTML = rows.length
      ? rows
          .map(
            (r) => `
          <tr>
            <td>
              <span class="mini-tag pillar-tag">
                <span class="pillar-dot" style="background:${escapeHtml(r.color)};"></span>
                ${escapeHtml(r.name)}
              </span>
            </td>
            <td><strong>${r.count}</strong></td>
            <td>${r.reach.toLocaleString("fr-FR")}</td>
            <td>${r.interactions.toLocaleString("fr-FR")}</td>
            <td>${r.saves.toLocaleString("fr-FR")}</td>
            <td>${r.clicks.toLocaleString("fr-FR")}</td>
            <td><strong>${r.avgEngStr}</strong></td>
          </tr>
        `
          )
          .join("")
      : `<tr><td colspan="7">Aucun pilier configuré.</td></tr>`;
  }

  const labels = windowedMonths.map(formatMonthShortFr);
  const datasets = pillars.map((pil) => {
    const data = windowedMonths.map((ym) => {
      const mPosts = (state.posts || []).filter((p) => (p.date || "").startsWith(ym) && p.pilier === pil.name);
      if (!mPosts.length) return 0;

      if (metric === "engagement") {
        const rates = mPosts
          .map((p) => computeEngagementRateValue(normalizeStats(p.stats)))
          .filter((v) => v !== null);
        if (!rates.length) return 0;
        return Number((rates.reduce((a, b) => a + b, 0) / rates.length).toFixed(2));
      }

      let sum = 0;
      mPosts.forEach((p) => {
        const st = normalizeStats(p.stats);
        if (metric === "reach") sum += st.reach;
        else if (metric === "interactions") sum += computeInteractions(st);
        else if (metric === "saves") sum += st.saves;
        else if (metric === "clicks") sum += st.clicks;
      });
      return sum;
    });

    return {
      label: pil.name,
      data,
      borderColor: pil.color,
      backgroundColor: pil.color,
      borderWidth: 2.2,
      tension: 0.3
    };
  });

  renderChart("chartPillarMonthly", {
    type: "line",
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: metric === "engagement" ? { callback: (v) => v + "%" } : undefined
        }
      }
    }
  });
}

function renderChart(canvasId, config) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || typeof Chart === "undefined") return;

  if (statsCharts[canvasId]) {
    statsCharts[canvasId].destroy();
    statsCharts[canvasId] = null;
  }

  const ctx = canvas.getContext("2d");
  statsCharts[canvasId] = new Chart(ctx, config);
}

// ============================================================
// POINT D'ENTRÉE PRINCIPAL DE L'ONGLET STATISTIQUES
// ============================================================
function renderStatisticsSection() {
  if (!document.getElementById("statsKpis")) return;
  if (!isStatsTabCurrentlyVisible()) return;

  ensureStatsPeriodDefault();
  const periodData = getPostsForSelectedPeriod();
  const windowedMonths = getWindowedMonths();

  renderStatsTopSection(periodData);
  renderFollowersSection();
  renderMonthlyPerformanceCharts(windowedMonths);
  renderFormatComparison(periodData, windowedMonths);
  renderPillarComparison(periodData, windowedMonths);
}

document.getElementById("statsPeriodSelect")?.addEventListener("change", renderStatisticsSection);
document.getElementById("statsMonthsWindow")?.addEventListener("change", renderStatisticsSection);
document.getElementById("statsPillarMetricSelect")?.addEventListener("change", renderStatisticsSection);
