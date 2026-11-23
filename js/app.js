(function () {
  const { CATEGORIES, sb, isConfigured, categoryLabel, typeLabel, formatSize, formatDate, downloadUrl, el } = window.Cascade;

  const listEl = document.getElementById("list");
  const countEl = document.getElementById("count");
  const chipsEl = document.getElementById("chips");
  const typeChipsEl = document.getElementById("type-chips");
  const searchEl = document.getElementById("search");

  let all = [];
  let activeCategory = "all";
  let activeType = "all";

  /* ---------- typed intro (runs once on load) ---------- */
  const typedEl = document.getElementById("typed");
  const intro = "Free guides, scripts and cheat sheets for every corner of tech.";
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reduce) {
    typedEl.textContent = intro;
  } else {
    let i = 0;
    const tick = () => {
      typedEl.textContent = intro.slice(0, ++i);
      if (i < intro.length) setTimeout(tick, 28);
    };
    setTimeout(tick, 350);
  }

  /* ---------- category chips ---------- */
  function buildChips() {
    const items = [{ id: "all", label: "All" }].concat(CATEGORIES);
    items.forEach((c) => {
      const b = el("button", { class: "chip", type: "button", "aria-pressed": String(c.id === activeCategory), "data-id": c.id, text: c.label });
      b.addEventListener("click", () => {
        activeCategory = c.id;
        chipsEl.querySelectorAll(".chip").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.id === activeCategory)));
        render();
      });
      chipsEl.appendChild(b);
    });
  }

  // Only show file-type chips for types that actually exist in the library.
  function buildTypeChips() {
    typeChipsEl.replaceChildren();
    const present = Array.from(new Set(all.map((r) => r.file_type || "other")));
    if (present.length < 2) return;
    [{ id: "all", label: "Any type" }].concat(present.map((id) => ({ id, label: typeLabel(id) }))).forEach((c) => {
      const b = el("button", { class: "chip", type: "button", "aria-pressed": String(c.id === activeType), "data-id": c.id, text: c.label });
      b.addEventListener("click", () => {
        activeType = c.id;
        typeChipsEl.querySelectorAll(".chip").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.id === activeType)));
        render();
      });
      typeChipsEl.appendChild(b);
    });
  }

  /* ---------- rendering ---------- */
  function state(msg) {
    listEl.replaceChildren();
    listEl.appendChild(el("li", { class: "state", text: msg }));
  }

  function render() {
    const q = searchEl.value.trim().toLowerCase();
    const shown = all.filter((r) => {
      const inCat = activeCategory === "all" || r.category === activeCategory;
      const inType = activeType === "all" || (r.file_type || "other") === activeType;
      const inText = !q || (r.title + " " + (r.description || "")).toLowerCase().includes(q);
      return inCat && inType && inText;
    });

    countEl.textContent = shown.length + (shown.length === 1 ? " material" : " materials");

    if (!shown.length) {
      state(all.length ? "No matches. Try a different word or category." : "Nothing here yet. New materials are added regularly, so check back soon.");
      return;
    }

    listEl.replaceChildren();
    shown.forEach((r) => {
      const meta = el("div", { class: "res-meta" }, [
        el("span", { class: "badge" + (r.access === "premium" ? " premium" : ""), text: r.access === "premium" ? "Premium" : "Free" }),
        el("span", { text: categoryLabel(r.category) }),
        el("span", { text: typeLabel(r.file_type) }),
        el("span", { text: formatSize(r.file_size) }),
        el("span", { text: formatDate(r.created_at) })
      ]);

      const info = el("div", {}, [
        el("h3", { class: "res-title", text: r.title }),
        r.description ? el("p", { class: "res-desc", text: r.description }) : null,
        meta
      ]);

      const dl = el("a", { class: "btn", href: downloadUrl(r), rel: "noopener", "aria-label": "Download " + r.title, text: "Download" });

      listEl.appendChild(el("li", { class: "res" }, [info, dl]));
    });
  }

  /* ---------- load ---------- */
  async function load() {
    if (!isConfigured || !sb) {
      state("Setup needed: add your Supabase URL and anon key in js/config.js.");
      countEl.textContent = "";
      return;
    }
    state("Loading materials...");
    const { data, error } = await sb.from("resources").select("*").order("created_at", { ascending: false });
    if (error) {
      state("Could not load materials. Check your connection and refresh the page.");
      console.error(error);
      return;
    }
    all = data || [];
    buildTypeChips();
    render();
  }

  searchEl.addEventListener("input", render);
  buildChips();
  load();
})();
