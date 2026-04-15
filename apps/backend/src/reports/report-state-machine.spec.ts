import { BadRequestException } from '@nestjs/common';
import {
  assertTransition,
  canTransition,
  ReportStatus,
  VALID_TRANSITIONS,
} from './report-state-machine';

describe('report-state-machine', () => {
  describe('VALID_TRANSITIONS', () => {
    it('DRAFT can only transition to SUBMITTED', () => {
      expect(VALID_TRANSITIONS.DRAFT).toEqual(['SUBMITTED']);
    });

    it('SUBMITTED can transition to APPROVED or REJECTED', () => {
      expect(VALID_TRANSITIONS.SUBMITTED).toEqual(['APPROVED', 'REJECTED']);
    });

    it('APPROVED has no valid transitions (terminal)', () => {
      expect(VALID_TRANSITIONS.APPROVED).toEqual([]);
    });

    it('REJECTED can only transition to DRAFT', () => {
      expect(VALID_TRANSITIONS.REJECTED).toEqual(['DRAFT']);
    });
  });

  describe('canTransition', () => {
    // Valid transitions
    it('returns true for DRAFT → SUBMITTED', () => {
      expect(canTransition('DRAFT', 'SUBMITTED')).toBe(true);
    });

    it('returns true for SUBMITTED → APPROVED', () => {
      expect(canTransition('SUBMITTED', 'APPROVED')).toBe(true);
    });

    it('returns true for SUBMITTED → REJECTED', () => {
      expect(canTransition('SUBMITTED', 'REJECTED')).toBe(true);
    });

    it('returns true for REJECTED → DRAFT', () => {
      expect(canTransition('REJECTED', 'DRAFT')).toBe(true);
    });

    // Invalid transitions from DRAFT
    it('returns false for DRAFT → APPROVED', () => {
      expect(canTransition('DRAFT', 'APPROVED')).toBe(false);
    });

    it('returns false for DRAFT → REJECTED', () => {
      expect(canTransition('DRAFT', 'REJECTED')).toBe(false);
    });

    it('returns false for DRAFT → DRAFT', () => {
      expect(canTransition('DRAFT', 'DRAFT')).toBe(false);
    });

    // Invalid transitions from SUBMITTED
    it('returns false for SUBMITTED → DRAFT', () => {
      expect(canTransition('SUBMITTED', 'DRAFT')).toBe(false);
    });

    it('returns false for SUBMITTED → SUBMITTED', () => {
      expect(canTransition('SUBMITTED', 'SUBMITTED')).toBe(false);
    });

    // Invalid transitions from APPROVED (terminal)
    it('returns false for APPROVED → DRAFT', () => {
      expect(canTransition('APPROVED', 'DRAFT')).toBe(false);
    });

    it('returns false for APPROVED → SUBMITTED', () => {
      expect(canTransition('APPROVED', 'SUBMITTED')).toBe(false);
    });

    it('returns false for APPROVED → REJECTED', () => {
      expect(canTransition('APPROVED', 'REJECTED')).toBe(false);
    });

    it('returns false for APPROVED → APPROVED', () => {
      expect(canTransition('APPROVED', 'APPROVED')).toBe(false);
    });

    // Invalid transitions from REJECTED
    it('returns false for REJECTED → SUBMITTED (must go via DRAFT)', () => {
      expect(canTransition('REJECTED', 'SUBMITTED')).toBe(false);
    });

    it('returns false for REJECTED → APPROVED', () => {
      expect(canTransition('REJECTED', 'APPROVED')).toBe(false);
    });

    it('returns false for REJECTED → REJECTED', () => {
      expect(canTransition('REJECTED', 'REJECTED')).toBe(false);
    });
  });

  describe('assertTransition', () => {
    it('does not throw for DRAFT → SUBMITTED', () => {
      expect(() => assertTransition('DRAFT', 'SUBMITTED')).not.toThrow();
    });

    it('does not throw for SUBMITTED → APPROVED', () => {
      expect(() => assertTransition('SUBMITTED', 'APPROVED')).not.toThrow();
    });

    it('does not throw for SUBMITTED → REJECTED', () => {
      expect(() => assertTransition('SUBMITTED', 'REJECTED')).not.toThrow();
    });

    it('does not throw for REJECTED → DRAFT', () => {
      expect(() => assertTransition('REJECTED', 'DRAFT')).not.toThrow();
    });

    it('throws BadRequestException for DRAFT → APPROVED', () => {
      expect(() => assertTransition('DRAFT', 'APPROVED')).toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException for DRAFT → REJECTED', () => {
      expect(() => assertTransition('DRAFT', 'REJECTED')).toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException for SUBMITTED → DRAFT', () => {
      expect(() => assertTransition('SUBMITTED', 'DRAFT')).toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException for REJECTED → SUBMITTED', () => {
      expect(() => assertTransition('REJECTED', 'SUBMITTED')).toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException for every transition out of APPROVED', () => {
      const targets: ReportStatus[] = [
        'DRAFT',
        'SUBMITTED',
        'APPROVED',
        'REJECTED',
      ];
      for (const to of targets) {
        expect(() => assertTransition('APPROVED', to)).toThrow(
          BadRequestException,
        );
      }
    });

    it('includes the from and to statuses in the error message', () => {
      expect(() => assertTransition('DRAFT', 'APPROVED')).toThrow(
        'DRAFT → APPROVED',
      );
    });
  });
});
