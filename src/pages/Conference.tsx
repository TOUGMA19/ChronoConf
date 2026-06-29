import { useState, useMemo, useEffect, useCallback } from "react";
import { Plus, Calendar, Trash2, Zap, FileText, Users, Clock, Upload, Download, UserCheck, X, GraduationCap, Check, AlertTriangle, BarChart3, ChevronDown, ChevronUp, Mic, Pencil, Sun, Moon, Tag, Award, ShieldCheck, LogOut, Save, Cloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  getArticles, getSchedule, deleteArticle, generateScheduleLocally, getLastOverflowReport,
  clearSchedule, clearAllData, getCategories, addCategory, removeCategory, clearCategories,
  getModerators, addModerator, addModerators, removeModerator, clearModerators,
  getSessionChairs, addSessionChair, addSessionChairs, removeSessionChair, clearSessionChairs,
  getPresentationTypes, getOrganizers, Article, SpecialSlot, DayHours, loadFromBlob, exportBlob,
} from "@/lib/conference";
import OrganizersDialog from "@/components/OrganizersDialog";
import VerificationConfigDialog from "@/components/VerificationConfigDialog";
import AddArticleDialog from "@/components/AddArticleDialog";
import ScheduleGrid from "@/components/ScheduleGrid";
import ImportCsvDialog from "@/components/ImportCsvDialog";
import AddSpecialSlotDialog from "@/components/AddSpecialSlotDialog";
import EditSpecialSlotDialog from "@/components/EditSpecialSlotDialog";
import EditArticleDialog from "@/components/EditArticleDialog";
import PresentationTypesDialog from "@/components/PresentationTypesDialog";
import StatsDashboard from "@/components/StatsDashboard";
import { exportSchedulePDF, exportSchedulePDFByRoom, PdfExportOptions, DEFAULT_PDF_OPTIONS } from "@/lib/exportPdf";
import { exportScheduleDOCX } from "@/lib/exportDocx";
import { exportBookletPDF } from "@/lib/exportBooklet";
import { exportBadgesPDF, buildBadgesFromSchedule } from "@/lib/exportBadges";
import { BadgesConfigDialog } from "@/components/BadgesConfigDialog";
import CertificatesConfigDialog from "@/components/CertificatesConfigDialog";
import { buildRecipientsFromSchedule } from "@/lib/exportCertificates";
import { exportScheduleXLSX } from "@/lib/exportXlsx";
import { detectConflicts, Conflict, CONFLICT_LABEL } from "@/lib/conflicts";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import logoImg from "@/assets/logoo.png";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { saveProject, loadProject } from "@/lib/cloudStorage";
import { signOut } from "@/lib/auth";

const STATUS_BADGE: Record<string, string> = {
  submitted: "bg-warning/15 text-warning border-warning/30",
  accepted: "bg-success/15 text-foreground border-success/30",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
};
const STATUS_LABEL: Record<string, string> = {
  submitted: "Soumis", accepted: "Accepté", rejected: "Rejeté",
};

function parseTimeToFractional(time: string, fallback: number): number {
  const parts = time.split(":").map(Number);
  if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) return fallback;
  return parts[0] + parts[1] / 60;
}

interface ConferenceProps {
  projectSlug: string;
  projectName: string;
  userId: string;
  userEmail: string;
  onBack: () => void;
}

const Conference = ({ projectSlug, projectName, userId, userEmail, onBack }: ConferenceProps) => {
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("theme") === "dark" ||
        (!localStorage.getItem("theme") && window.matchMedia("(prefers-color-scheme: dark)").matches);
    }
    return false;
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem("theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  const [refreshKey, setRefreshKey] = useState(0);
  const [cloudSaving, setCloudSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [projectLoaded, setProjectLoaded] = useState(false);

  // Load cloud data on mount
  useEffect(() => {
    loadProject(projectSlug).then((blob) => {
      if (blob && Object.keys(blob).length > 0) {
        loadFromBlob(blob);
        setRefreshKey((k) => k + 1);
      }
      setProjectLoaded(true);
    }).catch((e) => {
      console.error("Erreur chargement cloud:", e);
      setProjectLoaded(true);
    });
  }, [projectSlug]);

  // Auto-save to cloud every 30s when data changes
  const cloudSave = useCallback(async (silent = false) => {
    setCloudSaving(true);
    try {
      const blob = exportBlob();
      await saveProject(projectSlug, projectName, blob);
      setLastSaved(new Date().toLocaleTimeString("fr-FR"));
      if (!silent) toast.success("Projet sauvegardé dans le cloud");
    } catch (e) {
      if (!silent) toast.error("Erreur sauvegarde : " + (e as Error).message);
    } finally {
      setCloudSaving(false);
    }
  }, [projectSlug, projectName]);

  useEffect(() => {
    if (!projectLoaded) return;
    const interval = setInterval(() => cloudSave(true), 30000);
    return () => clearInterval(interval);
  }, [projectLoaded, cloudSave]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [moderatorsDialogOpen, setModeratorsDialogOpen] = useState(false);
  const [categoriesDialogOpen, setCategoriesDialogOpen] = useState(false);
  const [chairsDialogOpen, setChairsDialogOpen] = useState(false);
  const [organizersDialogOpen, setOrganizersDialogOpen] = useState(false);
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
  const [typesDialogOpen, setTypesDialogOpen] = useState(false);
  const [pdfOptionsOpen, setPdfOptionsOpen] = useState(false);
  const [pdfExportTarget, setPdfExportTarget] = useState<"linear" | "byRoom" | "docx">("linear");
  const [specialSlotOpen, setSpecialSlotOpen] = useState(false);
  const [badgesConfigOpen, setBadgesConfigOpen] = useState(false);
  const [certificatesOpen, setCertificatesOpen] = useState(false);
  const [editArticle, setEditArticle] = useState<Article | null>(null);
  const [editSpecialSlot, setEditSpecialSlot] = useState<SpecialSlot | null>(null);
  const [pdfOptions, setPdfOptions] = useState<PdfExportOptions>(DEFAULT_PDF_OPTIONS);
  const [customLogoDataUrl, setCustomLogoDataUrl] = useState<string | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [selectedDay, setSelectedDay] = useState(0);

  const [confName, setConfName] = useState(projectName);
  const [confDays, setConfDays] = useState("2");
  const [confRooms, setConfRooms] = useState("Salle A, Salle B, Salle C");
  const [confStart, setConfStart] = useState("08:00");
  const [confEnd, setConfEnd] = useState("18:00");
  const [perDayHours, setPerDayHours] = useState<{ start: string; end: string }[]>([]);
  const [confBreak, setConfBreak] = useState("10");
  const [lunchStart, setLunchStart] = useState("12:00");
  const [lunchEnd, setLunchEnd] = useState("13:30");

  const numDays = parseInt(confDays) || 1;
  const dayHoursConfig = Array.from({ length: numDays }, (_, i) => perDayHours[i] || { start: confStart, end: confEnd });

  const [newModerator, setNewModerator] = useState("");
  const [newChair, setNewChair] = useState("");
  const [moderatorThemeMap, setModeratorThemeMap] = useState<Record<string, string[]>>({});
  const [chairThemeMap, setChairThemeMap] = useState<Record<string, string[]>>({});
  const [chairRoomMap, setChairRoomMap] = useState<Record<string, string[]>>({});
  const [themeRoomMap, setThemeRoomMap] = useState<Record<string, string>>({});
  const [resetModerators, setResetModerators] = useState(true);
  const [resetChairs, setResetChairs] = useState(true);

  const articles = useMemo(() => getArticles(), [refreshKey]);
  const schedule = useMemo(() => getSchedule(), [refreshKey]);
  const moderatorsList = useMemo(() => getModerators(), [refreshKey]);
  const categoriesList = useMemo(() => getCategories(), [refreshKey]);
  const chairsList = useMemo(() => getSessionChairs(), [refreshKey]);
  const organizersList = useMemo(() => getOrganizers(), [refreshKey]);
  const filtered = useMemo(() => {
    let list = articles;
    if (filterCategory !== "all") list = list.filter((a) => a.category === filterCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((a) => a.title.toLowerCase().includes(q) || a.authors.toLowerCase().includes(q));
    }
    return list;
  }, [articles, filterCategory, search]);

  const presentationTypesList = useMemo(() => getPresentationTypes(), [refreshKey]);
  const stats = useMemo(() => ({
    total: articles.length,
    accepted: articles.filter((a) => a.status === "accepted").length,
    typeCounts: presentationTypesList.map((t) => ({
      type: t,
      count: articles.filter((a) => a.type === t && a.status === "accepted").length,
    })),
  }), [articles, presentationTypesList]);

  const conflicts = useMemo(() => {
    if (!schedule) return [];
    return detectConflicts(schedule, articles);
  }, [schedule, articles]);

  const handleDelete = (id: string) => {
    deleteArticle(id);
    setRefreshKey((k) => k + 1);
    toast.success("Article supprimé");
  };

  const handleGenerate = () => {
    const accepted = articles.filter((a) => a.status === "accepted");
    if (accepted.length === 0) { toast.error("Aucun article accepté à planifier"); return; }
    const rooms = confRooms.split(",").map((r) => r.trim()).filter(Boolean);
    if (rooms.length === 0) { toast.error("Ajoutez au moins une salle"); return; }
    const dayHoursArray: DayHours[] = dayHoursConfig.map((dh) => ({
      startHour: parseTimeToFractional(dh.start, 8),
      endHour: parseTimeToFractional(dh.end, 18),
    }));
    generateScheduleLocally(articles, {
      name: confName,
      days: parseInt(confDays) || 1,
      rooms,
      startHour: parseTimeToFractional(confStart, 8),
      endHour: parseTimeToFractional(confEnd, 18),
      dayHours: dayHoursArray,
      breakMinutes: parseInt(confBreak) || 10,
      lunchStart, lunchEnd,
      moderatorsList: moderatorsList.length > 0 ? moderatorsList : undefined,
      moderatorThemeMap: Object.keys(moderatorThemeMap).length > 0 ? moderatorThemeMap : undefined,
      resetModerators,
      chairsList: chairsList.length > 0 ? chairsList : undefined,
      chairThemeMap: Object.keys(chairThemeMap).length > 0 ? chairThemeMap : undefined,
      chairRoomMap: Object.keys(chairRoomMap).length > 0 ? chairRoomMap : undefined,
      resetChairs,
      themeRoomMap: Object.keys(themeRoomMap).length > 0 ? themeRoomMap : undefined,
    });
    setSelectedDay(0);
    setRefreshKey((k) => k + 1);
    toast.success(`Chronogramme généré avec ${accepted.length} présentations`);
    const overflows = getLastOverflowReport();
    if (overflows.length > 0) {
      overflows.forEach((o) => {
        toast.info(
          `Thématique "${o.theme}" : ${o.overflowCount} présentation(s) déplacée(s) hors de "${o.preferredRoom}" (vers ${o.overflowRooms.join(", ")}) faute de place.`,
          { duration: 7000 }
        );
      });
    }
  };

  const handleClear = () => { clearSchedule(); setRefreshKey((k) => k + 1); toast.success("Chronogramme effacé"); };
  const handleClearAll = () => {
    if (!window.confirm("Effacer toutes les données de ce projet ? Action irréversible.")) return;
    clearAllData(); setRefreshKey((k) => k + 1); toast.success("Données effacées");
  };
  const handleAddModerator = () => { if (!newModerator.trim()) return; addModerator(newModerator); setNewModerator(""); setRefreshKey((k) => k + 1); };
  const handleImportModerators = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split(/[\r\n]+/).map((l) => l.trim()).filter(Boolean);
      const start = /^(nom|name|modérateur|moderator)/i.test(lines[0]) ? 1 : 0;
      const names = lines.slice(start).map((l) => l.split(/[;,\t]/)[0].trim().replace(/^["']|["']$/g, "")).filter(Boolean);
      const count = addModerators(names);
      setRefreshKey((k) => k + 1);
      toast.success(`${count} modérateur${count > 1 ? "s" : ""} importé${count > 1 ? "s" : ""}`);
    };
    reader.readAsText(file); e.target.value = "";
  };
  const handleRemoveModerator = (name: string) => { removeModerator(name); setRefreshKey((k) => k + 1); };
  const handleClearModerators = () => { clearModerators(); setRefreshKey((k) => k + 1); toast.success("Modérateurs vidés"); };
  const handleAddChair = () => { if (!newChair.trim()) return; addSessionChair(newChair); setNewChair(""); setRefreshKey((k) => k + 1); };
  const handleImportChairs = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split(/[\r\n]+/).map((l) => l.trim()).filter(Boolean);
      const start = /^(nom|name|président|president|chair)/i.test(lines[0]) ? 1 : 0;
      const names = lines.slice(start).map((l) => l.split(/[;,\t]/)[0].trim().replace(/^["']|["']$/g, "")).filter(Boolean);
      const count = addSessionChairs(names);
      setRefreshKey((k) => k + 1);
      toast.success(`${count} président${count > 1 ? "s" : ""} importé${count > 1 ? "s" : ""}`);
    };
    reader.readAsText(file); e.target.value = "";
  };
  const handleRemoveChair = (name: string) => { removeSessionChair(name); setRefreshKey((k) => k + 1); };
  const handleClearChairs = () => { clearSessionChairs(); setRefreshKey((k) => k + 1); toast.success("Présidents vidés"); };

  if (!projectLoaded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground font-display">Chargement du projet…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur-md shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoImg} alt="Logo" className="h-14 w-14 object-contain" />
            <div>
              <h1 className="text-xl font-display font-bold text-foreground">
                <span className="text-accent">Chrono</span>Conf
              </h1>
              <p className="text-sm text-muted-foreground">{projectName} · <span className="text-xs">{userEmail}</span></p>
            </div>
          </div>
          <div className="flex gap-2 items-center flex-wrap justify-end">
            <Button variant="ghost" size="icon" onClick={() => setDarkMode(!darkMode)} className="rounded-full" title={darkMode ? "Mode clair" : "Mode sombre"}>
              {darkMode ? <Sun className="h-5 w-5 text-warning" /> : <Moon className="h-5 w-5 text-muted-foreground" />}
            </Button>
            {/* Cloud save */}
            <Button variant="outline" onClick={() => cloudSave(false)} disabled={cloudSaving} className="gap-2" title="Sauvegarder maintenant">
              {cloudSaving ? <Cloud className="h-4 w-4 animate-pulse" /> : <Save className="h-4 w-4" />}
              <span className="hidden sm:inline">{cloudSaving ? "Sauvegarde…" : lastSaved ? `Sauvé ${lastSaved}` : "Sauvegarder"}</span>
            </Button>
            <Button variant="outline" onClick={() => setCategoriesDialogOpen(true)} className="gap-2">
              <FileText className="h-4 w-4" /><span className="hidden sm:inline">Thématiques ({categoriesList.length})</span>
            </Button>
            <Button variant="outline" onClick={() => setModeratorsDialogOpen(true)} className="gap-2">
              <UserCheck className="h-4 w-4" /><span className="hidden sm:inline">Modérateurs ({moderatorsList.length})</span>
            </Button>
            <Button variant="outline" onClick={() => setChairsDialogOpen(true)} className="gap-2">
              <GraduationCap className="h-4 w-4" /><span className="hidden sm:inline">Présidents ({chairsList.length})</span>
            </Button>
            <Button variant="outline" onClick={() => setOrganizersDialogOpen(true)} className="gap-2">
              <Users className="h-4 w-4" /><span className="hidden sm:inline">Organisateurs ({organizersList.length})</span>
            </Button>
            <Button variant="outline" onClick={() => setVerifyDialogOpen(true)} className="gap-2">
              <ShieldCheck className="h-4 w-4" /><span className="hidden sm:inline">Vérification</span>
            </Button>
            <Button variant="outline" onClick={() => setTypesDialogOpen(true)} className="gap-2">
              <Tag className="h-4 w-4" /><span className="hidden sm:inline">Types ({presentationTypesList.length})</span>
            </Button>
            <Button variant="outline" onClick={() => setImportOpen(true)} className="gap-2">
              <Upload className="h-4 w-4" /><span className="hidden sm:inline">Importer CSV</span>
            </Button>
            <Button onClick={() => setDialogOpen(true)} className="gradient-accent text-accent-foreground gap-2">
              <Plus className="h-4 w-4" /><span className="hidden sm:inline">Soumettre un article</span>
            </Button>
            <Button variant="ghost" size="icon" onClick={onBack} title="Changer de projet" className="rounded-full">
              <LogOut className="h-4 w-4 rotate-180" />
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { icon: FileText, label: "Total soumis", value: stats.total, color: "text-primary" },
            { icon: Users, label: "Acceptés", value: stats.accepted, color: "text-foreground" },
            ...stats.typeCounts.slice(0, 2).map((tc, i) => ({
              icon: i === 0 ? Calendar : Clock,
              label: tc.type.charAt(0).toUpperCase() + tc.type.slice(1),
              value: tc.count,
              color: i === 0 ? "text-accent" : "text-muted-foreground",
            })),
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="bg-card border border-border rounded-xl p-4 shadow-card">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
                <div>
                  <p className="text-2xl font-display font-bold text-foreground">{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {articles.length > 0 && (
          <Button variant="outline" onClick={() => setShowStats((v) => !v)} className="gap-2 w-full sm:w-auto">
            <BarChart3 className="h-4 w-4" />
            {showStats ? "Masquer les statistiques" : "Afficher les statistiques détaillées"}
            {showStats ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        )}

        {showStats && <StatsDashboard articles={articles} schedule={schedule} />}

        {conflicts.length > 0 && (() => {
          const errors = conflicts.filter((c) => c.severity === "error");
          const warnings = conflicts.filter((c) => c.severity === "warning");
          const infos = conflicts.filter((c) => c.severity === "info");
          const headerColor = errors.length > 0 ? "destructive" : warnings.length > 0 ? "warning" : "primary";
          return (
            <div className={cn("rounded-xl p-4 space-y-3 border",
              headerColor === "destructive" && "bg-destructive/5 border-destructive/20",
              headerColor === "warning" && "bg-warning/5 border-warning/20",
              headerColor === "primary" && "bg-primary/5 border-primary/20")}>
              <h3 className={cn("font-display font-semibold flex items-center gap-2 flex-wrap",
                headerColor === "destructive" && "text-destructive",
                headerColor === "warning" && "text-warning",
                headerColor === "primary" && "text-primary")}>
                <AlertTriangle className="h-5 w-5" />
                Analyse du programme
                {errors.length > 0 && <Badge variant="outline" className="border-destructive/50 text-destructive text-xs">{errors.length} erreur{errors.length > 1 ? "s" : ""}</Badge>}
                {warnings.length > 0 && <Badge variant="outline" className="border-warning/50 text-warning text-xs">{warnings.length} avertissement{warnings.length > 1 ? "s" : ""}</Badge>}
                {infos.length > 0 && <Badge variant="outline" className="border-primary/50 text-primary text-xs">{infos.length} info{infos.length > 1 ? "s" : ""}</Badge>}
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {[...errors, ...warnings, ...infos].map((c, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <Badge variant="outline" className={cn("shrink-0 text-[10px]",
                      c.severity === "error" && "border-destructive/50 text-destructive",
                      c.severity === "warning" && "border-warning/50 text-warning",
                      c.severity === "info" && "border-primary/50 text-primary")}>
                      {CONFLICT_LABEL[c.type]}
                    </Badge>
                    <p className="text-foreground/80">{c.message}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        <div className="bg-card border border-border rounded-xl shadow-card">
          <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <h2 className="font-display font-semibold text-foreground">Articles soumis</h2>
            <div className="flex gap-2 w-full sm:w-auto">
              <Input placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full sm:w-48" />
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-40"><SelectValue placeholder="Catégorie" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes</SelectItem>
                  {categoriesList.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {filtered.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>Aucun article soumis</p>
              <p className="text-xs mt-1">Commencez par ajouter des articles</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((a) => (
                <ArticleRow key={a.id} article={a} onDelete={handleDelete} onEdit={(a) => setEditArticle(a)} />
              ))}
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl shadow-card p-6 space-y-4">
          <h2 className="font-display font-semibold text-foreground flex items-center gap-2">
            <Zap className="h-5 w-5 text-accent" />Générer le chronogramme
          </h2>
          {moderatorsList.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <UserCheck className="h-4 w-4" />
              {moderatorsList.length} modérateur{moderatorsList.length > 1 ? "s" : ""} seront assignés automatiquement
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2"><Label>Nom de la conférence</Label><Input value={confName} onChange={(e) => setConfName(e.target.value)} /></div>
            <div className="space-y-2"><Label>Nombre de jours</Label><Input type="number" min="1" max="7" value={confDays} onChange={(e) => setConfDays(e.target.value)} /></div>
            <div className="space-y-2"><Label>Salles (séparées par des virgules)</Label><Input value={confRooms} onChange={(e) => setConfRooms(e.target.value)} placeholder="Salle A, Salle B" /></div>
            <div className="space-y-2"><Label>Heure de début (par défaut)</Label><Input type="time" value={confStart} onChange={(e) => setConfStart(e.target.value)} /></div>
            <div className="space-y-2"><Label>Heure de fin (par défaut)</Label><Input type="time" value={confEnd} onChange={(e) => setConfEnd(e.target.value)} /></div>
            <div className="space-y-2"><Label>Pause entre communications (min)</Label><Input type="number" min="0" max="60" value={confBreak} onChange={(e) => setConfBreak(e.target.value)} /></div>
            <div className="space-y-2"><Label>Début pause déjeuner</Label><Input type="time" value={lunchStart} onChange={(e) => setLunchStart(e.target.value)} /></div>
            <div className="space-y-2"><Label>Fin pause déjeuner</Label><Input type="time" value={lunchEnd} onChange={(e) => setLunchEnd(e.target.value)} /></div>
          </div>
          {numDays > 1 && (
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Horaires par jour <span className="text-muted-foreground font-normal">(laisser vide = horaires par défaut)</span></Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {Array.from({ length: numDays }, (_, i) => {
                  const dh = perDayHours[i];
                  return (
                    <div key={i} className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border">
                      <span className="text-sm font-medium text-foreground whitespace-nowrap">Jour {i + 1}</span>
                      <Input type="time" value={dh?.start || ""} placeholder={confStart} onChange={(e) => { const u = [...perDayHours]; u[i] = { start: e.target.value, end: u[i]?.end || "" }; setPerDayHours(u); }} className="w-28" />
                      <span className="text-muted-foreground">→</span>
                      <Input type="time" value={dh?.end || ""} placeholder={confEnd} onChange={(e) => { const u = [...perDayHours]; u[i] = { start: u[i]?.start || "", end: e.target.value }; setPerDayHours(u); }} className="w-28" />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Checkbox id="resetModerators" checked={resetModerators} onCheckedChange={(c) => setResetModerators(c === true)} />
            <Label htmlFor="resetModerators" className="text-sm cursor-pointer">Réinitialiser les modérateurs existants lors de la génération</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="resetChairs" checked={resetChairs} onCheckedChange={(c) => setResetChairs(c === true)} />
            <Label htmlFor="resetChairs" className="text-sm cursor-pointer">Réinitialiser les présidents de séance existants lors de la génération</Label>
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={handleGenerate} className="gradient-accent text-accent-foreground gap-2"><Zap className="h-4 w-4" />Générer le chronogramme</Button>
            {schedule && <Button variant="outline" onClick={handleClear}>Effacer le chronogramme</Button>}
            <Button variant="destructive" onClick={handleClearAll} className="gap-2"><Trash2 className="h-4 w-4" />Tout effacer</Button>
          </div>
        </div>

        {schedule && (
          <div className="bg-card border border-border rounded-xl shadow-card">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h2 className="font-display font-semibold text-foreground flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />{schedule.name}
              </h2>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex gap-1">
                  {Array.from({ length: schedule.days }, (_, i) => (
                    <Button key={i} size="sm" variant={selectedDay === i ? "default" : "outline"} onClick={() => setSelectedDay(i)} className={selectedDay === i ? "gradient-primary text-primary-foreground" : ""}>
                      Jour {i + 1}
                    </Button>
                  ))}
                </div>
                <Button size="sm" variant="outline" onClick={() => setSpecialSlotOpen(true)} className="gap-1"><Mic className="h-3.5 w-3.5" />Créneau spécial</Button>
                <Button size="sm" variant="outline" onClick={() => { setPdfExportTarget("linear"); setPdfOptionsOpen(true); }} className="gap-1"><Download className="h-3.5 w-3.5" />PDF</Button>
                <Button size="sm" variant="outline" onClick={() => { const s = getSchedule(); if (!s) return; exportBookletPDF(s, getArticles(), customLogoDataUrl || undefined); toast.success("Livret PDF généré !"); }} className="gap-1"><FileText className="h-3.5 w-3.5" />Livret</Button>
                <Button size="sm" variant="outline" onClick={() => { if (!schedule) return; const b = buildBadgesFromSchedule(schedule, articles); if (!b.length) { toast.error("Aucun intervenant"); return; } setBadgesConfigOpen(true); }} className="gap-1"><UserCheck className="h-3.5 w-3.5" />Badges</Button>
                <Button size="sm" variant="outline" onClick={() => { if (!schedule) return; const r = buildRecipientsFromSchedule(schedule, articles); if (!r.length) { toast.error("Aucun destinataire"); return; } setCertificatesOpen(true); }} className="gap-1"><Award className="h-3.5 w-3.5" />Attestations</Button>
                <Button size="sm" variant="outline" onClick={() => { if (!schedule) return; exportScheduleXLSX(schedule, articles); toast.success("Export Excel généré !"); }} className="gap-1"><Download className="h-3.5 w-3.5" />Excel</Button>
              </div>
            </div>
            <div className="p-4">
              <ScheduleGrid schedule={schedule} articles={articles} selectedDay={selectedDay} onSlotMoved={() => setRefreshKey((k) => k + 1)} onEditSpecialSlot={(slot) => setEditSpecialSlot(slot)} onSelectDay={(d) => setSelectedDay(d)} />
            </div>
          </div>
        )}
      </div>

      <AddArticleDialog open={dialogOpen} onOpenChange={setDialogOpen} onAdded={() => { setRefreshKey((k) => k + 1); toast.success("Article ajouté !"); }} />
      <ImportCsvDialog open={importOpen} onOpenChange={setImportOpen} onImported={(n) => { setRefreshKey((k) => k + 1); toast.success(`${n} article${n > 1 ? "s" : ""} importé${n > 1 ? "s" : ""} !`); }} />
      {schedule && <AddSpecialSlotDialog open={specialSlotOpen} onOpenChange={setSpecialSlotOpen} schedule={schedule} onAdded={() => setRefreshKey((k) => k + 1)} />}
      {schedule && <EditSpecialSlotDialog open={!!editSpecialSlot} onOpenChange={(open) => { if (!open) setEditSpecialSlot(null); }} schedule={schedule} slot={editSpecialSlot} onUpdated={() => setRefreshKey((k) => k + 1)} />}
      <EditArticleDialog open={!!editArticle} onOpenChange={(open) => { if (!open) setEditArticle(null); }} article={editArticle} onUpdated={() => setRefreshKey((k) => k + 1)} />
      <PresentationTypesDialog open={typesDialogOpen} onOpenChange={setTypesDialogOpen} onChanged={() => setRefreshKey((k) => k + 1)} />
      <OrganizersDialog open={organizersDialogOpen} onOpenChange={setOrganizersDialogOpen} onChanged={() => setRefreshKey((k) => k + 1)} />
      <VerificationConfigDialog open={verifyDialogOpen} onOpenChange={setVerifyDialogOpen} conferenceId={projectSlug} />

      {schedule && (
        <BadgesConfigDialog
          open={badgesConfigOpen} onOpenChange={setBadgesConfigOpen}
          badges={[...buildBadgesFromSchedule(schedule, articles), ...organizersList.filter((o) => !buildBadgesFromSchedule(schedule, articles).some((b) => b.name.toLowerCase() === o.name.toLowerCase())).map((o) => ({ name: o.name, role: "organizer" as const, affiliation: o.role || undefined }))]}
          conferenceName={schedule.name} customLogoDataUrl={customLogoDataUrl || undefined}
          onGenerate={async (opts, customizedBadges) => {
            try { await exportBadgesPDF(schedule, customizedBadges, { ...opts, customLogoDataUrl: customLogoDataUrl || undefined }); toast.success(`${customizedBadges.length} badges générés !`); }
            catch (e) { console.error(e); toast.error("Erreur lors de la génération des badges"); }
          }}
        />
      )}
      {schedule && (
        <CertificatesConfigDialog
          open={certificatesOpen} onOpenChange={setCertificatesOpen}
          recipients={[...buildRecipientsFromSchedule(schedule, articles), ...organizersList.filter((o) => !buildRecipientsFromSchedule(schedule, articles).some((r) => r.name.toLowerCase() === o.name.toLowerCase())).map((o) => ({ name: o.name, role: "organizer" as const, affiliation: o.role || undefined }))]}
          conferenceName={schedule.name} customLogoDataUrl={customLogoDataUrl || undefined}
        />
      )}

      {/* Moderators Dialog */}
      <Dialog open={moderatorsDialogOpen} onOpenChange={setModeratorsDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gestion des modérateurs</DialogTitle>
            <DialogDescription>Ajoutez des modérateurs et assignez-les à des thématiques spécifiques.</DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Ajouter un modérateur</Label>
              <div className="flex gap-2">
                <Input placeholder="Nom du modérateur" value={newModerator} onChange={(e) => setNewModerator(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleAddModerator(); }} />
                <Button onClick={handleAddModerator} size="sm" className="shrink-0"><Plus className="h-4 w-4" /></Button>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="gap-2 w-full" asChild>
                <label><Upload className="h-4 w-4" />Importer depuis un fichier (CSV/TXT)<input type="file" accept=".csv,.txt" className="hidden" onChange={handleImportModerators} /></label>
              </Button>
            </div>
            {moderatorsList.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Aucun modérateur ajouté</p>
            ) : (
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {moderatorsList.map((m) => (
                  <div key={m} className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/50">
                    <span className="text-sm text-foreground">{m}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleRemoveModerator(m)}><X className="h-3.5 w-3.5" /></Button>
                  </div>
                ))}
              </div>
            )}
            {moderatorsList.length > 0 && <Button variant="outline" size="sm" onClick={handleClearModerators} className="w-full text-destructive hover:text-destructive">Vider la liste</Button>}
            {moderatorsList.length > 0 && (
              <div className="space-y-3 border-t border-border pt-4">
                <Label className="text-sm font-medium flex items-center gap-2"><UserCheck className="h-4 w-4 text-accent" />Assignation par thématique</Label>
                <div className="space-y-3">
                  {categoriesList.map((cat) => {
                    const assigned = moderatorThemeMap[cat] || [];
                    return (
                      <div key={cat} className="space-y-1.5">
                        <p className="text-sm font-medium text-foreground">{cat}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {moderatorsList.map((mod) => {
                            const isSelected = assigned.includes(mod);
                            return (
                              <Badge key={mod} variant="outline" className={cn("cursor-pointer transition-colors text-xs", isSelected ? "bg-accent/15 border-accent/50 text-accent hover:bg-accent/25" : "bg-muted/30 border-border text-muted-foreground hover:bg-muted/50")}
                                onClick={() => setModeratorThemeMap((prev) => { const current = prev[cat] || []; const next = isSelected ? current.filter((m) => m !== mod) : [...current, mod]; return { ...prev, [cat]: next }; })}>
                                {mod}
                              </Badge>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="pt-4 border-t border-border">
              <Button onClick={() => { setModeratorsDialogOpen(false); toast.success("Modérateurs validés"); }} className="w-full gap-2 gradient-accent text-accent-foreground"><Check className="h-4 w-4" />Valider</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Categories Dialog */}
      <Dialog open={categoriesDialogOpen} onOpenChange={setCategoriesDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gestion des thématiques / axes</DialogTitle>
            <DialogDescription>Définissez les thématiques de votre conférence.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Ajouter une thématique</Label>
              <div className="flex gap-2">
                <Input placeholder="Nom de la thématique" value={newCategory} onChange={(e) => setNewCategory(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (newCategory.trim()) { addCategory(newCategory.trim()); setNewCategory(""); setRefreshKey((k) => k + 1); } } }} />
                <Button onClick={() => { if (newCategory.trim()) { addCategory(newCategory.trim()); setNewCategory(""); setRefreshKey((k) => k + 1); } }} size="sm" className="shrink-0"><Plus className="h-4 w-4" /></Button>
              </div>
            </div>
            {categoriesList.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Aucune thématique définie.</p>
            ) : (
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {categoriesList.map((c) => (
                  <div key={c} className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/50">
                    <span className="text-sm text-foreground">{c}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => { removeCategory(c); setRefreshKey((k) => k + 1); }}><X className="h-3.5 w-3.5" /></Button>
                  </div>
                ))}
              </div>
            )}
            {categoriesList.length > 0 && <Button variant="outline" size="sm" onClick={() => { clearCategories(); setRefreshKey((k) => k + 1); toast.success("Thématiques vidées"); }} className="w-full text-destructive hover:text-destructive">Vider la liste</Button>}
            <div className="pt-4 border-t border-border">
              <Button onClick={() => { setCategoriesDialogOpen(false); toast.success("Thématiques validées"); }} className="w-full gap-2 gradient-accent text-accent-foreground"><Check className="h-4 w-4" />Valider</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Session Chairs Dialog */}
      <Dialog open={chairsDialogOpen} onOpenChange={setChairsDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gestion des présidents de séance</DialogTitle>
            <DialogDescription>Ajoutez les présidents de séance et assignez-les à des thématiques.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Ajouter un président de séance</Label>
              <div className="flex gap-2">
                <Input placeholder="Nom du président de séance" value={newChair} onChange={(e) => setNewChair(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleAddChair(); }} />
                <Button onClick={handleAddChair} size="sm" className="shrink-0"><Plus className="h-4 w-4" /></Button>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="gap-2 w-full" asChild>
                <label><Upload className="h-4 w-4" />Importer depuis un fichier (CSV/TXT)<input type="file" accept=".csv,.txt" className="hidden" onChange={handleImportChairs} /></label>
              </Button>
            </div>
            {chairsList.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Aucun président ajouté</p>
            ) : (
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {chairsList.map((c) => (
                  <div key={c} className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/50">
                    <span className="text-sm text-foreground">{c}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleRemoveChair(c)}><X className="h-3.5 w-3.5" /></Button>
                  </div>
                ))}
              </div>
            )}
            {chairsList.length > 0 && <Button variant="outline" size="sm" onClick={handleClearChairs} className="w-full text-destructive hover:text-destructive">Vider la liste</Button>}
            <div className="pt-4 border-t border-border">
              <Button onClick={() => { setChairsDialogOpen(false); toast.success("Présidents validés"); }} className="w-full gap-2 gradient-accent text-accent-foreground"><Check className="h-4 w-4" />Valider</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* PDF / DOCX Export Dialog */}
      <Dialog open={pdfOptionsOpen} onOpenChange={setPdfOptionsOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{pdfExportTarget === "docx" ? "Options d'export DOCX" : pdfExportTarget === "byRoom" ? "PDF par salle" : "Options d'export PDF"}</DialogTitle>
            <DialogDescription>{pdfExportTarget === "byRoom" ? "Une page par salle." : "Choisissez les colonnes et le format."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div className="space-y-3">
              <Label className="text-sm font-medium">Cible d'export</Label>
              <Select value={pdfExportTarget} onValueChange={(v) => setPdfExportTarget(v as "linear" | "byRoom" | "docx")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="linear">PDF — chronogramme global</SelectItem>
                  <SelectItem value="byRoom">PDF — une page par salle</SelectItem>
                  <SelectItem value="docx">DOCX — document Word éditable</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-3 border-t border-border pt-4">
              <Label className="text-sm font-medium">Colonnes à afficher</Label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(pdfOptions.columns) as Array<keyof typeof pdfOptions.columns>).map((key) => {
                  const labels: Record<string, string> = { horaire: "Horaire", salle: "Salle", thematique: "Thématique", titre: "Titre", auteurs: "Auteurs", moderateur: "Modérateur", president: "Président de séance", type: "Type" };
                  const disabled = pdfExportTarget === "byRoom" && key === "salle";
                  return (
                    <div key={key} className="flex items-center gap-2">
                      <Checkbox id={`pdf-col-${key}`} disabled={disabled} checked={pdfOptions.columns[key]} onCheckedChange={(checked) => { setPdfOptions((prev) => ({ ...prev, columns: { ...prev.columns, [key]: checked === true } })); }} />
                      <Label htmlFor={`pdf-col-${key}`} className={cn("text-sm cursor-pointer", disabled && "opacity-50")}>{labels[key]}{disabled ? " (implicite)" : ""}</Label>
                    </div>
                  );
                })}
              </div>
            </div>
            {pdfExportTarget === "linear" && (
              <div className="space-y-3 border-t border-border pt-4">
                <Label className="text-sm font-medium">Organisation</Label>
                <div className="flex items-center justify-between">
                  <div><p className="text-sm text-foreground">Regrouper par blocs thématiques</p><p className="text-xs text-muted-foreground">Le président de séance sera affiché en en-tête</p></div>
                  <Switch checked={pdfOptions.groupByTheme} onCheckedChange={(checked) => setPdfOptions((prev) => ({ ...prev, groupByTheme: checked }))} />
                </div>
              </div>
            )}
            <div className="space-y-3 border-t border-border pt-4">
              <Label className="text-sm font-medium">Format</Label>
              <div className="flex items-center justify-between">
                <p className="text-sm text-foreground">Orientation du document</p>
                <Select value={pdfOptions.orientation} onValueChange={(v) => setPdfOptions((prev) => ({ ...prev, orientation: v as "landscape" | "portrait" }))}>
                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="landscape">Paysage</SelectItem><SelectItem value="portrait">Portrait</SelectItem></SelectContent>
                </Select>
              </div>
              {pdfExportTarget !== "docx" && (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-foreground">Inclure le logo</p>
                    <Switch checked={pdfOptions.showLogo} onCheckedChange={(checked) => setPdfOptions((prev) => ({ ...prev, showLogo: checked }))} />
                  </div>
                  {pdfOptions.showLogo && (
                    <div className="space-y-2 pt-2">
                      <Label className="text-sm">Logo personnalisé</Label>
                      {customLogoDataUrl ? (
                        <div className="flex items-center gap-3">
                          <img src={customLogoDataUrl} alt="Logo" className="h-10 w-10 object-contain rounded border border-border" />
                          <Button variant="outline" size="sm" onClick={() => setCustomLogoDataUrl(null)}>Supprimer</Button>
                        </div>
                      ) : (
                        <Button variant="outline" size="sm" className="gap-2 w-full" asChild>
                          <label><Upload className="h-4 w-4" />Charger un logo (PNG/JPG)<input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = (ev) => { setCustomLogoDataUrl(ev.target?.result as string); toast.success("Logo chargé"); }; reader.readAsDataURL(file); e.target.value = ""; }} /></label>
                        </Button>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
            <Button onClick={() => {
              const s = getSchedule(); if (!s) return;
              const arts = getArticles();
              if (pdfExportTarget === "docx") { exportScheduleDOCX(s, arts, pdfOptions, customLogoDataUrl || undefined); toast.success("Document Word généré !"); }
              else if (pdfExportTarget === "byRoom") { exportSchedulePDFByRoom(s, arts, pdfOptions, customLogoDataUrl || undefined); toast.success("PDF par salle exporté !"); }
              else { exportSchedulePDF(s, arts, pdfOptions, customLogoDataUrl || undefined); toast.success("PDF exporté !"); }
              setPdfOptionsOpen(false);
            }} className="w-full gap-2 gradient-accent text-accent-foreground">
              <Download className="h-4 w-4" />{pdfExportTarget === "docx" ? "Exporter le DOCX" : "Exporter le PDF"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const ArticleRow = ({ article, onDelete, onEdit }: { article: Article; onDelete: (id: string) => void; onEdit: (a: Article) => void }) => (
  <div className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
    <div className="min-w-0 flex-1 cursor-pointer" onClick={() => onEdit(article)}>
      <div className="flex items-center gap-2 mb-1">
        <p className="font-medium text-foreground truncate">{article.title}</p>
        <Badge variant="outline" className={STATUS_BADGE[article.status]}>{STATUS_LABEL[article.status]}</Badge>
        <Badge variant="outline" className="text-xs capitalize">{article.type || "—"}</Badge>
      </div>
      <p className="text-sm text-muted-foreground truncate">{article.authors}{article.moderator ? ` · Mod: ${article.moderator}` : ""}{article.sessionChair ? ` · Prés: ${article.sessionChair}` : ""} · {article.category} · {article.duration} min</p>
    </div>
    <div className="flex items-center gap-1 ml-2">
      <Button variant="ghost" size="icon" onClick={() => onEdit(article)} className="text-muted-foreground hover:text-primary"><Pencil className="h-4 w-4" /></Button>
      <Button variant="ghost" size="icon" onClick={() => onDelete(article.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
    </div>
  </div>
);

export default Conference;
