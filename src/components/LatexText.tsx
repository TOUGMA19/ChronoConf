import { useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { hasLatex, latexToUnicode, splitLatex } from "@/lib/latex";

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Rend un texte contenant du LaTeX en HTML : formules via KaTeX, le reste en texte Unicode propre. */
export function latexToHtml(input: string): string {
  return splitLatex(input)
    .map((seg) => {
      if (seg.type === "text") return escapeHtml(latexToUnicode(seg.value));
      try {
        return katex.renderToString(seg.value, {
          displayMode: !!seg.display,
          throwOnError: true,
          strict: "ignore",
          trust: false,
          output: "htmlAndMathml",
        });
      } catch {
        // Formule que KaTeX ne comprend pas : repli sur la conversion en texte Unicode.
        return escapeHtml(latexToUnicode(`$${seg.value}$`));
      }
    })
    .join("");
}

interface Props {
  text?: string | null;
  className?: string;
}

/**
 * Affiche un titre / résumé / liste d'auteurs contenant du LaTeX ($…$, $$…$$, \( \), \[ \],
 * accents \'e, \textbf{…}…). Un texte sans LaTeX est affiché tel quel, sans surcoût.
 */
export default function LatexText({ text, className }: Props) {
  const value = text ?? "";
  const latex = hasLatex(value) || /[{}~]|--/.test(value);
  const html = useMemo(() => (latex ? latexToHtml(value) : ""), [latex, value]);
  if (!latex) return <span className={className}>{value}</span>;
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
