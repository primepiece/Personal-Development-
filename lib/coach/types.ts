export type CoachEvidenceBundle = {
  weekStartDate: string;
  weekEndDate: string;
  currentWeek: unknown; // the full WeeklyReviewSnapshot (lib/weekly/types.ts), embedded as-is
  priorWeeks: {
    weekStartDate: string;
    trajectoryState: string;
    primeActionsCompletionRate: number | null;
    topInsights: string[];
    priorities: string[];
  }[];
  unresolvedSignals: {
    id: string;
    type: string;
    severity: string;
    importance: number;
    categoryName: string;
    description: string;
    detectedAt: string;
    status: string;
  }[];
  pillars: {
    categoryId: string;
    categoryName: string;
    visionEntryId: string | null;
    whyItMatters: string | null;
    whoIWantToBecome: string | null;
    standards: { id: string; statement: string }[];
    activeGoals: { id: string; tier: string; kind: string; title: string; priority: number }[];
  }[];
  recentReflections: {
    id: string;
    weekStartDate: string;
    biggestWin: string;
    biggestMistake: string;
    whatLearned: string;
    whatToChange: string;
  }[];
};

export type AllowedRefs = Map<string, string>; // id -> table
