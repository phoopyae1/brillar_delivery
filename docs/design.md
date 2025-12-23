# Office Delivery Tracking Demo – System Design

## 1) State Machine
### Statuses
- `DRAFT`
- `CREATED`
- `ASSIGNED`
- `PICKED_UP`
- `IN_TRANSIT`
- `OUT_FOR_DELIVERY`
- `DELIVERED`
- Alternate: `CANCELLED`, `FAILED_DELIVERY`, `RETURNED`

### Allowed Transitions
| From | To | Who can trigger | Notes |
| --- | --- | --- | --- |
| `DRAFT` | `CREATED` | Sender | Initial submission.
| `CREATED` | `ASSIGNED` | Dispatcher/Admin | Attach courier assignment.
| `ASSIGNED` | `PICKED_UP` | Courier | Courier acknowledges physical pickup.
| `PICKED_UP` | `IN_TRANSIT` | Courier | In transport between hubs.
| `IN_TRANSIT` | `OUT_FOR_DELIVERY` | Courier | Courier is on final leg to destination.
| `OUT_FOR_DELIVERY` | `DELIVERED` | Courier | Successful hand-off.
| Any pre-`PICKED_UP` (`DRAFT`/`CREATED`/`ASSIGNED`) | `CANCELLED` | Sender/Dispatcher/Admin | Cancels before custody changes.
| `OUT_FOR_DELIVERY` | `FAILED_DELIVERY` | Courier/Dispatcher/Admin | Delivery attempt failed (no answer, address issue).
| `FAILED_DELIVERY` | `RETURNED` | Courier/Dispatcher/Admin | Package returned to sender.
| `RETURNED` | `OUT_FOR_DELIVERY` | Dispatcher/Admin | Re-attempt after correction.

### Edge Cases & Rules
- Once `PICKED_UP`, sender can no longer cancel; dispatcher/admin may override only to failure/returned states.
- Direct jumps are disallowed; transitions must follow the table or be explicitly administrative overrides.
- Every transition logs a `DeliveryEvent` with actor, timestamp, location/note.
- `DELIVERED` is terminal unless an admin reopens (not supported in demo).

## 2) Postgres Schema (Prisma Models)
```prisma
model User {
  id       Int     @id @default(autoincrement())
  name     String
  email    String  @unique
  password String
  role     Role
  deliveries   Delivery[]       @relation("SenderDeliveries")
  courierAssignments Assignment[] @relation("CourierAssignments")
  events   DeliveryEvent[] @relation("EventCreator")
  createdAt DateTime @default(now())
}

enum Role {
  SENDER
  DISPATCHER
  COURIER
  ADMIN
}

model Delivery {
  id                Int       @id @default(autoincrement())
  trackingCode      String    @unique
  title             String
  description       String
  priority          String
  status            Status
  senderId          Int
  receiverName      String
  receiverPhone     String
  destinationAddress String
  assignment        Assignment?
  events            DeliveryEvent[]
  createdAt         DateTime  @default(now())
  sender            User      @relation("SenderDeliveries", fields: [senderId], references: [id])
}

model Assignment {
  id         Int      @id @default(autoincrement())
  deliveryId Int      @unique
  courierId  Int
  assignedAt DateTime @default(now())
  delivery   Delivery @relation(fields: [deliveryId], references: [id])
  courier    User     @relation("CourierAssignments", fields: [courierId], references: [id])
}

model DeliveryEvent {
  id         Int      @id @default(autoincrement())
  deliveryId Int
  type       String
  note       String?
  locationText String?
  createdBy  Int
  createdAt  DateTime @default(now())
  delivery   Delivery @relation(fields: [deliveryId], references: [id])
  creator    User     @relation("EventCreator", fields: [createdBy], references: [id])
}

enum Status {
  DRAFT
  CREATED
  ASSIGNED
  PICKED_UP
  IN_TRANSIT
  OUT_FOR_DELIVERY
  DELIVERED
  CANCELLED
  FAILED_DELIVERY
  RETURNED
}
```

## 3) REST API Specification
Base URL: `http://localhost:4000`.
Authentication: `Authorization: Bearer <jwt>` unless marked public.

### Auth
- `POST /auth/register`
  - Request: `{ "name": "Jane Sender", "email": "jane@example.com", "password": "...", "role": "SENDER" }`
  - Response: `{ "token": "...", "user": {"id":1,"name":"Jane Sender","role":"SENDER"} }`
- `POST /auth/login`
  - Request: `{ "email": "jane@example.com", "password": "..." }`
  - Response: same shape as register.

### Deliveries
- `POST /deliveries` (Sender) — create delivery request
  - Request: `{ "title":"IT hardware", "description":"Laptop", "priority":"HIGH", "receiverName":"Alex", "receiverPhone":"+1-555-0100", "destinationAddress":"5F West" }`
  - Response: delivery object with trackingCode/status `CREATED`.
- `GET /deliveries/:trackingCode/public` (Public) — tracking view
  - Response: `{ "trackingCode":"TRK-123", "status":"IN_TRANSIT", "events":[...] }`
- `GET /deliveries/:id` (Authorized) — detail with assignment/events.
- `GET /me/deliveries` (Sender/Dispatcher/Courier/Admin)
  - Sender: own deliveries
  - Courier: deliveries assigned to courier
  - Dispatcher/Admin: all deliveries
- `PATCH /deliveries/:id/assign` (Dispatcher/Admin)
  - Request: `{ "courierId": 5 }`
  - Response: updated delivery + assignment; status set to `ASSIGNED`.
- `PATCH /deliveries/:id/status` (Courier/Dispatcher/Admin; Sender only for cancel before pickup)
  - Request: `{ "status": "IN_TRANSIT" }`
  - Rules: validated against state machine and role permissions.
  - Response: updated delivery plus event entry.
- `POST /deliveries/:id/events` (Courier/Dispatcher/Admin)
  - Request: `{ "type":"NOTE", "note":"Arrived at loading dock", "locationText":"HQ Dock" }`
  - Response: created event.
- `GET /deliveries` (Dispatcher/Admin) — list with filters `status`, `courierId`, `priority`.
- `GET /stats` (Admin) — counts per status, totals, deliveries per role.

### Example Delivery Response Shape
```json
{
  "id": 12,
  "trackingCode": "TRK-2024-0001",
  "title": "Office supplies",
  "description": "Printer paper",
  "priority": "NORMAL",
  "status": "OUT_FOR_DELIVERY",
  "senderId": 2,
  "receiverName": "Jordan",
  "receiverPhone": "+1-555-0199",
  "destinationAddress": "HQ 7F",
  "assignment": { "courierId": 5, "assignedAt": "2024-06-01T10:30:00Z" },
  "events": [
    {"type":"CREATED","note":"Request submitted","createdBy":2,"createdAt":"2024-06-01T09:00:00Z"},
    {"type":"ASSIGNED","note":"Courier assigned","createdBy":3,"createdAt":"2024-06-01T10:00:00Z"},
    {"type":"PICKED_UP","note":"Picked at mailroom","createdBy":5,"createdAt":"2024-06-01T10:30:00Z"}
  ],
  "createdAt": "2024-06-01T09:00:00Z"
}
```

## 4) Security Rules & Access Control
- JWT required for all non-public endpoints; tokens signed with server secret.
- Role checks:
  - **Sender:** create delivery; view own deliveries; may cancel before pickup.
  - **Dispatcher:** list all deliveries; assign/reassign before `PICKED_UP`; update statuses (non-terminal) for operational recovery; add events.
  - **Courier:** view deliveries assigned to them; transition statuses along pickup → delivered chain; add events/notes.
  - **Admin:** full access to listings, assignments, status overrides (including failure/return), analytics.
- Public tracking endpoint exposes only delivery + event history; hides user emails/password hashes.
- State machine enforcement prevents illegal jumps and unauthorized cancellations.
- Input validation with Zod/express-validator; Prisma parameterization prevents SQL injection.

## 5) Test Scenarios
1. **Sender creates draft and submits:** ensure status `CREATED`, tracking code generated, event logged.
2. **Dispatcher assigns courier:** status becomes `ASSIGNED`; assignment row created; event logged.
3. **Courier pickup-to-delivery path:** transitions `PICKED_UP → IN_TRANSIT → OUT_FOR_DELIVERY → DELIVERED`, each with events.
4. **Sender cancellation before pickup:** cancel from `CREATED`; further status changes rejected.
5. **Failed delivery and return:** mark `FAILED_DELIVERY` from `OUT_FOR_DELIVERY`, then `RETURNED` by dispatcher/admin.
6. **Public tracking:** unauthenticated fetch shows timeline but not sensitive user data.
7. **Access control:** sender cannot update other deliveries; courier cannot assign; dispatcher cannot mark delivered on another courier's behalf unless override allowed.
8. **Analytics:** admin `/stats` returns counts by status and per role.

## 6) Seed Dataset (sample rows)
- Users (password `password123` for demo):
  - Senders: `sender@example.com`, `sender2@example.com`
  - Dispatchers: `dispatcher@example.com`
  - Couriers: `courier@example.com`, `courier2@example.com`
  - Admin: `admin@example.com`
- Deliveries (tracking codes `TRK-SEED-1..10`):
  - Mix of priorities (LOW/NORMAL/HIGH) and statuses covering each stage.
  - Example: `TRK-SEED-3` assigned to `courier@example.com`, currently `OUT_FOR_DELIVERY` with events: created, assigned, picked_up at "HQ Mailroom", in_transit to "North Campus", out_for_delivery near "Building B".
  - Example: `TRK-SEED-7` failed delivery at "Reception closed" then `RETURNED` to sender.
- Events: each delivery contains 2–5 events with `createdBy` matching role (sender for created, dispatcher for assigned, courier for transit updates).
