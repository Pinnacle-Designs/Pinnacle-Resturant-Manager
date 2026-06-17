import type { InsightCategory, InsightSeverity } from "@prisma/client";
import { getComplianceAlerts } from "./compliance-alerts";

type ComplianceInsight = {
  title: string;
  description: string;
  category: InsightCategory;
  severity: InsightSeverity;
  actionable: string;
};

export async function generateComplianceInsights(locationId: string): Promise<ComplianceInsight[]> {
  const alerts = await getComplianceAlerts(locationId);
  const insights: ComplianceInsight[] = [];

  const overdueBreaks = alerts.mealBreakAlerts.filter((a) => a.overdue);
  const upcomingBreaks = alerts.mealBreakAlerts.filter((a) => !a.overdue);

  if (overdueBreaks.length > 0) {
    insights.push({
      title: `${overdueBreaks.length} overdue meal break${overdueBreaks.length > 1 ? "s" : ""}`,
      description: `${overdueBreaks.map((a) => `${a.staffName} (${a.dueLabel})`).join("; ")} — California and similar states require meal breaks after ${alerts.settings.mealBreakRequiredAfterHours} hours.`,
      category: "STAFFING",
      severity: "CRITICAL",
      actionable: "Send employees on break immediately or document a voluntary waiver at clock-out.",
    });
  } else if (upcomingBreaks.length > 0) {
    insights.push({
      title: `${upcomingBreaks.length} meal break${upcomingBreaks.length > 1 ? "s" : ""} due soon`,
      description: upcomingBreaks
        .map((a) => `${a.staffName} — ${a.dueLabel}`)
        .join("; "),
      category: "STAFFING",
      severity: "HIGH",
      actionable: "Relieve staff for meal breaks before the legal deadline to avoid penalties.",
    });
  }

  const activeMinorIssues = alerts.minorAlerts.filter(
    (a) => a.clockedIn && a.minutesUntilViolation <= 0
  );
  const approachingMinor = alerts.minorAlerts.filter(
    (a) => a.clockedIn && a.minutesUntilViolation > 0
  );

  if (activeMinorIssues.length > 0) {
    insights.push({
      title: "Minor labor law violation in progress",
      description: activeMinorIssues.map((a) => `${a.staffName}: ${a.message}`).join(" "),
      category: "STAFFING",
      severity: "CRITICAL",
      actionable: "Clock the minor out immediately and adjust tonight's schedule.",
    });
  } else if (approachingMinor.length > 0) {
    insights.push({
      title: "Minor approaching curfew or hour limit",
      description: approachingMinor.map((a) => `${a.staffName}: ${a.message}`).join(" "),
      category: "STAFFING",
      severity: "HIGH",
      actionable: "Prepare coverage and clock the minor out before the legal cutoff.",
    });
  }

  if (alerts.recentBreakWaivers.length > 0) {
    insights.push({
      title: `${alerts.recentBreakWaivers.length} meal break waiver${alerts.recentBreakWaivers.length > 1 ? "s" : ""} this week`,
      description: `Employees who skipped required breaks: ${alerts.recentBreakWaivers.map((w) => w.staffName).join(", ")}. Waivers are stored on timecards for audit.`,
      category: "STAFFING",
      severity: "MEDIUM",
      actionable: "Review waivers in Staff → Compliance and ensure managers are not pressuring skip-break clock-outs.",
    });
  }

  return insights;
}

export async function buildComplianceSnapshotForAI(locationId: string) {
  const alerts = await getComplianceAlerts(locationId);
  return {
    mealBreakAlerts: alerts.mealBreakAlerts,
    minorAlerts: alerts.minorAlerts,
    breakWaiversThisWeek: alerts.recentBreakWaivers.length,
    settings: alerts.settings,
  };
}
