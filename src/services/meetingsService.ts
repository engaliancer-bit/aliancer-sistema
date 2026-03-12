import { supabase } from '../lib/supabase';
import type { Meeting, MeetingDetail, MeetingTask, CreateMeetingData } from '../types/meetings';

export async function getMeetings(): Promise<Meeting[]> {
  const { data, error } = await supabase
    .from('meetings')
    .select('*')
    .order('date', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getMeetingById(id: string): Promise<MeetingDetail> {
  const [meetingRes, topicsRes, tasksRes] = await Promise.all([
    supabase.from('meetings').select('*').eq('id', id).maybeSingle(),
    supabase.from('meeting_topics').select('*').eq('meeting_id', id).order('order_index'),
    supabase.from('meeting_tasks').select('*').eq('meeting_id', id).order('created_at'),
  ]);

  if (meetingRes.error) throw meetingRes.error;
  if (!meetingRes.data) throw new Error('Reunião não encontrada');
  if (topicsRes.error) throw topicsRes.error;
  if (tasksRes.error) throw tasksRes.error;

  return {
    ...meetingRes.data,
    topics: topicsRes.data ?? [],
    tasks: tasksRes.data ?? [],
  };
}

export async function createMeeting(data: CreateMeetingData): Promise<Meeting> {
  const { data: { user } } = await supabase.auth.getUser();

  const { data: created, error } = await supabase
    .from('meetings')
    .insert({
      title: data.title,
      date: data.date,
      project_id: data.project_id ?? null,
      transcript: data.transcript ?? '',
      summary: data.summary ?? '',
      source: data.source,
      status: data.status ?? 'imported',
      created_by: user?.id ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message || 'Erro desconhecido ao salvar no banco');
  return created;
}

export async function processMeetingWithAI(meetingId: string): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase.functions.invoke('process-meeting-import', {
    body: { meeting_id: meetingId },
  });

  if (error) {
    return { success: false, error: error.message ?? 'Erro ao chamar a função de IA' };
  }

  if (data && data.success === false) {
    return { success: false, error: data.error ?? 'Falha no processamento' };
  }

  return { success: true };
}

export async function updateMeetingTask(
  taskId: string,
  data: Partial<Pick<MeetingTask, 'responsible_name' | 'due_date' | 'status' | 'priority' | 'description' | 'category'>>,
): Promise<MeetingTask> {
  const { data: updated, error } = await supabase
    .from('meeting_tasks')
    .update(data)
    .eq('id', taskId)
    .select()
    .single();

  if (error) throw error;
  return updated;
}

export async function updateMeetingStatus(meetingId: string, status: string): Promise<void> {
  const { error } = await supabase
    .from('meetings')
    .update({ status })
    .eq('id', meetingId);

  if (error) throw error;
}
