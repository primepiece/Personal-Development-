import type { EvidenceMaturity } from "@/lib/scoring/evidence";
import type { ScoreConfidence } from "@/lib/scoring/compute";
import type { TrajectoryState } from "@/lib/scoring/trajectory";
import type { PaceStatus } from "@/lib/trajectory/compute";

export type SignalSummary = {
  id: string;
  type: string;
  severity: "info" | "warning" | "critical";
  importance: number;
  categoryName: string;
  categorySlug: string;
  description: string;
  detectedAt: string;
  resolvedAt: string | null;
};

export type PriorityFactor = { name: string; points: number; detail: string };

export type PriorityItem = {
  rank: number;
  kind: "signal" | "metric";
  label: string;
  categoryName: string;
  score: number;
  factors: PriorityFactor[];
  refs: { table: string; id: string }[];
};

export type WeeklyReviewSnapshot = {
  weekStartDate: string;
  weekEndDate: string;
  isoWeek: number;
  isoYear: number;

  trajectory: { state: TrajectoryState; reason: string };

  primeActions: {
    total: number;
    done: number;
    completionRate: number | null;
    unfinished: { id: string; title: string; categoryName: string; priority: number; date: string }[];
  };

  recurringBehaviours: {
    goalId: string;
    goalTitle: string;
    categoryName: string;
    period: string;
    targetFrequency: number;
    periodCount: number;
    periodMet: boolean;
    trend: "improving" | "declining" | null;
    maturity: EvidenceMaturity;
  }[];

  goals: {
    completed: { id: string; title: string; categoryName: string }[];
    neglected: { id: string; title: string; categoryName: string; daysSinceTouch: number }[];
    approachingDeadline: { id: string; title: string; categoryName: string; targetDate: string; daysUntil: number }[];
    outcomeOnPace: { goalId: string; title: string; metricName: string; status: PaceStatus }[];
    outcomeBehindPace: { goalId: string; title: string; metricName: string; status: PaceStatus }[];
  };

  pillars: {
    categoryId: string;
    categoryName: string;
    categorySlug: string;
    activityDays: number;
    meaningfulActivity: boolean;
    score: number | null;
    confidence: ScoreConfidence;
    outcomeEvidence: { metricName: string; statusLabel: string }[];
  }[];

  signals: {
    newThisWeek: SignalSummary[];
    highImportanceActive: SignalSummary[];
    acknowledgedUnresolved: SignalSummary[];
    resolvedThisWeek: SignalSummary[];
  };

  trajectoryMetrics: {
    metricId: string;
    name: string;
    categoryName: string;
    unit: string;
    touchedThisWeek: boolean;
    requiredMonthlyChange: number | null;
    observedMonthlyChange: number | null;
    status: PaceStatus | "insufficient" | "no_target";
    statusReason: string;
  }[];

  dailyReviews: {
    completedCount: number;
    possibleDays: number;
    avgEnergyRating: number | null;
    avgDayRating: number | null;
    entries: { date: string; rawText: string; energyRating: number | null; dayRating: number | null }[];
  };

  insights: string[];
  priorities: PriorityItem[];
};
