# Setting up Gramaro Travel (about 15 minutes, once)

Gramaro Travel has two parts:

- **The app** (Android, and web for testing). Customers and staff use the same app: it shows staff tools to the emails you list as staff.
- **Supabase**: the free online database that keeps everyone's phones in sync in real time.

Never paste a secret key or password into a chat. Secrets only go into Supabase and GitHub settings.

---

## 1. Create the Supabase project

1. Go to **supabase.com**, sign in (the same account as Twizzy is fine) and click **New project**.
   - **Name:** `gramaro`
   - **Database password:** tap **Generate** and keep it somewhere safe.
   - **Region:** the closest, e.g. *Central EU (Frankfurt)* or *South Africa* if offered.
2. Open **SQL Editor** → **New query**.
3. Open [`gramaro/supabase/schema.sql`](supabase/schema.sql) on GitHub, tap **Copy raw file**, paste it in and click **Run**. You should see "Success".

## 2. Add the staff

Still in **SQL Editor**, run this once with each staff member's email (they sign up in the app with this same email):

```sql
insert into staff (email, name) values ('agent@example.com', 'Agent name') on conflict do nothing;
```

Anyone else who signs up is a customer.

## 3. Sign-up settings

In **Authentication** → **Sign In / Providers** → **Email**:

- Keep **Allow new users to sign up** **on** (customers create their own accounts).
- **Confirm email**: on is safer, since customers must click a link in their email first. Turn it off if you want people to start straight away.

## 4. Copy the keys into GitHub

In Supabase: **Project Settings** → **API Keys** (and **Data API** for the URL). Copy:

- **Project URL**, e.g. `https://abcdxyz.supabase.co`
- **anon / publishable key** (this one is safe to put in the app)

On GitHub: **Nlerealest/Nelson** → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**:

| Name | Value |
| --- | --- |
| `GRAMARO_SUPABASE_URL` | the Project URL |
| `GRAMARO_SUPABASE_ANON_KEY` | the anon / publishable key |

Your `ANDROID_KEYSTORE_…` secrets are already there, so the app is signed with the same key as Ndalama.

## 5. Install the app

1. On GitHub, open **Actions** → **Gramaro APK**. It builds by itself whenever `gramaro/` changes, or click **Run workflow**.
2. When it's green (about 15 minutes), open this on an Android phone and install:
   **https://github.com/Nlerealest/Nelson/releases/download/gramaro-latest/gramaro.apk**
3. If the app asks for a "Project URL" and "anon key", the build didn't have the secrets. Type them in once, or add the secrets and build again.

## 6. First things to set (as staff)

Sign in with a staff email, then open **Settings**:

- **Dollar rate**: today's selling rate. Customers see it on their home screen.
- **Where customers pay**: the real Airtel Money and Mpamba numbers and names, and the bank account details.
- **Phone numbers** shown to customers.

Then publish a first offer in **Deals**.

## 7. Try the full flow (two phones, or phone + web)

1. On phone A, **create a customer account** and send a request from **Book**.
2. On phone B (staff), it appears at once under **Requests** with a banner. Tap it → **Take it** → **Add a fare option**, set a hold of e.g. 24 hours → **Send to customer**.
3. Phone A shows the fare within a second with a countdown. Tap **Choose this fare**, then **I have paid** with a test transaction ID.
4. Phone B: **Payments** → **Money received**. Then on the trip, type a PNR → **Mark as ticketed**.
5. Phone A shows "Your ticket is issued" and the booking reference.

To test on a computer: `cd gramaro && npm install && EXPO_PUBLIC_SUPABASE_URL=… EXPO_PUBLIC_SUPABASE_ANON_KEY=… npx expo start --web`.

---

**Cost:** Supabase free plan (pauses after a week with no use; any app activity keeps it awake, or click **Restore**). GitHub Actions is free for this public repository.

**If something goes wrong:**
- "Live" stays on "Connecting…": check the phone's internet. Lists still load, and they refresh when you pull down.
- A staff member sees the customer screens: their email isn't in the `staff` table exactly (step 2). Sign out and in again after adding it.
- "Not your request" / "This fare has expired": these are the safety rules working as intended.
