import { requireBackend, requireSession, signedConceptUrl, supabase } from "./backend.js";

const root = document.querySelector("#appContent");
const modal = document.querySelector("#appModal");
const toastElement = document.querySelector("#appToast");

if (!requireBackend(root)) throw new Error("Backend is not configured");

const session = await requireSession();
if (!session) throw new Error("Authentication required");

let view = new URLSearchParams(location.search).get("view") || "home";
let profile;
let projects = [];
let transactions = [];
let notifications = [];
let conceptUrls = new Map();

const views = {
  home: ["Creator workspace", "Your thumbnail workspace"],
  projects: ["Your work", "Projects"],
  brief: ["Create", "New thumbnail brief"],
  billing: ["Membership", "Credits & billing"],
  settings: ["Preferences", "Channel settings"],
};

const statusLabels = {
  draft: "Draft",
  submitted: "Submitted",
  in_progress: "In progress",
  review: "Needs review",
  delivered: "Delivered",
  revision_requested: "Revision requested",
  archived: "Archived",
};

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function formatDate(value) {
  if (!value) return "Not scheduled";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function availableCredits() {
  const reserved = projects
    .filter((project) => project.credits_charged === 0 && ["submitted", "in_progress", "review", "revision_requested"].includes(project.status))
    .reduce((total, project) => total + project.concepts_requested, 0);
  return Math.max(0, profile.monthly_credits + profile.rollover_credits + profile.topup_credits - reserved);
}

function toast(message, type = "info") {
  toastElement.textContent = message;
  toastElement.className = `app-toast ${type}`;
  toastElement.hidden = false;
  clearTimeout(window.thumbforgeToast);
  window.thumbforgeToast = setTimeout(() => { toastElement.hidden = true; }, 3200);
}

function setLoading(element, loading, label = "Please wait...") {
  if (!element) return;
  if (!element.dataset.originalLabel) element.dataset.originalLabel = element.textContent;
  element.disabled = loading;
  element.textContent = loading ? label : element.dataset.originalLabel;
}

async function loadWorkspace() {
  const [profileResult, projectsResult, transactionsResult, notificationsResult] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", session.user.id).single(),
    supabase.from("projects").select("*, concepts(*)").order("submitted_at", { ascending: false }),
    supabase.from("credit_transactions").select("*").order("created_at", { ascending: false }).limit(30),
    supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(20),
  ]);

  if (profileResult.error) throw profileResult.error;
  if (projectsResult.error) throw projectsResult.error;
  if (transactionsResult.error) throw transactionsResult.error;
  if (notificationsResult.error) throw notificationsResult.error;

  profile = profileResult.data;
  projects = projectsResult.data;
  transactions = transactionsResult.data;
  notifications = notificationsResult.data;

  const paths = projects.flatMap((project) => project.concepts || []).map((concept) => concept.storage_path);
  await Promise.all(paths.map(async (path) => {
    try { conceptUrls.set(path, await signedConceptUrl(path)); }
    catch { conceptUrls.set(path, ""); }
  }));
}

function syncChrome() {
  const credits = availableCredits();
  const total = Math.max(credits, profile.plan === "pro" ? 24 : profile.plan === "starter" ? 6 : credits || 1);
  document.querySelector("#sideCredits").textContent = credits;
  document.querySelector("#sidePlan").textContent = `${profile.plan[0].toUpperCase()}${profile.plan.slice(1)} plan`;
  document.querySelector("#sideCreditBar").style.width = `${Math.min(100, (credits / total) * 100)}%`;
  document.querySelector("#projectCount").textContent = projects.length;
  document.querySelector("#profileName").textContent = profile.full_name || session.user.email;
  document.querySelector("#profileChannel").textContent = profile.channel_name || "Creator";
  document.querySelector("#profileInitials").textContent = (profile.full_name || session.user.email)
    .split(/\s|@/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("");
  document.querySelector(".notification-dot").hidden = !notifications.some((item) => !item.read_at);
}

function statusBadge(project) {
  return `<span class="status ${project.status}">${statusLabels[project.status] || project.status}</span>`;
}

function projectImage(project) {
  const selected = project.concepts?.find((concept) => concept.is_selected);
  const first = selected || project.concepts?.[0];
  return first ? conceptUrls.get(first.storage_path) : "";
}

function projectPlaceholder(project) {
  return `<div class="project-placeholder"><img src="assets/brand/thumbforge-logo.png" alt="" /><span>${project.status === "review" ? "Concepts ready" : "In production"}</span></div>`;
}

function projectCard(project) {
  const image = projectImage(project);
  return `
    <article class="project-card" data-status="${project.status}">
      <div class="project-thumb">
        ${image ? `<img src="${image}" alt="${escapeHtml(project.title)}" />` : projectPlaceholder(project)}
        ${statusBadge(project)}
      </div>
      <div class="project-info">
        <h3>${escapeHtml(project.title)}</h3>
        <p>${escapeHtml(project.core_promise)}</p>
        <div class="project-meta">
          <span>${formatDate(project.submitted_at)} · ${project.concepts_requested} credits</span>
          <button class="text-button open-project" data-project="${project.id}" type="button">Open project</button>
        </div>
      </div>
    </article>`;
}

function renderHome() {
  const active = projects.filter((project) => ["submitted", "in_progress", "review", "revision_requested"].includes(project.status)).length;
  const delivered = projects.filter((project) => project.status === "delivered").length;
  const credits = availableCredits();
  return `
    <div class="view-header">
      <div><h2>Welcome back${profile.full_name ? `, ${escapeHtml(profile.full_name.split(" ")[0])}` : ""}</h2><p>Submit briefs, follow production and review finished concepts.</p></div>
      <button class="app-button primary" data-view="brief" type="button">＋ New brief</button>
    </div>
    <div class="stat-grid">
      <div class="stat"><span>Credits available</span><strong>${credits}</strong><small>${profile.monthly_credits} monthly · ${profile.topup_credits} top-up</small></div>
      <div class="stat"><span>Active briefs</span><strong>${active}</strong><small>${profile.plan === "pro" ? "2 active slots" : "1 active slot"}</small></div>
      <div class="stat"><span>Delivered</span><strong>${delivered}</strong><small>all time</small></div>
      <div class="stat"><span>Plan</span><strong class="stat-plan">${profile.plan}</strong><small>${profile.renewal_at ? `Renews ${formatDate(profile.renewal_at)}` : "No active renewal"}</small></div>
    </div>
    <div class="app-grid">
      <section class="app-section">
        <div class="section-row"><h3>Recent projects</h3><button data-view="projects" type="button">View all</button></div>
        ${projects.length ? `<div class="activity-list">${projects.slice(0, 5).map((project) => `
          <button class="activity-item open-project" data-project="${project.id}" type="button">
            <div class="activity-preview">${projectImage(project) ? `<img src="${projectImage(project)}" alt="" />` : `<img src="assets/brand/thumbforge-64.png" alt="" />`}</div>
            <div><h4>${escapeHtml(project.title)}</h4><p>${project.niche} · ${formatDate(project.submitted_at)}</p></div>
            ${statusBadge(project)}
          </button>`).join("")}</div>` : `
          <div class="empty-state compact"><h3>No briefs yet</h3><p>Start with a video link or script.</p><button class="app-button primary small" data-view="brief" type="button">Create first brief</button></div>`}
      </section>
      <div>
        <section class="app-section credit-panel">
          <div class="section-row"><h3>Credit balance</h3><span class="status delivered">${profile.plan}</span></div>
          <div class="credit-number">${credits}</div>
          <p>Monthly credits are used before rollover and top-up credits.</p>
          <div class="credit-bar"><i style="width:${Math.min(100, credits / Math.max(credits, 24) * 100)}%"></i></div>
          <a class="app-button secondary full small" href="pricing.html">Manage plan</a>
        </section>
        <section class="app-section" style="margin-top:18px">
          <div class="section-row"><h3>Quick actions</h3></div>
          <div class="quick-list">
            <button class="quick-action" data-view="brief" type="button">Submit a video <span>New</span></button>
            <button class="quick-action" data-view="projects" type="button">Review concepts <span>${projects.filter((project) => project.status === "review").length} ready</span></button>
            <button class="quick-action" data-view="settings" type="button">Channel memory <span>Saved</span></button>
          </div>
        </section>
      </div>
    </div>`;
}

function renderProjects() {
  return `
    <div class="view-header">
      <div><h2>Projects</h2><p>Every brief from submission to final export.</p></div>
      <button class="app-button primary" data-view="brief" type="button">＋ New brief</button>
    </div>
    <div class="project-toolbar">
      <input class="search-input" id="projectSearch" placeholder="Search projects" />
      <button class="filter-button active" data-filter="all" type="button">All</button>
      <button class="filter-button" data-filter="review" type="button">Review</button>
      <button class="filter-button" data-filter="in_progress" type="button">Active</button>
      <button class="filter-button" data-filter="delivered" type="button">Delivered</button>
    </div>
    ${projects.length ? `<div class="project-grid">${projects.map(projectCard).join("")}</div>` : `<div class="empty-state"><h3>No projects yet</h3><p>Your submitted briefs will appear here.</p><button class="app-button primary" data-view="brief" type="button">Create a brief</button></div>`}`;
}

function renderBrief() {
  const credits = availableCredits();
  return `
    <div class="view-header"><div><h2>Give us the story, not just the title.</h2><p>The source, cast and exclusions shape every concept.</p></div></div>
    <form class="app-form" id="briefForm">
      <section class="form-section">
        <h3>Video source</h3><p>Provide a public link, script, source file, or a combination.</p>
        <div class="form-grid">
          <label class="form-field full">Project title<input name="title" required maxlength="160" /></label>
          <label class="form-field full">YouTube or video link<input name="video_url" type="url" placeholder="https://youtube.com/watch?v=..." /></label>
          <label class="form-field full">Script, transcript, or detailed idea<textarea name="script_text" rows="8"></textarea></label>
          <label class="form-field full">Optional source file<input name="source_file" type="file" accept=".txt,.doc,.docx,.pdf,.srt,.vtt,.mp4,.mov,.webm" /><small>Maximum 50 MB. Private to your account and the production team.</small></label>
        </div>
      </section>
      <section class="form-section">
        <h3>Creative direction</h3><p>Lock the promise, cast and visual energy before production starts.</p>
        <div class="form-grid">
          <label class="form-field">Video niche<select name="niche" required><option>Creator / challenge</option><option>Football / sports</option><option>Podcast</option><option>Business / finance</option><option>Crime / documentary</option><option>Education</option><option>Gaming</option><option>Other</option></select></label>
          <label class="form-field">Concepts<select name="concepts_requested" id="conceptCount"><option value="1" ${credits < 2 ? "selected" : ""}>1 concept · 1 credit</option><option value="2" ${credits >= 2 ? "selected" : ""}>2 concepts · 2 credits</option><option value="3">3 concepts · 3 credits</option></select></label>
          <label class="form-field full">Core promise<input name="core_promise" required maxlength="300" /></label>
          <label class="form-field">People or elements allowed<textarea name="allowed_people" rows="4"></textarea></label>
          <label class="form-field">People or elements to exclude<textarea name="excluded_elements" rows="4"></textarea></label>
          <label class="form-field full">Reference link<input name="reference_url" type="url" /></label>
          <label class="form-field full">What should we take from the reference?<textarea name="reference_notes" rows="4"></textarea></label>
        </div>
      </section>
      <div class="form-footer">
        <p class="form-cost">Available: <strong>${credits} credits</strong>. Credits are charged only when you accept delivered concepts.</p>
        <button class="app-button primary" id="submitBriefButton" type="submit">Submit brief</button>
      </div>
    </form>`;
}

function renderBilling() {
  const credits = availableCredits();
  return `
    <div class="view-header"><div><h2>Credits & billing</h2><p>Your plan, balances and account ledger.</p></div><a class="app-button primary" href="pricing.html">View plans</a></div>
    <div class="billing-grid">
      <section class="plan-panel">
        <p class="app-eyebrow" style="color:#e9afc1">Current plan</p>
        <h2>${profile.plan[0].toUpperCase()}${profile.plan.slice(1)}</h2>
        <div class="credit-number">${credits}</div>
        <p>Monthly: ${profile.monthly_credits} · Rollover: ${profile.rollover_credits} · Top-up: ${profile.topup_credits}</p>
        <p>${profile.renewal_at ? `Renews ${formatDate(profile.renewal_at)}` : "Choose a membership to activate monthly credits."}</p>
      </section>
      <section class="topup-panel">
        <p class="app-eyebrow">Extra capacity</p><h2>Add credits when needed.</h2>
        <p style="color:var(--muted)">Top-up checkout will be enabled with the payment launch. Credits remain attached to your active membership.</p>
        <a class="app-button secondary full" href="pricing.html#plans">Compare memberships</a>
      </section>
    </div>
    <section class="app-section">
      <div class="section-row"><h3>Credit and payment history</h3></div>
      ${transactions.length ? `<div style="overflow:auto"><table class="invoice-table"><thead><tr><th>Date</th><th>Description</th><th>Credits</th><th>Amount</th></tr></thead><tbody>${transactions.map((transaction) => `<tr><td>${formatDate(transaction.created_at)}</td><td>${escapeHtml(transaction.description)}</td><td>${transaction.credit_delta > 0 ? "+" : ""}${transaction.credit_delta}</td><td>${transaction.amount_cents == null ? "—" : `${transaction.currency || "USD"} ${(transaction.amount_cents / 100).toFixed(2)}`}</td></tr>`).join("")}</tbody></table></div>` : `<div class="empty-state compact"><h3>No transactions yet</h3><p>Your subscription, top-ups and delivery deductions will appear here.</p></div>`}
    </section>`;
}

function renderSettings() {
  return `
    <div class="view-header"><div><h2>Channel settings</h2><p>Saved preferences guide every new brief.</p></div></div>
    <div class="settings-layout">
      <nav class="settings-nav"><button class="active" type="button">Channel profile</button><button type="button">Notifications</button><button type="button">Account</button></nav>
      <section class="settings-panel">
        <form class="app-form" id="settingsForm">
          <div class="form-grid">
            <label class="form-field">Your name<input name="full_name" value="${escapeHtml(profile.full_name)}" required /></label>
            <label class="form-field">Account email<input value="${escapeHtml(session.user.email)}" disabled /></label>
            <label class="form-field full">Channel name<input name="channel_name" value="${escapeHtml(profile.channel_name)}" /></label>
            <label class="form-field">Country<input value="${escapeHtml(profile.country_code)}" disabled /></label>
            <label class="form-field">Timezone<input name="timezone" value="${escapeHtml(profile.timezone)}" /></label>
            <label class="form-field full">Visual style<textarea name="visual_style" rows="4">${escapeHtml(profile.visual_style)}</textarea></label>
            <label class="form-field full">Always exclude<textarea name="exclusions" rows="4">${escapeHtml(profile.exclusions)}</textarea></label>
          </div>
          <div class="toggle-row"><div><strong>Delivery alerts</strong><p>Email when concepts are ready.</p></div><button class="toggle ${profile.delivery_alerts ? "on" : ""}" data-profile-toggle="delivery_alerts" type="button"></button></div>
          <div class="toggle-row"><div><strong>Product updates</strong><p>Occasional product and service updates.</p></div><button class="toggle ${profile.product_updates ? "on" : ""}" data-profile-toggle="product_updates" type="button"></button></div>
          <div style="margin-top:20px"><button class="app-button primary" id="saveSettingsButton" type="submit">Save settings</button></div>
        </form>
      </section>
    </div>`;
}

async function openProject(projectId) {
  const project = projects.find((item) => item.id === projectId);
  if (!project) return;
  const concepts = project.concepts || [];
  modal.innerHTML = `
    <div class="modal-card">
      <div class="modal-head"><div>${statusBadge(project)}<h2 style="margin-top:8px">${escapeHtml(project.title)}</h2></div><button id="closeModal" type="button" aria-label="Close">×</button></div>
      <div class="modal-body">
        <p style="color:var(--muted)">${escapeHtml(project.core_promise)}</p>
        ${concepts.length ? `<div class="concept-grid">${concepts.map((concept) => `<article class="concept ${concept.is_selected ? "selected" : ""}"><img src="${conceptUrls.get(concept.storage_path)}" alt="${escapeHtml(concept.label)}" /><div class="concept-footer"><strong>${escapeHtml(concept.label)}</strong><button class="text-button select-concept" data-concept="${concept.id}" type="button">${concept.is_selected ? "Selected" : "Select"}</button></div></article>`).join("")}</div><div class="modal-actions"><button class="app-button secondary" id="requestRevision" type="button">Request revision</button><button class="app-button primary" id="downloadConcept" type="button">Download selected</button></div>` : `<div class="empty-state"><h3>${project.status === "draft" ? "Draft brief" : "Production is underway"}</h3><p>${project.status === "draft" ? "Finish and submit this brief when ready." : "You will receive a notification as soon as reviewed concepts are ready."}</p></div>`}
      </div>
    </div>`;
  modal.hidden = false;
  modal.querySelector("#closeModal").addEventListener("click", () => { modal.hidden = true; });
  modal.addEventListener("click", (event) => { if (event.target === modal) modal.hidden = true; }, { once: true });

  modal.querySelectorAll(".select-concept").forEach((button) => button.addEventListener("click", async () => {
    setLoading(button, true, "Selecting...");
    const { error } = await supabase.rpc("select_concept", { concept_uuid: button.dataset.concept });
    if (error) {
      setLoading(button, false);
      return toast(error.message, "error");
    }
    await refresh("projects");
    modal.hidden = true;
    toast("Concept selected. Your final file is ready to download.", "success");
  }));

  modal.querySelector("#requestRevision")?.addEventListener("click", async () => {
    const message = window.prompt("Describe the revision clearly:");
    if (!message?.trim()) return;
    const { error: revisionError } = await supabase.rpc("request_revision", {
      project_uuid: project.id,
      revision_message: message.trim(),
    });
    if (revisionError) return toast(revisionError.message, "error");
    modal.hidden = true;
    await refresh("projects");
    toast("Revision request sent.", "success");
  });

  modal.querySelector("#downloadConcept")?.addEventListener("click", () => {
    const selected = concepts.find((concept) => concept.is_selected);
    if (!selected) return toast("Select a concept first.", "error");
    const anchor = document.createElement("a");
    anchor.href = conceptUrls.get(selected.storage_path);
    anchor.download = `${project.title}-${selected.label}.png`;
    anchor.target = "_blank";
    anchor.click();
  });
}

function bindView() {
  root.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => navigate(button.dataset.view)));
  root.querySelectorAll(".open-project").forEach((button) => button.addEventListener("click", () => openProject(button.dataset.project)));

  if (view === "projects") {
    const search = document.querySelector("#projectSearch");
    let filter = "all";
    const apply = () => {
      document.querySelectorAll(".project-card").forEach((card) => {
        card.hidden = !((filter === "all" || card.dataset.status === filter) && card.textContent.toLowerCase().includes(search.value.toLowerCase()));
      });
    };
    search.addEventListener("input", apply);
    document.querySelectorAll(".filter-button").forEach((button) => button.addEventListener("click", () => {
      document.querySelectorAll(".filter-button").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      filter = button.dataset.filter;
      apply();
    }));
  }

  if (view === "brief") {
    const form = document.querySelector("#briefForm");
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = document.querySelector("#submitBriefButton");
      const values = new FormData(form);
      const requested = Number(values.get("concepts_requested"));
      if (availableCredits() < requested) return toast("Your current balance cannot cover this brief. Choose a plan or add credits.", "error");
      if (!values.get("video_url") && !values.get("script_text") && !values.get("source_file").size) return toast("Add a video link, script or source file.", "error");
      const file = values.get("source_file");
      setLoading(button, true, "Submitting...");
      let sourcePath = null;
      if (file?.size) {
        if (file.size > 50 * 1024 * 1024) {
          setLoading(button, false);
          return toast("Source files must be 50 MB or smaller.", "error");
        }
        sourcePath = `${session.user.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
        const { error: uploadError } = await supabase.storage.from("brief-files").upload(sourcePath, file);
        if (uploadError) {
          setLoading(button, false);
          return toast(uploadError.message, "error");
        }
      }
      const { error } = await supabase.from("projects").insert({
        user_id: session.user.id,
        title: values.get("title"),
        video_url: values.get("video_url") || null,
        script_text: values.get("script_text") || null,
        source_file_path: sourcePath,
        niche: values.get("niche"),
        concepts_requested: requested,
        core_promise: values.get("core_promise"),
        allowed_people: values.get("allowed_people") || null,
        excluded_elements: values.get("excluded_elements") || null,
        reference_url: values.get("reference_url") || null,
        reference_notes: values.get("reference_notes") || null,
        status: "submitted",
      });
      setLoading(button, false);
      if (error) return toast(error.message, "error");
      toast("Brief submitted successfully.", "success");
      await refresh("projects");
    });
  }

  if (view === "settings") {
    document.querySelectorAll("[data-profile-toggle]").forEach((toggle) => toggle.addEventListener("click", () => {
      const key = toggle.dataset.profileToggle;
      profile[key] = !profile[key];
      toggle.classList.toggle("on", profile[key]);
    }));
    document.querySelector("#settingsForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      const values = new FormData(event.currentTarget);
      const button = document.querySelector("#saveSettingsButton");
      setLoading(button, true, "Saving...");
      const updates = {
        full_name: values.get("full_name"),
        channel_name: values.get("channel_name"),
        timezone: values.get("timezone"),
        visual_style: values.get("visual_style"),
        exclusions: values.get("exclusions"),
        delivery_alerts: profile.delivery_alerts,
        product_updates: profile.product_updates,
      };
      const { data, error } = await supabase.rpc("update_profile_preferences", {
        new_full_name: updates.full_name,
        new_channel_name: updates.channel_name,
        new_timezone: updates.timezone,
        new_visual_style: updates.visual_style,
        new_exclusions: updates.exclusions,
        new_delivery_alerts: updates.delivery_alerts,
        new_product_updates: updates.product_updates,
      });
      setLoading(button, false);
      if (error) return toast(error.message, "error");
      Object.assign(profile, data || updates);
      syncChrome();
      toast("Channel settings saved.", "success");
    });
  }
}

function navigate(target) {
  view = views[target] ? target : "home";
  history.replaceState({}, "", `dashboard.html?view=${view}`);
  document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.view === view));
  document.querySelector("#viewEyebrow").textContent = views[view][0];
  document.querySelector("#viewTitle").textContent = views[view][1];
  root.innerHTML = ({ home: renderHome, projects: renderProjects, brief: renderBrief, billing: renderBilling, settings: renderSettings })[view]();
  bindView();
  document.querySelector("#appSidebar").classList.remove("open");
  window.scrollTo(0, 0);
}

async function refresh(target = view) {
  root.innerHTML = '<div class="loading-state">Refreshing your workspace...</div>';
  await loadWorkspace();
  syncChrome();
  navigate(target);
}

document.querySelectorAll(".app-sidebar [data-view], .profile-button[data-view]").forEach((button) => button.addEventListener("click", () => navigate(button.dataset.view)));
document.querySelector("#menuButton").addEventListener("click", () => document.querySelector("#appSidebar").classList.toggle("open"));
document.querySelector("#signOutButton").addEventListener("click", async () => {
  await supabase.auth.signOut();
  location.replace("login.html");
});
document.querySelector("#notificationButton").addEventListener("click", async () => {
  const unread = notifications.filter((item) => !item.read_at);
  if (!unread.length) return toast("You are all caught up.");
  toast(unread[0].title);
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).in("id", unread.map((item) => item.id));
  notifications = notifications.map((item) => ({ ...item, read_at: item.read_at || new Date().toISOString() }));
  syncChrome();
});

try {
  await loadWorkspace();
  syncChrome();
  navigate(view);
} catch (error) {
  console.error(error);
  root.innerHTML = `<div class="empty-state"><h3>We could not load your workspace</h3><p>${escapeHtml(error.message)}</p><button class="app-button primary" onclick="location.reload()">Try again</button></div>`;
}
