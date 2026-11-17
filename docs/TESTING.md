# Testing on a real computer

A checklist for the first end-to-end run after merging the PRs. Steps 1–4
take about 10 minutes.

## 1. Start the backend

```bash
cp .env.example .env          # set MONGO_DB and a new SECRET
npm ci
npm run fetch:vosk-model      # optional: "Say it" on Chromebooks (~40 MB, once)
npm run migrate:history       # dry run: shows old history it would copy
npm run migrate:history -- --apply   # only if the dry run looks right
npm run dev
```

## 2. Automated end-to-end check (real database)

In a second terminal:

```bash
npm run smoke -- --cleanup
```

Every line should show ✓. This covers sign-up, adding a student, QR card
login, practice, benchmark saving, progress, insights, CSV export,
assignments, access control (another teacher, students) and socket
authentication. `--cleanup` removes the smoke-test accounts afterwards.

## 3. Demo class

```bash
npm run seed:demo
```

This prints a password for **Demo Teacher** and six students (Demo-Ava …
Demo-Fay). Each one shows a situation the dashboard should flag:

| Student | Situation | Dashboard should show |
|---|---|---|
| Demo-Ava | steady | on track |
| Demo-Ben | strong reader | on track, highest total |
| Demo-Cleo | too many new words at once | below goal, stalled, low accuracy |
| Demo-Dev | hasn't practised for 10 days | no practice |
| Demo-Eli | untimed accommodation | automaticity "not measured" |
| Demo-Fay | non-speaking (Listen & find counts) | goal met |

Remove it any time: `npm run seed:demo -- --remove`.

## 4. Frontend

```bash
cp .env.example .env.development.local   # VITE_API_URL=http://localhost:3001
npm ci && npm run dev
```

As **Demo Teacher**: Class Insights → Class Progress → a student page →
1:1 assessment → print a take-home packet → download a CSV.

As **Demo-Ava** (password from step 3): Practice → try *Read it*,
*Listen & find* and *Build it* → My Words. Reading Settings: try
OpenDyslexic, high contrast and large text.

## 5. "Say it" (speech)

1. As Demo Teacher, open Demo-Ava's page → Accommodations → tick
   **Say it** → Save.
2. As Demo-Ava on **Chrome (Windows/Mac)**, go to Practice → Say it. It may
   offer a one-time setup first.
3. Read a word correctly, which should show success. Then say a different
   word, which should ask "Did you read it right?". It should never show an
   error mark.
4. Repeat on a **Chromebook**. It should offer "Set up Say it" using the
   school-server speech pack (needs step 1's `fetch:vosk-model`).

Please note the device, browser and what happened for anything that
looks wrong.
