(function () {
  const BASE = "";
  const DATA_VERSION = Date.now().toString();

  function withCacheBust(url) {
    return url + (url.includes("?") ? "&" : "?") + "v=" + DATA_VERSION;
  }

  function $(id) {
    return document.getElementById(id);
  }

  function subDays(date, n) {
    const d = new Date(date);
    d.setDate(d.getDate() - n);
    return d;
  }

  function parseISO(s) {
    return new Date(s);
  }

  function toDateKey(date) {
    const d = new Date(date);
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0"),
    ].join("");
  }

  function itemDateKey(item) {
    const iso = item.publishedAt || item.createdAt;
    if (iso) return toDateKey(parseISO(iso));
    return item.fileDateKey || "";
  }

  function formatDateHeader(iso) {
    const d = parseISO(iso);
    return new Intl.DateTimeFormat("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
    }).format(d);
  }

  async function loadManifest() {
    const res = await fetch(withCacheBust(BASE + "data/manifest.json"), { cache: "reload" });
    if (!res.ok)
      throw new Error(
        "manifest.json 을 불러올 수 없습니다. (데이터 동기화 워크플로가 한 번 실행되었는지 확인하세요.)",
      );
    return res.json();
  }

  async function loadAllItems(manifest) {
    const files = manifest.files || [];
    const all = [];
    for (const file of files) {
      const res = await fetch(withCacheBust(BASE + "data/" + encodeURIComponent(file)), { cache: "reload" });
      if (!res.ok) continue;
      const chunk = await res.json();
      const fileDateKey = file.replace("news_", "").replace(".json", "");
      if (Array.isArray(chunk)) {
        all.push(...chunk.map((item) => ({ ...item, fileDateKey })));
      }
    }
    all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return all;
  }

  function filterItems(items, dateFilter) {
    const now = new Date();
    let cutoffKey = null;
    if (dateFilter === "today") cutoffKey = toDateKey(now);
    else if (dateFilter === "3days") cutoffKey = toDateKey(subDays(now, 2));
    else if (dateFilter === "1week") cutoffKey = toDateKey(subDays(now, 6));
    else if (dateFilter === "1month") cutoffKey = toDateKey(subDays(now, 29));

    let filtered = items;
    if (cutoffKey) {
      filtered = items.filter((item) => itemDateKey(item) >= cutoffKey);
    }
    return filtered;
  }

  function groupByDate(items) {
    const groups = {};
    for (const item of items) {
      const dateKey = itemDateKey(item);
      const key = formatDateHeader(`${dateKey.slice(0, 4)}-${dateKey.slice(4, 6)}-${dateKey.slice(6, 8)}T12:00:00+09:00`);
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    }
    return groups;
  }

  function render(groups, pageInfo) {
    const root = $("root");
    const empty = $("empty");
    root.innerHTML = "";

    const keys = Object.keys(groups);
    if (keys.length === 0) {
      empty.classList.remove("hidden");
      return;
    }
    empty.classList.add("hidden");

    for (const dateKey of keys) {
      const section = document.createElement("section");
      section.className = "date-group animate-fade-in";

      const h2 = document.createElement("h2");
      h2.className = "date-header";
      const items = groups[dateKey];
      h2.innerHTML =
        '<span aria-hidden="true">📅</span> <span>' +
        dateKey +
        '</span> <span class="date-count">(' +
        items.length +
        "건)</span>";

      const grid = document.createElement("div");
      grid.className = "news-grid";

      for (const item of items) {
        const card = document.createElement("article");
        card.className = "news-card";

        const topRow = document.createElement("div");
        topRow.className = "news-top-row";
        const spacer = document.createElement("span");
        spacer.className = "news-top-spacer";
        const linkTop = document.createElement("a");
        linkTop.className = "news-link news-link-top";
        linkTop.href = item.link;
        linkTop.target = "_blank";
        linkTop.rel = "noopener noreferrer";
        linkTop.textContent = "원문";
        topRow.appendChild(spacer);
        topRow.appendChild(linkTop);

        const meta = document.createElement("div");
        meta.className = "news-meta";
        const tag = document.createElement("span");
        tag.className = "news-tag";
        tag.textContent = item.filter || "soc";
        const src = document.createElement("span");
        src.className = "news-source";
        src.textContent = (item.source || "").toUpperCase();
        meta.appendChild(tag);
        meta.appendChild(src);

        const title = document.createElement("h3");
        title.className = "news-title";
        title.textContent = item.title;

        card.appendChild(topRow);
        card.appendChild(meta);
        card.appendChild(title);

        // 요약(summary)이 있을 때만: 요약 마지막 오른쪽 끝에 원문 ↗ 배치
        // (content로 "원문 일부"를 미리 보여주면 소스별로 카드가 달라져 보여서 제외)
        const rawSummary = (item.summary || "").toString();
        const summaryText = rawSummary.replace(/\\s+/g, " ").trim();
        if (summaryText) {
          // top 링크는 숨기고, 요약 행 오른쪽 끝 링크를 사용
          linkTop.classList.add("hidden");

          const summaryRow = document.createElement("div");
          summaryRow.className = "news-summary-row";

          const summary = document.createElement("p");
          summary.className = "news-summary";
          summary.textContent = summaryText.slice(0, 140);

          const link = document.createElement("a");
          link.className = "news-link news-link-bottom";
          link.href = item.link;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.textContent = "원문";

          summaryRow.appendChild(summary);
          summaryRow.appendChild(link);
          card.appendChild(summaryRow);
        }

        grid.appendChild(card);
      }

      section.appendChild(h2);
      section.appendChild(grid);
      root.appendChild(section);
    }

    if (pageInfo.totalPages > 1) {
      const pager = document.createElement("nav");
      pager.className = "pagination";
      pager.setAttribute("aria-label", "뉴스 페이지 이동");

      const prev = document.createElement("button");
      prev.type = "button";
      prev.className = "btn btn-refresh";
      prev.textContent = "이전";
      prev.disabled = pageInfo.page <= 1;
      prev.addEventListener("click", () => {
        currentPage -= 1;
        applyAndRender();
        window.scrollTo({ top: 0, behavior: "smooth" });
      });

      const label = document.createElement("span");
      label.className = "pagination-label";
      label.textContent = `${pageInfo.page} / ${pageInfo.totalPages} 페이지 · ${pageInfo.total}건`;

      const next = document.createElement("button");
      next.type = "button";
      next.className = "btn btn-refresh";
      next.textContent = "다음";
      next.disabled = pageInfo.page >= pageInfo.totalPages;
      next.addEventListener("click", () => {
        currentPage += 1;
        applyAndRender();
        window.scrollTo({ top: 0, behavior: "smooth" });
      });

      pager.appendChild(prev);
      pager.appendChild(label);
      pager.appendChild(next);
      root.appendChild(pager);
    }
  }

  let cacheItems = [];
  let currentPage = 1;

  function getFilteredCount() {
    const dateFilter = $("dateFilter").value;
    return filterItems(cacheItems, dateFilter).length;
  }

  async function refresh() {
    const status = $("status");
    status.textContent = "불러오는 중…";
    status.classList.remove("error");

    try {
      const manifest = await loadManifest();
      cacheItems = await loadAllItems(manifest);
      status.textContent = "총 " + cacheItems.length + "건 로드됨";
      applyAndRender();
    } catch (e) {
      console.error(e);
      status.textContent = String(e.message || e);
      status.classList.add("error");
      $("root").innerHTML = "";
      $("empty").classList.remove("hidden");
    }
  }

  function applyAndRender() {
    const dateFilter = $("dateFilter").value;
    const limit = parseInt($("limit").value, 10) || 30;
    const filtered = filterItems(cacheItems, dateFilter);
    const totalPages = Math.max(1, Math.ceil(filtered.length / limit));
    currentPage = Math.min(Math.max(1, currentPage), totalPages);
    const start = (currentPage - 1) * limit;
    let end = Math.min(start + limit, filtered.length);
    const lastItem = filtered[end - 1];
    if (lastItem) {
      const lastDateKey = itemDateKey(lastItem);
      while (end < filtered.length && itemDateKey(filtered[end]) === lastDateKey) {
        end += 1;
      }
    }
    const pageItems = filtered.slice(start, end);
    const groups = groupByDate(pageItems);
    render(groups, {
      page: currentPage,
      totalPages,
      total: filtered.length,
    });
  }

  function shareTelegram() {
    const n = getFilteredCount();
    const text = encodeURIComponent("📰 오늘 수집된 SOC 뉴스 요약\n\n총 " + n + "건이 수집되었습니다.");
    window.open("https://t.me/share/url?url=" + encodeURIComponent(window.location.href) + "&text=" + text, "_blank");
  }

  $("dateFilter").addEventListener("change", () => {
    currentPage = 1;
    applyAndRender();
  });
  $("limit").addEventListener("change", () => {
    currentPage = 1;
    applyAndRender();
  });
  $("reload").addEventListener("click", refresh);
  $("btnTelegram").addEventListener("click", shareTelegram);

  refresh();
})();
