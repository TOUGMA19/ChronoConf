import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Award, Upload, Download, FileText, Trash2, Search } from "lucide-react";
import {
  CERTIFICATE_TEMPLATES,
  CertificateOptions,
  CertificateRecipient,
  CertificateTemplateId,
  CertificateLayout,
  CERT_ROLE_LABEL,
  exportCertificatesPDF,
  exportCertificatesPPTX,
  inspectPptxTemplate,
  PptxTemplateInfo,
  PPTX_TEXT_TAGS,
  getCertificateTemplate,
  defaultLayout,
  CertificateRole,
  recipientKey,
} from "@/lib/exportCertificates";
import CertificateLayoutEditor from "./CertificateLayoutEditor";
import { toast } from "sonner";
import ListStatusNotice from "./ListStatusNotice";
import RoleSwapBar from "./RoleSwapBar";
import { swapRole } from "@/lib/people";

const ALL_ROLES = Object.keys(CERT_ROLE_LABEL) as CertificateRole[];
const ROLE_OPTIONS = ALL_ROLES.map((value) => ({ value, label: CERT_ROLE_LABEL[value] }));

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipients: CertificateRecipient[];
  conferenceName: string;
  customLogoDataUrl?: string;
  unscheduledCount?: number;
  includeUnscheduled?: boolean;
  onIncludeUnscheduledChange?: (v: boolean) => void;
  unverifiedCount?: number | null;
}

export default function CertificatesConfigDialog({
  open, onOpenChange, recipients, conferenceName, customLogoDataUrl,
  unscheduledCount = 0, includeUnscheduled = true, onIncludeUnscheduledChange, unverifiedCount,
}: Props) {
  const [templateId, setTemplateId] = useState<CertificateTemplateId>("classic-blue");
  const [eventDate, setEventDate] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [organizer, setOrganizer] = useState("");
  const [signatoryLine, setSignatoryLine] = useState("Le Président du Comité d'Organisation");
  const [signatoryName, setSignatoryName] = useState("");
  const [showCommunicationTitle, setShowCommunicationTitle] = useState(true);
  const [showRole, setShowRole] = useState(true);
  const [showQrCode, setShowQrCode] = useState(true);
  const [qrBaseUrl, setQrBaseUrl] = useState("");
  const [logoDataUrl, setLogoDataUrl] = useState<string | undefined>(customLogoDataUrl);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | undefined>();
  const [signatureImages, setSignatureImages] = useState<Record<number, string>>({});
  const [pptxFile, setPptxFile] = useState<File | null>(null);
  const [pptxInfo, setPptxInfo] = useState<PptxTemplateInfo | null>(null);
  const [pptxLoading, setPptxLoading] = useState(false);
  // Sélection par clé (nom normalisé + rôle + titre) : un même nom avec deux rôles
  // ou deux communications est coché / décoché indépendamment.
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set(recipients.map(recipientKey)));
  const [extraRecipients, setExtraRecipients] = useState<CertificateRecipient[]>([]);
  // Rôles modifiés par l'utilisateur, indexés par l'identité d'ORIGINE du destinataire
  // (recipientKey de la liste source) : la sélection cochée survit donc à un changement de rôle.
  const [roleOverrides, setRoleOverrides] = useState<Record<string, CertificateRole>>({});
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<Set<CertificateRole>>(() => new Set(ALL_ROLES));
  const [layout, setLayout] = useState<CertificateLayout>(() => defaultLayout());
  const [busy, setBusy] = useState(false);

  // Resynchronise la sélection uniquement quand le CONTENU de la liste change
  // (et non à chaque rendu du parent) : les décochages de l'utilisateur sont conservés.
  const recipientsSig = useMemo(() => JSON.stringify(recipients.map(recipientKey)), [recipients]);
  const knownKeys = useRef<Set<string>>(new Set(recipients.map(recipientKey)));
  useEffect(() => {
    const keys = recipients.map(recipientKey);
    setSelectedKeys((prev) => {
      const next = new Set<string>();
      keys.forEach((k) => { if (prev.has(k) || !knownKeys.current.has(k)) next.add(k); });
      extraRecipients.forEach((r) => { const k = recipientKey(r); if (prev.has(k)) next.add(k); });
      return next;
    });
    knownKeys.current = new Set(keys);
  }, [recipientsSig]); // eslint-disable-line react-hooks/exhaustive-deps

  const allRecipients = useMemo(() => {
    const seen = new Set(recipients.map(recipientKey));
    return [...recipients, ...extraRecipients.filter((r) => !seen.has(recipientKey(r)))];
  }, [recipients, extraRecipients]);

  // Lignes éditables : id = identité d'origine, rec = destinataire avec son rôle EFFECTIF.
  const rows = useMemo(
    () => allRecipients.map((r) => {
      const id = recipientKey(r);
      return { id, rec: { ...r, role: roleOverrides[id] ?? r.role } as CertificateRecipient };
    }),
    [allRecipients, roleOverrides],
  );

  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(({ rec }) =>
      rec.name.toLowerCase().includes(q) ||
      (rec.affiliation || "").toLowerCase().includes(q) ||
      (rec.communicationTitle || "").toLowerCase().includes(q));
  }, [rows, search]);

  const roleCounts = useMemo(() => {
    const c = Object.fromEntries(ALL_ROLES.map((r) => [r, 0])) as Record<CertificateRole, number>;
    rows.forEach(({ rec }) => c[rec.role]++);
    return c;
  }, [rows]);

  // Destinataires réellement exportés : cochés + rôle retenu. Le titre de communication
  // n'a de sens que pour un « Auteur / Présentateur » (sinon il est retiré), et les
  // doublons créés par un changement de rôle sont fusionnés (une attestation par personne/rôle).
  const filteredRecipients = useMemo(() => {
    const seen = new Set<string>();
    const out: CertificateRecipient[] = [];
    for (const { id, rec } of rows) {
      if (!selectedKeys.has(id) || !roleFilter.has(rec.role)) continue;
      const final: CertificateRecipient = rec.role === "speaker" ? rec : { ...rec, communicationTitle: undefined };
      const k = recipientKey(final);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(final);
    }
    return out;
  }, [rows, selectedKeys, roleFilter]);

  const setRoleFor = (id: string, original: CertificateRole, role: CertificateRole) => {
    setRoleOverrides((prev) => {
      const next = { ...prev };
      if (role === original) delete next[id]; else next[id] = role;
      return next;
    });
  };

  const originalRoleOf = (id: string) => allRecipients.find((r) => recipientKey(r) === id)?.role ?? "participant";

  const bulkSetRole = (role: CertificateRole) => {
    setRoleOverrides((prev) => {
      const next = { ...prev };
      visibleRows.forEach(({ id }) => { if (role === originalRoleOf(id)) delete next[id]; else next[id] = role; });
      return next;
    });
  };

  const swapRoles = (a: CertificateRole, b: CertificateRole) => {
    setRoleOverrides((prev) => {
      const next = { ...prev };
      visibleRows.forEach(({ id, rec }) => {
        const role = swapRole(rec.role, a, b);
        if (role === originalRoleOf(id)) delete next[id]; else next[id] = role;
      });
      return next;
    });
    toast.success(`Rôles permutés : ${CERT_ROLE_LABEL[a]} ⇄ ${CERT_ROLE_LABEL[b]}`);
  };

  const toggleRoleFilter = (role: CertificateRole) =>
    setRoleFilter((prev) => { const n = new Set(prev); if (n.has(role)) n.delete(role); else n.add(role); return n; });

  const buildOpts = (): CertificateOptions => ({
    conferenceName,
    eventDate: eventDate || "—",
    eventLocation: eventLocation || "—",
    organizer: organizer || undefined,
    signatoryLine: signatoryLine || undefined,
    signatoryName: signatoryName || undefined,
    logoDataUrl,
    signatureDataUrl,
    signatureImages: Object.keys(signatureImages).length ? signatureImages : undefined,
    showQrCode,
    qrBaseUrl: qrBaseUrl || undefined,
    showCommunicationTitle,
    showRole,
    templateId,
    layout,
  });

  const handleExportPDF = async () => {
    if (filteredRecipients.length === 0) { toast.error("Sélectionnez au moins un destinataire"); return; }
    setBusy(true);
    try {
      await exportCertificatesPDF(filteredRecipients, buildOpts());
      toast.success(`${filteredRecipients.length} attestations PDF générées !`);
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de la génération PDF");
    } finally { setBusy(false); }
  };

  const handleExportPPTX = async () => {
    if (!pptxFile) { toast.error("Chargez d'abord un modèle .pptx"); return; }
    if (filteredRecipients.length === 0) { toast.error("Sélectionnez au moins un destinataire"); return; }
    setBusy(true);
    try {
      await exportCertificatesPPTX(pptxFile, filteredRecipients, buildOpts());
      toast.success(`${filteredRecipients.length} attestations .pptx générées (zip) !`);
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Erreur lors de la génération PPTX");
    } finally { setBusy(false); }
  };

  const tpl = getCertificateTemplate(templateId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[92vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-primary" />
            Conception des attestations
          </DialogTitle>
          <DialogDescription>
            Choisissez une maquette, ajustez la disposition de chaque bloc, ou téléversez un modèle .pptx avec placeholders.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="template" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="template">Maquette</TabsTrigger>
            <TabsTrigger value="layout">Disposition</TabsTrigger>
            <TabsTrigger value="content">Contenu</TabsTrigger>
            <TabsTrigger value="recipients">Destinataires ({filteredRecipients.length}/{allRecipients.length})</TabsTrigger>
            <TabsTrigger value="pptx">Modèle .pptx</TabsTrigger>
          </TabsList>

          {/* TEMPLATE GALLERY */}
          <TabsContent value="template" className="overflow-auto pr-2">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {CERTIFICATE_TEMPLATES.map((t) => {
                const selected = t.id === templateId;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTemplateId(t.id)}
                    className={cn(
                      "relative rounded-lg border-2 p-2 text-left transition-all hover:scale-[1.02]",
                      selected ? "border-primary ring-2 ring-primary/30" : "border-border",
                    )}
                  >
                    <TemplateThumbnail tpl={t} />
                    <p className="mt-1.5 text-xs font-medium truncate">{t.label}</p>
                  </button>
                );
              })}
            </div>
          </TabsContent>

          {/* LAYOUT EDITOR */}
          <TabsContent value="layout" className="overflow-hidden flex-1">
            <CertificateLayoutEditor layout={layout} onChange={setLayout} template={tpl} />
          </TabsContent>

          {/* CONTENT */}
          <TabsContent value="content" className="overflow-auto pr-2 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Date(s) de l'événement</Label>
                <Input value={eventDate} onChange={(e) => setEventDate(e.target.value)} placeholder="ex. 12-14 mars 2026" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Lieu</Label>
                <Input value={eventLocation} onChange={(e) => setEventLocation(e.target.value)} placeholder="ex. Université de Tunis" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs">Organisateur (pied de page)</Label>
                <Input value={organizer} onChange={(e) => setOrganizer(e.target.value)} placeholder="ex. Comité scientifique de la conférence" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Mention du signataire</Label>
                <Input value={signatoryLine} onChange={(e) => setSignatoryLine(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Nom du signataire</Label>
                <Input value={signatoryName} onChange={(e) => setSignatoryName(e.target.value)} placeholder="Pr. Nom Prénom" />
              </div>
            </div>

            <div className="border-t border-border pt-3 space-y-3">
              <Row label="Afficher le titre de la communication (auteurs)">
                <Switch checked={showCommunicationTitle} onCheckedChange={setShowCommunicationTitle} />
              </Row>
              <Row label="Différencier l'attestation par rôle">
                <Switch checked={showRole} onCheckedChange={setShowRole} />
              </Row>
              <Row label="Ajouter un QR de vérification">
                <Switch checked={showQrCode} onCheckedChange={setShowQrCode} />
              </Row>
              {showQrCode && (
                <div className="space-y-1.5">
                  <Label className="text-xs">URL de vérification (optionnel)</Label>
                  <Input value={qrBaseUrl} onChange={(e) => setQrBaseUrl(e.target.value)} placeholder="https://exemple.org/verif" />
                </div>
              )}
            </div>

            <div className="border-t border-border pt-3 grid grid-cols-2 gap-3">
              <FileButton label="Logo organisateur" current={logoDataUrl} onChange={setLogoDataUrl} />
              <FileButton label="Image de signature" current={signatureDataUrl} onChange={setSignatureDataUrl} />
            </div>
          </TabsContent>

          {/* RECIPIENTS */}
          <TabsContent value="recipients" className="flex-1 min-h-0 overflow-hidden flex flex-col">
            <ListStatusNotice
              unscheduledCount={unscheduledCount} includeUnscheduled={includeUnscheduled}
              onIncludeUnscheduledChange={(v) => onIncludeUnscheduledChange?.(v)}
              unverifiedCount={unverifiedCount} total={allRecipients.length} noun="attestation"
            />
            <ManualRecipientRow
              onAdd={(name, role, affiliation) => {
                const rec: CertificateRecipient = { name, role, affiliation: affiliation || undefined };
                if (rows.some((r) => recipientKey(r.rec) === recipientKey(rec))) return;
                setExtraRecipients((prev) => [...prev, rec]);
                setSelectedKeys((prev) => new Set(prev).add(recipientKey(rec)));
              }}
            />

            <div className="flex flex-wrap items-center gap-2 pb-2">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input className="h-8 pl-7 text-sm" placeholder="Rechercher un participant…" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <Select onValueChange={(v) => bulkSetRole(v as CertificateRole)}>
                <SelectTrigger className="h-8 w-[200px] text-xs"><SelectValue placeholder="Attribuer un rôle (filtrés)" /></SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((r) => <SelectItem key={r.value} value={r.value}>Tous → {r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="pb-2">
              <RoleSwapBar
                roles={ROLE_OPTIONS}
                defaultA="speaker"
                defaultB="participant"
                countOf={(r) => visibleRows.filter((x) => x.rec.role === r).length}
                onSwap={swapRoles}
              />
            </div>

            <div className="rounded-md border border-border bg-muted/20 p-2 mb-2 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-medium text-muted-foreground">
                  Générer les attestations pour : <span className="text-foreground">{filteredRecipients.length}</span> sélectionné{filteredRecipients.length > 1 ? "s" : ""}
                </p>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => setSelectedKeys(new Set(rows.map((r) => r.id)))}>Tout cocher</Button>
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => setSelectedKeys(new Set())}>Tout décocher</Button>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                {ALL_ROLES.map((r) => {
                  const active = roleFilter.has(r);
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => toggleRoleFilter(r)}
                      className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 transition",
                        active ? "border-primary/60 bg-primary/10 text-primary" : "opacity-40 grayscale hover:opacity-70")}
                      title={active ? "Cliquer pour exclure ce rôle" : "Cliquer pour inclure ce rôle"}
                    >
                      <span className="font-semibold">{roleCounts[r]}</span> {CERT_ROLE_LABEL[r]}
                    </button>
                  );
                })}
                <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => setRoleFilter(new Set(ALL_ROLES))}>Tous les rôles</Button>
                <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => setRoleFilter(new Set())}>Aucun</Button>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto border border-border rounded-md">
              <div className="divide-y divide-border">
                {visibleRows.map(({ id, rec }) => {
                  const checked = selectedKeys.has(id);
                  const isExtra = extraRecipients.some((e) => recipientKey(e) === id);
                  const original = originalRoleOf(id);
                  const changed = rec.role !== original;
                  return (
                    <div key={id} className="flex items-center gap-2 px-3 py-2 hover:bg-muted/40">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(c) => {
                          const next = new Set(selectedKeys);
                          if (c) next.add(id); else next.delete(id);
                          setSelectedKeys(next);
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">
                          {rec.name}
                          {rec.role === "speaker" && rec.communicationTitle
                            ? <span className="font-normal text-muted-foreground"> — {rec.communicationTitle}</span> : null}
                        </div>
                        {rec.affiliation && <div className="text-xs text-muted-foreground truncate">{rec.affiliation}</div>}
                      </div>
                      {changed && <span className="text-[10px] text-primary" title={`Rôle d'origine : ${CERT_ROLE_LABEL[original]}`}>modifié</span>}
                      <Select value={rec.role} onValueChange={(v) => setRoleFor(id, original, v as CertificateRole)}>
                        <SelectTrigger className="h-7 w-[170px] text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ROLE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {isExtra && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => {
                            setExtraRecipients((prev) => prev.filter((p) => recipientKey(p) !== id));
                            setSelectedKeys((prev) => { const n = new Set(prev); n.delete(id); return n; });
                            setRoleOverrides((prev) => { const n = { ...prev }; delete n[id]; return n; });
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  );
                })}
                {visibleRows.length === 0 && (
                  <div className="px-3 py-8 text-center text-xs text-muted-foreground">Aucun participant trouvé.</div>
                )}
              </div>
            </div>
          </TabsContent>


          {/* PPTX */}
          <TabsContent value="pptx" className="overflow-auto pr-2 space-y-4">
            <div className="rounded-lg border border-dashed border-border p-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                Téléversez un fichier <strong>.pptx</strong> contenant des balises de remplacement. ChronoConf
                produira un fichier .pptx personnalisé par destinataire (livrés dans un .zip).
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" className="gap-2" asChild>
                  <label>
                    <Upload className="h-4 w-4" />
                    {pptxFile ? "Changer de modèle" : "Charger un modèle .pptx"}
                    <input
                      type="file"
                      // Pas de filtre "accept" : sur macOS (Safari/WebKit) la combinaison extension + type MIME
                      // grise TOUS les fichiers, .pptx compris. Le contenu est vérifié par inspectPptxTemplate().
                      className="hidden"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        if (!f) return;
                        setPptxLoading(true);
                        const info = await inspectPptxTemplate(f);
                        setPptxLoading(false);
                        if (!info.ok) { toast.error(info.error ?? "Modèle .pptx invalide"); return; }
                        setPptxFile(f);
                        setPptxInfo(info);
                        if (info.found.length === 0) toast.warning("Aucune balise {{…}} reconnue dans ce modèle : les attestations seraient identiques.");
                        else toast.success(`Modèle chargé : ${info.slides} diapositive${info.slides > 1 ? "s" : ""}, ${info.found.length} balise${info.found.length > 1 ? "s" : ""} reconnue${info.found.length > 1 ? "s" : ""}.`);
                      }}
                    />
                  </label>
                </Button>
                {pptxFile && (
                  <span className="text-sm text-muted-foreground truncate">
                    <FileText className="inline h-3.5 w-3.5 mr-1" />
                    {pptxFile.name}
                  </span>
                )}
                {pptxLoading && <span className="text-xs text-muted-foreground">Vérification…</span>}
              </div>
              {pptxInfo && (
                <div className="text-xs space-y-1">
                  <p>
                    {pptxInfo.slides} diapositive{pptxInfo.slides > 1 ? "s" : ""} · balises reconnues :{" "}
                    {pptxInfo.found.length ? pptxInfo.found.map((t) => <code key={t} className="font-mono mr-1">{`{{${t}}}`}</code>) : <em>aucune</em>}
                  </p>
                  {pptxInfo.unknown.length > 0 && (
                    <p className="text-warning">
                      Balises non reconnues (resteront visibles) :{" "}
                      {pptxInfo.unknown.map((t) => <code key={t} className="font-mono mr-1">{`{{${t}}}`}</code>)}
                    </p>
                  )}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Balises disponibles :{" "}
                {PPTX_TEXT_TAGS.map((t) => <code key={t} className="font-mono mr-1">{`{{${t}}}`}</code>)}
                <code className="font-mono mr-1">{`{{qr}}`}</code><code className="font-mono">{`{{signature}}`}</code>
              </p>
            </div>

            <div className="rounded-lg border border-border p-4 space-y-3">
              <div>
                <p className="text-sm font-medium">Signatures numériques</p>
                <p className="text-xs text-muted-foreground">
                  La balise <code className="font-mono">{`{{signature}}`}</code> utilise la signature « par défaut ».
                  Pour plusieurs signataires, utilisez <code className="font-mono">{`{{signature1}}`}</code>,{" "}
                  <code className="font-mono">{`{{signature2}}`}</code>, etc. Chaque zone de texte sera remplacée
                  par l'image correspondante (mêmes dimensions).
                </p>
              </div>

              <FileButton label="Signature par défaut · {{signature}}" current={signatureDataUrl} onChange={setSignatureDataUrl} />

              <div className="space-y-2">
                {Object.keys(signatureImages)
                  .map((k) => parseInt(k, 10))
                  .sort((a, b) => a - b)
                  .map((idx) => (
                    <div key={idx} className="flex items-end gap-2">
                      <div className="flex-1">
                        <FileButton
                          label={`Signature ${idx} · {{signature${idx}}}`}
                          current={signatureImages[idx]}
                          onChange={(v) => {
                            setSignatureImages((prev) => {
                              const next = { ...prev };
                              if (v === undefined) delete next[idx];
                              else next[idx] = v;
                              return next;
                            });
                          }}
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setSignatureImages((prev) => {
                            const next = { ...prev };
                            delete next[idx];
                            return next;
                          })
                        }
                      >
                        Supprimer
                      </Button>
                    </div>
                  ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => {
                    const used = Object.keys(signatureImages).map((k) => parseInt(k, 10));
                    let next = 1;
                    while (used.includes(next)) next++;
                    setSignatureImages((prev) => ({ ...prev, [next]: "" }));
                  }}
                >
                  <Upload className="h-4 w-4" />
                  Ajouter une signature ({`{{signature${(() => {
                    const used = Object.keys(signatureImages).map((k) => parseInt(k, 10));
                    let n = 1; while (used.includes(n)) n++; return n;
                  })()}}}`})
                </Button>
              </div>
            </div>
            <div className="rounded-lg bg-muted/40 p-4 space-y-2">
              <p className="text-sm font-medium">Placeholders disponibles</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs font-mono text-muted-foreground">
                <span>{`{{nom}}`} / {`{{name}}`}</span>
                <span>{`{{role}}`}</span>
                <span>{`{{affiliation}}`}</span>
                <span>{`{{titre}}`} / {`{{title}}`}</span>
                <span>{`{{conference}}`}</span>
                <span>{`{{date}}`}</span>
                <span>{`{{lieu}}`} / {`{{location}}`}</span>
                <span>{`{{organisateur}}`}</span>
                <span>{`{{signataire}}`}</span>
                <span className="text-primary font-semibold">{`{{codeqr}}`} / {`{{qrcode}}`}</span>
                <span className="text-primary font-semibold">{`{{signature}}`} / {`{{signature1}}`}, {`{{signature2}}`}…</span>
              </div>
              <p className="text-xs text-muted-foreground pt-1">
                Insérez ces balises dans n'importe quelle zone de texte de votre slide.
                Les balises spéciales <strong>{`{{codeqr}}`}</strong> et <strong>{`{{signature}}`}</strong> remplacent
                la zone de texte par une image (QR code / signature numérique téléversée), aux dimensions exactes de la zone.
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
          <p className="text-xs text-muted-foreground">
            Maquette : <strong>{tpl.label}</strong> · {filteredRecipients.length} destinataire{filteredRecipients.length > 1 ? "s" : ""}
          </p>
          <div className="flex items-center gap-2">
            <Button onClick={handleExportPPTX} variant="outline" disabled={busy || !pptxFile} className="gap-2">
              <FileText className="h-4 w-4" />
              Générer .pptx (zip)
            </Button>
            <Button onClick={handleExportPDF} disabled={busy} className="gap-2 gradient-accent text-accent-foreground">
              <Download className="h-4 w-4" />
              Générer le PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-sm">{label}</p>
      {children}
    </div>
  );
}

function FileButton({ label, current, onChange }: { label: string; current?: string; onChange: (v: string | undefined) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {current ? (
        <div className="flex items-center gap-2">
          <img src={current} alt="" className="h-10 w-10 object-contain rounded border border-border bg-white" />
          <Button variant="outline" size="sm" onClick={() => onChange(undefined)}>Retirer</Button>
        </div>
      ) : (
        <Button variant="outline" size="sm" className="gap-2 w-full" asChild>
          <label>
            <Upload className="h-4 w-4" />
            Charger
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const reader = new FileReader();
                reader.onload = (ev) => onChange(ev.target?.result as string);
                reader.readAsDataURL(f);
                e.target.value = "";
              }}
            />
          </label>
        </Button>
      )}
    </div>
  );
}

function TemplateThumbnail({ tpl }: { tpl: typeof CERTIFICATE_TEMPLATES[number] }) {
  const bg = `rgb(${tpl.bg.join(",")})`;
  const primary = `rgb(${tpl.primary.join(",")})`;
  const accent = `rgb(${tpl.accent.join(",")})`;
  const text = `rgb(${tpl.text.join(",")})`;

  // Render a tiny preview based on family
  return (
    <div
      className="aspect-[1.4/1] w-full rounded border border-border overflow-hidden relative"
      style={{ background: bg }}
    >
      {tpl.family === "classic" && (
        <div className="absolute inset-1 border" style={{ borderColor: primary }}>
          <div className="absolute inset-0.5 border" style={{ borderColor: primary, opacity: 0.5 }} />
        </div>
      )}
      {tpl.family === "elegant" && (
        <div className="absolute inset-1 border" style={{ borderColor: primary }}>
          {[["top-0","left-0"],["top-0","right-0"],["bottom-0","left-0"],["bottom-0","right-0"]].map((p,i) => (
            <div key={i} className={cn("absolute w-2 h-2", ...p)} style={{ background: accent, border: `1px solid ${primary}` }} />
          ))}
        </div>
      )}
      {tpl.family === "modern" && (
        <>
          <div className="absolute top-0 inset-x-0 h-2" style={{ background: primary }} />
          <div className="absolute top-2 left-0 bottom-0 w-1" style={{ background: accent }} />
        </>
      )}
      {tpl.family === "minimal" && (
        <div className="absolute inset-1.5 border" style={{ borderColor: primary }}>
          <div className="absolute top-0 left-0 h-0.5 w-1/3" style={{ background: primary }} />
        </div>
      )}
      {tpl.family === "academic" && (
        <>
          <div className="absolute top-0 inset-x-0 h-1.5" style={{ background: primary }} />
          <div className="absolute bottom-0 inset-x-0 h-1.5" style={{ background: primary }} />
          <div className="absolute inset-2 border" style={{ borderColor: accent }} />
        </>
      )}
      {tpl.family === "festive" && (
        <>
          <div className="absolute top-0 left-0 w-0 h-0" style={{ borderTop: `14px solid ${primary}`, borderRight: `14px solid transparent` }} />
          <div className="absolute bottom-0 right-0 w-0 h-0" style={{ borderBottom: `14px solid ${primary}`, borderLeft: `14px solid transparent` }} />
          <div className="absolute top-0 right-0 w-0 h-0" style={{ borderTop: `10px solid ${accent}`, borderLeft: `10px solid transparent` }} />
        </>
      )}
      {tpl.family === "ribbon" && (
        <>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-3" style={{ background: primary }} />
          <div className="absolute inset-x-1 top-4 bottom-1 border" style={{ borderColor: primary }} />
        </>
      )}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-2">
        <div className="text-[7px] font-bold tracking-wider uppercase" style={{ color: primary, fontFamily: tpl.headingFont === "times" ? "serif" : "sans-serif" }}>
          Attestation
        </div>
        <div className="h-px w-6" style={{ background: primary }} />
        <div className="text-[6px]" style={{ color: text }}>Nom Prénom</div>
      </div>
    </div>
  );
}

function ManualRecipientRow({ onAdd }: { onAdd: (name: string, role: CertificateRole, affiliation?: string) => void }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState<CertificateRole>("organizer");
  const [affiliation, setAffiliation] = useState("");
  const handle = () => {
    const n = name.trim();
    if (!n) return;
    onAdd(n, role, affiliation.trim() || undefined);
    setName(""); setAffiliation("");
  };
  return (
    <div className="rounded-md border border-dashed border-border bg-muted/30 p-2 mb-2 flex flex-wrap gap-2 items-center">
      <span className="text-[11px] font-medium text-muted-foreground px-1">Ajouter :</span>
      <Input className="h-8 text-sm flex-1 min-w-[140px]" placeholder="Nom complet" value={name} onChange={(e) => setName(e.target.value)} />
      <Input className="h-8 text-sm flex-1 min-w-[140px]" placeholder="Affiliation (optionnel)" value={affiliation} onChange={(e) => setAffiliation(e.target.value)} />
      <Select value={role} onValueChange={(v) => setRole(v as CertificateRole)}>
        <SelectTrigger className="h-8 w-[170px] text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          {(Object.keys(CERT_ROLE_LABEL) as CertificateRole[]).map((r) => (
            <SelectItem key={r} value={r}>{CERT_ROLE_LABEL[r]}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button size="sm" className="h-8" onClick={handle} disabled={!name.trim()}>Ajouter</Button>
    </div>
  );
}
