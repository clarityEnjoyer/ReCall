# SpeakCard - Voice-Controlled FSRS Flashcards

An intelligent, local-first flashcard application featuring FSRS (Free Spaced Repetition Scheduler) learning, voice-controlled card creation, and offline-first storage.

## Features

- **Spaced Repetition (FSRS)**: Advanced scheduling matching scientific retention algorithms.
- **Voice Control & Dictation**: Hands-free card creation. Dictate content directly into cards using voice commands.
- **Turbo Mode**: Double-sided continuous voice dictation (records Front, then automatically switches to Back).
- **Multi-language Support**: Voice recognition support for English, Polish, Russian, and other browser-supported languages.
- **Local-First & Offline**: Data is stored securely in your browser's IndexedDB.

---

## Local Installation Guide

To run this application locally on your computer, follow these steps:

### Prerequisites

You need to install the following software on your system:
1. **Node.js** (v18 or higher recommended) - [Download Node.js](https://nodejs.org/)
2. **Git** - [Download Git](https://git-scm.com/)

### Step-by-Step Setup

1. **Clone the Repository**
   Open your terminal (or Command Prompt) and run:
   ```bash
   git clone https://github.com/your-username/your-repo-name.git
   cd your-repo-name
   ```
   *(If your friend doesn't use Git, they can also download the project as a ZIP file, extract it, and open the folder in their terminal).*

2. **Install Dependencies**
   Run the following command to download and install the required libraries:
   ```bash
   npm install
   ```

3. **Run the Development Server**
   Start the local development server:
   ```bash
   npm run dev
   ```

4. **Access the App**
   Open your browser and navigate to the local link shown in your terminal (typically `http://localhost:5173`).

> [!IMPORTANT]
> **Voice Control Browser Compatibility**
> Voice recognition features rely on the Web Speech API. For the best hands-free experience, please use **Google Chrome** or **Microsoft Edge**. Firefox and Safari may have limited support for speech recognition.

---

## Voice Commands Manual

When creating cards, you can toggle hands-free voice mode. Use the following commands:
- **"front"**: Switch the active cursor/input focus to the Front field.
- **"back"**: Switch the active cursor/input focus to the Back field.
- **"clear"**: Clears the text in the currently active field.
- **"add card"** / **"save card"**: Saves the current card and resets the focus to the Front field.
- **"turbo mode"**: Triggers consecutive recording of the Front and then the Back field.
