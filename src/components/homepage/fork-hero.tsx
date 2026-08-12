import Link from "next/link";
import { CheckCircle } from "@phosphor-icons/react/dist/ssr";
import { HeroCTA } from "@/components/ui/hero-cta";
import { HeroSceneStyles, BuilderScene, HirerScene } from "@/components/homepage/hero-scenes";

/**
 * The builder/hirer fork. Used to be the whole hero (headline + stat strip);
 * the headline moved into ProofWallHero and the stat strip died with it, so
 * this is now purely the self-select section that follows the wall.
 */
export function ForkHero() {
  return (
    <section className="relative">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 pb-10">
        <HeroSceneStyles />
        <div className="grid gap-5 sm:grid-cols-2 max-w-4xl mx-auto stagger-children">
          {/* Builder path */}
          <div className="card-brutal p-7 flex flex-col">
            <BuilderScene />
            <h2 className="mt-5 text-2xl font-bold text-[var(--foreground)]">I&apos;m a builder</h2>
            <p className="mt-2 text-[var(--text-secondary)] font-semibold">Build your reputation. Get discovered.</p>
            <ul className="mt-4 space-y-2">
              {["Daily streaks, verified from GitHub", "Shipped projects with quality scores", "A vibe score that gets you hired"].map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm font-medium text-[var(--text-secondary)]">
                  <CheckCircle size={17} weight="fill" className="text-[var(--accent)] shrink-0" /> {f}
                </li>
              ))}
            </ul>
            <HeroCTA className="mt-6 inline-flex w-full justify-center" />
          </div>

          {/* Hiring path */}
          <div className="card-brutal p-7 flex flex-col">
            <HirerScene />
            <h2 className="mt-5 text-2xl font-bold text-[var(--foreground)]">I&apos;m hiring</h2>
            <p className="mt-2 text-[var(--text-secondary)] font-semibold">Hire vibe coders who actually ship.</p>
            <ul className="mt-4 space-y-2">
              {["Ranked by proof of work, not resumes", "Browse by streak, stack & vibe score", "See live projects before you reach out"].map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm font-medium text-[var(--text-secondary)]">
                  <CheckCircle size={17} weight="fill" className="text-[var(--accent)] shrink-0" /> {f}
                </li>
              ))}
            </ul>
            <Link href="/explore" className="btn-brutal btn-brutal-secondary text-base mt-6 w-full justify-center inline-flex">
              Explore Talent
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
