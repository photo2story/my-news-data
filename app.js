(function () {
  const BASE = "";

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
    const res = await fetch(BASE + "data/manifest.json", { cache: "no-store" });
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
      const res = await fetch(BASE + "data/" + encodeURIComponent(file), { cache: "no-store" });
      if (!res.ok) continue;
      const chunk = await res.json();
      if (Array.isArray(chunk)) all.push(...chunk);
    }
    all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return all;
  }

  function applyFilter(items, dateFilter, limit) {
    const now = new Date();
    let cutoff = null;
    if (dateFilter === "today") cutoff = subDays(now, 1);
    else if (dateFilter === "3days") cutoff = subDays(now, 3);
    else if (dateFilter === "1week") cutoff = subDays(now, 7);
    else if (dateFilter === "1month") cutoff = subDays(now, 30);

    let filtered = items;
    if (cutoff) {
      filtered = items.filter((item) => parseISO(item.createdAt) > cutoff);
    }
    return filtered.slice(0, limit);
  }

  function groupByDate(items) {
    const groups = {};
    for (const item of items) {
      const key = formatDateHeader(item.createdAt);
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    }
    return groups;
  }

  function render(groups) {
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

        const link = document.createElement("a");
        link.className = "news-link";
        link.href = item.link;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "기사 원문 보기";

        card.appendChild(meta);
        card.appendChild(title);
        card.appendChild(link);
        grid.appendChild(card);
      }

      section.appendChild(h2);
      section.appendChild(grid);
      root.appendChild(section);
    }
  }

  let cacheItems = [];

  function getFilteredCount() {
    const dateFilter = $("dateFilter").value;
    const limit = parseInt($("limit").value, 10) || 30;
    return applyFilter(cacheItems, dateFilter, limit).length;
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
    const filtered = applyFilter(cacheItems, dateFilter, limit);
    const groups = groupByDate(filtered);
    render(groups);
  }

  function shareTelegram() {
    const n = getFilteredCount();
    const text = encodeURIComponent("📰 오늘 수집된 SOC 뉴스 요약\n\n총 " + n + "건이 수집되었습니다.");
    window.open("https://t.me/share/url?url=" + encodeURIComponent(window.location.href) + "&text=" + text, "_blank");
  }

  function shareDiscord() {
    const n = getFilteredCount();
    window.alert("디스코드 전송 기능은 백엔드 웹훅(Webhook) 연동 후 활성화됩니다. 현재는 링크가 복사됩니다!");
    navigator.clipboard.writeText(
      "📰 오늘 수집된 SOC 뉴스 요약 (" + n + "건) - " + window.location.href,
    );
  }

  $("dateFilter").addEventListener("change", applyAndRender);
  $("limit").addEventListener("change", applyAndRender);
  $("reload").addEventListener("click", refresh);
  $("btnTelegram").addEventListener("click", shareTelegram);
  $("btnDiscord").addEventListener("click", shareDiscord);

  refresh();
})();
