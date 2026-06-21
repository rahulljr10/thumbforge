import { backendConfigured, supabase } from "./backend.js";

const form = document.querySelector("#contactForm");
const notice = document.querySelector("#contactNotice");
const button = document.querySelector("#contactSubmit");
const query = new URLSearchParams(location.search);
if (query.get("request") === "topup") document.querySelector("#requestType").value = "support";

function show(message, type) {
  notice.hidden = false;
  notice.className = `form-notice ${type}`;
  notice.textContent = message;
}

if (!backendConfigured) {
  show("The contact service is being connected. Please return shortly.", "error");
  button.disabled = true;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  button.disabled = true;
  button.textContent = "Sending...";
  const values = Object.fromEntries(new FormData(form));
  values.videos_per_month = values.videos_per_month ? Number(values.videos_per_month) : null;
  values.channel_count = values.channel_count ? Number(values.channel_count) : null;
  const { error } = await supabase.from("contact_requests").insert(values);
  button.disabled = false;
  button.textContent = "Send request";
  if (error) return show(error.message, "error");
  form.reset();
  show("Request received. The MakeViralThumb team will respond within one business day.", "success");
});

