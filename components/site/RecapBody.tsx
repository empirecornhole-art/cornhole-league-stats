import { Fragment } from "react";

/**
 * Renders a saved recap (plain text with emoji section headings, written to be
 * pasted into Facebook) as a readable page section: a clear title, section
 * headings in the display font, lists as rows, event stats as a small grid,
 * and a comfortable line length. The stored text is never changed.
 */

type Section = { kind: "title" | "divider" | "section" | "para"; heading?: string; lines: string[] };

const EMOJI_START = /^\p{Extended_Pictographic}/u;
const LIST_START = /^(•|\p{Extended_Pictographic}|\d)/u;

function parse(text: string): Section[] {
  const blocks = text.replace(/\r/g, "").split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return blocks.map((block): Section => {
    if (/^━+$/.test(block)) return { kind: "divider", lines: [] };
    const lines = block.split("\n").map((l) => l.trimEnd());
    const first = lines[0];
    if (lines.length === 1 && /^🏆.*🏆$/u.test(first)) return { kind: "title", heading: first.replace(/🏆/gu, "").trim(), lines: [] };
    if (lines.length > 1 && EMOJI_START.test(first) && first.length <= 70 && !/[.!?]$/.test(first)) {
      return { kind: "section", heading: first, lines: lines.slice(1) };
    }
    return { kind: "para", lines };
  });
}

function Stat({ label, value }: { label: string; value: string }) {
  const wide = value.length > 30;
  return (
    <div className={`rounded-lg border border-white/10 bg-brand-bg px-3 py-2 ${wide ? "col-span-full" : ""}`}>
      {label && <div className="text-xs uppercase tracking-wide text-brand-textMuted">{label}</div>}
      <div className="font-display text-lg leading-snug text-brand-text">{value}</div>
    </div>
  );
}

function statFromBullet(line: string) {
  const t = line.replace(/^•\s*/, "");
  const bags = t.match(/^Bags in: (\S+) \| on: (\S+) \| off: (\S+)/);
  if (bags) return { label: "Bags in · on · off", value: `${bags[1]} · ${bags[2]} · ${bags[3]}` };
  const i = t.indexOf(": ");
  return i > 0 ? { label: t.slice(0, i), value: t.slice(i + 2) } : { label: "", value: t };
}

function Lines({ lines }: { lines: string[] }) {
  // Consecutive list-style lines become one list; other lines stay paragraphs.
  const groups: { list: boolean; items: string[] }[] = [];
  for (const line of lines) {
    const list = LIST_START.test(line) && line.length < 140;
    const last = groups[groups.length - 1];
    if (last && last.list === list) last.items.push(line);
    else groups.push({ list, items: [line] });
  }
  return (
    <>
      {groups.map((g, i) =>
        g.list ? (
          <ul key={i} className="space-y-1 text-[0.9375rem] leading-relaxed text-brand-textSecondary">
            {g.items.map((item, j) => (
              <li key={j}>{item}</li>
            ))}
          </ul>
        ) : (
          <Fragment key={i}>
            {g.items.map((item, j) => (
              <p key={j} className="text-[0.9375rem] leading-relaxed text-brand-textSecondary">
                {item}
              </p>
            ))}
          </Fragment>
        )
      )}
    </>
  );
}

function LinkLine({ line }: { line: string }) {
  const m = line.match(/^(Full standings|Full bracket):\s*(https?:\/\/\S+)$/i);
  if (!m) return null;
  return (
    <a href={m[2]} target="_blank" rel="noreferrer" className="inline-block font-semibold text-brand-orange underline-offset-4 hover:underline">
      {m[1]} &rarr;
    </a>
  );
}

export default function RecapBody({ text }: { text: string }) {
  const sections = parse(text);
  return (
    <div className="max-w-[68ch] space-y-6">
      {sections.map((s, i) => {
        if (s.kind === "divider") return <hr key={i} className="border-white/10" />;

        if (s.kind === "title") {
          return (
            <h3 key={i} className="font-display text-xl uppercase leading-tight text-brand-text md:text-2xl">
              {s.heading}
            </h3>
          );
        }

        if (s.kind === "section") {
          const isStats = /event stats/i.test(s.heading || "");
          const bullets = s.lines.filter((l) => l.startsWith("•"));
          return (
            <section key={i} className="space-y-2">
              <h4 className="font-display text-base uppercase tracking-wide text-brand-orange">{s.heading}</h4>
              {isStats && bullets.length === s.lines.length ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {bullets.map((b, j) => {
                    const stat = statFromBullet(b);
                    return <Stat key={j} label={stat.label} value={stat.value} />;
                  })}
                </div>
              ) : (
                <Lines lines={s.lines} />
              )}
            </section>
          );
        }

        // Plain paragraph block (intro, notes, links)
        const link = s.lines.length === 1 ? <LinkLine line={s.lines[0]} /> : null;
        return link && /^(Full standings|Full bracket):/i.test(s.lines[0]) ? (
          <div key={i}>{link}</div>
        ) : (
          <div key={i} className="space-y-2">
            <Lines lines={s.lines} />
          </div>
        );
      })}
    </div>
  );
}
