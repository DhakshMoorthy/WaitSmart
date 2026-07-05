# WaitSmart Mobile (Expo)

Single Expo app with **role-based navigation** for Patient and Doctor flows.

Architecture alignment:
- **Patient** — Book, Track, Notify, Ticket screen (Socket.io)
- **Doctor** — Queue controls, Schedule

## Planned structure

```
mobile/
  app/
    (auth)/          login, register
    (patient)/       clinics → doctors → avail → book → ticket
    (doctor)/        queue, schedule
  lib/
    api.ts           REST client (GET /clinics, /doctors, /avail, POST /book)
    socket.ts        queue:subscribe, queue:update
```

## Dev

```bash
pnpm dev:mobile
```

API base URL: `http://localhost:4000` (configure in `lib/config.ts` when implemented).
