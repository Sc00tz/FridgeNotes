# Testing Guide: Performance & Responsiveness

This guide helps you verify the recent fixes for memory usage and UI responsiveness.

## 1. Responsiveness Test (Autocomplete)
**Goal**: Verify that typing in checklists no longer lags the UI.
1.  Open the app and create a checklist note.
2.  Rapidly type several items.
3.  **Observation**: The UI should remain fluid. In the console, you will see `useAutocomplete: Learning from notes (throttled)...` only once every 10 seconds, instead of on every keystroke.

## 2. Memory & DOM Stress Test (Virtualization)
**Goal**: Verify the browser doesn't choke on hundreds of notes.
1.  Login and create a large number of notes (e.g., bypass the UI and use a loop in the console or just create 20-30 complex ones).
2.  Open **Chrome DevTools -> Elements**.
3.  Inspect the `NotesGrid` while scrolling.
4.  **Observation**: You should see `NoteCard` elements being added/removed from the DOM as they enter/exit the viewport. The total number of rendered cards should stay low regardless of how many notes exist in state.

## 3. WebSocket Scaling Test
**Goal**: Verify the server isn't managing hundreds of rooms per user.
1.  Open **Chrome DevTools -> Network -> WS**.
2.  Click on the active socket connection.
3.  Go to the **Messages** tab.
4.  Filter for `join`.
5.  **Observation**: You should see only one `join_user` event on startup, rather than a separate `join_note` for every single note in your collection.

## 4. Build & Structure Check
**Goal**: Verify the reorganization didn't break imports.
1.  Run `cd fridgenotes-frontend && npm run build`.
2.  **Observation**: The build should complete without "Module not found" errors.

---

### Spinning it up (Quick Stats)
- **Backend (API)**: `python src/main.py` (Port 5009)
- **Frontend (UI)**: `cd fridgenotes-frontend && npm run dev` (Port 5173)
