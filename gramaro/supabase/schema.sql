-- Gramaro Travel database. Paste this whole file into Supabase → SQL Editor → Run.
-- Safe to run again.
--
-- Two kinds of users sign in to the same app:
--   • customers: anyone who signs up. They only ever see their own trips.
--   • staff: emails listed in `staff`. They see and work on every request.
--
-- The trip flow (requests.status):
--   new → quoting → quoted → accepted → paid → confirmed → ticketed → completed
--   (or cancelled at any point before ticketing)
-- Customers move a request forward only through the functions at the bottom
-- (accept_quote, submit_payment, cancel_request), so they can't change prices
-- or mark their own payment as verified.

-- ───────────────────────── Who is staff ─────────────────────────
create table if not exists staff (
  email text primary key,
  name text
);
-- Add the agency's staff here (one line each), then run again:
-- insert into staff (email, name) values ('agent@example.com', 'Agent name') on conflict do nothing;

create or replace function is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from staff where lower(email) = lower(auth.jwt() ->> 'email'));
$$;

-- ───────────────────────── Tables ─────────────────────────
create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  passport_number text,
  passport_expiry date,
  nationality text default 'Malawian',
  created_at timestamptz not null default now()
);

create table if not exists requests (
  id uuid primary key default gen_random_uuid(),
  ref text unique default 'GT-' || upper(substr(md5(random()::text), 1, 6)),
  customer_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  customer_name text,
  customer_phone text,
  kind text not null default 'flight',        -- flight | visa | planning | other
  trip_type text default 'return',            -- oneway | return
  origin text,
  destination text,
  depart_on date,
  return_on date,
  adults int not null default 1,
  children int not null default 0,
  infants int not null default 0,
  cabin text default 'economy',
  flexible boolean default false,
  budget text,
  notes text,
  status text not null default 'new',
  assigned_to text,                           -- staff email
  chosen_quote_id uuid,
  pnr text,                                   -- airline booking reference
  ticket_numbers text,
  amount_due_mwk numeric,
  amount_paid_mwk numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists quotes (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references requests (id) on delete cascade,
  airline text not null,
  route text,                                 -- e.g. LLW → ADD → DXB
  outbound text,                              -- e.g. 12 Dec 13:45, 1 stop
  inbound text,
  baggage text,
  details text,
  price_usd numeric,
  price_mwk numeric not null,
  hold_until timestamptz,                     -- airline ticketing time limit
  status text not null default 'offered',     -- offered | accepted | declined
  created_at timestamptz not null default now()
);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references requests (id) on delete cascade,
  customer_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  method text not null,                       -- airtel | mpamba | bank | cash
  amount_mwk numeric not null check (amount_mwk > 0),
  reference text,                             -- mobile money / bank transaction ID
  status text not null default 'submitted',   -- submitted | verified | rejected
  note text,
  created_at timestamptz not null default now(),
  verified_at timestamptz,
  verified_by text
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references requests (id) on delete cascade,
  sender_id uuid default auth.uid(),
  from_staff boolean not null default false,
  body text not null check (length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

-- Timeline of everything that happened to a request (written by triggers).
create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references requests (id) on delete cascade,
  customer_id uuid,
  text text not null,
  created_at timestamptz not null default now()
);

create table if not exists deals (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  route text,
  price_mwk numeric,
  valid_until date,
  details text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Agency settings everyone can read: today's dollar rate, account numbers, etc.
create table if not exists settings (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
insert into settings (id, data) values
  ('rate', '{"usd_mwk": 1750, "note": "Gramaro selling rate"}'),
  ('contacts', '{"phones": ["0884 099 227", "0881 737 157", "099 925 349"], "whatsapp": "265884099227", "office": "Zomba, Malawi"}'),
  ('payment', '{"airtel": "0884 099 227 (Gramaro Travel)", "mpamba": "0881 737 157 (Gramaro Travel)", "bank": "Ask us for the bank account details"}')
on conflict (id) do nothing;

create index if not exists requests_customer on requests (customer_id);
create index if not exists quotes_request on quotes (request_id);
create index if not exists payments_request on payments (request_id);
create index if not exists messages_request on messages (request_id);
create index if not exists events_request on events (request_id);

-- ───────────────────────── Who can see what ─────────────────────────
create or replace function owns_request(rid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from requests where id = rid and customer_id = auth.uid());
$$;

alter table staff enable row level security;
alter table profiles enable row level security;
alter table requests enable row level security;
alter table quotes enable row level security;
alter table payments enable row level security;
alter table messages enable row level security;
alter table events enable row level security;
alter table deals enable row level security;
alter table settings enable row level security;

drop policy if exists staff_read on staff;
create policy staff_read on staff for select to authenticated using (is_staff());

drop policy if exists profiles_own on profiles;
create policy profiles_own on profiles for all to authenticated
  using (id = auth.uid() or is_staff()) with check (id = auth.uid() or is_staff());

drop policy if exists requests_read on requests;
create policy requests_read on requests for select to authenticated using (customer_id = auth.uid() or is_staff());
drop policy if exists requests_new on requests;
create policy requests_new on requests for insert to authenticated
  with check (customer_id = auth.uid() and status = 'new' and amount_paid_mwk = 0 and pnr is null and chosen_quote_id is null);
drop policy if exists requests_staff on requests;
create policy requests_staff on requests for update to authenticated using (is_staff()) with check (is_staff());
drop policy if exists requests_staff_del on requests;
create policy requests_staff_del on requests for delete to authenticated using (is_staff());

drop policy if exists quotes_read on quotes;
create policy quotes_read on quotes for select to authenticated using (is_staff() or owns_request(request_id));
drop policy if exists quotes_staff on quotes;
create policy quotes_staff on quotes for all to authenticated using (is_staff()) with check (is_staff());

drop policy if exists payments_read on payments;
create policy payments_read on payments for select to authenticated using (is_staff() or customer_id = auth.uid());
drop policy if exists payments_staff on payments;
create policy payments_staff on payments for all to authenticated using (is_staff()) with check (is_staff());

drop policy if exists messages_read on messages;
create policy messages_read on messages for select to authenticated using (is_staff() or owns_request(request_id));
drop policy if exists messages_send on messages;
create policy messages_send on messages for insert to authenticated
  with check (sender_id = auth.uid() and from_staff = is_staff() and (is_staff() or owns_request(request_id)));

drop policy if exists events_read on events;
create policy events_read on events for select to authenticated using (is_staff() or customer_id = auth.uid());

drop policy if exists deals_read on deals;
create policy deals_read on deals for select to anon, authenticated using (active or is_staff());
drop policy if exists deals_staff on deals;
create policy deals_staff on deals for all to authenticated using (is_staff()) with check (is_staff());

drop policy if exists settings_read on settings;
create policy settings_read on settings for select to anon, authenticated using (true);
drop policy if exists settings_staff on settings;
create policy settings_staff on settings for all to authenticated using (is_staff()) with check (is_staff());

-- ───────────────────────── Automatic updates ─────────────────────────
create or replace function log_event(rid uuid, msg text) returns void
language sql security definer set search_path = public as $$
  insert into events (request_id, customer_id, text)
  select id, customer_id, msg from requests where id = rid;
$$;

create or replace function status_label(s text) returns text language sql immutable as $$
  select case s
    when 'new' then 'Request received'
    when 'quoting' then 'An agent is finding the best fares'
    when 'quoted' then 'Fare options are ready'
    when 'accepted' then 'Option chosen, waiting for payment'
    when 'paid' then 'Payment sent, waiting for confirmation'
    when 'confirmed' then 'Payment confirmed, issuing your ticket'
    when 'ticketed' then 'Your ticket is issued'
    when 'completed' then 'Trip completed'
    when 'cancelled' then 'Request cancelled'
    else s end;
$$;

create or replace function on_request_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    -- Fill the customer's name and phone from their profile.
    new.customer_name := coalesce(nullif(new.customer_name, ''), (select full_name from profiles where id = new.customer_id));
    new.customer_phone := coalesce(nullif(new.customer_phone, ''), (select phone from profiles where id = new.customer_id));
    return new;
  end if;
  new.updated_at := now();
  return new;
end $$;

create or replace function after_request_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform log_event(new.id, 'Request received. We''ll reply with fares shortly.');
  elsif new.status is distinct from old.status then
    perform log_event(new.id, status_label(new.status)
      || case when new.status = 'ticketed' and new.pnr is not null then ' (booking ref ' || new.pnr || ')' else '' end);
  end if;
  return null;
end $$;

drop trigger if exists requests_before on requests;
create trigger requests_before before insert or update on requests for each row execute function on_request_change();
drop trigger if exists requests_after on requests;
create trigger requests_after after insert or update on requests for each row execute function after_request_change();

-- A new fare option moves the request to "quoted".
create or replace function after_quote_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update requests set status = 'quoted' where id = new.request_id and status in ('new', 'quoting');
  perform log_event(new.request_id, 'New fare: ' || new.airline || ' MK ' || to_char(new.price_mwk, 'FM999,999,999'));
  return null;
end $$;
drop trigger if exists quotes_after on quotes;
create trigger quotes_after after insert on quotes for each row execute function after_quote_insert();

-- When staff verify or reject a payment, update what's been paid.
create or replace function after_payment_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare paid numeric; due numeric;
begin
  if (tg_op = 'INSERT' and new.status = 'verified') or (tg_op = 'UPDATE' and new.status is distinct from old.status) then
    select coalesce(sum(amount_mwk), 0) into paid from payments where request_id = new.request_id and status = 'verified';
    select amount_due_mwk into due from requests where id = new.request_id;
    update requests set amount_paid_mwk = paid,
      status = case when status in ('accepted', 'paid') and due is not null and paid >= due then 'confirmed'
                    -- nothing left to check and still a balance: back to "waiting for payment"
                    when status = 'paid' and not exists (select 1 from payments where request_id = new.request_id and status = 'submitted') then 'accepted'
                    else status end
      where id = new.request_id;
    perform log_event(new.request_id, case new.status
      when 'verified' then 'Payment of MK ' || to_char(new.amount_mwk, 'FM999,999,999') || ' confirmed'
      when 'rejected' then 'Payment could not be confirmed' || coalesce(': ' || new.note, '')
      else 'Payment updated' end);
  end if;
  return null;
end $$;
drop trigger if exists payments_after on payments;
create trigger payments_after after insert or update on payments for each row execute function after_payment_change();

-- ───────────────────────── Customer actions ─────────────────────────
create or replace function accept_quote(qid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare q quotes; r requests;
begin
  select * into q from quotes where id = qid;
  select * into r from requests where id = q.request_id;
  if r.id is null or (r.customer_id <> auth.uid() and not is_staff()) then raise exception 'Not your request'; end if;
  if r.status not in ('quoted', 'accepted') then raise exception 'This request can''t change option now'; end if;
  if q.hold_until is not null and q.hold_until < now() then raise exception 'This fare has expired. Ask us to re-check the price.'; end if;
  update quotes set status = case when id = qid then 'accepted' else 'declined' end where request_id = r.id;
  update requests set chosen_quote_id = qid, amount_due_mwk = q.price_mwk, status = 'accepted' where id = r.id;
end $$;

create or replace function submit_payment(rid uuid, pay_method text, amount numeric, ref text) returns void
language plpgsql security definer set search_path = public as $$
declare r requests;
begin
  select * into r from requests where id = rid;
  if r.id is null or r.customer_id <> auth.uid() then raise exception 'Not your request'; end if;
  if r.status not in ('accepted', 'paid', 'confirmed', 'ticketed') then raise exception 'Choose a fare option first'; end if;
  if pay_method not in ('airtel', 'mpamba', 'bank', 'cash') then raise exception 'Unknown payment method'; end if;
  if coalesce(trim(ref), '') = '' and pay_method <> 'cash' then raise exception 'Enter the transaction ID from your SMS'; end if;
  insert into payments (request_id, customer_id, method, amount_mwk, reference) values (rid, auth.uid(), pay_method, amount, trim(ref));
  update requests set status = 'paid' where id = rid and status = 'accepted';
  perform log_event(rid, 'Payment of MK ' || to_char(amount, 'FM999,999,999') || ' sent by ' || pay_method || ', checking it now');
end $$;

create or replace function cancel_request(rid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r requests;
begin
  select * into r from requests where id = rid;
  if r.id is null or (r.customer_id <> auth.uid() and not is_staff()) then raise exception 'Not your request'; end if;
  if r.status in ('ticketed', 'completed') and not is_staff() then raise exception 'Ticket already issued: message us to change or refund it'; end if;
  update requests set status = 'cancelled' where id = rid;
end $$;

revoke all on function accept_quote(uuid), submit_payment(uuid, text, numeric, text), cancel_request(uuid) from anon;
grant execute on function accept_quote(uuid), submit_payment(uuid, text, numeric, text), cancel_request(uuid), is_staff() to authenticated;

-- ───────────────────────── Real-time ─────────────────────────
-- Every change to these tables reaches open apps instantly (each user only
-- receives rows the rules above let them see).
do $$
declare t text;
begin
  foreach t in array array['requests', 'quotes', 'payments', 'messages', 'events', 'deals', 'settings', 'profiles'] loop
    begin
      execute format('alter publication supabase_realtime add table %I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
