# Speak with Rhythm

Speak with Rhythm is an AI-assisted English reading feedback web app designed for classroom use. A teacher operates the app on one microphone-enabled computer while students take turns reading a displayed passage aloud.

This repository contains the Phase 1 classroom experience and its shared server-side passage foundation. Speech feedback remains simulated; passage persistence and Teacher Setup authentication are server-backed.

## Product goal

Create a calm, focused classroom experience that helps students reflect on spoken English through approachable feedback about rhythm, fluency, and clarity.

Phase 1 is a simulated product experience by default. The server also contains an opt-in Xunfei Streaming Speech Evaluation adapter for later validation, while preserving automatic simulated-feedback fallback for classroom reliability.

## Audience and environment

- Primary operator: an English teacher
- Participants: students reading aloud one at a time
- Device model: one shared classroom computer
- Required hardware: a computer microphone
- Expected setting: teacher-led classroom practice

## Phase 1 scope

### Included

- A React and TypeScript single-page application
- Tailwind CSS styling
- A microphone recording interaction using browser media capabilities
- A three-second pre-reading countdown
- A simulated AI reflection state
- Simulated feedback for rhythm, fluency, and clarity
- Teacher editing and saving of the reading passage through a shared persistence layer
- Classroom Mode loading the latest passage saved from Teacher Setup
- A complete repeatable reading cycle
- A Node.js and Express server in the same repository and deployment
- Persistent SQLite storage for the current reading passage
- Password-protected Teacher Setup API access

### Not included

- Real external evaluation enabled for ordinary classroom use (the Xunfei adapter remains disabled while `AI_MODE=mock`)
- Real speech recognition or pronunciation scoring
- Real audio analysis
- User registration or multi-user accounts
- A completed Teacher Setup visual interface
- Student history, reporting, or analytics
- Multi-class or roster management

## Routes

### `/` — Classroom Mode

The default route opens directly to the student-facing reading experience. There is no landing page or dashboard before it.

Planned state flow:

1. Reading Page
2. Three-second countdown
3. Recording
4. AI Reflection animation
5. Feedback Result
6. Read Again, returning to the Reading Page

### `/setup` — Teacher Setup

The teacher can edit the reading passage and save the latest version. Classroom Mode will load the newest passage through the same shared persistence layer.

### `/reflection` — AI Reflection

A calm transition page shown only after the teacher or student explicitly chooses to analyze a completed recording. It presents simulated listening motion and the three reflection dimensions without calculating scores or showing final feedback.

### `/feedback` — Feedback Result

An encouraging simulated result page shown after the three-second AI Reflection transition. It plays a fixed local celebration chime, reveals a praise message, and presents non-numeric SVG star reflections for rhythm, fluency, and clarity.

## Reading passage requirements

- The reading passage is editable by the teacher in Teacher Setup.
- A length of 70–100 English words is recommended for a classroom reading turn.
- The recommendation is guidance, not a hard save limit.
- Passage content should be optimized for oral reading, with natural phrasing, age-appropriate vocabulary, and manageable sentence length.
- Classroom Mode displays the latest saved passage as the authoritative reading text.

## Application and persistence architecture

Teacher Setup and Classroom Mode are two routes within the same deployed application. They are not separate products or independently deployed sites.

Both routes must read and write the reading passage through one shared persistence contract:

- Teacher Setup saves the latest passage through the shared persistence layer.
- Classroom Mode reads the latest saved passage from that same layer.
- Route components must not own or duplicate passage persistence logic.
- The persistence boundary should be expressed as a replaceable service or repository interface.
- The current implementation connects that interface to the same-origin Express API through an API-backed repository.

Express serves the API and the built Vite application in production. SQLite stores one authoritative `current_reading_passage` record. On an empty database, the server creates a controlled default passage once; all later saves replace that record and increment its revision.

## Feedback model

Phase 1 feedback is simulated and must be clearly represented as a practice experience rather than a real assessment.

The result covers three dimensions:

- **Rhythm:** pacing, phrasing, and natural stress patterns
- **Fluency:** continuity, confidence, and smoothness
- **Clarity:** intelligibility and careful word delivery

Simulated feedback should feel encouraging, specific, and suitable for students. It should avoid high-stakes grading language.

## Recording behavior

- The app requests microphone access when a reading begins.
- A three-second countdown gives the student time to prepare.
- Recording starts after the countdown.
- The teacher or student stops the recording through an explicit control.
- The audio remains local to the browser in Phase 1.
- The app transitions to the simulated AI Reflection state after recording.
- Permission denial and unavailable microphone states will receive clear recovery guidance.

## Experience principles

- Open directly into the activity.
- Keep the student's attention on the passage and the act of reading.
- Make every transition legible from across a classroom.
- Use warm, calm language rather than technical AI terminology.
- Keep teacher controls easy to find without making Classroom Mode feel like an admin dashboard.
- Support keyboard, pointer, and touch input.
- Respect reduced-motion preferences and accessible contrast requirements.

## Planned source structure

```text
src/
├── app/                    # App entry, router, and service composition root
├── components/             # Shared presentation components
├── features/
│   ├── ai-reflection/      # Simulated analysis transition
│   ├── feedback/           # Result generation and presentation
│   ├── reading-session/    # Reading flow state coordination
│   ├── recording/          # Microphone and MediaRecorder behavior
│   └── teacher-setup/      # Passage editing and saving
├── hooks/                  # Shared React hooks
├── routes/
│   ├── classroom/          # `/`
│   └── setup/              # `/setup`
├── services/
│   ├── analysis/           # Provider-independent speech feedback service
│   └── persistence/        # Shared passage service and repository contract
├── styles/                 # Tailwind CSS entry and global styles
└── types/                  # Reading-passage and shared TypeScript types
```

## Technical foundation

- React 19
- TypeScript 5
- Vite 8
- Tailwind CSS 4
- Node.js 22.13 or newer
- Express 5
- SQLite through Node's built-in `node:sqlite` module

The frontend depends on the `ReadingPassageRepository` contract. Its production implementation talks to the same-origin API; React components do not call `fetch`, SQLite, or browser storage directly.

## Server API

| Method | Endpoint | Access | Behavior |
| --- | --- | --- | --- |
| `GET` | `/api/reading-passage` | Public | Returns the authoritative current passage. |
| `POST` | `/api/speech-analysis` | Public | Accepts one temporary browser-recorded audio upload and returns one provider-independent classroom feedback result. |
| `POST` | `/api/setup/login` | Public, rate-limited | Validates the server-side teacher password and creates a signed HTTP-only session cookie. |
| `GET` | `/api/setup/session` | Public | Reports whether the current cookie contains a valid Teacher Setup session. |
| `PUT` | `/api/reading-passage` | Teacher session required | Validates non-empty passage content, replaces the singleton record, and increments its revision. |
| `POST` | `/api/setup/logout` | Public | Clears the Teacher Setup session cookie. |

Authentication uses one teacher password from the server environment. The password is never returned to the client or stored in SQLite. Authentication state is HMAC-signed with `SESSION_SECRET`; the cookie is HTTP-only, SameSite=Lax, and Secure when `NODE_ENV=production`.

Repeated failed login attempts are limited per client IP. A client is temporarily blocked after five failures in a ten-minute window.

## Environment variables

Copy `.env.example` to `.env`, then replace its placeholder secrets:

```dotenv
TEACHER_SETUP_PASSWORD=choose-a-teacher-password
SESSION_SECRET=choose-a-random-secret-with-at-least-32-characters
DATABASE_PATH=./data/speak-with-rhythm.sqlite
PORT=3001
AI_MODE=mock
FFMPEG_PATH=ffmpeg
AUDIO_UPLOAD_MAX_BYTES=15728640
AUDIO_NORMALIZATION_TIMEOUT_MS=15000
XFYUN_APP_ID=
XFYUN_API_KEY=
XFYUN_API_SECRET=
XFYUN_ISE_URL=wss://ise-api.xfyun.cn/v2/open-ise
XFYUN_REQUEST_TIMEOUT_MS=15000
XFYUN_FRAME_BYTES=19200
XFYUN_FRAME_INTERVAL_MS=40
```

- `TEACHER_SETUP_PASSWORD` is required and remains server-only.
- `SESSION_SECRET` is required and must contain at least 32 characters. Changing it invalidates existing Teacher Setup sessions.
- `DATABASE_PATH` controls the SQLite file location and defaults to `./data/speak-with-rhythm.sqlite`.
- `PORT` controls the Express port and defaults to `3001`.
- `AI_MODE` selects the server-side speech provider. Use `mock` for Phase 1 or `xunfei` to attempt the future Xunfei provider with automatic mock fallback.
- `FFMPEG_PATH` is the FFmpeg executable used to normalize temporary browser recordings; it defaults to `ffmpeg` on the runtime PATH.
- `AUDIO_UPLOAD_MAX_BYTES` bounds one classroom recording upload and defaults to `15728640` (15 MB).
- `AUDIO_NORMALIZATION_TIMEOUT_MS` limits an in-memory FFmpeg conversion and defaults to `15000` milliseconds.
- `XFYUN_APP_ID`, `XFYUN_API_KEY`, and `XFYUN_API_SECRET` are server-only Xunfei credentials. They are needed only when `AI_MODE=xunfei`; never use a `VITE_` prefix for them.
- `XFYUN_ISE_URL` defaults to Xunfei's secure English ISE endpoint.
- `XFYUN_REQUEST_TIMEOUT_MS`, `XFYUN_FRAME_BYTES`, and `XFYUN_FRAME_INTERVAL_MS` bound the server-side WebSocket request and PCM frame pacing. The verified default frame size is `19200` bytes, and no frame can exceed that cap.
- `VITE_API_PROXY_TARGET` is optional and changes the Vite development proxy target from `http://localhost:3001`.

Keep `.env` and the SQLite data file out of source control. In production, preserve or mount the directory containing `DATABASE_PATH`; otherwise passage updates will be lost when the deployment filesystem is replaced.

## Speech analysis providers

The browser submits one temporary multipart request containing the browser recording, recording characteristics, displayed passage text, and passage revision when available. That request is prepared in the background as soon as a recording ends, while the student-facing review controls remain unchanged. Express keeps the upload only in memory, normalizes it to 16 kHz, mono, signed 16-bit PCM through FFmpeg, and passes normalized bytes only to the provider boundary. No student recording is written to SQLite, browser storage, or permanent server files. The classroom receives only the shared feedback contract: Rhythm, Fluency, Clarity, praise, and encouraging comments. Provider names and technical failures are never included in the classroom response.

When Analyze is selected, the Reflection page always stays visible for its fixed three seconds. At that deadline, a ready prepared result is used; otherwise the deterministic Mock feedback created for the same recording is shown immediately and the late request is cancelled or ignored. This deadline fallback is independent of the server-side provider fallback.

For opt-in Xunfei manual testing, safe server logs report only provider completion, response completion, or cancellation before completion. They never include credentials, signed URLs, reference text, audio content, raw XML, or raw scores.

With `AI_MODE=mock`, the server always uses the simulated analyzer. With `AI_MODE=xunfei`, the server attempts Xunfei's server-only Streaming Speech Evaluation provider first. It signs a secure WebSocket request with HMAC-SHA256, sends an English `read_chapter` request followed by 16 kHz/16-bit/mono PCM frames, parses only the final XML chapter scores, and calibrates them before returning the same classroom feedback contract.

Missing credentials, authentication failures, handshake or network errors, timeouts, malformed messages, rejected or incomplete XML results, normalization issues, and provider exceptions all fall back to the simulated analyzer. The classroom response never contains provider names, raw XML, signed URLs, credentials, stack traces, or student audio. Server diagnostics avoid logging the reference text, audio data, and authenticated URL.

Mock scoring starts from an encouraging classroom baseline and adjusts Rhythm, Fluency, and Clarity using voice presence, volume stability, natural volume variation, and recording quality. Results are calibrated to `3.5`, `4`, `4.5`, or `5` stars; the UI continues to display only SVG stars and supportive language, never numeric scores.

Xunfei uses the same calibration layer as the rest of the application. Its raw accuracy, fluency, integrity, and standard values are converted into the same half-star classroom scale before the unified result reaches the frontend. Raw provider scores are never exposed to students.

### Optional live Xunfei verification

The live test is deliberately excluded from `npm test`. It sends exactly one normalized PCM request only when explicitly opted in, and it does not generate, save, or retain audio. Keep `AI_MODE=mock` for normal classroom use during this integration phase.

```powershell
$env:XFYUN_LIVE_TEST = "1"
npm run test:xunfei-live -- --audio C:\path\to\normalized-16k-mono.pcm --text "The exact matching English passage."
```

The file must already be `pcm_s16le`, 16 kHz, 16-bit, and mono. The command prints only connection status, the returned session ID, safe numeric score fields, and elapsed time. It never prints credentials, signed URLs, reference text, or audio.

## Local development

Requirements: Node.js 22.13 or newer, npm, and a compatible FFmpeg executable for audio normalization. On Windows, install FFmpeg and place it on `PATH`, or set `FFMPEG_PATH` to its executable path. The future Linux deployment must also provide a compatible FFmpeg executable.

```bash
npm install
npm run dev
```

On PowerShell, create the local environment file with:

```powershell
Copy-Item .env.example .env
```

Then edit `.env` before starting the app. `npm run dev` starts both Express and Vite. Vite proxies `/api` requests to Express, so the browser continues to use same-origin API paths.

Useful individual commands:

```bash
npm run dev:server
npm run dev:client
```

## Validation and production

```bash
npm run typecheck
npm test
npm run build
```

The production build creates `dist/` for Vite and `dist-server/` for Express. Start the single deployment with the production environment variables configured:

```bash
NODE_ENV=production npm start
```

On PowerShell:

```powershell
$env:NODE_ENV = "production"
npm start
```

Express serves `/api/*` itself and serves the built Vite SPA for all non-API routes, including `/`, `/setup`, `/reflection`, and `/feedback`. This is one server and one deployable application.

## Current status

- [x] Project initialized
- [x] Source folders created
- [x] Product specification documented
- [x] Classroom Mode static UI
- [ ] Teacher Setup UI
- [x] Reading preparation and simulated recording states
- [x] Browser microphone recording interaction
- [x] In-memory audio playback review
- [x] AI Reflection transition page
- [x] Shared passage persistence service abstraction
- [x] Express API and SQLite singleton passage persistence
- [x] Password-protected Teacher Setup server session
- [x] API-backed Classroom passage loading
- [x] Server API integration tests
- [x] Simulated AI reflection and feedback flow
