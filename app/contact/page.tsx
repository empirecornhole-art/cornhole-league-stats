import HeroThreads from "../../components/site/HeroThreads";
import FadeIn from "../../components/site/FadeIn";
import ContactForm from "../../components/site/ContactForm";
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

  const mapsUrl = settings.venue_address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([settings.venue_name, settings.venue_address].filter(Boolean).join(", "))}`
    : "";
  const email = settings.contact_email || "info@empirecornhole.com";

  type Row = { label: string; icon: React.ReactNode; lines: { text: string; href?: string }[]; note?: string };
  const rows: Row[] = [
    {
      label: "Email",
      icon: <MailIcon />,
      lines: [{ text: email, href: `mailto:${email}` }],
      note: "We reply within a couple of days.",
    },
    {
      label: "Where we play",
      icon: <PinIcon />,
      lines: [settings.venue_name, settings.venue_address].filter(Boolean).map((text) => ({ text, href: mapsUrl || undefined })),
      note: mapsUrl ? "Tap for directions." : undefined,
    },
    {
      label: "Follow the league",
      icon: <UsersIcon />,
      lines: [
        settings.instagram_url && { text: `${socialHandle(settings.instagram_url)} on Instagram`, href: settings.instagram_url },
        settings.facebook_url && { text: `${socialHandle(settings.facebook_url)} on Facebook`, href: settings.facebook_url },
      ].filter(Boolean) as { text: string; href?: string }[],
      note: settings.instagram_url || settings.facebook_url ? undefined : "Find us on Instagram & Facebook.",
    },
  ].filter((row) => row.lines.length > 0 || row.note);

  return (
    <main className="bg-brand-bg">
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute -top-32 left-1/2 h-[300px] w-[360px] -translate-x-1/2 rounded-full bg-brand-orange/20 blur-[90px] md:h-[420px] md:w-[720px] md:blur-[120px]"
          aria-hidden
        />
        <HeroThreads />
        <FadeIn className="relative mx-auto max-w-4xl px-4 py-14 text-center md:px-6 md:py-24">
          <span className="eyebrow">Get in touch</span>
          <h1 className="heading-page mt-4">Join the league</h1>
          <p className="mx-auto mt-5 max-w-xl font-sans text-lg text-brand-textSecondary">
            Questions about a season, a team, or just want to say hi? Reach out below.
          </p>
        </FadeIn>
      </section>

      <section className="bg-brand-bg">
        <FadeIn className="mx-auto max-w-6xl px-4 pb-20 pt-4 md:px-6 md:pb-28">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-14">
            <div className="lg:col-span-5">
              <ul className="space-y-8">
                {rows.map((row) => (
                  <li key={row.label} data-cascade className="flex gap-4">
                    <div className="flex h-12 w-12 flex-none items-center justify-center rounded-2xl bg-brand-panel text-brand-orange">{row.icon}</div>
                    <div className="min-w-0">
                      <h2 className="eyebrow">{row.label}</h2>
                      {row.lines.map((line) => (
                        <p key={line.text} className="mt-1.5 break-words font-sans text-lg font-semibold text-brand-text">
                          {line.href ? (
                            <a
                              href={line.href}
                              {...(line.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                              className="underline decoration-white/25 underline-offset-4 transition-colors duration-150 hover:text-brand-orange hover:decoration-brand-orange"
                            >
                              {line.text}
                            </a>
                          ) : (
                            line.text
                          )}
                        </p>
                      ))}
                      {row.note && <p className="mt-1.5 font-sans text-sm text-brand-textMuted">{row.note}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div data-cascade className="rounded-3xl bg-brand-panel p-6 md:p-10 lg:col-span-7">
              <ContactForm />
            </div>
          </div>
        </FadeIn>
      </section>
    </main>
  );
}
