# Photo Studio: setup

What it does: it pulls product photos from your Shopline shop. It makes 3 AI photos
of Yan or your live host wearing each product (studio, outdoor, luxury). Claude
checks that the design matches. You approve. Approved photos are **added** to the
product on Shopline. Your existing photos are never deleted.

## Try it now (free demo)

```bash
npm install
npm run studio
```

Open http://localhost:3002. Until you add keys, it shows sample products and
pretend photos. Nothing is sent to your shop and nothing costs money.

## Go live: 3 keys + face photos

Put these in the `.env` file at the top of the project (next to `.env.example`).

### 1. Google AI photos: Nano Banana 2 (paid, about US$0.07 per photo)

1. Go to https://aistudio.google.com and sign in with Google.
2. Click **Get API key** → **Create API key**.
3. Turn on billing when it asks.
4. Add to `.env`: `GEMINI_API_KEY=your-key`

### 2. Shopline (older admin: admin.shoplineapp.com)

1. Ask your Shopline account manager to **turn on Open API / "API Auth"** for your shop.
2. In Shopline admin: **Settings → Staff Settings** (設定 → 管理員設定) → add a new staff
   member just for this tool.
3. Open that staff member → **API Auth** → allow **Products** and **Media**
   (read and write) → copy the access token.
4. Add to `.env`: `SHOPLINE_ACCESS_TOKEN=your-token`

### 3. Claude (the design checker)

Same key Jarvis uses: `ANTHROPIC_API_KEY=your-key`. It costs about US$0.02–0.05 per photo check.

### 4. Face photos

Put 3–5 clear photos of each person in:

- `studio/faces/yan/`
- `studio/faces/host/`

Face clearly visible, good light, at least one full-body shot, no sunglasses or
heavy filters. Keep each photo under 3 MB (the studio tells you if one is too
big). These photos stay on your computer and never go to GitHub.

Restart `npm run studio`. The chips at the top turn green when each part is live.

## Cost example

20 products × 3 looks = 60 photos ≈ **US$4** for Google (Nano Banana 2) + about US$2 for Claude checks.
With Nano Banana Pro it's about US$8 for Google.
Each **Redo** is one more photo.

## Honest limits

- AI can still change small details (lace pattern, buttons, prints, logos).
  Always compare with the real photo on the left before approving. Claude's
  ⚠ and ✗ marks tell you where to look.
- Faces are usually close, but not perfect every time. Use Redo with a note,
  e.g. "face must look more like Yan", "sleeves must be longer".
- Get your host's OK in writing before using their face in shop photos.

## Optional settings (`.env`)

| Setting               | Default                      | What it does                    |
| --------------------- | ---------------------------- | ------------------------------- |
| `STUDIO_BRAND`        | `our fashion boutique`       | Brand name used when planning looks |
| `STUDIO_ASPECT_RATIO` | `3:4`                        | Photo shape (`1:1` for square)  |
| `STUDIO_IMAGE_SIZE`   | `1K`                         | `2K`/`4K` are sharper, but the design check skips photos over 5 MB |
| `GEMINI_IMAGE_MODEL`  | `gemini-3.1-flash-image`     | Google photo model: Nano Banana 2. Use `gemini-3-pro-image-preview` for Nano Banana Pro |
| `STUDIO_CLAUDE_MODEL` | `claude-opus-5`              | Claude model for planning and checks |
| `STUDIO_PORT`         | `3002`                       | Page address port               |
