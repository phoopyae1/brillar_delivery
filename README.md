# Office Delivery Tracking Demo

Full-stack demo for office package delivery workflows with sender, dispatcher, courier, and admin roles.

## Tech Stack
- **Frontend:** Next.js (App Router), TypeScript, MUI, SWR polling
- **Backend:** Node.js, Express (CommonJS), JWT auth, Zod validation
- **Database:** PostgreSQL with Prisma ORM
- **Workspace:** npm workspaces with `backend` (API) and `frontend` (web)
- **Status flow:** CREATED → ASSIGNED_FOR_PICKUP → PICKED_UP → ARRIVED_AT_HUB → DEPARTED_HUB → OUT_FOR_DELIVERY → DELIVERED/DELIVERY_FAILED

## Getting Started
1. **Install dependencies** (workspace-aware):
   ```bash
   npm install
   ```

2. **Run Postgres via Docker Compose:**
   ```bash
   docker-compose up -d
   ```

3. **Environment variables:**
   - Copy examples to real files:
     ```bash
    cp backend/.env.example backend/.env
    cp frontend/.env.example frontend/.env
     ```

4. **Prisma setup (API):**
   ```bash
  cd backend
   npx prisma generate
   npx prisma migrate dev --name init
   node prisma/seed.js
   ```

5. **Start the API:**
   ```bash
  npm run dev --workspace backend
  # or from backend: npm run dev
   ```

6. **Start the web app:**
   ```bash
  npm run dev --workspace frontend
  # or from frontend: npm run dev
   ```

## Seed Data
- Users (password `password123`):
  - sender@example.com (SENDER)
  - sender2@example.com (SENDER)
  - dispatcher@example.com (DISPATCHER)
  - courier@example.com (COURIER)
  - courier2@example.com (COURIER)
  - admin@example.com (ADMIN)
- Deliveries: 10 sample records with auto-generated tracking codes and events following the status flow.

## API Highlights
Base URL defaults to `http://localhost:4000`.
- `POST /auth/register`, `POST /auth/login` — JWT auth with bcrypt
- `POST /deliveries` — sender/admin create (tracking code like `OFF-2025-XXXXXX`)
- `GET /deliveries/:trackingCode/public` — public tracking (safe fields + timeline)
- `GET /deliveries/:id`, `GET /me/deliveries` — role-aware access
- `PATCH /deliveries/:id/assign` — dispatcher/admin
- `PATCH /deliveries/:id/status` — state machine enforced per role
- `POST /deliveries/:id/events` — add checkpoint notes/locations
- `GET /deliveries` & `GET /stats` — admin/dispatcher dashboards

### Example cURL calls
```bash
# Login
curl -X POST http://localhost:4000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"sender@example.com","password":"password123"}'

# Create delivery
curl -X POST http://localhost:4000/deliveries \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"title":"Docs","description":"Binder","priority":"HIGH","receiverName":"Alex","receiverPhone":"555-0100","pickupAddress":"10 Front St","deliveryAddress":"500 Market St"}'

# Dispatcher assign
curl -X PATCH http://localhost:4000/deliveries/1/assign \
  -H "Authorization: Bearer $DISPATCHER_TOKEN" -H 'Content-Type: application/json' \
  -d '{"courierId":3}'

# Courier status update
curl -X PATCH http://localhost:4000/deliveries/1/status \
  -H "Authorization: Bearer $COURIER_TOKEN" -H 'Content-Type: application/json' \
  -d '{"status":"OUT_FOR_DELIVERY","note":"Left hub","locationText":"HQ"}'

# Public tracking
curl http://localhost:4000/deliveries/OFF-2025-XXXXXX/public
```

## Frontend Pages
- `/` landing
- `/login`, `/register`
- `/dashboard/sender` create + list my deliveries
- `/dashboard/dispatcher` unassigned deliveries + assign courier
- `/dashboard/courier` my assignments + update status/add checkpoint
- `/admin` all deliveries/users (DataGrid) + counts
- `/track/[trackingCode]` public tracker with MUI Stepper and 5s polling

### Auth token storage
For the demo, JWT tokens and user profiles are stored in `localStorage` and reused by client-side fetchers. Log out clears the storage. In production, prefer HTTP-only cookies or secure storage to mitigate XSS.

## Detailed Design
See `docs/design.md` for the state machine, Prisma schema, REST API specification, security rules, and demo test/seed scenarios.
