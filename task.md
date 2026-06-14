# Task Checklist

## Phase 1: Project Scaffolding
- [x] Initialize Vite + React project
- [x] Install dependencies (Dexie.js for IndexedDB)
- [x] Set up project structure

## Phase 2: Design System
- [x] Create CSS design system with neuro-informed pastel palette
- [x] Set up typography (Inter font)
- [x] Implement light/dark mode toggle
- [x] Add micro-animation utilities

## Phase 3: Core Engine
- [x] Implement FSRS spaced repetition algorithm
- [x] Create data models (Deck, Card, ReviewLog, StudySession)
- [x] Build IndexedDB storage layer with Dexie.js

## Phase 4: UI Components
- [x] Build DeckDashboard with progress tracking (hours, days, percentages)
- [x] Build CardEditor (create/edit flashcards)
- [x] Build StudyView (active recall + card flip)
- [x] Build StatsPage (analytics, streaks, retention)
- [x] Build Navigation / App Shell

## Phase 5: Voice Adding of Cards
- [x] Implement SpeechRecognition interface & commands logic
- [x] Add individual microphone buttons to CardEditor textareas
- [x] Add "Hands-Free Continuous Mode" toggle
- [x] Implement subtle feedback cues (and settings toggle to mute sound)
- [x] Add CSS animations and styles for microphone active states in index.css

## Phase 6: Integration & Polish
- [x] Wire up routing (React Router)
- [x] Connect all components to storage layer
- [x] Add micro-animations and transitions
- [x] Test full user flow
- [ ] Verify responsive design

## Reminder
- [ ] 🔔 Remind user to migrate from IndexedDB → Firebase
