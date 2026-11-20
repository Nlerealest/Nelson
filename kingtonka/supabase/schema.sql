-- King Tonka database. Paste this whole file into Supabase → SQL Editor → Run.
-- It lives in the same Supabase project as Twizzy (all tables start with kt_),
-- so the same login, keys and GitHub token work. Safe to run again: run it again
-- whenever King Tonka gets new features (it only adds what's missing).
-- Run Twizzy's schema first: it creates the owners list and is_owner().

create extension if not exists pg_net with schema extensions;

-- One long video to clip. status: queued → downloading → transcribing → finding →
-- rendering → done, or failed.
create table if not exists kt_projects (
  id text primary key default 'p-' || substr(md5(random()::text), 1, 8),
  source_url text,                 -- a YouTube / X / TikTok / … link
  source_path text,                -- or a file uploaded from the phone (storage path)
  title text,
  status text not null default 'queued',
  step text,                       -- what is happening now, shown in the app
  percent int default 0,
  duration_s numeric,
  thumb_path text,
  settings jsonb not null default '{}',  -- clips, length, aspect, captions, framing, prompt, range…
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The clips Claude finds. status: planned → rendering → ready, or failed.
-- rerender (you changed the trim, captions or framing) and editing (you asked
-- Claude for a change) go back through rendering.
create table if not exists kt_clips (
  id text primary key default 'c-' || substr(md5(random()::text), 1, 8),
  project_id text not null references kt_projects (id) on delete cascade,
  rank int,
  title text,
  hook text,                       -- the opening line that grabs attention
  start_s numeric not null,
  end_s numeric not null,
  score int,                       -- 0–100 overall
  scores jsonb default '{}',       -- {hook, flow, value, trend}
  why text,                        -- why this moment works
  post_text text,                  -- ready-to-post caption
  hashtags text,
  transcript text,
  words jsonb,                     -- [[start, end, word], …] relative to the clip; editable in the app
  style jsonb default '{}',        -- {aspect, captions, position, framing, hook_title, color}
  media_path text,
  thumb_path text,
  status text not null default 'planned',
  liked boolean default false,
  posted_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists kt_clips_project on kt_clips (project_id);

-- Paid clipping campaigns you've joined (Content Rewards, Reach, Whop…). A video
-- linked to one follows its rules, and its clips get its hashtags.
create table if not exists kt_campaigns (
  id text primary key default 'k-' || substr(md5(random()::text), 1, 8),
  name text not null,
  url text,                        -- the campaign page, where you submit clips
  creator text,                    -- whose content you clip, e.g. Lacy
  rate numeric,                    -- pay per 1,000 views
  min_views int,                   -- views a clip needs before it's paid
  platforms text[] default '{}',   -- tiktok, youtube, instagram, x
  hashtags text,                   -- must be in every post
  mentions text,                   -- accounts to tag, e.g. @lacy
  rules text,                      -- the campaign's requirements, pasted in
  length text default 'auto',      -- clip length for this campaign
  needs_face boolean default false,-- the creator must be on screen
  active boolean default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Posting and submitting a clip to its campaign (added with campaigns).
alter table kt_clips add column if not exists post_url text;
alter table kt_clips add column if not exists submitted_at timestamptz;

-- Everything you ask for. Each new row wakes the agent on GitHub.
create table if not exists kt_commands (
  id bigint generated always as identity primary key,
  kind text not null default 'message', -- process | more | edit | rerender | message
  project_id text,
  clip_id text,
  text text not null,
  status text not null default 'queued', -- queued / working / done / failed
  result text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists kt_activity (
  id bigint generated always as identity primary key,
  text text not null,
  kind text not null default 'agent',  -- agent | you
  at timestamptz not null default now()
);

-- 'agent' (what King Tonka is doing now) and 'defaults' (your usual settings).
create table if not exists kt_config (
  id text primary key,
  data jsonb not null default '{}',
  updated_at timestamptz not null default now()
);
insert into kt_config (id, data) values
  ('agent', '{"state": "idle", "message": "Paste a video link to get your first clips"}'),
  ('defaults', '{"clips": "auto", "length": "auto", "aspect": "9:16", "captions": "bold", "position": "middle",
                 "framing": "auto", "hook_title": true, "color": "#FFD400", "language": "auto", "watermark": ""}')
on conflict (id) do nothing;

-- Row-level security: the owner only.
do $$ declare t text; begin
  foreach t in array array['kt_projects','kt_clips','kt_commands','kt_activity','kt_config','kt_campaigns'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists owner_all on %I', t);
    execute format('create policy owner_all on %I for all to authenticated using (is_owner()) with check (is_owner())', t);
  end loop;
end $$;

-- Live updates in the app.
do $$ declare t text; begin
  foreach t in array array['kt_projects','kt_clips','kt_commands','kt_activity','kt_config','kt_campaigns'] loop
    begin execute format('alter publication supabase_realtime add table %I', t);
    exception when duplicate_object then null; end;
  end loop;
end $$;

-- Storage for uploaded videos, finished clips and transcripts (private).
insert into storage.buckets (id, name, public) values ('kingtonka', 'kingtonka', false) on conflict (id) do nothing;
drop policy if exists kingtonka_owner on storage.objects;
create policy kingtonka_owner on storage.objects for all to authenticated
  using (bucket_id = 'kingtonka' and is_owner()) with check (bucket_id = 'kingtonka' and is_owner());

-- Wake the agent: each new command starts the "King Tonka agent" GitHub Action.
-- Uses the GitHub token already saved in the vault as 'github_token' for Twizzy.
create or replace function wake_kingtonka() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare tok text;
begin
  select decrypted_secret into tok from vault.decrypted_secrets where name = 'github_token' limit 1;
  if tok is null then
    insert into kt_activity (text) values ('Couldn''t wake King Tonka: the GitHub token is missing in Supabase Vault.');
    return new;
  end if;
  perform net.http_post(
    url := 'https://api.github.com/repos/Nlerealest/Nelson/dispatches',
    body := jsonb_build_object('event_type', 'kingtonka', 'client_payload', jsonb_build_object('command_id', new.id)),
    headers := jsonb_build_object('Authorization', 'Bearer ' || tok, 'Accept', 'application/vnd.github+json', 'Content-Type', 'application/json',
                                  'User-Agent', 'kingtonka-supabase', 'X-GitHub-Api-Version', '2022-11-28'));
  return new;
end $$;
drop trigger if exists wake_kingtonka on kt_commands;
create trigger wake_kingtonka after insert on kt_commands for each row execute function wake_kingtonka();
