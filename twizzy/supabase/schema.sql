-- Twizzy database. Paste this whole file into Supabase → SQL Editor → Run.
-- Safe to run again. Only the owner (the email in `owners`) can read or change
-- anything from the app; the GitHub agent uses the service-role key.

create extension if not exists pg_net with schema extensions;

-- Who may use the Twizzy app.
create table if not exists owners (email text primary key);
insert into owners (email) values ('nelsonningz@gmail.com') on conflict do nothing;

create or replace function is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from owners where lower(email) = lower(auth.jwt() ->> 'email'));
$$;

-- Ideas Twizzy proposes. status: proposed → approved → produced, or passed.
create table if not exists concepts (
  id text primary key default 'c-' || substr(md5(random()::text), 1, 8),
  title text not null,
  hook text, pitch text, format text,
  platforms text[] default '{}',
  status text not null default 'proposed',
  note text,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

-- Finished videos and posters. status: making → awaiting_approval → approved /
-- changes_requested / rejected → posted.
create table if not exists posts (
  id text primary key default 'p-' || substr(md5(random()::text), 1, 8),
  title text not null,
  concept_id text references concepts (id) on delete set null,
  campaign text,                       -- marketing/campaigns/<folder> in the repo
  platforms text[] default '{}',
  status text not null default 'awaiting_approval',
  media_kind text,                     -- video | image
  media_path text,                     -- path in the "media" storage bucket
  caption text, why text, note text,
  scheduled_for date,
  posted_at timestamptz,
  links jsonb default '{}',
  stats jsonb,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

-- Videos or links the owner likes. status: new → studied → used.
create table if not exists refs (
  id text primary key default 'r-' || substr(md5(random()::text), 1, 8),
  kind text not null default 'link',   -- link | file
  url text, media_path text,
  title text, note text, learned text,
  status text not null default 'new',
  created_at timestamptz not null default now()
);

-- Comments and reviews with drafted replies.
create table if not exists inbox (
  id text primary key default 'i-' || substr(md5(random()::text), 1, 8),
  platform text, author text, text text, rating int,
  post_title text, link text,
  draft_reply text, final_reply text,
  needs_manual boolean default true, flag_reason text,
  status text not null default 'pending', -- pending / flagged / approved / sent / skipped
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

-- Everything the owner asks Twizzy to do. Each new row wakes the agent.
create table if not exists commands (
  id bigint generated always as identity primary key,
  kind text not null default 'message', -- message | make_idea | remake_post | study_ref | ideas_now | reply
  ref_id text,
  text text not null,
  status text not null default 'queued', -- queued / working / done / failed
  result text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists activity (
  id bigint generated always as identity primary key,
  text text not null,
  kind text not null default 'twizzy',   -- twizzy | you
  at timestamptz not null default now()
);

-- One row each: 'settings', 'accounts', 'agent' (what Twizzy is doing now), 'request'.
create table if not exists config (
  id text primary key,
  data jsonb not null default '{}',
  updated_at timestamptz not null default now()
);
insert into config (id, data) values
  ('settings', '{"paused": false, "reply_mode": "approve", "tone": "friendly", "languages": "English, with some Chichewa",
                 "music": "original", "hashtags": "#Ndalama #Malawi #Kwacha #MoneyTips #Budgeting #MalawiTikTok",
                 "avoid": "Promises of profit, interest rates, competitors by name",
                 "frequency": {"tiktok": 4, "x": 7},
                 "links": {"apkpure": "https://apkpure.com/ndalama/mw.nelson.ndalama", "uptodown": "",
                           "apk": "https://github.com/Nlerealest/Nelson/releases/download/ndalama-latest/ndalama.apk"}}'),
  ('accounts', '{"tiktok": {"handle": "@ndalama82", "status": "manual"}, "x": {"handle": "X account", "status": "manual"},
                 "apkpure": {"handle": "apkpure.com/ndalama", "status": "live"}, "uptodown": {"handle": "Uptodown", "status": "review"}}'),
  ('agent', '{"state": "idle", "message": "Waiting for your first command"}'),
  ('request', '{"open": true, "text": "Send me 2–3 TikToks or Reels you love the style of. I''ll use them for the next videos."}')
on conflict (id) do nothing;

-- Row-level security: the owner only.
do $$ declare t text; begin
  foreach t in array array['owners','concepts','posts','refs','inbox','commands','activity','config'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists owner_all on %I', t);
    execute format('create policy owner_all on %I for all to authenticated using (is_owner()) with check (is_owner())', t);
  end loop;
end $$;

-- Live updates in the app.
do $$ declare t text; begin
  foreach t in array array['concepts','posts','refs','inbox','commands','activity','config'] loop
    begin execute format('alter publication supabase_realtime add table %I', t);
    exception when duplicate_object then null; end;
  end loop;
end $$;

-- Storage for videos, posters and reference files (private; the app uses signed links).
insert into storage.buckets (id, name, public) values ('media', 'media', false) on conflict (id) do nothing;
drop policy if exists twizzy_media_owner on storage.objects;
create policy twizzy_media_owner on storage.objects for all to authenticated
  using (bucket_id = 'media' and is_owner()) with check (bucket_id = 'media' and is_owner());

-- Wake the agent: each new command starts the "Twizzy agent" GitHub Action.
-- Needs a GitHub token saved in the vault as 'github_token' (see SETUP.md).
create or replace function wake_twizzy() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare tok text;
begin
  select decrypted_secret into tok from vault.decrypted_secrets where name = 'github_token' limit 1;
  if tok is null then
    insert into activity (text) values ('Couldn''t wake Twizzy: the GitHub token is missing in Supabase Vault. It will still run at the daily check.');
    return new;
  end if;
  perform net.http_post(
    url := 'https://api.github.com/repos/Nlerealest/Nelson/dispatches',
    body := jsonb_build_object('event_type', 'twizzy', 'client_payload', jsonb_build_object('command_id', new.id)),
    headers := jsonb_build_object('Authorization', 'Bearer ' || tok, 'Accept', 'application/vnd.github+json', 'Content-Type', 'application/json',
                                  'User-Agent', 'twizzy-supabase', 'X-GitHub-Api-Version', '2022-11-28'));
  return new;
end $$;
drop trigger if exists wake_twizzy on commands;
create trigger wake_twizzy after insert on commands for each row execute function wake_twizzy();
