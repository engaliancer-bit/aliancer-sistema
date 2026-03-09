import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { leakDetector } from '../lib/leakDetector';

export interface RealtimeEvent {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  new: Record<string, unknown>;
  old: Record<string, unknown>;
}

interface UseRealtimeChannelOptions {
  channelName: string;
  tables: string[];
  onBatchEvents: (events: RealtimeEvent[]) => void;
  enabled?: boolean;
  debounceMs?: number;
}

export function useRealtimeChannel({
  channelName,
  tables,
  onBatchEvents,
  enabled = true,
  debounceMs = 300,
}: UseRealtimeChannelOptions) {
  const onBatchEventsRef = useRef(onBatchEvents);
  onBatchEventsRef.current = onBatchEvents;

  const pendingEventsRef = useRef<RealtimeEvent[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled || tables.length === 0) return;

    if (import.meta.env.DEV) {
      leakDetector?.realtimeChannels?.add?.(channelName);
    }

    const flush = () => {
      if (pendingEventsRef.current.length === 0) return;
      const batch = pendingEventsRef.current.splice(0);
      onBatchEventsRef.current(batch);
    };

    const scheduleFlush = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(flush, debounceMs);
    };

    const channel = supabase.channel(channelName);

    for (const table of tables) {
      channel.on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table },
        (payload: any) => {
          pendingEventsRef.current.push({
            eventType: payload.eventType,
            table: payload.table,
            new: payload.new ?? {},
            old: payload.old ?? {},
          });
          scheduleFlush();
        }
      );
    }

    channel.subscribe();

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      pendingEventsRef.current = [];
      supabase.removeChannel(channel);
      if (import.meta.env.DEV) {
        leakDetector?.realtimeChannels?.delete?.(channelName);
      }
    };
  }, [channelName, enabled, debounceMs, tables.join(',')]);
}
