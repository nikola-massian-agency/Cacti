/* =========================================================================
   1 + 19. SEQUENCE CONFIGURATION

   Everything tunable lives here. Changing `stateFrames` reshapes the whole
   experience — chunks, transitions and the debug readout all derive from it.
   ========================================================================= */

export const CONFIG = {
  /** Verified against the delivered folder, not assumed:
      "MAIN widerNoUI_00000.webp" … "_00932.webp", 933 files, contiguous,
      2400×1700 canvas. Copied in with the space renamed to an underscore —
      a space in a URL path is legal but a needless footgun. */
  sequence: {
    dir: "/assets/frames2/",
    prefix: "MAIN_widerNoUI_",
    pad: 5,
    ext: "webp",
    firstFrame: 0, // numbering starts at 0
    frameCount: 933, // highest logical frame = 932

    /** Full pixel size of each delivered frame. */
    source: { width: 2400, height: 1700 },

    /** THE AREA THAT MUST ALWAYS BE SEEN.

        Each frame is a 2400×1700 canvas with the real composition inset at
        (240, 310) at 1920×1080. The magenta surround is deliberate BLEED —
        it is there to be cropped away on awkward viewports so that this
        rectangle never is. The designer will replace the magenta with real
        artwork; nothing here changes when they do.

        Measured, not guessed: the magenta/content boundary is a hard pixel
        transition with no anti-aliased blend, identical on frames 0, 350
        and 932. See renderer.ts for how the fit uses it. */
    safeArea: { x: 240, y: 310, width: 1920, height: 1080 },
  },

  /** The resting frames. Add or remove entries freely. */
  stateFrames: [0, 200, 350, 575, 750, 932],

  /** ms per transition, same travelling backward.
      Must be stateFrames.length - 1 entries. */
  transitionDurations: [3200, 2000, 2500, 2200, 2500],

  /** key from ./easing */
  easing: "cinematic" as const,

  input: {
    /** accumulated normalised wheel delta needed to fire one gesture */
    wheelThreshold: 55,
    /** THE anti-momentum value: wheel silence required before the input
        re-arms. Trackpad momentum keeps resetting this, so a single flick
        can never fire twice. Raise it if a trackpad still double-fires. */
    gestureGapMs: 140,
    /** extra lock after a transition lands. It applies only when the run is
        finished — a chained run steps straight on without it. */
    cooldownMs: 250,

    /** 20. CHAINING — what happens when gestures arrive faster than the
        animation can play them.

        One gesture plays its transition in full and rests. Gestures arriving
        mid-flight are no longer dropped, and they do not queue up as separate
        full-length playbacks either: they extend the RUN, and the run
        shortens as its backlog grows, so someone spinning the wheel is
        carried to the end instead of sitting through six transitions in a
        row. Every state is still landed on exactly — the run passes through
        the stops, it does not skip them.

        Each further state still to cover multiplies the duration by
        chainSpeedUp, down to chainMinDurationMs. chainTailFactor shortens the
        last leg of a run that was chained, so a fast run does not end by
        decelerating into a full-length transition. */
    chainSpeedUp: 0.5,
    chainMinDurationMs: 420,
    chainTailFactor: 0.6,

    /** 20. WHEEL REPEATS while the input is disarmed — see input/wheel.ts for
        why disarming exists at all.

        repeatThreshold is how much non-decaying delta must accumulate before
        another gesture fires; repeatMinGapMs is a quiet period after each
        fire during which nothing counts, giving a momentum tail time to start
        decaying; decayTolerance is how much smaller than the delta before it
        a delta may be and still read as the user pushing rather than the
        trackpad coasting. */
    repeatThreshold: 80,
    repeatMinGapMs: 90,
    decayTolerance: 0.97,
    /** px of finger travel for one swipe */
    swipeThreshold: 60,
  },

  loading: {
    /** parallel frame downloads */
    concurrency: 10,
    /** chunks fetched beyond the current one */
    preloadLookahead: 1,
    /** attempts per frame before it is reported as failed */
    retries: 3,
  },

  decode: {
    /** Decoded frames kept alive. At full 2400×1700 a frame is ~16 MB decoded,
        so this is the real memory constraint — not the 72 MB download.
        36 x 16.3 MB is roughly 590 MB. Lower it on mobile. */
    maxDecoded: 36,
    /** frames decoded ahead of the playhead, in the direction of travel */
    aheadFrames: 24,
    /** Parallel createImageBitmap calls. Unbounded decoding thrashes: firing
        45 at once measured ~37/sec where 8 at a time measured ~113/sec. */
    concurrency: 6,
    /** DO NOT set a resize width here.

        createImageBitmap(blob, { resizeWidth }) is ~5x SLOWER than decoding
        at native size — measured on these frames: 15 decodes/sec resizing to
        1920, against 113/sec at full size. Playback needs ~60/sec at 60 Hz,
        so the resize path alone made it choppy. Decode native and let
        drawImage scale on the GPU, which is effectively free. */
    resizeOnDecode: false,
  },

  render: {
    /** cap the backing store on hi-DPI screens */
    maxDPR: 2,

    /** How the frame is fitted to the viewport.

        "safe-cover" THE DEFAULT. Scale until the SAFE AREA COVERS the
                  viewport, so the screen is filled with picture and no
                  magenta shows at all. What does not fit is cropped, within
                  the maxSafeCrop budget; past the budget the bleed returns
                  rather than the composition being gutted. The composition
                  is 16:9, so the crop is whatever it takes to reshape 16:9
                  into the window: 25% of the width at 4:3, 10% at 16:10,
                  nothing at 16:9, 24% of the height at 21:9.

        "safe-fill" Fit the SAFE AREA to the viewport: it touches
                  the left and right edges, or the top and bottom, whichever
                  binds first, and the bleed covers whatever is left. The
                  composition comes out as large as it can be without any of
                  it being lost.

        "cover"   always fill, uniform scale, crop the overflow. Crops BLEED
                  first; only once the bleed runs out does it eat into the
                  safe area. Never distorts. Fills at every aspect — but it
                  sizes the 2400x1700 FRAME, bleed included, so on a 4:3
                  window the composition inside it renders at ~85% of the
                  width safe-fill would give it.

        "safe"    never crop the safe area. Fills while the bleed lasts, then
                  letterboxes rather than cutting into the composition.

        "stretch" always fill by scaling x and y independently. Nothing is
                  ever cropped, but the picture is distorted — at a 16:9
                  viewport this squashes the frame vertically by ~26%.

        The bleed covers aspects 1.13–2.22 (see README). Inside it cover and
        safe coincide and safe-fill simply renders the composition larger;
        outside it — a tall phone, an ultrawide — safe-fill and safe keep the
        composition whole behind bars, while cover crops into it. */
    fit: "safe-fill" as "cover" | "safe" | "stretch" | "safe-fill" | "safe-cover",

    /** How much of the composition "safe-cover" (and "cover") may cut off in
        order to fill the screen. 0 crops nothing and behaves like safe-fill;
        1 crops without limit.

        The composition is 16:9, so the crop needed to cover a window is
        purely a question of that window's shape:

          16:9                  0%     <- already the right shape
          16:10 (1.60)         10%
          4:3   (1.33)         25%
          21:9  (2.33)         24%     <- off the height, not the width
          phone portrait       74%     <- most of the composition gone

        0.3 therefore covers every ordinary desktop and laptop window — the
        full range 1.24 to 2.54 — and stops short only on shapes where
        filling the screen would mean throwing the picture away, which is
        where the magenta legitimately belongs. Raise it toward 1 to fill
        even a phone; the honest fix there is the portrait pass in
        ANIMATION_BRIEF section 5. */
    maxSafeCrop: 0,

    /** "cover", and "safe-fill" when edgeFill is "stretch": after scaling
        uniformly, how far each axis may be
        STRETCHED on its own to close a remaining gap, rather than showing a
        black bar. 1 disables stretching; 1.2 allows up to 20%.

        This exists because the two cases need wildly different amounts:

          ultrawide 2.6   needs ~3%   -> imperceptible, just fills
          phone portrait  needs ~115% -> would be grotesque

        The two axes therefore get different budgets. Horizontal is generous
        because side bars on a wide monitor were explicitly unacceptable and
        the stretch needed is small; vertical is tight because the portrait
        case would need ~115% and a bar is far better than that. */
    maxStretchX: 1.6,
    maxStretchY: 1.5,

    /** "safe-fill" only: what covers the strip the frame cannot reach, on a
        viewport too wide for the bleed (aspect > 2.22) or too tall (< 1.13).

        "extend"  stretch the frame's OUTERMOST PIXELS outward. The picture
                  keeps its exact proportions and simply ends in more bleed.
                  Reads as flat magenta today, because the bleed IS flat; it
                  follows the real artwork once there is any, which a painted
                  colour could not.

        "stretch" scale the whole frame on that axis until it reaches the
                  edge, within maxStretchX/maxStretchY. Fills with real
                  picture, at the cost of distorting it — about 5% at 21:9,
                  about 60% at 32:9. Past the cap the leftover is covered by
                  "extend" rather than left black, so this is "stretch as far
                  as the cap allows, then bleed". Lower maxStretchX to ~1.1 to
                  keep the distortion imperceptible and let the bleed do the
                  rest.

        "black"   leave it black. */
    edgeFill: "stretch" as "extend" | "stretch" | "black",
  },
};

export const LAST_STATE = CONFIG.stateFrames.length - 1;
export const LAST_FRAME = CONFIG.sequence.firstFrame + CONFIG.sequence.frameCount - 1;
