import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Please log in to update your profile." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Please provide valid profile details." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Please provide valid profile details." }, { status: 400 });
  }

  const { email, username } = body as Record<string, unknown>;
  
  if (email === undefined && username === undefined) {
    return NextResponse.json({ error: "Provide at least one field to update." }, { status: 400 });
  }

  const updateData: Prisma.UserUpdateInput = {};

  if (email !== undefined) {
    if (typeof email !== "string") {
      return NextResponse.json({ error: "Email must be a string." }, { status: 400 });
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }
    updateData.email = normalizedEmail;
  }

  if (username !== undefined) {
    if (typeof username !== "string") {
      return NextResponse.json({ error: "Username must be a string." }, { status: 400 });
    }
    const normalizedUsername = username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,24}$/.test(normalizedUsername)) {
      return NextResponse.json(
        { error: "Username must be 3–24 characters using letters, numbers, or underscores." },
        { status: 400 },
      );
    }
    updateData.username = normalizedUsername;
  }

  if (email !== undefined || username !== undefined) {
    const existingUser = await prisma.user.findFirst({
      where: {
        AND: [
          { id: { not: user.id } },
          {
            OR: [
              ...(email !== undefined ? [{ email: updateData.email as string }] : []),
              ...(username !== undefined ? [{ username: updateData.username as string }] : []),
            ],
          },
        ],
      },
      select: { id: true },
    });

    if (existingUser) {
      if (email !== undefined && username !== undefined) {
        return NextResponse.json({ error: "That email or username is already in use." }, { status: 409 });
      }
      if (email !== undefined) {
        return NextResponse.json({ error: "That email is already in use." }, { status: 409 });
      }
      return NextResponse.json({ error: "That username is already in use." }, { status: 409 });
    }
  }

  try {
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: updateData,
      select: { id: true, email: true, username: true },
    });

    return NextResponse.json({ user: updatedUser });
  } catch (cause) {
    if (cause instanceof Prisma.PrismaClientKnownRequestError && cause.code === "P2002") {
      return NextResponse.json({ error: "That email or username is already in use." }, { status: 409 });
    }
    throw cause;
  }
}
