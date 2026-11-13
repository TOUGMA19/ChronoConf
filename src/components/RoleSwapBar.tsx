import { useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface RoleSwapOption<R extends string> {
  value: R;
  label: string;
}

interface Props<R extends string> {
  roles: RoleSwapOption<R>[];
  /** Rôles proposés par défaut (ex. « speaker » et « participant »). */
  defaultA: R;
  defaultB: R;
  /** Nombre de personnes actuellement visibles (liste filtrée) ayant ce rôle. */
  countOf: (role: R) => number;
  /** Appelé avec les deux rôles à permuter. */
  onSwap: (a: R, b: R) => void;
}

/**
 * Barre « Permuter A ⇄ B » : tous les A deviennent B et tous les B deviennent A,
 * sur les personnes actuellement affichées (donc la recherche restreint la portée).
 */
export default function RoleSwapBar<R extends string>({ roles, defaultA, defaultB, countOf, onSwap }: Props<R>) {
  const [a, setA] = useState<R>(defaultA);
  const [b, setB] = useState<R>(defaultB);
  const nA = countOf(a);
  const nB = countOf(b);
  const disabled = a === b || nA + nB === 0;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed border-border bg-muted/30 p-2">
      <span className="text-[11px] font-medium text-muted-foreground px-1">Permuter :</span>
      <Select value={a} onValueChange={(v) => setA(v as R)}>
        <SelectTrigger className="h-8 w-[170px] text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          {roles.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
        </SelectContent>
      </Select>
      <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
      <Select value={b} onValueChange={(v) => setB(v as R)}>
        <SelectTrigger className="h-8 w-[170px] text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          {roles.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
        </SelectContent>
      </Select>
      <Button
        type="button"
        size="sm"
        className="h-8"
        disabled={disabled}
        onClick={() => onSwap(a, b)}
        title="Les personnes du 1er rôle passent au 2e, et inversement (liste affichée)"
      >
        Permuter ({nA} ⇄ {nB})
      </Button>
    </div>
  );
}
