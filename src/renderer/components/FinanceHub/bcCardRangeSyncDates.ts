// BC Card range sync: enumerate calendar months and split into YYYYMMDD chunks (max span per query).

export type YearMonth = { year: number; month: number };

export type BcCardQueryChunk = {
  startDate: string;
  endDate: string;
  /** e.g. 2025-01 or 2025-01 (2/2) when a 31-day month is split */
  label: string;
};

/** Same stepping logic as hometax collectTaxInvoicesInRange */
export function listYearMonthsInclusive(
  startYear: number,
  startMonth: number,
  endYear: number,
  endMonth: number
): YearMonth[] {
  const out: YearMonth[] = [];
  let y = startYear;
  let m = startMonth;
  while (y < endYear || (y === endYear && m <= endMonth)) {
    out.push({ year: y, month: m });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

export function formatYyyymmddLocal(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${mo}${day}`;
}

function splitCalendarRangeIntoMaxSpanChunks(
  rangeStart: Date,
  rangeEnd: Date,
  maxSpanDays: number
): { start: Date; end: Date }[] {
  const parts: { start: Date; end: Date }[] = [];
  const end = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), rangeEnd.getDate());

  let cur = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate());

  while (cur.getTime() <= end.getTime()) {
    const tentativeEnd = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate());
    tentativeEnd.setDate(tentativeEnd.getDate() + maxSpanDays - 1);
    const chunkEnd =
      tentativeEnd.getTime() > end.getTime()
        ? end
        : new Date(tentativeEnd.getFullYear(), tentativeEnd.getMonth(), tentativeEnd.getDate());
    parts.push({
      start: new Date(cur.getFullYear(), cur.getMonth(), cur.getDate()),
      end: new Date(chunkEnd.getFullYear(), chunkEnd.getMonth(), chunkEnd.getDate()),
    });
    cur = new Date(chunkEnd.getFullYear(), chunkEnd.getMonth(), chunkEnd.getDate());
    cur.setDate(cur.getDate() + 1);
  }

  return parts;
}

/**
 * For each calendar month in [startYear/startMonth .. endYear/endMonth], build BC query chunks
 * using local dates. Splits a month into multiple queries when days in month > maxSpanDays.
 */
export function buildBcCardQueryChunksForYearMonthRange(
  startYear: number,
  startMonth: number,
  endYear: number,
  endMonth: number,
  maxSpanDays: number = 30
): BcCardQueryChunk[] {
  const months = listYearMonthsInclusive(startYear, startMonth, endYear, endMonth);
  const all: BcCardQueryChunk[] = [];

  for (const { year, month } of months) {
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0);
    const ymLabel = `${year}-${String(month).padStart(2, '0')}`;
    const spanDays =
      Math.floor(
        (monthEnd.getTime() - monthStart.getTime()) / 86400000
      ) + 1;

    if (spanDays <= maxSpanDays) {
      all.push({
        startDate: formatYyyymmddLocal(monthStart),
        endDate: formatYyyymmddLocal(monthEnd),
        label: ymLabel,
      });
    } else {
      const raw = splitCalendarRangeIntoMaxSpanChunks(monthStart, monthEnd, maxSpanDays);
      raw.forEach((p, idx) => {
        all.push({
          startDate: formatYyyymmddLocal(p.start),
          endDate: formatYyyymmddLocal(p.end),
          label: raw.length > 1 ? `${ymLabel} (${idx + 1}/${raw.length})` : ymLabel,
        });
      });
    }
  }

  return all;
}

export function yearMonthKey(year: number, month: number): number {
  return year * 12 + (month - 1);
}
