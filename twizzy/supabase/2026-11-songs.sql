-- Song questions: Twizzy asks which song to use before making each video.
-- Run once in Supabase → SQL Editor (safe to run again).
alter table posts add column if not exists question text;
alter table posts add column if not exists song jsonb;
update config set data = jsonb_set(data, '{music}', '"ask"'), updated_at = now() where id = 'settings';
