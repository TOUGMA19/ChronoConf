import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus, Trash2, FolderOpen, Loader2, LogOut, Calendar, RefreshCw, Clock, AlertTriangle } from "lucide-react";
import { listProjects, saveProject, deleteProject, renewProject, daysUntilExpiry, CloudProject } from "@/lib/cloudStorage";
import { signOut } from "@/lib/auth";
import { cn } from "@/lib/utils";

interface Props {
  onSelectProject: (slug: string, name: string) => void;
  onSignOut: () => void;
  userEmail: string;
}

const ProjectsPage = ({ onSelectProject, onSignOut, userEmail }: Props) => {
  const [projects, setProjects] = useState<CloudProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [renewingSlug, setRenewingSlug] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      setProjects(await listProjects());
    } catch (e) {
      toast.error("Impossible de charger vos projets : " + (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    const slug = newSlug.trim().replace(/\s+/g, "-").toLowerCase();
    const name = newName.trim();
    if (!slug || !name) { toast.error("Remplissez le nom et l'identifiant"); return; }
    if (!/^[a-z0-9-]+$/.test(slug)) { toast.error("L'identifiant ne peut contenir que des lettres, chiffres et tirets"); return; }
    setCreating(true);
    try {
      await saveProject(slug, name, {});
      toast.success("Projet créé !");
      setNewName(""); setNewSlug("");
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (slug: string, name: string) => {
    if (!window.confirm(`Supprimer le projet "${name}" ?\n\nToutes les données seront supprimées définitivement (articles, programme, intervenants, historique). Cette action est irréversible.`)) return;
    try {
      await deleteProject(slug);
      toast.success("Projet supprimé");
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleRenew = async (slug: string) => {
    setRenewingSlug(slug);
    try {
      await renewProject(slug);
      toast.success("Projet renouvelé pour 21 jours supplémentaires");
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRenewingSlug(null);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    onSignOut();
  };

  // Couleur et texte selon les jours restants
  const expiryInfo = (p: CloudProject) => {
    const days = daysUntilExpiry(p.expires_at);
    if (days <= 0)  return { label: "Expiré",          color: "text-destructive",   bg: "bg-destructive/10 border-destructive/30",  icon: AlertTriangle };
    if (days <= 3)  return { label: `${days}j restant`, color: "text-destructive",   bg: "bg-destructive/5 border-destructive/20",   icon: AlertTriangle };
    if (days <= 7)  return { label: `${days}j restant`, color: "text-warning",       bg: "bg-warning/5 border-warning/20",           icon: Clock };
    return           { label: `${days}j restant`,       color: "text-muted-foreground", bg: "",                                      icon: Clock };
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur-md shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-display font-bold">
              <span className="text-accent">Chrono</span>Conf
            </h1>
            <p className="text-xs text-muted-foreground">{userEmail}</p>
          </div>
          <Button variant="outline" onClick={handleSignOut} className="gap-2">
            <LogOut className="h-4 w-4" /> Déconnexion
          </Button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Info expiration */}
        <Card className="border-accent/20 bg-accent/5">
          <CardContent className="py-3 text-xs text-muted-foreground flex items-start gap-2">
            <Clock className="h-4 w-4 text-accent shrink-0 mt-0.5" />
            <span>
              Chaque projet est conservé <strong>21 jours</strong> après sa création ou son dernier renouvellement.
              Utilisez le bouton <strong>Renouveler</strong> pour prolonger un projet avant son expiration.
              Les projets expirés et toutes leurs données sont supprimés automatiquement.
            </span>
          </CardContent>
        </Card>

        {/* Create new project */}
        <Card>
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2">
              <Plus className="h-5 w-5 text-accent" /> Nouveau projet
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Nom du projet</Label>
                <Input
                  value={newName}
                  onChange={(e) => {
                    setNewName(e.target.value);
                    if (!newSlug) setNewSlug(e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""));
                  }}
                  placeholder="JS-ULBO 2026"
                />
              </div>
              <div className="space-y-1">
                <Label>Identifiant unique (URL)</Label>
                <Input
                  value={newSlug}
                  onChange={(e) => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  placeholder="js-ulbo-2026"
                />
              </div>
            </div>
            <Button onClick={handleCreate} disabled={creating} className="gradient-accent text-accent-foreground gap-2">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Créer le projet
            </Button>
          </CardContent>
        </Card>

        {/* Project list */}
        <div className="space-y-3">
          <h2 className="font-display font-semibold text-lg">Mes projets</h2>
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
              <Loader2 className="h-5 w-5 animate-spin" /> Chargement…
            </div>
          ) : projects.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Calendar className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p>Aucun projet. Créez-en un ci-dessus.</p>
              </CardContent>
            </Card>
          ) : (
            projects.map((p) => {
              const expiry = expiryInfo(p);
              const ExpiryIcon = expiry.icon;
              const days = daysUntilExpiry(p.expires_at);
              const isExpired = days <= 0;

              return (
                <Card key={p.slug} className={cn("transition-colors", expiry.bg || "hover:border-accent/50", isExpired && "opacity-60")}>
                  <CardContent className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-foreground">{p.name}</p>
                        {/* Badge expiration */}
                        <span className={cn("inline-flex items-center gap-1 text-xs font-medium", expiry.color)}>
                          <ExpiryIcon className="h-3 w-3" />
                          {expiry.label}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {p.slug} · mis à jour {new Date(p.updated_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
                        {" · "}expire le {new Date(p.expires_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
                      </p>
                    </div>

                    <div className="flex gap-2 flex-wrap">
                      {/* Renouveler */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRenew(p.slug)}
                        disabled={renewingSlug === p.slug}
                        className="gap-1.5"
                        title="Renouveler pour 21 jours"
                      >
                        {renewingSlug === p.slug
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <RefreshCw className="h-3.5 w-3.5" />
                        }
                        Renouveler
                      </Button>

                      {/* Ouvrir */}
                      {!isExpired && (
                        <Button
                          onClick={() => onSelectProject(p.slug, p.name)}
                          className="gap-2 gradient-accent text-accent-foreground"
                          size="sm"
                        >
                          <FolderOpen className="h-4 w-4" /> Ouvrir
                        </Button>
                      )}

                      {/* Supprimer */}
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleDelete(p.slug, p.name)}
                        className="text-destructive hover:text-destructive h-8 w-8"
                        title="Supprimer définitivement"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectsPage;
