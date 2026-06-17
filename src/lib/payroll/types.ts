import type { TipPoolMode } from "@prisma/client";

export interface PayrollSettingsInput {
  minimumWage: number;
  tipCredit: number;
  tippedMinCashWage: number;
  weeklyOtThresholdHours: number;
  dailyOtThresholdHours: number | null;
  otMultiplier: number;
  useBlendedOtRate: boolean;
  splitShiftEnabled: boolean;
  splitShiftPremiumHours: number;
  splitShiftMinGapMinutes: number;
  tipPoolMode: TipPoolMode;
  tipPoolRoles: string[] | null;
  ewaEnabled: boolean;
  ewaMaxPercent: number;
  ewaMaxPerAdvance: number;
  ewaFeeFlat: number;
  payPeriodDays: number;
}

export interface ShiftInput {
  id: string;
  staffMemberId: string;
  date: Date | string;
  startTime: string;
  endTime: string;
  workRole?: string | null;
}

export interface TimeEntryInput {
  id: string;
  staffMemberId: string;
  clockInAt: Date | string;
  clockOutAt: Date | string;
  workRole?: string | null;
  hourlyRateAtPunch?: number | null;
}

export interface StaffInput {
  id: string;
  name: string;
  role: string;
  hourlyRate: number;
  isTippedEmployee: boolean;
  tipPoints: number;
  active: boolean;
}

export interface RoleRateInput {
  staffMemberId: string;
  role: string;
  hourlyRate: number;
  tipPoints: number;
  isTippedRole: boolean;
}

export interface RateSegment {
  role: string;
  hours: number;
  rate: number;
}

export interface ShiftPayDetail {
  shiftId: string;
  punchId?: string;
  role: string;
  hours: number;
  rate: number;
  regularPay: number;
  splitShiftPremium: number;
}

export interface EmployeePayPreview {
  staffMemberId: string;
  name: string;
  regularHours: number;
  overtimeHours: number;
  splitShiftHours: number;
  regularPay: number;
  overtimePay: number;
  splitShiftPay: number;
  tipsAllocated: number;
  tipCreditMakeup: number;
  grossPay: number;
  blendedRate: number;
  rateSegments: RateSegment[];
  shiftDetails: ShiftPayDetail[];
}

export interface TipAllocationPreview {
  staffMemberId: string;
  name: string;
  hoursWorked: number;
  tipPoints: number;
  sharePercent: number;
  tipsAmount: number;
  tipCreditMakeup: number;
}

export interface PayrollPreview {
  periodStart: string;
  periodEnd: string;
  totalTips: number;
  tipPoolMode: TipPoolMode;
  employees: EmployeePayPreview[];
  tipAllocations: TipAllocationPreview[];
  totals: {
    grossPay: number;
    tips: number;
    tipCreditMakeup: number;
    overtimePay: number;
    splitShiftPay: number;
  };
}

export interface EwaAvailability {
  staffMemberId: string;
  earnedToDate: number;
  advancesPending: number;
  advancesDeducted: number;
  availableAmount: number;
  maxPercent: number;
  maxPerAdvance: number;
}
