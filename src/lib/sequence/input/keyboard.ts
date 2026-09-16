/* =========================================================================
   10 + 16. KEYBOARD — ArrowDown / Space = next, ArrowUp = previous,
   D toggles the debug overlay. Obeys the same lock as every other input,
   and auto-repeat is ignored so holding a key cannot walk the states.
   ========================================================================= */

export function attachKeyboard(
  onGesture: (dir: number) => void,
  onToggleDebug: () => void,
): () => void {
  const onKey = (e: KeyboardEvent) => {
    if (e.repeat) return; // holding the key must not queue states

    switch (e.key) {
      case "ArrowDown":
      case " ":
      case "Spacebar":
        e.preventDefault();
        onGesture(1);
        break;
      case "ArrowUp":
        e.preventDefault();
        onGesture(-1);
        break;
      case "d":
      case "D":
        onToggleDebug();
        break;
    }
  };

  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
}
