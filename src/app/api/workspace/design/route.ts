import {
  getWorkspaceStorageBackend,
  saveCurrentDesign,
} from "@/lib/server/workspace-store";
import type { LessonDesign } from "@/types/lesson";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      design?: LessonDesign;
      persistVersion?: boolean;
    };

    if (!payload.design) {
      return NextResponse.json({ error: "design is required" }, { status: 400 });
    }

    const snapshot = await saveCurrentDesign(
      payload.design,
      payload.persistVersion ?? false,
    );

    return NextResponse.json({
      currentDesign: snapshot.currentDesign,
      designHistory: snapshot.designHistory,
      updatedAt: snapshot.updatedAt,
      storageBackend: getWorkspaceStorageBackend(),
    });
  } catch (error) {
    console.error("save design route error", error);
    return NextResponse.json(
      { error: "failed to save design" },
      { status: 500 },
    );
  }
}