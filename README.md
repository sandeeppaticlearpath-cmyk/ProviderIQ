# ProviderIQ v2.0 — Enterprise Healthcare ATS

The most advanced open-source ATS for healthcare staffing. Built to replace Bullhorn, Ceipal, and Nexus.

## Features

| Module | Description |
|--------|-------------|
| 📊 Dashboard | Live KPIs, pipeline donut, monthly trends, recruiter performance |
| 📈 Analytics | Stage breakdown, specialty trends, source mix, area charts |
| 🗂 Pipeline | Drag-and-drop Kanban + Table view, 8 stages |
| 👥 Candidates | Full-text search, bulk actions, CSV export, 25 filter combos |
| 👤 Candidate Profile | 6 sub-tabs: Overview · Conversations · Submissions · Credentials · Timeline · AI Copilot |
| 💬 Conversations | Multi-platform thread (Email, SMS, LinkedIn, Doximity, Zoom, WhatsApp, Phone) per candidate |
| 🛡 Credentials | License tracking with expiry alerts (DEA, board certs, state licenses) |
| 💼 Jobs | Full CRUD, comp ranges, slot tracking, submission management |
| 📨 Outreach | Compose + AI draft, reply suggestions, platform quick links |
| 📄 CV Upload | PDF/DOCX/TXT parsing → AI extracts all fields → save to profile |
| ⚡ JD Sourcing | Paste JD → AI generates N candidates + email + SMS drafts |
| 🔍 Provider Search | Live NPI Registry (6M+ providers), Boolean search generator, open source links |
| 📋 Book of Business | Per-recruiter pipeline, stage breakdown, conversion rates |
| 👔 Manager View | Team performance cards, all-candidate table, recruiter CRUD |
| 🏆 Placements | Fee tracking, bill/pay rate management |
| 🔌 Integrations | Job boards, VMS, email, SMS, calendar — plug-in architecture |
| ⚙ Settings | Profile, password, AI key, team user management |

## Tech Stack

- **Backend**: Node.js + Express + PostgreSQL (no Redis required)
- **Frontend**: React 18 + Vite + Tailwind CSS + Recharts
- **Auth**: JWT (bcrypt passwords)
- **AI**: Anthropic Claude (optional — all features have fallbacks)
- **Deployment**: Render (zero-config via `render.yaml`)

---

## 🚀 Deploy to Render in 5 Minutes

### Step 1 — Push to GitHub
```bash
# Initialize git in the project folder
cd provideriq
git init
git add .
git commit -m "Initial commit — ProviderIQ v2.0"

# Create a GitHub repo and push
git remote add origin https://github.com/YOUR_USERNAME/provideriq.git
git push -u origin main
```

### Step 2 — Connect to Render
1. Go to [render.com](https://render.com) → New → **Blueprint**
2. Connect your GitHub account
3. Select the `provideriq` repository
4. Render reads `render.yaml` automatically and creates:
   - `provideriq-api` — Node.js backend service
   - `provideriq-frontend` — Static frontend
   - `provideriq-db` — PostgreSQL database (free tier)

### Step 3 — Set Environment Variables
In Render dashboard → `provideriq-api` → Environment:

| Variable | Value |
|----------|-------|
| `JWT_SECRET` | Any long random string (min 32 chars) |
| `NODE_ENV` | `production` |
| `FRONTEND_URL` | Your frontend URL (e.g. `https://provideriq-frontend.onrender.com`) |
| `ANTHROPIC_API_KEY` | *(Optional)* Your Anthropic key for server-side AI |

> `DATABASE_URL` is auto-injected by Render from the linked database.

### Step 4 — Deploy
Click **Deploy** — Render builds both services automatically.

First deploy takes ~3-5 minutes. The backend auto-creates all database tables and seeds 100 demo candidates, 10 jobs, and 4 recruiters on first startup.

---

## 🖥 Local Development

### Prerequisites
- Node.js 18+
- PostgreSQL 14+ (local or use [Supabase](https://supabase.com) free tier)

### Setup
```bash
# Install all dependencies
cd backend && npm install
cd ../frontend && npm install

# Configure backend
cd backend
cp .env.example .env
# Edit .env — set DATABASE_URL to your local PostgreSQL

# Start backend (port 4000)
npm run dev

# In a new terminal, start frontend (port 5173)
cd frontend
npm run dev
```

Open http://localhost:5173

### Default Credentials
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@healthstaff.com | Admin@2024 |
| Recruiter | sarah@healthstaff.com | Recruiter@2024 |
| Manager | manager@healthstaff.com | Recruiter@2024 |

---

## Project Structure

```
provideriq/
├── render.yaml              ← Render deployment config
├── backend/
│   ├── package.json
│   ├── .env.example
│   └── src/
│       ├── server.js        ← Express app entry point
│       ├── db/
│       │   └── connection.js  ← PostgreSQL + auto-migration + seed
│       ├── middleware/
│       │   └── auth.js      ← JWT authentication
│       ├── utils/
│       │   └── logger.js    ← Winston logger
│       └── routes/          ← All API routes
│           ├── _all_routes.js  ← All route implementations
│           ├── auth.js
│           ├── candidates.js
│           ├── npi.js       ← NPPES proxy (no API key needed)
│           ├── ai.js        ← Anthropic proxy + parse/draft/source
│           ├── dashboard.js
│           ├── pipeline.js
│           ├── jobs.js
│           ├── conversations.js
│           ├── credentials.js
│           ├── upload.js    ← PDF/DOCX/TXT parsing
│           ├── outreach.js
│           ├── bob.js
│           ├── manager.js
│           ├── analytics.js
│           ├── recruiters.js
│           ├── search.js
│           ├── integrations.js
│           ├── jobboards.js ← Links to Healthgrades, Doximity, LinkedIn, etc.
│           ├── placements.js
│           ├── interviews.js
│           └── submissions.js
└── frontend/
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    └── src/
        ├── App.jsx          ← React Router setup
        ├── main.jsx
        ├── store/index.js   ← Zustand state
        ├── utils/
        │   ├── api.js       ← Axios client
        │   └── helpers.js   ← Formatters + constants
        ├── styles/globals.css
        ├── components/
        │   ├── layout/Layout.jsx    ← Sidebar nav + topbar
        │   ├── shared/StageBadge.jsx
        │   └── candidates/CandidateModal.jsx
        └── pages/
            ├── LoginPage.jsx
            ├── DashboardPage.jsx
            ├── CandidatesPage.jsx
            ├── CandidateDetailPage.jsx  ← 6 sub-tabs including Conversations
            ├── JobsPage.jsx
            ├── JobDetailPage.jsx
            ├── PipelinePage.jsx
            ├── OutreachPage.jsx     ← also exports UploadPage, SourcePage, ProvidersPage
            ├── AnalyticsPage.jsx    ← also exports BOBPage, ManagerPage, PlacementsPage,
            │                          IntegrationsPage, SettingsPage
            └── [re-export stubs]
```

## API Reference

```
POST   /api/auth/login
GET    /api/auth/me
GET    /api/auth/users
POST   /api/auth/users
PATCH  /api/auth/profile
POST   /api/auth/change-password

GET    /api/candidates            ?q,specialty,stage,state,recruiter_id,source,priority,page,limit
GET    /api/candidates/stats
GET    /api/candidates/:id
POST   /api/candidates
PATCH  /api/candidates/:id
DELETE /api/candidates/:id        (archive)
POST   /api/candidates/bulk       action: stage_change|assign|tag|archive
POST   /api/candidates/:id/notes
GET    /api/candidates/:id/timeline
GET    /api/candidates/:id/conversations
POST   /api/candidates/:id/conversations
GET    /api/candidates/:id/conversations/:convId/messages
POST   /api/candidates/:id/conversations/:convId/messages
GET    /api/candidates/:id/credentials
POST   /api/candidates/:id/credentials
PATCH  /api/candidates/:id/credentials/:credId
GET    /api/credentials/expiring  ?days=30

GET    /api/jobs                  ?status,specialty,q,page,limit
GET    /api/jobs/:id
POST   /api/jobs
PATCH  /api/jobs/:id
DELETE /api/jobs/:id
GET    /api/jobs/:id/submissions
POST   /api/jobs/:jobId/submit

GET    /api/pipeline/board        ?specialty,recruiter_id
POST   /api/pipeline/move         {candidate_id, stage}

GET    /api/outreach/templates
POST   /api/outreach/templates
POST   /api/outreach/send
GET    /api/outreach/history/:candidateId

GET    /api/dashboard/metrics
GET    /api/dashboard/analytics   ?period=30|90|180|365

GET    /api/recruiters
POST   /api/recruiters
PATCH  /api/recruiters/:id
DELETE /api/recruiters/:id

GET    /api/bob                   ?recruiter_id
GET    /api/manager

GET    /api/analytics/overview

GET    /api/search/specialties
GET    /api/search/global         ?q

GET    /api/placements
POST   /api/placements

GET    /api/interviews            ?candidate_id,job_id
POST   /api/interviews
PATCH  /api/interviews/:id

GET    /api/integrations
PUT    /api/integrations/:type

GET    /api/jobboards/links       ?title,specialty,location,state
GET    /api/jobboards/status

POST   /api/upload/resume         (multipart, returns extracted text)

POST   /api/ai/parse-resume       {text, api_key, filename}
POST   /api/ai/chat               {messages, api_key}
POST   /api/ai/draft-outreach     {candidate, job?, channel, tone, api_key}
POST   /api/ai/summarize          {candidate, api_key}
POST   /api/ai/boolean-search     {specialty, location, additional, api_key}
POST   /api/ai/jd-source          {jd, count, tone, city, state, api_key}

GET    /api/npi/search            ?first_name,last_name,taxonomy,state,city,organization,number,limit
GET    /api/npi/verify/:npi

GET    /health
```

---

## Adding Integrations Later

The `integrations` table stores configs per tenant. To add a real integration:

1. Store credentials via `PUT /api/integrations/:type`
2. Add a service file in `backend/src/services/`
3. Call it from the relevant route (e.g. send real SMS via Twilio when `/outreach/send` is called with `channel: 'sms'`)

Planned integrations: Twilio, SendGrid, LinkedIn Recruiter API, Bullhorn API, Beeline VMS, Google Calendar, Zoom.

---

## License
MIT — free to use, modify, and deploy.
