"use client";

import { useState } from "react";
import Link from "next/link";
import styles from "./settings.module.scss";

interface User {
  id: string;
  email: string;
  username: string;
}

export default function SettingsClient({ user }: { user: User }) {
  const [email, setEmail] = useState(user.email);
  const [username, setUsername] = useState(user.username);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  async function updateProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileError("");
    setProfileSuccess("");
    setIsUpdatingProfile(true);

    try {
      const response = await fetch("/api/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, username }),
      });
      const result = (await response.json()) as { error?: string; user?: User };
      if (!response.ok) throw new Error(result.error ?? "Something went wrong. Please try again.");
      setProfileSuccess("Profile updated successfully!");
      if (result.user) {
        setEmail(result.user.email);
        setUsername(result.user.username);
      }
    } catch (cause) {
      setProfileError(cause instanceof Error ? cause.message : "Something went wrong. Please try again.");
    } finally {
      setIsUpdatingProfile(false);
    }
  }

  async function updatePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");
    setIsUpdatingPassword(true);

    try {
      const response = await fetch("/api/user/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Something went wrong. Please try again.");
      setPasswordSuccess("Password updated successfully!");
      setCurrentPassword("");
      setNewPassword("");
    } catch (cause) {
      setPasswordError(cause instanceof Error ? cause.message : "Something went wrong. Please try again.");
    } finally {
      setIsUpdatingPassword(false);
    }
  }

  return (
    <main className={styles.settingsPage}>
      <header className={styles.topbar}>
        <Link className={styles.brand} href="/" aria-label="Lingua home">
          <span className={styles.brandMark}>L</span>
          <span>lingua</span>
        </Link>
        <div className={styles.accountActions}>
          <span className={styles.accountName}>{user.username}</span>
          <Link className={styles.logoutButton} href="/dashboard">Dashboard</Link>
        </div>
      </header>

      <section className={styles.settingsLayout} aria-labelledby="page-title">
        <div className={styles.intro}>
          <p className={styles.eyebrow}>Your account</p>
          <h1 id="page-title">Account <span>settings</span></h1>
          <p className={styles.introCopy}>
            Update your email, username, or password. Changes take effect immediately.
          </p>
        </div>

        <div className={styles.settingsContent}>
          <section className={styles.settingsCard} aria-labelledby="profile-title">
            <h2 id="profile-title">Profile details</h2>
            <form className={styles.form} onSubmit={updateProfile}>
              <label htmlFor="email">Email</label>
              <input
                autoComplete="email"
                id="email"
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                value={email}
              />
              <label htmlFor="username">Username</label>
              <input
                autoComplete="username"
                id="username"
                maxLength={24}
                minLength={3}
                onChange={(event) => setUsername(event.target.value)}
                pattern="[A-Za-z0-9_]{3,24}"
                value={username}
              />
              <p className={styles.fieldHint}>3–24 letters, numbers, or underscores</p>
              {profileError && <p className={styles.errorMessage} role="alert">{profileError}</p>}
              {profileSuccess && <p className={styles.successMessage} role="status">{profileSuccess}</p>}
              <button className={styles.submitButton} disabled={isUpdatingProfile} type="submit">
                {isUpdatingProfile ? "Updating…" : "Update profile"}
              </button>
            </form>
          </section>

          <section className={styles.settingsCard} aria-labelledby="password-title">
            <h2 id="password-title">Change password</h2>
            <form className={styles.form} onSubmit={updatePassword}>
              <label htmlFor="currentPassword">Current password</label>
              <input
                autoComplete="current-password"
                id="currentPassword"
                onChange={(event) => setCurrentPassword(event.target.value)}
                type="password"
                value={currentPassword}
              />
              <label htmlFor="newPassword">New password</label>
              <input
                autoComplete="new-password"
                id="newPassword"
                minLength={8}
                onChange={(event) => setNewPassword(event.target.value)}
                type="password"
                value={newPassword}
              />
              <p className={styles.fieldHint}>At least 8 characters</p>
              {passwordError && <p className={styles.errorMessage} role="alert">{passwordError}</p>}
              {passwordSuccess && <p className={styles.successMessage} role="status">{passwordSuccess}</p>}
              <button className={styles.submitButton} disabled={isUpdatingPassword} type="submit">
                {isUpdatingPassword ? "Updating…" : "Change password"}
              </button>
            </form>
          </section>
        </div>
      </section>
    </main>
  );
}
