// Shared domain types for Roy — a CEO attention-management system.

export type Impact = "high" | "medium" | "low";
export type Urgency = "today" | "week" | "later";
export type Responsibility = "only-roy" | "roy-decides" | "team" | "should-not";
export type TimeNeeded = 15 | 30 | 60 | 120; // minutes; 120 == "more than 1 hour"

export type TaskDecision =
  | "do-today"
  | "schedule"
  | "delegate"
  | "remove";

export type Task = {
  id: string;
  title: string;
  notes?: string;
  impact: Impact;
  urgency: Urgency;
  responsibility: Responsibility;
  timeNeeded: TimeNeeded;
  status: "todo" | "done";
  isTopPriority?: boolean; // pinned into Today's top 3
  createdAt: string;
  completedAt?: string;
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
  createdAt: string;
  processed?: boolean; // moved out of the inbox into a task/decision/delegation
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
  date: string; // YYYY-MM-DD
  start: string; // HH:MM (24h)
  end: string; // HH:MM (24h)
  title: string;
  type: BlockType;
  taskId?: string;
};

export type DecisionStatus = "pending" | "decided";

export type Decision = {
  id: string;
  title: string;
  context?: string;
  status: DecisionStatus;
  outcome?: string;
  owner?: string;
  deadline?: string; // YYYY-MM-DD
  followUpDate?: string; // YYYY-MM-DD
  createdAt: string;
  decidedAt?: string;
};

export type DelegationStatus = "in-progress" | "waiting" | "delayed" | "done";

export type Delegation = {
  id: string;
  matter: string;
  owner: string;
  expectedResult: string;
  deadline?: string; // YYYY-MM-DD
  status: DelegationStatus;
  createdAt: string;
};

export type Meeting = {
  id: string;
  title: string;
  when?: string; // ISO datetime or free text
  goal: string;
  decisionsRequired: string;
  numbersToReview?: string;
  questions?: string;
  actionOwner?: string;
  deadline?: string;
  // captured after the meeting
  decisionMade?: string;
  followUpDate?: string;
  createdAt: string;
};

export type DailyReview = {
  date: string; // YYYY-MM-DD (one per day)
  importantResult?: string;
  timeOverrun?: string;
  toDelegate?: string;
  unfinishedDecision?: string;
  tomorrowPriority?: string;
  aiSummary?: string;
};

export type Day = {
  date: string; // YYYY-MM-DD
  mainGoal?: string;
};

export type Database = {
  tasks: Task[];
  inbox: InboxItem[];
  blocks: CalendarBlock[];
  decisions: Decision[];
  delegations: Delegation[];
  meetings: Meeting[];
  reviews: DailyReview[];
  days: Day[];
};
