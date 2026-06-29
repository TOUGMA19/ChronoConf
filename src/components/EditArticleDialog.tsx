import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { updateArticle, getCategories, addCategory, getPresentationTypes, addPresentationType, Article, ArticleType, ArticleStatus, DEFAULT_PRESENTATION_TYPES } from "@/lib/conference";
import { toast } from "sonner";

interface EditArticleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  article: Article | null;
  onUpdated: () => void;
}

const EditArticleDialog = ({ open, onOpenChange, article, onUpdated }: EditArticleDialogProps) => {
  const [title, setTitle] = useState("");
  const [authors, setAuthors] = useState("");
  const [moderator, setModerator] = useState("");
  const [sessionChair, setSessionChair] = useState("");
  const [abstract, setAbstract] = useState("");
  const [category, setCategory] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const [duration, setDuration] = useState("20");
  const presentationTypes = getPresentationTypes();
  const [type, setType] = useState<ArticleType>(presentationTypes[0] || DEFAULT_PRESENTATION_TYPES[0]);
  const [customType, setCustomType] = useState("");
  const [status, setStatus] = useState<ArticleStatus>("accepted");

  const categories = getCategories();

  useEffect(() => {
    if (article) {
      setTitle(article.title);
      setAuthors(article.authors);
      setModerator(article.moderator);
      setSessionChair(article.sessionChair);
      setAbstract(article.abstract);
      setCategory(categories.includes(article.category) ? article.category : "__custom__");
      setCustomCategory(categories.includes(article.category) ? "" : article.category);
      setDuration(article.duration.toString());
      setType(presentationTypes.includes(article.type) ? article.type : article.type);
      setCustomType("");
      setStatus(article.status);
    }
  }, [article]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!article) return;
    const finalCategory = category === "__custom__" ? customCategory.trim() : category;
    if (!title.trim() || !authors.trim() || !finalCategory) return;
    if (category === "__custom__" && customCategory.trim()) {
      addCategory(customCategory.trim());
    }
    let finalType: ArticleType = type;
    if (type === "__custom__") {
      const trimmed = customType.trim().slice(0, 40);
      if (!trimmed) return;
      addPresentationType(trimmed);
      finalType = trimmed;
    }
    updateArticle(article.id, {
      title: title.trim(),
      authors: authors.trim(),
      moderator: moderator.trim(),
      sessionChair: sessionChair.trim(),
      abstract: abstract.trim(),
      category: finalCategory,
      duration: parseInt(duration) || 20,
      type: finalType,
      status,
    });
    onOpenChange(false);
    setTimeout(() => {
      toast.success("Article mis à jour");
      onUpdated();
    }, 0);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Modifier l'article</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-title">Titre *</Label>
            <Input id="edit-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-authors">Auteur(s) *</Label>
            <Input id="edit-authors" value={authors} onChange={(e) => setAuthors(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-moderator">Modérateur</Label>
            <Input id="edit-moderator" value={moderator} onChange={(e) => setModerator(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-sessionChair">Président de session</Label>
            <Input id="edit-sessionChair" value={sessionChair} onChange={(e) => setSessionChair(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-abstract">Résumé</Label>
            <Textarea id="edit-abstract" value={abstract} onChange={(e) => setAbstract(e.target.value)} rows={3} />
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
                <Input value={customCategory} onChange={(e) => setCustomCategory(e.target.value)} placeholder="Nom de la thématique" className="mt-2" />
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-duration">Durée (min)</Label>
              <Input id="edit-duration" type="number" min="5" max="120" value={duration} onChange={(e) => setDuration(e.target.value)} />
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
                  {!presentationTypes.includes(type) && type !== "__custom__" && (
                    <SelectItem value={type} className="capitalize">{type}</SelectItem>
                  )}
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
            <Button type="submit" className="gradient-accent text-accent-foreground">Enregistrer</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditArticleDialog;
