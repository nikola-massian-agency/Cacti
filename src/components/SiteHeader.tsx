/* =========================================================================
   19. SITE HEADER — the brand mark, drawn live over the sequence.

   The delivered frames still have the logo burned into the picture; the
   clean plates asked for in ANIMATION_BRIEF §1 will not, and the site draws
   it instead. Same chrome layer as the progress rail: over the canvas,
   revealed with it, and never in the way of a gesture.
   ========================================================================= */

export default function SiteHeader({ visible }: { visible: boolean }) {
  return (
    <header className={`siteHead${visible ? "" : " siteHeadHidden"}`}>
      {/* eslint-disable-next-line @next/next/no-img-element --
          A fixed-size vector mark. next/image would route it through the
          image optimiser, which refuses SVG unless dangerouslyAllowSVG is
          on, and there is nothing to optimise in 12 KB of paths. */}
      <img className="siteLogo" src="/assets/cacti-logo.svg" alt="CACTI" />
    </header>
  );
}
