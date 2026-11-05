import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import SettingsClient from "./settings-client";
import styles from "./settings.module.scss";

export const metadata: Metadata = {
  title: "Account settings — Lingua",
  description: "Update your account details and password.",
};

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <main className={styles.settingsPage} aria-busy="true">
          <div className={styles.loading}>Loading your settings…</div>
        </main>
      }
    >
      <SettingsContent />
    </Suspense>
  );
}

async function SettingsContent() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth");

  return <SettingsClient user={user} />;
}
