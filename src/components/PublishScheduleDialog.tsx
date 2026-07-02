import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Copy, ExternalLink, Loader2, Send, EyeOff, ShieldCheck, Clock3, AlertTriangle, CheckCircle2, Globe } from "lucide-react";
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
import { Separator } from "@/components/ui/separator";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conferenceId: string;
  schedule: ConferenceSchedule | null;
  articles: Article[];
  organizers: Organizer[];
}

const STATUS_CONFIG = {
  draft: {
    label: "Non publié",
    description: "Invisible pour les communicants",
    badge: "bg-muted text-muted-foreground border-border",
    icon: EyeOff,
    color: "muted",
  },
  provisional: {
    label: "Programme provisoire",
    description: "Version modifiable visible par les communicants",
    badge: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800",
    icon: Clock3,
    color: "amber",
  },
  final: {
    label: "Programme définitif",
    description: "Version finale validée et publiée",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800",
    icon: ShieldCheck,
    color: "emerald",
  },
} as const;

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
      toast.success(
        target === "final" 
          ? "🎉 Programme publié comme définitif !" 
          : "✨ Programme publié comme provisoire !"
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
      toast.info("Programme dépublié — il n'est plus visible pour les communicants");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPublishing(null);
    }
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast.success("Lien copié dans le presse-papier !");
  };

  const link = token ? buildProgrammeLink(token) : null;
  const currentStatus = STATUS_CONFIG[status];
  const StatusIcon = currentStatus.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg gap-0 p-0">
        {/* Header with gradient */}
        <div className="relative bg-gradient-to-br from-slate-50 to-white dark:from-slate-950 dark:to-slate-900 p-6 pb-4 rounded-t-lg border-b">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <Globe className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-xl font-semibold">Publier le programme</DialogTitle>
                <DialogDescription className="text-sm mt-1">
                  Contrôlez la visibilité du programme pour les communicants
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="p-6 space-y-5">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Status Card - Enhanced */}
              <div className="relative overflow-hidden rounded-xl border bg-card shadow-sm">
                <div className={`absolute inset-0 opacity-5 bg-gradient-to-br ${
                  status === "final" ? "from-emerald-500 to-green-600" :
                  status === "provisional" ? "from-amber-500 to-orange-600" :
                  "from-slate-500 to-gray-600"
                }`} />
                
                <div className="relative p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${
                        status === "final" ? "bg-emerald-100 dark:bg-emerald-900/30" :
                        status === "provisional" ? "bg-amber-100 dark:bg-amber-900/30" :
                        "bg-muted"
                      }`}>
                        <StatusIcon className={`h-5 w-5 ${
                          status === "final" ? "text-emerald-600 dark:text-emerald-400" :
                          status === "provisional" ? "text-amber-600 dark:text-amber-400" :
                          "text-muted-foreground"
                        }`} />
                      </div>
                      <div className="space-y-0.5">
                        <Badge variant="outline" className={`text-sm font-medium ${currentStatus.badge}`}>
                          {currentStatus.label}
                        </Badge>
                        <p className="text-sm text-muted-foreground">{currentStatus.description}</p>
                      </div>
                    </div>
                    {status !== "draft" && (
                      <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
                    )}
                  </div>

                  {publishedAt && status !== "draft" && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t">
                      <Clock3 className="h-3.5 w-3.5" />
                      <span>Publié le {new Date(publishedAt).toLocaleString("fr-FR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit"
                      })}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Alerts */}
              {!schedule && (
                <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/5 border border-destructive/20 text-destructive">
                  <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Chronogramme requis</p>
                    <p className="text-xs opacity-90">Générez d'abord le chronogramme avant de pouvoir le publier.</p>
                  </div>
                </div>
              )}

              {schedule && status !== "draft" && (
                <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-800 text-amber-900 dark:text-amber-100">
                  <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Modifications détectées</p>
                    <p className="text-xs opacity-90">
                      Si vous modifiez ou régénérez le chronogramme, pensez à republier pour que les communicants voient la version à jour.
                    </p>
                  </div>
                </div>
              )}

              {/* Action Buttons - Enhanced Hierarchy */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground mb-3">Actions de publication</p>
                
                <div className="grid gap-2">
                  {/* Publish as Provisional */}
                  <Button
                    onClick={() => doPublish("provisional")}
                    disabled={!schedule || publishing !== null}
                    variant="outline"
                    className="h-12 justify-start gap-3 border-amber-300 bg-amber-50/50 text-amber-900 hover:bg-amber-100 hover:border-amber-400 dark:bg-amber-950/20 dark:text-amber-100 dark:border-amber-800 dark:hover:bg-amber-950/40 transition-all"
                  >
                    {publishing === "provisional" ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Clock3 className="h-5 w-5" />
                    )}
                    <div className="flex flex-col items-start">
                      <span className="font-medium">Publier comme provisoire</span>
                      <span className="text-xs opacity-80 font-normal">Version modifiable pour relecture</span>
                    </div>
                  </Button>

                  {/* Publish as Final - Primary Action */}
                  <Button
                    onClick={() => doPublish("final")}
                    disabled={!schedule || publishing !== null}
                    className="h-12 justify-start gap-3 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white shadow-lg shadow-emerald-500/20 transition-all"
                  >
                    {publishing === "final" ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <ShieldCheck className="h-5 w-5" />
                    )}
                    <div className="flex flex-col items-start">
                      <span className="font-semibold">Publier comme définitif</span>
                      <span className="text-xs opacity-90 font-normal">Version finale validée</span>
                    </div>
                  </Button>

                  {/* Unpublish - Destructive */}
                  {status !== "draft" && (
                    <>
                      <Separator className="my-2" />
                      <Button
                        onClick={doUnpublish}
                        disabled={publishing !== null}
                        variant="ghost"
                        className="h-11 justify-start gap-3 text-destructive hover:text-destructive hover:bg-destructive/10 transition-all"
                      >
                        {publishing === "draft" ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <EyeOff className="h-4 w-4" />
                        )}
                        <div className="flex flex-col items-start">
                          <span className="font-medium">Dépublier le programme</span>
                          <span className="text-xs opacity-80 font-normal">Masquer aux communicants</span>
                        </div>
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Public Link Section */}
              {link && status !== "draft" && (
                <div className="space-y-3 pt-2">
                  <Separator />
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm font-medium text-foreground">Lien du programme public</p>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 border border-border">
                      <code className="flex-1 text-xs bg-background px-3 py-2 rounded-md font-mono truncate text-muted-foreground">
                        {link}
                      </code>
                      <div className="flex items-center gap-1">
                        <Button 
                          size="icon" 
                          variant="outline" 
                          className="h-8 w-8"
                          onClick={() => copyToClipboard(link)}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button 
                          size="icon" 
                          variant="outline" 
                          className="h-8 w-8"
                          asChild
                        >
                          <a href={link} target="_blank" rel="noreferrer">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                      <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                      Ce lien est utilisé pour la vérification des informations des intervenants.
                    </p>
                  </div>
                </div>
              )}

              {!token && !loading && (
                <div className="p-3 rounded-lg bg-muted/50 border border-border">
                  <p className="text-xs text-muted-foreground text-center">
                    Configurez d'abord le lien de vérification (bouton « Vérification ») pour obtenir un lien public partageable.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PublishScheduleDialog;
