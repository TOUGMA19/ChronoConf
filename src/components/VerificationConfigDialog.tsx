import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Copy, ExternalLink, RefreshCw, Upload, Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { buildShareLink, cacheSettings } from "@/lib/verifyLink";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conferenceId: string;
}

interface SpeakerRow {
  code: string;
  nom: string;
  prenom: string;
  email: string;
  institution: string;
  titre: string;
  resume: string;
  verified_at: string | null;
}

const EDITABLE_FIELDS = ["nom", "prenom", "email", "institution", "titre", "resume"];

const VerificationConfigDialog = ({ open, onOpenChange, conferenceId }: Props) => {
  const [token, setToken] = useState("");
  const [note, setNote] = useState("");
  const [contact, setContact] = useState("");
  const [deadline, setDeadline] = useState("");
  const [editableCols, setEditableCols] = useState<string[]>(EDITABLE_FIELDS);
  const [loading, setLoading] = useState(false);
  const [speakers, setSpeakers] = useState<SpeakerRow[]>([]);
  const [filter, setFilter] = useState("");
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (!open || !conferenceId) return;
    loadConfig();
  }, [open, conferenceId]);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("verify_config")
        .select("*")
        .eq("conference_id", conferenceId)
        .maybeSingle();
      if (data) {
        setToken(data.token);
        setNote(data.note ?? "");
        setContact(data.contact ?? "");
        setDeadline(data.deadline ? data.deadline.slice(0, 10) : "");
        setEditableCols((data.editable_cols as string[]) ?? EDITABLE_FIELDS);
      } else {
        // Create initial config
        const { data: created } = await supabase
          .from("verify_config")
          .insert({ conference_id: conferenceId, editable_cols: EDITABLE_FIELDS })
          .select()
          .single();
        if (created) setToken(created.token);
      }
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("verify_config")
        .update({
          note,
          contact,
          deadline: deadline || null,
          editable_cols: editableCols,
          updated_at: new Date().toISOString(),
        })
        .eq("conference_id", conferenceId);
      if (error) throw error;
      cacheSettings({ token, conferenceId, note, contact, deadline, editableCols });
      toast.success("Configuration sauvegardée");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const loadSpeakers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("speakers")
        .select("code,nom,prenom,email,institution,titre,resume,verified_at")
        .eq("conference_id", conferenceId)
        .order("code");
      if (error) throw error;
      setSpeakers((data ?? []) as SpeakerRow[]);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleImportCsv = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split(/\r?\n/).filter(Boolean);
      const headers = lines[0].split(/[;,\t]/).map((h) => h.trim().toLowerCase());
      const rows = lines.slice(1).map((line) => {
        const vals = line.split(/[;,\t]/);
        const obj: Record<string, string> = { conference_id: conferenceId };
        headers.forEach((h, i) => { obj[h] = (vals[i] ?? "").trim().replace(/^"|"$/g, ""); });
        return obj;
      }).filter((r) => r.code);
      if (!rows.length) { toast.error("Aucune ligne valide trouvée"); return; }
      setImporting(true);
      try {
        const { error } = await supabase.from("speakers").upsert(rows, { onConflict: "conference_id,code" });
        if (error) throw error;
        toast.success(`${rows.length} intervenant(s) importé(s)`);
        await loadSpeakers();
      } catch (err) {
        toast.error((err as Error).message);
      } finally {
        setImporting(false);
      }
    };
    reader.readAsText(file, "UTF-8");
    e.target.value = "";
  };

  const shareLink = token ? buildShareLink(token) : "";
  const filtered = filter.trim()
    ? speakers.filter((s) =>
        [s.code, s.nom, s.prenom, s.email].some((v) => v?.toLowerCase().includes(filter.toLowerCase()))
      )
    : speakers;
  const verifiedCount = speakers.filter((s) => s.verified_at).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-display">Vérification des informations intervenants</DialogTitle>
          <DialogDescription>
            Importez vos intervenants, partagez le lien — chacun vérifie ses informations depuis n'importe quel appareil.
            Les données sont stockées dans Supabase, sans dépendance Google Sheets.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="config" className="flex-1 flex flex-col min-h-0">
            <TabsList>
              <TabsTrigger value="config">Configuration</TabsTrigger>
              <TabsTrigger value="link">Lien à partager</TabsTrigger>
              <TabsTrigger value="speakers" onClick={loadSpeakers}>
                Intervenants ({speakers.length})
              </TabsTrigger>
            </TabsList>

            {/* ── CONFIG ── */}
            <TabsContent value="config" className="flex-1 overflow-y-auto space-y-5 pt-2">
              <div className="space-y-2">
                <Label>Message affiché à l'intervenant (optionnel)</Label>
                <Textarea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Merci de vérifier vos informations avant le 15 juillet…"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>E-mail de contact (optionnel)</Label>
                  <Input
                    type="email"
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    placeholder="organisateur@conf.org"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Date limite de modification (optionnel)</Label>
                  <Input
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Champs modifiables par l'intervenant</Label>
                <div className="grid grid-cols-2 gap-2">
                  {EDITABLE_FIELDS.map((f) => (
                    <div key={f} className="flex items-center gap-2">
                      <Checkbox
                        id={`col-${f}`}
                        checked={editableCols.includes(f)}
                        onCheckedChange={(checked) => {
                          setEditableCols((prev) =>
                            checked ? [...prev, f] : prev.filter((c) => c !== f)
                          );
                        }}
                      />
                      <Label htmlFor={`col-${f}`} className="text-sm cursor-pointer capitalize">{f}</Label>
                    </div>
                  ))}
                </div>
              </div>

              <Button onClick={saveConfig} disabled={saving} className="gradient-accent text-accent-foreground gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Sauvegarder la configuration
              </Button>
            </TabsContent>

            {/* ── LINK ── */}
            <TabsContent value="link" className="flex-1 overflow-y-auto space-y-4 pt-2">
              {!token ? (
                <div className="rounded-md border border-yellow-500/30 bg-yellow-500/5 p-3 text-xs">
                  ⚠️ Aucun token trouvé. Retournez dans Configuration et sauvegardez.
                </div>
              ) : (
                <div className="rounded-md border border-border bg-secondary/30 p-4 space-y-3">
                  <div className="text-xs uppercase text-muted-foreground tracking-wide">Lien unique à partager</div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input readOnly value={shareLink} className="font-mono text-sm" />
                    <div className="flex gap-2">
                      <Button onClick={async () => { await navigator.clipboard.writeText(shareLink); toast.success("Lien copié"); }} variant="outline">
                        <Copy className="h-4 w-4 mr-2" /> Copier
                      </Button>
                      <Button asChild className="gradient-accent text-accent-foreground">
                        <a href={shareLink} target="_blank" rel="noreferrer">
                          <ExternalLink className="h-4 w-4 mr-2" /> Ouvrir
                        </a>
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Partagez ce lien avec tous vos intervenants. Chacun entrera son code pour voir et corriger ses informations.
                    Les modifications sont enregistrées directement dans Supabase.
                  </p>
                </div>
              )}
            </TabsContent>

            {/* ── SPEAKERS ── */}
            <TabsContent value="speakers" className="flex-1 overflow-y-auto space-y-3 pt-2">
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  placeholder="Rechercher par code, nom, email…"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="flex-1 min-w-[200px]"
                />
                <Button size="sm" variant="outline" onClick={loadSpeakers} disabled={loading}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Actualiser
                </Button>
                <Button size="sm" variant="outline" asChild disabled={importing}>
                  <label className="cursor-pointer gap-2">
                    {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                    Importer CSV
                    <input type="file" accept=".csv,.txt" className="hidden" onChange={handleImportCsv} />
                  </label>
                </Button>
              </div>

              {speakers.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  {verifiedCount} / {speakers.length} intervenant(s) ont vérifié leurs informations
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Format CSV attendu (séparateur virgule ou point-virgule) :<br />
                <code>code,nom,prenom,email,institution,titre,resume</code>
              </p>

              {!speakers.length ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  Aucun intervenant. Importez un CSV ci-dessus.
                </p>
              ) : (
                <div className="rounded-md border border-border overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-secondary/50">
                      <tr>
                        {["code","nom","prenom","email","institution","titre","statut"].map((h) => (
                          <th key={h} className="text-left px-2 py-1.5 font-medium whitespace-nowrap capitalize">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.slice(0, 200).map((s) => (
                        <tr key={s.code} className="border-t border-border">
                          <td className="px-2 py-1.5 font-mono">{s.code}</td>
                          <td className="px-2 py-1.5">{s.nom}</td>
                          <td className="px-2 py-1.5">{s.prenom}</td>
                          <td className="px-2 py-1.5 truncate max-w-[160px]">{s.email}</td>
                          <td className="px-2 py-1.5 truncate max-w-[160px]">{s.institution}</td>
                          <td className="px-2 py-1.5 truncate max-w-[200px]">{s.titre}</td>
                          <td className="px-2 py-1.5">
                            {s.verified_at
                              ? <span className="text-emerald-500 font-medium">✓ {new Date(s.verified_at).toLocaleDateString("fr-FR")}</span>
                              : <span className="text-muted-foreground">En attente</span>
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filtered.length > 200 && (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground border-t border-border">
                      …{filtered.length - 200} ligne(s) supplémentaire(s) non affichée(s)
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default VerificationConfigDialog;
