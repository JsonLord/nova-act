---
title: Branding Content Testing
emoji: 🔄
colorFrom: blue
colorTo: blue
sdk: docker
app_port: 7860
hf_oauth: true
persistent_storage: true
---

<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1uBpK_suSmvNgTEgSyU7qMenb62ZRrQwX

## Run Locally

**Prerequisites:** Node.js and Python 3.12+

### Frontend-only development

1. Install dependencies:
   `npm install`
2. Run the Vite dev server:
   `npm run dev`

### Hugging Face/FastAPI runtime

The Docker image builds the React app and serves it from FastAPI on port `7860`, matching the Space URL `https://leon4gr45-usersync.hf.space`. Same-origin `/api/v1/*` requests are proxied by FastAPI so those endpoints can be exposed from the Space URL later. The app also includes an `API Tabs 1-10` page that hosts the additional workflow tabs from the same Space origin.

1. Build frontend assets:
   `npm run build`
2. Install backend dependencies:
   `pip install -r requirements.txt`
3. Serve the Space app locally:
   `uvicorn backend.main:app --host 0.0.0.0 --port 7860`

The GitHub Actions workflow syncs this directory to the Hugging Face Space `Leon4gr45/UserSync` using the `HF_API_KEY` repository secret.
