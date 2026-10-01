import FadeIn from "../../components/site/FadeIn";
import { getSiteSettings } from "../../lib/settings";
import { MailIcon, PinIcon, UsersIcon } from "../../components/site/Icons";

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
      icon: <MailIcon />,
      lines: [settings.contact_email || "info@empirecornhole.com", "We reply within a couple of days."],
    },
    {
      label: "Where We Play",
      icon: <PinIcon />,
      lines: [settings.venue_name, settings.venue_address].filter(Boolean),
    },
    {
      label: "Follow The League",
      icon: <UsersIcon />,
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
          <span className="eyebrow">
            Get In Touch
          </span>
          <h1 className="heading-page mt-4">Join the League</h1>
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
                  <div className="flex h-12 w-12 flex-none items-center justify-center rounded-xl bg-gradient-to-br from-brand-orange to-brand-orangeHover text-brand-bg">
                    {card.icon}
                  </div>
                  <div>
                    <h3 className="heading-card">{card.label}</h3>
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
                    <label htmlFor="contact-name" className="field-label">
                      Name
                    </label>
                    <input
                      id="contact-name"
                      name="name"
                      type="text"
                      className="mt-2 w-full rounded-lg border border-white/10 bg-brand-panel px-4 py-3 font-sans text-sm text-brand-text placeholder:text-brand-textFaint focus:border-brand-orange focus:outline-none"
                      placeholder="Jane Doe"
                    />
                  </div>
                  <div>
                    <label htmlFor="contact-email" className="field-label">
                      Email
                    </label>
                    <input
                      id="contact-email"
                      name="email"
                      type="email"
                      className="mt-2 w-full rounded-lg border border-white/10 bg-brand-panel px-4 py-3 font-sans text-sm text-brand-text placeholder:text-brand-textFaint focus:border-brand-orange focus:outline-none"
                      placeholder="you@email.com"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="contact-interest" className="field-label">
                    I&apos;m Interested In
                  </label>
                  <input
                    id="contact-interest"
                    name="interest"
                    type="text"
                    className="mt-2 w-full rounded-lg border border-white/10 bg-brand-panel px-4 py-3 font-sans text-sm text-brand-text placeholder:text-brand-textFaint focus:border-brand-orange focus:outline-none"
                    placeholder="Joining a team, sponsoring an event, ..."
                  />
                </div>

                <div>
                  <label htmlFor="contact-message" className="field-label">
                    Message
                  </label>
                  <textarea
                    id="contact-message"
                    name="message"
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

