import { requireBackend, requireSession, supabase } from "./backend.js";

const queue = document.querySelector("#adminQueue");
if (!requireBackend(queue)) throw new Error("Backend not configured");
const session = await requireSession();
if (!session) throw new Error("Authentication required");

const { data: adminProfile } = await supabase.from("profiles").select("role").eq("id", session.user.id).single();
if (adminProfile?.role !== "admin") {
  queue.innerHTML = '<div class="empty-state"><h3>Administrator access required</h3><p>This account cannot access production operations.</p><a class="app-button primary" href="dashboard.html">Return to workspace</a></div>';
  throw new Error("Administrator access required");
}

let projects = [];
let filter = "active";
const modal = document.querySelector("#appModal");
const toastElement = document.querySelector("#appToast");

function toast(message, type = "info") {
  toastElement.textContent = message;
  toastElement.className = `app-toast ${type}`;
  toastElement.hidden = false;
  setTimeout(() => { toastElement.hidden = true; }, 3000);
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

async function load() {
  queue.innerHTML = '<div class="loading-state">Loading production queue...</div>';
  const { data, error } = await supabase
    .from("projects")
    .select("*, profiles!projects_user_id_fkey(id, full_name, channel_name, country_code, plan, monthly_credits, rollover_credits, topup_credits, renewal_at), concepts(*), revisions(*)")
    .order("submitted_at", { ascending: false });
  if (error) {
    queue.innerHTML = `<div class="empty-state"><h3>Could not load queue</h3><p>${escapeHtml(error.message)}</p></div>`;
    return;
  }
  projects = data;
  render();
}

function renderStats() {
  const counts = {
    submitted: projects.filter((project) => project.status === "submitted").length,
    production: projects.filter((project) => ["in_progress", "revision_requested"].includes(project.status)).length,
    review: projects.filter((project) => project.status === "review").length,
    delivered: projects.filter((project) => project.status === "delivered").length,
  };
  document.querySelector("#adminStats").innerHTML = Object.entries(counts).map(([label, count]) => `<div class="stat"><span>${label.replace("_", " ")}</span><strong>${count}</strong></div>`).join("");
}

function matches(project) {
  const query = document.querySelector("#adminSearch").value.toLowerCase();
  const text = `${project.title} ${project.profiles?.full_name || ""} ${project.profiles?.channel_name || ""}`.toLowerCase();
  const filterMatch = filter === "all"
    || (filter === "active" && ["submitted", "in_progress", "revision_requested"].includes(project.status))
    || project.status === filter;
  return filterMatch && text.includes(query);
}

function render() {
  renderStats();
  const visible = projects.filter(matches);
  queue.innerHTML = visible.length ? visible.map((project) => `
    <article class="admin-project">
      <div class="admin-project-main">
        <div><span class="status ${project.status}">${project.status.replaceAll("_", " ")}</span><h2>${escapeHtml(project.title)}</h2><p>${escapeHtml(project.core_promise)}</p></div>
        <div class="admin-customer"><strong>${escapeHtml(project.profiles?.full_name || "Member")}</strong><span>${escapeHtml(project.profiles?.channel_name || "")} · ${escapeHtml(project.profiles?.country_code || "")}</span></div>
      </div>
      <div class="admin-project-meta"><span>${project.niche}</span><span>${project.concepts_requested} concepts</span><span>${formatDate(project.submitted_at)}</span><span>${project.concepts?.length || 0} files uploaded</span></div>
      <div class="admin-project-actions"><button class="app-button secondary small open-admin-project" data-project="${project.id}" type="button">Open brief</button></div>
    </article>`).join("") : '<div class="empty-state"><h3>No matching projects</h3><p>Try another queue filter.</p></div>';
  document.querySelectorAll(".open-admin-project").forEach((button) => button.addEventListener("click", () => openProject(button.dataset.project)));
}

async function openProject(projectId) {
  const project = projects.find((item) => item.id === projectId);
  if (!project) return;
  let sourceFileUrl = "";
  if (project.source_file_path) {
    const { data } = await supabase.storage.from("brief-files").createSignedUrl(project.source_file_path, 3600);
    sourceFileUrl = data?.signedUrl || "";
  }
  modal.innerHTML = `
    <div class="modal-card admin-modal-card">
      <div class="modal-head"><div><span class="status ${project.status}">${project.status.replaceAll("_", " ")}</span><h2 style="margin-top:8px">${escapeHtml(project.title)}</h2></div><button id="closeModal" type="button">×</button></div>
      <div class="modal-body">
        <div class="admin-brief-grid">
          <section><p class="app-eyebrow">Core promise</p><p>${escapeHtml(project.core_promise)}</p><p class="app-eyebrow">Source</p>${project.video_url ? `<p><a class="text-button" href="${escapeHtml(project.video_url)}" target="_blank" rel="noopener">Open video source</a></p>` : ""}${sourceFileUrl ? `<p><a class="text-button" href="${sourceFileUrl}" target="_blank" rel="noopener">Open private source file</a></p>` : ""}<div class="admin-script">${escapeHtml(project.script_text || "No pasted script.")}</div></section>
          <aside><dl><dt>Creator</dt><dd>${escapeHtml(project.profiles?.full_name || "")}</dd><dt>Channel</dt><dd>${escapeHtml(project.profiles?.channel_name || "")}</dd><dt>Niche</dt><dd>${escapeHtml(project.niche)}</dd><dt>Allowed</dt><dd>${escapeHtml(project.allowed_people || "Not specified")}</dd><dt>Exclude</dt><dd>${escapeHtml(project.excluded_elements || "Not specified")}</dd><dt>Reference</dt><dd>${project.reference_url ? `<a href="${escapeHtml(project.reference_url)}" target="_blank">Open link</a>` : "None"}</dd></dl></aside>
        </div>
        <section class="admin-delivery">
          <h3>Production and delivery</h3>
          <div class="admin-controls">
            <label>Status<select id="adminStatus">${["submitted", "in_progress", "revision_requested", "archived"].map((status) => `<option value="${status}" ${status === project.status ? "selected" : ""}>${status.replaceAll("_", " ")}</option>`).join("")}</select></label>
            <label>Upload concept images<input id="conceptFiles" type="file" accept="image/png,image/jpeg,image/webp" multiple /></label>
          </div>
          <div class="admin-existing-concepts">${project.concepts?.map((concept) => `<span>${escapeHtml(concept.label)}</span>`).join("") || "No concepts uploaded yet."}</div>
          <div class="modal-actions"><button class="app-button secondary" id="saveAdminStatus" type="button">Save status</button><button class="app-button primary" id="uploadConcepts" type="button">Upload and send to review</button></div>
        </section>
        <section class="admin-delivery">
          <h3>Customer plan and credits</h3>
          <div class="admin-controls account-controls">
            <label>Plan<select id="customerPlan">${["free", "starter", "pro", "custom"].map((plan) => `<option value="${plan}" ${plan === project.profiles?.plan ? "selected" : ""}>${plan}</option>`).join("")}</select></label>
            <label>Monthly credits<input id="monthlyCredits" type="number" min="0" value="${project.profiles?.monthly_credits || 0}" /></label>
            <label>Rollover credits<input id="rolloverCredits" type="number" min="0" value="${project.profiles?.rollover_credits || 0}" /></label>
            <label>Top-up credits<input id="topupCredits" type="number" min="0" value="${project.profiles?.topup_credits || 0}" /></label>
          </div>
          <div class="modal-actions"><button class="app-button secondary" id="saveCustomerAccount" type="button">Update customer account</button></div>
        </section>
      </div>
    </div>`;
  modal.hidden = false;
  document.querySelector("#closeModal").addEventListener("click", () => { modal.hidden = true; });

  document.querySelector("#saveAdminStatus").addEventListener("click", async () => {
    const status = document.querySelector("#adminStatus").value;
    const { error } = await supabase.from("projects").update({ status }).eq("id", project.id);
    if (error) return toast(error.message, "error");
    modal.hidden = true;
    toast("Project status updated.", "success");
    await load();
  });

  document.querySelector("#saveCustomerAccount").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const updates = {
      plan: document.querySelector("#customerPlan").value,
      monthly_credits: Math.max(0, Number(document.querySelector("#monthlyCredits").value) || 0),
      rollover_credits: Math.max(0, Number(document.querySelector("#rolloverCredits").value) || 0),
      topup_credits: Math.max(0, Number(document.querySelector("#topupCredits").value) || 0),
    };
    button.disabled = true;
    const { error } = await supabase.from("profiles").update(updates).eq("id", project.user_id);
    button.disabled = false;
    if (error) return toast(error.message, "error");
    await supabase.from("credit_transactions").insert({
      user_id: project.user_id,
      project_id: project.id,
      type: "adjustment",
      credit_delta: 0,
      description: `Account updated to ${updates.plan} plan by production`,
    });
    modal.hidden = true;
    toast("Customer plan and credits updated.", "success");
    await load();
  });

  document.querySelector("#uploadConcepts").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const files = [...document.querySelector("#conceptFiles").files];
    if (!files.length) return toast("Choose at least one concept image.", "error");
    button.disabled = true;
    button.textContent = "Uploading...";
    for (const [index, file] of files.entries()) {
      const path = `${project.user_id}/${project.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
      const { error: uploadError } = await supabase.storage.from("concepts").upload(path, file);
      if (uploadError) {
        button.disabled = false;
        button.textContent = "Upload and send to review";
        return toast(uploadError.message, "error");
      }
      const { error: conceptError } = await supabase.from("concepts").insert({
        project_id: project.id,
        user_id: project.user_id,
        label: `Concept ${String.fromCharCode(65 + (project.concepts?.length || 0) + index)}`,
        storage_path: path,
      });
      if (conceptError) return toast(conceptError.message, "error");
    }
    const { error: deliveryError } = await supabase.rpc("deliver_project", { project_uuid: project.id });
    if (deliveryError) {
      button.disabled = false;
      button.textContent = "Upload and send to review";
      return toast(deliveryError.message, "error");
    }
    modal.hidden = true;
    toast("Concepts delivered for customer review.", "success");
    await load();
  });
}

document.querySelectorAll("[data-admin-filter]").forEach((button) => button.addEventListener("click", () => {
  document.querySelectorAll("[data-admin-filter]").forEach((item) => item.classList.remove("active"));
  button.classList.add("active");
  filter = button.dataset.adminFilter;
  render();
}));
document.querySelector("#adminSearch").addEventListener("input", render);
document.querySelector("#refreshAdmin").addEventListener("click", load);
document.querySelector("#adminSignOut").addEventListener("click", async () => {
  await supabase.auth.signOut();
  location.replace("login.html");
});

await load();
