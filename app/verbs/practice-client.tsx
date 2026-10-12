"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "./verbs.module.scss";

interface Exercise {
  verb: string;
  translation: string;
  tense: string;
  pronoun: string;
}

interface Feedback {
  correct_conjugation: boolean;
  correct_sentence: boolean;
  expected_conjugation: string;
  feedback: string;
  corrected_sentence: string;
}

type PracticeState = "idle" | "loading" | "answering" | "checking" | "review" | "finished" | "error";

async function getApiError(response: Response) {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? "Something went wrong. Please try again.";
}

export default function PracticeClient({ username }: { username: string }) {
  const router = useRouter();
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [exerciseQueue, setExerciseQueue] = useState<Exercise[]>([]);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [conjugation, setConjugation] = useState("");
  const [sentence, setSentence] = useState("");
  const [state, setState] = useState<PracticeState>("idle");
  const [error, setError] = useState("");
  const [correctCount, setCorrectCount] = useState(0);
  const [roundCount, setRoundCount] = useState(0);
  const [logoutError, setLogoutError] = useState("");
  const [sessionEndError, setSessionEndError] = useState("");
  const sessionIdRef = useRef<string | null>(null);

  async function loadExercise() {
    setError("");
    setFeedback(null);
    setConjugation("");
    setSentence("");
    setState("loading");

    try {
      if (!sessionIdRef.current) {
        const sessionResponse = await fetch("/api/practice-sessions", { method: "POST" });
        if (!sessionResponse.ok) throw new Error(await getApiError(sessionResponse));
        const sessionResult = (await sessionResponse.json()) as { sessionId: string };
        if (!sessionResult.sessionId) throw new Error("Could not start a practice session. Please try again.");
        sessionIdRef.current = sessionResult.sessionId;
      }

      if (exerciseQueue.length > 0) {
        setExercise(exerciseQueue[0]);
        setExerciseQueue((queue) => queue.slice(1));
        setState("answering");
        return;
      }

      const response = await fetch("/api/verbs", { cache: "no-store" });
      if (!response.ok) throw new Error(await getApiError(response));
      const result = (await response.json()) as { exercises: Exercise[] };
      if (!Array.isArray(result.exercises) || result.exercises.length !== 20) {
        throw new Error("Could not load a complete set of exercises. Please try again.");
      }
      setExercise(result.exercises[0]);
      setExerciseQueue(result.exercises.slice(1));
      setState("answering");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load an exercise.");
      setState("error");
    }
  }

  async function checkAnswer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!exercise || state !== "answering") return;

    setState("checking");
    setError("");
    try {
      const response = await fetch("/api/verbs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exercise, conjugation, sentence, sessionId: sessionIdRef.current }),
      });
      if (!response.ok) throw new Error(await getApiError(response));
      const result = (await response.json()) as Feedback;
      setFeedback(result);
      setRoundCount((count) => count + 1);
      if (result.correct_conjugation && result.correct_sentence) {
        setCorrectCount((count) => count + 1);
      }
      setState("review");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not check your answer.");
      setState("answering");
    }
  }

  async function finishSession() {
    setSessionEndError("");
    if (sessionIdRef.current) {
      try {
        const response = await fetch("/api/practice-sessions", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: sessionIdRef.current }),
        });
        if (!response.ok) throw new Error(await getApiError(response));
        sessionIdRef.current = null;
      } catch (cause) {
        setSessionEndError(
          cause instanceof Error ? cause.message : "Could not save the end of your practice session.",
        );
      }
    }

    setState("finished");
    setExercise(null);
    setFeedback(null);
  }

  async function startAgain() {
    if (sessionIdRef.current) {
      try {
        const response = await fetch("/api/practice-sessions", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: sessionIdRef.current }),
        });
        if (!response.ok) throw new Error(await getApiError(response));
        sessionIdRef.current = null;
      } catch (cause) {
        setSessionEndError(
          cause instanceof Error ? cause.message : "Could not save the end of your practice session.",
        );
        return;
      }
    }
    setSessionEndError("");
    setCorrectCount(0);
    setRoundCount(0);
    void loadExercise();
  }

  async function logOut() {
    setLogoutError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Could not log out. Please try again.");
      router.replace("/auth");
    } catch (cause) {
      setLogoutError(cause instanceof Error ? cause.message : "Could not log out. Please try again.");
    }
  }

  const busy = state === "loading" || state === "checking";

  return (
    <main className={styles.practicePage}>
      <header className={styles.topbar}>
        <Link className={styles.brand} href="/" aria-label="Lingua home">
          <span className={styles.brandMark}>L</span>
          <span>lingua</span>
        </Link>
        <div className={styles.accountActions}>
          <span className={styles.accountName}>{username}</span>
          <Link className={styles.logoutButton} href="/dashboard">Dashboard</Link>
          <button className={styles.logoutButton} onClick={() => void logOut()} type="button">Log out</button>
          {logoutError && <span className={styles.logoutError} role="alert">{logoutError}</span>}
        </div>
      </header>

      <section className={styles.practiceLayout} aria-labelledby="page-title">
        <div className={styles.intro}>
          <p className={styles.eyebrow}>A little practice, a lot of progress</p>
          <h1 id="page-title">Make it <span>Italian.</span></h1>
          <p className={styles.introCopy}>
            Conjugate the verb, then bring it to life in a sentence. Your AI tutor will give you helpful feedback.
          </p>
        </div>

        <section className={styles.practiceCard} aria-live="polite">
          <div className={styles.cardTopline}>
            <div className={styles.stepLabel}><span className={styles.stepDot} /> VERB WORKOUT</div>
            {roundCount > 0 && state !== "finished" && (
              <div className={styles.scorePill}>{correctCount} / {roundCount} correct</div>
            )}
          </div>

          {state === "idle" && (
            <div className={styles.welcomePanel}>
              <div className={styles.welcomeIcon} aria-hidden="true">✦</div>
              <h2>Ready for your first prompt?</h2>
              <p>We’ll give you an Italian verb, a tense, and a pronoun. You’ll do the rest.</p>
              <button className={styles.primaryButton} onClick={() => void loadExercise()}>
                Start practicing <span aria-hidden="true">→</span>
              </button>
            </div>
          )}

          {state === "loading" && (
            <div className={styles.loadingPanel} role="status">
              <span className={styles.spinner} />
              <p>Your next Italian prompt is on its way…</p>
            </div>
          )}

          {state === "error" && (
            <div className={`${styles.messagePanel} ${styles.errorPanel}`} role="alert">
              <span className={styles.messageIcon} aria-hidden="true">!</span>
              <h2>We couldn’t load that</h2>
              <p>{error}</p>
              <button className={styles.primaryButton} onClick={() => void loadExercise()}>Try again</button>
            </div>
          )}

          {(state === "answering" || state === "checking" || state === "review") && exercise && (
            <>
              <div className={styles.promptHeading}>
                <p className={styles.promptLabel}>Your verb</p>
                <div className={styles.verbTitle}>
                  <h2>{exercise.verb}</h2>
                  <span className={styles.translation}>{exercise.translation}</span>
                </div>
              </div>

              <div className={styles.promptDetails}>
                <div className={styles.detailTile}>
                  <span className={styles.detailLabel}>TENSE</span>
                  <span className={styles.detailValue}>{exercise.tense}</span>
                </div>
                <div className={styles.detailTile}>
                  <span className={styles.detailLabel}>PRONOUN</span>
                  <span className={styles.detailValue}>{exercise.pronoun}</span>
                </div>
              </div>

              <form className={styles.answerForm} onSubmit={checkAnswer}>
                <label htmlFor="conjugation">Your conjugation</label>
                <input
                  autoComplete="off"
                  autoFocus
                  disabled={state !== "answering"}
                  id="conjugation"
                  onChange={(event) => setConjugation(event.target.value)}
                  placeholder="Type the correct form…"
                  required
                  value={conjugation}
                />
                <label htmlFor="sentence">Now use it in a sentence</label>
                <textarea
                  disabled={state !== "answering"}
                  id="sentence"
                  onChange={(event) => setSentence(event.target.value)}
                  placeholder="Write a sentence in Italian…"
                  required
                  rows={3}
                  value={sentence}
                />

                {error && <p className={styles.inlineError} role="alert">{error}</p>}

                {state === "review" && feedback ? (
                  <div className={styles.feedbackPanel}>
                    <div className={styles.feedbackHeading}>
                      <span className={`${styles.resultIcon} ${feedback.correct_conjugation ? styles.resultSuccess : styles.resultNeedsWork}`}>
                        {feedback.correct_conjugation ? "✓" : "↗"}
                      </span>
                      <div>
                        <h3>{feedback.correct_conjugation && feedback.correct_sentence ? "Bravissimo!" : "Good effort!"}</h3>
                        <p>
                          Conjugation: <strong>{feedback.correct_conjugation ? "correct" : "keep practicing"}</strong>
                          {" · "}
                          Sentence: <strong>{feedback.correct_sentence ? "correct" : "needs a tweak"}</strong>
                        </p>
                      </div>
                    </div>
                    {!feedback.correct_conjugation && (
                      <p className={styles.answerNote}>The correct form is <strong>{feedback.expected_conjugation}</strong>.</p>
                    )}
                    <p className={styles.tutorFeedback}>{feedback.feedback}</p>
                    {feedback.corrected_sentence && (
                      <p className={styles.correctedSentence}>
                        <span>Suggested sentence</span>{feedback.corrected_sentence}
                      </p>
                    )}
                    <button className={`${styles.primaryButton} ${styles.nextButton}`} onClick={() => void loadExercise()} type="button">
                      Next verb <span aria-hidden="true">→</span>
                    </button>
                  </div>
                ) : (
                  <div className={styles.formActions}>
                    <button className={styles.primaryButton} disabled={busy || !conjugation.trim() || !sentence.trim()} type="submit">
                      {state === "checking" ? "Checking your answer…" : "Check my answer"}
                      {state !== "checking" && <span aria-hidden="true">→</span>}
                    </button>
                    {state === "checking" && <span className={styles.checkingNote}>Your tutor is reviewing both answers</span>}
                  </div>
                )}
              </form>
            </>
          )}

          {state === "finished" && (
            <div className={`${styles.messagePanel} ${styles.finishedPanel}`}>
              <div className={styles.welcomeIcon} aria-hidden="true">✦</div>
              <h2>Session complete</h2>
              <p>
                You got <strong>{correctCount} of {roundCount}</strong> {roundCount === 1 ? "round" : "rounds"} completely right.
                {roundCount === 0 ? " Start a session whenever you’re ready." : " Keep showing up and those verbs will stick."}
              </p>
              {sessionEndError && (
                <p className={styles.inlineError} role="alert">
                  {sessionEndError} Your answers have been saved.
                </p>
              )}
              <button className={styles.primaryButton} onClick={startAgain}>
                Practice again <span aria-hidden="true">→</span>
              </button>
            </div>
          )}

          {state !== "idle" && state !== "finished" && roundCount > 0 && (
            <button className={styles.finishLink} onClick={() => void finishSession()} type="button">Finish session</button>
          )}
        </section>

        <p className={styles.pageFootnote}><span aria-hidden="true">✦</span> Every mistake is one step closer to fluency.</p>
      </section>
    </main>
  );
}
