import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Copy, ExternalLink, Loader2, Send, EyeOff, ShieldCheck, Clock3, AlertTriangle } from "lucide-react";
import { Article, ConferenceSchedule, Organizer } from "@/lib/conference";
import {
  PublicationStatus,
  buildProgrammeSnapshot,
  getPublicationStatus,
  publishProgramme,
  unpublishProgramme,
} from "@/lib/publish";
import { buildProgrammeLink } from "@/lib/verifyLink";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conferenceId: string;
  schedule: ConferenceSchedule | null;
  articles: Article[];
  organizers: Organizer[];
}

const STATUS_INFO: Record<PublicationStatus, { label: string; badge: string; icon: JSX.Element }> = {
  draft: { label: "Non publié — invisible pour les communicants", badge: "bg-muted text-muted-foreground border-border", icon: <EyeOff className="h-3.5 w-3.5" /> },
  provisional: { label: "Publié — Programme provisoire", badge: "bg-warning/15 text-warning border-warning/30", icon: <Clock3 className="h-3.5 w-3.5" /> },
  final: { label: "Publié — Programme définitif", badge: "bg-success/15 text-foreground border-success/30", icon: <ShieldCheck className="h-3.5 w-3.5" /> },
};

const PublishScheduleDialog = ({ open, onOpenChange, conferenceId, schedule, articles, organizers }: Props) => {
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState<PublicationStatus | null>(null);
  const [status, setStatus] = useState<PublicationStatus>("draft");
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !conferenceId) return;
    load();
  }, [open, conferenceId]);

  const load = async () => {
    setLoading(true);
    try {
      const [pub, cfg] = await Promise.all([
        getPublicationStatus(conferenceId),
        supabase.from("verify_config").select("token").eq("conference_id", conferenceId).maybeSingle(),
      ]);
      setStatus(pub?.status ?? "draft");
      setPublishedAt(pub?.publishedAt ?? null);
      setToken((cfg.data?.token as string) ?? null);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const doPublish = async (target: "provisional" | "final") => {
    if (!schedule) { toast.error("Générez d'abord le chronogramme"); return; }
    const accepted = articles.filter((a) => a.status === "accepted" && schedule.slots.some((s) => s.articleId === a.id));
    if (accepted.length === 0) { toast.error("Le chronogramme ne contient aucune présentation planifiée"); return; }
    setPublishing(target);
    try {
      const snapshot = buildProgrammeSnapshot(schedule, articles, organizers);
      await publishProgramme(conferenceId, target, snapshot);
      setStatus(target);
      setPublishedAt(new Date().toISOString());
      toast.success(target === "final" ? "Programme publié comme définitif !" : "Programme publié comme provisoire !");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPublishing(null);
    }
  };

  const doUnpublish = async () => {
    setPublishing("draft");
    try {
      await unpublishProgramme(conferenceId);
      setStatus("draft");
      toast.success("Programme dépublié — il n'est plus visible pour les communicants");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPublishing(null);
    }
  };

  const link = token ? buildProgrammeLink(token) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] rounded-xl sm:max-w-md sm:rounded-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Publier le programme</DialogTitle>
          <DialogDescription>
            Les communicants ne verront le programme qu'après votre validation, en version provisoire ou définitive.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-2 p-3 rounded-lg bg-muted/40 border border-border">
              <Badge variant="outline" className={`gap-1.5 ${STATUS_INFO[status].badge}`}>
                {STATUS_INFO[status].icon}
                {STATUS_INFO[status].label}
              </Badge>
            </div>
            {publishedAt && status !== "draft" && (
              <p className="text-xs text-muted-foreground -mt-2">
                Dernière publication : {new Date(publishedAt).toLocaleString("fr-FR")}
              </p>
            )}

            {!schedule && (
              <p className="text-sm flex items-start gap-2 text-muted-foreground">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                Générez d'abord le chronogramme avant de pouvoir le publier.
              </p>
            )}

            {schedule && status !== "draft" && (
              <p className="text-xs flex items-start gap-2 text-muted-foreground">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                Si vous modifiez ou régénérez le chronogramme, pensez à republier pour que les communicants voient la version à jour.
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button
                onClick={() => doPublish("provisional")}
                disabled={!schedule || publishing !== null}
                variant="outline"
                className="justify-center sm:justify-start gap-2 border-warning/40 text-warning hover:bg-warning/10 whitespace-normal text-center sm:text-left h-auto py-2.5"
              >
                {publishing === "provisional" ? <Loader2 className="h-4 w-4 animate-spin shrink-0" /> : <Send className="h-4 w-4 shrink-0" />}
                Publier comme provisoire
              </Button>
              <Button
                onClick={() => doPublish("final")}
                disabled={!schedule || publishing !== null}
                className="justify-center sm:justify-start gap-2 gradient-accent text-accent-foreground whitespace-normal text-center sm:text-left h-auto py-2.5"
              >
                {publishing === "final" ? <Loader2 className="h-4 w-4 animate-spin shrink-0" /> : <ShieldCheck className="h-4 w-4 shrink-0" />}
                Publier comme définitif
              </Button>
              {status !== "draft" && (
                <Button
                  onClick={doUnpublish}
                  disabled={publishing !== null}
                  variant="ghost"
                  className="justify-center sm:justify-start gap-2 text-destructive hover:text-destructive sm:col-span-2"
                >
                  {publishing === "draft" ? <Loader2 className="h-4 w-4 animate-spin shrink-0" /> : <EyeOff className="h-4 w-4 shrink-0" />}
                  Dépublier (masquer aux communicants)
                </Button>
              )}
            </div>

            {link && status !== "draft" && (
              <div className="pt-3 border-t border-border space-y-2">
                <p className="text-sm font-medium text-foreground">Lien du programme public</p>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <code className="flex-1 min-w-0 text-xs bg-muted px-2 py-1.5 rounded truncate">{link}</code>
                  <div className="flex items-center gap-2 justify-end sm:justify-start shrink-0">
                    <Button
                      size="icon"
                      variant="outline"
                      className="shrink-0"
                      onClick={() => { navigator.clipboard.writeText(link); toast.success("Lien copié !"); }}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="outline" className="shrink-0" asChild>
                      <a href={link} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" /></a>
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">C'est le même lien que celui utilisé pour la vérification des informations des intervenants.</p>
              </div>
            )}
            {!token && !loading && (
              <p className="text-xs text-muted-foreground">Configurez d'abord le lien de vérification (bouton « Vérification ») pour obtenir un lien public partageable.</p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PublishScheduleDialog;
