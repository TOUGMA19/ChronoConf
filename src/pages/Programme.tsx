import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, CalendarClock, Clock3, ShieldCheck, MapPin, Star, Flag, Award, Coffee, Mic, MoreHorizontal, Users2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getTokenFromUrl } from "@/lib/verifyLink";
import { fetchPublishedProgramme, PublishedScheduleRow } from "@/lib/publish";

interface VerifyConfigLite {
  conference_id: string;
  contact: string;
}

const SPECIAL_ICON: Record<string, JSX.Element> = {
  keynote: <Star className="h-3.5 w-3.5" />,
  opening: <Flag className="h-3.5 w-3.5" />,
  closing: <Award className="h-3.5 w-3.5" />,
  break: <Coffee className="h-3.5 w-3.5" />,
  ceremony: <Mic className="h-3.5 w-3.5" />,
  other: <MoreHorizontal className="h-3.5 w-3.5" />,
};
const SPECIAL_LABEL: Record<string, string> = {
  keynote: "Keynote", opening: "Ouverture", closing: "Clôture", break: "Pause", ceremony: "Cérémonie", other: "Autre",
};

function timeToMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

const Programme = () => {
  const token = useMemo(() => getTokenFromUrl(), []);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<VerifyConfigLite | null>(null);
  const [row, setRow] = useState<PublishedScheduleRow | null>(null);
  const [selectedDay, setSelectedDay] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Programme · ChronoConf";
    if (!token) { setLoading(false); return; }
    (async () => {
      try {
        const { data: cfg } = await supabase
          .from("verify_config")
          .select("conference_id,contact")
          .eq("token", token)
          .maybeSingle();
        if (!cfg) { setLoading(false); return; }
        setConfig(cfg as VerifyConfigLite);
        const published = await fetchPublishedProgramme((cfg as VerifyConfigLite).conference_id);
        setRow(published);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const data = row?.data;
  const days = data?.schedule.days ?? 0;

  const dayItems = useMemo(() => {
    if (!data) return [];
    const articlesById = new Map(data.articles.map((a) => [a.id, a]));
    const slotItems = data.schedule.slots
      .filter((s) => s.day === selectedDay)
      .map((s) => {
        const art = articlesById.get(s.articleId);
        return {
          kind: "slot" as const,
          start: s.startTime,
          end: s.endTime,
          room: s.room,
          title: art?.title ?? "—",
          authors: art?.authors ?? "",
          category: art?.category ?? "",
          moderator: art?.moderator ?? "",
          sessionChair: art?.sessionChair ?? "",
          type: art?.type ?? "",
        };
      });
    const specialItems = (data.schedule.specialSlots || [])
      .filter((s) => s.day === selectedDay)
      .map((s) => ({
        kind: "special" as const,
        start: s.startTime,
        end: s.endTime,
        room: s.room,
        title: s.title,
        speaker: s.speaker,
        description: s.description,
        type: s.type,
      }));
    return [...slotItems, ...specialItems].sort(
      (a, b) => timeToMin(a.start) - timeToMin(b.start) || a.room.localeCompare(b.room)
    );
  }, [data, selectedDay]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/60 backdrop-blur sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-display font-bold">
            <CalendarClock className="h-5 w-5 text-accent" />
            <span>{data?.schedule.name || "Programme"}</span>
          </Link>
          {token && (
            <Link to={`/verify?t=${encodeURIComponent(token)}`} className="text-xs text-muted-foreground hover:text-foreground">
              Vérifier mes informations →
            </Link>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && error && (
          <Card className="border-destructive/30">
            <CardContent className="pt-6 text-center text-muted-foreground">⚠️ {error}</CardContent>
          </Card>
        )}

        {!loading && !error && !token && (
          <Card className="border-destructive/30">
            <CardContent className="pt-6 text-center text-muted-foreground">
              ⚠️ Lien invalide. Utilisez le lien communiqué par l'organisateur de la conférence.
            </CardContent>
          </Card>
        )}

        {!loading && !error && token && !config && (
          <Card className="border-destructive/30">
            <CardContent className="pt-6 text-center text-muted-foreground">
              ⚠️ Lien invalide ou expiré. Contactez l'organisateur de la conférence.
            </CardContent>
          </Card>
        )}

        {!loading && !error && config && !row && (
          <Card className="border-accent/30 bg-accent/5">
            <CardContent className="pt-6 text-center text-muted-foreground">
              🕓 Le programme n'a pas encore été publié par l'organisateur. Revenez un peu plus tard.
              {config.contact && (
                <p className="text-xs mt-2">
                  Contact : <a className="underline hover:text-foreground" href={`mailto:${config.contact}`}>{config.contact}</a>
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {!loading && !error && config && row && data && (
          <>
            {row.status === "provisional" ? (
              <Card className="border-warning/30 bg-warning/5">
                <CardContent className="pt-4 text-sm flex items-center gap-2 text-warning">
                  <Clock3 className="h-4 w-4 shrink-0" />
                  Programme <strong>provisoire</strong> — susceptible d'être modifié avant la version définitive.
                </CardContent>
              </Card>
            ) : (
              <Card className="border-success/30 bg-success/5">
                <CardContent className="pt-4 text-sm flex items-center gap-2 text-foreground">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-success" />
                  Programme <strong>définitif</strong>.
                </CardContent>
              </Card>
            )}

            {days > 1 && (
              <div className="flex gap-2 flex-wrap">
                {Array.from({ length: days }, (_, i) => (
                  <Button key={i} size="sm" variant={selectedDay === i ? "default" : "outline"} onClick={() => setSelectedDay(i)} className={selectedDay === i ? "gradient-primary text-primary-foreground" : ""}>
                    Jour {i + 1}
                  </Button>
                ))}
              </div>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="font-display text-xl">Jour {selectedDay + 1}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {dayItems.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">Aucune session ce jour-là</p>
                )}
                {dayItems.map((item, i) => (
                  <div key={i} className="flex gap-3 p-3 rounded-lg border border-border bg-muted/30">
                    <div className="w-24 shrink-0 text-sm font-medium text-foreground tabular-nums">
                      {item.start}–{item.end}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {item.kind === "special" && (
                          <Badge variant="outline" className="gap-1 text-xs">{SPECIAL_ICON[item.type]} {SPECIAL_LABEL[item.type] || item.type}</Badge>
                        )}
                        <p className="font-medium text-foreground truncate">{item.title}</p>
                      </div>
                      {item.kind === "slot" && item.authors && (
                        <p className="text-sm text-muted-foreground truncate">{item.authors}</p>
                      )}
                      {item.kind === "special" && item.speaker && (
                        <p className="text-sm text-muted-foreground truncate">{item.speaker}</p>
                      )}
                      <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{item.room === "all" ? "Toutes salles" : item.room}</span>
                        {item.kind === "slot" && item.category && <Badge variant="outline" className="text-xs">{item.category}</Badge>}
                        {item.kind === "slot" && item.sessionChair && <span>Présidence : {item.sessionChair}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {data.organizers && data.organizers.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="font-display text-lg flex items-center gap-2"><Users2 className="h-4 w-4 text-accent" />Comité d'organisation</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {data.organizers.map((o, i) => (
                    <Badge key={i} variant="outline">{o.name}{o.role ? ` · ${o.role}` : ""}</Badge>
                  ))}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default Programme;
