// Shared helpers for the public site and the admin page.
(function () {
  const cfg = window.CASCADE_CONFIG || {};

  const CATEGORIES = [
    { id: "programming", label: "Programming" },
    { id: "cybersecurity", label: "Cybersecurity" },
    { id: "web-dev", label: "Web dev" },
    { id: "ai", label: "AI" },
    { id: "networking", label: "Networking" },
    { id: "other", label: "Other" }
  ];

  const isConfigured = Boolean(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY);
  const sb = isConfigured && window.supabase
    ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY)
    : null;

  function categoryLabel(id) {
    const c = CATEGORIES.find((x) => x.id === id);
    return c ? c.label : id;
  }

  function formatSize(bytes) {
    if (!bytes && bytes !== 0) return "";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  function formatDate(iso) {
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }

  function downloadUrl(resource) {
    return sb.storage
      .from(cfg.BUCKET)
      .getPublicUrl(resource.file_path, { download: resource.file_name }).data.publicUrl;
  }

  function el(tag, props, children) {
    const node = document.createElement(tag);
    Object.entries(props || {}).forEach(([k, v]) => {
      if (k === "class") node.className = v;
      else if (k === "text") node.textContent = v;
      else node.setAttribute(k, v);
    });
    (children || []).forEach((c) => c && node.appendChild(c));
    return node;
  }

  window.Cascade = { cfg, CATEGORIES, sb, isConfigured, categoryLabel, formatSize, formatDate, downloadUrl, el };
})();
