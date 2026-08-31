export type MorningEvidenceBundle = {
  date: string;
  pillars: {
    categoryId: string;
    categoryName: string;
    whyItMatters: string | null;
    standards: { id: string; statement: string }[];
    activeGoals: {
      id: string;
      tier: string;
      kind: string;
      title: string;
      priority: number;
      targetDate: string | null;
      daysUntilTarget: number | null;
    }[];
    recentActivityDays: number; // distinct days with completed activity in the lookback window
  }[];
  weeklyPriorities: {
    rank: number;
    kind: string;
    label: string;
    categoryName: string;
    score: number;
    factors: { name: string; points: number; detail: string }[];
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
  recurringBehaviours: {
    goalId: string;
    goalTitle: string;
    categoryName: string;
    period: string;
    targetFrequency: number;
    currentCount: number;
    currentTarget: number;
    currentMet: boolean;
    doneToday: boolean;
    streak: number;
  }[];
  recentPrimeActions: {
    date: string;
    title: string;
    categoryName: string;
    linkedGoalId: string | null;
    status: string;
  }[];
  recentEveningReviews: {
    date: string;
    rawText: string;
    energyRating: number | null;
    dayRating: number | null;
  }[];
  todaysExistingActions: { title: string; categoryName: string; linkedGoalId: string | null }[];
};

export type AllowedPillarIds = Set<string>;
/** goalId -> categoryId, restricted to active weekly-tier goals — the only goals a Prime Action can link to. */
export type WeeklyGoalCategoryById = Map<string, string>;
