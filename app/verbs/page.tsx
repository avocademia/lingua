import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import PracticeClient from "./practice-client";
import styles from "./verbs.module.scss";

export default function VerbsPage() {
  return (
    <Suspense
      fallback={
        <main className={styles.practicePage} aria-busy="true">
          <div className={styles.practiceLoading}>Getting your practice ready…</div>
        </main>
      }
    >
      <VerbsPageContent />
    </Suspense>
  );
}

async function VerbsPageContent() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth");

  return <PracticeClient username={user.username} />;
}
