import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import DashboardActions from "./dashboard-actions";
import styles from "./dashboard.module.scss";

export const metadata: Metadata = {
  title: "Your progress — Lingua",
  description: "See your Italian practice stats and recent answers.",
};

const dateFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

const weekdayFormatter = new Intl.DateTimeFormat("en", {
  weekday: "short",
  timeZone: "UTC",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
});

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <main className={styles.dashboardPage} aria-busy="true">
          <div className={styles.loading}>Getting your progress ready…</div>
        </main>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}

async function DashboardContent() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth");

  const weekStart = new Date();
  weekStart.setUTCHours(0, 0, 0, 0);
  weekStart.setUTCDate(weekStart.getUTCDate() - 6);

  const [summary, weeklyAttempts, recentAttempts] = await Promise.all([
    prisma.practiceSession.aggregate({
      where: { userId: user.id, totalCount: { gt: 0 } },
      _sum: { correctCount: true, totalCount: true },
      _count: { _all: true },
    }),
    prisma.verbAttempt.findMany({
      where: {
        createdAt: { gte: weekStart },
        practiceSession: { is: { userId: user.id } },
      },
      select: {
        createdAt: true,
        conjugationCorrect: true,
        sentenceCorrect: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.verbAttempt.findMany({
      where: { practiceSession: { is: { userId: user.id } } },
      select: {
        verb: true,
        tense: true,
        createdAt: true,
        conjugationCorrect: true,
        sentenceCorrect: true,
      },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
  ]);

  const totalAttempts = summary._sum.totalCount ?? 0;
  const correctAttempts = summary._sum.correctCount ?? 0;
  const accuracy = totalAttempts === 0 ? 0 : Math.round((correctAttempts / totalAttempts) * 100);
  const activityByDay = new Map<string, number>();

  for (const attempt of weeklyAttempts) {
    const date = attempt.createdAt.toISOString().slice(0, 10);
    activityByDay.set(date, (activityByDay.get(date) ?? 0) + 1);
  }

  const week = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setUTCDate(weekStart.getUTCDate() + index);
    const key = date.toISOString().slice(0, 10);
    return {
      key,
      label: weekdayFormatter.format(date),
      dateLabel: dateFormatter.format(date),
      count: activityByDay.get(key) ?? 0,
    };
  });
  const busiestDay = Math.max(1, ...week.map((day) => day.count));
  const activeDays = week.filter((day) => day.count > 0).length;

  return (
    <main className={styles.dashboardPage}>
      <header className={styles.topbar}>
        <Link className={styles.brand} href="/" aria-label="Lingua home">
          <span className={styles.brandMark}>L</span>
          <span>lingua</span>
        </Link>
        <DashboardActions />
      </header>

      <section className={styles.dashboard} aria-labelledby="page-title">
        <div className={styles.welcome}>
          <div>
            <p className={styles.eyebrow}>Your learning journey</p>
            <h1 id="page-title">Ciao, <span>{user.username}.</span></h1>
            <p className={styles.subtitle}>A clear picture of the Italian you’ve been learning.</p>
          </div>
          <Link className={styles.practiceButton} href="/verbs">
            Practice now <span aria-hidden="true">→</span>
          </Link>
        </div>

        <section className={styles.statsGrid} aria-label="Your practice statistics">
          <article className={styles.statCard}>
            <span className={styles.statLabel}>EXERCISES COMPLETED</span>
            <strong className={styles.statValue}>{totalAttempts.toLocaleString()}</strong>
            <span className={styles.statNote}>Answers checked by your tutor</span>
          </article>
          <article className={styles.statCard}>
            <span className={styles.statLabel}>OVERALL ACCURACY</span>
            <strong className={styles.statValue}>{accuracy}%</strong>
            <span className={styles.statNote}>Conjugation and sentence both correct</span>
          </article>
          <article className={styles.statCard}>
            <span className={styles.statLabel}>PRACTICE SESSIONS</span>
            <strong className={styles.statValue}>{summary._count._all.toLocaleString()}</strong>
            <span className={styles.statNote}>Sessions with at least one answer</span>
          </article>
          <article className={styles.statCard}>
            <span className={styles.statLabel}>ACTIVE DAYS</span>
            <strong className={styles.statValue}>{activeDays}<span className={styles.statSuffix}>/7</span></strong>
            <span className={styles.statNote}>Days you practiced this week</span>
          </article>
        </section>

        <section className={styles.activityCard} aria-labelledby="activity-title">
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>Consistency counts</p>
              <h2 id="activity-title">Your last 7 days</h2>
            </div>
            <span className={styles.activityTotal}>
              {weeklyAttempts.length} {weeklyAttempts.length === 1 ? "exercise" : "exercises"}
            </span>
          </div>
          <div className={styles.chart} role="list" aria-label="Exercises completed each day for the last seven days">
            {week.map((day) => {
              const height = day.count === 0 ? 0 : Math.max(8, Math.round((day.count / busiestDay) * 100));
              return (
                <div
                  className={styles.chartDay}
                  key={day.key}
                  role="listitem"
                  aria-label={`${day.dateLabel}: ${day.count} ${day.count === 1 ? "exercise" : "exercises"}`}
                >
                  <span className={styles.chartCount}>{day.count || ""}</span>
                  <div className={styles.chartTrack} aria-hidden="true">
                    <span className={styles.chartBar} style={{ height: `${height}%` }} />
                  </div>
                  <span className={styles.chartWeekday}>{day.label}</span>
                  <span className={styles.chartDate}>{day.dateLabel}</span>
                </div>
              );
            })}
          </div>
        </section>

        <section className={styles.recentCard} aria-labelledby="recent-title">
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>Keep the momentum</p>
              <h2 id="recent-title">Recent practice</h2>
            </div>
            <Link className={styles.textLink} href="/verbs">Practice another <span aria-hidden="true">→</span></Link>
          </div>

          {recentAttempts.length > 0 ? (
            <ul className={styles.attemptList}>
              {recentAttempts.map((attempt) => {
                const correct = attempt.conjugationCorrect && attempt.sentenceCorrect;
                return (
                  <li className={styles.attemptRow} key={`${attempt.createdAt.toISOString()}-${attempt.verb}`}>
                    <span className={`${styles.resultMark} ${correct ? styles.correct : styles.needsWork}`} aria-hidden="true">
                      {correct ? "✓" : "↗"}
                    </span>
                    <span className={styles.verb}>{attempt.verb}</span>
                    <span className={styles.tense}>{attempt.tense}</span>
                    <span className={`${styles.resultText} ${correct ? styles.correctText : styles.needsWorkText}`}>
                      {correct ? "All correct" : "Keep practicing"}
                    </span>
                    <time className={styles.attemptDate} dateTime={attempt.createdAt.toISOString()}>
                      {dateTimeFormatter.format(attempt.createdAt)}
                    </time>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon} aria-hidden="true">✦</span>
              <h3>Your progress starts with one verb.</h3>
              <p>Complete an exercise and your answers and stats will show up here.</p>
              <Link className={styles.practiceButton} href="/verbs">Start practicing <span aria-hidden="true">→</span></Link>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
