-- Moves Twizzy's current ideas and videos into Supabase. Run once, after schema.sql
-- and after saving the GitHub token in Vault: the last line asks the agent to
-- render the five videos again from their sources in the repository.
insert into concepts (id, title, hook, pitch, format, platforms, status, created_at) values
 ('c-payday', 'Payday vs Day 25', 'Payday me vs Day 25 me…', 'Split-screen skit: on payday the K250,000 feels endless; on day 25 the wallet is empty. Then the same month with Ndalama''s safe-to-spend number.', '15–20s vertical skit', '{tiktok,x}', 'produced', '2026-10-30T18:03:00Z'),
 ('c-where', 'Where did my kwacha go?', 'I tracked every kwacha for one month. This is where it went.', 'Monthly report reveal, ending with the surprise biggest leak. Invites people to share theirs.', '30s motion graphics', '{tiktok,x}', 'produced', '2026-10-30T18:04:00Z'),
 ('c-schoolfees', 'School fees without the panic', 'School fees are due in January.', 'A school-fees goal: how much to save each month, and the early warning if spending puts it at risk.', '30s voiceover video', '{tiktok,facebook}', 'produced', '2026-10-30T18:05:00Z'),
 ('c-chichewa', 'Ndalama in Chichewa', 'Ndalama zanu, m''manja mwanu.', 'Chichewa on screen with English subtitles.', '20–30s vertical', '{tiktok}', 'produced', '2026-10-30T18:06:00Z'),
 ('c-festive', 'December budget challenge', 'Survive December without going broke in January.', 'A 4-week challenge: budget, track, save K10,000, one no-spend weekend.', 'Weekly challenge video', '{tiktok,x}', 'produced', '2026-10-30T18:07:00Z'),
 ('c-fuel', 'Fuel queues, minibus fares', 'Fuel costs more. Does your transport budget know?', 'Fuel shortages and record pump prices are in the news (AFP / France 24, 30 Oct). Without joking about the queues, show how small minibus trips add up, and how the Transport budget warns you early.', '20s vertical, real budget screen', '{tiktok,x}', 'proposed', '2026-10-30T23:55:00Z'),
 ('c-maize', 'Groceries cost more every week', 'Maize went up again. Will your grocery money last the month?', 'AGRA reports maize up about 10% from August to September. Show Ndalama''s real warning that Groceries will go over budget at this pace.', '20s vertical, warning card zoom', '{tiktok,facebook}', 'proposed', '2026-10-30T23:55:30Z'),
 ('c-paydaychecklist', '3 things to do on payday', 'Salary just landed? Do these 3 things before you spend a kwacha.', 'Mark the bills, set savings aside, check the safe-to-spend number. Each step on the real app.', '15s vertical checklist', '{tiktok,x}', 'proposed', '2026-10-30T23:56:00Z'),
 ('c-christmas', '8 weeks to Christmas', 'Christmas is 8 weeks away. Start a small goal tonight.', 'A Christmas savings goal; the app works out the amount per month and per day.', '20s vertical, countdown', '{tiktok,facebook}', 'proposed', '2026-10-30T23:56:30Z'),
 ('c-pov', 'POV: you check your money on day 15', 'POV: it''s the 15th and you actually know where your money went.', 'Trending POV format: a calm mid-month moment on Ndalama''s home screen.', '10–12s vertical POV', '{tiktok}', 'proposed', '2026-10-30T23:57:00Z')
on conflict (id) do nothing;

insert into posts (id, title, concept_id, campaign, platforms, status, media_kind, caption, why, scheduled_for, created_at) values
 ('p-payday', 'Payday vs Day 25 (25s)', 'c-payday', '2026-11-payday', '{tiktok,x}', 'making', 'video',
  E'Payday me vs Day 25 me 😅 Same K250,000. Different ending.\n\nNdalama shows how much you can safely spend each day, after bills and savings are set aside.\n\n📲 Free on APKPure & Uptodown. Google Play and iPhone coming soon.\n\n#Ndalama #Malawi #Kwacha #Payday #MoneyTips',
  'Relatable payday-to-month-end skit. Numbers are the app''s real calculations. Original music.', null, '2026-10-30T23:58:00Z'),
 ('p-where', 'Where did my kwacha go? (30s)', 'c-where', '2026-11-where', '{tiktok,x}', 'making', 'video',
  E'I tracked every kwacha for a month. The surprise? Groceries 😳\n\nNdalama shows exactly where your money went at month end.\n\nWhat''s YOUR biggest leak? Tell us below 👇\n\n📲 Free on APKPure & Uptodown. Google Play and iPhone coming soon.\n\n#Ndalama #Malawi #Kwacha #Budgeting #MoneyTips',
  'Countdown reveal keeps people watching; the question drives comments. Original music.', null, '2026-10-31T00:02:00Z'),
 ('p-schoolfees', 'School fees without the panic (34s, voiceover)', 'c-schoolfees', '2026-11-schoolfees', '{tiktok,facebook}', 'making', 'video',
  E'School fees are due in January. Start now, not in the panic 🎒\n\nNdalama works out how much to save each month and warns you early if your spending puts the fees at risk.\n\n📲 Free on APKPure & Uptodown. Google Play and iPhone coming soon.\n\n#Ndalama #Malawi #SchoolFees #Parents #Kwacha',
  'Timely for parents. Turn on TikTok''s "AI-generated content" label (computer voice).', null, '2026-10-31T00:02:30Z'),
 ('p-chichewa', 'Ndalama in Chichewa (29s)', 'c-chichewa', '2026-11-chichewa', '{tiktok}', 'making', 'video',
  E'Moni! Ndalama zanu, m''manja mwanu 🇲🇼\n\nLembani ndalama zolowa ndi zotuluka. Dziwani zomwe mungagwiritse lero. Ndi yaulere, sifuna data.\n\n(Your money, in your hands. Free, works without data.)\n\n📲 APKPure & Uptodown. Google Play ndi iPhone: posachedwa.\n\n#Ndalama #Malawi #Chichewa #Kwacha',
  'Chichewa on screen with English subtitles. Please check the Chichewa wording before approving.', null, '2026-10-31T00:05:00Z'),
 ('p-festive', 'December budget challenge (30s)', 'c-festive', '2026-12-festive', '{tiktok,x}', 'making', 'video',
  E'Survive December without going broke in January 🎄\n\n4 weeks, 4 goals:\n1️⃣ Set a budget from what you earn\n2️⃣ Track every kwacha\n3️⃣ Save K10,000 for January\n4️⃣ One no-spend weekend\n\nJoin in and post your progress with #NdalamaChallenge\n\n📲 Free on APKPure & Uptodown. Google Play and iPhone coming soon.\n\n#Ndalama #Malawi #Kwacha #BudgetChallenge',
  'A challenge gives people a reason to come back every week. Best posted on 1 December.', '2026-12-01', '2026-10-31T00:10:00Z')
on conflict (id) do nothing;

insert into refs (id, kind, title, note, learned, status, created_at) values
 ('ref-apple', 'file', 'Clean Apple-style ad: words blurring in, floating cards', 'Minimal white look, word-by-word reveals', 'Blur-in word reveals, floating UI cards, full-colour brand moment. Used for the voiceover explainer advert.', 'used', '2026-10-29T15:25:00Z'),
 ('ref-motion', 'file', 'Motion-design showreel: 3D text, bouncing ball, bento grid', 'Fast cuts on the beat', 'Chrome 3D title, bouncing object, rolling counters, bento grid, search-bar end card. Used for the motion showreel advert.', 'used', '2026-10-30T17:49:00Z')
on conflict (id) do nothing;

insert into activity (text) values ('Twizzy moved into its own app. Rendering the five videos again from their sources…');
insert into commands (kind, text) values ('message', 'Setup: render the 5 posts with status "making" from their campaign folders, upload them and set them to awaiting_approval.');
