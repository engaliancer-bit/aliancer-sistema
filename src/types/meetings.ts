export type MeetingSource = 'manual' | 'meet' | 'zoom';
export type MeetingStatus = 'imported' | 'processing' | 'processed' | 'approved';
export type TaskPriority = 'low' | 'medium' | 'high';
export type TaskStatus = 'pending' | 'in_progress' | 'done';

export interface Meeting {
  id: string;
  title: string;
  date: string;
  project_id: string | null;
  transcript: string;
  summary: string;
  source: MeetingSource;
  status: MeetingStatus;
  created_at: string;
}

export interface MeetingTopic {
  id: string;
  meeting_id: string;
  title: string;
  summary: string;
  order_index: number;
  created_at: string;
}

export interface MeetingTask {
  id: string;
  meeting_id: string;
  description: string;
  responsible_name: string;
  due_date: string | null;
  priority: TaskPriority;
  category: string;
  status: TaskStatus;
  created_at: string;
}

export interface MeetingDetail extends Meeting {
  topics: MeetingTopic[];
  tasks: MeetingTask[];
}

export interface CreateMeetingData {
  title: string;
  date: string;
  project_id?: string | null;
  transcript?: string;
  summary?: string;
  source: MeetingSource;
  status?: MeetingStatus;
}
