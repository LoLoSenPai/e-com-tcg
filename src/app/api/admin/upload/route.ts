import { NextRequest, NextResponse } from "next/server";
import { adminCookieName, isAdminSession } from "@/lib/admin-auth";
import path from "path";
import { mkdir, writeFile } from "fs/promises";

export const runtime = "nodejs";

function isAuthorized(request: NextRequest) {
  const sessionValue = request.cookies.get(adminCookieName)?.value;
  return isAdminSession(sessionValue);
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const formData = await request.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const ext = path.extname(file.name) || ".png";
  const baseName = path.basename(file.name, ext);
  const safeName =
    baseName
    .replace(/[^a-zA-Z0-9-_]/g, "-")
    .toLowerCase() || "upload";
  const fileName = `${Date.now()}-${safeName}${ext}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, fileName), buffer);

  return NextResponse.json({ url: `/uploads/${fileName}` });
}
