"use client";

import { useState } from "react";

interface Testimonial {
  name: string;
  handle: string;
  text: string;
  url: string;
}

const testimonials: Testimonial[] = [
  { name: "starfish", handle: "@firefincher", text: "Design - amazing, idea - amazing, utility - amazing. This is huge bro, 10/10 product. \"Proof of work\" >>>>>>>", url: "https://x.com/firefincher/status/2036128816201097667" },
  { name: "skiv", handle: "@skivthecreator", text: "Ayo crazy man, bro's making big moves. Signing up right now!!", url: "https://x.com/skivthecreator/status/2036330803857428488" },
  { name: "Shivani", handle: "@baeincrypto", text: "Woahhh this is hugeeeee!!! Signing up nowwww", url: "https://x.com/baeincrypto/status/2036292728909418940" },
  { name: "Medusa", handle: "@MedusaOnchain", text: "This looks so good! I'm def gonna check it out and give feedback", url: "https://x.com/MedusaOnchain/status/2036069840000344353" },
  { name: "Valerie", handle: "@Valerie_Onchain", text: "Damnnn it looks soooo good", url: "https://x.com/Valerie_Onchain/status/2036072148054495659" },
  { name: "Manish", handle: "@Web3Manish", text: "You shipped a cool product bro, let me create a profile there", url: "https://x.com/Web3Manish/status/2036069579571744849" },
  { name: "Rivon", handle: "@rivon_xyz", text: "Bro's cooking, nice to see you win bro LFG", url: "https://x.com/rivon_xyz/status/2036277687862567096" },
  { name: "Palak", handle: "@0xpalak_21", text: "Just created my profile. You did an amazing work", url: "https://x.com/0xpalak_21/status/2036085639788335155" },
  { name: "Susanoo", handle: "@SusanooSOL", text: "You're on to something good here", url: "https://x.com/SusanooSOL/status/2037029573247066176" },
  { name: "NOAH", handle: "@DowneyRoadson", text: "Crazyyy work! I just saw it, will be checking this website", url: "https://x.com/DowneyRoadson/status/2036995870399619385" },
  { name: "Czyzu", handle: "@0xCzyzu", text: "Great design bro, catches the eye. Keep it up!", url: "https://x.com/0xCzyzu/status/2036129032626974940" },
  { name: "CATI", handle: "@0x_cati", text: "Banger product bro, going to check it!", url: "https://x.com/0x_cati/status/2036076705685860533" },
  { name: "Teju", handle: "@web3verses", text: "Creating my profile right away! This is amazing", url: "https://x.com/web3verses/status/2036327347486617742" },
  { name: "Sona", handle: "@SheTalksCrypto", text: "That's a cool one there abhi", url: "https://x.com/SheTalksCrypto/status/2036714834457153739" },
  { name: "ginny", handle: "@0xginnny", text: "Gonna check it out, looks so good!", url: "https://x.com/0xginnny/status/2036389828393312751" },
  { name: "Auza", handle: "@_Auza_", text: "Best platform for Vibecoders", url: "https://x.com/_Auza_/status/2036070020829356054" },
  { name: "hitman42.eth", handle: "@ihitman42", text: "Impressive abhinav", url: "https://x.com/ihitman42/status/2036306719308132818" },
  { name: "Sakata", handle: "@0x_sakata", text: "Cooooool stuffs brother <3", url: "https://x.com/SakataYasha/status/2036081233906881011" },
  { name: "NoahAI", handle: "@TryNoahAI", text: "Great job abhinav", url: "https://x.com/TryNoahAI/status/2036127330473509271" },
  { name: "GUJJU", handle: "@GUJJUIIXI", text: "Ayooo love it legend", url: "https://x.com/GUJJUIIXI/status/2036147217552355601" },
  { name: "L3o", handle: "@GadgetLeo", text: "Good theme, I like it", url: "https://x.com/GadgetLeo/status/2036069472591905074" },
  { name: "deRadar", handle: "@deRadar_", text: "Good work chad.", url: "https://x.com/deRadar_/status/2036238052536746200" },
  { name: "Ishika", handle: "@0xIshika", text: "So good", url: "https://x.com/0xIshika/status/2036289606614917493" },
  { name: "pankaj.eth", handle: "@itspankaj0718", text: "Cool product bro", url: "https://x.com/itspankaj0718/status/2036249143610581343" },
];

export function TestimonialScroll() {
  const [isPaused, setIsPaused] = useState(false);

  const cards = [...testimonials, ...testimonials];

  return (
    <div
      className="relative overflow-hidden"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div
        className="flex gap-5"
        style={{
          animation: "testimonial-scroll 180s linear infinite",
          animationPlayState: isPaused ? "paused" : "running",
          width: "max-content",
        }}
      >
        {cards.map((t, i) => (
          <a
            key={`${t.handle}-${i}`}
            href={t.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 w-[420px] p-7 flex flex-col gap-4 transition-all hover:translate-y-[-2px]"
            style={{
              backgroundColor: "#FFFFFF",
              border: "2px solid #0F0F0F",
              boxShadow: "4px 4px 0 #0F0F0F",
            }}
          >
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://unavatar.io/twitter/${t.handle.replace("@", "")}`}
                alt={t.name}
                width={48}
                height={48}
                className="w-[48px] h-[48px] shrink-0 object-cover rounded-sm"
                style={{ border: "2px solid #0F0F0F" }}
                onError={(e) => {
                  const el = e.currentTarget;
                  el.style.display = "none";
                  const fallback = el.nextElementSibling as HTMLElement;
                  if (fallback) fallback.style.display = "flex";
                }}
              />
              <div
                className="w-[48px] h-[48px] items-center justify-center text-sm font-extrabold text-white shrink-0 hidden"
                style={{ backgroundColor: "#0F0F0F" }}
              >
                {t.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-extrabold text-[#0F0F0F] truncate">{t.name}</div>
                <div className="text-xs font-medium text-[#71717A] truncate">{t.handle}</div>
              </div>
              <svg className="ml-auto shrink-0 text-[#71717A]" width={14} height={14} viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            </div>
            <p className="text-base text-[#3F3F46] font-medium leading-relaxed line-clamp-3">
              &ldquo;{t.text}&rdquo;
            </p>
          </a>
        ))}
      </div>

      <style>{`
        @keyframes testimonial-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
