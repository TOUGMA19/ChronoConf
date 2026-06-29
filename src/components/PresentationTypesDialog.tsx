import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Pencil, Check, X } from "lucide-react";
import {
  getPresentationTypes,
  addPresentationType,
  removePresentationType,
  renamePresentationType,
} from "@/lib/conference";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
}

const PresentationTypesDialog = ({ open, onOpenChange, onChanged }: Props) => {
  const [types, setTypes] = useState<string[]>([]);
  const [newType, setNewType] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const refresh = () => setTypes(getPresentationTypes());

  useEffect(() => {
    if (open) refresh();
  }, [open]);

  const handleAdd = () => {
    const v = newType.trim();
    if (!v) return;
    if (addPresentationType(v)) {
      toast.success(`Type "${v}" ajouté`);
      setNewType("");
      refresh();
      onChanged?.();
    } else {
      toast.error("Ce type existe déjà");
    }
  };

  const handleRemove = (name: string) => {
    if (types.length <= 1) {
      toast.error("Au moins un type doit rester");
      return;
    }
    removePresentationType(name);
    toast.success(`Type "${name}" supprimé`);
    refresh();
    onChanged?.();
  };

  const startEdit = (name: string) => {
    setEditing(name);
    setEditValue(name);
  };

  const commitEdit = () => {
    if (!editing) return;
    const v = editValue.trim();
    if (!v || v === editing) { setEditing(null); return; }
    if (renamePresentationType(editing, v)) {
      toast.success(`Renommé en "${v}"`);
      setEditing(null);
      refresh();
      onChanged?.();
    } else {
      toast.error("Renommage impossible (déjà existant ou invalide)");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Types de présentation</DialogTitle>
          <DialogDescription>
            Personnalisez les formats de présentation utilisés dans votre conférence
            (ex: présentielle, en ligne, hybride...).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Ajouter un type</Label>
            <div className="flex gap-2">
              <Input
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                placeholder="Ex: hybride"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
                maxLength={40}
              />
              <Button type="button" onClick={handleAdd} className="gap-1">
                <Plus className="h-4 w-4" /> Ajouter
              </Button>
            </div>
          </div>

          <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
            {types.map((t) => (
              <div key={t} className="flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-muted/30">
                {editing === t ? (
                  <>
                    <Input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      autoFocus
                      maxLength={40}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { e.preventDefault(); commitEdit(); }
                        if (e.key === "Escape") setEditing(null);
                      }}
                    />
                    <Button type="button" size="icon" variant="ghost" onClick={commitEdit}>
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button type="button" size="icon" variant="ghost" onClick={() => setEditing(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm">{t}</span>
                    <Button type="button" size="icon" variant="ghost" onClick={() => startEdit(t)} className="text-muted-foreground hover:text-primary">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button type="button" size="icon" variant="ghost" onClick={() => handleRemove(t)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fermer</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PresentationTypesDialog;
