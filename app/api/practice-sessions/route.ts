import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Please log in to practice." }, { status: 401 });
  }

  const practiceSession = await prisma.practiceSession.create({
    data: { userId: user.id },
    select: { id: true },
  });

  return Response.json({ sessionId: practiceSession.id }, { status: 201 });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Please log in to practice." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send a valid practice session to finish." }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("sessionId" in body) ||
    typeof body.sessionId !== "string" ||
    !body.sessionId
  ) {
    return Response.json({ error: "The practice session is missing." }, { status: 400 });
  }

  const result = await prisma.practiceSession.updateMany({
    where: { id: body.sessionId, userId: user.id, endedAt: null },
    data: { endedAt: new Date() },
  });

  if (result.count === 0) {
    const existingSession = await prisma.practiceSession.findFirst({
      where: { id: body.sessionId, userId: user.id },
      select: { id: true },
    });
    if (!existingSession) {
      return Response.json({ error: "That practice session could not be found." }, { status: 404 });
    }
  }

  return Response.json({ success: true });
}
