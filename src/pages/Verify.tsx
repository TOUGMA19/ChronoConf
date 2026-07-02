import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { CheckCircle2, ShieldCheck, Loader2, Search, Save, RotateCcw, Lock } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getTokenFromUrl } from "@/lib/verifyLink";

interface VerifyConfig {
  token: string;
  conference_id: string;
  note: string;
  contact: string;
  deadline: string | null;
  editable_cols: string[];
}

interface Speaker {
  id: string;
  code: string;
  conference_id?: string;
  nom: string;
  prenom: string;
  email: string;
  institution: string;
  titre: string;
  resume: string;
  verified_at: string | null;
  [key: string]: unknown;
}

const FIELD_LABELS: Record<string, string> = {
  nom: "Nom",
  prenom: "Prénom",
  email: "E-mail",
  institution: "Institution / Affiliation",
  titre: "Titre de la communication",
  resume: "Résumé",
};

const Verify = () => {
  const token = useMemo(() => getTokenFromUrl(), []);
  const [config, setConfig] = useState<VerifyConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [id, setId] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [speaker, setSpeaker] = useState<Speaker | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Vérification des informations · ChronoConf";
    if (!token) { setConfigLoading(false); return; }
    supabase
      .from("verify_config")
      .select("*")
      .eq("token", token)
      .maybeSingle()
      .then(({ data }) => {
        setConfig(data as VerifyConfig | null);
        setConfigLoading(false);
      });
  }, [token]);

  const isDeadlinePassed = config?.deadline ? new Date(config.deadline) < new Date() : false;

  const lookup = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const code = id.trim().toUpperCase();
    if (!code) { toast.error("Saisissez votre code participant"); return; }
    if (!config) return;
    setLoading(true); setSpeaker(null); setSavedAt(null);
    try {
      const { data, error } = await supabase
        .from("speakers")
        .select("*")
        .eq("conference_id", config.conference_id)
        .ilike("code", code)
        .maybeSingle();
      if (error) throw error;
      if (!data) { toast.error("Code introuvable. Vérifiez votre code ou contactez l'organisateur."); return; }
      setSpeaker(data as Speaker);
      const v: Record<string, string> = {};
      Object.keys(FIELD_LABELS).forEach((k) => { v[k] = (data as Record<string,unknown>)[k] as string ?? ""; });
      setValues(v);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const isEditable = (field: string) => {
    if (isDeadlinePassed) return false;
    if (!config?.editable_cols?.length) return true;
    return config.editable_cols.includes(field);
  };

  const dirtyKeys = useMemo(() => {
    if (!speaker) return [];
    return Object.keys(FIELD_LABELS).filter(
      (k) => isEditable(k) && values[k] !== ((speaker as Record<string,unknown>)[k] as string ?? "")
    );
  }, [values, speaker, config]);

  const submit = async () => {
    if (!speaker || !dirtyKeys.length) { toast.info("Aucune modification"); return; }
    setSaving(true);
    try {
      const patch: Record<string, string> = {};
      dirtyKeys.forEach((k) => { patch[k] = values[k]; });
      const { error } = await supabase
        .from("speakers")
        .update({ ...patch, verified_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", speaker.id);
      if (error) throw error;

      // Log edits
      const editRows = dirtyKeys.map((field) => ({
        speaker_code: speaker.code,
        conference_id: speaker.conference_id ?? config?.conference_id ?? "",
        field,
        old_value: (speaker as Record<string,unknown>)[field] as string ?? "",
        new_value: values[field],
      }));
      await supabase.from("speaker_edits").insert(editRows);

      setSpeaker((prev) => prev ? { ...prev, ...patch } : prev);
      setSavedAt(new Date().toLocaleString("fr-FR"));
      toast.success("Modifications enregistrées !");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    if (!speaker) return;
    const v: Record<string, string> = {};
    Object.keys(FIELD_LABELS).forEach((k) => { v[k] = (speaker as Record<string,unknown>)[k] as string ?? ""; });
    setValues(v);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/60 backdrop-blur sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-display font-bold">
            <ShieldCheck className="h-5 w-5 text-accent" />
            <span>Vérification des informations</span>
          </Link>
          {config?.contact && (
            <a href={`mailto:${config.contact}`} className="text-xs text-muted-foreground hover:text-foreground">
              Contact : {config.contact}
            </a>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl space-y-6">
        {configLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!configLoading && !config && (
          <Card className="border-destructive/30">
            <CardContent className="pt-6 text-center text-muted-foreground">
              ⚠️ Lien invalide ou expiré. Contactez l'organisateur de la conférence.
            </CardContent>
          </Card>
        )}

        {!configLoading && config && (
          <>
            {config.note && (
              <Card className="border-accent/30 bg-accent/5">
                <CardContent className="pt-4 text-sm whitespace-pre-wrap">{config.note}</CardContent>
              </Card>
            )}

            {isDeadlinePassed && (
              <Card className="border-orange-500/30 bg-orange-500/5">
                <CardContent className="pt-4 text-sm flex items-center gap-2 text-orange-600">
                  <Lock className="h-4 w-4" />
                  La période de modification est terminée (échéance : {new Date(config.deadline!).toLocaleDateString("fr-FR")}).
                  Les informations sont visibles en lecture seule.
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="font-display text-xl">Identifiez-vous</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={lookup} className="flex flex-col sm:flex-row gap-2 items-end">
                  <div className="flex-1 space-y-1.5">
                    <Label htmlFor="code">Votre code participant</Label>
                    <Input
                      id="code"
                      value={id}
                      onChange={(e) => setId(e.target.value)}
                      placeholder="Ex : P-042"
                      autoFocus
                    />
                  </div>
                  <Button type="submit" disabled={loading} className="gradient-accent text-accent-foreground">
                    {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                    Rechercher
                  </Button>
                </form>
              </CardContent>
            </Card>

            {speaker && (
              <Card>
                <CardHeader>
                  <CardTitle className="font-display text-xl flex items-center gap-2">
                    Vos informations
                    {savedAt && (
                      <span className="text-xs font-normal text-emerald-500 inline-flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Enregistré le {savedAt}
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {Object.entries(FIELD_LABELS).map(([field, label]) => {
                    const editable = isEditable(field);
                    const isLong = field === "resume" || field === "titre";
                    return (
                      <div key={field} className="space-y-1.5">
                        <Label>
                          {label}
                          {!editable && <span className="ml-2 text-xs text-muted-foreground">(non modifiable)</span>}
                        </Label>
                        {isLong ? (
                          <Textarea
                            rows={field === "resume" ? 5 : 3}
                            value={values[field] ?? ""}
                            readOnly={!editable}
                            onChange={(e) => setValues((p) => ({ ...p, [field]: e.target.value }))}
                            className={!editable ? "opacity-70" : ""}
                          />
                        ) : (
                          <Input
                            value={values[field] ?? ""}
                            readOnly={!editable}
                            onChange={(e) => setValues((p) => ({ ...p, [field]: e.target.value }))}
                            className={!editable ? "opacity-70" : ""}
                          />
                        )}
                      </div>
                    );
                  })}

                  {!isDeadlinePassed && (
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                      <Button
                        onClick={submit}
                        disabled={saving || !dirtyKeys.length}
                        className="gradient-accent text-accent-foreground"
                      >
                        {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                        Enregistrer {dirtyKeys.length ? `(${dirtyKeys.length})` : ""}
                      </Button>
                      <Button variant="outline" onClick={reset} disabled={!dirtyKeys.length}>
                        <RotateCcw className="h-4 w-4 mr-2" /> Annuler
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default Verify;
