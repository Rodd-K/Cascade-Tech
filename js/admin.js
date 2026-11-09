(function () {
  const { cfg, CATEGORIES, sb, isConfigured, categoryLabel, formatSize, formatDate, el } = window.Cascade;

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

  $("upload-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const status = $("upload-status");
    const btn = $("publish");
    const file = $("file").files[0];
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      setStatus(status, "That file is over 50 MB. Compress it or split it, then try again.", "err");
      return;
    }

    btn.disabled = true;
    setStatus(status, "Uploading...");

    const category = $("category").value;
    const path = category + "/" + Date.now() + "-" + safeName(file.name);

    const up = await sb.storage.from(cfg.BUCKET).upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
    if (up.error) {
      setStatus(status, "Upload failed: " + up.error.message, "err");
      btn.disabled = false;
      return;
    }

    const ins = await sb.from("resources").insert({
      title: $("title").value.trim(),
      description: $("description").value.trim(),
      category,
      access: $("access").value,
      file_path: path,
      file_name: file.name,
      file_size: file.size
    });

    if (ins.error) {
      await sb.storage.from(cfg.BUCKET).remove([path]); // don't leave an orphan file behind
      setStatus(status, "Could not publish: " + ins.error.message, "err");
      btn.disabled = false;
      return;
    }

    setStatus(status, "Published. It's live on the site now.", "ok");
    $("upload-form").reset();
    btn.disabled = false;
    loadManageList();
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
