import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateSpecialSlot, ConferenceSchedule, SpecialSlot, SpecialSlotType } from "@/lib/conference";
import { toast } from "sonner";
import { Mic, Coffee, Flag, Star, Award, MoreHorizontal } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedule: ConferenceSchedule;
  slot: SpecialSlot | null;
  onUpdated: () => void;
}

const SLOT_TYPES: { value: SpecialSlotType; label: string; icon: React.ReactNode }[] = [
  { value: "keynote", label: "Discours principal (Keynote)", icon: <Star className="h-4 w-4" /> },
  { value: "opening", label: "Cérémonie d'ouverture", icon: <Flag className="h-4 w-4" /> },
  { value: "closing", label: "Cérémonie de clôture", icon: <Award className="h-4 w-4" /> },
  { value: "break", label: "Pause / Pause café", icon: <Coffee className="h-4 w-4" /> },
  { value: "ceremony", label: "Cérémonie / Événement", icon: <Mic className="h-4 w-4" /> },
  { value: "other", label: "Autre", icon: <MoreHorizontal className="h-4 w-4" /> },
];

const EditSpecialSlotDialog = ({ open, onOpenChange, schedule, slot, onUpdated }: Props) => {
  const [title, setTitle] = useState("");
  const [speaker, setSpeaker] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<SpecialSlotType>("keynote");
  const [room, setRoom] = useState("all");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("09:30");
  const [day, setDay] = useState(0);

  useEffect(() => {
    if (slot) {
      setTitle(slot.title);
      setSpeaker(slot.speaker || "");
      setDescription(slot.description || "");
      setType(slot.type);
      setRoom(slot.room);
      setStartTime(slot.startTime);
      setEndTime(slot.endTime);
      setDay(slot.day);
    }
  }, [slot]);

  const handleSubmit = () => {
    if (!slot) return;
    if (!title.trim()) {
      toast.error("Veuillez saisir un titre");
      return;
    }
    if (startTime >= endTime) {
      toast.error("L'heure de fin doit être après l'heure de début");
      return;
    }
    updateSpecialSlot(slot.id, {
      title: title.trim(),
      speaker: speaker.trim() || undefined,
      description: description.trim() || undefined,
      type,
      room,
      startTime,
      endTime,
      day,
    });
    onOpenChange(false);
    setTimeout(() => {
      toast.success(`Créneau « ${title.trim()} » modifié`);
      onUpdated();
    }, 0);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Modifier le créneau spécial</DialogTitle>
          <DialogDescription>Modifiez les détails de ce créneau.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Type de créneau</Label>
            <Select value={type} onValueChange={(v) => setType(v as SpecialSlotType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SLOT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    <span className="flex items-center gap-2">{t.icon} {t.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Titre *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Discours d'ouverture du Recteur" />
          </div>

          <div className="space-y-2">
            <Label>Intervenant / Orateur</Label>
            <Input value={speaker} onChange={(e) => setSpeaker(e.target.value)} placeholder="Ex: Pr. Dupont" />
          </div>

          <div className="space-y-2">
            <Label>Description (optionnel)</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Détails supplémentaires..." />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Jour</Label>
              <Select value={day.toString()} onValueChange={(v) => setDay(parseInt(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: schedule.days }, (_, i) => (
                    <SelectItem key={i} value={i.toString()}>Jour {i + 1}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Salle</Label>
              <Select value={room} onValueChange={setRoom}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les salles</SelectItem>
                  {schedule.rooms.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Heure de début</Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Heure de fin</Label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>

          <Button onClick={handleSubmit} className="w-full gradient-accent text-accent-foreground">
            Enregistrer les modifications
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EditSpecialSlotDialog;
