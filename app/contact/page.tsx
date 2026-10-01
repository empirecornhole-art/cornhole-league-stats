import FadeIn from "../../components/site/FadeIn";
import { getSiteSettings } from "../../lib/settings";

export const dynamic = "force-dynamic";

function socialHandle(url: string): string {
  if (!url) return "";
  try {
    const path = new URL(url).pathname.replace(/^\/|\/$/g, "");
    return path ? `@${path}` : url;
  } catch {
    return url;
  }
}

export default async function ContactPage() {
  const settings = await getSiteSettings();

  const followLines: string[] = [];
  if (settings.instagram_url || settings.facebook_url) {
    const handles = [
      settings.instagram_url && `${socialHandle(settings.instagram_url)} on Instagram`,
      settings.facebook_url && `${socialHandle(settings.facebook_url)} on Facebook`,
    ].filter(Boolean);
    followLines.push(handles.join(" & "));
  } else {
    followLines.push("Find us on Instagram & Facebook.");
  }

  const infoCards = [
    {
      label: "Email",
      icon: <EmailIcon />,
      lines: [settings.contact_email || "info@empirecornhole.com", "We reply within a couple of days."],
    },
    {
      label: "Where We Play",
      icon: <PinIcon />,
      lines: [settings.venue_name, settings.venue_address].filter(Boolean),
    },
    {
      label: "Follow The League",
      icon: <StarIcon />,
      lines: followLines,
    },
  ];

  return (
    <main className="bg-brand-bg">
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute -top-32 left-1/2 h-[300px] w-[360px] -translate-x-1/2 rounded-full bg-brand-orange/20 blur-[90px] md:h-[420px] md:w-[720px] md:blur-[120px]"
          aria-hidden
        />
        <FadeIn className="relative mx-auto max-w-4xl px-4 py-16 text-center md:px-6 md:py-28">
          <span className="font-sans text-xs font-bold uppercase tracking-widest text-brand-textMuted">
            Get In Touch
          </span>
          <h1 className="mt-4 font-display text-5xl uppercase text-brand-text md:text-7xl">Join the League</h1>
          <p className="mt-5 font-sans text-brand-textSecondary">
            Questions about a season, a team, or just want to say hi? Reach out below.
          </p>
        </FadeIn>
      </section>

      <section className="bg-brand-panel">
        <FadeIn className="mx-auto max-w-6xl px-4 py-16 md:px-6">
          <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
            <div className="flex flex-col gap-4">
              {infoCards.map((card) => (
                <div key={card.label} className="flex gap-4 rounded-2xl border border-white/10 bg-brand-bg p-6">
                  <div className="flex h-12 w-12 flex-none items-center justify-center rounded-xl bg-gradient-to-br from-brand-orange to-brand-orangeHover">
                    {card.icon}
                  </div>
                  <div>
                    <h3 className="font-display text-lg uppercase text-brand-text">{card.label}</h3>
                    {card.lines.map((line) => (
                      <p key={line} className="mt-1 font-sans text-sm text-brand-textSecondary">
                        {line}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-white/10 bg-brand-bg p-6 md:p-8">
              {/* TODO: wire form submission (API route or email service) */}
              <form className="flex flex-col gap-5">
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div>
                    <label className="font-sans text-xs font-bold uppercase tracking-widest text-brand-textMuted">
                      Name
                    </label>
                    <input
                      type="text"
                      className="mt-2 w-full rounded-lg border border-white/10 bg-brand-panel px-4 py-3 font-sans text-sm text-brand-text placeholder:text-brand-textFaint focus:border-brand-orange focus:outline-none"
                      placeholder="Jane Doe"
                    />
                  </div>
                  <div>
                    <label className="font-sans text-xs font-bold uppercase tracking-widest text-brand-textMuted">
                      Email
                    </label>
                    <input
                      type="email"
                      className="mt-2 w-full rounded-lg border border-white/10 bg-brand-panel px-4 py-3 font-sans text-sm text-brand-text placeholder:text-brand-textFaint focus:border-brand-orange focus:outline-none"
                      placeholder="you@email.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-sans text-xs font-bold uppercase tracking-widest text-brand-textMuted">
                    I&apos;m Interested In
                  </label>
                  <input
                    type="text"
                    className="mt-2 w-full rounded-lg border border-white/10 bg-brand-panel px-4 py-3 font-sans text-sm text-brand-text placeholder:text-brand-textFaint focus:border-brand-orange focus:outline-none"
                    placeholder="Joining a team, sponsoring an event, ..."
                  />
                </div>

                <div>
                  <label className="font-sans text-xs font-bold uppercase tracking-widest text-brand-textMuted">
                    Message
                  </label>
                  <textarea
                    rows={5}
                    className="mt-2 w-full rounded-lg border border-white/10 bg-brand-panel px-4 py-3 font-sans text-sm text-brand-text placeholder:text-brand-textFaint focus:border-brand-orange focus:outline-none"
                    placeholder="Tell us a bit about what you're looking for..."
                  />
                </div>

                <button type="button" className="btn-primary mt-2 self-start">
                  Send Message
                </button>
              </form>
            </div>
          </div>
        </FadeIn>
      </section>
    </main>
  );
}

function EmailIcon() {
  return (
    <div className="h-5 w-5 rounded-sm border-2 border-brand-bg" style={{ clipPath: "polygon(0 0,100% 0,100% 100%,0 100%)" }}>
      <div
        className="h-full w-full border-b-2 border-brand-bg"
        style={{ clipPath: "polygon(0 0, 50% 55%, 100% 0)" }}
      />
    </div>
  );
}

function PinIcon() {
  return (
    <div
      className="h-5 w-5 bg-brand-bg"
      style={{ clipPath: "polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)" }}
    />
  );
}

function StarIcon() {
  return (
    <div
      className="h-5 w-5 bg-brand-bg"
      style={{
        clipPath:
          "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)",
      }}
    />
  );
}
