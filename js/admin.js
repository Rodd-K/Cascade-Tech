(function () {
  const { cfg, CATEGORIES, FILE_TYPES, sb, isConfigured, categoryLabel, detectType, isTextFile, extOf, guessTopic, hasSecret, formatSize, formatDate, el } = window.Cascade;

  const $ = (id) => document.getElementById(id);
  const loginView = $("login-view");
  const dashView = $("dash-view");

  if (!isConfigured || !sb) {
    $("setup-msg").classList.remove("hidden");
    return;
  }

  CATEGORIES.forEach((c) => $("category").appendChild(el("option", { value: c.id, text: c.label })));

  function setStatus(node, msg, kind) {
    node.textContent = msg;
    node.className = "status" + (kind ? " " + kind : "");
  }

  /* ---------- auth ---------- */
  function showSession(session) {
    if (session) {
      loginView.classList.add("hidden");
      dashView.classList.remove("hidden");
      $("who").textContent = "Signed in as " + session.user.email;
      loadManageList();
    } else {
      dashView.classList.add("hidden");
      loginView.classList.remove("hidden");
    }
  }

  $("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const status = $("login-status");
    setStatus(status, "Signing in...");
    const { error } = await sb.auth.signInWithPassword({ email: $("email").value.trim(), password: $("password").value });
    if (error) {
      setStatus(status, "Sign in failed: " + error.message, "err");
      return;
    }
    $("password").value = "";
    setStatus(status, "");
  });

  $("logout").addEventListener("click", () => sb.auth.signOut());

  sb.auth.onAuthStateChange((_event, session) => showSession(session));
  sb.auth.getSession().then(({ data }) => showSession(data.session));

  /* ---------- upload ---------- */
  function safeName(name) {
    return name.normalize("NFKD").replace(/[^\w.\-]+/g, "_").replace(/_+/g, "_").slice(-100);
  }

  function titleFromName(name) {
    return name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim().slice(0, 120) || name;
  }

  $("upload-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const status = $("upload-status");
    const btn = $("publish");
    const files = Array.from($("file").files);
    if (!files.length) return;

    const category = $("category").value;
    const access = $("access").value;
    const description = $("description").value.trim();
    const customTitle = $("title").value.trim();
    const failed = [];
    let done = 0;

    btn.disabled = true;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setStatus(status, "Uploading " + (i + 1) + " of " + files.length + ": " + file.name);

      if (file.size > 50 * 1024 * 1024) {
        failed.push(file.name + " (over 50 MB)");
        continue;
      }

      const fileType = detectType(file.name);
      const path = fileType + "/" + Date.now() + "-" + i + "-" + safeName(file.name);
      const up = await sb.storage.from(cfg.BUCKET).upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
      if (up.error) {
        failed.push(file.name + " (" + up.error.message + ")");
        continue;
      }

      const ins = await sb.from("resources").insert({
        title: files.length === 1 && customTitle ? customTitle : titleFromName(file.name),
        description,
        category,
        access,
        file_type: fileType,
        file_path: path,
        file_name: file.name,
        file_size: file.size
      });

      if (ins.error) {
        await sb.storage.from(cfg.BUCKET).remove([path]); // don't leave an orphan file behind
        failed.push(file.name + " (" + ins.error.message + ")");
        continue;
      }
      done++;
    }

    btn.disabled = false;

    if (failed.length) {
      setStatus(status, "Published " + done + " of " + files.length + ". Failed: " + failed.join("; "), "err");
    } else {
      setStatus(status, "Published " + done + (done === 1 ? " material" : " materials") + ". Live on the site now.", "ok");
      $("upload-form").reset();
    }
    if (done) loadManageList();
  });

  /* ---------- bulk import ---------- */
  const MAX_BYTES = 50 * 1024 * 1024;
  const JUNK = /(^|\/)(__MACOSX|\.git|node_modules)(\/|$)|(^|\/)(\.DS_Store|Thumbs\.db|desktop\.ini)$|(^|\/)\._/i;
  let bulkItems = [];

  const bulkStatus = $("bulk-status");

  function fillSelect(select, options, withPrompt) {
    if (withPrompt) select.appendChild(el("option", { value: "", text: withPrompt }));
    options.forEach((o) => select.appendChild(el("option", { value: o.id, text: o.label })));
  }
  fillSelect($("bulk-topic-all"), CATEGORIES, "Choose a topic...");

  function updateBulkCount() {
    const n = bulkItems.filter((x) => x.include).length;
    $("bulk-count").textContent = n + " of " + bulkItems.length + " checked";
    $("bulk-publish").disabled = n === 0;
  }

  function makeSelect(options, value, onChange) {
    const sel = el("select", {});
    fillSelect(sel, options);
    sel.value = value;
    sel.addEventListener("change", () => onChange(sel.value));
    return sel;
  }

  function renderBulk() {
    const body = $("bulk-body");
    body.replaceChildren();
    bulkItems.forEach((it) => {
      const cb = el("input", { type: "checkbox", "aria-label": "Include " + it.name });
      cb.checked = it.include;
      cb.addEventListener("change", () => { it.include = cb.checked; updateBulkCount(); });

      const title = el("input", { type: "text", maxlength: "120", "aria-label": "Title for " + it.name });
      title.value = it.title;
      title.addEventListener("input", () => { it.title = title.value; });

      const note = it.flagged
        ? el("span", { class: "warn", text: it.flagReason })
        : el("span", { text: "" });

      body.appendChild(el("tr", { class: it.flagged ? "flagged" : "" }, [
        el("td", {}, [cb]),
        el("td", {}, [title, el("span", { class: "src", text: it.path })]),
        el("td", {}, [makeSelect(FILE_TYPES, it.type, (v) => { it.type = v; })]),
        el("td", {}, [makeSelect(CATEGORIES, it.topic, (v) => { it.topic = v; })]),
        el("td", { text: it.size ? formatSize(it.size) : "" }),
        el("td", {}, [note])
      ]));
    });
    $("bulk-all").checked = bulkItems.every((x) => x.include);
    updateBulkCount();
  }

  $("bulk-all").addEventListener("change", () => {
    const on = $("bulk-all").checked;
    bulkItems.forEach((x) => { x.include = on; });
    renderBulk();
  });

  $("bulk-topic-all").addEventListener("change", () => {
    const v = $("bulk-topic-all").value;
    if (!v) return;
    bulkItems.forEach((x) => { if (x.include) x.topic = v; });
    $("bulk-topic-all").value = "";
    renderBulk();
  });

  $("bulk-scan").addEventListener("click", async () => {
    const picked = Array.from($("bulk-files").files);
    if (!picked.length) {
      setStatus(bulkStatus, "Choose at least one zip or file first.", "err");
      return;
    }
    if (!window.JSZip) {
      setStatus(bulkStatus, "The zip reader didn't load. Check your connection and refresh the page.", "err");
      return;
    }

    $("bulk-scan").disabled = true;
    bulkItems = [];
    const skipped = [];
    const raw = [];

    for (const f of picked) {
      if (/\.zip$/i.test(f.name)) {
        setStatus(bulkStatus, "Opening " + f.name + "...");
        try {
          const zip = await window.JSZip.loadAsync(f);
          const root = f.name.replace(/\.zip$/i, "");
          Object.values(zip.files)
            .filter((z) => !z.dir && !JUNK.test(z.name))
            .forEach((z) => {
              raw.push({
                path: root + "/" + z.name,
                name: z.name.split("/").pop(),
                size: z._data && z._data.uncompressedSize ? z._data.uncompressedSize : 0,
                read: () => z.async("blob"),
                readText: () => z.async("string")
              });
            });
        } catch (err) {
          skipped.push(f.name + " (could not open: " + err.message + ")");
        }
      } else {
        raw.push({ path: f.name, name: f.name, size: f.size, read: async () => f, readText: () => f.text() });
      }
    }

    for (let i = 0; i < raw.length; i++) {
      const r = raw[i];
      if (i % 10 === 0) setStatus(bulkStatus, "Sorting file " + (i + 1) + " of " + raw.length + "...");
      const type = detectType(r.name);
      const item = {
        ...r,
        type,
        topic: guessTopic(r.path, type),
        title: titleFromName(r.name),
        include: true,
        flagged: false,
        flagReason: ""
      };

      if (/^\.env/i.test(r.name)) {
        item.flagged = true;
        item.flagReason = "Looks like a secrets file";
      } else if (isTextFile(r.name) && (!r.size || r.size <= 1024 * 1024)) {
        try {
          const text = (await r.readText()).slice(0, 300000);
          if (hasSecret(text)) {
            item.flagged = true;
            item.flagReason = "Possible token or password inside";
          }
        } catch (err) { /* unreadable as text: leave it */ }
      }
      if (item.flagged) item.include = false;
      if (r.size > MAX_BYTES) {
        item.include = false;
        item.flagged = true;
        item.flagReason = "Over 50 MB";
      }
      bulkItems.push(item);
    }

    $("bulk-scan").disabled = false;

    if (!bulkItems.length) {
      $("bulk-review").classList.add("hidden");
      setStatus(bulkStatus, skipped.length ? "Nothing to import. " + skipped.join("; ") : "No files found inside.", "err");
      return;
    }

    const flagged = bulkItems.filter((x) => x.flagged).length;
    let msg = "Found " + bulkItems.length + " files.";
    if (flagged) msg += " " + flagged + " flagged and left unchecked. Open them and remove any secrets before ticking them.";
    if (skipped.length) msg += " Skipped: " + skipped.join("; ");
    setStatus(bulkStatus, msg, flagged || skipped.length ? "err" : "ok");
    $("bulk-review").classList.remove("hidden");
    renderBulk();
  });

  $("bulk-publish").addEventListener("click", async () => {
    const queue = bulkItems.filter((x) => x.include);
    if (!queue.length) return;

    const access = $("bulk-access").value;
    const failed = [];
    let finished = 0;
    let next = 0;

    $("bulk-publish").disabled = true;
    $("bulk-scan").disabled = true;

    async function worker() {
      while (next < queue.length) {
        const idx = next++;
        const it = queue[idx];
        setStatus(bulkStatus, "Publishing " + Math.min(finished + 1, queue.length) + " of " + queue.length + "...");
        try {
          const blob = await it.read();
          if (blob.size > MAX_BYTES) throw new Error("over 50 MB");

          const path = it.type + "/" + Date.now() + "-" + idx + "-" + safeName(it.name);
          const up = await sb.storage.from(cfg.BUCKET).upload(path, blob, {
            contentType: it.type === "pdf" ? "application/pdf" : "application/octet-stream",
            upsert: false
          });
          if (up.error) throw new Error(up.error.message);

          const ins = await sb.from("resources").insert({
            title: it.title.trim() || titleFromName(it.name),
            description: "",
            category: it.topic,
            access,
            file_type: it.type,
            file_path: path,
            file_name: it.name,
            file_size: blob.size
          });
          if (ins.error) {
            await sb.storage.from(cfg.BUCKET).remove([path]);
            throw new Error(ins.error.message + (/file_type/.test(ins.error.message) ? " (run supabase/add-file-type.sql in the SQL Editor first)" : ""));
          }
          it.published = true;
        } catch (err) {
          failed.push(it.name + " (" + err.message + ")");
        }
        finished++;
      }
    }

    await Promise.all([worker(), worker(), worker()]);

    const ok = queue.filter((x) => x.published).length;
    bulkItems = bulkItems.filter((x) => !x.published);
    $("bulk-scan").disabled = false;

    if (failed.length) {
      setStatus(bulkStatus, "Published " + ok + " of " + queue.length + ". Failed: " + failed.join("; "), "err");
    } else {
      setStatus(bulkStatus, "Published " + ok + " files. They're live on the site now.", "ok");
    }
    if (bulkItems.length) renderBulk(); else $("bulk-review").classList.add("hidden");
    if (ok) loadManageList();
  });

  /* ---------- manage ---------- */
  async function loadManageList() {
    const box = $("manage-list");
    box.replaceChildren(el("p", { class: "state", text: "Loading..." }));
    const { data, error } = await sb.from("resources").select("*").order("created_at", { ascending: false });
    if (error) {
      box.replaceChildren(el("p", { class: "state", text: "Could not load materials: " + error.message }));
      return;
    }
    if (!data.length) {
      box.replaceChildren(el("p", { class: "state", text: "Nothing published yet. Use the form above to post your first material." }));
      return;
    }
    box.replaceChildren();
    data.forEach((r) => {
      const del = el("button", { class: "btn danger", type: "button", text: "Delete" });
      del.addEventListener("click", async () => {
        if (!confirm('Delete "' + r.title + '"? The file will be removed for everyone.')) return;
        del.disabled = true;
        const rm = await sb.from("resources").delete().eq("id", r.id);
        if (rm.error) {
          alert("Could not delete: " + rm.error.message);
          del.disabled = false;
          return;
        }
        await sb.storage.from(cfg.BUCKET).remove([r.file_path]);
        loadManageList();
      });

      box.appendChild(el("div", { class: "manage-item" }, [
        el("div", {}, [
          el("div", { class: "t", text: r.title }),
          el("div", { class: "m", text: [categoryLabel(r.category), r.access === "premium" ? "Premium" : "Free", formatSize(r.file_size), formatDate(r.created_at)].join("   ") })
        ]),
        del
      ]));
    });
  }
})();
