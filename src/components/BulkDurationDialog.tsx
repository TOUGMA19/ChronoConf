import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Timer } from "lucide-react";
import { Article, DurationScope, MIN_DURATION, MAX_DURATION } from "@/lib/conference";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  articles: Article[];
  types: string[];
  categories: string[];
  hasSchedule: boolean;
  /** Applique la durée ; retourne le nombre d'articles modifiés. */
  onApply: (scope: DurationScope, minutes: number, onlyAccepted: boolean) => number;
}

const ALL = "__all__";

export default function BulkDurationDialog({ open, onOpenChange, articles, types, categories, hasSchedule, onApply }: Props) {
  const [scopeKind, setScopeKind] = useState<"all" | "type" | "category">("all");
  const [value, setValue] = useState<string>(ALL);
  const [minutes, setMinutes] = useState("15");
  const [onlyAccepted, setOnlyAccepted] = useState(false);

  useEffect(() => { if (open) { setScopeKind("all"); setValue(ALL); setOnlyAccepted(false); } }, [open]);

  const scope: DurationScope = useMemo(() => {
    if (scopeKind === "type" && value !== ALL) return { kind: "type", value };
    if (scopeKind === "category" && value !== ALL) return { kind: "category", value };
    return { kind: "all" };
  }, [scopeKind, value]);

  const minutesNum = parseInt(minutes);
  const valid = Number.isFinite(minutesNum) && minutesNum >= MIN_DURATION && minutesNum <= MAX_DURATION;
  const needsValue = scopeKind !== "all";
  const concerned = articles.filter((a) => {
    if (onlyAccepted && a.status !== "accepted") return false;
    if (scope.kind === "type") return a.type === scope.value;
    if (scope.kind === "category") return a.category === scope.value;
    return true;
  }).length;
  const options = scopeKind === "type" ? types : categories;
  const disabled = !valid || (needsValue && value === ALL) || concerned === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Timer className="h-5 w-5 text-primary" />Durée des présentations</DialogTitle>
          <DialogDescription>Applique la même durée à plusieurs présentations d'un coup.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Appliquer à</Label>
            <Select value={scopeKind} onValueChange={(v) => { setScopeKind(v as typeof scopeKind); setValue(ALL); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les présentations</SelectItem>
                <SelectItem value="type">Un type de présentation</SelectItem>
                <SelectItem value="category">Une thématique</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {needsValue && (
            <div className="space-y-1.5">
              <Label>{scopeKind === "type" ? "Type" : "Thématique"}</Label>
              <Select value={value} onValueChange={setValue}>
                <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
                <SelectContent>
                  {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="bulk-minutes">Durée (minutes, {MIN_DURATION}–{MAX_DURATION})</Label>
            <Input id="bulk-minutes" type="number" min={MIN_DURATION} max={MAX_DURATION} value={minutes} onChange={(e) => setMinutes(e.target.value)} />
            {!valid && <p className="text-xs text-destructive">Entrez une valeur entre {MIN_DURATION} et {MAX_DURATION}.</p>}
          </div>
          <div className="flex items-center gap-2">
            <Switch id="bulk-accepted" checked={onlyAccepted} onCheckedChange={setOnlyAccepted} />
            <Label htmlFor="bulk-accepted" className="cursor-pointer">Seulement les articles acceptés</Label>
          </div>
          <p className="text-sm text-muted-foreground">
            {concerned} présentation{concerned > 1 ? "s" : ""} concernée{concerned > 1 ? "s" : ""}.
            {hasSchedule && " Le chronogramme existant n'est pas recalculé : régénérez-le ensuite."}
          </p>
          <Button
            className="w-full" disabled={disabled}
            onClick={() => { onApply(scope, minutesNum, onlyAccepted); onOpenChange(false); }}
          >
            Appliquer {valid ? `${minutesNum} min` : ""}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
