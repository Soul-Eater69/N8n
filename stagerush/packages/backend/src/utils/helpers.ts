import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import {
  SERVICE_FEE_PERCENT,
  FACILITY_FEE_CENTS,
  TAX_RATE,
} from '@stagerush/shared';
import { IFeeBreakdown } from '@stagerush/shared';

export const generateId = (): string => uuidv4();

export const sleep = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));

export function calculateFees(subtotalCents: number, seatCount: number): IFeeBreakdown {
  const serviceFeesCents = Math.round(subtotalCents * SERVICE_FEE_PERCENT);
  const facilityFeeCents = FACILITY_FEE_CENTS * seatCount;
  const taxableCents = subtotalCents + serviceFeesCents + facilityFeeCents;
  const taxCents = Math.round(taxableCents * TAX_RATE);
  const totalCents = subtotalCents + serviceFeesCents + facilityFeeCents + taxCents;

  return { subtotalCents, serviceFeesCents, facilityFeeCents, taxCents, totalCents };
}

export function generateIdempotencyKey(...parts: string[]): string {
  return crypto.createHash('sha256').update(parts.join(':')).digest('hex');
}

export function generateBarcode(): string {
  return crypto.randomBytes(8).toString('hex').toUpperCase();
}

export function paginate(page: number, limit: number) {
  const p = Math.max(1, page);
  const l = Math.min(Math.max(1, limit), 100);
  return { offset: (p - 1) * l, limit: l, page: p };
}
