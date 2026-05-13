import { HeroCTAClient } from "./hero-cta-client";

// Render with a logged-out initial state and let HeroCTAClient resolve auth
// client-side. Calling `getCurrentUser()` here reads cookies during SSR, which
// marks the homepage as dynamic and bypasses the `revalidate = 60` ISR cache —
// every visit then pays the full origin round-trip. The brief CTA label swap
// for logged-in users on hard refresh is an acceptable cost for letting the
// page render from edge cache.
export function HeroCTA(props: { className?: string; style?: React.CSSProperties }) {
  return <HeroCTAClient {...props} initialIsLoggedIn={false} />;
}
