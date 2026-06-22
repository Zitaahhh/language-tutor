# AI Spanish Coach

Production-ready Next.js app for Spanish learners with email/password authentication, Supabase Postgres, daily study plans, tasks, mistake book, and Telegram archival.

## Stack

- Next.js 15+ App Router / TypeScript
- Tailwind CSS v4
- Shadcn UI
- Supabase Authentication + Postgres + RLS
- Vercel deployment

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Fill `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_group_chat_id
TELEGRAM_THREAD_ID=optional_for_forum_topic
ADMIN_SETUP_SECRET=optional_secret_for_setup_endpoint
```

## Supabase setup

1. Create a Supabase project.
2. Authentication → Providers → make sure Email is enabled. Google OAuth is not required.
3. If email confirmation is enabled, add redirect URLs:
   - `http://localhost:3000/auth/callback`
   - `https://your-domain.com/auth/callback`
4. SQL Editor → run `supabase/schema.sql`.

The code also includes `POST /api/admin/setup-schema`, but Supabase does not expose arbitrary SQL execution by default. For production, run `supabase/schema.sql` during deployment or create a guarded SQL RPC only for setup.

## Vercel deployment

1. Push this repo to GitHub.
2. Import the project in Vercel.
3. Add the same environment variables in Vercel Project Settings.
4. Deploy.
5. Add your Vercel domain to Supabase Auth redirect URLs.

## Main routes

| Route | Purpose |
|---|---|
| `/` | Landing page |
| `/login` | Email/password login and registration |
| `/onboarding` | Level, goal, target days |
| `/dashboard` | Streak, progress, tasks, Telegram archive |
| `/mistakes` | Mistake book |

## API routes

| Route | Purpose |
|---|---|
| `POST /api/study-plan` | Generate plan, create daily tasks, archive to Telegram |
| `POST /api/tasks/complete` | Complete/uncomplete task and archive completed task |
| `POST /api/mistakes` | Save mistake and archive to Telegram |
| `POST /api/admin/setup-schema` | Optional guarded schema setup helper |

## Notes

- Study plan generation is deterministic and local by default to control cost and reliability. You can replace `src/lib/study-plan.ts` with an LLM call later.
- Telegram archival is skipped safely when bot env vars are missing.
- RLS policies restrict data to each authenticated user.
