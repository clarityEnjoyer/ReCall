# Voice Adding of Cards Functionality

Plan to incorporate hands-free and voice-assisted flashcard creation in the Recall spaced repetition app.

## User Review Required
> [!IMPORTANT]
> - **Web Speech API Compatibility:** We propose using the browser's native **Web Speech API** (`webkitSpeechRecognition` / `SpeechRecognition`) to transcribe speech to text. This is free, processed instantly on-device/in-browser, and requires no API keys. However, it is fully supported only in Chromium-based browsers (Chrome, Edge) and Safari. Firefox does not enable it by default.
> - **Continuous Voice commands:** We propose a "Smart Hands-Free Mode" where the user toggle-starts a continuous listening session. In this mode, speaking specific trigger words (e.g., "front...", "back...", "save card") will control the editor.

## Open Questions
> [!NOTE]
> 1. **Commands Design:** Do the proposed voice commands ("Question/Front", "Answer/Back", "Next field", "Clear fields", "Save card") align with your expectations for hands-free creation?
> 2. **Feedback Cues:** To keep learning dopamine-friendly (Peach/Mint palette), would you like an audio confirmation chime or visual cue (like a success micro-animation) when a card is successfully saved via voice?

## Proposed Changes

### Frontend Design & UI Integration

#### [MODIFY] [CardEditor.jsx](file:///wsl.localhost/Ubuntu/home/alex/programming/projects/AntigravityCheck/src/components/CardEditor.jsx)
- Integrate Web Speech API listener using a custom voice-recognition state handler.
- Add individual microphone buttons (🎙️) nested next to the "Front" and "Back" textareas.
- Add a "🎙️ Hands-Free Continuous Mode" toggle at the top of the form.
- Add a collapsible instruction panel explaining the verbal control commands.
- Provide pulsing state animations and visually active listening cues when a mic is active.

#### [MODIFY] [index.css](file:///wsl.localhost/Ubuntu/home/alex/programming/projects/AntigravityCheck/src/index.css)
- Style the nested microphone buttons so they overlay nicely inside textareas without overlapping text.
- Add a custom `@keyframes` pulsing animation (using a soft Peach/Rose glow) for when voice recognition is actively recording.
- Style the Voice Instruction Panel and listening indicator waves (micro-animations) for high aesthetic quality.

---

## Verification Plan

### Manual Verification
1. Open the application in Google Chrome or Edge.
2. Navigate to a deck page (`/deck/:deckId`) to open the `CardEditor` component.
3. Test individual field microphone buttons:
   - Click the Front field mic, speak a question, and verify transcription.
   - Click the Back field mic, speak an answer, and verify transcription.
   - Observe pulsing animations while recording.
4. Test "Hands-Free Continuous Mode":
   - Toggle continuous mode on.
   - Say: "Front: What color reduces anxiety?"
   - Verify the question is written to the Front text box.
   - Say: "Back: Lavender."
   - Verify the answer is written to the Back text box.
   - Say: "Save card" or "Add card".
   - Verify the card is added, inputs are cleared, and the list updates.
5. Test browser fallback:
   - Open in an unsupported environment (or simulate lack of `webkitSpeechRecognition` support in code).
   - Verify a user-friendly fallback message is shown and mic buttons are disabled.
