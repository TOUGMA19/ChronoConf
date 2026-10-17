import { AlertTriangle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface Props {
  /** Communications non rejetées absentes du chronogramme. */
  unscheduledCount: number;
  includeUnscheduled: boolean;
  onIncludeUnscheduledChange: (v: boolean) => void;
  /** Intervenants n'ayant pas encore vérifié leurs informations (null = inconnu). */
  unverifiedCount?: number | null;
  /** Personnes dans la liste ci-dessous. */
  total: number;
  noun: string; // "badge" | "attestation"
}

/** Bandeau d'information affiché en haut des fenêtres badges / attestations. */
export default function ListStatusNotice({
  unscheduledCount, includeUnscheduled, onIncludeUnscheduledChange, unverifiedCount, total, noun,
}: Props) {
  const warnUnverified = typeof unverifiedCount === "number" && unverifiedCount > 0;
  if (unscheduledCount === 0 && !warnUnverified) return null;
  return (
    <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm space-y-2">
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 mt-0.5 text-warning shrink-0" />
        <div className="space-y-1">
          {unscheduledCount > 0 && (
            <p>
              <strong>{unscheduledCount}</strong> communication{unscheduledCount > 1 ? "s" : ""} non planifiée{unscheduledCount > 1 ? "s" : ""} dans le chronogramme.
              {includeUnscheduled ? " Leurs auteurs sont inclus ci-dessous." : " Leurs auteurs sont exclus de la liste."}
            </p>
          )}
          {warnUnverified && (
            <p>
              <strong>{unverifiedCount}</strong> intervenant{unverifiedCount! > 1 ? "s" : ""} n'ont pas encore vérifié leurs informations :
              les noms peuvent différer de la version corrigée. Pensez à « Synchroniser dans le programme ».
            </p>
          )}
          <p className="text-muted-foreground">{total} {noun}{total > 1 ? "s" : ""} dans la liste.</p>
        </div>
      </div>
      {unscheduledCount > 0 && (
        <div className="flex items-center gap-2 pl-6">
          <Switch id={`inc-unsched-${noun}`} checked={includeUnscheduled} onCheckedChange={onIncludeUnscheduledChange} />
          <Label htmlFor={`inc-unsched-${noun}`} className="text-sm cursor-pointer">Inclure les communications non planifiées</Label>
        </div>
      )}
    </div>
  );
}
