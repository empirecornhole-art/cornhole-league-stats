"use client";

import { useState } from "react";

type Field = "name" | "email" | "interest" | "message";
type Status = "idle" | "sending" | "sent" | "error";

const INPUT =
  "mt-2 w-full rounded-lg border bg-brand-panel px-4 py-3 font-sans text-sm text-brand-text placeholder:text-brand-textFaint focus:border-brand-orange focus:outline-none";

const EMPTY = { name: "", email: "", interest: "", message: "" };

export default function ContactForm() {
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [status, setStatus] = useState<Status>("idle");
  const [formError, setFormError] = useState("");

  function update(field: Field, value: string) {
    setValues((v) => ({ ...v, [field]: value }));
    // Clear a field's error as soon as they start fixing it.
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "sending") return;

    setStatus("sending");
    setFormError("");

    try {
      const website = (new FormData(e.currentTarget).get("website") as string) || "";
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, website }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.ok) {
        setStatus("sent");
        setValues(EMPTY);
        return;
      }

      if (data.errors) setErrors(data.errors);
      setFormError(data.error || (data.errors ? "" : "Something went wrong. Please try again."));
      setStatus("error");
    } catch {
      setFormError("Couldn't reach the server. Check your connection and try again.");
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <div className="flex flex-col items-start gap-4" role="status">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-up/15 text-brand-up">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden>
            <path d="m5 12.5 4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h3 className="heading-card">Message sent</h3>
        <p className="font-sans text-sm text-brand-textSecondary">
          Thanks for reaching out — we&apos;ll get back to you within a couple of days.
        </p>
        <button type="button" onClick={() => setStatus("idle")} className="btn-secondary mt-2">
          Send another
        </button>
      </div>
    );
  }

  const fieldClass = (field: Field) => `${INPUT} ${errors[field] ? "border-brand-down/70" : "border-white/15"}`;
  const errorText = (field: Field) =>
    errors[field] ? (
      <p id={`contact-${field}-error`} className="mt-1.5 font-sans text-sm text-brand-down">
        {errors[field]}
      </p>
    ) : null;
  const a11y = (field: Field) => ({
    "aria-invalid": errors[field] ? true : undefined,
    "aria-describedby": errors[field] ? `contact-${field}-error` : undefined,
  });

  return (
    <form className="flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
      {/* Honeypot: hidden from people and screen readers; bots fill it in. */}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="contact-website">Website</label>
        <input id="contact-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="contact-name" className="field-label">
            Name
          </label>
          <input
            id="contact-name"
            name="name"
            type="text"
            autoComplete="name"
            className={fieldClass("name")}
            placeholder="Jane Doe"
            value={values.name}
            onChange={(e) => update("name", e.target.value)}
            {...a11y("name")}
          />
          {errorText("name")}
        </div>
        <div>
          <label htmlFor="contact-email" className="field-label">
            Email
          </label>
          <input
            id="contact-email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            className={fieldClass("email")}
            placeholder="you@email.com"
            value={values.email}
            onChange={(e) => update("email", e.target.value)}
            {...a11y("email")}
          />
          {errorText("email")}
        </div>
      </div>

      <div>
        <label htmlFor="contact-interest" className="field-label">
          I&apos;m interested in <span className="font-normal text-brand-textFaint">(optional)</span>
        </label>
        <input
          id="contact-interest"
          name="interest"
          type="text"
          className={fieldClass("interest")}
          placeholder="Joining a team, sponsoring an event, ..."
          value={values.interest}
          onChange={(e) => update("interest", e.target.value)}
          {...a11y("interest")}
        />
        {errorText("interest")}
      </div>

      <div>
        <label htmlFor="contact-message" className="field-label">
          Message
        </label>
        <textarea
          id="contact-message"
          name="message"
          rows={5}
          className={fieldClass("message")}
          placeholder="Tell us a bit about what you're looking for..."
          value={values.message}
          onChange={(e) => update("message", e.target.value)}
          {...a11y("message")}
        />
        {errorText("message")}
      </div>

      {formError && (
        <p className="rounded-lg border border-brand-down/30 bg-brand-down/10 px-4 py-3 font-sans text-sm text-brand-down" role="alert">
          {formError}
        </p>
      )}

      <button type="submit" className="btn-primary mt-2 self-start disabled:opacity-60" disabled={status === "sending"}>
        {status === "sending" ? "Sending..." : "Send Message"}
      </button>
    </form>
  );
}
