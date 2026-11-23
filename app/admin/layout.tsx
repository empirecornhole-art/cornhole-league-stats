import type { Metadata } from "next";

// The admin page is a client component, so its robots directive lives here.
export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
