# Setting up King Tonka (about 5 minutes, once)

King Tonka turns long videos into short viral clips. It works like Twizzy and
shares Twizzy's setup, so most of the work is already done:

- **The King Tonka app** on your phone: paste a link or upload a video, watch, edit and share your clips.
- **Supabase**: the same project as Twizzy. King Tonka's tables start with `kt_`.
- **The agent**: runs on GitHub's servers. It downloads the video, writes down every word,
  then **Claude** (your Claude plan) picks and scores the best moments. Finally it cuts,
  reframes and captions each clip and sends it to the app.

It reuses Twizzy's GitHub secrets (`SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `CLAUDE_CODE_OAUTH_TOKEN`) and the GitHub token in Supabase Vault.
Nothing new to create.

## 1. Add King Tonka's tables

1. Open your Twizzy project on **supabase.com**, then go to **SQL Editor** → **New query**.
2. Open [`kingtonka/supabase/schema.sql`](supabase/schema.sql) on GitHub, tap **Copy raw file**, paste it in, then click **Run**. You should see "Success".

## 2. Install the app

1. On GitHub, open **Actions** → **King Tonka APK** → **Run workflow**. It also builds by itself when the app changes.
2. When it's green (about 15 minutes), open this link on your phone and install:
   **https://github.com/Nlerealest/Nelson/releases/download/kingtonka-latest/king-tonka.apk**
3. Open King Tonka and sign in with **the same email and password as Twizzy**.

## 3. Try it

On **Create**, paste a YouTube link to a talking video (a podcast or interview works best) and tap **Get clips**.

- The video shows **Download → Transcribe → Find moments → Edit clips → Ready**.
- Your clips appear in about 10–30 minutes, depending on the video's length. The best clip is shown first.
- Tap a clip to watch it, see its viral score, copy the caption, **Save to phone** or **Share**, and edit it.

You can follow each run on GitHub: **Actions** → **King Tonka agent**.

---

## What you can do

| Where | What |
| --- | --- |
| **Create** | Paste a link (YouTube, X, TikTok, Instagram, Twitch, Vimeo, Facebook, Google Drive, Dropbox…), up to 10 hours long (whole streams work), or upload a video (up to 800 MB). You can also share a link from the YouTube app: **Share → King Tonka**. Pick how many clips, their length, shape (9:16, 1:1, 4:5, 16:9), caption style, framing, and what to look for ("the funniest moments"). You can also use only part of the video. |
| **A video** | Progress while it works, then all its clips by viral score or in order. **Find more clips**, **Try again**, **Delete**. |
| **A clip → Post** | Ready-made caption and hashtags: edit them, **Copy caption**, **Save to phone**, **Share**, **Mark as posted**, ❤️ to like. |
| **A clip → Edit** | Trim the start and end (±1 s, ±5 s), change the hook title, caption style, position and colour, framing, shape, watermark, then **Save and update clip**. Or **Ask Claude to change it** in your own words. |
| **A clip → Caption text** | Fix misheard words or names in the captions. |
| **A clip → Score** | The viral score (hook, flow, value, trend), why Claude picked it, and the transcript. |
| **My clips** | Every clip from every video, best first. Filter: score 80+, liked, not posted, posted. |
| **More** | Ask King Tonka anything, your default options, activity log, sign out. |

**Caption styles:** *Bold* (big words, the spoken one lights up), *Pop* (one word at a time), *Karaoke* (words fill with colour as they're spoken), *Clean* (calm lines on a dark box), *None*.

**Framing:** *Follow speaker* finds the face and cuts to whoever is on screen. *Fit* shows the whole picture on a blurred background. *Left / Center / Right* keep a fixed crop.

## Paid clipping campaigns (Content Rewards, Reach, Whop…)

**One-time update first:** in Supabase → SQL Editor → New query, paste
[`kingtonka/supabase/schema.sql`](supabase/schema.sql) again and click **Run**. It only adds
what's new (campaigns, and post links on clips). Until then, the Campaigns tab shows a reminder.

1. **Join the campaign** on its website (for example Content Rewards), and link your TikTok /
   YouTube / Instagram there.
2. **Campaigns tab → Add campaign → Choose screenshots.** Screenshot the campaign's page
   (its rules, requirements and pay; several screenshots are fine) and pick them. King Tonka
   reads them and fills in the campaign in a few minutes: who you clip, pay per 1,000 views,
   views needed to get paid, where you post, required hashtags and @tags, length, and every
   rule. Check what it filled in and fix anything. You can add more screenshots or tap
   **Read them again** later. (Or type the details in yourself.)
3. **Clip a video for it:** on the campaign tap **Clip a video for it**, or pick the campaign
   under **For a campaign?** on Create (also when you share from YouTube). Claude follows the
   campaign's rules when it picks the clips.
4. **Post a clip:** open it → **Post** → **Copy caption** (the campaign's hashtags and @tags
   are added for you) → Save or Share → post it.
5. **Right after posting:** copy your post's link in TikTok/YouTube, tap **Paste** on the clip,
   then **I posted it**. A countdown starts, and your phone reminds you after 20 minutes.
6. **Submit within 30 minutes:** tap **Copy link & open campaign**, tap *Submit clip* there,
   paste, and come back to tap **I submitted it**.

**My clips → To submit** lists every posted clip you haven't submitted yet, closest to the
deadline first. Views only count from when you submit, so submit fast.

## Good to know

- **Storage:** Supabase's free plan holds 1 GB. Each clip is about 5–40 MB, so delete old videos you've already posted. A video's clips are deleted with it.
- **Uploads** from the phone go up in 45 MB pieces, so any length works up to 800 MB. They count toward the 1 GB, so delete videos you're done with.
- **Claude** usage counts against your Claude plan's limits. Only picking clips and making edits use Claude. Downloading, transcribing and rendering don't.
- **GitHub Actions** is free for this public repository.

## YouTube and Twitch links

YouTube asks GitHub's servers to sign in before it allows a download ("Sign in to confirm
you're not a bot"). Twitch does the same for subscriber-only videos. King Tonka can sign in
with **your** account if you give it your browser's sign-in cookies once.

You have two choices:

- **No setup:** tap **Upload the file instead** on the video. Uploads work for any length
  up to 800 MB.
- **Sign in once (about 10 minutes, on a computer):** follow these steps.

1. **Install the cookie exporter.** On your computer, add the extension **“Get cookies.txt LOCALLY”**
   from the Chrome Web Store or Firefox Add-ons. (Use this one: it never sends your cookies anywhere.)
   Then allow it in private windows: in Chrome open the extension's **Details** and turn on **Allow in Incognito**.
   In Firefox it's **Run in Private Windows**.
2. **Open a private window** (Chrome: Ctrl+Shift+N, Firefox: Ctrl+Shift+P) and sign in to youtube.com.
   Use a spare Google account if you can, because YouTube can limit an account that downloads a lot.
3. **Export YouTube, then close the window.** In that same private window, go to
   `youtube.com/robots.txt`, click the extension icon, then **Export**. It downloads a
   `youtube.com_cookies.txt` file. **Close the private window straight away and don't sign in
   there again.** This matters: if that window keeps using YouTube, YouTube replaces the sign-in
   and the copy you gave King Tonka stops working within minutes.
4. **Export Twitch (optional).** Open a new private window, sign in to twitch.tv, click the icon, **Export**, and close the window.
5. **Make one file.** Open the YouTube file in Notepad, then paste the Twitch file's lines
   (everything except its first `# Netscape HTTP Cookie File` line) at the end.
6. **Save it on GitHub.** Open **github.com/Nlerealest/Nelson** → **Settings** → **Secrets and variables** →
   **Actions** → **New repository secret**:
   - **Name:** `KT_COOKIES`
   - **Secret:** paste the whole file.
   - Click **Add secret**. GitHub keeps it encrypted, and King Tonka never shows it.
7. **Test it.** In the app, open the video that failed and tap **Try again**.

Good to know:

- **The sign-in lasts weeks to months** when you export it this way. When the app says
  “Your YouTube sign-in has expired”, repeat steps 2–6 and replace the `KT_COOKIES` secret
  (open it on GitHub and click **Update**).
- Only clip videos you made or have permission to use.
- Public Twitch VODs and clips usually work with no sign-in.
- X, TikTok, Instagram, Vimeo, Google Drive and Dropbox links usually need nothing.

## If something goes wrong

- A video stuck on **Waiting**: the agent didn't wake up. Check **More → Activity** for a note, and check that Twizzy works (they share the GitHub token).
- Open **GitHub → Actions → King Tonka agent** and read the latest run.
- **Try again** on a failed video starts it from the beginning.
