import { useState, useMemo, useEffect } from "react";
import QRCode from "qrcode";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { X, Upload, UserCheck, Eye, Palette, Shapes, Users, Search, QrCode, Scissors } from "lucide-react";
import {
  THEME_LABEL,
  SHAPE_LABEL,
  THEME_KEYS,
  SHAPE_KEYS,
  DECORATION_LABEL,
  DECORATION_KEYS,
  getThemeSwatch,
  getShapeFamily,
  buildQrPayload,
  type BadgeExportOptions,
  type BadgeEntry,
  type BadgeRole,
  type BadgeTheme,
  type BadgeShape,
  type BadgeDecoration,
} from "@/lib/exportBadges";

interface BadgesConfigDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onGenerate: (options: BadgeExportOptions, customizedBadges: BadgeEntry[]) => void;
  badges: BadgeEntry[];
  conferenceName: string;
  customLogoDataUrl?: string;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

interface RoleStyle { value: BadgeRole; label: string; color: string; bg: string }

const ROLE_OPTIONS: RoleStyle[] = [
  { value: "speaker",     label: "Intervenant",        color: "rgb(29,78,216)",  bg: "rgb(219,234,254)" },
  { value: "moderator",   label: "Modérateur",         color: "rgb(21,128,61)",  bg: "rgb(220,252,231)" },
  { value: "chair",       label: "Président de séance",color: "rgb(126,34,206)", bg: "rgb(243,232,255)" },
  { value: "participant", label: "Participant",        color: "rgb(71,85,105)",  bg: "rgb(226,232,240)" },
  { value: "organizer",   label: "Organisateur",       color: "rgb(180,83,9)",   bg: "rgb(254,243,199)" },
  { value: "other",       label: "Autre",              color: "rgb(100,116,139)",bg: "rgb(241,245,249)" },
];

// Theme color samples — derived from getThemeSwatch (50 themes)
const THEME_PREVIEW: Record<string, { speaker: string; bg: string; header: string }> = Object.fromEntries(
  THEME_KEYS.map((k) => {
    const s = getThemeSwatch(k);
    return [k, { speaker: s.primary, bg: s.bg, header: s.header }];
  }),
);

export function BadgesConfigDialog({
  open,
  onOpenChange,
  onGenerate,
  badges,
  conferenceName,
  customLogoDataUrl,
}: BadgesConfigDialogProps) {
  const [eventDate, setEventDate] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [partnerLogos, setPartnerLogos] = useState<string[]>([]);
  const [theme, setTheme] = useState<BadgeTheme>("elegant");
  const [shape, setShape] = useState<BadgeShape>("rounded-md");
  const [decoration, setDecoration] = useState<BadgeDecoration>("none");

  // Print/cut settings
  const [cutMarkLength, setCutMarkLength] = useState(3.5);
  const [cutMarkOffset, setCutMarkOffset] = useState(1.2);
  const [printOffsetX, setPrintOffsetX] = useState(0);
  const [printOffsetY, setPrintOffsetY] = useState(0);

  // QR code options
  const [showQrCode, setShowQrCode] = useState(false);
  const [qrMode, setQrMode] = useState<"url" | "vcard">("url");
  const [qrBaseUrl, setQrBaseUrl] = useState("");

  // Editable per-participant roles
  const [editedBadges, setEditedBadges] = useState<BadgeEntry[]>(badges);
  const [search, setSearch] = useState("");
  // Role filter — only badges whose role is included will be generated.
  const [roleFilter, setRoleFilter] = useState<Set<BadgeRole>>(
    () => new Set<BadgeRole>(["speaker", "moderator", "chair", "participant", "organizer", "other"]),
  );

  useEffect(() => {
    setEditedBadges(badges);
  }, [badges]);

  // Preview controls
  const sample = editedBadges[0];
  const [previewName, setPreviewName] = useState(sample?.name ?? "Dr. Jean-Pierre N'Guessan");
  const [previewRole, setPreviewRole] = useState<BadgeRole>(sample?.role ?? "speaker");
  const [previewAffiliation, setPreviewAffiliation] = useState(sample?.affiliation ?? "Intelligence Artificielle");

  useEffect(() => {
    if (sample) {
      setPreviewName(sample.name);
      setPreviewRole(sample.role);
      setPreviewAffiliation(sample.affiliation ?? "");
    }
  }, [sample?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAddPartners = async (files: FileList | null) => {
    if (!files) return;
    const arr: string[] = [];
    for (const f of Array.from(files).slice(0, 6 - partnerLogos.length)) {
      arr.push(await readAsDataUrl(f));
    }
    setPartnerLogos((prev) => [...prev, ...arr].slice(0, 6));
  };

  const removePartner = (idx: number) => {
    setPartnerLogos((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateBadgeRole = (name: string, role: BadgeRole) => {
    setEditedBadges((prev) => prev.map((b) => (b.name === name ? { ...b, role } : b)));
  };

  const bulkSetRole = (role: BadgeRole) => {
    setEditedBadges((prev) =>
      prev.map((b) => (filteredBadges.some((f) => f.name === b.name) ? { ...b, role } : b))
    );
  };

  const filteredBadges = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return editedBadges;
    return editedBadges.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        (b.affiliation || "").toLowerCase().includes(q),
    );
  }, [editedBadges, search]);

  const roleCounts = useMemo(() => {
    const c: Record<BadgeRole, number> = { speaker: 0, moderator: 0, chair: 0, participant: 0, organizer: 0, other: 0 };
    editedBadges.forEach((b) => c[b.role]++);
    return c;
  }, [editedBadges]);

  const toggleRoleFilter = (role: BadgeRole) => {
    setRoleFilter((prev) => {
      const next = new Set(prev);
      if (next.has(role)) next.delete(role); else next.add(role);
      return next;
    });
  };

  const exportableBadges = useMemo(
    () => editedBadges.filter((b) => roleFilter.has(b.role)),
    [editedBadges, roleFilter],
  );

  const handleGenerate = () => {
    onGenerate(
      {
        eventDate: eventDate.trim() || undefined,
        eventLocation: eventLocation.trim() || undefined,
        subtitle: subtitle.trim() || undefined,
        partnerLogos: partnerLogos.length ? partnerLogos : undefined,
        theme,
        shape,
        decoration,
        showQrCode,
        qrMode,
        qrBaseUrl: qrBaseUrl.trim() || undefined,
        cutMarkLength,
        cutMarkOffset,
        printOffsetX,
        printOffsetY,
      },
      exportableBadges,
    );
    onOpenChange(false);
  };

  // Live QR preview (re-rendered as the user changes name / mode / URL)
  const [qrPreviewUrl, setQrPreviewUrl] = useState<string>("");
  useEffect(() => {
    if (!showQrCode) { setQrPreviewUrl(""); return; }
    const payload = buildQrPayload(
      { name: previewName, role: previewRole, affiliation: previewAffiliation },
      conferenceName,
      { qrMode, qrBaseUrl: qrBaseUrl.trim() || undefined },
    );
    let cancelled = false;
    QRCode.toDataURL(payload, { margin: 0, errorCorrectionLevel: "M", width: 200 })
      .then((url) => { if (!cancelled) setQrPreviewUrl(url); })
      .catch(() => { if (!cancelled) setQrPreviewUrl(""); });
    return () => { cancelled = true; };
  }, [showQrCode, qrMode, qrBaseUrl, previewName, previewRole, previewAffiliation, conferenceName]);

  const role = useMemo(() => ROLE_OPTIONS.find((r) => r.value === previewRole)!, [previewRole]);

  const nameFontSize = useMemo(() => {
    const len = previewName.trim().length;
    if (len <= 14) return 30;
    if (len <= 20) return 26;
    if (len <= 28) return 22;
    if (len <= 36) return 18;
    if (len <= 48) return 15;
    return 13;
  }, [previewName]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-primary" />
            Générer les badges
          </DialogTitle>
          <DialogDescription>
            {editedBadges.length} badge{editedBadges.length > 1 ? "s" : ""} • Format A4 (4 par feuille).
            Personnalisez le style, la forme et le rôle de chaque participant.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-[1fr_minmax(280px,360px)]">
          {/* ====== LEFT: TABS ====== */}
          <Tabs defaultValue="event" className="w-full">
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="event" className="gap-1"><UserCheck className="h-3.5 w-3.5" />Événement</TabsTrigger>
              <TabsTrigger value="style" className="gap-1"><Palette className="h-3.5 w-3.5" />Style</TabsTrigger>
              <TabsTrigger value="people" className="gap-1"><Users className="h-3.5 w-3.5" />Participants</TabsTrigger>
            </TabsList>

            {/* ---- TAB: Event ---- */}
            <TabsContent value="event" className="space-y-4 pt-3">
              <div className="space-y-2">
                <Label htmlFor="event-date">Date du séminaire</Label>
                <Input id="event-date" placeholder="ex. 12 - 14 mai 2026" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="event-location">Lieu</Label>
                <Input id="event-location" placeholder="ex. Université de Yaoundé I" value={eventLocation} onChange={(e) => setEventLocation(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="event-subtitle">Sous-titre (optionnel)</Label>
                <Input id="event-subtitle" placeholder="ex. 5ᵉ édition · Innovation & recherche" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Logos partenaires (jusqu'à 6, en bas du badge)</Label>
                <div className="flex flex-wrap gap-2">
                  {partnerLogos.map((url, i) => (
                    <div key={i} className="relative h-14 w-14 rounded border border-border bg-muted/40 p-1">
                      <img src={url} alt={`partenaire ${i + 1}`} className="h-full w-full object-contain" />
                      <button type="button" onClick={() => removePartner(i)} className="absolute -right-1.5 -top-1.5 rounded-full bg-destructive p-0.5 text-destructive-foreground shadow" aria-label="Supprimer">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  {partnerLogos.length < 6 && (
                    <label className="flex h-14 w-14 cursor-pointer items-center justify-center rounded border border-dashed border-border text-muted-foreground hover:bg-muted/50">
                      <Upload className="h-5 w-5" />
                      <input type="file" accept="image/png,image/jpeg" multiple className="hidden" onChange={(e) => handleAddPartners(e.target.files)} />
                    </label>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">PNG ou JPG. Affichés en très petit en bas du badge.</p>
              </div>

              {/* ---- QR code section ---- */}
              <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="qr-toggle" className="flex items-center gap-2 cursor-pointer">
                    <QrCode className="h-4 w-4 text-primary" />
                    <span>QR code sur les badges</span>
                  </Label>
                  <Switch id="qr-toggle" checked={showQrCode} onCheckedChange={setShowQrCode} />
                </div>
                {showQrCode && (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Type de QR</Label>
                      <Select value={qrMode} onValueChange={(v) => setQrMode(v as "url" | "vcard")}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="url">Lien URL (vers profil / programme)</SelectItem>
                          <SelectItem value="vcard">Contact vCard (nom + rôle)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {qrMode === "url" && (
                      <div className="space-y-1.5">
                        <Label htmlFor="qr-base" className="text-xs">URL de base (le slug du nom sera ajouté)</Label>
                        <Input
                          id="qr-base"
                          placeholder="ex. https://mon-evenement.com/p/"
                          value={qrBaseUrl}
                          onChange={(e) => setQrBaseUrl(e.target.value)}
                          className="h-8 text-sm"
                        />
                        <p className="text-[11px] text-muted-foreground">
                          Laissez vide pour générer un QR contenant nom + conférence + rôle.
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </TabsContent>

            {/* ---- TAB: Style ---- */}
            <TabsContent value="style" className="space-y-4 pt-3">
              {/* Theme picker (50) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-1.5"><Palette className="h-3.5 w-3.5" /> Thème visuel</Label>
                  <span className="text-[10px] text-muted-foreground">{THEME_LABEL[theme]} · {THEME_KEYS.length} thèmes</span>
                </div>
                <ScrollArea className="h-[200px] rounded-md border border-border p-2">
                  <div className="grid grid-cols-4 gap-1.5">
                    {THEME_KEYS.map((t) => {
                      const sample = THEME_PREVIEW[t];
                      const active = theme === t;
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setTheme(t)}
                          className={`relative flex flex-col items-stretch overflow-hidden rounded border-2 transition ${active ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/50"}`}
                          title={THEME_LABEL[t]}
                        >
                          <div className="h-1.5" style={{ background: sample.speaker }} />
                          <div className="px-1.5 py-1" style={{ background: sample.header }}>
                            <div className="h-1 w-3/4 rounded bg-slate-300/60" />
                            <div className="h-0.5 w-1/2 rounded bg-slate-300/40 mt-0.5" />
                          </div>
                          <div className="px-1 py-1 bg-white flex items-center justify-center">
                            <div className="h-1.5 w-8 rounded-full" style={{ background: sample.speaker }} />
                          </div>
                          <div className="px-1 py-0.5 text-center text-[9px] font-medium border-t border-border bg-muted/30 truncate">
                            {THEME_LABEL[t]}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>

              {/* Shape picker (50) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-1.5"><Shapes className="h-3.5 w-3.5" /> Forme du badge</Label>
                  <span className="text-[10px] text-muted-foreground">{SHAPE_LABEL[shape]} · {SHAPE_KEYS.length} formes</span>
                </div>
                <ScrollArea className="h-[180px] rounded-md border border-border p-2">
                  <div className="grid grid-cols-6 gap-1.5">
                    {SHAPE_KEYS.map((s) => {
                      const active = shape === s;
                      const fam = getShapeFamily(s);
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setShape(s)}
                          className={`flex flex-col items-center gap-0.5 rounded border-2 p-1 transition ${active ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/50"}`}
                          title={SHAPE_LABEL[s]}
                        >
                          <ShapeIcon family={fam.family} variant={fam.variant} color={THEME_PREVIEW[theme].speaker} />
                          <span className="text-[8px] text-center leading-tight truncate w-full">{SHAPE_LABEL[s]}</span>
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>

              {/* Decoration picker — opt-in */}
              <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
                <Label className="flex items-center gap-1.5">
                  <Shapes className="h-3.5 w-3.5" /> Motif décoratif (optionnel)
                </Label>
                <Select value={decoration} onValueChange={(v) => setDecoration(v as BadgeDecoration)}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DECORATION_KEYS.map((d) => (
                      <SelectItem key={d} value={d}>{DECORATION_LABEL[d]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Ajoute des formes décoratives en arrière-plan dans le contenu du badge. Choisissez « Aucune » pour un rendu épuré.
                </p>
              </div>

              {/* Print / Cut marks settings */}
              <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
                <Label className="flex items-center gap-1.5">
                  <Scissors className="h-3.5 w-3.5" /> Impression & découpe
                </Label>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Longueur des repères de coupe</span>
                    <span className="font-mono">{cutMarkLength.toFixed(1)} mm</span>
                  </div>
                  <Slider
                    min={0} max={10} step={0.5}
                    value={[cutMarkLength]}
                    onValueChange={(v) => setCutMarkLength(v[0])}
                  />
                  <p className="text-[10px] text-muted-foreground">0 = repères désactivés.</p>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Espace entre badge et repère</span>
                    <span className="font-mono">{cutMarkOffset.toFixed(1)} mm</span>
                  </div>
                  <Slider
                    min={0} max={5} step={0.1}
                    value={[cutMarkOffset]}
                    onValueChange={(v) => setCutMarkOffset(v[0])}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1 border-t border-border/50">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Décalage X</span>
                      <span className="font-mono">{printOffsetX.toFixed(1)} mm</span>
                    </div>
                    <Slider
                      min={-10} max={10} step={0.5}
                      value={[printOffsetX]}
                      onValueChange={(v) => setPrintOffsetX(v[0])}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Décalage Y</span>
                      <span className="font-mono">{printOffsetY.toFixed(1)} mm</span>
                    </div>
                    <Slider
                      min={-10} max={10} step={0.5}
                      value={[printOffsetY]}
                      onValueChange={(v) => setPrintOffsetY(v[0])}
                    />
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Compense les marges d'impression de votre imprimante (positif = vers la droite / le bas).
                </p>
              </div>

              <div className="rounded-lg border border-dashed border-border bg-muted/30 p-3 space-y-2">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <Eye className="h-3.5 w-3.5" />
                  Tester l'aperçu
                </div>
                <Input placeholder="Nom à prévisualiser" value={previewName} onChange={(e) => setPreviewName(e.target.value)} className="h-8 text-sm" />
                <div className="grid grid-cols-2 gap-2">
                  <Select value={previewRole} onValueChange={(v) => setPreviewRole(v as BadgeRole)}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map((r) => (<SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>))}
                    </SelectContent>
                  </Select>
                  <Input placeholder="Thématique / affiliation" value={previewAffiliation} onChange={(e) => setPreviewAffiliation(e.target.value)} className="h-8 text-sm" />
                </div>
              </div>
            </TabsContent>

            {/* ---- TAB: People ---- */}
            <TabsContent value="people" className="space-y-3 pt-3">
              <ManualAddRow
                onAdd={(name, role, affiliation) => {
                  setEditedBadges((prev) => {
                    if (prev.some((b) => b.name.toLowerCase() === name.toLowerCase())) return prev;
                    return [...prev, { name, role, affiliation: affiliation || undefined }];
                  });
                }}
              />
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[180px]">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input className="h-8 pl-7 text-sm" placeholder="Rechercher un participant…" value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                <Select onValueChange={(v) => bulkSetRole(v as BadgeRole)}>
                  <SelectTrigger className="h-8 w-[200px] text-xs">
                    <SelectValue placeholder="Attribuer un rôle (filtrés)" />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>Tous → {r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>


              <div className="rounded-md border border-border bg-muted/20 p-2 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-medium text-muted-foreground">
                    Générer les badges pour : <span className="text-foreground">{exportableBadges.length}</span> sélectionné{exportableBadges.length > 1 ? "s" : ""}
                  </p>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-[10px]"
                      onClick={() => setRoleFilter(new Set<BadgeRole>(["speaker", "moderator", "chair", "participant", "organizer", "other"]))}
                    >
                      Tous
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-[10px]"
                      onClick={() => setRoleFilter(new Set<BadgeRole>())}
                    >
                      Aucun
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 text-[11px]">
                  {ROLE_OPTIONS.map((r) => {
                    const active = roleFilter.has(r.value);
                    return (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() => toggleRoleFilter(r.value)}
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 transition ${
                          active ? "" : "opacity-40 grayscale hover:opacity-70"
                        }`}
                        style={{ borderColor: r.color, color: r.color, background: r.bg }}
                        title={active ? "Cliquer pour exclure" : "Cliquer pour inclure"}
                      >
                        <span className="font-semibold">{roleCounts[r.value]}</span> {r.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <ScrollArea className="h-[340px] rounded-md border border-border">
                <div className="divide-y divide-border">
                  {filteredBadges.map((b) => {
                    const r = ROLE_OPTIONS.find((o) => o.value === b.role)!;
                    return (
                      <div key={b.name} className="flex items-center gap-2 px-3 py-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate">{b.name}</div>
                          {b.affiliation && <div className="text-xs text-muted-foreground truncate">{b.affiliation}</div>}
                        </div>
                        <span className="hidden sm:inline-flex h-1.5 w-1.5 rounded-full" style={{ background: r.color }} />
                        <Select value={b.role} onValueChange={(v) => updateBadgeRole(b.name, v as BadgeRole)}>
                          <SelectTrigger className="h-7 w-[170px] text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {ROLE_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  })}
                  {filteredBadges.length === 0 && (
                    <div className="px-3 py-8 text-center text-xs text-muted-foreground">Aucun participant trouvé.</div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>

          {/* ====== RIGHT: LIVE PREVIEW ====== */}
          <div className="flex flex-col items-center gap-2 py-2">
            <div className="text-xs font-medium text-muted-foreground">Aperçu en temps réel</div>
            <BadgePreview
              conferenceName={conferenceName}
              eventDate={eventDate}
              eventLocation={eventLocation}
              subtitle={subtitle}
              partnerLogos={partnerLogos}
              customLogoDataUrl={customLogoDataUrl}
              name={previewName}
              affiliation={previewAffiliation}
              roleLabel={role.label}
              roleColor={THEME_PREVIEW[theme].speaker}
              roleBg={role.bg}
              theme={theme}
              shape={shape}
              decoration={decoration}
              nameFontSize={nameFontSize}
              previewRole={previewRole}
              qrDataUrl={showQrCode ? qrPreviewUrl : ""}
            />
            <p className="text-[10px] text-muted-foreground text-center max-w-[260px]">
              {THEME_LABEL[theme]} · {SHAPE_LABEL[shape]} · {DECORATION_LABEL[decoration]} — Représentation fidèle (95×130 mm).
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleGenerate} disabled={exportableBadges.length === 0}>
            Générer le PDF ({exportableBadges.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Shape mini-icon for the picker (10 families × 5 variants) ----------
type ShapeFamily =
  | "rounded" | "classic" | "ribbon" | "cut-corner" | "wave"
  | "arch" | "notched" | "double-frame" | "tab-top" | "scalloped";

function ShapeIcon({ family, variant, color }: { family: ShapeFamily; variant: number; color: string }) {
  const stroke = "rgb(148,163,184)";
  const sw = 1.2;
  switch (family) {
    case "rounded": {
      const r = 1 + variant;
      return (
        <svg width="28" height="36" viewBox="0 0 28 36">
          <rect x="2" y="2" width="24" height="32" rx={r} fill="white" stroke={stroke} strokeWidth={sw} />
          <rect x="2" y="2" width="24" height={4 + variant * 0.6} rx={r} fill={color} />
        </svg>
      );
    }
    case "classic":
      return (
        <svg width="28" height="36" viewBox="0 0 28 36">
          <rect x="2" y="2" width="24" height="32" fill="white" stroke={stroke} strokeWidth={sw} />
          <rect x="2" y="2" width="24" height={3 + variant * 0.7} fill={color} />
          <rect x="2" y={3 + variant * 0.7 + 0.5} width="24" height={0.4 + variant * 0.2} fill={color} />
        </svg>
      );
    case "ribbon": {
      const rw = 4 + variant;
      return (
        <svg width="28" height="36" viewBox="0 0 28 36">
          <rect x="2" y="2" width="24" height="32" rx="1.5" fill="white" stroke={stroke} strokeWidth={sw} />
          <rect x="2" y="2" width="24" height="4" fill={color} />
          <rect x={26 - rw - 2} y="6" width={rw} height={6 + variant} fill={color} />
          <polygon points={`${26 - rw - 2},${12 + variant} ${26 - rw / 2 - 2},${10 + variant} ${24},${12 + variant} ${24},${14 + variant} ${26 - rw - 2},${14 + variant}`} fill="white" />
        </svg>
      );
    }
    case "cut-corner": {
      const c = 3 + variant * 1.2;
      return (
        <svg width="28" height="36" viewBox="0 0 28 36">
          <polygon points={`2,2 ${26 - c},2 26,${2 + c} 26,34 ${2 + c},34 2,${34 - c}`} fill="white" stroke={stroke} strokeWidth={sw} />
          <polygon points={`${26 - c},2 26,${2 + c} ${26 - c},${2 + c}`} fill={color} />
          <polygon points={`2,${34 - c} ${2 + c},34 2,34`} fill={color} />
          <rect x="2" y="2" width={24 - c} height={3 + variant * 0.6} fill={color} />
        </svg>
      );
    }
    case "wave":
      return (
        <svg width="28" height="36" viewBox="0 0 28 36">
          <rect x="2" y="2" width="24" height="32" rx="2" fill="white" stroke={stroke} strokeWidth={sw} />
          <path
            d={`M2 2 L26 2 L26 ${5 + variant} ${[2.6, 5.2, 7.8, 10.4, 13, 15.6, 18.2, 20.8, 23.4]
              .map((cx, i) => `${i === 0 ? "Q" : "T"}${cx} ${(i % 2 === 0 ? 7 : 5) + variant} ${cx + 1.3} ${5 + variant}`)
              .join(" ")} L2 ${5 + variant} Z`}
            fill={color}
          />
        </svg>
      );
    case "arch":
      return (
        <svg width="28" height="36" viewBox="0 0 28 36">
          <rect x="2" y="2" width="24" height="32" rx="2" fill="white" stroke={stroke} strokeWidth={sw} />
          <path d={`M2 ${4 + variant} Q14 ${-2 + variant * 0.5} 26 ${4 + variant} L26 ${8 + variant} L2 ${8 + variant} Z`} fill={color} />
        </svg>
      );
    case "notched": {
      const nw = 3 + variant;
      const nh = 1.5 + variant * 0.5;
      return (
        <svg width="28" height="36" viewBox="0 0 28 36">
          <path d={`M2 2 L${14 - nw} 2 L14 ${2 + nh} L${14 + nw} 2 L26 2 L26 34 L2 34 Z`} fill="white" stroke={stroke} strokeWidth={sw} />
          <path d={`M2 2 L${14 - nw} 2 L14 ${2 + nh} L${14 + nw} 2 L26 2 L26 ${5 + variant} L2 ${5 + variant} Z`} fill={color} />
        </svg>
      );
    }
    case "double-frame": {
      const m = 1 + variant * 0.4;
      return (
        <svg width="28" height="36" viewBox="0 0 28 36">
          <rect x="2" y="2" width="24" height="32" rx="1.5" fill="white" stroke={stroke} strokeWidth={sw} />
          <rect x={2 + m} y={2 + m} width={24 - m * 2} height={32 - m * 2} rx="1" fill="none" stroke={color} strokeWidth={0.5 + variant * 0.15} />
          <rect x={2 + m} y={2 + m} width={24 - m * 2} height={3 + variant * 0.6} fill={color} />
        </svg>
      );
    }
    case "tab-top": {
      const tw = 8 + variant * 1.6;
      const th = 2 + variant * 0.6;
      return (
        <svg width="28" height="36" viewBox="0 0 28 36">
          <rect x="2" y={2 + th} width="24" height={32 - th} rx="1.5" fill="white" stroke={stroke} strokeWidth={sw} />
          <rect x={14 - tw / 2} y="2" width={tw} height={th * 1.6} rx="1" fill={color} />
          <rect x="2" y={2 + th} width="24" height="3" fill={color} />
        </svg>
      );
    }
    case "scalloped": {
      const r = 0.8 + variant * 0.3;
      const dots = [];
      let cy = 4;
      let i = 0;
      while (cy < 33) { dots.push(<circle key={`l${i}`} cx={2} cy={cy} r={r} fill="white" stroke={stroke} strokeWidth={sw * 0.6} />); dots.push(<circle key={`r${i}`} cx={26} cy={cy} r={r} fill="white" stroke={stroke} strokeWidth={sw * 0.6} />); cy += r * 2.4; i++; }
      return (
        <svg width="28" height="36" viewBox="0 0 28 36">
          <rect x="2" y="2" width="24" height="32" rx="1" fill="white" stroke={stroke} strokeWidth={sw} />
          <rect x="2" y="2" width="24" height={3 + variant * 0.6} fill={color} />
          {dots}
        </svg>
      );
    }
  }
}

// ---------- Preview component (HTML/CSS replica of the PDF badge) ----------

interface PreviewProps {
  conferenceName: string;
  eventDate: string;
  eventLocation: string;
  subtitle: string;
  partnerLogos: string[];
  customLogoDataUrl?: string;
  name: string;
  affiliation: string;
  roleLabel: string;
  roleColor: string;
  roleBg: string;
  theme: BadgeTheme;
  shape: BadgeShape;
  decoration: BadgeDecoration;
  previewRole: BadgeRole;
  nameFontSize: number;
  qrDataUrl?: string;
}

/** Auto-fit conference name to its container width (max 2 lines). */
function useAutoFitFontSize(text: string, containerW: number, max = 13, min = 7) {
  return useMemo(() => {
    if (!text) return max;
    const ratio = 0.55;
    let size = max;
    while (size > min) {
      const charsPerLine = Math.floor(containerW / (size * ratio));
      if (charsPerLine <= 0) { size -= 0.5; continue; }
      const words = text.split(/\s+/);
      let lines = 1, lineLen = 0;
      for (const w of words) {
        const wl = w.length + 1;
        if (lineLen + wl > charsPerLine) { lines++; lineLen = wl; }
        else lineLen += wl;
      }
      if (lines <= 2) return size;
      size -= 0.5;
    }
    return min;
  }, [text, containerW, max, min]);
}

function BadgePreview(p: PreviewProps) {
  const W = 256;
  const H = 351;
  const meta = [p.eventDate, p.eventLocation].filter(Boolean).join("  •  ");
  const themeSample = THEME_PREVIEW[p.theme];
  const fam = getShapeFamily(p.shape);

  const headerTextW = p.customLogoDataUrl ? W - 24 - 64 : W - 24;
  const titleSize = useAutoFitFontSize(p.conferenceName, headerTextW, 13, 7);

  // Pill style based on theme family is approximated via known theme ids.
  // We just use the family-agnostic look with role color.
  const pillStyle = { background: p.roleColor, color: "#fff", border: `1px solid ${p.roleColor}`, borderRadius: 999 };

  // Outer shape clip-path / radius (10 families × 5 variants)
  const shapeStyles: React.CSSProperties = (() => {
    const v = fam.variant;
    switch (fam.family) {
      case "rounded":      return { borderRadius: 6 + v * 4 };
      case "classic":      return {};
      case "ribbon":       return { borderRadius: 6 };
      case "double-frame": return { borderRadius: 8 };
      case "wave":         return { borderRadius: 8 };
      case "arch":         return { borderRadius: 8 };
      case "tab-top":      return {};
      case "scalloped":    return { borderRadius: 4 };
      case "notched":      return {};
      case "cut-corner": {
        const c = 14 + v * 6;
        return { clipPath: `polygon(0 0, calc(100% - ${c}px) 0, 100% ${c}px, 100% 100%, ${c}px 100%, 0 calc(100% - ${c}px))` };
      }
    }
  })();

  const QR = 64;
  const hasQr = !!p.qrDataUrl;
  const nameRight = hasQr ? W - QR - 18 : W - 16;
  const nameLeft = 16;

  // Top accent height varies by family/variant
  const topAccent = (() => {
    const v = fam.variant;
    switch (fam.family) {
      case "rounded":      return 18 + v * 2;
      case "classic":      return 14 + v * 2;
      case "ribbon":       return 14;
      case "wave":         return 18;
      case "arch":         return 22 + v * 2;
      case "notched":      return 18 + v * 2;
      case "double-frame": return 16 + v * 2;
      case "tab-top":      return 22;
      case "scalloped":    return 18 + v * 2;
      case "cut-corner":   return 18 + v * 2;
    }
  })();

  return (
    <div
      className="relative bg-white shadow-md ring-1 ring-border overflow-hidden"
      style={{ width: W, height: H, fontFamily: "Helvetica, Arial, sans-serif", ...shapeStyles }}
    >
      {/* ---- Top accent rendered per shape family ---- */}
      {(fam.family === "rounded" || fam.family === "classic" || fam.family === "ribbon"
        || fam.family === "scalloped") && (
        <div className="absolute left-0 top-0 right-0" style={{ height: topAccent, background: p.roleColor }} />
      )}
      {fam.family === "classic" && (
        <div className="absolute left-0 right-0" style={{ top: topAccent + 1, height: 1.5 + fam.variant * 0.4, background: p.roleColor }} />
      )}
      {fam.family === "ribbon" && (
        <svg className="absolute" style={{ top: 12, right: 12, width: 28 + fam.variant * 3, height: 38 + fam.variant * 4 }} viewBox="0 0 32 48">
          <rect x="2" y="0" width="28" height="38" fill={p.roleColor} style={{ filter: "brightness(0.82)" }} />
          <polygon points="2,38 16,30 30,38 30,48 2,48" fill="white" />
        </svg>
      )}
      {fam.family === "double-frame" && (
        <>
          <div
            className="absolute pointer-events-none"
            style={{
              top: 4 + fam.variant * 2, left: 4 + fam.variant * 2, right: 4 + fam.variant * 2, bottom: 4 + fam.variant * 2,
              border: `${1 + fam.variant * 0.4}px solid ${p.roleColor}`,
              borderRadius: 4,
            }}
          />
          <div
            className="absolute"
            style={{
              top: 4 + fam.variant * 2, left: 4 + fam.variant * 2, right: 4 + fam.variant * 2, height: topAccent,
              background: p.roleColor,
            }}
          />
        </>
      )}
      {fam.family === "cut-corner" && (() => {
        const c = 14 + fam.variant * 6;
        return (
          <>
            <div className="absolute left-0 top-0" style={{ width: `calc(100% - ${c}px)`, height: topAccent, background: p.roleColor }} />
            <div className="absolute" style={{ top: 0, right: 0, width: 0, height: 0, borderTop: `${c}px solid ${p.roleColor}`, borderLeft: `${c}px solid transparent` }} />
            <div className="absolute" style={{ bottom: 0, left: 0, width: 0, height: 0, borderBottom: `${c}px solid ${p.roleColor}`, borderRight: `${c}px solid transparent` }} />
          </>
        );
      })()}
      {fam.family === "wave" && (
        <svg className="absolute left-0 top-0" width={W} height={topAccent + 12}>
          <rect x="0" y="0" width={W} height={topAccent} fill={p.roleColor} />
          <path
            d={`M0 ${topAccent} ${Array.from({ length: Math.ceil(W / 14) + 1 })
              .map((_, i) => `Q${i * 14 + 7} ${topAccent + 6 + fam.variant} ${i * 14 + 14} ${topAccent}`)
              .join(" ")} L${W} 0 L0 0 Z`}
            fill={p.roleColor}
          />
        </svg>
      )}
      {fam.family === "arch" && (
        <svg className="absolute left-0 top-0" width={W} height={topAccent}>
          <path d={`M0 ${topAccent / 2} Q${W / 2} ${-topAccent * 0.4} ${W} ${topAccent / 2} L${W} ${topAccent} L0 ${topAccent} Z`} fill={p.roleColor} />
        </svg>
      )}
      {fam.family === "notched" && (() => {
        const nw = 16 + fam.variant * 6;
        const nh = 6 + fam.variant * 1.5;
        return (
          <svg className="absolute left-0 top-0" width={W} height={topAccent}>
            <path
              d={`M0 0 L${W / 2 - nw} 0 L${W / 2} ${nh} L${W / 2 + nw} 0 L${W} 0 L${W} ${topAccent} L0 ${topAccent} Z`}
              fill={p.roleColor}
            />
          </svg>
        );
      })()}
      {fam.family === "tab-top" && (() => {
        const tw = 70 + fam.variant * 14;
        const th = 10 + fam.variant * 3;
        return (
          <>
            <div
              className="absolute"
              style={{ top: 0, left: (W - tw) / 2, width: tw, height: th, background: p.roleColor, borderRadius: "6px 6px 0 0" }}
            />
            <div className="absolute left-0 right-0" style={{ top: th, height: topAccent - th, background: p.roleColor }} />
          </>
        );
      })()}
      {fam.family === "scalloped" && (() => {
        const r = 4 + fam.variant * 1.5;
        const dots = [];
        let cy = r * 1.2;
        let i = 0;
        while (cy < H - r) {
          dots.push(<div key={`l${i}`} className="absolute rounded-full bg-white" style={{ width: r * 2, height: r * 2, left: -r, top: cy - r, boxShadow: "inset 0 0 0 1px rgb(226,232,240)" }} />);
          dots.push(<div key={`r${i}`} className="absolute rounded-full bg-white" style={{ width: r * 2, height: r * 2, right: -r, top: cy - r, boxShadow: "inset 0 0 0 1px rgb(226,232,240)" }} />);
          cy += r * 2.4;
          i++;
        }
        return <>{dots}</>;
      })()}

      {/* ----- Header zone ----- */}
      <div className="absolute left-0 right-0 flex items-start gap-2 px-3 pt-1.5" style={{ top: topAccent + 4, height: 60, background: themeSample.header }}>
        {p.customLogoDataUrl && (
          <img src={p.customLogoDataUrl} alt="logo" className="h-12 w-12 object-contain shrink-0" />
        )}
        <div className="min-w-0 flex-1 overflow-hidden">
          <div
            className="font-bold leading-tight text-slate-900"
            style={{ fontSize: titleSize, lineHeight: 1.15, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
          >
            {p.conferenceName}
          </div>
          {p.subtitle && (<div className="italic text-[9px] text-slate-500 truncate mt-0.5">{p.subtitle}</div>)}
          {meta && (<div className="text-[9px] mt-0.5 truncate" style={{ color: p.roleColor }}>{meta}</div>)}
        </div>
      </div>

      {/* Decorative shapes inside content area (background) — opt-in */}
      <ContentDecorations decoration={p.decoration} primary={p.roleColor} accent={p.roleBg} width={W} top={topAccent + 66} bottom={258} />

      {/* Separator */}
      <div className="absolute left-3 right-3 border-t border-slate-200" style={{ top: topAccent + 64 }} />

      {/* Name zone */}
      <div
        className="absolute flex items-center justify-center text-center"
        style={{ top: topAccent + 74, height: 110, left: nameLeft, right: W - nameRight }}
      >
        <div
          className="font-bold text-slate-900 leading-tight break-words"
          style={{
            fontSize: hasQr ? Math.max(11, p.nameFontSize - 4) : p.nameFontSize,
            lineHeight: 1.1,
            wordBreak: "break-word",
            overflowWrap: "anywhere",
          }}
        >
          {p.name || "—"}
        </div>
      </div>

      {/* QR code */}
      {hasQr && (
        <div
          className="absolute flex flex-col items-center"
          style={{ top: topAccent + 84, right: 10 }}
        >
          <div className="rounded-md ring-1 ring-slate-200 p-1 bg-white">
            <img src={p.qrDataUrl} alt="QR code" style={{ width: QR, height: QR, display: "block" }} />
          </div>
          <span className="text-[8px] text-slate-500 mt-0.5">Scannez</span>
        </div>
      )}

      {/* Affiliation */}
      {p.affiliation && (
        <div className="absolute left-0 right-0 px-3 text-center italic text-slate-500 text-[10px] line-clamp-2" style={{ top: 222 }}>
          {p.affiliation}
        </div>
      )}

      {/* Role pill */}
      <div className="absolute left-0 right-0 flex justify-center" style={{ top: 262 }}>
        <div className="inline-flex items-center rounded-full px-3 py-1 text-[10px] font-bold" style={pillStyle}>
          {p.roleLabel}
        </div>
      </div>

      {/* Partners strip */}
      {p.partnerLogos.length > 0 ? (
        <div className="absolute left-0 right-0 px-3" style={{ bottom: 8 }}>
          <div className="flex items-end justify-center gap-1.5 h-8">
            {p.partnerLogos.slice(0, 6).map((url, i) => (
              <img key={i} src={url} alt={`partenaire ${i + 1}`} className="h-7 w-7 object-contain" />
            ))}
          </div>
          <div className="text-center text-[7px] tracking-wider text-slate-400 mt-0.5">PARTENAIRES</div>
        </div>
      ) : (
        <div className="absolute left-1/2 -translate-x-1/2" style={{ bottom: 16, width: 40, height: 2, background: p.roleColor }} />
      )}
    </div>
  );
}

/** Decorative patterns inside badge content area, mirroring exportBadges.ts. */
function ContentDecorations({
  decoration, primary, accent, width, top, bottom,
}: { decoration: BadgeDecoration; primary: string; accent: string; width: number; top: number; bottom: number }) {
  if (decoration === "none") return null;
  const h = bottom - top;
  const W = width;
  const common: React.CSSProperties = { position: "absolute", left: 0, top, pointerEvents: "none" };

  switch (decoration) {
    case "dots": {
      const cols = 9, rows = 6;
      const dots = [];
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
        dots.push(<circle key={`${i}-${j}`} cx={12 + (i / (cols - 1)) * (W - 24)} cy={6 + (j / (rows - 1)) * (h - 12)} r={1.6} fill={primary} opacity={0.35} />);
      }
      return <svg style={common} width={W} height={h}>{dots}</svg>;
    }
    case "circles":
      return (
        <svg style={common} width={W} height={h}>
          {[12, 20, 28, 36, 44].map((r) => (
            <circle key={r} cx={W - 24} cy={h - 18} r={r} fill="none" stroke={primary} strokeWidth={0.7} opacity={0.5} />
          ))}
        </svg>
      );
    case "stripes":
      return (
        <svg style={common} width={W} height={h}>
          {[0, 1, 2, 3, 4].map((i) => (
            <polygon key={i} points={`2,${i * 22 + 4} 20,${i * 22 + 4} 2,${i * 22 + 18}`} fill={primary} opacity={0.18} />
          ))}
        </svg>
      );
    case "grid":
      return (
        <svg style={common} width={W} height={h}>
          {Array.from({ length: 4 }).map((_, i) =>
            Array.from({ length: 3 }).map((__, j) => (
              <rect key={`${i}-${j}`} x={W - 56 + i * 12} y={h - 40 + j * 12} width={9} height={9} fill="none" stroke={primary} strokeWidth={0.5} opacity={0.6} />
            )),
          )}
        </svg>
      );
    case "confetti": {
      const dots: [number, number, number][] = [
        [0.12, 0.18, 3], [0.22, 0.78, 2.4], [0.35, 0.32, 4],
        [0.5, 0.68, 2.8], [0.62, 0.22, 3.6], [0.78, 0.55, 3],
        [0.88, 0.82, 3.4], [0.18, 0.55, 2.6], [0.7, 0.88, 2.4],
      ];
      const colors = [primary, accent];
      return (
        <svg style={common} width={W} height={h}>
          {dots.map(([dx, dy, r], i) => (
            <circle key={i} cx={dx * W} cy={dy * h} r={r} fill={colors[i % 2]} opacity={0.7} />
          ))}
        </svg>
      );
    }
    case "waves":
      return (
        <svg style={common} width={W} height={h}>
          {[0, 1, 2].map((row) => (
            <path
              key={row}
              d={`M4 ${h - 24 - row * 10} ${Array.from({ length: 9 })
                .map((_, i) => `q${14} ${i % 2 === 0 ? -8 : 8} ${28} 0`)
                .join(" ")}`}
              fill="none"
              stroke={primary}
              strokeWidth={0.8}
              opacity={0.45}
            />
          ))}
        </svg>
      );
    case "triangles":
      return (
        <svg style={common} width={W} height={h}>
          {[
            [12, 8, 14], [W - 30, 16, 18], [24, h - 30, 16], [W - 22, h - 14, 11],
          ].map(([x, y, s], i) => (
            <polygon key={i} points={`${x},${y} ${x + s},${y} ${x + s / 2},${y + s}`} fill={primary} opacity={0.5} />
          ))}
        </svg>
      );
    case "diagonals": {
      const lines = [];
      for (let i = -20; i < W + 20; i += 14) {
        lines.push(<line key={i} x1={i} y1={0} x2={i + 28} y2={h} stroke={primary} strokeWidth={0.5} opacity={0.35} />);
      }
      return <svg style={common} width={W} height={h}>{lines}</svg>;
    }
    case "blobs":
      return (
        <svg style={common} width={W} height={h}>
          <circle cx={-12} cy={h + 4} r={36} fill={primary} opacity={0.18} />
          <circle cx={W + 8} cy={12} r={28} fill={accent} opacity={0.5} />
          <circle cx={W / 2} cy={h - 8} r={18} fill={primary} opacity={0.2} />
        </svg>
      );
    case "rings":
      return (
        <svg style={common} width={W} height={h}>
          {[
            [24, 14, 10], [W - 28, 22, 14], [36, h - 16, 12], [W - 36, h - 8, 8],
          ].map(([cx, cy, r], i) => (
            <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={primary} strokeWidth={0.7} opacity={0.55} />
          ))}
        </svg>
      );
    case "lines":
      return (
        <svg style={common} width={W} height={h}>
          <line x1={14} y1={10} x2={14} y2={h - 10} stroke="#d4d4d4" strokeWidth={0.6} />
          <line x1={W - 14} y1={10} x2={W - 14} y2={h - 10} stroke="#d4d4d4" strokeWidth={0.6} />
          <rect x={11} y={10} width={4} height={4} fill={primary} />
          <rect x={W - 17} y={h - 14} width={4} height={4} fill={primary} />
        </svg>
      );
    case "corners": {
      const len = 16;
      return (
        <svg style={common} width={W} height={h}>
          {[
            [8, 8, 1, 1], [W - 8, 8, -1, 1], [8, h - 8, 1, -1], [W - 8, h - 8, -1, -1],
          ].map(([cx, cy, dx, dy], i) => (
            <g key={i} stroke={primary} strokeWidth={1.4} fill="none" opacity={0.7}>
              <line x1={cx} y1={cy} x2={cx + (dx as number) * len} y2={cy} />
              <line x1={cx} y1={cy} x2={cx} y2={cy + (dy as number) * len} />
            </g>
          ))}
        </svg>
      );
    }
    default:
      return null;
  }
}

function ManualAddRow({ onAdd }: { onAdd: (name: string, role: BadgeRole, affiliation?: string) => void }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState<BadgeRole>("organizer");
  const [affiliation, setAffiliation] = useState("");
  const handle = () => {
    const n = name.trim();
    if (!n) return;
    onAdd(n, role, affiliation.trim() || undefined);
    setName(""); setAffiliation("");
  };
  return (
    <div className="rounded-md border border-dashed border-border bg-muted/30 p-2 flex flex-wrap gap-2 items-center">
      <span className="text-[11px] font-medium text-muted-foreground px-1">Ajouter manuellement :</span>
      <Input className="h-8 text-sm flex-1 min-w-[140px]" placeholder="Nom complet" value={name} onChange={(e) => setName(e.target.value)} />
      <Input className="h-8 text-sm flex-1 min-w-[140px]" placeholder="Affiliation (optionnel)" value={affiliation} onChange={(e) => setAffiliation(e.target.value)} />
      <Select value={role} onValueChange={(v) => setRole(v as BadgeRole)}>
        <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          {ROLE_OPTIONS.map((r) => (<SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>))}
        </SelectContent>
      </Select>
      <Button size="sm" className="h-8" onClick={handle} disabled={!name.trim()}>Ajouter</Button>
    </div>
  );
}
