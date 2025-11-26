export interface WorkDraft {
  actionUID: number;
  title: string;
  plantSelection: string[];
  plantCount: number;
  feedback: string;
  media: File[];
  metadata?: Record<string, unknown>;
}

export interface WorkApprovalDraft {
  actionUID: number;
  workUID: string;
  approved: boolean;
  feedback?: string;
}
