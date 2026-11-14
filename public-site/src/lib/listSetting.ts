/**
 * Reading a list-valued setting under either spelling.
 *
 * ## The failure this prevents
 *
 * `booking-catalog` forwards every setting snake_cased (`landing_stats`,
 * `landing_features`, `landing_trust_badges`, `landing_testimonials`,
 * `landing_portfolio`) because that is how the rest of its payload is shaped.
 * `publicSiteContent` read all five in camelCase, matching how the admin panel
 * writes them.
 *
 * The owner's values arrived, were assigned to a variable nobody read, and the
 * sections rendered empty. Nothing raised and nothing was logged: an owner who
 * filled in their stats, features, testimonials and gallery saw a
 * correct-looking page with all of it missing while the settings panel reported
 * every edit as saved.
 *
 * This lives in its own module with no imports so it can be tested directly --
 * `publicSiteContent` pulls in the API client and the asset resolver, and
 * loading that chain under `node --test` needs the bundler's resolver rather
 * than Node's.
 */

/**
 * @param settings The forwarded settings payload.
 * @param key     The camelCase key as the admin panel writes it.
 * @returns the array, whichever spelling carried it; `undefined` when neither
 *   holds a list, so a caller can distinguish "not configured" from "configured
 *   empty" with an `Array.isArray` on the result.
 */
export function listSetting(
  settings: Record<string, unknown>,
  key: string,
): unknown {
  const camel = settings[key];
  if (Array.isArray(camel)) return camel;

  const snake = settings[key.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase()];
  return Array.isArray(snake) ? snake : undefined;
}

/** `listSetting` narrowed to the array case, for spread and `.map` callers. */
export function listSettingArray(
  settings: Record<string, unknown>,
  key: string,
): unknown[] {
  const value = listSetting(settings, key);
  return Array.isArray(value) ? value : [];
}