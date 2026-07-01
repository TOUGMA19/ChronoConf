import { useRef, useState } from "react";
import { Upload, Download, AlertCircle, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { addArticle, getCategories, addCategory, addPresentationType, getPresentationTypes, ArticleType, ArticleStatus, DEFAULT_PRESENTATION_TYPES } from "@/lib/conference";
import { secureTrim, validateDuration, MAX_CSV_SIZE, MAX_CSV_ROWS, LIMITS } from "@/lib/security";
import { toast } from "sonner";

interface ImportCsvDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: (count: number) => void;
}

interface ParsedRow {
  code: string;
  title: string;
  authors: string;
  moderator: string;
  sessionChair: string;
  abstract: string;
  category: string;
  duration: number;
  type: ArticleType;
  status: ArticleStatus;
  error?: string;
}

const LEGACY_TYPE_MAP: Record<string, string> = { oral: "présentielle", poster: "en ligne" };
const VALID_STATUSES: string[] = ["submitted", "accepted", "rejected"];

function parseCSV(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const sep = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(sep).map((h) => h.trim().toLowerCase().replace(/"/g, ""));

  const colMap = {
    code: headers.findIndex((h) => ["code", "id", "identifiant", "reference", "référence", "ref", "numero", "numéro", "num"].includes(h)),
    title: headers.findIndex((h) => ["titre", "title"].includes(h)),
    authors: headers.findIndex((h) => ["auteur", "auteurs", "authors", "author"].includes(h)),
    moderator: headers.findIndex((h) => ["modérateur", "moderateur", "moderator"].includes(h)),
    sessionChair: headers.findIndex((h) => ["président", "president", "président de session", "president de session", "session chair", "chair"].includes(h)),
    abstract: headers.findIndex((h) => ["résumé", "resume", "abstract"].includes(h)),
    category: headers.findIndex((h) => ["thématique", "thematique", "catégorie", "categorie", "category", "axe", "axes"].includes(h)),
    duration: headers.findIndex((h) => ["durée", "duree", "duration"].includes(h)),
    type: headers.findIndex((h) => ["type"].includes(h)),
    status: headers.findIndex((h) => ["statut", "status"].includes(h)),
  };

  if (colMap.title === -1 || colMap.authors === -1) {
    return [{ title: "", authors: "", moderator: "", sessionChair: "", abstract: "", category: "", duration: 20, type: DEFAULT_PRESENTATION_TYPES[0], status: "submitted", error: "Colonnes 'titre' et 'auteur(s)' requises" }];
  }

  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(sep).map((c) => c.trim().replace(/^"|"$/g, ""));
    const code = colMap.code >= 0 ? (cols[colMap.code] || "").trim() : "";
    const title = cols[colMap.title] || "";
    const authors = cols[colMap.authors] || "";

    if (!title || !authors) {
      rows.push({ code, title, authors, moderator: "", sessionChair: "", abstract: "", category: "", duration: 20, type: DEFAULT_PRESENTATION_TYPES[0], status: "submitted", error: `Ligne ${i + 1}: titre ou auteur manquant` });
      continue;
    }

    const rawType = (colMap.type >= 0 ? cols[colMap.type] : "").toLowerCase();
    const rawStatus = (colMap.status >= 0 ? cols[colMap.status] : "").toLowerCase();
    const rawCategory = colMap.category >= 0 ? (cols[colMap.category] || "").trim() : "";
    const rawDuration = colMap.duration >= 0 ? parseInt(cols[colMap.duration]) : 20;

    let status: ArticleStatus = "submitted";
    if (VALID_STATUSES.includes(rawStatus)) status = rawStatus as ArticleStatus;
    else if (["accepté", "accepte"].includes(rawStatus)) status = "accepted";
    else if (["rejeté", "rejete"].includes(rawStatus)) status = "rejected";
    else if (["soumis"].includes(rawStatus)) status = "submitted";

    // Free-form type: accept any value, migrate legacy oral/poster
    let type: ArticleType = DEFAULT_PRESENTATION_TYPES[0];
    if (rawType) {
      const mapped = LEGACY_TYPE_MAP[rawType];
      type = mapped ?? rawType;
    }

    // Use the category as-is from CSV (will be auto-added on import)
    const finalCategory = rawCategory || "Autre";

    rows.push({
      code,
      title,
      authors,
      moderator: colMap.moderator >= 0 ? cols[colMap.moderator] || "" : "",
      sessionChair: colMap.sessionChair >= 0 ? cols[colMap.sessionChair] || "" : "",
      abstract: colMap.abstract >= 0 ? cols[colMap.abstract] || "" : "",
      category: finalCategory,
      duration: isNaN(rawDuration) || rawDuration < 5 ? 20 : rawDuration,
      type,
      status,
    });
  }
  return rows;
}

const SAMPLE_CSV = `code;titre;auteurs;modérateur;président;résumé;thématique;durée;type;statut
A001;Deep Learning pour la détection d'anomalies;Jean Dupont, Marie Curie;Prof. Martin;Dr. Bernard;Application du deep learning aux systèmes industriels;Intelligence Artificielle;20;présentielle;accepté
A002;Sécurité des réseaux IoT;Alice Martin;Dr. Leroy;Prof. Duval;Analyse des vulnérabilités IoT;Cybersécurité;25;présentielle;accepté
A003;Analyse de données massives;Pierre Bernard;Prof. Durand;Dr. Petit;Méthodes de traitement Big Data;Data Science;20;en ligne;soumis
A004;Architecture microservices;Sophie Leclerc;Dr. Petit;Prof. Martin;Patterns cloud-native;Cloud Computing;15;en ligne;accepté`;

const ImportCsvDialog = ({ open, onOpenChange, onImported }: ImportCsvDialogProps) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState("");

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_CSV_SIZE) {
      toast.error(`Fichier trop volumineux (max ${MAX_CSV_SIZE / 1024 / 1024} Mo)`);
      return;
    }
    if (!file.name.match(/\.(csv|txt)$/i)) {
      toast.error("Format de fichier non supporté. Utilisez .csv ou .txt");
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = parseCSV(text);
      if (rows.length > MAX_CSV_ROWS) {
        toast.warning(`Limité aux ${MAX_CSV_ROWS} premières lignes`);
        setParsed(rows.slice(0, MAX_CSV_ROWS));
      } else {
        setParsed(rows);
      }
    };
    reader.readAsText(file, "UTF-8");
  };

  const validRows = parsed.filter((r) => !r.error);
  const errorRows = parsed.filter((r) => r.error);

  const handleImport = () => {
    let count = 0;
    // Auto-add all unique categories from CSV
    const newCats = [...new Set(validRows.map((r) => r.category).filter(Boolean))];
    newCats.forEach((c) => addCategory(c));
    // Auto-add all unique presentation types from CSV
    const newTypes = [...new Set(validRows.map((r) => r.type).filter(Boolean))];
    newTypes.forEach((t) => addPresentationType(t));

    for (const row of validRows) {
      addArticle({
        code: row.code ? secureTrim(row.code, 64) : undefined,
        title: secureTrim(row.title, LIMITS.title),
        authors: secureTrim(row.authors, LIMITS.authors),
        moderator: secureTrim(row.moderator, LIMITS.moderator),
        sessionChair: secureTrim(row.sessionChair, LIMITS.sessionChair),
        abstract: secureTrim(row.abstract, LIMITS.abstract),
        category: secureTrim(row.category, LIMITS.category),
        duration: validateDuration(row.duration),
        type: row.type,
        status: row.status,
      });
      count++;
    }
    setParsed([]);
    setFileName("");
    onImported(count);
    onOpenChange(false);
  };

  const handleDownloadTemplate = () => {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modele_articles.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClose = (v: boolean) => {
    if (!v) { setParsed([]); setFileName(""); }
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <DialogTitle className="font-display">Importer des articles (CSV)</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 px-6 py-4 overflow-y-auto flex-1 min-h-0">
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border">
            <p className="text-sm text-muted-foreground">Téléchargez le modèle CSV pour connaître le format attendu</p>
            <Button variant="outline" size="sm" onClick={handleDownloadTemplate} className="gap-1 shrink-0">
              <Download className="h-3.5 w-3.5" />
              Modèle
            </Button>
          </div>

          <div
            onClick={() => fileRef.current?.click()}
            className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl p-8 cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
          >
            <Upload className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm font-medium text-foreground">{fileName || "Cliquez pour choisir un fichier CSV"}</p>
            <p className="text-xs text-muted-foreground mt-1">Formats supportés : .csv (séparateur , ou ;)</p>
            <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFile} className="hidden" />
          </div>

          {parsed.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                {validRows.length > 0 && (
                  <Badge variant="outline" className="bg-success/15 text-foreground border-success/30 gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    {validRows.length} valide{validRows.length > 1 ? "s" : ""}
                  </Badge>
                )}
                {errorRows.length > 0 && (
                  <Badge variant="outline" className="bg-destructive/15 text-destructive border-destructive/30 gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errorRows.length} erreur{errorRows.length > 1 ? "s" : ""}
                  </Badge>
                )}
              </div>

              {errorRows.length > 0 && (
                <div className="text-xs text-destructive space-y-1 p-2 bg-destructive/5 rounded-lg">
                  {errorRows.map((r, i) => <p key={i}>{r.error}</p>)}
                </div>
              )}

              {validRows.length > 0 && (
                <div className="max-h-48 overflow-y-auto border border-border rounded-lg divide-y divide-border">
                  {validRows.map((r, i) => (
                    <div key={i} className="px-3 py-2 text-sm flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">{r.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{r.authors} · {r.category} · {r.duration}min · {r.type}</p>
                      </div>
                      <Badge variant="outline" className="text-[10px] shrink-0 ml-2">
                        {r.status === "accepted" ? "Accepté" : r.status === "rejected" ? "Rejeté" : "Soumis"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border bg-background shrink-0">
          <Button variant="outline" onClick={() => handleClose(false)}>Annuler</Button>
          <Button
            onClick={handleImport}
            disabled={validRows.length === 0}
            className="gradient-accent text-accent-foreground gap-2"
          >
            <Upload className="h-4 w-4" />
            Importer {validRows.length > 0 ? `${validRows.length} article${validRows.length > 1 ? "s" : ""}` : ""}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ImportCsvDialog;
