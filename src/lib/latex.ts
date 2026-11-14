/**
 * Gestion du LaTeX dans les titres, résumés, auteurs, etc.
 *
 * Deux usages :
 *  - `splitLatex()` découpe un texte en segments « texte » / « formule » (pour un rendu KaTeX à l'écran) ;
 *  - `latexToUnicode()` convertit tout en texte Unicode lisible (PDF, Word, Excel, PowerPoint,
 *    attestations…) : lettres grecques, exposants/indices, fractions, racines, accents, etc.
 *
 * Aucune dépendance : ce module est utilisable partout (exports, tests, interface).
 */

// ---------------------------------------------------------------------------
// SEGMENTATION  (texte / $math$ / $$math$$ / \( \) / \[ \])
// ---------------------------------------------------------------------------

export interface LatexSegment {
  type: "text" | "math";
  value: string;
  /** Formule en mode « display » ($$…$$ ou \[…\]). */
  display?: boolean;
}

const isSpace = (c: string | undefined) => c === undefined || /\s/.test(c);

/** Index du `$` fermant (non échappé) à partir de `from`, ou -1. */
function findClosingDollar(s: string, from: number, double: boolean): number {
  for (let i = from; i < s.length; i++) {
    const c = s[i];
    if (c === "\\") { i++; continue; }
    if (c !== "$") continue;
    if (double) {
      if (s[i + 1] === "$") return i;
      continue;
    }
    // `$` fermant : précédé d'un non-espace, non suivi d'un chiffre (« 5$ et 10$ » n'est pas une formule)
    if (s[i + 1] === "$") continue;
    if (isSpace(s[i - 1])) continue;
    if (/[0-9]/.test(s[i + 1] ?? "")) continue;
    return i;
  }
  return -1;
}

export function splitLatex(input: string): LatexSegment[] {
  const s = input ?? "";
  const out: LatexSegment[] = [];
  let text = "";
  const flush = () => { if (text) { out.push({ type: "text", value: text }); text = ""; } };
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === "\\" && s[i + 1] === "$") { text += "\\$"; i += 2; continue; }
    if (c === "\\" && (s[i + 1] === "(" || s[i + 1] === "[")) {
      const close = s[i + 1] === "(" ? "\\)" : "\\]";
      const end = s.indexOf(close, i + 2);
      if (end !== -1) {
        flush();
        out.push({ type: "math", value: s.slice(i + 2, end), display: s[i + 1] === "[" });
        i = end + 2;
        continue;
      }
    }
    if (c === "$") {
      if (s[i + 1] === "$") {
        const end = findClosingDollar(s, i + 2, true);
        if (end !== -1) {
          flush();
          out.push({ type: "math", value: s.slice(i + 2, end), display: true });
          i = end + 2;
          continue;
        }
      } else if (!isSpace(s[i + 1])) {
        const end = findClosingDollar(s, i + 1, false);
        if (end !== -1) {
          flush();
          out.push({ type: "math", value: s.slice(i + 1, end) });
          i = end + 1;
          continue;
        }
      }
    }
    text += c;
    i++;
  }
  flush();
  return out;
}

/** Le texte contient-il du LaTeX (formule ou commande) ? */
export function hasLatex(s: string | undefined | null): boolean {
  if (!s) return false;
  return splitLatex(s).some((x) => x.type === "math") || /\\[a-zA-Z'`^"~=.]|\\[{}%&_#]/.test(s);
}

// ---------------------------------------------------------------------------
// TABLES
// ---------------------------------------------------------------------------

const GREEK: Record<string, string> = {
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", varepsilon: "ε", zeta: "ζ", eta: "η",
  theta: "θ", vartheta: "ϑ", iota: "ι", kappa: "κ", lambda: "λ", mu: "μ", nu: "ν", xi: "ξ", omicron: "ο",
  pi: "π", varpi: "ϖ", rho: "ρ", varrho: "ϱ", sigma: "σ", varsigma: "ς", tau: "τ", upsilon: "υ",
  phi: "φ", varphi: "φ", chi: "χ", psi: "ψ", omega: "ω",
  Gamma: "Γ", Delta: "Δ", Theta: "Θ", Lambda: "Λ", Xi: "Ξ", Pi: "Π", Sigma: "Σ", Upsilon: "Υ",
  Phi: "Φ", Psi: "Ψ", Omega: "Ω",
};

const SYMBOLS: Record<string, string> = {
  times: "×", cdot: "·", pm: "±", mp: "∓", div: "÷", ast: "∗", star: "⋆", circ: "∘", bullet: "•",
  leq: "≤", le: "≤", geq: "≥", ge: "≥", neq: "≠", ne: "≠", approx: "≈", sim: "∼", simeq: "≃", cong: "≅",
  equiv: "≡", propto: "∝", ll: "≪", gg: "≫", infty: "∞", partial: "∂", nabla: "∇", hbar: "ℏ", ell: "ℓ",
  Re: "ℜ", Im: "ℑ", aleph: "ℵ", wp: "℘", emptyset: "∅", varnothing: "∅",
  sum: "∑", prod: "∏", coprod: "∐", int: "∫", iint: "∬", iiint: "∭", oint: "∮",
  in: "∈", ni: "∋", notin: "∉", subset: "⊂", subseteq: "⊆", supset: "⊃", supseteq: "⊇", setminus: "∖",
  cup: "∪", cap: "∩", bigcup: "⋃", bigcap: "⋂", forall: "∀", exists: "∃", nexists: "∄", neg: "¬", lnot: "¬",
  land: "∧", wedge: "∧", lor: "∨", vee: "∨", oplus: "⊕", otimes: "⊗", ominus: "⊖", odot: "⊙",
  to: "→", rightarrow: "→", leftarrow: "←", gets: "←", leftrightarrow: "↔", uparrow: "↑", downarrow: "↓",
  Rightarrow: "⇒", Leftarrow: "⇐", Leftrightarrow: "⇔", implies: "⟹", impliedby: "⟸", iff: "⟺",
  mapsto: "↦", longrightarrow: "⟶", longleftarrow: "⟵", hookrightarrow: "↪", rightharpoonup: "⇀",
  ldots: "…", dots: "…", cdots: "⋯", vdots: "⋮", ddots: "⋱", dotsc: "…", dotsb: "⋯",
  perp: "⊥", parallel: "∥", angle: "∠", triangle: "△", square: "□", therefore: "∴", because: "∵",
  langle: "⟨", rangle: "⟩", lceil: "⌈", rceil: "⌉", lfloor: "⌊", rfloor: "⌋",
  vert: "|", mid: "|", lvert: "|", rvert: "|", Vert: "‖", lVert: "‖", rVert: "‖", prime: "′", dagger: "†", ddagger: "‡",
  degree: "°", top: "⊤", bot: "⊥", vdash: "⊢", models: "⊨", nmid: "∤", checkmark: "✓",
  textdegree: "°", textmu: "µ", texttimes: "×", textregistered: "®", copyright: "©", textcopyright: "©",
  textendash: "–", textemdash: "—", textbullet: "•", textellipsis: "…", textasciitilde: "~", textbackslash: "\\",
  S: "§", P: "¶", pounds: "£", euro: "€", texteuro: "€", guillemotleft: "«", guillemotright: "»",
  ae: "æ", AE: "Æ", oe: "œ", OE: "Œ", o: "ø", O: "Ø", aa: "å", AA: "Å", ss: "ß", l: "ł", L: "Ł",
  i: "i", j: "j", dh: "ð", DH: "Ð", th: "þ", TH: "Þ",
};

/** Symboles « lettre » : l'espace qui suit la commande est absorbée (comme LaTeX : \pi r → πr). */
const LETTERLIKE = new Set<string>([...Object.keys(GREEK), "hbar", "ell", "aleph", "infty", "partial", "nabla", "ae", "AE", "oe", "OE", "o", "O", "aa", "AA", "ss", "l", "L", "i", "j", "dh", "DH", "th", "TH"]);

const FUNCTIONS = new Set([
  "sin", "cos", "tan", "cot", "sec", "csc", "arcsin", "arccos", "arctan", "sinh", "cosh", "tanh", "coth",
  "log", "ln", "lg", "exp", "lim", "liminf", "limsup", "max", "min", "sup", "inf", "arg", "det", "dim", "ker",
  "deg", "gcd", "hom", "Pr", "mod", "bmod", "pmod",
]);

const BLACKBOARD: Record<string, string> = { R: "ℝ", N: "ℕ", Z: "ℤ", Q: "ℚ", C: "ℂ", P: "ℙ", H: "ℍ", E: "𝔼", "1": "𝟙" };
const CALLIGRAPHIC: Record<string, string> = { L: "ℒ", H: "ℋ", F: "ℱ", B: "ℬ", E: "ℰ", M: "ℳ", I: "ℐ", R: "ℛ",  };

/** Commandes d'accent (texte) → signe diacritique combinant. */
const TEXT_ACCENTS: Record<string, string> = {
  "'": "\u0301", "`": "\u0300", "^": "\u0302", '"': "\u0308", "~": "\u0303", "=": "\u0304", ".": "\u0307",
  u: "\u0306", v: "\u030C", H: "\u030B", c: "\u0327", k: "\u0328", r: "\u030A", d: "\u0323", b: "\u0331",
};

/** Accents mathématiques → signe combinant. */
const MATH_ACCENTS: Record<string, string> = {
  hat: "\u0302", widehat: "\u0302", bar: "\u0304", overline: "\u0305", vec: "\u20D7", tilde: "\u0303", widetilde: "\u0303",
  dot: "\u0307", ddot: "\u0308", check: "\u030C", breve: "\u0306", acute: "\u0301", grave: "\u0300", underline: "\u0332",
};

const SUPERSCRIPT: Record<string, string> = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
  "+": "⁺", "-": "⁻", "−": "⁻", "=": "⁼", "(": "⁽", ")": "⁾",
  a: "ᵃ", b: "ᵇ", c: "ᶜ", d: "ᵈ", e: "ᵉ", f: "ᶠ", g: "ᵍ", h: "ʰ", i: "ⁱ", j: "ʲ", k: "ᵏ", l: "ˡ", m: "ᵐ",
  n: "ⁿ", o: "ᵒ", p: "ᵖ", r: "ʳ", s: "ˢ", t: "ᵗ", u: "ᵘ", v: "ᵛ", w: "ʷ", x: "ˣ", y: "ʸ", z: "ᶻ",
  A: "ᴬ", B: "ᴮ", D: "ᴰ", E: "ᴱ", G: "ᴳ", H: "ᴴ", I: "ᴵ", J: "ᴶ", K: "ᴷ", L: "ᴸ", M: "ᴹ", N: "ᴺ", O: "ᴼ",
  P: "ᴾ", R: "ᴿ", T: "ᵀ", U: "ᵁ", V: "ⱽ", W: "ᵂ",
  "β": "ᵝ", "γ": "ᵞ", "δ": "ᵟ", "θ": "ᶿ", "φ": "ᵠ", "χ": "ᵡ",
};

const SUBSCRIPT: Record<string, string> = {
  "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉",
  "+": "₊", "-": "₋", "−": "₋", "=": "₌", "(": "₍", ")": "₎",
  a: "ₐ", e: "ₑ", h: "ₕ", i: "ᵢ", j: "ⱼ", k: "ₖ", l: "ₗ", m: "ₘ", n: "ₙ", o: "ₒ", p: "ₚ", r: "ᵣ", s: "ₛ", t: "ₜ",
  u: "ᵤ", v: "ᵥ", x: "ₓ", "β": "ᵦ", "γ": "ᵧ", "ρ": "ᵨ", "φ": "ᵩ", "χ": "ᵪ",
};
const SUP_SELF = new Set(Object.values(SUPERSCRIPT));
const SUB_SELF = new Set(Object.values(SUBSCRIPT));

const VULGAR: Record<string, string> = {
  "1/2": "½", "1/3": "⅓", "2/3": "⅔", "1/4": "¼", "3/4": "¾", "1/5": "⅕", "2/5": "⅖", "3/5": "⅗", "4/5": "⅘",
  "1/6": "⅙", "5/6": "⅚", "1/8": "⅛", "3/8": "⅜", "5/8": "⅝", "7/8": "⅞",
};

const ENV_DELIMS: Record<string, [string, string]> = {
  pmatrix: ["(", ")"], bmatrix: ["[", "]"], Bmatrix: ["{", "}"], vmatrix: ["|", "|"], Vmatrix: ["‖", "‖"],
  cases: ["{ ", ""], matrix: ["", ""], smallmatrix: ["", ""], array: ["", ""],
};

// ---------------------------------------------------------------------------
// LECTEUR
// ---------------------------------------------------------------------------

class Reader {
  i = 0;
  constructor(public s: string) {}
  get done() { return this.i >= this.s.length; }
  peek() { return this.s[this.i]; }
  /** Saute les espaces ; renvoie vrai si au moins un a été sauté. */
  skipSpaces(): boolean {
    const start = this.i;
    while (!this.done && /\s/.test(this.s[this.i])) this.i++;
    return this.i > start;
  }
  /** Lit le nom d'une commande (après le « \ »). */
  readCommandName(): string {
    const m = /^[a-zA-Z]+/.exec(this.s.slice(this.i));
    if (m) { this.i += m[0].length; return m[0]; }
    const c = this.s[this.i] ?? "";
    this.i += c ? 1 : 0;
    return c;
  }
  /** Lit un argument : groupe `{…}` (contenu brut), commande `\x`, ou un caractère. */
  readArg(): string {
    this.skipSpaces();
    if (this.done) return "";
    const c = this.s[this.i];
    if (c === "{") {
      let depth = 0;
      const start = this.i + 1;
      for (let j = this.i; j < this.s.length; j++) {
        const d = this.s[j];
        if (d === "\\") { j++; continue; }
        if (d === "{") depth++;
        else if (d === "}") { depth--; if (depth === 0) { this.i = j + 1; return this.s.slice(start, j); } }
      }
      // accolade non fermée : tout le reste
      const rest = this.s.slice(start);
      this.i = this.s.length;
      return rest;
    }
    if (c === "\\") {
      const startI = this.i;
      this.i++;
      this.readCommandName();
      return this.s.slice(startI, this.i);
    }
    this.i++;
    return c;
  }
  /** Argument optionnel `[…]` (ou null). */
  readOptional(): string | null {
    const save = this.i;
    this.skipSpaces();
    if (this.peek() !== "[") { this.i = save; return null; }
    const end = this.s.indexOf("]", this.i);
    if (end === -1) { this.i = save; return null; }
    const v = this.s.slice(this.i + 1, end);
    this.i = end + 1;
    return v;
  }
}

// ---------------------------------------------------------------------------
// CONVERSION
// ---------------------------------------------------------------------------

type Mode = "text" | "math";

function applyCombining(base: string, mark: string): string {
  if (!base) return mark === "\u0301" ? "´" : mark === "\u0300" ? "`" : mark === "\u0302" ? "^" : mark === "\u0308" ? "¨" : mark === "\u0303" ? "~" : "";
  const chars = [...base];
  if (chars.length === 1) return (chars[0] + mark).normalize("NFC");
  return (chars[0] + mark + chars.slice(1).join("")).normalize("NFC");
}

function applyCombiningAll(base: string, mark: string): string {
  return [...base].map((ch) => (/\s/.test(ch) ? ch : (ch + mark).normalize("NFC"))).join("");
}

const isAtomic = (s: string) => {
  if (/^[^\s+\-−±×·÷=<>≤≥≠,;:/]*$/.test(s)) return true;
  // « (x+1) » déjà parenthésé
  if (s.startsWith("(") && s.endsWith(")")) {
    let d = 0;
    for (let k = 0; k < s.length; k++) {
      if (s[k] === "(") d++;
      else if (s[k] === ")") { d--; if (d === 0 && k < s.length - 1) return false; }
    }
    return d === 0;
  }
  return false;
};

function toScript(s: string, kind: "sup" | "sub"): string {
  const map = kind === "sup" ? SUPERSCRIPT : SUBSCRIPT;
  const self = kind === "sup" ? SUP_SELF : SUB_SELF;
  const t = s.trim();
  if (!t) return "";
  if (kind === "sup") {
    if (t === "°" || t === "∘") return "°";
    if (t === "′" || t === "″") return t;
    if (t === "⊤") return "ᵀ";
    if (t === "*" || t === "∗") return "*";
    if (t === "†" || t === "‡") return t;
  }
  let out = "";
  for (const ch of t) {
    if (map[ch]) out += map[ch];
    else if (self.has(ch)) out += ch;
    else {
      const sym = kind === "sup" ? "^" : "_";
      return t.length === 1 ? `${sym}${t}` : `${sym}(${t})`;
    }
  }
  return out;
}

function convert(src: string, mode: Mode): string {
  const r = new Reader(src);
  let out = "";

  const group = (raw: string, m: Mode = mode) => convert(raw, m);

  while (!r.done) {
    const c = r.peek();

    // --- espaces ---
    if (/\s/.test(c)) {
      r.skipSpaces();
      out += " ";
      continue;
    }

    // --- groupes { } : on enlève les accolades ---
    if (c === "{") { out += group(r.readArg()); continue; }
    if (c === "}") { r.i++; continue; }

    // --- indices / exposants (mode math) ---
    if (mode === "math" && (c === "^" || c === "_")) {
      r.i++;
      const arg = group(r.readArg());
      out += toScript(arg, c === "^" ? "sup" : "sub");
      continue;
    }

    // --- caractères spéciaux ---
    if (c === "~") { r.i++; out += mode === "math" ? " " : "\u00A0"; continue; }
    if (c === "&" && mode === "math") { r.i++; out += "  "; continue; }
    if (c === "'" && mode === "math") { r.i++; out += "′"; continue; }
    if (mode === "text") {
      if (src.startsWith("---", r.i)) { r.i += 3; out += "—"; continue; }
      if (src.startsWith("--", r.i)) { r.i += 2; out += "–"; continue; }
      if (src.startsWith("``", r.i)) { r.i += 2; out += "“"; continue; }
      if (src.startsWith("''", r.i)) { r.i += 2; out += "”"; continue; }
      if (c === "`") { r.i++; out += "‘"; continue; }
    }

    if (c !== "\\") { out += c; r.i++; continue; }

    // ================= commande =================
    r.i++; // saute « \ »
    const name = r.readCommandName();

    // sauts de ligne
    if (name === "\\") { out += mode === "math" ? "; " : " "; r.readOptional(); continue; }

    // échappements simples
    if ("%&_#${}".includes(name) && name.length === 1) { out += name; continue; }
    if (name === " " || name === ",") { out += " "; continue; }
    if (name === ";" || name === ":" ) { out += " "; continue; }
    if (name === "!") continue;
    if (name === "|") { out += "‖"; continue; }
    if (name === "/" ) continue;
    if (name === "-") continue; // césure facultative

    // accents de texte : \'e, \"{o}, \c{c}, \v s…
    // (les accents « symbole » valent dans les deux modes ; ceux à lettre (\c, \v…) seulement en texte)
    if (TEXT_ACCENTS[name] !== undefined && (!/[a-zA-Z]/.test(name) || mode === "text")) {
      const base = group(r.readArg(), "text");
      out += applyCombining(base, TEXT_ACCENTS[name]);
      continue;
    }

    // accents mathématiques
    if (MATH_ACCENTS[name] !== undefined) {
      const base = group(r.readArg(), "math");
      out += name === "overline" || name === "underline" || name === "widehat" || name === "widetilde"
        ? applyCombiningAll(base, MATH_ACCENTS[name])
        : applyCombining(base, MATH_ACCENTS[name]);
      continue;
    }

    // polices : contenu seul
    if (["mathrm", "mathbf", "mathit", "mathsf", "mathtt", "boldsymbol", "bm", "mathfrak", "mathscr", "mathbfit",
      "textbf", "textit", "textrm", "textsf", "texttt", "textsc", "textsl", "textup", "textmd", "emph", "mbox", "hbox",
      "text", "operatorname", "mathnormal", "displaystyle", "textstyle", "scriptstyle", "scriptscriptstyle", "uline", "underbar",
      "mathop", "mathbin", "mathrel", "mathord", "mathopen", "mathclose", "mathpunct", "overset", "underset", "xrightarrow"].includes(name)) {
      if (name === "displaystyle" || name === "textstyle" || name === "scriptstyle" || name === "scriptscriptstyle") continue;
      if (name === "overset" || name === "underset") { const top = r.readArg(); const base = group(r.readArg()); void top; out += base; continue; }
      if (name === "xrightarrow") { r.readOptional(); const lab = group(r.readArg()); out += lab ? `→(${lab})` : "→"; continue; }
      const inner = r.readArg();
      out += group(inner, name === "text" || name === "mbox" || name === "hbox" || name.startsWith("text") || name === "emph" ? "text" : mode);
      continue;
    }
    if (name === "mathbb") {
      const a = group(r.readArg(), "text");
      out += [...a].map((ch) => BLACKBOARD[ch] ?? ch).join("");
      continue;
    }
    if (name === "mathcal") {
      const a = group(r.readArg(), "text");
      out += [...a].map((ch) => CALLIGRAPHIC[ch] ?? ch).join("");
      continue;
    }
    // commutateurs de police (ancienne syntaxe) : ignorés
    if (["bf", "it", "rm", "sf", "tt", "sc", "sl", "em", "bfseries", "itshape", "rmfamily", "normalfont", "mdseries", "upshape",
      "tiny", "scriptsize", "footnotesize", "small", "normalsize", "large", "Large", "LARGE", "huge", "Huge",
      "noindent", "indent", "centering", "par", "newline", "linebreak", "nonumber", "limits", "nolimits", "relax", "protect",
      "big", "Big", "bigg", "Bigg", "bigl", "bigr", "Bigl", "Bigr", "biggl", "biggr", "middle"].includes(name)) continue;

    // à supprimer avec leur argument
    if (["footnote", "cite", "citep", "citet", "label", "ref", "eqref", "index", "vspace", "hspace", "vphantom", "hphantom",
      "phantom", "thanks", "pagebreak", "rule", "raisebox", "color", "textcolor", "setlength"].includes(name)) {
      if (name === "textcolor" || name === "raisebox") { r.readArg(); out += group(r.readArg()); continue; }
      r.readOptional();
      r.readArg();
      continue;
    }
    if (name === "url") { out += r.readArg(); continue; }
    if (name === "href") { r.readArg(); out += group(r.readArg()); continue; }

    // \left \right
    if (name === "left" || name === "right") {
      r.skipSpaces();
      if (r.peek() === ".") { r.i++; continue; }
      if (r.peek() === "\\") {
        // \left\{ … \right\} ; \left\langle…
        const save = r.i;
        r.i++;
        const n = r.readCommandName();
        if (n === "{" || n === "}") { out += n; continue; }
        r.i = save;
      }
      continue;
    }

    // fractions & co
    if (name === "frac" || name === "dfrac" || name === "tfrac" || name === "cfrac") {
      const num = group(r.readArg());
      const den = group(r.readArg());
      const v = VULGAR[`${num}/${den}`];
      if (v) { out += v; continue; }
      out += `${isAtomic(num) ? num : `(${num})`}/${isAtomic(den) ? den : `(${den})`}`;
      continue;
    }
    if (name === "binom" || name === "dbinom" || name === "tbinom") {
      const n = group(r.readArg());
      const k = group(r.readArg());
      out += `C(${n}, ${k})`;
      continue;
    }
    if (name === "sqrt") {
      const idx = r.readOptional();
      const rad = group(r.readArg());
      const body = isAtomic(rad) ? rad : `(${rad})`;
      if (idx === null || idx.trim() === "2") out += `√${body}`;
      else if (idx.trim() === "3") out += `∛${body}`;
      else if (idx.trim() === "4") out += `∜${body}`;
      else out += `${toScript(group(idx), "sup")}√${body}`;
      continue;
    }
    if (name === "stackrel") { const top = group(r.readArg()); const base = group(r.readArg()); out += base || top; continue; }

    // environnements (matrices, cases, align…)
    if (name === "begin" || name === "end") {
      const env = r.readArg().replace(/\*$/, "");
      const d = ENV_DELIMS[env];
      if (env === "array" && name === "begin") r.readArg(); // spécification des colonnes
      if (d) out += name === "begin" ? d[0] : d[1];
      continue;
    }

    // fonctions : \sin, \lim…
    if (FUNCTIONS.has(name)) {
      const hadSpace = /\s/.test(r.peek() ?? "");
      out += name === "bmod" ? " mod " : name === "pmod" ? " mod " : name;
      r.skipSpaces();
      if (hadSpace) out += " ";
      continue;
    }

    // lettres grecques & symboles (y compris en mode texte, par tolérance)
    const sym = GREEK[name] ?? SYMBOLS[name];
    if (sym !== undefined) {
      out += sym;
      const hadSpace = r.skipSpaces();
      // Lettres (α, ℏ…) : l'espace est absorbé devant une lettre/un chiffre (\pi r → πr), gardé devant un opérateur.
      if (hadSpace && (!LETTERLIKE.has(name) || !/[A-Za-z0-9\\{(]/.test(r.peek() ?? ""))) out += " ";
      continue;
    }

    // commande inconnue : on garde seulement son argument éventuel (le nom est supprimé)
    r.skipSpaces();
  }
  return out;
}

/** Nettoyage final des espaces. */
function tidy(s: string): string {
  return s
    .replace(/[ \t\r\n]+/g, (m) => (m.includes("\n") ? " " : " "))
    .replace(/ {2,}/g, " ")
    .replace(/\( /g, "(")
    .replace(/ \)/g, ")")
    .replace(/ ;/g, ";")
    .trim();
}

/**
 * Convertit un texte contenant du LaTeX en texte Unicode lisible.
 * Idempotent pour un texte sans LaTeX (renvoyé tel quel).
 */
export function latexToUnicode(input: string | undefined | null): string {
  if (!input) return input ?? "";
  if (!/[\\${}~]|--|``|''/.test(input)) return input;
  const parts = splitLatex(input).map((seg) =>
    seg.type === "math" ? tidy(convert(seg.value, "math")) : convert(seg.value, "text"),
  );
  return parts.join("").replace(/ {2,}/g, " ").trim();
}

// ---------------------------------------------------------------------------
// COMPATIBILITÉ DES POLICES PDF
// ---------------------------------------------------------------------------

/** Caractères disponibles dans les polices standard de jsPDF (Helvetica, WinAnsi / cp1252). */
const WINANSI_EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";

export function isWinAnsiChar(ch: string): boolean {
  const c = ch.charCodeAt(0);
  if (c >= 0x20 && c <= 0x7e) return true;
  if (c >= 0xa0 && c <= 0xff) return true;
  if (c === 0x09 || c === 0x0a || c === 0x0d) return true;
  return WINANSI_EXTRA.includes(ch);
}

/** Le texte contient-il des caractères hors Helvetica (grec, symboles, indices…) ? */
export function needsUnicodeFont(s: string | undefined | null): boolean {
  if (!s) return false;
  for (const ch of s) if (!isWinAnsiChar(ch)) return true;
  return false;
}

const GREEK_NAMES: Record<string, string> = {
  α: "alpha", β: "beta", γ: "gamma", δ: "delta", ε: "epsilon", ζ: "zeta", η: "eta", θ: "theta", ϑ: "theta", ι: "iota",
  κ: "kappa", λ: "lambda", μ: "mu", ν: "nu", ξ: "xi", ο: "o", π: "pi", ϖ: "pi", ρ: "rho", ϱ: "rho", σ: "sigma", ς: "sigma",
  τ: "tau", υ: "upsilon", φ: "phi", χ: "chi", ψ: "psi", ω: "omega",
  Γ: "Gamma", Δ: "Delta", Θ: "Theta", Λ: "Lambda", Ξ: "Xi", Π: "Pi", Σ: "Sigma", Υ: "Upsilon", Φ: "Phi", Ψ: "Psi", Ω: "Omega",
};
const ASCII_FALLBACK: Record<string, string> = {
  "≤": "<=", "≥": ">=", "≠": "!=", "≈": "~=", "∼": "~", "≡": "==", "∞": "inf", "∑": "sum", "∏": "prod", "∫": "int",
  "√": "sqrt", "∛": "cbrt", "∜": "root4", "→": "->", "←": "<-", "↔": "<->", "⇒": "=>", "⇐": "<=", "⇔": "<=>", "⟹": "=>", "⟺": "<=>",
  "↦": "|->", "∈": " in ", "∉": " not in ", "∂": "d", "∇": "nabla", "∅": "{}", "∀": "for all ", "∃": "exists ", "∧": " and ", "∨": " or ",
  "⊂": " subset ", "⊆": " subset ", "∪": " U ", "∩": " n ", "ℝ": "R", "ℕ": "N", "ℤ": "Z", "ℚ": "Q", "ℂ": "C",
  "′": "'", "″": "''", "⟨": "<", "⟩": ">", "⌈": "[", "⌉": "]", "⌊": "[", "⌋": "]", "‖": "||", "∥": "||", "⊥": "_|_", "∠": "angle ",
  "−": "-", "∗": "*", "⋅": ".", "∘": "o", "⊕": "(+)", "⊗": "(x)", "ℏ": "hbar", "ℓ": "l", "…": "...", "⋯": "...",
  "\u2009": " ", "\u2002": " ", "\u2003": " ", "\u202f": " ",
};
const SUP_REVERSE: Record<string, string> = {};
Object.entries(SUPERSCRIPT).forEach(([k, v]) => { if (!(v in SUP_REVERSE)) SUP_REVERSE[v] = k === "−" ? "-" : k; });
const SUB_REVERSE: Record<string, string> = {};
Object.entries(SUBSCRIPT).forEach(([k, v]) => { if (!(v in SUB_REVERSE)) SUB_REVERSE[v] = k === "−" ? "-" : k; });

/**
 * Repli quand la police Unicode n'est pas disponible : remplace les caractères
 * non supportés par Helvetica par un équivalent ASCII lisible (α → alpha, ≤ → <=, x₂ → x_2…).
 */
export function toWinAnsiSafe(s: string): string {
  if (!needsUnicodeFont(s)) return s;
  let out = "";
  const chars = [...s];
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (isWinAnsiChar(ch)) { out += ch; continue; }
    if (/[\u0300-\u036f\u20d7]/.test(ch)) continue; // signes combinants
    if (GREEK_NAMES[ch]) { out += GREEK_NAMES[ch]; continue; }
    if (SUP_REVERSE[ch] !== undefined || SUB_REVERSE[ch] !== undefined) {
      const rev = SUP_REVERSE[ch] !== undefined ? SUP_REVERSE : SUB_REVERSE;
      const mark = rev === SUP_REVERSE ? "^" : "_";
      let run = "";
      let j = i;
      while (j < chars.length && rev[chars[j]] !== undefined) { run += rev[chars[j]]; j++; }
      out += run.length > 1 ? `${mark}(${run})` : `${mark}${run}`;
      i = j - 1;
      continue;
    }
    out += ASCII_FALLBACK[ch] ?? "?";
  }
  return out;
}

/** Commodité : nettoie le LaTeX puis garantit un texte affichable par Helvetica. */
export function latexToPdfText(input: string | undefined | null): string {
  return toWinAnsiSafe(latexToUnicode(input));
}
