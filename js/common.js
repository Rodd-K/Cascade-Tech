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

  // File types, detected from the file extension.
  const FILE_TYPES = [
    { id: "pdf", label: "PDF", ext: ["pdf"] },
    { id: "python", label: "Python", ext: ["py", "pyw"] },
    { id: "notebook", label: "Notebook", ext: ["ipynb"] },
    { id: "web", label: "Web", ext: ["html", "htm", "css", "php"] },
    { id: "code", label: "Code", ext: ["js", "mjs", "jsx", "ts", "tsx", "java", "c", "cpp", "h", "hpp", "cs", "go", "rs", "rb", "kt", "swift", "sh", "bash", "bat", "ps1", "sql", "lua", "r", "pl"] },
    { id: "docs", label: "Docs", ext: ["doc", "docx", "txt", "md", "rtf", "odt", "ppt", "pptx", "odp"] },
    { id: "data", label: "Data", ext: ["csv", "tsv", "json", "xlsx", "xls", "xml", "yaml", "yml"] },
    { id: "programs", label: "Programs", ext: ["exe", "msi", "apk", "jar", "dmg", "deb", "appimage"] },
    { id: "archives", label: "Archives", ext: ["zip", "rar", "7z", "tar", "gz", "tgz"] },
    { id: "media", label: "Media", ext: ["png", "jpg", "jpeg", "gif", "svg", "webp", "mp4", "mkv", "webm", "mp3", "wav"] },
    { id: "other", label: "Other", ext: [] }
  ];

  const TEXT_EXT = ["py", "pyw", "ipynb", "js", "mjs", "ts", "jsx", "tsx", "html", "htm", "css", "php", "sh", "bash", "bat", "ps1", "sql", "txt", "md", "json", "yaml", "yml", "csv", "env", "ini", "cfg", "conf", "java", "c", "cpp", "cs", "go", "rs", "rb", "kt", "xml"];

  function extOf(name) {
    const m = /\.([^./\\]+)$/.exec(name);
    return m ? m[1].toLowerCase() : "";
  }

  function detectType(name) {
    const e = extOf(name);
    const t = FILE_TYPES.find((x) => x.ext.includes(e));
    return t ? t.id : "other";
  }

  function typeLabel(id) {
    const t = FILE_TYPES.find((x) => x.id === id);
    return t ? t.label : "Other";
  }

  function isTextFile(name) {
    return TEXT_EXT.includes(extOf(name));
  }

  // Suggest a topic from the file's path (folder and file names) and its type.
  const TOPIC_KEYWORDS = [
    ["cybersecurity", /secur|hack|pentest|exploit|malware|\bctf\b|forensic|vulnerab|nmap|burp|wireshark|kali|osint|phish|cyber|metasploit|encrypt/],
    ["ai", /\bai\b|machine learn|\bml\b|neural|tensorflow|pytorch|deep learn|\bnlp\b|\bllm\b|\bgpt\b|keras|scikit|data science/],
    ["networking", /network|\btcp\b|\bdns\b|cisco|router|subnet|\bip\b|firewall|\bvpn\b/],
    ["web-dev", /\bhtml\b|\bcss\b|react|\bnode\b|django|flask|\bphp\b|bootstrap|tailwind|frontend|front end|backend|back end|\bweb\b|netlify|\bvue\b|angular/]
  ];

  function guessTopic(path, typeId) {
    const hay = " " + path.toLowerCase().replace(/[^a-z0-9]+/g, " ") + " ";
    for (const [topic, re] of TOPIC_KEYWORDS) {
      if (re.test(hay)) return topic;
    }
    if (typeId === "web") return "web-dev";
    if (["python", "code", "notebook"].includes(typeId)) return "programming";
    return "other";
  }

  // Look for things that should never be public: tokens, keys, hard-coded passwords.
  const SECRET_PATTERNS = [
    /\b\d{8,10}:[A-Za-z0-9_-]{35}\b/,
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    /\bAKIA[0-9A-Z]{16}\b/,
    /\bsk_(?:live|test)_[0-9a-zA-Z]{16,}/,
    /\bsb_secret_[A-Za-z0-9_-]{10,}/,
    /\bghp_[A-Za-z0-9]{30,}/
  ];
  const ASSIGNMENT = /(api[_-]?key|secret|token|passw(?:or)?d)["']?\s*[:=]\s*["']([^"'\s]{8,})["']/gi;
  const PLACEHOLDER = /your|example|placeholder|changeme|xxxx|<|\*\*\*|token_here|key_here/i;

  function hasSecret(text) {
    if (SECRET_PATTERNS.some((re) => re.test(text))) return true;
    ASSIGNMENT.lastIndex = 0;
    let m;
    while ((m = ASSIGNMENT.exec(text))) {
      if (!PLACEHOLDER.test(m[2])) return true;
    }
    return false;
  }

  window.Cascade = { cfg, CATEGORIES, FILE_TYPES, sb, isConfigured, categoryLabel, typeLabel, detectType, extOf, isTextFile, guessTopic, hasSecret, formatSize, formatDate, downloadUrl, el };
})();
