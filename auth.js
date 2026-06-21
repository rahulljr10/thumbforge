import { backendConfigured, currentSession, supabase } from "./backend.js";

const notice = document.querySelector("#authNotice");
const signInForm = document.querySelector("#signInForm");
const signUpForm = document.querySelector("#signUpForm");
const next = new URLSearchParams(location.search).get("next") || "dashboard.html";
const signupRequested = new URLSearchParams(location.search).get("mode") === "signup";
const dashboardUrl = new URL("dashboard.html", location.href).href;
const resetUrl = new URL("login.html?reset=1", location.href).href;

function showNotice(message, type = "info") {
  notice.hidden = false;
  notice.className = `auth-notice ${type}`;
  notice.textContent = message;
}

function setLoading(form, loading) {
  const button = form.querySelector('button[type="submit"]');
  button.disabled = loading;
  button.textContent = loading ? "Please wait..." : button.dataset.label;
}

document.querySelectorAll(".auth-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    const signup = tab.dataset.authView === "signup";
    document.querySelectorAll(".auth-tab").forEach((item) => item.classList.toggle("active", item === tab));
    signInForm.hidden = signup;
    signUpForm.hidden = !signup;
    notice.hidden = true;
  });
});

if (signupRequested) document.querySelector('[data-auth-view="signup"]').click();

[signInForm, signUpForm].forEach((form) => {
  const button = form.querySelector('button[type="submit"]');
  button.dataset.label = button.textContent;
});

if (!backendConfigured) {
  showNotice("Account creation is waiting for the production backend connection.", "error");
  signInForm.querySelector('button[type="submit"]').disabled = true;
  signUpForm.querySelector('button[type="submit"]').disabled = true;
} else if (await currentSession()) {
  location.replace(next);
}

signInForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setLoading(signInForm, true);
  const values = new FormData(signInForm);
  const { error } = await supabase.auth.signInWithPassword({
    email: values.get("email"),
    password: values.get("password"),
  });
  setLoading(signInForm, false);
  if (error) return showNotice(error.message, "error");
  location.replace(next);
});

signUpForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setLoading(signUpForm, true);
  const values = new FormData(signUpForm);
  const { data, error } = await supabase.auth.signUp({
    email: values.get("email"),
    password: values.get("password"),
    options: {
      emailRedirectTo: dashboardUrl,
      data: {
        full_name: values.get("full_name"),
        channel_name: values.get("channel_name"),
        country_code: values.get("country_code"),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    },
  });
  setLoading(signUpForm, false);
  if (error) return showNotice(error.message, "error");
  if (data.session) location.replace(next);
  else showNotice("Check your email to verify the account, then sign in.", "success");
});

document.querySelector("#forgotPassword").addEventListener("click", async () => {
  const email = signInForm.elements.email.value.trim();
  if (!email) return showNotice("Enter your email address first.", "error");
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: resetUrl,
  });
  if (error) return showNotice(error.message, "error");
  showNotice("Password reset email sent.", "success");
});
