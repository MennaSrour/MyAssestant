# Hayati OS

Hayati OS is a mobile-first personal workspace for habits, Quran study, coursework, teaching, development projects, and quick capture. The app supports English and Arabic with mirrored navigation and Cairo typography.

## Run in browser-only mode

Install Node.js **22.12 or later** (Node 24 LTS recommended), then run:

```sh
npm ci
npm run dev
```

Open http://localhost:3000. With no database variables, the app uses browser storage. Use **Settings → JSON or CSV** to move browser-only data into a connected account.

## Connect Supabase and deploy to Vercel

1. Create a Supabase project. In **SQL Editor**, execute [schema.sql](schema.sql). This creates the workspace table with per-user Row Level Security.
2. In **Authentication → Users**, create an email/password user (confirm the email if prompted). Disable public signups for a private instance. Each user starts with an independent workspace.
3. Copy the project URL and publishable key from the Supabase **Connect** dialog to `.env.local`. Use the publishable or legacy anon key in the browser-facing setting.

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
   ```

4. Push this repo to your Git provider. On Vercel, select **Add New → Project**, import it, select the **Next.js** preset, and add those same two environment variables. Deploy using the default npm install/build commands. Supabase and Vercel offer free plans subject to their current usage limits and terms.
5. Sign in from your phone and laptop using the same account and deployed URL. Changes are saved immediately and fetched on window focus and periodically while the app is visible. Use **Add to Home Screen** or **Install app** in your browser if offered.

## Local PostgreSQL and Prisma

Provide a PostgreSQL database on your machine or in Docker. For example:

```sh
docker run --name hayati-postgres -e POSTGRES_PASSWORD=dev-only-password \
  -e POSTGRES_DB=hayati -p 127.0.0.1:5432:5432 -d postgres:17
```

Copy [.env.example](.env.example) to `.env`. Leave both Supabase settings empty and fill in:

```dotenv
DATABASE_URL=postgresql://postgres:dev-only-password@127.0.0.1:5432/hayati
LOCAL_ACCESS_PASSWORD=choose-a-unique-password
LOCAL_SESSION_SECRET=replace-with-a-random-secret-at-least-32-characters-long
```

Generate a secret with `openssl rand -hex 32`. Then run `npm ci`, `npm run seed`, and `npm run dev`. The seed creates the local table if needed and inserts the initial workspace only if it does not already exist. The Prisma adapter uses a single password-protected workspace. Use Supabase for multi-user accounts or for access over the public internet.

## Use the workspace

- **Habits & Quran.** Create daily or weekly checkboxes, counters, and Surah/Ayah range trackers. The range tracker accepts any surah and optional juz, including Al-Baqarah and Juz Amma. Add Mutashabihat notes to entries and edit historical logs from the activity list.
- **Academic Hub and TA Workspace.** Add courses with exam dates, study modules, notes, and links. Select a course in the Pomodoro timer to log completed study time to it. Create a teaching section, then add students individually or import a CSV with a `name` column. Record attendance per session and grades per student.
- **Dev Projects.** Customize columns by editing the project. Move items using each task’s column picker and mark them complete to earn XP. Use milestones for dates and the project’s Markdown notes for technical material.
- **Quick Inbox and Rewards.** Capture notes, tasks, and links with the plus button. Dictation requires a browser that supports the Web Speech API and microphone permission. Triage items into your workspace, then define and redeem rewards using earned XP. Analytics shows the latest seven days and compares manually logged distraction minutes with focus time.
- **Settings & Customization Studio.** Add, reorder, archive, and delete workspace items, create custom categories, and choose which derived metrics appear on the dashboard. Exports include workspace data such as records, attendance, archives, logs, and XP history. CSV preserves nested data in a `record_json` column. Import replaces the active workspace after confirmation.

## Architecture and checks

`app/` contains the App Router entry points and authenticated server actions. `components/` contains the responsive interface and Shadcn-compatible UI primitives. `lib/` contains the workspace model, seed data, backup formats, and storage boundary. `prisma/` contains the PostgreSQL model and bootstrap SQL. The Supabase adapter uses the signed-in user’s token and RLS. Both databases use a version check for whole-workspace writes, so a stale client refreshes and asks you to retry instead of overwriting a newer save.

The production service worker installs the app shell assets and displays a reconnect screen offline. Private server-rendered pages and writes require connectivity. Draft timer state and language preference live on the current device. The JSON workspace model targets a personal workspace of modest size. Use `npm run check`, `npm run build`, and `npm run start` to validate the production build.
