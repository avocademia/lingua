import { askDeepSeek, DeepSeekError, isRecord } from "../../../lib/deepseek"
import { getCurrentUser } from "../../../lib/auth"
import { prisma } from "../../../lib/prisma"

const PRONOUNS = ["io (I)", "tu (you, singular)", "lui/lei (he/she)", "noi (we)", "voi (you, plural)", "loro (they)"];
const TENSES = [
  "present indicative",
  "passato prossimo",
  "imperfect",
  "future simple",
  "conditional present",
  "present subjunctive",
  "imperfect subjunctive",
  "trapassato prossimo",
  "future perfect",
  "conditional perfect",
  "past subjunctive",
  "trapassato remoto",
  
];
const EXERCISE_BATCH_SIZE = 20
const MAX_FEEDBACK_LENGTH = 180;

interface AnswerFeedback {
  correct_conjugation: boolean
  correct_sentence: boolean
  expected_conjugation: string
  feedback: string
  corrected_sentence: string
}

function errorResponse(error: unknown) {
  if (error instanceof DeepSeekError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  console.error("Unexpected error in the Italian verb API:", error);
  return Response.json({ error: "The AI returned an unexpected response. Please try again." }, { status: 502 });
}

function isExercise(value: unknown): value is {
  verb: string
  translation: string
  tense: string
  pronoun: string
} {
  if (!isRecord(value)) return false;

  return (
    typeof value.verb === "string" &&
    /^[a-zà-ÿ]+$/i.test(value.verb) &&
    /(are|ere|ire)$/i.test(value.verb) &&
    typeof value.translation === "string" &&
    /^to\s+\S/i.test(value.translation.trim()) &&
    typeof value.tense === "string" &&
    TENSES.includes(value.tense) &&
    typeof value.pronoun === "string" &&
    PRONOUNS.includes(value.pronoun)
  )
}

function parseExerciseBatch(result: Record<string, unknown>) {
  if (!Array.isArray(result.exercises) || result.exercises.length !== EXERCISE_BATCH_SIZE) {
    return null
  }

  const exercises = result.exercises.filter(isExercise).map((exercise) => ({
    verb: exercise.verb.toLowerCase(),
    translation: exercise.translation.trim(),
    tense: exercise.tense,
    pronoun: exercise.pronoun,
  }))
  const uniqueVerbs = new Set(exercises.map((exercise) => exercise.verb));

  return exercises.length === EXERCISE_BATCH_SIZE && uniqueVerbs.size === EXERCISE_BATCH_SIZE
    ? exercises
    : null
}

function parseAnswerFeedback(value: Record<string, unknown>): AnswerFeedback | null {
  const expectedKeys = [
    "correct_conjugation",
    "correct_sentence",
    "expected_conjugation",
    "feedback",
    "corrected_sentence",
  ];
  const actualKeys = Object.keys(value)

  if (
    actualKeys.length !== expectedKeys.length ||
    !expectedKeys.every((key) => actualKeys.includes(key)) ||
    typeof value.correct_conjugation !== "boolean" ||
    typeof value.correct_sentence !== "boolean" ||
    typeof value.expected_conjugation !== "string" ||
    !value.expected_conjugation.trim() ||
    typeof value.feedback !== "string" ||
    !value.feedback.trim() ||
    value.feedback.trim().length > MAX_FEEDBACK_LENGTH ||
    typeof value.corrected_sentence !== "string"
  ) {
    return null
  }

  return {
    correct_conjugation: value.correct_conjugation,
    correct_sentence: value.correct_sentence,
    expected_conjugation: value.expected_conjugation.trim(),
    feedback: value.feedback.trim(),
    corrected_sentence: value.corrected_sentence.trim(),
  }
}

export async function GET() {
  if (!(await getCurrentUser())) {
    return Response.json({ error: "Please log in to practice." }, { status: 401 });
  }

  try {
    const systemPrompt = [
      "You create accurate Italian verb-conjugation exercises for English-speaking learners.",
      `Return exactly one JSON object with exactly one property named "exercises": an array of exactly ${EXERCISE_BATCH_SIZE} objects.`,
      'Each array item must have exactly these four properties, each a string: "verb", "translation", "tense", "pronoun".',
      'Use this exact shape (the example is illustrative, not an item to repeat): {"exercises":[{"verb":"parlare","translation":"to speak","tense":"present indicative","pronoun":"io (I)"}]}. Include exactly 20 items in the real response.',
      "Use 20 different, real, common Italian infinitives. Each verb must be a simple infinitive ending in -are, -ere, or -ire. Do not use reflexive forms, participles, conjugated verbs, regional forms, or invented words.",
      "Prefer familiar everyday verbs with reliable standard conjugations. Before returning, check every verb is a correctly spelled Italian infinitive and its translation is accurate.",
      'The translation must be a short English infinitive beginning with "to ", for example "to speak".',
      `Use only these exact tense values: ${JSON.stringify(TENSES)}.`,
      `Use only these exact pronoun values: ${JSON.stringify(PRONOUNS)}.`,
      "Vary the tense and pronoun values. Return valid JSON only, with no markdown, answers, explanations, or text outside the object.",
    ].join(" ")

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const result = await askDeepSeek(
        systemPrompt,
        attempt === 0
          ? `Create a checked list of exactly ${EXERCISE_BATCH_SIZE} distinct Italian verb practice exercises.`
          : `Regenerate the full list carefully. The prior list failed validation. Check the JSON shape, all 20 required fields, allowed values, and that every verb is real and unique before responding.`,
        { temperature: attempt === 0 ? 0.7 : 0.2 },
      )
      const exercises = parseExerciseBatch(result);
      if (exercises) {
        return Response.json({ exercises }, { headers: { "Cache-Control": "no-store" } });
      }
    }

    throw new DeepSeekError(
      "DeepSeek couldn't create 20 valid, unique exercises after two attempts. Please try again.",
      502,
    )
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Please log in to practice." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send a valid JSON answer to check it." }, { status: 400 });
  }

  if (!isRecord(body) || !isRecord(body.exercise)) {
    return Response.json({ error: "The exercise details are missing." }, { status: 400 });
  }

  const { verb, translation, tense, pronoun } = body.exercise;
  const { sessionId } = body;
  const { conjugation, sentence } = body;
  if (
    typeof verb !== "string" ||
    verb.length > 50 ||
    typeof translation !== "string" ||
    translation.length > 100 ||
    typeof tense !== "string" ||
    !TENSES.includes(tense) ||
    typeof pronoun !== "string" ||
    !PRONOUNS.includes(pronoun) ||
    typeof sessionId !== "string" ||
    !sessionId ||
    sessionId.length > 100 ||
    typeof conjugation !== "string" ||
    !conjugation.trim() ||
    conjugation.length > 100 ||
    typeof sentence !== "string" ||
    !sentence.trim() ||
    sentence.length > 500
  ) {
    return Response.json({ error: "Add a conjugation and a sentence, then try again." }, { status: 400 });
  }

  const practiceSession = await prisma.practiceSession.findFirst({
    where: { id: sessionId, userId: user.id, endedAt: null },
    select: { id: true },
  })
  if (!practiceSession) {
    return Response.json({ error: "Start a new practice session before submitting an answer." }, { status: 400 });
  }

  try {
    const systemPrompt = [
      "You are a careful, encouraging Italian language tutor evaluating a learner's verb exercise.",
      "Evaluate the conjugation and sentence separately. Accept valid Italian spellings and punctuation; do not require a specific sentence if the learner's sentence is grammatical.",
      "The conjugation must match the given Italian infinitive, tense, and pronoun. The sentence must be a grammatical Italian sentence that uses the requested conjugation correctly.",
      'Return exactly one JSON object with exactly these five properties and no others: "correct_conjugation" (boolean), "correct_sentence" (boolean), "expected_conjugation" (string), "feedback" (string), "corrected_sentence" (string).',
      'Use this exact structure: {"correct_conjugation":true,"correct_sentence":true,"expected_conjugation":"parlo","feedback":"Both your conjugation and sentence are correct.","corrected_sentence":""}. The values are examples; decide the correct values from the learner answer.',
      `Write feedback in clear, brief English, explain any correction, and keep it to at most ${MAX_FEEDBACK_LENGTH} characters. Write corrected_sentence in Italian; return an empty string if the submitted sentence needs no correction.`,
      "Always provide a non-empty expected_conjugation and feedback string. Return valid JSON only, without markdown or text outside the object.",
      "Do not mark a correct conjugation wrong because the sentence uses a different subject where the target form is still used appropriately.",
    ].join(" ");
    const answerPrompt = JSON.stringify({
      exercise: { verb, translation, tense, pronoun },
      learner_conjugation: conjugation.trim(),
      learner_sentence: sentence.trim(),
    })

    let feedback: AnswerFeedback | null = null;
    for (let attempt = 0; attempt < 2 && !feedback; attempt += 1) {
      const result = await askDeepSeek(
        systemPrompt,
        attempt === 0
          ? answerPrompt
          : `${answerPrompt}\n\nYour previous response did not match the required data model or exceeded the feedback character limit. Return the exact five-property JSON object specified in the system instructions and keep feedback within its limit.`,
      )
      feedback = parseAnswerFeedback(result);
    }

    if (!feedback) {
      throw new DeepSeekError("DeepSeek returned incomplete feedback. Please submit your answer again.", 502);
    }

    const correctConjugation = feedback.correct_conjugation;
    const correctSentence = feedback.correct_sentence;
    const expectedConjugation = feedback.expected_conjugation;
    const feedbackText = feedback.feedback;
    const correctedSentence = feedback.corrected_sentence;
    const correct = correctConjugation && correctSentence;
    await prisma.$transaction(async (transaction) => {
      const activeSession = await transaction.practiceSession.findFirst({
        where: { id: sessionId, userId: user.id, endedAt: null },
        select: { id: true },
      })
      if (!activeSession) {
        throw new Error("The practice session has already ended. Start a new session to continue.");
      }

      await transaction.verbAttempt.create({
        data: {
          practiceSessionId: activeSession.id,
          verb,
          translation,
          tense,
          pronoun,
          conjugation: conjugation.trim(),
          sentence: sentence.trim(),
          expectedConjugation,
          conjugationCorrect: correctConjugation,
          sentenceCorrect: correctSentence,
          feedback: feedbackText,
        },
      })
      await transaction.practiceSession.update({
        where: { id: activeSession.id },
        data: {
          totalCount: { increment: 1 },
          correctCount: { increment: correct ? 1 : 0 },
        },
      })
    })

    return Response.json({
      correct_conjugation: correctConjugation,
      correct_sentence: correctSentence,
      expected_conjugation: expectedConjugation,
      feedback: feedbackText,
      corrected_sentence: correctedSentence,
    })
  } catch (error) {
    return errorResponse(error)
  }
}
