-- ============================================================
-- ChronoConf — Schema Supabase
-- Exécuter dans : Dashboard Supabase → SQL Editor
-- ============================================================

-- ─── 1. Données de conférence (remplace localStorage) ────────
create table if not exists conference_data (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  slug        text not null unique,
  name        text not null default '',
  data        jsonb not null default '{}',
  updated_at  timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

-- ─── 2. Config de vérification ────────────────────────────────
create table if not exists verify_config (
  id             uuid primary key default gen_random_uuid(),
  conference_id  text not null unique,  -- = slug de la conférence
  token          text not null unique default substr(md5(random()::text || clock_timestamp()::text), 1, 16),
  note           text not null default '',
  contact        text not null default '',
  deadline       timestamptz,
  editable_cols  text[] not null default '{"nom","prenom","email","institution","titre","resume"}',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ─── 3. Intervenants ─────────────────────────────────────────
create table if not exists speakers (
  id             uuid primary key default gen_random_uuid(),
  conference_id  text not null references verify_config(conference_id) on delete cascade,
  code           text not null,
  nom            text not null default '',
  prenom         text not null default '',
  email          text not null default '',
  institution    text not null default '',
  titre          text not null default '',
  resume         text not null default '',
  verified_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (conference_id, code)
);

-- ─── 4. Historique des modifications ─────────────────────────
create table if not exists speaker_edits (
  id             uuid primary key default gen_random_uuid(),
  speaker_code   text not null,
  conference_id  text not null,
  field          text not null,
  old_value      text,
  new_value      text,
  edited_at      timestamptz not null default now()
);

-- ─── Index ────────────────────────────────────────────────────
create index if not exists idx_conference_data_owner on conference_data(owner_id);
create index if not exists idx_conference_data_slug  on conference_data(slug);
create index if not exists idx_speakers_conf_code    on speakers(conference_id, code);
create index if not exists idx_verify_config_token   on verify_config(token);
create index if not exists idx_speaker_edits_code    on speaker_edits(conference_id, speaker_code);

-- ─── RLS ──────────────────────────────────────────────────────
alter table conference_data  enable row level security;
alter table verify_config    enable row level security;
alter table speakers         enable row level security;
alter table speaker_edits    enable row level security;

-- conference_data : chaque utilisateur voit uniquement ses projets
create policy "conf_owner_all"
  on conference_data for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- verify_config : lecture publique (pour /verify), écriture via service_role uniquement
create policy "verify_config_public_read"
  on verify_config for select using (true);

-- speakers : accès via service_role uniquement (edge function)
-- (pas de politique anon → bloqué par défaut)

-- speaker_edits : accès via service_role uniquement
-- (pas de politique anon → bloqué par défaut)
