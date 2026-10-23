import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method-not-allowed" }, 405);

  const url = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/+$/, "");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const authorization = req.headers.get("authorization") ?? "";
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!url || !anonKey || !serviceKey || !token) {
    return json({ error: "unauthorized", message: "Sign in again before deleting your account." }, 401);
  }

  try {
    const who = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
    });
    if (!who.ok) return json({ error: "unauthorized", message: "Your session expired. Sign in again." }, 401);
    const user = await who.json();
    if (typeof user?.id !== "string") return json({ error: "unauthorized" }, 401);

    const deleted = await fetch(`${url}/auth/v1/admin/users/${encodeURIComponent(user.id)}`, {
      method: "DELETE",
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    });
    if (!deleted.ok) {
      console.error("Supabase account deletion returned HTTP", deleted.status);
      return json({ error: "delete-failed", message: "The account could not be deleted. No success was reported." }, 502);
    }
    return json({ deleted: true });
  } catch (error) {
    console.error("Account deletion request failed:", error instanceof Error ? error.name : "unknown");
    return json({ error: "delete-failed", message: "The account could not be deleted. Try again later." }, 502);
  }
});
