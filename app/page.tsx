import { Suspense } from "react";
import LeagueClient from "../components/LeagueClient";

export default function Home() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-black p-6 text-white">Loading League Stats...</main>}>
      <LeagueClient />
    </Suspense>
  );
}
