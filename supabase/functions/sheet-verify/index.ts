// ChronoConf — edge function speaker-verify
// Actions: list | get | update | import
// Lit/écrit dans Supabase (table speakers) — plus de dépendance Google/Lovable.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "");
    const conferenceId = String(body.conference_id ?? "");

    if (!conferenceId && action !== "ping") {
      return json({ error: "conference_id requis" }, 400);
    }

    // ── LIST ──────────────────────────────────────────────
    if (action === "list") {
      const { data, error } = await supabase
        .from("speakers")
        .select("*")
        .eq("conference_id", conferenceId)
        .order("code");
      if (error) throw error;
      return json({ rows: data });
    }

    // ── GET ───────────────────────────────────────────────
    if (action === "get") {
      const code = String(body.code ?? "").trim().toUpperCase();
      if (!code) return json({ error: "code requis" }, 400);

      // Verify token matches conference
      const { data: cfg } = await supabase
        .from("verify_config")
        .select("token, conference_id, editable_cols, deadline")
        .eq("token", String(body.token ?? ""))
        .maybeSingle();
      if (!cfg || cfg.conference_id !== conferenceId) {
        return json({ error: "Token invalide" }, 403);
      }

      const { data, error } = await supabase
        .from("speakers")
        .select("*")
        .eq("conference_id", conferenceId)
        .ilike("code", code)
        .maybeSingle();
      if (error) throw error;
      if (!data) return json({ error: "Code introuvable" }, 404);
      return json({ speaker: data, config: cfg });
    }

    // ── UPDATE ────────────────────────────────────────────
    if (action === "update") {
      const code = String(body.code ?? "").trim().toUpperCase();
      const patch = (body.patch ?? {}) as Record<string, string>;
      const token = String(body.token ?? "");

      // Verify token
      const { data: cfg } = await supabase
        .from("verify_config")
        .select("conference_id, editable_cols, deadline")
        .eq("token", token)
        .maybeSingle();
      if (!cfg || cfg.conference_id !== conferenceId) {
        return json({ error: "Token invalide" }, 403);
      }
      if (cfg.deadline && new Date(cfg.deadline) < new Date()) {
        return json({ error: "La période de modification est terminée" }, 403);
      }

      const { data: old, error: fetchErr } = await supabase
        .from("speakers")
        .select("*")
        .eq("conference_id", conferenceId)
        .ilike("code", code)
        .maybeSingle();
      if (fetchErr) throw fetchErr;
      if (!old) return json({ error: "Code introuvable" }, 404);

      const forbidden = new Set(["id", "code", "conference_id", "created_at", "updated_at", "verified_at"]);
      const allowed: Set<string> = cfg.editable_cols?.length
        ? new Set(cfg.editable_cols as string[])
        : new Set(["nom", "prenom", "email", "institution", "titre", "resume"]);

      const safe: Record<string, string> = {};
      for (const [k, v] of Object.entries(patch)) {
        if (!forbidden.has(k) && allowed.has(k)) safe[k] = String(v ?? "");
      }

      if (!Object.keys(safe).length) return json({ error: "Aucun champ modifiable" }, 400);

      const { error: updateErr } = await supabase
        .from("speakers")
        .update({ ...safe, verified_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", old.id);
      if (updateErr) throw updateErr;

      // Historique
      const editRows = Object.entries(safe).map(([field, new_value]) => ({
        speaker_code: old.code,
        conference_id: conferenceId,
        field,
        old_value: String((old as Record<string, unknown>)[field] ?? ""),
        new_value,
      }));
      if (editRows.length) await supabase.from("speaker_edits").insert(editRows);

      return json({ ok: true, changed: Object.keys(safe).length });
    }

    // ── IMPORT ────────────────────────────────────────────
    if (action === "import") {
      const rows = (body.rows as Record<string, string>[]);
      if (!Array.isArray(rows) || !rows.length) return json({ error: "rows vide" }, 400);
      const rowsWithConf = rows.map((r) => ({ ...r, conference_id: conferenceId }));
      const { error } = await supabase
        .from("speakers")
        .upsert(rowsWithConf, { onConflict: "conference_id,code" });
      if (error) throw error;
      return json({ ok: true, count: rows.length });
    }

    // ── PING ─────────────────────────────────────────────
    if (action === "ping") return json({ ok: true });

    return json({ error: `action inconnue: ${action}` }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
