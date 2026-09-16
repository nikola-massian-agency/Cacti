/* =========================================================================
   5. CANVAS RENDERING — safe-area fit, centred, DPR-capped.

   The delivered frames are 2400×1700 with a 1920×1080 SAFE AREA inset at
   (240, 310). The magenta surround is deliberate BLEED: it exists to be
   sacrificed on awkward viewports so the safe area never is.

   Two scales matter:

     scaleCover  smallest scale that fills the viewport     (wants LARGE)
     scaleSafe   largest scale that keeps the safe area in  (wants SMALL)

   The four modes differ in which scale they take:

     "safe-cover" scale = scaleSafeCover      composition COVERS the screen
     "safe-fill" scale = scaleSafe            composition as big as it fits
     "cover"     scale = scaleCover           fills; crops bleed, then safe
     "safe"      scale = min(cover, safe)     protects; letterboxes instead
     "stretch"   x and y scaled separately    fills AND keeps all; distorts

   "safe-cover" is the default. It is "safe-fill" pushed one step further:
   instead of fitting the composition INSIDE the viewport it scales until the
   composition COVERS it, so there is no magenta at all on any ordinary
   window — at the cost of the overflow being cropped. maxSafeCrop is the
   budget for that crop, and where the budget runs out (a phone held
   portrait) the bleed comes back rather than gutting the picture.

   "safe-fill" is the other half of that pair, and the only one that sizes
   the COMPOSITION
   rather than the frame: the safe area is fitted to the viewport so that it
   touches either the left and right edges or the top and bottom, and the
   bleed runs off the other two — or fills what is left over. Cover fits the
   whole 2400x1700 frame instead, bleed included, which on a 4:3 window leaves
   the composition at ~85% of the width it could have had, ringed in magenta.

   The bleed covers aspects 1.13-2.22, so inside that range safe-fill has no
   gap to fill and loses nothing. Outside it, safe-fill keeps the composition
   whole behind black bars where cover would crop into it (up to maxSafeCrop)
   and stretch an axis (up to maxStretch*) to avoid them.

   What covers the gap when there is one is CONFIG.render.edgeFill: extend the
   frame's outermost pixels outward (the default — nothing distorts), stretch
   the whole frame on that axis until it reaches the edge (fills with real
   picture, distorts it), or leave it black.

   CONFIG.render.fit picks one. See README for the measured boundaries.
   ========================================================================= */

import { CONFIG } from "./config";

export interface Layout {
  /** x scale. Equals scaleY except in "stretch" mode. */
  scale: number;
  scaleY: number;
  dx: number;
  dy: number;
  dw: number;
  dh: number;
  /** true when the frame does not cover the whole canvas */
  hasGaps: boolean;
}

export class Renderer {
  private ctx: CanvasRenderingContext2D | null;
  private cw = 0;
  private ch = 0;
  private lastDrawn: ImageBitmap | null = null;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d", { alpha: false });
  }

  /** Returns the width frames should be DECODED at: the width the image is
      actually drawn at, in device pixels. Decoding wider than that wastes
      memory; narrower makes it soft. */
  resize(): number {
    if (!this.ctx) return 0;
    const dpr = Math.min(window.devicePixelRatio || 1, CONFIG.render.maxDPR);
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (!w || !h) return 0;

    this.cw = w;
    this.ch = h;
    this.canvas.width = Math.max(1, Math.round(w * dpr));
    this.canvas.height = Math.max(1, Math.round(h * dpr));
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const src = CONFIG.sequence.source;
    const { dw } = this.fit(src.width, src.height);

    /* 23. a resize must redraw the current frame, not leave a blank canvas */
    if (this.lastDrawn) this.paint(this.lastDrawn);

    /* the width the frame is actually drawn at, in device pixels */
    return Math.ceil(dw * dpr);
  }

  /** Fit a frame of the given pixel size to the viewport. The safe rect is
      applied proportionally, so this works whatever size the frame was
      decoded at. See CONFIG.render.fit for the three modes. */
  private fit(bw: number, bh: number): Layout {
    const src = CONFIG.sequence.source;
    const sa = CONFIG.sequence.safeArea;
    const mode = CONFIG.render.fit;

    /* safe rect as a fraction of the source, then in this frame's pixels */
    const sx = (sa.x / src.width) * bw;
    const sy = (sa.y / src.height) * bh;
    const sw = (sa.width / src.width) * bw;
    const sh = (sa.height / src.height) * bh;

    /* "stretch": scale each axis independently. Fills exactly, crops nothing,
       distorts everything. Kept because it is the only mode that guarantees
       both "full screen" and "nothing cut off" at the same time. */
    if (mode === "stretch") {
      return {
        scale: this.cw / bw,
        scaleY: this.ch / bh,
        dx: 0,
        dy: 0,
        dw: this.cw,
        dh: this.ch,
        hasGaps: false,
      };
    }

    const scaleCover = Math.max(this.cw / bw, this.ch / bh); // fills, wants large
    const scaleSafe = Math.min(this.cw / sw, this.ch / sh); // protects, wants small
    /* fills the viewport with the COMPOSITION rather than the frame, which
       is what "no magenta anywhere" costs: everything past the edge is cut */
    const scaleSafeCover = Math.max(this.cw / sw, this.ch / sh);

    /* "safe" never crops the composition at all.
       "cover" fills, but only up to CONFIG.render.maxSafeCrop of the safe
       area — enough to cover every landscape shape, while refusing to throw
       away most of the picture on a portrait phone. */
    const tolerance = Math.max(0, Math.min(0.999, CONFIG.render.maxSafeCrop));
    const scaleAllowed = scaleSafe / (1 - tolerance);
    /* "safe-fill" takes scaleSafe outright: the largest scale at which the
       whole composition still fits. Everything around it is bleed, which is
       there to be run off the edge, so there is nothing to protect by
       shrinking further — and nothing to gain by growing the frame instead. */
    const scale =
      mode === "safe-fill"
        ? scaleSafe
        : mode === "safe-cover"
          ? Math.min(scaleSafeCover, scaleAllowed)
          : mode === "cover"
            ? Math.min(scaleCover, scaleAllowed)
            : Math.min(scaleCover, scaleSafe);

    /* Close any remaining gap by stretching that axis alone, up to the cap.
       A wide screen needs ~3% and simply fills; a portrait phone would need
       ~115%, so it hits the cap and keeps a bar rather than distorting. */
    const maxX = Math.max(1, CONFIG.render.maxStretchX);
    const maxY = Math.max(1, CONFIG.render.maxStretchY);
    let scaleX = scale;
    let scaleY = scale;
    /* cover always closes a leftover gap this way; safe-fill only when
       edgeFill asks it to, since its whole point is not distorting. */
    const stretchToFill =
      mode === "cover" || (mode === "safe-fill" && CONFIG.render.edgeFill === "stretch");
    if (stretchToFill) {
      if (bw * scale < this.cw) scaleX = Math.min(this.cw / bw, scale * maxX);
      if (bh * scale < this.ch) scaleY = Math.min(this.ch / bh, scale * maxY);
    }

    const dw = bw * scaleX;
    const dh = bh * scaleY;

    /* Centre the SAFE AREA on the viewport, not the frame. They coincide for
       this delivery, but an off-centre safe rect would otherwise drift. */
    const dx = this.cw / 2 - (sx + sw / 2) * scaleX;
    const dy = this.ch / 2 - (sy + sh / 2) * scaleY;

    return {
      scale: scaleX,
      scaleY,
      dx,
      dy,
      dw,
      dh,
      hasGaps: dx > 0.5 || dy > 0.5 || dx + dw < this.cw - 0.5 || dy + dh < this.ch - 0.5,
    };
  }

  draw(bm: ImageBitmap) {
    if (bm === this.lastDrawn) return; // 23. avoid redundant redraws
    this.paint(bm);
    this.lastDrawn = bm;
  }

  private paint(bm: ImageBitmap) {
    if (!this.ctx || !this.cw) return;
    const l = this.fit(bm.width, bm.height);
    /* only clear when something would otherwise show through the gaps */
    if (l.hasGaps) {
      this.ctx.fillStyle = "#000";
      this.ctx.fillRect(0, 0, this.cw, this.ch);
    }
    this.ctx.drawImage(bm, l.dx, l.dy, l.dw, l.dh);
    /* "stretch" extends too, for the residue past maxStretchX/Y: the cap is
       reached before the edge on an extreme viewport (at 4:1 it stretches 60%
       and is still 133px short each side), and stopping there would put the
       black bars back. Only "black" opts out. */
    if (l.hasGaps && CONFIG.render.edgeFill !== "black") this.extendEdges(bm, l);
  }

  /** Cover the gaps by stretching the frame's outermost pixels outward, so a
      viewport the bleed cannot reach ends in more bleed instead of in black.

      A one-pixel source sliver, deliberately: it follows whatever the bleed
      actually is — flat magenta now, real artwork later — where painting a
      colour would assume one and seam against the real thing.

      Only ONE axis can ever gap, so corners never arise: the scale is bound
      by the tighter axis, and the frame is 1.25x the safe area horizontally
      and 1.57x vertically, so whichever axis binds is over-covered. */
  private extendEdges(bm: ImageBitmap, l: Layout) {
    const ctx = this.ctx;
    if (!ctx) return;
    const right = l.dx + l.dw;
    const bottom = l.dy + l.dh;
    if (l.dx > 0.5) {
      ctx.drawImage(bm, 0, 0, 1, bm.height, 0, l.dy, l.dx, l.dh);
    }
    if (right < this.cw - 0.5) {
      ctx.drawImage(bm, bm.width - 1, 0, 1, bm.height, right, l.dy, this.cw - right, l.dh);
    }
    if (l.dy > 0.5) {
      ctx.drawImage(bm, 0, 0, bm.width, 1, l.dx, 0, l.dw, l.dy);
    }
    if (bottom < this.ch - 0.5) {
      ctx.drawImage(bm, 0, bm.height - 1, bm.width, 1, l.dx, bottom, l.dw, this.ch - bottom);
    }
  }

  /** Current layout, for the debug overlay. */
  layoutFor(bm: ImageBitmap): Layout {
    return this.fit(bm.width, bm.height);
  }

  /** Force the next draw to repaint even if it is the same bitmap. */
  invalidate() {
    this.lastDrawn = null;
  }
}
