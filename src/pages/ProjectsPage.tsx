import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus, Trash2, FolderOpen, Loader2, LogOut, Calendar } from "lucide-react";
import { listProjects, saveProject, deleteProject, CloudProject } from "@/lib/cloudStorage";
import { signOut } from "@/lib/auth";

interface Props {
  onSelectProject: (slug: string, name: string) => void;
  onSignOut: () => void;
  userEmail: string;
}

const ProjectsPage = ({ onSelectProject, onSignOut, userEmail }: Props) => {
  const [projects, setProjects] = useState<CloudProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
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
      setCreating(false); }
  };

  const handleDelete = async (slug: string) => {
    if (!window.confirm(`Supprimer le projet "${slug}" ? Cette action est irréversible.`)) return;
    try {
      await deleteProject(slug);
      toast.success("Projet supprimé");
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    onSignOut();
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
            projects.map((p) => (
              <Card key={p.slug} className="hover:border-accent/50 transition-colors">
                <CardContent className="py-4 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-foreground">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.slug} · mis à jour {new Date(p.updated_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => onSelectProject(p.slug, p.name)} className="gap-2 gradient-accent text-accent-foreground">
                      <FolderOpen className="h-4 w-4" /> Ouvrir
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => handleDelete(p.slug)} className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectsPage;
