import { useRef, useState } from "react";
import {
  CertificateLayout,
  CertificateBlock,
  BlockId,
  BLOCK_LABEL,
  BlockShape,
  BlockAlign,
  PAGE_W,
  PAGE_H,
  defaultLayout,
  createCustomBlock,
  CertificateTemplate,
} from "@/lib/exportCertificates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RotateCcw, Eye, EyeOff, Plus, Copy, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  layout: CertificateLayout;
  onChange: (layout: CertificateLayout) => void;
  template: CertificateTemplate;
}

const PREVIEW_W = 600; // px
const PREVIEW_H = (PREVIEW_W * PAGE_H) / PAGE_W;
const MM_TO_PX = PREVIEW_W / PAGE_W;

export default function CertificateLayoutEditor({ layout, onChange, template }: Props) {
  const [selected, setSelected] = useState<string>(layout[0]?.key ?? "heading");
  const surfaceRef = useRef<HTMLDivElement>(null);

  const sel = layout.find((b) => b.key === selected);

  const update = (key: string, patch: Partial<CertificateBlock>) => {
    onChange(layout.map((b) => (b.key === key ? { ...b, ...patch } : b)));
  };

  const addCustom = () => {
    const nb = createCustomBlock();
    onChange([...layout, nb]);
    setSelected(nb.key);
  };

  const duplicateSelected = () => {
    if (!sel) return;
    const copy: CertificateBlock = {
      ...sel,
      key: `${sel.id}-${Math.random().toString(36).slice(2, 8)}`,
      x: Math.min(PAGE_W - 5, sel.x + 6),
      y: Math.min(PAGE_H - 5, sel.y + 6),
    };
    onChange([...layout, copy]);
    setSelected(copy.key);
  };

  const removeSelected = () => {
    if (!sel) return;
    const next = layout.filter((b) => b.key !== sel.key);
    onChange(next);
    setSelected(next[0]?.key ?? "");
  };

  const startDrag = (e: React.PointerEvent, key: string, mode: "move" | "resize") => {
    e.preventDefault();
    e.stopPropagation();
    setSelected(key);
    const block = layout.find((b) => b.key === key);
    if (!block) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const start = { x: block.x, y: block.y, w: block.w, h: block.h };
    const onMove = (ev: PointerEvent) => {
      const dxMm = (ev.clientX - startX) / MM_TO_PX;
      const dyMm = (ev.clientY - startY) / MM_TO_PX;
      if (mode === "move") {
        update(key, {
          x: clamp(start.x + dxMm, 5, PAGE_W - 5),
          y: clamp(start.y + dyMm, 5, PAGE_H - 5),
        });
      } else {
        update(key, {
          w: clamp(start.w + dxMm * 2, 4, PAGE_W),
          h: clamp(start.h + dyMm * 2, 1, PAGE_H),
        });
      }
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <div className="grid grid-cols-[1fr_280px] gap-3 h-full">
      {/* PREVIEW SURFACE */}
      <div className="space-y-2 overflow-auto">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-xs text-muted-foreground">
            Glissez les blocs · poignée bas-droite pour redimensionner.
          </p>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="outline" className="gap-1" onClick={addCustom}>
              <Plus className="h-3.5 w-3.5" /> Ajouter
            </Button>
            <Button size="sm" variant="outline" className="gap-1" onClick={duplicateSelected} disabled={!sel}>
              <Copy className="h-3.5 w-3.5" /> Dupliquer
            </Button>
            <Button size="sm" variant="outline" className="gap-1 text-destructive" onClick={removeSelected} disabled={!sel}>
              <Trash2 className="h-3.5 w-3.5" /> Supprimer
            </Button>
            <Button size="sm" variant="outline" className="gap-1" onClick={() => onChange(defaultLayout())}>
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </Button>
          </div>
        </div>
        <div
          ref={surfaceRef}
          className="relative border border-border rounded-md mx-auto shadow-sm"
          style={{
            width: PREVIEW_W,
            height: PREVIEW_H,
            background: `rgb(${template.bg.join(",")})`,
          }}
        >
          {layout.map((b) => {
            const isSel = b.key === selected;
            const left = (b.x - b.w / 2) * MM_TO_PX;
            const top = (b.y - b.h / 2) * MM_TO_PX;
            const w = b.w * MM_TO_PX;
            const h = b.h * MM_TO_PX;
            const label = b.textOverride && b.id === "custom" ? b.textOverride : BLOCK_LABEL[b.id];
            return (
              <div
                key={b.key}
                onPointerDown={(e) => startDrag(e, b.key, "move")}
                onClick={() => setSelected(b.key)}
                className={cn(
                  "absolute select-none cursor-move text-[9px] flex items-center justify-center text-center px-1 transition-opacity",
                  !b.visible && "opacity-30",
                  isSel ? "ring-2 ring-primary z-10" : "ring-1 ring-border/60 hover:ring-primary/50",
                )}
                style={{
                  left, top, width: Math.max(8, w), height: Math.max(8, h),
                  background: isSel ? "rgba(99,102,241,0.12)" : "rgba(0,0,0,0.04)",
                  borderRadius: b.shape === "rounded" ? 6 : b.shape === "ellipse" ? "50%" : 0,
                  fontWeight: b.bold ? 700 : 400,
                  fontStyle: b.italic ? "italic" : "normal",
                  color: `rgb(${(b.color ?? template.text).join(",")})`,
                }}
                title={label}
              >
                <span className="truncate pointer-events-none">{label}</span>
                {isSel && (
                  <div
                    onPointerDown={(e) => startDrag(e, b.key, "resize")}
                    className="absolute -bottom-1 -right-1 w-3 h-3 bg-primary rounded-sm cursor-nwse-resize"
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* INSPECTOR */}
      <ScrollArea className="border border-border rounded-md">
        <div className="p-3 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Bloc</Label>
            <Select value={selected} onValueChange={(v) => setSelected(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {layout.map((b) => (
                  <SelectItem key={b.key} value={b.key}>
                    {b.id === "custom" && b.textOverride ? `${BLOCK_LABEL.custom} — ${b.textOverride.slice(0, 24)}` : BLOCK_LABEL[b.id]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {sel && (
            <>
              <div className="flex items-center justify-between">
                <Label className="text-xs flex items-center gap-1">
                  {sel.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                  Visible
                </Label>
                <Switch checked={sel.visible} onCheckedChange={(v) => update(sel.key, { visible: v })} />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <NumField label="X (mm)" value={sel.x} onChange={(v) => update(sel.key, { x: v })} />
                <NumField label="Y (mm)" value={sel.y} onChange={(v) => update(sel.key, { y: v })} />
                <NumField label="Largeur" value={sel.w} onChange={(v) => update(sel.key, { w: v })} />
                <NumField label="Hauteur" value={sel.h} onChange={(v) => update(sel.key, { h: v })} />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Texte personnalisé (optionnel)</Label>
                <Input
                  value={sel.textOverride ?? ""}
                  onChange={(e) => update(sel.key, { textOverride: e.target.value || undefined })}
                  placeholder="Laisser vide = automatique"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <NumField label="Taille (pt)" value={sel.fontSize ?? 12} step={1} onChange={(v) => update(sel.key, { fontSize: v })} />
                <div className="space-y-1.5">
                  <Label className="text-xs">Alignement</Label>
                  <Select value={sel.align ?? "center"} onValueChange={(v) => update(sel.key, { align: v as BlockAlign })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="left">Gauche</SelectItem>
                      <SelectItem value="center">Centre</SelectItem>
                      <SelectItem value="right">Droite</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-xs">
                  <Switch checked={!!sel.bold} onCheckedChange={(v) => update(sel.key, { bold: v })} />
                  Gras
                </label>
                <label className="flex items-center gap-1.5 text-xs">
                  <Switch checked={!!sel.italic} onCheckedChange={(v) => update(sel.key, { italic: v })} />
                  Italique
                </label>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Forme de fond</Label>
                <Select value={sel.shape ?? "none"} onValueChange={(v) => update(sel.key, { shape: v as BlockShape })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucune</SelectItem>
                    <SelectItem value="rect">Rectangle</SelectItem>
                    <SelectItem value="rounded">Rect. arrondi</SelectItem>
                    <SelectItem value="ellipse">Ellipse</SelectItem>
                    <SelectItem value="underline">Trait / soulignement</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <ColorField label="Texte" value={sel.color ?? template.text} onChange={(c) => update(sel.key, { color: c })} />
                <ColorField label="Fond" value={sel.shapeFill ?? template.accent} onChange={(c) => update(sel.key, { shapeFill: c })} />
                <ColorField label="Bordure" value={sel.shapeStroke ?? template.primary} onChange={(c) => update(sel.key, { shapeStroke: c })} />
              </div>

              <div className="pt-2 border-t border-border">
                <div className="flex items-center justify-between gap-2">
                  <Button size="sm" variant="outline" className="gap-1 flex-1" onClick={duplicateSelected}>
                    <Copy className="h-3.5 w-3.5" /> Dupliquer
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1 flex-1 text-destructive" onClick={removeSelected}>
                    <Trash2 className="h-3.5 w-3.5" /> Supprimer
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function clamp(v: number, lo: number, hi: number) { return Math.min(hi, Math.max(lo, v)); }

function NumField({ label, value, onChange, step = 0.5 }: { label: string; value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        step={step}
        value={Number.isFinite(value) ? +value.toFixed(2) : 0}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="h-8"
      />
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: [number, number, number]; onChange: (c: [number, number, number]) => void }) {
  const hex = "#" + value.map((c) => Math.max(0, Math.min(255, c)).toString(16).padStart(2, "0")).join("");
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <input
        type="color"
        value={hex}
        onChange={(e) => {
          const v = e.target.value;
          onChange([parseInt(v.slice(1, 3), 16), parseInt(v.slice(3, 5), 16), parseInt(v.slice(5, 7), 16)]);
        }}
        className="h-8 w-full rounded border border-border bg-background cursor-pointer"
      />
    </div>
  );
}
