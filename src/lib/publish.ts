// Publication publique du chronogramme — validation par l'organisateur.
//
// Tant que l'organisateur n'a pas explicitement publié le programme
// (en "provisoire" ou en "définitif"), les communicants n'ont accès à
// rien : la RLS Supabase (voir migration 20260002) bloque toute lecture
// publique tant que le statut est "draft".

import { supabase } from "@/integrations/supabase/client";
import { Article, ConferenceSchedule, Organizer, SpecialSlot } from "./conference";

export type PublicationStatus = "draft" | "provisional" | "final";

export interface PublishedProgrammeData {
  schedule: {
    name: string;
    days: number;
    rooms: string[];
    startHour: number;
    endHour: number;
    dayHours?: { startHour: number; endHour: number }[];
    slots: ConferenceSchedule["slots"];
    specialSlots: SpecialSlot[];
  };
  // Sous-ensemble "sûr" des articles : uniquement ce qui doit être visible
  // publiquement (pas de statut de review, pas de champs internes).
  articles: Array<{
    id: string;
    title: string;
    authors: string;
    moderator: string;
    sessionChair: string;
    category: string;
    duration: number;
    type: string;
  }>;
  organizers: Organizer[];
  generatedAt: string;
}

export interface PublishedScheduleRow {
  conference_id: string;
  status: PublicationStatus;
  data: PublishedProgrammeData;
  published_at: string | null;
  updated_at: string;
}

/** Construit l'instantané public à partir de l'état courant (organisateur). */
export function buildProgrammeSnapshot(
  schedule: ConferenceSchedule,
  articles: Article[],
  organizers: Organizer[]
): PublishedProgrammeData {
  const acceptedIds = new Set(
    articles.filter((a) => a.status === "accepted").map((a) => a.id)
  );
  return {
    schedule: {
      name: schedule.name,
      days: schedule.days,
      rooms: schedule.rooms,
      startHour: schedule.startHour,
      endHour: schedule.endHour,
      dayHours: schedule.dayHours,
      slots: schedule.slots.filter((s) => acceptedIds.has(s.articleId)),
      specialSlots: schedule.specialSlots || [],
    },
    articles: articles
      .filter((a) => acceptedIds.has(a.id))
      .map((a) => ({
        id: a.id,
        title: a.title,
        authors: a.authors,
        moderator: a.moderator,
        sessionChair: a.sessionChair,
        category: a.category,
        duration: a.duration,
        type: a.type,
      })),
    organizers,
    generatedAt: new Date().toISOString(),
  };
}

/** Statut de publication actuel, pour l'affichage côté organisateur. */
export async function getPublicationStatus(
  conferenceId: string
): Promise<{ status: PublicationStatus; publishedAt: string | null; updatedAt: string } | null> {
  const { data, error } = await supabase
    .from("published_schedules")
    .select("status,published_at,updated_at")
    .eq("conference_id", conferenceId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    status: data.status as PublicationStatus,
    publishedAt: data.published_at as string | null,
    updatedAt: data.updated_at as string,
  };
}

/** Publie (ou republie) le programme comme "provisoire" ou "définitif". */
export async function publishProgramme(
  conferenceId: string,
  status: "provisional" | "final",
  snapshot: PublishedProgrammeData
): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const now = new Date().toISOString();
  const { error } = await supabase.from("published_schedules").upsert(
    {
      conference_id: conferenceId,
      status,
      data: snapshot as unknown as Record<string, unknown>,
      published_at: now,
      published_by: userData.user?.id,
      updated_at: now,
    },
    { onConflict: "conference_id" }
  );
  if (error) throw error;
}

/** Dépublie le programme : redevient invisible pour les communicants. */
export async function unpublishProgramme(conferenceId: string): Promise<void> {
  const { error } = await supabase
    .from("published_schedules")
    .update({ status: "draft", updated_at: new Date().toISOString() })
    .eq("conference_id", conferenceId);
  if (error) throw error;
}

/** Lecture publique (communicants) — ne renvoie rien tant que le statut est "draft" (bloqué par la RLS). */
export async function fetchPublishedProgramme(
  conferenceId: string
): Promise<PublishedScheduleRow | null> {
  const { data, error } = await supabase
    .from("published_schedules")
    .select("conference_id,status,data,published_at,updated_at")
    .eq("conference_id", conferenceId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return data as unknown as PublishedScheduleRow;
}
