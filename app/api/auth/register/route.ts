import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { Prisma } from "@prisma/client";
import { createSession, SESSION_COOKIE } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Please provide valid form details." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Please provide valid form details." }, { status: 400 });
  }

  const { email, username, password } = body as Record<string, unknown>;
  if (typeof email !== "string" || typeof username !== "string" || typeof password !== "string") {
    return NextResponse.json({ error: "Please provide an email, username, and password." }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedUsername = username.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (!/^[a-z0-9_]{3,24}$/.test(normalizedUsername)) {
    return NextResponse.json(
      { error: "Username must be 3–24 characters using letters, numbers, or underscores." },
      { status: 400 },
    );
  }
  if (password.length < 8 || Buffer.byteLength(password, "utf8") > 72) {
    return NextResponse.json({ error: "Password must be between 8 and 72 characters." }, { status: 400 });
  }

  const existingUser = await prisma.user.findFirst({
    where: { OR: [{ email: normalizedEmail }, { username: normalizedUsername }] },
    select: { id: true },
  });
  if (existingUser) {
    return NextResponse.json({ error: "That email or username is already in use." }, { status: 409 });
  }

  let user: { id: string; email: string; username: string };
  try {
    user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        username: normalizedUsername,
        passwordHash: await hash(password, 12),
      },
      select: { id: true, email: true, username: true },
    });
  } catch (cause) {
    if (cause instanceof Prisma.PrismaClientKnownRequestError && cause.code === "P2002") {
      return NextResponse.json({ error: "That email or username is already in use." }, { status: 409 });
    }
    throw cause;
  }

  const session = await createSession(user.id);
  const response = NextResponse.json({ user });
  response.cookies.set(SESSION_COOKIE, session.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: session.expiresAt,
  });
  return response;
}
