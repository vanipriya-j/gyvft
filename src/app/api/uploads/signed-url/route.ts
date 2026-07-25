import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStudioUser } from "@/lib/auth/session";
import { AppError, toErrorResponse } from "@/lib/errors/app-error";
import { createSignedBriefUrl } from "@/services/storage/briefs";

const schema = z.object({
  fileId: z.string().uuid(),
});

export async function POST(request: Request) {
  try {
    await requireStudioUser();
    const body = schema.parse(await request.json());
    const signed = await createSignedBriefUrl(body.fileId);
    return NextResponse.json({
      ok: true,
      url: signed.url,
      expiresIn: signed.expiresIn,
    });
  } catch (error) {
    if (error instanceof AppError) {
      const response = toErrorResponse(error);
      return NextResponse.json(response, { status: response.status });
    }
    const response = toErrorResponse(error);
    return NextResponse.json(response, { status: response.status });
  }
}
