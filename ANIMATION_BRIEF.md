# Re-export request — CACTI scroll site

You've already made the animation. This is not a request to redo it. It's a
request for **a second export of the same work**, in a form the website can
drive, plus the source master at full quality.

---

## 1. The one blocking problem: the UI is baked into the render

The current render has the **navigation, logo, headlines, sub-copy, buttons,
progress rail and "SCROLL TO DISCOVER" burned into the picture**.

That can't ship. Text inside a video or image sequence:

- can't be selected, searched, or found by Google;
- can't be translated;
- **can't reflow** — the headline that reads perfectly at 3840px wide is a few
  pixels tall on a phone, and there is no way to fix that without re-rendering;
- can't be a real link — "SHOP VARIETY PACK" has to be a clickable button that
  goes to the store;
- is invisible to screen readers;
- means **every copy change is a full re-render**.

**What we need instead:** the same animation with the **text and UI layers
switched off**. Clean plates only — environment, product, collage, print
artwork. The website draws all the type and chrome live on top, positioned to
match your composition exactly.

Nothing else about the animation changes.

---

## 2. What to send

### a) The clean master (priority)

**One single file — the whole 22.6s timeline, uncut.** Please don't split it
into the four shots: the dissolves sit across the shot boundaries, and cutting
there slices each dissolve in half. We do all the splitting, frame extraction
and compression on our side.

The same 22.6s animation, **UI layers hidden**, as a high-quality master:

- **ProRes 422** (preferred), or **H.264/H.265 at ≥50 Mbps**
- **1920×1080 minimum**; 2560×1440 or 3840×2160 welcome if it exists
- 30 fps, same as the current render
- sRGB / Rec.709
- No audio needed

**We will extract and compress the frames ourselves.** Don't spend time
exporting image sequences or worrying about WebP — just send the best-quality
master you have and we handle the web encoding.

The file we were sent came via WhatsApp and is heavily recompressed, so it
can't be used as a source.

Rough file sizes, so you can pick something sendable over WeTransfer or Drive:

| export | approx size |
|---|---|
| H.264 @ 50 Mbps, 1080p | **~140 MB** ← easiest |
| ProRes 422, 1080p | ~415 MB |
| ProRes 422, 4K | ~1.7 GB |

Any of these is fine. If in doubt, send the H.264.

### b) Confirm the shot timings

We measured these boundaries off the render. Please confirm or correct:

| event | time |
|---|---|
| Shot 1 — desert, can lifts, camera flies into label | 0:00 – 0:12.0 |
| Headline changes to "Refreshing by nature" | **0:08.4** |
| Dissolve → cut-paper collage | **0:12.0** |
| Dissolve → red screen print | **0:15.4** |
| Dissolve → variety pack | **0:19.5** |
| End | 0:22.6 |

These drive where the copy swaps as the user scrolls, so they need to be right.

---

## 3. Shots 2 and 3 — please also send the layers

Shots 1 and 4 are real 3D camera moves, so those have to reach us as frames.

**Shots 2 and 3 do not.** The collage and the screen print are flat, and very
little in them actually moves — cans drift, fruit floats, the hand rotates up
to the mouth. We can do all of that in the browser from the layers themselves,
which is roughly **5–8 images per shot instead of ~100 frames**. Large saving
in page weight, and it looks sharper, because each layer is drawn at native
resolution instead of baked into a frame.

So alongside the master, for **shots 2 and 3 only**, please export the elements
as separate **transparent PNGs**:

**Shot 2 — collage**
- cream background (no alpha needed)
- each fruit cut-out as its own file (lime, cherry, orange, strawberry, taco)
- each floating can as its own file
- the torn-paper strip, and the row of cans behind it

**Shot 3 — screen print**
- cream background
- the red printed figure
- the hand — **separate from the figure**, because it rotates
- the can — separate again; it is the only photographic element and it moves
  independently of the print
- the torn-paper strip

Each layer at the size it appears in a 1920×1080 frame, or larger. Please
don't pre-compose them, and don't bake in the movement — the movement is the
part we are reproducing.

**PNG rather than WebP for these**, purely to keep it simple: a cut-out lives
or dies on its alpha edge, and PNG has exactly one way to be right. We convert
to WebP on our side.

If this is awkward on your end, skip it and send only the master. The frames
work; this is an optimisation, not a blocker.

---

## 4. Two things to know about how it will be used

**It will not play on its own.** Scroll position drives the animation frame by
frame — forward when the user scrolls down, backward when they scroll up, at
whatever speed they move. It can be stopped halfway. Every frame is a frame
someone may sit and look at, so there should be no frames that only read
correctly in motion.

**The copy sits on top, in these areas.** Please keep the focal subject and any
high-contrast detail clear of whichever side is active:

- 0:00 – 0:08.4 → copy on the **left ~46%**
- 0:08.4 – 0:12.0 → copy moves to the **right ~40%** (the macro can fills the left)
- 0:12.0 – 0:22.6 → copy on the **left ~46%**

This already matches how you framed it — the can sits right of centre early,
then the label crop fills the left. We just need it to stay true with the text
layers removed.

---

## 5. Portrait version, for phones

The render is 16:9. A phone screen is roughly 9:19.5. To fill a phone without
distorting, we have to crop a 16:9 frame down to a portrait window — which
throws away **about 60% of the width** and destroys your framing. The can ends
up off-screen, the variety pack gets cut in half.

There are only three honest options, and the first is much the best:

1. **Re-export a portrait pass** — same animation, same timings, camera
   reframed for 9:16. This is normally a camera/composition change rather than
   new animation work, and it's what premium sites ship.
2. Letterbox the 16:9 on phones — safe, but leaves big empty bands and looks
   cheap on a full-bleed hero.
3. Accept the crop — we'd need you to tell us, per shot, which part of frame
   must survive.

**Please say which is realistic for your schedule.** If option 1 is on, we need
the same clean-plate treatment and the same five timings, at 1080×1920.

---

## 6. If you also have these, they help

- A still frame from each shot at full resolution, for social/OG images.
- The **can render on its own**, over transparency — it is the one element that
  appears in every shot, and having it separate lets us reuse a single asset.

(We looked at whether shots 2 and 3 could be delivered as vector/Lottie, since
they read as flat graphic work. On close inspection they are thresholded
photography rather than drawn vector — the eyebrow alone is hundreds of
individual hair strokes — so a faithful trace would be thousands of paths and
heavier than the image it replaced. The layered PNGs in section 3 get the same
benefit without that problem.)

---

## 7. Summary

1. Re-export the same animation **without the text/UI layers**.
2. Send it as **one uncut high-bitrate master** (ProRes or ≥50 Mbps H.264), 1080p+.
3. Confirm the five timings in the table above.
4. If it is not much work: the separate layers for shots 2 and 3 (section 3),
   and a portrait pass (section 5).

That's everything. The website is built and waiting for it.
