import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { v4 as uuidv4 } from "uuid";
import { prisma } from "@/lib/prisma";
import { analyzeReceipt } from "@/lib/ai";
import { getLocationIdFromRequest } from "@/lib/location";
import { requirePermission } from "@/lib/api-auth";
import type { PhotoCategory } from "@prisma/client";

export async function POST(request: NextRequest) {
  const { error } = await requirePermission(request, "view_receipts");
  if (error) return error;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = buffer.toString("base64");

    const receipt = await analyzeReceipt(base64);

    return NextResponse.json({ receipt });
  } catch (error) {
    console.error("Receipt scan error:", error);
    return NextResponse.json({ error: "Scan failed" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const { error } = await requirePermission(request, "view_receipts");
  if (error) return error;

  try {
    const locationId = await getLocationIdFromRequest(request);
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const description = formData.get("description") as string;
    const amount = parseFloat(formData.get("amount") as string);
    const category = formData.get("category") as string;
    const date = formData.get("date") as string;

    let receiptUrl: string | null = null;

    if (file) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const ext = file.name.split(".").pop() || "jpg";
      const filename = `${uuidv4()}.${ext}`;
      const uploadsDir = join(process.cwd(), "public", "uploads");
      await mkdir(uploadsDir, { recursive: true });
      await writeFile(join(uploadsDir, filename), buffer);
      receiptUrl = `/uploads/${filename}`;

      await prisma.photo.create({
        data: {
          locationId,
          filename,
          url: receiptUrl,
          category: "RECEIPT" as PhotoCategory,
          title: description,
          description: `Receipt: ${description}`,
        },
      });
    }

    const expense = await prisma.expense.create({
      data: {
        locationId,
        description,
        amount,
        category,
        date: date ? new Date(date) : new Date(),
        receiptUrl,
      },
    });

    await prisma.activityLog.create({
      data: {
        locationId,
        action: "RECEIPT_OCR",
        entity: "expense",
        entityId: expense.id,
        details: `Receipt scanned: ${description} $${amount}`,
      },
    });

    return NextResponse.json({ expense });
  } catch (error) {
    console.error("Receipt save error:", error);
    return NextResponse.json({ error: "Save failed" }, { status: 500 });
  }
}
