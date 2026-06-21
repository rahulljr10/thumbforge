# MakeViralThumb

MakeViralThumb is a context-aware YouTube thumbnail studio. Members submit a video
link or script and receive original, human-reviewed thumbnail concepts built
around the real hook, correct cast, and reason to click.

## Membership Plans

- Starter: `$29/month` for 6 delivery credits
- Pro: `$69/month` for 24 delivery credits
- Launch list prices: Starter `$39`, Pro `$99`
- One free concept for every new account, no card required
- Additional credits: `$3 each`
- Custom: recommended within 24 hours based on volume and workflow

One credit equals one finished thumbnail concept. One revision is included per video brief.

## Product Architecture

- Static frontend on GitHub Pages
- Supabase Auth for verified customer accounts
- Supabase Postgres with row-level security
- Private storage buckets for source files, customer images and delivered concepts
- Customer workspace for briefs, review, revisions and downloads
- Private production console at `admin.html`
- One introductory credit on new accounts

Payments are the next launch gate. Until checkout is connected, memberships and
credit balances can be activated from the production console.

## Local Preview

Open `index.html` directly or serve the folder with:

```powershell
python -m http.server 4173
```

Then visit `http://127.0.0.1:4173`.

## Backend Setup

1. Create a Supabase project.
2. Run `supabase/migrations/001_production_schema.sql` in the SQL editor.
3. Copy `config.example.js` to `config.js` and enter the project URL and public
   anonymous key. The anonymous key is designed to be public; never place the
   service-role key in browser code.
4. In Supabase Auth URL Configuration, add:
   - `https://makeviralthumb.com/`
   - `https://makeviralthumb.com/dashboard.html`
   - the local preview URL while testing
5. Create the owner account through the website, then promote it in the SQL
   editor:

```sql
update public.profiles
set role = 'admin'
where id = (
  select id from auth.users where email = 'YOUR_EMAIL'
);
```

6. Open `admin.html` with that account to manage production and customer
   credits.

## Deployment

Commit and push the production files to the repository default branch. GitHub
Pages publishes the static frontend. Supabase remains the authenticated backend.

Do not run paid traffic until the payment provider, webhook-based credit grants,
transactional email, operator identity, tax settings and support inbox are
configured.

## Process Videos

- Desktop/web: `assets/video/thumbforge-process-wide.mp4` at 1280x720
- Mobile: `assets/video/thumbforge-process-mobile.mp4` at 720x1280

Both are silent, looping H.264 MP4 files optimized for inline web playback.
Their editable FFmpeg filter scripts are stored in `video-src`.
