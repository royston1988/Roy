export type Impact = "high" | "medium" | "low";
export type Urgency = "today" | "week" | "later";
export type Responsibility = "only-roy" | "roy-decides" | "team" | "should-not";
export type TimeNeeded = 15 | 30 | 60 | 120;
export type TaskDecision = "do-today" | "schedule" | "delegate" | "remove";

export type Task = {
  id: string;
  title: string;
  notes?: string;
  impact: Impact;
  urgency: Urgency;
  responsibility: Responsibility;
  timeNeeded: TimeNeeded;
  status: "todo" | "done";
  isTopPriority?: boolean;
  createdAt: string;
  completedAt?: string;
  // enriched by the backend
  score: number;
  recommendation: TaskDecision;
  recommendationLabel: string;
};

export type InboxClassification =
  | "do-now"
  | "schedule"
  | "delegate"
  | "waiting"
  | "remove";

export type InboxItem = {
  id: string;
  text: string;
  classification?: InboxClassification;
  reason?: string;
  createdAt: string;
  processed?: boolean;
};

export type BlockType =
  | "thinking"
  | "decision"
  | "meeting"
  | "review"
  | "people"
  | "personal";

export type CalendarBlock = {
  id: string;
  date: string;
  start: string;
  end: string;
  title: string;
  type: BlockType;
  taskId?: string;
};

export type Decision = {
  id: string;
  title: string;
  context?: string;
  status: "pending" | "decided";
  outcome?: string;
  owner?: string;
  deadline?: string;
  followUpDate?: string;
  createdAt: string;
  decidedAt?: string;
};

export type DelegationStatus = "in-progress" | "waiting" | "delayed" | "done";

export type Delegation = {
  id: string;
  matter: string;
  owner: string;
  expectedResult: string;
  deadline?: string;
  status: DelegationStatus;
  createdAt: string;
};

export type Meeting = {
  id: string;
  title: string;
  when?: string;
  goal: string;
  decisionsRequired: string;
  numbersToReview?: string;
  questions?: string;
  actionOwner?: string;
  deadline?: string;
  decisionMade?: string;
  followUpDate?: string;
  createdAt: string;
  warning?: string | null;
};

export type DailyReview = {
  date: string;
  importantResult?: string;
  timeOverrun?: string;
  toDelegate?: string;
  unfinishedDecision?: string;
  tomorrowPriority?: string;
  aiSummary?: string;
};

export type Day = { date: string; mainGoal?: string };

export type TimeReport = {
  from: string;
  to: string;
  totalHours: number;
  byType: Record<BlockType, number>;
  byTypePct: Record<BlockType, number>;
  quality: { high: number; delegatable: number; low: number };
  recommendations: string[];
};

export type PlanBlock = {
  start: string;
  end: string;
  title: string;
  type: BlockType;
};
