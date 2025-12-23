# Office Delivery Tracking Demo

Full-stack demo for office package delivery workflows with sender, dispatcher, courier, and admin roles.

## Tech Stack
- **Frontend:** Next.js (App Router), TypeScript, MUI
- **Backend:** Node.js, Express (CommonJS), JWT auth, Zod validation
- **Database:** PostgreSQL with Prisma ORM
- **Workspace:** npm workspaces with `apps/api` and `apps/web`

## Getting Started
1. **Install dependencies** (workspace-aware):
   ```bash
   npm install
   ```
   > If your environment blocks registry access, install manually per app using the dependencies in each `package.json`.

2. **Run Postgres via Docker Compose:**
   ```bash
   docker-compose up -d
   ```

3. **Environment variables:**
   - Copy examples to real files:
     ```bash
     cp apps/api/.env.example apps/api/.env
     cp apps/web/.env.example apps/web/.env
     ```

4. **Prisma setup (API):**
   ```bash
   cd apps/api
   npx prisma generate
   npx prisma migrate dev --name init
   node prisma/seed.js
   ```

5. **Start the API:**
   ```bash
   npm run dev --workspace api
   # or from apps/api: npm run dev
   ```

6. **Start the web app:**
   ```bash
   npm run dev --workspace web
   # or from apps/web: npm run dev
   ```

## Seed Data
- Users (password `password123`):
  - sender@example.com (SENDER)
  - sender2@example.com (SENDER)
  - dispatcher@example.com (DISPATCHER)
  - courier@example.com (COURIER)
  - courier2@example.com (COURIER)
  - admin@example.com (ADMIN)
- Deliveries: 10 sample records with tracking codes `TRK-SEED-1..10` and historical events.

## API Overview
Base URL defaults to `http://localhost:4000`.
- `POST /auth/register`, `POST /auth/login` — JWT auth
- `POST /deliveries` — sender/create
- `GET /deliveries/:trackingCode/public` — public tracking
- `GET /deliveries/:id`, `GET /me/deliveries`
- `PATCH /deliveries/:id/assign` — dispatcher/admin
- `PATCH /deliveries/:id/status` — courier/dispatcher/admin/sender (state machine enforced)
- `POST /deliveries/:id/events` — add checkpoint note
- `GET /deliveries` & `GET /stats` — admin/dispatcher dashboards

State machine: `DRAFT -> CREATED -> ASSIGNED -> PICKED_UP -> IN_TRANSIT -> OUT_FOR_DELIVERY -> DELIVERED` with alternate `CANCELLED`, `FAILED_DELIVERY`, `RETURNED`. Sender cancel allowed before pickup.

## Frontend Pages
- `/` landing
- `/login`, `/register`
- `/dashboard` role-aware controls (sender create, dispatcher assign, courier status updates, admin analytics)
- `/track/[trackingCode]` public tracker with stepper timeline
- `/track/quick` quick lookup form

## Real-time Updates
Polling every 5 seconds on dashboards and public tracking pages keeps statuses fresh.

## Detailed Design
See `docs/design.md` for the state machine, Prisma schema, REST API specification, security rules, and demo test/seed scenarios.
