import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Copy, ExternalLink, Loader2, Send, EyeOff, ShieldCheck, Clock3, AlertTriangle, CheckCircle2 } from "lucide-react";
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

const STATUS_INFO: Record<PublicationStatus, { 
  label: string; 
  badge: string; 
  icon: JSX.Element;
  color: string;
}> = {
  draft: { 
    label: "Non publié — invisible pour les communicants", 
    badge: "bg-muted text-muted-foreground border-border", 
    icon: <EyeOff className="h-4 w-4" />,
    color: "text-muted-foreground"
  },
  provisional: { 
    label: "Publié — Programme provisoire", 
    badge: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800", 
    icon: <Clock3 className="h-4 w-4" />,
    color: "text-amber-600 dark:text-amber-400"
  },
  final: { 
    label: "Publié — Programme définitif", 
    badge: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800", 
    icon: <CheckCircle2 className="h-4 w-4" />,
    color: "text-emerald-600 dark:text-emerald-400"
  },
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
      setToken(cfg.data?.token as string ?? null);
    } catch (e) {
      toast.error("Erreur lors du chargement du statut");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const doPublish = async (target: "provisional" | "final") => {
    if (!schedule) {
      toast.error("Générez d'abord le chronogramme");
      return;
    }
    const accepted = articles.filter((a) => a.status === "accepted" && schedule.slots.some((s) => s.articleId === a.id));
    if (accepted.length === 0) {
      toast.error("Le chronogramme ne contient aucune présentation planifiée");
      return;
    }

    setPublishing(target);
    try {
      const snapshot = buildProgrammeSnapshot(schedule, articles, organizers);
      await publishProgramme(conferenceId, target, snapshot);
      
      setStatus(target);
      setPublishedAt(new Date().toISOString());
      toast.success(target === "final" 
        ? "Programme publié définitivement ✓" 
        : "Programme publié en version provisoire"
      );
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
      setPublishedAt(null);
      toast.success("Programme dépublié avec succès");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPublishing(null);
    }
  };

  const link = token ? buildProgrammeLink(token) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-6">
          <DialogTitle className="text-2xl font-semibold">Publier le programme</DialogTitle>
          <DialogDescription className="text-base text-muted-foreground">
            Les communicants ne verront le programme qu'après votre validation, en version provisoire ou définitive.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Status Card */}
            <div className="p-4 rounded-xl border bg-card">
              <div className="flex items-center justify-between">
                <Badge 
                  variant="outline" 
                  className={`gap-2 px-3 py-1.5 text-sm font-medium ${STATUS_INFO[status].badge}`}
                >
                  {STATUS_INFO[status].icon}
                  {STATUS_INFO[status].label}
                </Badge>
              </div>

              {publishedAt && status !== "draft" && (
                <p className="mt-3 text-sm text-muted-foreground">
                  Dernière publication : <span className="font-medium text-foreground">
                    {new Date(publishedAt).toLocaleString("fr-FR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit"
                    })}
                  </span>
                </p>
              )}
            </div>

            {/* Warnings */}
            {!schedule && (
              <div className="flex gap-3 p-4 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-800 text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                <p className="text-sm">Générez d'abord le chronogramme avant de pouvoir le publier.</p>
              </div>
            )}

            {schedule && status !== "draft" && (
              <div className="flex gap-3 p-4 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-800 text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                <p className="text-sm">
                  Si vous modifiez ou régénérez le chronogramme, pensez à <strong>republier</strong> pour que les communicants voient la version à jour.
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="grid gap-3">
              <Button
                onClick={() => doPublish("provisional")}
                disabled={!schedule || publishing !== null}
                variant="outline"
                size="lg"
                className="justify-start gap-3 h-12 text-base border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950"
              >
                {publishing === "provisional" ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
                Publier comme provisoire
              </Button>

              <Button
                onClick={() => doPublish("final")}
                disabled={!schedule || publishing !== null}
                size="lg"
                className="justify-start gap-3 h-12 text-base bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 shadow-md"
              >
                {publishing === "final" ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <ShieldCheck className="h-5 w-5" />
                )}
                Publier comme définitif
              </Button>

              {status !== "draft" && (
                <Button
                  onClick={doUnpublish}
                  disabled={publishing !== null}
                  variant="ghost"
                  size="lg"
                  className="justify-start gap-3 h-12 text-base text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  {publishing === "draft" ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <EyeOff className="h-5 w-5" />
                  )}
                  Dépublier (masquer aux communicants)
                </Button>
              )}
            </div>

            {/* Public Link */}
            {link && status !== "draft" && (
              <div className="pt-6 border-t border-border space-y-3">
                <p className="font-medium text-foreground">Lien du programme public</p>
                
                <div className="flex gap-2">
                  <code className="flex-1 bg-muted px-4 py-3 rounded-xl text-sm font-mono break-all border">
                    {link}
                  </code>
                </div>

                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    className="flex-1 gap-2"
                    onClick={() => {
                      navigator.clipboard.writeText(link);
                      toast.success("Lien copié dans le presse-papiers");
                    }}
                  >
                    <Copy className="h-4 w-4" />
                    Copier
                  </Button>
                  <Button variant="outline" asChild className="flex-1">
                    <a href={link} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Ouvrir
                    </a>
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground">
                  Ce lien est également utilisé pour la vérification des informations des intervenants.
                </p>
              </div>
            )}

            {!token && !loading && (
              <p className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 p-4 rounded-xl">
                ⚠️ Configurez d'abord le lien de vérification pour générer un lien public.
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PublishScheduleDialog;
