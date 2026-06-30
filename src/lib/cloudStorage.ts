/**
 * Cloud storage for conference data via Supabase.
 * Replaces localStorage as the source of truth when the user is authenticated.
 * Falls back gracefully to localStorage when offline or not logged in.
 */
import { supabase } from '@/integrations/supabase/client';

export interface CloudProject {
  id: string;
  slug: string;
  name: string;
  updated_at: string;
  expires_at: string;
}

const EXPIRY_DAYS = 21;

/** Calcule le nombre de jours restants avant expiration */
export function daysUntilExpiry(expiresAt: string): number {
  const diff = new Date(expiresAt).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/** Renouvelle l'expiration d'un projet pour 21 jours supplémentaires */
export async function renewProject(slug: string): Promise<void> {
  const newExpiry = new Date(Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabase
    .from('conference_data')
    .update({ expires_at: newExpiry })
    .eq('slug', slug);
  if (error) throw error;
}

/** List all projects belonging to the current user */
export async function listProjects(): Promise<CloudProject[]> {
  const { data, error } = await supabase
    .from('conference_data')
    .select('id, slug, name, updated_at, expires_at')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as CloudProject[];
}

/** Load a project's full data blob */
export async function loadProject(slug: string): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase
    .from('conference_data')
    .select('data')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  return data ? (data.data as Record<string, unknown>) : null;
}

/** Save (upsert) a project — renouvelle automatiquement l expiration */
export async function saveProject(slug: string, name: string, data: Record<string, unknown>): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non authentifié');

  const now = new Date();
  const newExpiry = new Date(now.getTime() + EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase
    .from('conference_data')
    .upsert(
      {
        owner_id: user.id,
        slug,
        name,
        data,
        updated_at: now.toISOString(),
        expires_at: newExpiry,   // renouvelle à chaque sauvegarde
      },
      { onConflict: 'slug' }
    );
  if (error) throw error;
}

/** Delete a project and ALL related data (speakers, verify_config) */
export async function deleteProject(slug: string): Promise<void> {
  // 1. Supprimer les historiques de modifications des intervenants
  const { error: editsErr } = await supabase
    .from('speaker_edits')
    .delete()
    .eq('conference_id', slug);
  if (editsErr) throw editsErr;

  // 2. Supprimer les intervenants
  const { error: speakersErr } = await supabase
    .from('speakers')
    .delete()
    .eq('conference_id', slug);
  if (speakersErr) throw speakersErr;

  // 3. Supprimer la config de vérification
  const { error: configErr } = await supabase
    .from('verify_config')
    .delete()
    .eq('conference_id', slug);
  if (configErr) throw configErr;

  // 4. Supprimer les données du projet
  const { error } = await supabase
    .from('conference_data')
    .delete()
    .eq('slug', slug);
  if (error) throw error;
}
