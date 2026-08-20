import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUserId } from "@/lib/annotations/auth";
import { parseAnnotationPatch } from "@/lib/annotations/validate";
import { deleteAnnotation, updateAnnotation } from "@/lib/db/userdata";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" };

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** PATCH /api/annotations/:id — edit color/body/tags. The anchor is not editable; see
 *  `parseAnnotationPatch`. */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400, headers: NO_STORE });
  }

  const parsed = parseAnnotationPatch(raw);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400, headers: NO_STORE });
  }

  const userId = await getCurrentUserId();
  const annotation = updateAnnotation(userId, id, parsed.value);
  if (!annotation) {
    return NextResponse.json({ error: "annotation not found" }, { status: 404, headers: NO_STORE });
  }

  return NextResponse.json({ annotation }, { headers: NO_STORE });
}

/** DELETE /api/annotations/:id — soft delete (ARCHITECTURE §3.3 `deleted_at`). */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  const ok = deleteAnnotation(userId, id);
  if (!ok) {
    return NextResponse.json({ error: "annotation not found" }, { status: 404, headers: NO_STORE });
  }
  return new NextResponse(null, { status: 204, headers: NO_STORE });
}
