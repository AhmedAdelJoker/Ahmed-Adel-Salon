import PublicBooking from "./PublicBooking";

/**
 * SchedulePage — alias for the public booking flow.
 *
 * The old `.jsx` version imported `../cashier/Bookings`, a module that only
 * exists in the staff `frontend` app, so the page could never compile inside
 * `public-site`. The schedule IS the booking flow here, so this page simply
 * reuses it. It is routed at `/schedule` and `/salon/:publicSlug/schedule`
 * as a legacy alias (see App.tsx).
 */
export default function SchedulePage() {
  return <PublicBooking />;
}
