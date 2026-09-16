# assets/

The animator's render goes here, one folder per shot:

    public/assets/shot1/frame_0001.webp …
    public/assets/shot2/…

Then point the keys in `src/lib/scenes.tsx` → `ART_ASSETS` at them. Paths are
served from the site root, so `public/assets/shot1/` is `/assets/shot1/`.

Empty today — every layer falls back to the placeholder SVG in `src/lib/art.ts`.
