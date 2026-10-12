"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "./auth.module.scss";

type AuthMode = "login" | "register";

export default function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("register");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "register" ? { email, username, password } : { identifier, password },
        ),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Something went wrong. Please try again.");
      router.replace("/dashboard");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong. Please try again.");
      setIsSubmitting(false);
    }
  }

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError("");
    setPassword("");
  }

  return (
    <main className={styles.authPage}>
      <header className={styles.topbar}>
        <Link className={styles.brand} href="/" aria-label="Lingua home">
          <span className={styles.brandMark}>L</span>
          <span>lingua</span>
        </Link>
        <span className={styles.topbarNote}>A little practice, a lot of progress</span>
      </header>

      <section className={styles.authLayout} aria-labelledby="auth-title">
        <div className={styles.intro}>
          <p className={styles.eyebrow}>Your language journey starts here</p>
          <h1 id="auth-title">
            {mode === "register" ? <>Make room for <span>Italian.</span></> : <>Welcome <span>back.</span></>}
          </h1>
          <p className={styles.introCopy}>
            {mode === "register"
              ? "Create an account and build a little language practice into every day."
              : "Sign in to pick up your Italian practice right where you left off."}
          </p>
        </div>

        <div className={styles.authCard}>
          <div className={styles.tabs} role="tablist" aria-label="Account">
            <button
              aria-selected={mode === "register"}
              className={mode === "register" ? styles.activeTab : ""}
              onClick={() => changeMode("register")}
              role="tab"
              type="button"
            >
              Create account
            </button>
            <button
              aria-selected={mode === "login"}
              className={mode === "login" ? styles.activeTab : ""}
              onClick={() => changeMode("login")}
              role="tab"
              type="button"
            >
              Log in
            </button>
          </div>

          <form className={styles.form} onSubmit={submit}>
            {mode === "register" ? (
              <>
                <label htmlFor="email">Email</label>
                <input
                  autoComplete="email"
                  id="email"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  required
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
                  placeholder="yourname"
                  pattern="[A-Za-z0-9_]{3,24}"
                  required
                  value={username}
                />
                <p className={styles.fieldHint}>3–24 letters, numbers, or underscores</p>
              </>
            ) : (
              <>
                <label htmlFor="identifier">Email or username</label>
                <input
                  autoComplete="username"
                  id="identifier"
                  onChange={(event) => setIdentifier(event.target.value)}
                  placeholder="you@example.com or yourname"
                  required
                  value={identifier}
                />
              </>
            )}

            <label htmlFor="password">Password</label>
            <input
              autoComplete={mode === "register" ? "new-password" : "current-password"}
              id="password"
              minLength={8}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={mode === "register" ? "At least 8 characters" : "Your password"}
              required
              type="password"
              value={password}
            />
            {error && <p className={styles.errorMessage} role="alert">{error}</p>}
            <button className={styles.submitButton} disabled={isSubmitting} type="submit">
              {isSubmitting
                ? "One moment…"
                : mode === "register"
                  ? "Create your account"
                  : "Log in"}
              {!isSubmitting && <span aria-hidden="true">→</span>}
            </button>
            <p className={styles.securityNote}>
              <span aria-hidden="true">✦</span> Your password is securely encrypted and never stored as plain text.
            </p>
          </form>
        </div>

        <p className={styles.pageFootnote}>
          <span aria-hidden="true">🇮🇹</span> A new word today. A little more fluent tomorrow.
        </p>
      </section>
    </main>
  );
}
