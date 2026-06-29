import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Upload, X, Check, Briefcase } from "lucide-react";
import {
  getOrganizers,
  addOrganizer,
  addOrganizers,
  removeOrganizer,
  clearOrganizers,
  Organizer,
} from "@/lib/conference";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
}

export default function OrganizersDialog({ open, onOpenChange, onChanged }: Props) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [tick, setTick] = useState(0);
  const list = getOrganizers();

  const refresh = () => { setTick((k) => k + 1); onChanged?.(); };

  const handleAdd = () => {
    if (!name.trim()) return;
    const ok = addOrganizer(name, role);
    if (!ok) { toast.error("Cet organisateur existe déjà"); return; }
    setName(""); setRole("");
    refresh();
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Fichier trop volumineux (max 5 Mo)"); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (!text) return;
      const lines = text.split(/[\r\n]+/).map((l) => l.trim()).filter(Boolean);
      if (lines.length > 2000) { toast.error("Trop de lignes (max 2000)"); return; }
      const header = lines[0]?.toLowerCase() || "";
      const start = /^(nom|name|organisateur|organizer)/i.test(header) ? 1 : 0;
      const entries: Organizer[] = lines.slice(start).map((l) => {
        const parts = l.split(/[;,\t]/).map((p) => p.trim().replace(/^["']|["']$/g, ""));
        return { name: parts[0] || "", role: parts[1] || "" };
      }).filter((e) => e.name);
      const count = addOrganizers(entries);
      refresh();
      toast.success(`${count} organisateur${count > 1 ? "s" : ""} importé${count > 1 ? "s" : ""}`);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleRemove = (n: string) => { removeOrganizer(n); refresh(); };
  const handleClear = () => { clearOrganizers(); refresh(); toast.success("Liste vidée"); };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-primary" />
            Gestion des organisateurs
          </DialogTitle>
          <DialogDescription>
            Ajoutez les membres du comité d'organisation avec leurs rôles. Ils apparaîtront dans les badges et attestations.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Add single */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Ajouter un organisateur</Label>
            <div className="flex flex-wrap gap-2">
              <Input
                placeholder="Nom complet"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
                className="flex-1 min-w-[180px]"
              />
              <Input
                placeholder="Rôle (ex. Président du comité)"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
                className="flex-1 min-w-[180px]"
              />
              <Button onClick={handleAdd} size="sm" className="shrink-0">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Import */}
          <Button variant="outline" className="gap-2 w-full" asChild>
            <label>
              <Upload className="h-4 w-4" />
              Importer depuis un fichier (CSV/TXT — colonnes: nom, rôle)
              <input type="file" accept=".csv,.txt" className="hidden" onChange={handleImport} />
            </label>
          </Button>

          {/* List */}
          {list.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Aucun organisateur ajouté</p>
          ) : (
            <div className="space-y-1 max-h-72 overflow-y-auto">
              {list.map((o) => (
                <div key={o.name} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-muted/50">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground truncate">{o.name}</p>
                    {o.role && <p className="text-xs text-muted-foreground truncate">{o.role}</p>}
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleRemove(o.name)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {list.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleClear} className="w-full text-destructive hover:text-destructive">
              Vider la liste
            </Button>
          )}

          <div className="pt-4 border-t border-border">
            <Button onClick={() => { onOpenChange(false); toast.success("Organisateurs validés"); }} className="w-full gap-2 gradient-accent text-accent-foreground">
              <Check className="h-4 w-4" />
              Valider
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
