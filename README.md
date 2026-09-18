# Portfolio 254

Static portfolio pages with an Express contact-form API powered by Resend.

## Project layout

```
public/          Browser files: HTML, CSS, and images
src/server.js    Express server and contact-form API
render.yaml      Render web-service configuration
```

## Run locally

1. Copy `.env.example` to `.env` and add your Resend credentials.
2. Run `npm install`.
3. Run `npm start` (or `npm run dev` while editing).
4. Open `http://localhost:5000`.

The site is served by Express, and the contact form posts to `POST /api/contact`.
`GET /health` returns a simple service-health response.

## Deploy on Render

1. Push this repository to GitHub, including `render.yaml` but never `.env`.
2. In Render, select **New +** → **Blueprint**, then choose the repository. Render reads `render.yaml` and creates the web service.
3. Enter these secret environment variables in Render:
   - `RESEND_API_KEY`
   - `EMAIL_TO`
   - `RESEND_FROM` (an address on a domain verified in Resend)
4. Deploy. Render runs `npm ci`, starts the app with `npm start`, and checks `/health`.

The frontend and API use the same Render URL, so no frontend API URL configuration is required.
