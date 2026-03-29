import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/iron";
import { validatePdfFile, PDF_MAX_SIZE } from "@/lib/exploration/validators";
import { addFile } from "@/lib/exploration/db";
import { generateFileId, formatFileSize } from "@/lib/exploration/service";
import type { UploadResponse } from "@/lib/exploration/types";

export async function POST(request: NextRequest) {
  try {
    // Require authentication
    let userId: string;
    try {
      userId = await requireUserId();
    } catch (error) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file
    const validation = validatePdfFile(file);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    // Generate file record (we're not actually storing the file content for now)
    const fileId = generateFileId();
    const fileRecord = {
      fileId,
      filename: file.name,
      size: file.size,
      createdAt: new Date().toISOString(),
    };

    // Store file metadata
    await addFile(userId, fileRecord);

    // Return response
    const response: UploadResponse = {
      fileId: fileRecord.fileId,
      filename: fileRecord.filename,
      size: fileRecord.size,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("File upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}

// GET method to check upload limits (optional)
export async function GET() {
  return NextResponse.json({
    maxFileSize: PDF_MAX_SIZE,
    maxFileSizeMB: PDF_MAX_SIZE / 1024 / 1024,
    allowedTypes: ["application/pdf"],
  });
}