import { PageShell } from "@/components/shared/PageShell";
import { AppearancePanel } from "@/components/shared/AppearancePanel";

/**
 * Appearance — light/dark plus the v2 accent, density, motion and contrast
 * controls.
 *
 * Deliberately a thin wrapper. `AppearancePanel` owns the heading, the copy and
 * the reset action for the whole surface, because the panel is also embedded in
 * the owner settings tabs; giving the page its own header meant the word
 * "Appearance" rendered twice, once as the page title and once as the panel
 * title, with the descriptions stacked on top of each other.
 *
 * The component split follows where the data lives, not where the pixels are:
 *   theme    → the profile, so it follows the person across devices
 *   accent   → localStorage, because it is a branding choice, not a preference
 *   density  → localStorage, because it describes the screen
 *   motion   → localStorage, and always yields to the OS reduced-motion request
 *   contrast → localStorage, because it is an accessibility need of the device
 */
export default function AppearancePage() {
  return (
    <PageShell>
      <AppearancePanel />
    </PageShell>
  );
}
