# Buddy

Buddy is a voice assistant you can just talk to, about anything. He's a cartoon gorilla who reacts while you talk: he nods along when you speak, scratches his head while he thinks, and his mouth moves with his voice when he answers. You can cut him off mid-sentence like you would a real person.

He runs on Claude or ChatGPT, and you can switch between them (and between a fast and a smart model) from the app.

![CI](https://github.com/bhargavithoka-overclocked/buddy-voice-assistant/actions/workflows/ci.yml/badge.svg)

![Buddy](docs/buddy.svg)

## Features

- Say **"Hey Buddy"** or tap **Hi** to start talking
- Real-time voice conversation, he starts answering about a second after you stop talking
- Interrupt him whenever you want, he stops and listens
- Animated gorilla that reacts when he's listening, thinking, talking or asleep
- Chats are saved, and each chat remembers what you talked about earlier in it
- A few follow-up suggestions after every reply, tap one and he answers it out loud
- Switch between Claude and ChatGPT, and between Fast and Smart models
- You can type instead of talking if you want
- Shows how long each step of a reply took

## How it works

```
you talk -> mic -> detect when you stop -> backend
                                             |
                          speech to text (OpenAI)
                                             |
                          Claude / ChatGPT streams the reply
                                             |
                          split into sentences as they come in
                                             |
                          each sentence -> text to speech (OpenAI)
                                             |
browser plays sentence 1 while sentence 2 is still being written
```

The frontend (React) and backend (FastAPI) talk over one WebSocket. The trick that makes it feel quick is not waiting for the whole answer: as soon as the model has written one sentence, that sentence gets turned into speech and sent to the browser, while the model keeps writing the next one.

## Running it

You need Python 3.11+ and Node 18+.

**Backend**

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -e .
cp .env.example .env     # then add your keys, see below
uvicorn app.main:app --reload --reload-dir app
```

**Frontend** (in a second terminal)

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173, allow the microphone, and say "Hey Buddy".

**No keys yet?** Set `DEMO_MODE=true` in `backend/.env`. Buddy will give made-up replies and talk in beeps, but everything else works, so you can click around and see him move.

**Or with Docker:**

```bash
docker compose up --build
```

and open http://localhost:8080.

## Getting the API keys

Buddy needs an OpenAI key for listening and talking, plus a key for whichever model you want him to think with. The same steps are in the Settings screen in the app (the ⚙️ button), which also shows what's connected and has a button to test each one.

**Claude**

1. Go to the [Anthropic Console](https://console.anthropic.com) and sign in
2. Open API Keys and create a key
3. Put it in `backend/.env` as `ANTHROPIC_API_KEY=...` and restart the backend

If you use Anthropic's `ant` command line tool, running `ant auth login` once is enough, Buddy picks it up without a key in `.env`. Note that a Claude Pro/Max subscription or a Claude Code login doesn't give API access, the API is billed separately.

**ChatGPT and the voice**

1. Go to [platform.openai.com/api-keys](https://platform.openai.com/api-keys) and create a secret key
2. Add some credit under Billing if you haven't
3. Put it in `backend/.env` as `OPENAI_API_KEY=...`
4. Set `OPENAI_FAST_MODEL` and `OPENAI_SMART_MODEL` to the models you want to use, then restart the backend

A ChatGPT Plus subscription or a Codex login doesn't include API credit either.

The keys only live in `backend/.env` on your machine. That file is in `.gitignore`, and the app never sends them to the browser.

## Models

| | Claude | ChatGPT |
| --- | --- | --- |
| Fast | `claude-haiku-5-5` | set `OPENAI_FAST_MODEL` |
| Smart | `claude-opus-5-5` | set `OPENAI_SMART_MODEL` |

All of these can be changed in `backend/.env`. Speech uses `gpt-4o-mini-transcribe` and `gpt-4o-mini-tts` by default (also changeable).

## Notes

**Detecting when you've finished talking.** The browser listens to the mic volume. A bit of loud audio means you started, about 0.8 seconds of quiet means you finished. It keeps the last 0.4 seconds from before you started too, otherwise the first word gets cut off. While Buddy is talking it needs louder and longer sound before it counts as you, so his own voice coming out of the speakers doesn't interrupt him.

**Interrupting.** When you start talking over him, the browser stops the audio and tells the server, which cancels the reply that's still being generated. What he managed to say is saved with a note that he was cut off, so the model knows on the next turn.

**Memory.** Every chat is saved in SQLite. When a chat gets long (over 30 messages), the older part is summarised and Buddy gets the summary plus the recent messages, so he still remembers your name and what you talked about without every request growing forever.

**"Hey Buddy".** This uses the browser's built-in speech recognition, and only while Buddy is asleep. Nothing goes to Buddy's backend until he hears it. It works in Chrome, Edge and Safari (in Chrome the recognition itself runs on Google's servers). In other browsers just tap Hi.

**Two bugs worth mentioning.** Buddy used to get stuck on his second reply, because the audio player kept counting sentences from the previous one. And interrupting him right after he finished, while the follow-up suggestions were still loading, saved his reply twice. Both have tests now.

## Project structure

```
backend/
  app/
    voice.py          # the WebSocket conversation
    sentences.py      # splits the streamed reply into sentences
    memory.py         # chat history and summaries
    suggestions.py    # follow-up suggestions
    providers/        # Claude, ChatGPT, OpenAI speech, and fakes for demo mode
    routers/          # REST endpoints for chats and settings
  tests/
frontend/
  src/
    components/Buddy.jsx   # the gorilla and his animations
    hooks/useBuddy.js      # WebSocket + mic + audio, and his state
    audio/                 # mic, voice detection, playback, wake word
```

## Tests

```bash
cd backend
pip install -e ".[dev]"
pytest
```

The tests use fake versions of the AI and speech services, so they run without any keys or a microphone.

## Ideas for later

- Let Buddy look things up (weather, news) with tool calls
- Different voices and personalities
- A proper wake word model that runs locally instead of the browser's speech recognition

Made by Bhargavi Thoka
