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
| **Create** | Paste a link (YouTube, X, TikTok, Instagram, Twitch, Vimeo, Facebook, Google Drive, Dropbox…) or upload a video up to 50 MB. Pick how many clips, their length, shape (9:16, 1:1, 4:5, 16:9), caption style, framing, and what to look for ("the funniest moments"). You can also use only part of the video. |
| **A video** | Progress while it works, then all its clips by viral score or in order. **Find more clips**, **Try again**, **Delete**. |
| **A clip → Post** | Ready-made caption and hashtags: edit them, **Copy caption**, **Save to phone**, **Share**, **Mark as posted**, ❤️ to like. |
| **A clip → Edit** | Trim the start and end (±1 s, ±5 s), change the hook title, caption style, position and colour, framing, shape, watermark, then **Save and update clip**. Or **Ask Claude to change it** in your own words. |
| **A clip → Caption text** | Fix misheard words or names in the captions. |
| **A clip → Score** | The viral score (hook, flow, value, trend), why Claude picked it, and the transcript. |
| **My clips** | Every clip from every video, best first. Filter: score 80+, liked, not posted, posted. |
| **More** | Ask King Tonka anything, your default options, activity log, sign out. |

**Caption styles:** *Bold* (big words, the spoken one lights up), *Pop* (one word at a time), *Karaoke* (words fill with colour as they're spoken), *Clean* (calm lines on a dark box), *None*.

**Framing:** *Follow speaker* finds the face and cuts to whoever is on screen. *Fit* shows the whole picture on a blurred background. *Left / Center / Right* keep a fixed crop.

## Good to know

- **Storage:** Supabase's free plan holds 1 GB. Each clip is about 5–40 MB, so delete old videos you've already posted. A video's clips are deleted with it.
- **Uploads** from the phone are limited to 50 MB. For bigger files, put them on Google Drive or Dropbox, set sharing to "anyone with the link", and paste the link.
- **Claude** usage counts against your Claude plan's limits. Only picking clips and making edits use Claude. Downloading, transcribing and rendering don't.
- **GitHub Actions** is free for this public repository.

## If YouTube blocks downloads

YouTube sometimes blocks downloads from GitHub's servers ("Sign in to confirm you're not a bot").
The video then shows that message. Either upload the file, or give King Tonka your YouTube cookies:

1. On a computer, install the browser extension **Get cookies.txt LOCALLY**, open youtube.com while signed in, and export the cookies for youtube.com.
   Use a spare Google account if you can.
2. On GitHub: **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.
   Name it `KT_YOUTUBE_COOKIES` and paste the whole file as the value.
3. Open the video in the app and tap **Try again**.

## If something goes wrong

- A video stuck on **Waiting**: the agent didn't wake up. Check **More → Activity** for a note, and check that Twizzy works (they share the GitHub token).
- Open **GitHub → Actions → King Tonka agent** and read the latest run.
- **Try again** on a failed video starts it from the beginning.
