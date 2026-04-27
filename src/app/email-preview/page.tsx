import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { renderAllEmailPreviews } from "@/lib/email";

export const dynamic = "force-dynamic";
export const metadata = { title: "Email preview", robots: { index: false, follow: false } };

const LOOPBACK_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/;

function safeLoopbackOrigin(host: string | null): string | undefined {
  if (!host || !LOOPBACK_HOST.test(host)) return undefined;
  return `http://${host}`;
}

export default async function EmailPreviewPage() {
  const allowed =
    process.env.NODE_ENV === "development" ||
    process.env.ALLOW_EMAIL_PREVIEW === "1";
  if (!allowed) notFound();

  const h = await headers();
  const previewOrigin = safeLoopbackOrigin(h.get("host"));
  const samples = renderAllEmailPreviews(previewOrigin ? { logoUrl: `${previewOrigin}/logo.png` } : undefined);

  return (
    <div style={{ background: "#0F0F0F", minHeight: "100vh", padding: "32px 24px 80px", fontFamily: "'Space Grotesk', system-ui, sans-serif", color: "#FAFAFA" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <header style={{ marginBottom: 32, paddingBottom: 24, borderBottom: "1px solid #2A2A2A" }}>
          <p style={{ margin: "0 0 6px", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "#FF3A00" }}>
            Internal · dev only
          </p>
          <h1 style={{ margin: "0 0 8px", fontSize: 32, fontWeight: 600, letterSpacing: "-0.02em" }}>
            Email previews
          </h1>
          <p style={{ margin: 0, fontSize: 15, color: "#999", maxWidth: 640, lineHeight: 1.6 }}>
            All {samples.length} transactional emails rendered with sample data. Each iframe is a real
            email HTML document — what users actually see in Gmail / Outlook / Apple Mail.
          </p>
        </header>

        <nav style={{ marginBottom: 32, display: "flex", flexWrap: "wrap", gap: 8 }}>
          {samples.map((s) => (
            <a
              key={s.key}
              href={`#${s.key}`}
              style={{
                padding: "6px 12px",
                fontSize: 12,
                fontFamily: "'JetBrains Mono', monospace",
                border: "1px solid #2A2A2A",
                color: "#DDD",
                textDecoration: "none",
                borderRadius: 0,
              }}
            >
              {s.label}
            </a>
          ))}
        </nav>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(620px, 1fr))", gap: 32 }}>
          {samples.map((s) => (
            <section key={s.key} id={s.key}>
              <div style={{ marginBottom: 12 }}>
                <p style={{ margin: "0 0 4px", fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "#888" }}>
                  {s.label}
                </p>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#FAFAFA" }}>
                  {s.subject}
                </p>
              </div>
              <iframe
                title={s.label}
                srcDoc={s.html}
                sandbox="allow-same-origin"
                style={{
                  width: "100%",
                  height: 760,
                  border: "1px solid #2A2A2A",
                  background: "#F7F6F3",
                }}
              />
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
