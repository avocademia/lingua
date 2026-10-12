import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import AuthForm from "./auth-form";
import styles from "./auth.module.scss";

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <main className={styles.authPage} aria-busy="true">
          <div className={styles.loadingMessage}>Getting your account ready…</div>
        </main>
      }
    >
      <AuthPageContent />
    </Suspense>
  );
}

async function AuthPageContent() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return <AuthForm />;
}
