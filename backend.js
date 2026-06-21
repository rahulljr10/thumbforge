import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

export const backendConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
export const supabase = backendConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export function requireBackend(element) {
  if (backendConfigured) return true;
  if (element) {
    element.innerHTML = `
      <div class="empty-state">
        <h3>Backend connection required</h3>
        <p>Add the Supabase project URL and public anonymous key in <code>config.js</code>.</p>
      </div>`;
  }
  return false;
}

export async function currentSession() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function requireSession() {
  const session = await currentSession();
  if (!session) {
    window.location.replace(`login.html?next=${encodeURIComponent(location.pathname.split("/").pop() || "dashboard.html")}`);
    return null;
  }
  return session;
}

export async function signedConceptUrl(path) {
  if (!path) return "";
  const { data, error } = await supabase.storage.from("concepts").createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}

