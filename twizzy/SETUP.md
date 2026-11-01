# Setting up Twizzy (about 20 minutes, once)

Twizzy has three parts:

- **The Twizzy app** on your phone: ideas, approvals, downloads, and a box to tell Twizzy what to do.
- **Supabase**: the free online database the app and the agent share.
- **The agent**: Claude Code running on GitHub's servers, using your Claude plan. Each time you tap something in the app, Supabase starts it, and it makes the video and puts it in the app. It also runs every morning, and on Mondays it brings new ideas.

Never paste a secret key or password into a chat. Secrets only go into Supabase and GitHub settings.

---

## 1. Create the Supabase project

1. Go to **supabase.com** → **Start your project**. Sign up with GitHub or your email. It's free.
2. Click **New project**:
   - **Name:** `twizzy`.
   - **Database password:** tap **Generate** and keep it somewhere safe.
   - **Region:** pick the closest, for example *Central EU (Frankfurt)*.
   - Click **Create**, then wait about 2 minutes.
3. In the left menu, open **SQL Editor** → **New query**.
4. Open [`twizzy/supabase/schema.sql`](supabase/schema.sql) on GitHub, tap **Copy raw file**, paste it in, then click **Run**. You should see "Success".

### Updates

When Twizzy gets new features, run the matching file from [`twizzy/supabase/`](supabase/) in the SQL Editor once:
- `2026-11-songs.sql`: Twizzy asks which song to use for each video.

## 2. Copy the project's keys

In Supabase, open **Project Settings** (the gear icon) → **API Keys**. Keep this page open:

- **Project URL**: looks like `https://abcdxyz.supabase.co`. It's under **Project Settings → Data API**, or on the project's home page.
- **anon / public key**: a long text starting `eyJ…`. On the newer screen it's the **publishable** key, `sb_publishable_…`.
- **service_role key**: on the newer screen it's the **secret** key, `sb_secret_…`. Tap **Reveal**. **This one is secret.**

## 3. Get your Claude token (on your PC)

This lets the agent use your Claude Pro or Max plan.

1. Open PowerShell and run:
   ```
   npm install -g @anthropic-ai/claude-code
   claude setup-token
   ```
2. A browser opens. Sign in with your Claude account and allow access.
3. PowerShell prints a long token starting `sk-ant-oat…`. Copy it.

## 4. Add the secrets to GitHub

On GitHub, open **Nlerealest/Nelson** → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**. Add these four, one at a time:

| Name | Value |
| --- | --- |
| `SUPABASE_URL` | the Project URL |
| `SUPABASE_ANON_KEY` | the anon / publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | the service_role / secret key |
| `CLAUDE_CODE_OAUTH_TOKEN` | the token from step 3 |

Your `ANDROID_KEYSTORE_…` secrets are already there. The Twizzy app is signed with the same key as Ndalama.

## 5. Let Supabase wake the agent

Supabase needs a small GitHub token that can only start the agent.

1. On GitHub, go to **Settings** (your profile) → **Developer settings** → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**.
2. Fill it in:
   - **Name:** `twizzy-wake`.
   - **Expiration:** 1 year.
   - **Repository access:** *Only select repositories* → `Nlerealest/Nelson`.
   - **Permissions → Repository permissions → Contents:** *Read and write*. This is what lets it start the agent.
3. Click **Generate token** and copy it (`github_pat_…`).
4. In Supabase, open **SQL Editor** → **New query**. Paste this line, put your token between the quotes, then click **Run**:
   ```sql
   select vault.create_secret('github_pat_PASTE_YOURS_HERE', 'github_token');
   ```
5. Delete the query text afterwards. The token now lives encrypted in Supabase Vault.

## 6. Move your ideas and videos in

1. In **SQL Editor**, open a new query.
2. Paste [`twizzy/supabase/seed.sql`](supabase/seed.sql), then click **Run**.
3. This adds the ideas and the five videos. It also asks the agent to render the videos again.
4. On GitHub, open **Actions** → **Twizzy agent**. A run should start within a minute and take about 15–25 minutes.

## 7. Create your login

1. In Supabase, open **Authentication** → **Users** → **Add user** → **Create new user**.
2. Fill it in:
   - **Email:** `nelsonningz@gmail.com`. Only this email is allowed by the database.
   - **Password:** choose a new one.
   - Tick **Auto confirm user**.
3. Go to **Authentication** → **Sign In / Providers**. Turn **off** "Allow new users to sign up".

## 8. Install the app

1. On GitHub, open **Actions** → **Twizzy APK** → **Run workflow**. It also builds by itself when the app changes.
2. When it's green (about 15 minutes), open this link on your phone and install:
   **https://github.com/Nlerealest/Nelson/releases/download/twizzy-latest/twizzy.apk**
3. Open Twizzy and sign in with the email and password from step 7.

If the app asks for a "Project URL" and "anon key", the build didn't have the secrets. Type them in once, or add the secrets and build again.

## 9. Try it

In **Home → Tell Twizzy**, type `Say hello and tell me what's waiting` and tap **Send**. Within about a minute:

- the green card at the top switches to **Working**;
- the command turns **Done**, with Twizzy's answer under it.

---

### How it runs

| You do | What happens |
| --- | --- |
| **Make it** on an idea, **Ask for changes**, a new reference, **Send** | A `commands` row starts the GitHub Action within about a minute. The video appears in **Approvals** in about 10–25 minutes. |
| Nothing | Every day at 07:52 Twizzy checks for anything missed. Every Monday at 07:23 it adds 4–5 new ideas. |
| **Approve** | The video moves to **Post**. Tap **Save to phone** or **Share** (pick TikTok), then **Copy caption**, post it, and tap **Mark as posted**. |

**Cost:**
- GitHub Actions is free for this public repository.
- Supabase's free plan is enough. Free projects pause after a week with no use, so open the app at least once a week, or click **Restore** in Supabase if it pauses.
- Claude usage counts against your Claude plan's limits.

**If something goes wrong:**
- Open **GitHub → Actions → Twizzy agent** and read the latest run.
- If commands stay "Waiting", the GitHub token in step 5 is missing or expired.
- In the app, **More → Activity** shows a note when Supabase couldn't wake the agent.
