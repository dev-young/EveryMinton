# Every Minton

Every Minton is a badminton schedule and member management app built with Next.js and Firebase.

## What is inside

- `app/`: the actual web application
- `docs/`: product notes, UI guidelines, and prototype pages

## Main features

- Member management
- Schedule creation and status tracking
- Participant management
- Manual and automatic match arrangement
- Firebase-backed data access

## Tech stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- Firebase / Firestore

## Getting started

The runnable app lives in `app/`.

```bash
cd app
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Useful scripts

From `app/`:

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Environment

Create and manage local Firebase settings in:

- `app/.env.local`

Keep this file out of git.

## Reference docs

- `docs/개발 가이드.md`
- `docs/UI 인터랙션 가이드.md`
- `docs/프로젝트 계획서.md`

## Notes

The repository is organized as a root-level workspace with the app and design docs separated so it is easy to evolve both in parallel.

