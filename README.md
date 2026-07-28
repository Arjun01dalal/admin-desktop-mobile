# Astro Admin Panel

Electron desktop app (React + Vite + MUI) that opens as a calculator.
Entering **`9100` + `=`** opens the secure admin **Login** screen.
After a successful OTP login, the **Welcome** screen opens fullscreen.

## Run

```bash
npm install

# Hot reload (Vite + Electron) — use this while coding
npm run dev

# Build then open Electron from dist/
npm start
```

## Secrets (important)

API URL and encryption key live **only** in the Electron main process via `.env`:

```bash
cp .env.example .env
# edit API_BASE_URL and ENTK_VALUE
```

- `.env` is gitignored — never commit it.
- The renderer never sees these values; auth calls go through IPC (`auth:send-otp`, `auth:verify-otp`, `auth:get-address`).

## App flow

1. Calculator (cover)
2. Type `9100` → `=` → Login (mobile OTP + location)
3. Successful verify → Welcome (fullscreen)

## Build installers

```bash
npm run dist:mac
npm run dist:win
```

Output goes to `release/`.
