import { supabase } from '../lib/supabase';
import type { Meeting, MeetingDetail, CreateMeetingData } from '../types/meetings';

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
    })
    .select()
    .single();

  if (error) throw error;
  return created;
}
