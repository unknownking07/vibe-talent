import Link from "next/link";
import { CheckCircle } from "@phosphor-icons/react/dist/ssr";
import { HeroCTA } from "@/components/ui/hero-cta";
import {
  HeroSceneStyles,
  BuilderScene,
  HirerScene,
} from "@/components/homepage/hero-scenes";

/**
 * The builder/hirer fork. Used to be the whole hero (headline + stat strip);
 * the headline moved into ProofWallHero and the stat strip died with it, so
 * this is now purely the self-select section that follows the wall.
 *
 * Hiring leads, matching the hero. VibeTalent is sold as a hiring platform and
 * demand is the scarce side, so hirers get the primary card here — listed
 * first, accent CTA, brighter surface — exactly as they get the accent button
 * above. The builder card stays the quieter second option.
 *
 * This section expands a choice the hero has already offered: its primary
 * "Hire builders" button points at the same /explore route as this card, and
 * its secondary at the same signup as the other. Keep the two in sync — if the
 * hero loses that pairing, this stops being the detailed version of a question
 * already asked and goes back to interrupting the page with "who are you?".
 */
export function ForkHero() {
  return (
    <section className="relative">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 pb-10">
        <HeroSceneStyles />
        <div className="grid gap-5 sm:grid-cols-2 max-w-4xl mx-auto stagger-children">
          {/* Hiring path — primary */}
          <div
            className="p-7 flex flex-col rounded-2xl"
            style={{
              backgroundColor: "var(--bg-surface)",
              border: "1px solid var(--accent)",
              boxShadow: "var(--shadow-brutal-accent)",
            }}
          >
            <HirerScene />
            <h2 className="mt-5 text-2xl font-bold text-[var(--foreground)]">
              I&apos;m hiring
            </h2>
            <p className="mt-2 text-[var(--text-secondary)] font-semibold">
              Hire vibe coders who actually ship.
            </p>
            <ul className="mt-4 space-y-2">
              {[
                "Ranked by proof of work, not resumes",
                "Browse by streak, stack & vibe score",
                "See live projects before you reach out",
              ].map((f) => (
                <li
                  key={f}
                  className="flex items-center gap-2 text-sm font-medium text-[var(--text-secondary)]"
                >
                  <CheckCircle
                    size={17}
                    weight="fill"
                    className="text-[var(--accent)] shrink-0"
                  />{" "}
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href="/explore"
              className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-xl text-sm font-semibold text-white transition-[background-color,transform] hover:bg-[var(--accent-hover)] active:scale-[0.98]"
              style={{ backgroundColor: "var(--accent)" }}
            >
              Explore Talent
            </Link>
          </div>

          {/* Builder path — secondary; the hero CTA already covers this intent */}
          <div
            className="p-7 flex flex-col rounded-2xl"
            style={{
              backgroundColor: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              boxShadow: "var(--shadow-brutal-sm)",
            }}
          >
            <BuilderScene />
            <h2 className="mt-5 text-2xl font-bold text-[var(--foreground)]">
              I&apos;m a builder
            </h2>
            <p className="mt-2 text-[var(--text-secondary)] font-semibold">
              Build your reputation. Get discovered.
            </p>
            <ul className="mt-4 space-y-2">
              {[
                "Daily streaks, verified from GitHub",
                "Shipped projects with quality scores",
                "A vibe score that gets you hired",
              ].map((f) => (
                <li
                  key={f}
                  className="flex items-center gap-2 text-sm font-medium text-[var(--text-secondary)]"
                >
                  <CheckCircle
                    size={17}
                    weight="fill"
                    className="text-[var(--accent)] shrink-0"
                  />{" "}
                  {f}
                </li>
              ))}
            </ul>
            <HeroCTA className="mt-6 inline-flex w-full justify-center" />
          </div>
        </div>
      </div>
    </section>
  );
}
