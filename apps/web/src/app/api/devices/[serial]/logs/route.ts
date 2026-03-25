import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: { serial: string } }
) {
  const device = await prisma.device.findFirst({
    where: { serialNumber: params.serial },
  });

  if (!device) {
    return NextResponse.json({ error: 'Device not found' }, { status: 404 });
  }

  const searchParams = request.nextUrl.searchParams;
  const limit = Math.min(parseInt(searchParams.get('limit') || '500'), 2000);
  const offset = parseInt(searchParams.get('offset') || '0');
  const search = searchParams.get('search') || '';
  const category = searchParams.get('category') || '';

  const where: Record<string, unknown> = { deviceId: device.id };

  if (category && category !== 'all') {
    where.category = category;
  }

  if (search) {
    where.content = { contains: search, mode: 'insensitive' };
  }

  const [total, lines] = await Promise.all([
    prisma.logLine.count({ where }),
    prisma.logLine.findMany({
      where,
      orderBy: { lineNumber: 'asc' },
      skip: offset,
      take: limit,
      select: {
        lineNumber: true,
        content: true,
        category: true,
      },
    }),
  ]);

  // Get distinct categories for the filter dropdown
  const categories = await prisma.logLine.findMany({
    where: { deviceId: device.id },
    distinct: ['category'],
    select: { category: true },
  });

  return NextResponse.json({
    total,
    lines,
    categories: categories.map((c: { category: string | null }) => c.category).filter(Boolean),
  });
}
