# KAWLA Living Manuscript

A local, UI-only museum experiment built with Next.js App Router, TypeScript, and Tailwind CSS. The responsive page places the manuscript viewer beside a conversation panel on desktop and stacks them on mobile.

## Start locally

Use Node.js 20.9 or newer and npm.

```sh
npm install
npm run dev
```

Open http://localhost:3000. No API key or environment configuration is required.

## Check and build

```sh
npm run lint
npm run typecheck
npm run build
npm start
```

`npm start` serves the production build after `npm run build`.

## Demonstration content

`data/manuscript.json` is the sole source of manuscript content. No real manuscript has been selected, and its date, origin, and language are explicitly not established. `public/manuscripts/demo-manuscript.svg` is an original local illustration with abstract marks, not readable writing or a historical reproduction. Both are labeled as demonstration content in the interface.

Reusable components live in `components/`: `ManuscriptViewer`, `ConversationPanel`, `PushToTalk`, `SpeakerIndicator`, and `SuggestedQuestions`. The layout and page live in `app/`; `lib/manuscript.ts` exposes the local data and its inferred TypeScript type.

Suggested questions populate the editable text input. Submitting adds a visitor question to a local preview transcript (up to ten questions); it does not generate an answer. Reset clears the questions and input. Reload also clears all session state. The introduction is explicitly labeled sample text.

Microphone, replay, and stop controls are disabled placeholders. There is no recording, transcription, speech synthesis, model integration, backend endpoint, persistence, or analytics. All fonts and illustration assets are local/system resources. The viewer includes an image failure fallback.

## Manual UI checks

- At desktop width, confirm the viewer sits left of the conversation panel; at mobile width, confirm it stacks above it without horizontal overflow.
- Navigate controls by keyboard and check visible focus. Select each suggested question and confirm the text input is populated and focused.
- Submit an edited question and confirm it appears under “You,” with a preview-only notice and no generated answer.
- Reset and reload to confirm questions clear. Confirm microphone and audio controls are unavailable and do not request permissions.
