const LOOKS_PER_PRODUCT = 3;
const PEOPLE = { yan: "Yan", host: "Live host" };

const state = { status: null, products: [], page: 1, selected: new Map(), jobs: [] };
const $ = (id) => document.getElementById(id);

// Tiny element builder. Text always goes in as text, never as HTML.
function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key.startsWith("on")) el.addEventListener(key.slice(2), value);
    else if (key === "class") el.className = value;
    else el[key] = value;
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

async function api(path, body) {
  const res = await fetch(path, body === undefined ? {} : {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Something went wrong (${res.status})`);
  return data;
}

function toast(message) {
  const el = $("toast");
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (el.hidden = true), 5000);
}

// ---------- status ----------

async function loadStatus() {
  const s = (state.status = await api("/api/status"));
  const chip = (on, text) => h("span", { class: `chip ${on ? "on" : "off"}` }, text);
  $("chips").replaceChildren(
    chip(s.live.shopline, s.live.shopline ? "Shopline: connected" : "Shopline: demo"),
    chip(s.live.photos, s.live.photos ? `AI photos: ${s.photoModel.name}` : "AI photos: demo"),
    chip(s.live.claude, s.live.claude ? "Design check: on" : "Design check: demo"),
    chip(s.faces.yan > 0, `Yan: ${s.faces.yan} photos`),
    chip(s.faces.host > 0, `Host: ${s.faces.host} photos`),
  );

  const off = [];
  if (!s.live.shopline) off.push("sample products (not your shop)");
  if (!s.live.photos) off.push("pretend photos (no cost)");
  if (!s.live.claude) off.push("pretend design checks");
  $("demo").hidden = off.length === 0;
  $("demo").textContent = off.length
    ? `Demo mode: you're seeing ${off.join(", ")}. Nothing is sent to your shop. Add your keys (see studio/SETUP.md) to go live.`
    : "";
}

// ---------- step 1: products ----------

async function loadProducts(page = 1) {
  try {
    const { products, hasMore } = await api(`/api/products?page=${page}`);
    state.page = page;
    state.products = page === 1 ? products : state.products.concat(products);
    $("more").hidden = !hasMore;
    renderProducts();
  } catch (err) {
    $("product-grid").replaceChildren(h("p", { class: "error" }, err.message));
  }
}

function renderProducts() {
  $("product-grid").replaceChildren(
    ...state.products.map((p) => {
      const selected = state.selected.has(p.id);
      return h(
        "button",
        {
          class: `product${selected ? " selected" : ""}`,
          onclick: () => {
            if (selected) state.selected.delete(p.id);
            else state.selected.set(p.id, p);
            renderProducts();
          },
        },
        p.imageUrl ? h("img", { src: p.imageUrl, alt: "", loading: "lazy" }) : h("div", { class: "placeholder" }, "No photo"),
        h("div", { class: "name" }, selected && h("span", { class: "tick" }, "✓"), p.title),
      );
    }),
  );
  renderBar();
}

function renderBar() {
  const n = state.selected.size;
  $("bar").hidden = n === 0;
  const cost = state.status?.live.photos
    ? `about US$${(n * LOOKS_PER_PRODUCT * state.status.photoModel.price).toFixed(2)}`
    : "free (demo)";
  $("bar-text").textContent = `${n} product${n === 1 ? "" : "s"} picked · ${n * LOOKS_PER_PRODUCT} photos · ${cost}`;
}

$("make").addEventListener("click", async () => {
  const products = [...state.selected.values()].map(({ id, title }) => ({ id, title }));
  $("make").disabled = true;
  try {
    await api("/api/jobs", { products });
    state.selected.clear();
    renderProducts();
    showTab("review");
    await loadJobs();
  } catch (err) {
    toast(err.message);
  } finally {
    $("make").disabled = false;
  }
});

$("more").addEventListener("click", () => loadProducts(state.page + 1));

// ---------- step 2: review ----------

const BUSY = new Set(["waiting", "making", "uploading"]);

async function loadJobs() {
  state.jobs = await api("/api/jobs");
  renderJobs();
  const busy = state.jobs.some((j) => j.status === "working" || j.looks.some((l) => BUSY.has(l.status)));
  clearTimeout(loadJobs.timer);
  if (busy) loadJobs.timer = setTimeout(loadJobs, 3000);
}

function jobState(job) {
  if (job.status === "failed") return h("p", { class: "state bad" }, `Stopped: ${job.error}`);
  const done = job.looks.filter((l) => !BUSY.has(l.status)).length;
  if (job.status === "working") {
    return h("p", { class: "state" }, job.looks.length ? `Making photos… ${done} of ${job.looks.length} done` : "Downloading and planning the looks…");
  }
  const toReview = job.looks.filter((l) => l.status === "ready").length;
  return h("p", { class: "state" }, toReview ? `${toReview} photo${toReview === 1 ? "" : "s"} waiting for you` : "All done");
}

function checkBadge(check) {
  if (!check) return null;
  const text = {
    pass: `✓ ${check.score}% match: design looks the same`,
    check: `⚠ ${check.score}% match: look closely`,
    fail: `✗ ${check.score}% match: design changed`,
  }[check.verdict];
  return h("div", { class: `badge ${check.verdict}` }, text);
}

function lookActions(job, look) {
  const act = (label, cls, fn) => h("button", { class: `small ${cls}`, onclick: fn }, label);
  const approve = act("Approve & upload", "go", async (e) => {
    if (!confirm(`Add this photo to "${job.productTitle}" on your shop? Your current photos stay.`)) return;
    e.target.disabled = true;
    e.target.textContent = "Uploading…";
    try {
      const updated = await api(`/api/jobs/${job.id}/looks/${look.id}/approve`, {});
      const after = updated.looks.find((l) => l.id === look.id);
      toast(after.status === "uploaded" ? "Uploaded to your shop ✓" : after.error);
    } catch (err) {
      toast(err.message);
    }
    loadJobs();
  });
  const redo = act("Redo", "", async () => {
    const note = prompt("What should change? For example: \"sleeves must be longer\" or \"make the background brighter\". Leave empty to just try again.", look.note || "");
    if (note === null) return;
    try {
      await api(`/api/jobs/${job.id}/looks/${look.id}/redo`, { note });
    } catch (err) {
      toast(err.message);
    }
    loadJobs();
  });
  const reject = act("Reject", "", async () => {
    try {
      await api(`/api/jobs/${job.id}/looks/${look.id}/reject`, {});
    } catch (err) {
      toast(err.message);
    }
    loadJobs();
  });

  switch (look.status) {
    case "ready":
      return look.demo ? [redo, reject] : [approve, redo, reject];
    case "failed":
    case "rejected":
      return [redo];
    default:
      return [];
  }
}

function lookCard(job, look) {
  const statusText = {
    waiting: "Waiting in line…",
    making: "Making photo… (about 30–60 seconds)",
    uploading: "Uploading to your shop…",
  }[look.status];
  const picture = look.file && !BUSY.has(look.status)
    ? h("a", { href: `/images/${look.file}`, target: "_blank" }, h("img", { src: `/images/${look.file}`, alt: look.brief.name }))
    : h("div", { class: "placeholder" }, statusText || "No photo");

  return h(
    "div",
    { class: "card" },
    picture,
    h(
      "div",
      { class: "body" },
      h("div", { class: "title" }, look.brief.name),
      h("div", { class: "who" }, `${PEOPLE[look.brief.person] || look.brief.person} · ${look.brief.scene}`),
      look.status === "ready" && checkBadge(look.check),
      look.status === "ready" && look.check?.differences.length > 0 &&
        h("ul", { class: "notes" }, look.check.differences.map((d) => h("li", {}, d))),
      look.status === "ready" && look.check?.realism.length > 0 &&
        h("ul", { class: "notes" }, look.check.realism.map((d) => h("li", {}, d))),
      look.demo && look.status === "ready" && h("div", { class: "who" }, "Demo photo: can't be uploaded."),
      look.error && h("div", { class: "error" }, look.error),
      look.status === "uploaded" && h("div", { class: "done" }, "✓ On your shop"),
      look.status === "rejected" && h("div", { class: "who" }, "Rejected"),
      h("div", { class: "actions" }, lookActions(job, look)),
    ),
  );
}

function renderJobs() {
  $("no-jobs").hidden = state.jobs.length > 0;
  const waiting = state.jobs.reduce((n, j) => n + j.looks.filter((l) => l.status === "ready").length, 0);
  $("waiting").textContent = waiting || "";

  $("jobs").replaceChildren(
    ...state.jobs.map((job) =>
      h(
        "div",
        { class: "job" },
        h("h2", {}, job.productTitle),
        jobState(job),
        h(
          "div",
          { class: "row" },
          h(
            "div",
            { class: "card original" },
            job.sourceFile ? h("img", { src: `/images/${job.sourceFile}`, alt: "original" }) : h("div", { class: "placeholder" }, "Downloading…"),
            h("div", { class: "body" }, h("div", { class: "title" }, "Your real product photo"), h("div", { class: "who" }, "Compare the design against this")),
          ),
          job.looks.map((look) => lookCard(job, look)),
        ),
      ),
    ),
  );
}

// ---------- tabs ----------

function showTab(name) {
  for (const tab of document.querySelectorAll(".tab")) tab.classList.toggle("active", tab.dataset.tab === name);
  $("products").hidden = name !== "products";
  $("review").hidden = name !== "review";
  if (name === "review") $("bar").hidden = true;
  else renderBar();
}

for (const tab of document.querySelectorAll(".tab")) {
  tab.addEventListener("click", () => showTab(tab.dataset.tab));
}

loadStatus().then(() => loadProducts());
loadJobs();
