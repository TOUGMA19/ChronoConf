import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { addArticle, getCategories, addCategory, getPresentationTypes, addPresentationType, ArticleType, ArticleStatus, DEFAULT_PRESENTATION_TYPES } from "@/lib/conference";
import { secureTrim, validateDuration, LIMITS } from "@/lib/security";

interface AddArticleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: () => void;
}

const AddArticleDialog = ({ open, onOpenChange, onAdded }: AddArticleDialogProps) => {
  const [title, setTitle] = useState("");
  const [authors, setAuthors] = useState("");
  const [moderator, setModerator] = useState("");
  const [sessionChair, setSessionChair] = useState("");
  const [abstract, setAbstract] = useState("");
  const [category, setCategory] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const [duration, setDuration] = useState("20");
  const presentationTypes = getPresentationTypes();
  const defaultType = presentationTypes[0] || DEFAULT_PRESENTATION_TYPES[0];
  const [type, setType] = useState<ArticleType>(defaultType);
  const [customType, setCustomType] = useState("");
  const [status, setStatus] = useState<ArticleStatus>("accepted");

  const categories = getCategories();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const safeTitle = secureTrim(title, LIMITS.title);
    const safeAuthors = secureTrim(authors, LIMITS.authors);
    const safeModerator = secureTrim(moderator, LIMITS.moderator);
    const safeChair = secureTrim(sessionChair, LIMITS.sessionChair);
    const safeAbstract = secureTrim(abstract, LIMITS.abstract);
    const safeCustomCat = secureTrim(customCategory, LIMITS.category);
    const finalCategory = category === "__custom__" ? safeCustomCat : category;
    if (!safeTitle || !safeAuthors || !finalCategory) return;
    if (category === "__custom__" && safeCustomCat) {
      addCategory(safeCustomCat);
    }
    let finalType: ArticleType = type;
    if (type === "__custom__") {
      const trimmed = customType.trim().slice(0, 40);
      if (!trimmed) return;
      addPresentationType(trimmed);
      finalType = trimmed;
    }
    addArticle({
      title: safeTitle,
      authors: safeAuthors,
      moderator: safeModerator,
      sessionChair: safeChair,
      abstract: safeAbstract,
      category: finalCategory,
      duration: validateDuration(duration),
      type: finalType,
      status,
    });
    setTitle(""); setAuthors(""); setModerator(""); setSessionChair(""); setAbstract(""); setCategory(""); setCustomCategory(""); setDuration("20"); setType(defaultType); setCustomType(""); setStatus("accepted");
    onOpenChange(false);
    setTimeout(() => onAdded(), 0);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Soumettre un article</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Titre *</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre de l'article" required maxLength={LIMITS.title} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="authors">Auteur(s) *</Label>
            <Input id="authors" value={authors} onChange={(e) => setAuthors(e.target.value)} placeholder="Ex: Jean Dupont, Marie Curie" required maxLength={LIMITS.authors} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="moderator">Modérateur</Label>
            <Input id="moderator" value={moderator} onChange={(e) => setModerator(e.target.value)} placeholder="Ex: Prof. Martin" maxLength={LIMITS.moderator} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sessionChair">Président de session</Label>
            <Input id="sessionChair" value={sessionChair} onChange={(e) => setSessionChair(e.target.value)} placeholder="Ex: Dr. Bernard" maxLength={LIMITS.sessionChair} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="abstract">Résumé</Label>
            <Textarea id="abstract" value={abstract} onChange={(e) => setAbstract(e.target.value)} placeholder="Résumé de l'article..." rows={3} maxLength={LIMITS.abstract} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Thématique *</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                  <SelectItem value="__custom__">+ Nouvelle thématique...</SelectItem>
                </SelectContent>
              </Select>
              {category === "__custom__" && (
                <Input
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  placeholder="Nom de la thématique"
                  className="mt-2"
                />
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="duration">Durée (min)</Label>
              <Input id="duration" type="number" min="5" max="120" value={duration} onChange={(e) => setDuration(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as ArticleType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {presentationTypes.map((t) => (
                    <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                  ))}
                  <SelectItem value="__custom__">+ Nouveau type...</SelectItem>
                </SelectContent>
              </Select>
              {type === "__custom__" && (
                <Input
                  value={customType}
                  onChange={(e) => setCustomType(e.target.value)}
                  placeholder="Nom du type"
                  className="mt-2"
                  maxLength={40}
                />
              )}
            </div>
            <div className="space-y-2">
              <Label>Statut</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as ArticleStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="submitted">Soumis</SelectItem>
                  <SelectItem value="accepted">Accepté</SelectItem>
                  <SelectItem value="rejected">Rejeté</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit" className="gradient-accent text-accent-foreground">Ajouter</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddArticleDialog;
