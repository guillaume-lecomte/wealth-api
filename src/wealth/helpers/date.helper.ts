import type { Logger } from '@nestjs/common';
import {
  isValid,
  parseISO,
  parse,
  fromUnixTime,
  isAfter,
  isBefore,
  startOfYear,
} from 'date-fns';

export function parseDate(
  dateInput: string | number | Date,
  logger?: Logger,
): Date {
  if (dateInput instanceof Date) {
    if (!isValid(dateInput)) {
      logger?.warn(`Invalid Date object provided, using current date`);
      return new Date();
    }
    return dateInput;
  }

  if (typeof dateInput === 'number') {
    return parseTimestamp(dateInput, logger);
  }

  if (typeof dateInput === 'string') {
    return parseStringDate(dateInput.trim(), logger);
  }

  logger?.warn(
    `Unexpected date input type: ${typeof dateInput}, using current date`,
  );
  return new Date();
}

function parseTimestamp(timestamp: number, logger?: Logger): Date {
  if (!Number.isFinite(timestamp) || timestamp < 0) {
    logger?.warn(`Invalid timestamp: ${timestamp}, using current date`);
    return new Date();
  }

  const SECONDS_THRESHOLD = 10_000_000_000; // ~20 Sept 2286

  let parsed: Date;

  if (timestamp < SECONDS_THRESHOLD) {
    parsed = fromUnixTime(timestamp);
  } else {
    parsed = new Date(timestamp);
  }

  if (!isValid(parsed)) {
    logger?.warn(`Could not parse timestamp: ${timestamp}, using current date`);
    return new Date();
  }

  const minDate = startOfYear(new Date('1970-01-01'));
  const maxDate = startOfYear(new Date('2100-01-01'));

  if (isBefore(parsed, minDate) || isAfter(parsed, maxDate)) {
    logger?.warn(
      `Timestamp ${timestamp} results in unrealistic date: ${parsed.toISOString()}, using current date`,
    );
    return new Date();
  }

  return parsed;
}

function parseStringDate(dateString: string, logger?: Logger): Date {
  if (!dateString) {
    logger?.warn('Empty date string provided, using current date');
    return new Date();
  }

  let parsed = parseISO(dateString);
  if (isValid(parsed)) {
    return parsed;
  }

  const formats = [
    'yyyy-MM-dd HH:mm:ss', // 2024-01-15 10:30:00
    'dd/MM/yyyy', // 15/01/2024 (français)
    'dd/MM/yyyy HH:mm:ss', // 15/01/2024 10:30:00
    'MM/dd/yyyy', // 01/15/2024 (US)
    'MM-dd-yyyy', // 01-15-2024
    'dd-MM-yyyy', // 15-01-2024
    'yyyy/MM/dd', // 2024/01/15
    "yyyy-MM-dd'T'HH:mm:ss", // ISO sans timezone
  ] as const;

  for (const format of formats) {
    try {
      parsed = parse(dateString, format, new Date());
      if (isValid(parsed)) {
        return parsed;
      }
    } catch {
      continue;
    }
  }

  parsed = new Date(dateString);
  if (isValid(parsed)) {
    logger?.warn(
      `Date string "${dateString}" parsed with native Date constructor (ambiguous format)`,
    );
    return parsed;
  }

  logger?.warn(
    `Could not parse date string: "${dateString}", using current date`,
  );
  return new Date();
}
