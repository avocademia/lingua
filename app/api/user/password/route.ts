import { NextResponse } from "next/server";
import { compare, hash } from "bcryptjs";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Please log in to update your password." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Please provide valid password details." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Please provide valid password details." }, { status: 400 });
  }

  const { currentPassword, newPassword } = body as Record<string, unknown>;
  
  if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
    return NextResponse.json({ error: "Provide both current and new password." }, { status: 400 });
  }

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "Provide both current and new password." }, { status: 400 });
  }

  if (newPassword.length < 8 || Buffer.byteLength(newPassword, "utf8") > 72) {
    return NextResponse.json({ error: "Password must be between 8 and 72 characters." }, { status: 400 });
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });

  if (!currentUser) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const isCurrentPasswordValid = await compare(currentPassword, currentUser.passwordHash);
  if (!isCurrentPasswordValid) {
    return NextResponse.json({ error: "Current password is incorrect." }, { status: 401 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hash(newPassword, 12) },
  });

  return NextResponse.json({ success: true });
}
