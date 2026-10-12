import { NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { createSession, SESSION_COOKIE } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Please provide valid login details." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Please provide valid login details." }, { status: 400 });
  }

  const { identifier, password } = body as Record<string, unknown>;
  if (typeof identifier !== "string" || typeof password !== "string" || !identifier.trim() || !password) {
    return NextResponse.json({ error: "Enter your email or username and password." }, { status: 400 });
  }

  const normalizedIdentifier = identifier.trim().toLowerCase();
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ email: normalizedIdentifier }, { username: normalizedIdentifier }],
    },
  });

  if (!user || !(await compare(password, user.passwordHash))) {
    return NextResponse.json({ error: "Email/username or password is incorrect." }, { status: 401 });
  }

  const session = await createSession(user.id);
  const response = NextResponse.json({
    user: { id: user.id, email: user.email, username: user.username },
  });
  response.cookies.set(SESSION_COOKIE, session.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: session.expiresAt,
  });
  return response;
}
