import { useState, useCallback, useMemo } from "react";
import { ConferenceSchedule, Article, SpecialSlot, moveSlot, swapSlots, getSlotSnapshot, restoreSlotSnapshot, removeSpecialSlot, updateSpecialSlot, ScheduleSlot, MoveResult, getDayHours } from "@/lib/conference";
import { cn } from "@/lib/utils";
import { GripVertical, ArrowLeftRight, MousePointerClick, Undo2, X, Star, Flag, Award, Coffee, Mic, MoreHorizontal, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  DragEndEvent,
  DragStartEvent,
  DragMoveEvent,
  DragOverlay,
  pointerWithin,
} from "@dnd-kit/core";

interface ScheduleGridProps {
  schedule: ConferenceSchedule;
  articles: Article[];
  selectedDay: number;
  onSlotMoved?: () => void;
  onEditSpecialSlot?: (slot: SpecialSlot) => void;
  onSelectDay?: (day: number) => void;
}

type InteractionMode = "drag" | "swap";

const SPECIAL_SLOT_ICONS: Record<string, React.ReactNode> = {
  keynote: <Star className="h-3 w-3" />,
  opening: <Flag className="h-3 w-3" />,
  closing: <Award className="h-3 w-3" />,
  break: <Coffee className="h-3 w-3" />,
  ceremony: <Mic className="h-3 w-3" />,
  other: <MoreHorizontal className="h-3 w-3" />,
};

const SPECIAL_SLOT_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  keynote: { bg: "hsl(35, 100%, 25%)", border: "hsl(35, 100%, 45%)", text: "hsl(45, 100%, 90%)" },
  opening: { bg: "hsl(160, 80%, 18%)", border: "hsl(160, 70%, 40%)", text: "hsl(160, 80%, 90%)" },
  closing: { bg: "hsl(270, 70%, 25%)", border: "hsl(270, 60%, 50%)", text: "hsl(270, 80%, 92%)" },
  break: { bg: "hsl(210, 60%, 22%)", border: "hsl(210, 50%, 45%)", text: "hsl(210, 70%, 90%)" },
  ceremony: { bg: "hsl(340, 75%, 25%)", border: "hsl(340, 65%, 50%)", text: "hsl(340, 80%, 92%)" },
  other: { bg: "hsl(0, 0%, 25%)", border: "hsl(0, 0%, 50%)", text: "hsl(0, 0%, 90%)" },
};

const getCategoryColor = (category: string): string => {
  let hash = 0;
  for (let i = 0; i < category.length; i++) hash = category.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360}, 55%, 92%)`;
};
const getCategoryBorderColor = (category: string): string => {
  let hash = 0;
  for (let i = 0; i < category.length; i++) hash = category.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360}, 55%, 65%)`;
};

function parseTime(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function fmtTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

// --- Draggable slot wrapper ---
interface DraggableSlotProps {
  id: string;
  data: Record<string, unknown>;
  enabled: boolean;
  children: (args: { setNodeRef: (el: HTMLElement | null) => void; listeners: any; attributes: any; isDragging: boolean }) => React.ReactNode;
}
const DraggableSlot = ({ id, data, enabled, children }: DraggableSlotProps) => {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({ id, data, disabled: !enabled });
  return <>{children({ setNodeRef, listeners, attributes, isDragging })}</>;
};

// --- Droppable room column wrapper ---
const DroppableRoom = ({ id, children, className, style }: { id: string; children: React.ReactNode; className?: string; style?: React.CSSProperties }) => {
  const { setNodeRef, isOver } = useDroppable({ id, data: { type: "room", room: id.replace(/^room:/, "") } });
  return (
    <div ref={setNodeRef} className={cn(className, isOver && "ring-2 ring-inset ring-primary/30")} style={style}>
      {children}
    </div>
  );
};

// --- Droppable day button ---
const DroppableDay = ({ day, disabled, children }: { day: number; disabled: boolean; children: React.ReactNode }) => {
  const { setNodeRef, isOver } = useDroppable({ id: `day:${day}`, data: { type: "day", day }, disabled });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "text-xs h-7 px-3 rounded-md border-2 border-dashed transition-all flex items-center",
        disabled
          ? "border-muted-foreground/20 text-muted-foreground/40 cursor-not-allowed"
          : "border-primary/40 text-primary hover:bg-primary/10 cursor-copy",
        isOver && !disabled && "bg-primary/20 border-primary scale-105"
      )}
    >
      {children}
    </div>
  );
};

const ScheduleGrid = ({ schedule, articles, selectedDay, onSlotMoved, onEditSpecialSlot, onSelectDay }: ScheduleGridProps) => {
  const [mode, setMode] = useState<InteractionMode>("drag");
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [undoSnapshot, setUndoSnapshot] = useState<ScheduleSlot[] | null>(null);
  const [highlightedSlots, setHighlightedSlots] = useState<Set<string>>(new Set());
  const [highlightedSpecialSlots, setHighlightedSpecialSlots] = useState<Set<string>>(new Set());
  const [activeDrag, setActiveDrag] = useState<{ id: string; kind: "article" | "special"; title: string } | null>(null);
  const [dropPreview, setDropPreview] = useState<{ room: string; time: string } | null>(null);

  const articleMap = useMemo(() => new Map(articles.map((a) => [a.id, a])), [articles]);
  const daySlots = schedule.slots.filter((s) => s.day === selectedDay);
  const daySpecialSlots = (schedule.specialSlots || []).filter((s) => s.day === selectedDay);

  const dayHours = getDayHours(schedule, selectedDay);
  const startMinutes = Math.floor(dayHours.startHour * 60);
  const endMinutes = Math.ceil(dayHours.endHour * 60);
  const timeLabels: string[] = [];
  for (let m = startMinutes; m < endMinutes; m += 30) timeLabels.push(fmtTime(m));
  const totalMinutes = (dayHours.endHour - dayHours.startHour) * 60;
  const scheduleStartMin = dayHours.startHour * 60;
  const gridHeight = timeLabels.length * 48;

  const getTop = (time: string) => ((parseTime(time)) - scheduleStartMin) / totalMinutes * 100;
  const getHeight = (start: string, end: string) => (parseTime(end) - parseTime(start)) / totalMinutes * 100;

  // Convert pixel delta.y to minutes (5-min snap)
  const pxToMinutes = useCallback((dy: number) => {
    const min = (dy / gridHeight) * totalMinutes;
    return Math.round(min / 5) * 5;
  }, [gridHeight, totalMinutes]);

  // --- Sensors: pointer for mouse, touch with hold-to-drag, keyboard ---
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const highlightTemporarily = (ids: string[]) => {
    setHighlightedSlots(new Set(ids));
    setTimeout(() => setHighlightedSlots(new Set()), 1500);
  };

  const handleUndo = () => {
    if (undoSnapshot) {
      restoreSlotSnapshot(undoSnapshot);
      setUndoSnapshot(null);
      onSlotMoved?.();
      toast.success("Action annulée");
    }
  };

  // --- dnd-kit handlers ---
  const handleDragStart = (e: DragStartEvent) => {
    const d = e.active.data.current as { kind: "article" | "special"; title: string } | undefined;
    if (!d) return;
    setActiveDrag({ id: String(e.active.id), kind: d.kind, title: d.title });
    setDropPreview(null);
  };

  const handleDragMove = (e: DragMoveEvent) => {
    const d = e.active.data.current as { kind: "article" | "special"; startTime: string; duration?: number } | undefined;
    if (!d) return;
    const overData = e.over?.data.current as { type?: string; room?: string; day?: number } | undefined;
    if (!overData || overData.type !== "room" || !overData.room) {
      setDropPreview(null);
      return;
    }
    const deltaMin = pxToMinutes(e.delta.y);
    const newStartMin = Math.max(scheduleStartMin, parseTime(d.startTime) + deltaMin);
    setDropPreview({ room: overData.room, time: fmtTime(newStartMin) });
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const activeId = String(e.active.id);
    const activeData = e.active.data.current as { kind: "article" | "special"; startTime: string; duration?: number; sourceRoom?: string } | undefined;
    const overData = e.over?.data.current as { type?: string; room?: string; day?: number } | undefined;
    setActiveDrag(null);
    setDropPreview(null);

    if (!activeData || !overData) return;

    // Cross-day drop
    if (overData.type === "day" && typeof overData.day === "number") {
      const day = overData.day;
      if (day === selectedDay) return;
      if (activeData.kind === "special") {
        const ssId = activeId.replace(/^special:/, "").split("@")[0];
        const ss = (schedule.specialSlots || []).find((s) => s.id === ssId);
        if (!ss) return;
        updateSpecialSlot(ssId, { day });
        setHighlightedSpecialSlots(new Set([ssId]));
        setTimeout(() => setHighlightedSpecialSlots(new Set()), 1500);
        toast.success(`Créneau « ${ss.title} » déplacé au Jour ${day + 1}`);
        onSlotMoved?.();
        onSelectDay?.(day);
        return;
      }
      const articleId = activeId.replace(/^article:/, "");
      const slot = schedule.slots.find((s) => s.articleId === articleId);
      if (!slot) return;
      setUndoSnapshot(getSlotSnapshot());
      const result: MoveResult = moveSlot(articleId, slot.room, slot.startTime, day);
      if (result.success) {
        highlightTemporarily([articleId]);
        toast.success(`Déplacé au Jour ${day + 1} — ${result.message}`, {
          action: { label: "Annuler", onClick: () => handleUndo() },
        });
        onSelectDay?.(day);
      } else {
        toast.error(result.message);
      }
      onSlotMoved?.();
      return;
    }

    // Room drop
    if (overData.type === "room" && overData.room) {
      const room = overData.room;
      const deltaMin = pxToMinutes(e.delta.y);
      const newStartMin = Math.max(scheduleStartMin, parseTime(activeData.startTime) + deltaMin);
      const dropTime = fmtTime(newStartMin);
      const dropMinutes = newStartMin;

      if (activeData.kind === "special") {
        const ssId = activeId.replace(/^special:/, "").split("@")[0];
        const ss = daySpecialSlots.find((s) => s.id === ssId);
        if (!ss) return;
        const duration = activeData.duration || (parseTime(ss.endTime) - parseTime(ss.startTime));
        const endMin = dropMinutes + duration;
        if (endMin > schedule.endHour * 60) {
          toast.error("Le créneau dépasse l'heure de fin de la conférence");
        } else {
          updateSpecialSlot(ssId, { startTime: dropTime, endTime: fmtTime(endMin), room });
          setHighlightedSpecialSlots(new Set([ssId]));
          setTimeout(() => setHighlightedSpecialSlots(new Set()), 1500);
          toast.success(`Créneau « ${ss.title} » déplacé à ${dropTime}`);
        }
        onSlotMoved?.();
        return;
      }

      // Article
      const articleId = activeId.replace(/^article:/, "");
      const hitSlot = daySlots.find((s) => {
        if (s.articleId === articleId) return false;
        if (s.room !== room) return false;
        const start = parseTime(s.startTime);
        const end = parseTime(s.endTime);
        return dropMinutes >= start && dropMinutes < end;
      });

      setUndoSnapshot(getSlotSnapshot());
      if (hitSlot) {
        swapSlots(articleId, hitSlot.articleId);
        const artA = articleMap.get(articleId);
        const artB = articleMap.get(hitSlot.articleId);
        highlightTemporarily([articleId, hitSlot.articleId]);
        toast.success(`Échange effectué : « ${artA?.title || "?"} » ↔ « ${artB?.title || "?"} »`, {
          action: { label: "Annuler", onClick: () => handleUndo() },
        });
      } else {
        const result: MoveResult = moveSlot(articleId, room, dropTime, selectedDay);
        if (result.success) {
          highlightTemporarily([articleId]);
          toast.success(result.message, { action: { label: "Annuler", onClick: () => handleUndo() } });
        } else {
          toast.error(result.message);
        }
      }
      onSlotMoved?.();
    }
  };

  // --- Swap (click) mode ---
  const handleSlotClick = (articleId: string) => {
    if (mode !== "swap") return;
    if (!selectedSlotId) {
      setSelectedSlotId(articleId);
      toast.info("Cliquez sur la deuxième communication pour effectuer l'échange");
    } else if (selectedSlotId === articleId) {
      setSelectedSlotId(null);
      toast.info("Sélection annulée");
    } else {
      setUndoSnapshot(getSlotSnapshot());
      swapSlots(selectedSlotId, articleId);
      const artA = articleMap.get(selectedSlotId);
      const artB = articleMap.get(articleId);
      highlightTemporarily([selectedSlotId, articleId]);
      toast.success(`Échange effectué : « ${artA?.title || "?"} » ↔ « ${artB?.title || "?"} »`, {
        action: { label: "Annuler", onClick: () => handleUndo() },
      });
      setSelectedSlotId(null);
      onSlotMoved?.();
    }
  };

  if (daySlots.length === 0 && daySpecialSlots.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <p>Aucune session programmée pour ce jour.</p>
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={handleDragStart} onDragMove={handleDragMove} onDragEnd={handleDragEnd} onDragCancel={() => { setActiveDrag(null); setDropPreview(null); }}>
      <div className="space-y-3">
        {/* Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1 bg-muted rounded-lg p-0.5">
            <Button size="sm" variant={mode === "drag" ? "default" : "ghost"} onClick={() => { setMode("drag"); setSelectedSlotId(null); }} className={cn("gap-1.5 text-xs h-7", mode === "drag" && "gradient-primary text-primary-foreground")}>
              <GripVertical className="h-3.5 w-3.5" />Glisser
            </Button>
            <Button size="sm" variant={mode === "swap" ? "default" : "ghost"} onClick={() => { setMode("swap"); setSelectedSlotId(null); }} className={cn("gap-1.5 text-xs h-7", mode === "swap" && "gradient-primary text-primary-foreground")}>
              <MousePointerClick className="h-3.5 w-3.5" />Permuter
            </Button>
          </div>

          {schedule.days > 1 && mode === "drag" && activeDrag && (
            <div className="flex items-center gap-1 ml-2 flex-wrap">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Déposer sur :</span>
              {Array.from({ length: schedule.days }, (_, i) => (
                <DroppableDay key={i} day={i} disabled={i === selectedDay}>Jour {i + 1}</DroppableDay>
              ))}
            </div>
          )}

          {mode === "swap" && (
            <Badge variant="outline" className="text-xs border-accent/50 text-accent animate-pulse">
              <ArrowLeftRight className="h-3 w-3 mr-1" />
              {selectedSlotId ? `Sélection : « ${articleMap.get(selectedSlotId)?.title || "?"} » — cliquez sur la cible` : "Cliquez sur une communication pour la sélectionner"}
            </Badge>
          )}

          {undoSnapshot && (
            <Button size="sm" variant="outline" onClick={handleUndo} className="gap-1.5 text-xs h-7 ml-auto">
              <Undo2 className="h-3.5 w-3.5" />Annuler
            </Button>
          )}
        </div>

        {/* Grid */}
        <div className="overflow-x-auto overscroll-x-contain -mx-4 px-4 sm:mx-0 sm:px-0" style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-x pan-y" }}>
          <div className="min-w-[600px]">
            {/* Header */}
            <div className="grid gap-0 border-b border-border" style={{ gridTemplateColumns: `80px repeat(${schedule.rooms.length}, 1fr)` }}>
              <div className="p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Horaire</div>
              {schedule.rooms.map((room) => (
                <div key={room} className="p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center border-l border-border">{room}</div>
              ))}
            </div>

            {/* Body */}
            <div className="grid" style={{ gridTemplateColumns: `80px repeat(${schedule.rooms.length}, 1fr)` }}>
              {/* Time column */}
              <div className="relative" style={{ height: `${gridHeight}px` }}>
                {timeLabels.map((t, i) => (
                  <div key={t} className="absolute w-full text-xs text-muted-foreground pr-2 text-right" style={{ top: `${(i / timeLabels.length) * 100}%` }}>{t}</div>
                ))}
              </div>

              {/* Room columns */}
              {schedule.rooms.map((room) => {
                const roomSlots = daySlots.filter((s) => s.room === room);
                const isDropRoom = dropPreview?.room === room;
                const sourceRoom = activeDrag?.kind === "article"
                  ? schedule.slots.find((s) => s.articleId === activeDrag.id.replace(/^article:/, "") && s.day === selectedDay)?.room
                  : activeDrag?.kind === "special"
                    ? daySpecialSlots.find((s) => s.id === activeDrag.id.replace(/^special:/, "").split("@")[0])?.room
                    : undefined;
                const anyDragging = !!activeDrag;
                const isSourceRoom = anyDragging && sourceRoom === room;
                const isCrossRoom = isDropRoom && sourceRoom && sourceRoom !== room && sourceRoom !== "all";

                return (
                  <DroppableRoom
                    key={room}
                    id={`room:${room}`}
                    className={cn(
                      "relative border-l border-border transition-colors",
                      anyDragging && !isDropRoom && !isSourceRoom && "bg-muted/20",
                      isDropRoom && !isCrossRoom && "bg-primary/5",
                      isCrossRoom && "bg-accent/10 ring-2 ring-inset ring-accent/40",
                      isSourceRoom && "bg-muted/40"
                    )}
                    style={{ height: `${gridHeight}px` }}
                  >
                    {timeLabels.map((_, i) => (
                      <div key={i} className="absolute w-full border-t border-border/40" style={{ top: `${(i / timeLabels.length) * 100}%` }} />
                    ))}

                    {isDropRoom && dropPreview && (
                      <div className={cn("absolute left-1 right-1 h-0.5 rounded-full z-20 pointer-events-none", isCrossRoom ? "bg-accent" : "bg-primary")} style={{ top: `${getTop(dropPreview.time)}%` }}>
                        <div className={cn("absolute -left-1 -top-1.5 w-3 h-3 rounded-full", isCrossRoom ? "bg-accent" : "bg-primary")} />
                        <span className={cn("absolute left-4 -top-3 text-[10px] font-semibold bg-card px-1.5 py-0.5 rounded shadow-sm border", isCrossRoom ? "text-accent border-accent/40" : "text-primary border-primary/40")}>
                          {isCrossRoom ? `→ ${room} • ${dropPreview.time}` : dropPreview.time}
                        </span>
                      </div>
                    )}

                    {/* Slots */}
                    {roomSlots.map((slot) => {
                      const article = articleMap.get(slot.articleId);
                      if (!article) return null;
                      const isSelected = selectedSlotId === slot.articleId;
                      const isHighlighted = highlightedSlots.has(slot.articleId);
                      const bgColor = getCategoryColor(article.category);
                      const borderColor = getCategoryBorderColor(article.category);
                      const dragId = `article:${slot.articleId}`;
                      const isBeingDragged = activeDrag?.id === dragId;

                      return (
                        <DraggableSlot
                          key={slot.articleId}
                          id={dragId}
                          enabled={mode === "drag"}
                          data={{ kind: "article", title: article.title, startTime: slot.startTime, sourceRoom: room }}
                        >
                          {({ setNodeRef, listeners, attributes, isDragging }) => (
                            <div
                              ref={setNodeRef as (el: HTMLDivElement | null) => void}
                              {...attributes}
                              {...listeners}
                              onClick={() => handleSlotClick(slot.articleId)}
                              className={cn(
                                "absolute left-1 right-1 rounded-lg border p-2 overflow-hidden transition-all group z-10 select-none",
                                mode === "drag" && "cursor-grab active:cursor-grabbing touch-none",
                                mode === "swap" && "cursor-pointer hover:ring-2 hover:ring-accent/50",
                                (isDragging || isBeingDragged) && "opacity-40",
                                isSelected && "ring-2 ring-accent ring-offset-1 ring-offset-background shadow-lg scale-[1.02]",
                                isHighlighted && "animate-pulse ring-2 ring-success",
                                !isDragging && !isSelected && "hover:shadow-card-hover"
                              )}
                              style={{
                                top: `${getTop(slot.startTime)}%`,
                                height: `${getHeight(slot.startTime, slot.endTime)}%`,
                                minHeight: "36px",
                                backgroundColor: bgColor,
                                borderColor: borderColor,
                              }}
                              title={`${article.title}\n${article.authors}\n${slot.startTime} - ${slot.endTime}`}
                            >
                              <div className="flex items-start gap-1">
                                {mode === "drag" && <GripVertical className="h-3 w-3 opacity-40 group-hover:opacity-80 transition-opacity flex-shrink-0 mt-0.5" />}
                                {mode === "swap" && <ArrowLeftRight className={cn("h-3 w-3 flex-shrink-0 mt-0.5 transition-opacity", isSelected ? "opacity-100 text-accent" : "opacity-0 group-hover:opacity-60")} />}
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-semibold truncate text-foreground">{article.title}</p>
                                  <p className="text-[10px] text-muted-foreground truncate">{article.authors}</p>
                                  {article.moderator && <p className="text-[10px] text-muted-foreground/70 truncate">Mod: {article.moderator}</p>}
                                  {article.sessionChair && <p className="text-[10px] text-muted-foreground/70 truncate">Prés: {article.sessionChair}</p>}
                                  <p className="text-[10px] text-muted-foreground/50">{slot.startTime}-{slot.endTime}</p>
                                </div>
                              </div>
                            </div>
                          )}
                        </DraggableSlot>
                      );
                    })}

                    {/* Special slots */}
                    {daySpecialSlots
                      .filter((ss) => ss.room === room || (ss.room === "all" && room === schedule.rooms[0]))
                      .map((ss) => {
                        const colors = SPECIAL_SLOT_COLORS[ss.type] || SPECIAL_SLOT_COLORS.other;
                        const isSSHighlighted = highlightedSpecialSlots.has(ss.id);
                        const duration = parseTime(ss.endTime) - parseTime(ss.startTime);
                        const dragId = `special:${ss.id}`;
                        const isBeingDragged = activeDrag?.id === dragId;
                        const widthStyle = ss.room === "all" ? { left: 4, width: `calc(${schedule.rooms.length * 100}% + ${(schedule.rooms.length - 1) * 1}px - 8px)` } : {};

                        return (
                          <DraggableSlot
                            key={ss.id}
                            id={dragId}
                            enabled={mode === "drag"}
                            data={{ kind: "special", title: ss.title, startTime: ss.startTime, duration, sourceRoom: ss.room }}
                          >
                            {({ setNodeRef, listeners, attributes, isDragging }) => (
                              <div
                                ref={setNodeRef as (el: HTMLDivElement | null) => void}
                                {...attributes}
                                {...listeners}
                                className={cn(
                                  "absolute left-1 right-1 rounded-lg border-2 border-dashed p-2 overflow-hidden z-20 group select-none",
                                  mode === "drag" && "cursor-grab active:cursor-grabbing touch-none",
                                  (isDragging || isBeingDragged) && "opacity-40",
                                  isSSHighlighted && "animate-pulse ring-2 ring-success"
                                )}
                                style={{
                                  top: `${getTop(ss.startTime)}%`,
                                  height: `${getHeight(ss.startTime, ss.endTime)}%`,
                                  minHeight: "32px",
                                  backgroundColor: colors.bg,
                                  borderColor: colors.border,
                                  ...widthStyle,
                                }}
                                title={`${ss.title}${ss.speaker ? `\n${ss.speaker}` : ""}\n${ss.startTime} - ${ss.endTime}`}
                                onDoubleClick={() => onEditSpecialSlot?.(ss)}
                              >
                                <div className="absolute top-1 right-1 opacity-70 group-hover:opacity-100 transition-opacity flex gap-0.5 z-10" onPointerDown={(e) => e.stopPropagation()}>
                                  <button type="button" onClick={(e) => { e.stopPropagation(); onEditSpecialSlot?.(ss); }} className="rounded-full p-0.5 hover:bg-accent/20">
                                    <Pencil className="h-3 w-3" style={{ color: colors.text }} />
                                  </button>
                                  <button type="button" onClick={(e) => { e.stopPropagation(); removeSpecialSlot(ss.id); onSlotMoved?.(); toast.success(`Créneau « ${ss.title} » supprimé`); }} className="rounded-full p-0.5 hover:bg-destructive/20">
                                    <X className="h-3 w-3" style={{ color: colors.text }} />
                                  </button>
                                </div>
                                <div className="flex items-start gap-1.5">
                                  {mode === "drag" && <GripVertical className="h-3 w-3 opacity-60 flex-shrink-0 mt-0.5" style={{ color: colors.text }} />}
                                  <span className="flex-shrink-0 mt-0.5" style={{ color: colors.text }}>{SPECIAL_SLOT_ICONS[ss.type]}</span>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-bold truncate" style={{ color: colors.text }}>{ss.title}</p>
                                    {ss.speaker && <p className="text-[10px] truncate" style={{ color: colors.text, opacity: 0.7 }}>{ss.speaker}</p>}
                                    <p className="text-[10px]" style={{ color: colors.text, opacity: 0.5 }}>{ss.startTime}-{ss.endTime}</p>
                                  </div>
                                </div>
                              </div>
                            )}
                          </DraggableSlot>
                        );
                      })}
                  </DroppableRoom>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeDrag ? (
          <div className="rounded-lg border-2 border-primary bg-card px-3 py-2 shadow-2xl text-xs font-semibold text-foreground max-w-[220px] truncate">
            {activeDrag.title}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

export default ScheduleGrid;
