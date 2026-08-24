(() => {
  /** Named show/collection filters (beyond plain genre). */
  const SHOW_FILTERS = [
    {
      id: "will-ferrell",
      label: "Will Ferrell",
      match: (item) => /will\s*ferrell/i.test(item.title),
    },
    {
      id: "strangers-with-candy",
      label: "Strangers with Candy",
      match: (item) => hasCollection(item, "Strangers with Candy"),
    },
    {
      id: "the-office",
      label: "The Office",
      match: (item) => hasCollection(item, "The Office"),
    },
    {
      id: "whitest-kids",
      label: "Whitest Kids You Know",
      match: (item) => hasCollection(item, "Whitest Kids You Know"),
    },
  ];

  const els = {
    genreToggles: document.getElementById("genre-toggles"),
    showToggles: document.getElementById("show-toggles"),
    titleList: document.getElementById("title-list"),
    resultsMeta: document.getElementById("results-meta"),
    playerPanel: document.getElementById("player-panel"),
    playerTitle: document.getElementById("player-title"),
    playerSub: document.getElementById("player-sub"),
    playerClose: document.getElementById("player-close"),
    video: document.getElementById("video"),
    btnPlay: document.getElementById("btn-play"),
    btnFullscreen: document.getElementById("btn-fullscreen"),
    btnDownload: document.getElementById("btn-download"),
    progress: document.getElementById("progress"),
    timeCurrent: document.getElementById("time-current"),
    timeDuration: document.getElementById("time-duration"),
    downloadModal: document.getElementById("download-modal"),
    downloadBody: document.getElementById("download-modal-body"),
    downloadCancel: document.getElementById("download-cancel"),
    downloadConfirm: document.getElementById("download-confirm"),
  };

  const state = {
    activeGenres: new Set(),
    activeShows: new Set(),
    current: null,
    scrubbing: false,
  };

  function collectionsOf(item) {
    const c = item.collection;
    if (c == null) return [];
    return Array.isArray(c) ? c : [c];
  }

  function hasCollection(item, name) {
    return collectionsOf(item).includes(name);
  }

  function isPetThings(item) {
    return hasCollection(item, "Pet Things");
  }

  function genrePools() {
    // Top-level const arrays from classic <script> tags share this scope
    // (they are not properties of window).
    return [
      typeof flicksActionAdventure !== "undefined" && flicksActionAdventure,
      typeof flicksActionComedy !== "undefined" && flicksActionComedy,
      typeof flicksBlackComedy !== "undefined" && flicksBlackComedy,
      typeof flicksComedy !== "undefined" && flicksComedy,
      typeof flicksCrimeDrama !== "undefined" && flicksCrimeDrama,
      typeof flicksDocumentary !== "undefined" && flicksDocumentary,
      typeof flicksDrama !== "undefined" && flicksDrama,
      typeof flicksFranky !== "undefined" && flicksFranky,
      typeof flicksHindu !== "undefined" && flicksHindu,
      typeof flicksHorror !== "undefined" && flicksHorror,
      typeof flicksMusic !== "undefined" && flicksMusic,
      typeof flicksMysterySuspense !== "undefined" && flicksMysterySuspense,
      typeof flicksRandos !== "undefined" && flicksRandos,
      typeof flicksShows !== "undefined" && flicksShows,
      typeof flicksSports !== "undefined" && flicksSports,
      typeof flicksThriller !== "undefined" && flicksThriller,
      typeof flicksWestern !== "undefined" && flicksWestern,
    ].filter(Array.isArray);
  }

  function gatherCatalog() {
    const items = [];
    for (const arr of genrePools()) {
      for (const item of arr) {
        if (isPetThings(item)) items.push(item);
      }
    }
    items.sort((a, b) => {
      const g = String(a.genre || "").localeCompare(String(b.genre || ""));
      if (g !== 0) return g;
      return String(a.title || "").localeCompare(String(b.title || ""));
    });
    return items;
  }

  const catalog = gatherCatalog();

  function genresWithPetThings() {
    const counts = new Map();
    for (const item of catalog) {
      const g = item.genre || "Unknown";
      counts.set(g, (counts.get(g) || 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([label, count]) => ({ id: label, label, count }));
  }

  function countShowMatches(filter) {
    return catalog.filter(filter.match).length;
  }

  function createToggle({ id, label, count, pressed, onToggle }) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "toggle";
    btn.dataset.id = id;
    btn.setAttribute("aria-pressed", pressed ? "true" : "false");
    btn.innerHTML = `${escapeHtml(label)}<span class="count">${count}</span>`;
    btn.addEventListener("click", () => {
      const next = btn.getAttribute("aria-pressed") !== "true";
      btn.setAttribute("aria-pressed", next ? "true" : "false");
      onToggle(id, next);
    });
    return btn;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function buildToggles() {
    for (const genre of genresWithPetThings()) {
      els.genreToggles.appendChild(
        createToggle({
          id: genre.id,
          label: genre.label,
          count: genre.count,
          pressed: false,
          onToggle: (id, on) => {
            if (on) state.activeGenres.add(id);
            else state.activeGenres.delete(id);
            renderTitles();
          },
        })
      );
    }

    for (const show of SHOW_FILTERS) {
      const count = countShowMatches(show);
      if (count === 0) continue;
      els.showToggles.appendChild(
        createToggle({
          id: show.id,
          label: show.label,
          count,
          pressed: false,
          onToggle: (id, on) => {
            if (on) state.activeShows.add(id);
            else state.activeShows.delete(id);
            renderTitles();
          },
        })
      );
    }
  }

  function filteredTitles() {
    const genreOn = state.activeGenres.size > 0;
    const showOn = state.activeShows.size > 0;
    if (!genreOn && !showOn) return [];

    const showMatchers = SHOW_FILTERS.filter((f) => state.activeShows.has(f.id));
    const seen = new Set();
    const out = [];

    for (const item of catalog) {
      const byGenre = genreOn && state.activeGenres.has(item.genre);
      const byShow = showOn && showMatchers.some((f) => f.match(item));
      if (!byGenre && !byShow) continue;
      const key = item.ref != null ? `ref:${item.ref}` : `t:${item.title}|${item.dropboxUrl}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(item);
    }
    return out;
  }

  function secondaryLabel(item) {
    const extras = collectionsOf(item).filter((c) => c !== "Pet Things");
    const bits = [item.genre, item.year || null, ...extras].filter(Boolean);
    return bits.join(" · ");
  }

  function renderTitles() {
    const items = filteredTitles();
    els.titleList.replaceChildren();

    if (state.activeGenres.size === 0 && state.activeShows.size === 0) {
      els.resultsMeta.textContent = "Toggle something above to browse.";
      return;
    }

    els.resultsMeta.textContent =
      items.length === 1 ? "1 title" : `${items.length} titles`;

    items.forEach((item, index) => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "title-btn";
      if (state.current && state.current.ref === item.ref) {
        btn.classList.add("is-active");
      }
      btn.style.animationDelay = `${Math.min(index, 20) * 18}ms`;
      btn.innerHTML = `<span class="name">${escapeHtml(item.title)}</span><span class="detail">${escapeHtml(secondaryLabel(item))}</span>`;
      btn.addEventListener("click", () => openPlayer(item));
      li.appendChild(btn);
      els.titleList.appendChild(li);
    });
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    const s = Math.floor(seconds);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const r = s % 60;
    const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
    const ss = String(r).padStart(2, "0");
    return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  }

  function syncProgress() {
    if (state.scrubbing) return;
    const { video, progress, timeCurrent, timeDuration } = els;
    const dur = video.duration;
    if (Number.isFinite(dur) && dur > 0) {
      progress.value = String(Math.round((video.currentTime / dur) * 1000));
      timeDuration.textContent = formatTime(dur);
    }
    timeCurrent.textContent = formatTime(video.currentTime);
  }

  function updatePlayLabel() {
    els.btnPlay.textContent = els.video.paused ? "Play" : "Pause";
    els.btnPlay.setAttribute("aria-label", els.video.paused ? "Play" : "Pause");
  }

  function openPlayer(item) {
    state.current = item;
    els.playerTitle.textContent = item.title;
    els.playerSub.textContent = secondaryLabel(item);
    els.playerPanel.hidden = false;
    els.video.src = item.dropboxUrl;
    els.video.load();
    els.progress.value = "0";
    els.timeCurrent.textContent = "0:00";
    els.timeDuration.textContent = "0:00";
    updatePlayLabel();
    renderTitles();
    els.video.play().catch(() => updatePlayLabel());
  }

  function closePlayer() {
    els.video.pause();
    els.video.removeAttribute("src");
    els.video.load();
    state.current = null;
    els.playerPanel.hidden = true;
    updatePlayLabel();
    renderTitles();
  }

  function togglePlay() {
    if (!els.video.src && !state.current) return;
    if (els.video.paused) els.video.play().catch(() => {});
    else els.video.pause();
  }

  function goFullscreen() {
    const node = els.video;
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
      return;
    }
    if (node.requestFullscreen) node.requestFullscreen();
    else if (node.webkitEnterFullscreen) node.webkitEnterFullscreen();
  }

  function openDownloadModal() {
    if (!state.current) return;
    els.downloadBody.textContent = `Save “${state.current.title}” to your device?`;
    els.downloadModal.hidden = false;
  }

  function closeDownloadModal() {
    els.downloadModal.hidden = true;
  }

  function confirmDownload() {
    const item = state.current;
    closeDownloadModal();
    if (!item) return;
    const url = (item.downloadUrl || item.dropboxUrl || "").trim();
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = "";
    a.rel = "noopener";
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function bindPlayer() {
    els.btnPlay.addEventListener("click", togglePlay);
    els.btnFullscreen.addEventListener("click", goFullscreen);
    els.btnDownload.addEventListener("click", openDownloadModal);
    els.playerClose.addEventListener("click", closePlayer);
    els.downloadCancel.addEventListener("click", closeDownloadModal);
    els.downloadConfirm.addEventListener("click", confirmDownload);

    els.downloadModal.addEventListener("click", (e) => {
      if (e.target === els.downloadModal) closeDownloadModal();
    });

    els.video.addEventListener("play", updatePlayLabel);
    els.video.addEventListener("pause", updatePlayLabel);
    els.video.addEventListener("timeupdate", syncProgress);
    els.video.addEventListener("loadedmetadata", syncProgress);
    els.video.addEventListener("ended", updatePlayLabel);

    els.progress.addEventListener("pointerdown", () => {
      state.scrubbing = true;
    });
    els.progress.addEventListener("pointerup", () => {
      state.scrubbing = false;
      syncProgress();
    });
    els.progress.addEventListener("input", () => {
      const dur = els.video.duration;
      if (!Number.isFinite(dur) || dur <= 0) return;
      const t = (Number(els.progress.value) / 1000) * dur;
      els.video.currentTime = t;
      els.timeCurrent.textContent = formatTime(t);
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (!els.downloadModal.hidden) closeDownloadModal();
        else if (!els.playerPanel.hidden) closePlayer();
      }
    });
  }

  buildToggles();
  bindPlayer();
  renderTitles();
})();
