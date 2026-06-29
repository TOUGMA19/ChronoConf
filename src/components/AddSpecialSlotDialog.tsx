import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addSpecialSlot, ConferenceSchedule, SpecialSlotType } from "@/lib/conference";
import { toast } from "sonner";
import { Mic, Coffee, Flag, Star, Award, MoreHorizontal } from "lucide-react";
import { secureTrim, isValidTime, LIMITS } from "@/lib/security";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedule: ConferenceSchedule;
  onAdded: () => void;
}

const SLOT_TYPES: { value: SpecialSlotType; label: string; icon: React.ReactNode }[] = [
  { value: "keynote", label: "Discours principal (Keynote)", icon: <Star className="h-4 w-4" /> },
  { value: "opening", label: "Cérémonie d'ouverture", icon: <Flag className="h-4 w-4" /> },
  { value: "closing", label: "Cérémonie de clôture", icon: <Award className="h-4 w-4" /> },
  { value: "break", label: "Pause / Pause café", icon: <Coffee className="h-4 w-4" /> },
  { value: "ceremony", label: "Cérémonie / Événement", icon: <Mic className="h-4 w-4" /> },
  { value: "other", label: "Autre", icon: <MoreHorizontal className="h-4 w-4" /> },
];

const AddSpecialSlotDialog = ({ open, onOpenChange, schedule, onAdded }: Props) => {
  const [title, setTitle] = useState("");
  const [speaker, setSpeaker] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<SpecialSlotType>("keynote");
  const [room, setRoom] = useState("all");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("09:30");
  const [day, setDay] = useState(0);

  const handleSubmit = () => {
    const safeTitle = secureTrim(title, LIMITS.title);
    if (!safeTitle) {
      toast.error("Veuillez saisir un titre");
      return;
    }
    if (!isValidTime(startTime) || !isValidTime(endTime)) {
      toast.error("Format d'heure invalide");
      return;
    }
    if (startTime >= endTime) {
      toast.error("L'heure de fin doit être après l'heure de début");
      return;
    }
    addSpecialSlot({
      title: safeTitle,
      speaker: secureTrim(speaker, LIMITS.speaker) || undefined,
      description: secureTrim(description, LIMITS.description) || undefined,
      type,
      room,
      startTime,
      endTime,
      day,
    });
    setTitle("");
    setSpeaker("");
    setDescription("");
    setType("keynote");
    setRoom("all");
    setStartTime("09:00");
    setEndTime("09:30");
    setDay(0);
    onOpenChange(false);
    setTimeout(() => {
      toast.success(`Créneau « ${safeTitle} » ajouté`);
      onAdded();
    }, 0);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajouter un créneau spécial</DialogTitle>
          <DialogDescription>Insérez un discours, une cérémonie ou une pause dans le chronogramme.</DialogDescription>
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
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Discours d'ouverture du Recteur" maxLength={LIMITS.title} />
          </div>

          <div className="space-y-2">
            <Label>Intervenant / Orateur</Label>
            <Input value={speaker} onChange={(e) => setSpeaker(e.target.value)} placeholder="Ex: Pr. Dupont" maxLength={LIMITS.speaker} />
          </div>

          <div className="space-y-2">
            <Label>Description (optionnel)</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Détails supplémentaires..." maxLength={LIMITS.description} />
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
            Ajouter le créneau
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddSpecialSlotDialog;
