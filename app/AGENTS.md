<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## EveryMinton Navigation Rules

- Treat browser back and Android physical back as first-class flows, separate from in-app back buttons.
- If a UI state affects where users return after navigation, represent it in the route or query string where practical.
- In Next.js App Router code, prefer `router.push` / `router.replace` over direct `window.history.pushState` / `window.history.replaceState`.
- For local modal or bottom-sheet back-button handling that is not represented in the route, use `src/hooks/useModalHistory.ts`; do not call `window.history` directly from components.
- Do not duplicate URL-derived tab/filter state in React state unless there is a clear reason; derive it from `useSearchParams` or synchronize it explicitly.
- When changing tabs, modals, detail/edit navigation, or return paths, verify in-app controls, browser back, and Android physical back behavior.
- Follow `docs/UI 인터랙션 가이드.md` for bottom sheet, modal, toast, dropdown, and back-button interaction rules.
