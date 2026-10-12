"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "./dashboard.module.scss";

export default function DashboardActions() {
  const router = useRouter();
  const [error, setError] = useState("");

  async function logOut() {
    setError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Could not log out. Please try again.");
      router.replace("/auth");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not log out. Please try again.");
    }
  }

  return (
    <div className={styles.accountActions}>
      <Link className={styles.navLink} href="/verbs">Practice</Link>
      <button className={styles.logoutButton} onClick={() => void logOut()} type="button">Log out</button>
      {error && <span className={styles.actionError} role="alert">{error}</span>}
    </div>
  );
}
