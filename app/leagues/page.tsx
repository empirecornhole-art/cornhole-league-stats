import { Suspense } from "react";
import LeagueClient, { LoadingSkeleton } from "../../components/LeagueClient";

export default function LeaguePage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <LeagueClient />
    </Suspense>
  );
}
