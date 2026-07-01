import { useState, useCallback, useRef } from "react";
import { ConferenceSchedule, Article, SpecialSlot, moveSlot, swapSlots, getSlotSnapshot, restoreSlotSnapshot, removeSpecialSlot, updateSpecialSlot, ScheduleSlot, MoveResult, getDayHours } from "@/lib/conference";
import { cn } from "@/lib/utils";
import { GripVertical, ArrowLeftRight, MousePointerClick, Undo2, X, Star, Flag, Award, Coffee, Mic, MoreHorizontal, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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

// Special slot colors use deep saturated tones to contrast with pastel article colors
const SPECIAL_SLOT_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  keynote: { bg: "hsl(35, 100%, 25%)", border: "hsl(35, 100%, 45%)", text: "hsl(45, 100%, 90%)" },
  opening: { bg: "hsl(160, 80%, 18%)", border: "hsl(160, 70%, 40%)", text: "hsl(160, 80%, 90%)" },
  closing: { bg: "hsl(270, 70%, 25%)", border: "hsl(270, 60%, 50%)", text: "hsl(270, 80%, 92%)" },
  break: { bg: "hsl(210, 60%, 22%)", border: "hsl(210, 50%, 45%)", text: "hsl(210, 70%, 90%)" },
  ceremony: { bg: "hsl(340, 75%, 25%)", border: "hsl(340, 65%, 50%)", text: "hsl(340, 80%, 92%)" },
  other: { bg: "hsl(0, 0%, 25%)", border: "hsl(0, 0%, 50%)", text: "hsl(0, 0%, 90%)" },
};

const getCategoryColor = (category: string): string => {
  // Generate a stable hue from the category name
  let hash = 0;
  for (let i = 0; i < category.length; i++) {
    hash = category.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 92%)`;
};

const getCategoryBorderColor = (category: string): string => {
  let hash = 0;
  for (let i = 0; i < category.length; i++) {
    hash = category.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 65%)`;
};

const ScheduleGrid = ({ schedule, articles, selectedDay, onSlotMoved, onEditSpecialSlot, onSelectDay }: ScheduleGridProps) => {
  const [dragArticleId, setDragArticleId] = useState<string | null>(null);
  const [dragSpecialSlotId, setDragSpecialSlotId] = useState<string | null>(null);
  const [dragSpecialSlotDuration, setDragSpecialSlotDuration] = useState<number>(0);
  const [dropTarget, setDropTarget] = useState<{ room: string; time: string } | null>(null);
  const [mode, setMode] = useState<InteractionMode>("drag");
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [undoSnapshot, setUndoSnapshot] = useState<ScheduleSlot[] | null>(null);
  const [highlightedSlots, setHighlightedSlots] = useState<Set<string>>(new Set());
  const [highlightedSpecialSlots, setHighlightedSpecialSlots] = useState<Set<string>>(new Set());
  const containerRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const articleMap = new Map(articles.map((a) => [a.id, a]));
  const daySlots = schedule.slots.filter((s) => s.day === selectedDay);
  const daySpecialSlots = (schedule.specialSlots || []).filter((s) => s.day === selectedDay);

  // Use per-day hours
  const dayHours = getDayHours(schedule, selectedDay);

  // Generate time labels every 30 min, supporting fractional start/end hours
  const startMinutes = Math.floor(dayHours.startHour * 60);
  const endMinutes = Math.ceil(dayHours.endHour * 60);
  const timeLabels: string[] = [];
  for (let m = startMinutes; m < endMinutes; m += 30) {
    const hh = Math.floor(m / 60).toString().padStart(2, "0");
    const mm = (m % 60).toString().padStart(2, "0");
    timeLabels.push(`${hh}:${mm}`);
  }

  const totalMinutes = (dayHours.endHour - dayHours.startHour) * 60;
  const scheduleStartMin = dayHours.startHour * 60;
  const getTop = (time: string) => {
    const [h, m] = time.split(":").map(Number);
    return ((h * 60 + m) - scheduleStartMin) / totalMinutes * 100;
  };
  const getHeight = (start: string, end: string) => {
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    return ((eh * 60 + em) - (sh * 60 + sm)) / totalMinutes * 100;
  };

  const getTimeFromY = useCallback((y: number, containerHeight: number): string => {
    const ratio = Math.max(0, Math.min(1, y / containerHeight));
    const minutes = Math.round((ratio * totalMinutes) / 5) * 5;
    const totalStartMin = dayHours.startHour * 60;
    const absMinutes = totalStartMin + minutes;
    const h = Math.floor(absMinutes / 60);
    const m = absMinutes % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
  }, [totalMinutes, dayHours.startHour]);

  // --- Special slot drag handlers ---
  const handleSpecialDragStart = (e: React.DragEvent, ss: SpecialSlot) => {
    if (mode !== "drag") return;
    const duration = parseTime(ss.endTime) - parseTime(ss.startTime);
    setDragSpecialSlotId(ss.id);
    setDragSpecialSlotDuration(duration);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", `special:${ss.id}`);
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "0.5";
    }
  };

  const handleSpecialDragEnd = (e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "1";
    }
    setDragSpecialSlotId(null);
    setDragSpecialSlotDuration(0);
    setDropTarget(null);
  };

  // --- Drag mode handlers ---
  const handleDragStart = (e: React.DragEvent, articleId: string) => {
    if (mode !== "drag") return;
    setUndoSnapshot(getSlotSnapshot());
    setDragArticleId(articleId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", articleId);
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "0.5";
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "1";
    }
    setDragArticleId(null);
    setDropTarget(null);
  };

  const handleDragOver = (e: React.DragEvent, room: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const containerEl = containerRefs.current.get(room);
    if (containerEl) {
      const rect = containerEl.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const time = getTimeFromY(y, rect.height);
      setDropTarget({ room, time });
    }
  };

  const handleDrop = (e: React.DragEvent, room: string) => {
    e.preventDefault();
    const data = e.dataTransfer.getData("text/plain");
    if (!data) return;
    const containerEl = containerRefs.current.get(room);
    if (!containerEl) return;

    const rect = containerEl.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const dropTime = getTimeFromY(y, rect.height);
    const dropMinutes = parseTime(dropTime);

    // Handle special slot drop
    if (data.startsWith("special:")) {
      const ssId = data.replace("special:", "");
      const ss = daySpecialSlots.find((s) => s.id === ssId);
      if (!ss) return;
      const duration = dragSpecialSlotDuration || (parseTime(ss.endTime) - parseTime(ss.startTime));
      const endMinutes = dropMinutes + duration;
      const endH = Math.floor(endMinutes / 60);
      const endM = endMinutes % 60;
      const newEndTime = `${endH.toString().padStart(2, "0")}:${endM.toString().padStart(2, "0")}`;

      if (endMinutes > schedule.endHour * 60) {
        toast.error("Le créneau dépasse l'heure de fin de la conférence");
      } else {
        updateSpecialSlot(ssId, { startTime: dropTime, endTime: newEndTime, room });
        setHighlightedSpecialSlots(new Set([ssId]));
        setTimeout(() => setHighlightedSpecialSlots(new Set()), 1500);
        toast.success(`Créneau « ${ss.title} » déplacé à ${dropTime}`);
      }
      setDragSpecialSlotId(null);
      setDragSpecialSlotDuration(0);
      setDropTarget(null);
      onSlotMoved?.();
      return;
    }

    const articleId = data;

    // Find if drop position overlaps with an existing slot → swap
    const hitSlot = daySlots.find((s) => {
      if (s.articleId === articleId) return false;
      if (s.room !== room) return false;
      const start = parseTime(s.startTime);
      const end = parseTime(s.endTime);
      return dropMinutes >= start && dropMinutes < end;
    });

    if (hitSlot) {
      // Swap the two slots
      swapSlots(articleId, hitSlot.articleId);
      const artA = articleMap.get(articleId);
      const artB = articleMap.get(hitSlot.articleId);
      highlightTemporarily([articleId, hitSlot.articleId]);
      toast.success(
        `Échange effectué : « ${artA?.title || "?"} » ↔ « ${artB?.title || "?"} »`,
        {
          action: undoSnapshot ? {
            label: "Annuler",
            onClick: () => handleUndo(),
          } : undefined,
        }
      );
    } else {
      // Move to position with validation (respects break time and overlaps)
      const result: MoveResult = moveSlot(articleId, room, dropTime, selectedDay);
      if (result.success) {
        highlightTemporarily([articleId]);
        toast.success(result.message, {
          action: undoSnapshot ? {
            label: "Annuler",
            onClick: () => handleUndo(),
          } : undefined,
        });
      } else {
        toast.error(result.message);
        // Restore snapshot since move failed
        if (undoSnapshot) {
          restoreSlotSnapshot(undoSnapshot);
          setUndoSnapshot(null);
        }
      }
    }

    setDragArticleId(null);
    setDropTarget(null);
    onSlotMoved?.();
  };

  // --- Swap (click) mode handlers ---
  const handleSlotClick = (articleId: string) => {
    if (mode !== "swap") return;

    if (!selectedSlotId) {
      setSelectedSlotId(articleId);
      toast.info("Cliquez sur la deuxième communication pour effectuer l'échange");
    } else if (selectedSlotId === articleId) {
      setSelectedSlotId(null);
      toast.info("Sélection annulée");
    } else {
      // Perform swap
      setUndoSnapshot(getSlotSnapshot());
      swapSlots(selectedSlotId, articleId);
      const artA = articleMap.get(selectedSlotId);
      const artB = articleMap.get(articleId);
      highlightTemporarily([selectedSlotId, articleId]);
      toast.success(
        `Échange effectué : « ${artA?.title || "?"} » ↔ « ${artB?.title || "?"} »`,
        {
          action: {
            label: "Annuler",
            onClick: () => handleUndo(),
          },
        }
      );
      setSelectedSlotId(null);
      onSlotMoved?.();
    }
  };

  // --- Undo ---
  const handleUndo = () => {
    if (undoSnapshot) {
      restoreSlotSnapshot(undoSnapshot);
      setUndoSnapshot(null);
      onSlotMoved?.();
      toast.success("Action annulée");
    }
  };

  // --- Highlight animation ---
  const highlightTemporarily = (ids: string[]) => {
    setHighlightedSlots(new Set(ids));
    setTimeout(() => setHighlightedSlots(new Set()), 1500);
  };

  if (daySlots.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <p>Aucune session programmée pour ce jour.</p>
      </div>
    );
  }

  const gridHeight = timeLabels.length * 48;

  // --- Cross-day drop handlers (toolbar day buttons) ---
  const handleDayDragOver = (e: React.DragEvent, day: number) => {
    if (day === selectedDay) return;
    if (!dragArticleId && !dragSpecialSlotId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDayDrop = (e: React.DragEvent, day: number) => {
    if (day === selectedDay) return;
    e.preventDefault();
    const data = e.dataTransfer.getData("text/plain");
    if (!data) return;

    if (data.startsWith("special:")) {
      const ssId = data.replace("special:", "");
      const ss = (schedule.specialSlots || []).find((s) => s.id === ssId);
      if (!ss) return;
      updateSpecialSlot(ssId, { day });
      setHighlightedSpecialSlots(new Set([ssId]));
      setTimeout(() => setHighlightedSpecialSlots(new Set()), 1500);
      toast.success(`Créneau « ${ss.title} » déplacé au Jour ${day + 1}`);
      setDragSpecialSlotId(null);
      setDragSpecialSlotDuration(0);
      setDropTarget(null);
      onSlotMoved?.();
      onSelectDay?.(day);
      return;
    }

    const articleId = data;
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
    setDragArticleId(null);
    setDropTarget(null);
    onSlotMoved?.();
  };

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1 bg-muted rounded-lg p-0.5">
          <Button
            size="sm"
            variant={mode === "drag" ? "default" : "ghost"}
            onClick={() => { setMode("drag"); setSelectedSlotId(null); }}
            className={cn("gap-1.5 text-xs h-7", mode === "drag" && "gradient-primary text-primary-foreground")}
          >
            <GripVertical className="h-3.5 w-3.5" />
            Glisser
          </Button>
          <Button
            size="sm"
            variant={mode === "swap" ? "default" : "ghost"}
            onClick={() => { setMode("swap"); setSelectedSlotId(null); }}
            className={cn("gap-1.5 text-xs h-7", mode === "swap" && "gradient-primary text-primary-foreground")}
          >
            <MousePointerClick className="h-3.5 w-3.5" />
            Permuter
          </Button>
        </div>

        {/* Day drop zones — drag a slot here to move it to another day */}
        {schedule.days > 1 && mode === "drag" && (dragArticleId || dragSpecialSlotId) && (
          <div className="flex items-center gap-1 ml-2">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Déposer sur :</span>
            {Array.from({ length: schedule.days }, (_, i) => (
              <button
                key={i}
                type="button"
                onDragOver={(e) => handleDayDragOver(e, i)}
                onDrop={(e) => handleDayDrop(e, i)}
                disabled={i === selectedDay}
                className={cn(
                  "text-xs h-7 px-3 rounded-md border-2 border-dashed transition-all",
                  i === selectedDay
                    ? "border-muted-foreground/20 text-muted-foreground/40 cursor-not-allowed"
                    : "border-primary/40 text-primary hover:bg-primary/10 hover:border-primary cursor-copy animate-pulse"
                )}
              >
                Jour {i + 1}
              </button>
            ))}
          </div>
        )}

        {mode === "swap" && (
          <Badge variant="outline" className="text-xs border-accent/50 text-accent animate-pulse">
            <ArrowLeftRight className="h-3 w-3 mr-1" />
            {selectedSlotId
              ? `Sélection : « ${articleMap.get(selectedSlotId)?.title || "?"} » — cliquez sur la cible`
              : "Cliquez sur une communication pour la sélectionner"}
          </Badge>
        )}

        {undoSnapshot && (
          <Button size="sm" variant="outline" onClick={handleUndo} className="gap-1.5 text-xs h-7 ml-auto">
            <Undo2 className="h-3.5 w-3.5" />
            Annuler
          </Button>
        )}
      </div>

      {/* Grid */}
      <div className="overflow-x-auto">
        <div className="min-w-[600px]">
          {/* Header */}
          <div className="grid gap-0 border-b border-border" style={{ gridTemplateColumns: `80px repeat(${schedule.rooms.length}, 1fr)` }}>
            <div className="p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Horaire</div>
            {schedule.rooms.map((room) => (
              <div key={room} className="p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center border-l border-border">
                {room}
              </div>
            ))}
          </div>

          {/* Grid body */}
          <div className="grid" style={{ gridTemplateColumns: `80px repeat(${schedule.rooms.length}, 1fr)` }}>
            {/* Time column */}
            <div className="relative" style={{ height: `${gridHeight}px` }}>
              {timeLabels.map((t, i) => (
                <div key={t} className="absolute w-full text-xs text-muted-foreground pr-2 text-right" style={{ top: `${(i / timeLabels.length) * 100}%` }}>
                  {t}
                </div>
              ))}
            </div>

            {/* Room columns */}
            {schedule.rooms.map((room) => {
              const roomSlots = daySlots.filter((s) => s.room === room);
              const isDropRoom = dropTarget?.room === room && (dragArticleId || dragSpecialSlotId);
              const anyDragging = !!(dragArticleId || dragSpecialSlotId);
              // Source room of the dragged article
              const sourceRoom = dragArticleId
                ? schedule.slots.find((s) => s.articleId === dragArticleId && s.day === selectedDay)?.room
                : dragSpecialSlotId
                  ? daySpecialSlots.find((s) => s.id === dragSpecialSlotId)?.room
                  : undefined;
              const isSourceRoom = anyDragging && sourceRoom === room;
              const isCrossRoom = isDropRoom && sourceRoom && sourceRoom !== room;

              return (
                <div
                  key={room}
                  ref={(el) => { if (el) containerRefs.current.set(room, el); }}
                  className={cn(
                    "relative border-l border-border transition-colors",
                    anyDragging && !isDropRoom && !isSourceRoom && "bg-muted/20",
                    isDropRoom && !isCrossRoom && "bg-primary/5",
                    isCrossRoom && "bg-accent/10 ring-2 ring-inset ring-accent/40",
                    isSourceRoom && "bg-muted/40"
                  )}
                  style={{ height: `${gridHeight}px` }}
                  onDragOver={(e) => handleDragOver(e, room)}
                  onDrop={(e) => handleDrop(e, room)}
                  onDragLeave={() => { if (dropTarget?.room === room) setDropTarget(null); }}
                >
                  {/* Hour lines */}
                  {timeLabels.map((_, i) => (
                    <div key={i} className="absolute w-full border-t border-border/40" style={{ top: `${(i / timeLabels.length) * 100}%` }} />
                  ))}

                  {/* Drop indicator */}
                  {isDropRoom && dropTarget && (
                    <div
                      className={cn(
                        "absolute left-1 right-1 h-0.5 rounded-full z-20 pointer-events-none",
                        isCrossRoom ? "bg-accent" : "bg-primary"
                      )}
                      style={{ top: `${getTop(dropTarget.time)}%` }}
                    >
                      <div className={cn(
                        "absolute -left-1 -top-1.5 w-3 h-3 rounded-full",
                        isCrossRoom ? "bg-accent" : "bg-primary"
                      )} />
                      <span className={cn(
                        "absolute left-4 -top-3 text-[10px] font-semibold bg-card px-1.5 py-0.5 rounded shadow-sm border",
                        isCrossRoom ? "text-accent border-accent/40" : "text-primary border-primary/40"
                      )}>
                        {isCrossRoom ? `→ ${room} • ${dropTarget.time}` : dropTarget.time}
                      </span>
                    </div>
                  )}

                  {/* Slots */}
                  {roomSlots.map((slot) => {
                    const article = articleMap.get(slot.articleId);
                    if (!article) return null;
                    const isDragging = dragArticleId === slot.articleId;
                    const isSelected = selectedSlotId === slot.articleId;
                    const isHighlighted = highlightedSlots.has(slot.articleId);
                    const bgColor = getCategoryColor(article.category);
                    const borderColor = getCategoryBorderColor(article.category);

                    return (
                      <div
                        key={slot.articleId}
                        draggable={mode === "drag"}
                        onDragStart={(e) => handleDragStart(e, slot.articleId)}
                        onDragEnd={handleDragEnd}
                        onClick={() => handleSlotClick(slot.articleId)}
                        className={cn(
                          "absolute left-1 right-1 rounded-lg border p-2 overflow-hidden transition-all group z-10",
                          mode === "drag" && "cursor-grab active:cursor-grabbing",
                          mode === "swap" && "cursor-pointer hover:ring-2 hover:ring-accent/50",
                          isDragging && "opacity-50 scale-95",
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
                        title={`${article.title}\n${article.authors}\n${slot.startTime} - ${slot.endTime}\n${mode === "drag" ? "Glisser pour déplacer" : "Cliquer pour sélectionner/permuter"}`}
                      >
                        <div className="flex items-start gap-1">
                          {mode === "drag" && (
                            <GripVertical className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity flex-shrink-0 mt-0.5" />
                          )}
                          {mode === "swap" && (
                            <ArrowLeftRight className={cn(
                              "h-3 w-3 flex-shrink-0 mt-0.5 transition-opacity",
                              isSelected ? "opacity-100 text-accent" : "opacity-0 group-hover:opacity-60"
                            )} />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold truncate text-foreground">{article.title}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{article.authors}</p>
                            {article.moderator && <p className="text-[10px] text-muted-foreground/70 truncate">Mod: {article.moderator}</p>}
                            {article.sessionChair && <p className="text-[10px] text-muted-foreground/70 truncate">Prés: {article.sessionChair}</p>}
                            <p className="text-[10px] text-muted-foreground/50">{slot.startTime}-{slot.endTime}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Special Slots for this room */}
                  {daySpecialSlots
                    .filter((ss) => ss.room === room || ss.room === "all")
                    .map((ss) => {
                      const colors = SPECIAL_SLOT_COLORS[ss.type] || SPECIAL_SLOT_COLORS.other;
                      const isDraggingThis = dragSpecialSlotId === ss.id;
                      const isSSHighlighted = highlightedSpecialSlots.has(ss.id);
                      return (
                        <div
                          key={ss.id}
                          draggable={mode === "drag"}
                          onDragStart={(e) => handleSpecialDragStart(e, ss)}
                          onDragEnd={handleSpecialDragEnd}
                          className={cn(
                            "absolute left-1 right-1 rounded-lg border-2 border-dashed p-2 overflow-hidden z-20 group",
                            mode === "drag" && "cursor-grab active:cursor-grabbing",
                            isDraggingThis && "opacity-50 scale-95",
                            isSSHighlighted && "animate-pulse ring-2 ring-success",
                          )}
                          style={{
                            top: `${getTop(ss.startTime)}%`,
                            height: `${getHeight(ss.startTime, ss.endTime)}%`,
                            minHeight: "32px",
                            backgroundColor: colors.bg,
                            borderColor: colors.border,
                          }}
                          title={`${ss.title}${ss.speaker ? `\n${ss.speaker}` : ""}\n${ss.startTime} - ${ss.endTime}\n${mode === "drag" ? "Glisser pour déplacer" : "Double-cliquez pour modifier"}`}
                          onDoubleClick={() => onEditSpecialSlot?.(ss)}
                        >
                          <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5">
                            <button
                              onClick={(e) => { e.stopPropagation(); onEditSpecialSlot?.(ss); }}
                              className="rounded-full p-0.5 hover:bg-accent/20"
                            >
                              <Pencil className="h-3 w-3" style={{ color: colors.text }} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removeSpecialSlot(ss.id);
                                onSlotMoved?.();
                                toast.success(`Créneau « ${ss.title} » supprimé`);
                              }}
                              className="rounded-full p-0.5 hover:bg-destructive/20"
                            >
                              <X className="h-3 w-3" style={{ color: colors.text }} />
                            </button>
                          </div>
                          <div className="flex items-start gap-1.5">
                            {mode === "drag" && (
                              <GripVertical className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity flex-shrink-0 mt-0.5" style={{ color: colors.text }} />
                            )}
                            <span className="flex-shrink-0 mt-0.5" style={{ color: colors.text }}>
                              {SPECIAL_SLOT_ICONS[ss.type]}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold truncate" style={{ color: colors.text }}>{ss.title}</p>
                              {ss.speaker && <p className="text-[10px] truncate" style={{ color: colors.text, opacity: 0.7 }}>{ss.speaker}</p>}
                              <p className="text-[10px]" style={{ color: colors.text, opacity: 0.5 }}>{ss.startTime}-{ss.endTime}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

function parseTime(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export default ScheduleGrid;
