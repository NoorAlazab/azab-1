import { NextRequest, NextResponse } from 'next/server';
import { requireUserId } from '@/lib/auth/iron';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';

const UpdateBugSchema = z.object({
  bugId: z.string(),
  title: z.string().optional(),
  steps: z.array(z.string()).optional(),
});

export async function PATCH(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const body = await request.json();
    const validated = UpdateBugSchema.parse(body);

    // Verify bug belongs to user's run
    const bug = await prisma.bugFinding.findFirst({
      where: {
        id: validated.bugId,
      },
      include: {
        run: true,
      },
    });

    if (!bug || bug.run.userId !== userId) {
      return NextResponse.json(
        { error: 'Bug not found' },
        { status: 404 }
      );
    }

    // Update bug
    const updated = await prisma.bugFinding.update({
      where: { id: validated.bugId },
      data: {
        ...(validated.title && { title: validated.title }),
        ...(validated.steps && { stepsJson: validated.steps }),
        status: bug.status === 'new' ? 'edited' : bug.status,
      },
    });

    return NextResponse.json({
      ok: true,
      bug: {
        id: updated.id,
        title: updated.title,
        steps: updated.stepsJson,
        status: updated.status,
      },
    });

  } catch (error) {
    console.error('[Bug Update] Error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update bug' },
      { status: 500 }
    );
  }
}
