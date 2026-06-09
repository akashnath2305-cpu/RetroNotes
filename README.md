# RetroNotes - Bold Minimalist AI Study Center 📝

RetroNotes is a full-stack, AI-powered notes and study assistance application. It is styled with a gorgeous, high-contrast, **bold-minimalistic and skeumorphic UI/UX** that mimics real paper, post-it notes, binders, and hand-drawn comic strips, featuring delightful micro-animations.

## Core Features

1. **AI Note Generation:** Draft comprehensive, beautifully structured markdown study pages on any topic using Google Gemini.
2. **Interactive Highlighting:** Highlight text spans in study mode using a floating palette with 5 realistic highlighter marker colors.
3. **Marginalia (Side Comments):** Pin side-notes and comments directly in the page margins alongside highlighted text, resembling handwriting annotations.
4. **AI Sticky Notepad:** Instantly convert note contents into punchy summaries, memory mnemonics, or quick study cards, saving them as post-it notes pinned to a corkboard sidebar.
5. **AI Concept Analyzer:** Select any text phrase inside a study sheet to analyze and explain it using Gemini, shown inside a skeumorphic modal.
6. **Visual Story Comic Strip:** Translate text notes into engaging storyboard graphic comic strips. The panels contain scene narrations, styled dialogue speech bubbles, and AI illustration prompts!
7. **Secure Authentication:** Nice looking, tactile unlock card for registering and logging into notebooks.

---

## Technology Stack

- **Frontend:** React (Vite), Lucide Icons, and custom vanilla CSS for maximum flexbox, shadow play, and transition animations control.
- **Backend:** Node.js (Express), JSON Web Tokens (JWT) for authentication, and `@google/generative-ai` SDK.
- **Database:** PostgreSQL (with `pg` node driver) containing tables for Users, Notes, Highlights, Margin Comments, Sticky Notes, and Story Comics.

---

## Setup Instructions

### 1. Database Setup
Make sure you have a **PostgreSQL** database server running locally:
- Default credentials configuration looks for a user named `postgres` with password `postgres` on port `5432`, and database `ai_notes_db`.
- You can create the database locally by running:
  ```sql
  CREATE DATABASE ai_notes_db;
  ```
- *Note:* The backend automatically performs schema migrations and table initializations when it starts up, so you don't need to manually create tables!

### 2. Backend Environment Config
1. Open the backend folder: `cd backend`
2. Configure `.env` based on `.env.example`:
   - Set your local PostgreSQL credentials (`DB_USER`, `DB_PASSWORD`, `DB_NAME`, etc.).
   - Insert your **Google Gemini API Key** (`GEMINI_API_KEY=your_key_here`). Get a free key from Google AI Studio.

### 3. Install & Start Applications

From the project root:

#### Run Backend Server:
```bash
cd backend
npm install
npm run dev
```
The server will run on `http://localhost:5000` and output:
`Connected to PostgreSQL successfully. Initializing database schema...`

#### Run Frontend Dev Client:
```bash
cd frontend
npm install
npm run dev
```
The client will start on `http://localhost:3000` (which is proxied to backend requests). Open `http://localhost:3000` in your web browser.
