# ThumbForge

ThumbForge is a context-aware YouTube thumbnail studio. Members submit a video
link or script and receive original, human-reviewed thumbnail concepts built
around the real hook, correct cast, and reason to click.

## Membership Plans

- Starter: `$29/month` for 6 delivery credits
- Pro: `$69/month` for 24 delivery credits
- Additional credits: `$3 each`
- Custom: recommended within 24 hours based on volume and workflow

One credit equals one finished thumbnail concept. One revision is included per video brief.

## Local Preview

Open `index.html` directly or serve the folder with:

```powershell
python -m http.server 4173
```

Then visit `http://127.0.0.1:4173`.

## Deployment

The site is static and can be hosted with GitHub Pages. The checkout and form
currently use founder-stage placeholders and must be connected before accepting
payments.

## Process Videos

- Desktop/web: `assets/video/thumbforge-process-wide.mp4` at 1280x720
- Mobile: `assets/video/thumbforge-process-mobile.mp4` at 720x1280

Both are silent, looping H.264 MP4 files optimized for inline web playback.
Their editable FFmpeg filter scripts are stored in `video-src`.
