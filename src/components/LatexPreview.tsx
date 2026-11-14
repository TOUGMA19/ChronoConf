import LatexText from "./LatexText";
import { hasLatex } from "@/lib/latex";

/** Aperçu du rendu sous un champ de saisie ; n'apparaît que si le texte contient du LaTeX. */
export default function LatexPreview({ text }: { text: string }) {
  if (!hasLatex(text)) return null;
  return (
    <div className="rounded-md border border-dashed border-border bg-muted/30 px-2 py-1.5 text-sm">
      <span className="mr-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Aperçu</span>
      <LatexText text={text} />
    </div>
  );
}
