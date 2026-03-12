import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { leakDetector } from '../lib/leakDetector';
import { isStabilityMode } from '../lib/realtimeConfig';
import {
  recordRealtimeEvent,
  registerActiveChannel,
  unregisterActiveChannel,
} from '../lib/performanceMonitor';

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

const activeChannels = new Map<string, number>();

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
    if (isStabilityMode()) return;

    const existing = activeChannels.get(channelName) ?? 0;
    if (existing > 0) {
      if (import.meta.env.DEV) {
        console.warn(
          `[useRealtimeChannel] Duplicate channel detected: "${channelName}". ` +
          `Already ${existing} subscriber(s). Skipping subscription to prevent duplicate events.`
        );
      }
      activeChannels.set(channelName, existing + 1);
      return () => {
        const count = activeChannels.get(channelName) ?? 1;
        if (count <= 1) activeChannels.delete(channelName);
        else activeChannels.set(channelName, count - 1);
      };
    }

    activeChannels.set(channelName, 1);

    // Register in global performance monitor so DiagnosticsPanel can show active channels
    registerActiveChannel(channelName, tables);

    if (import.meta.env.DEV) {
      leakDetector?.realtimeChannels?.add?.(channelName);
    }

    const flush = () => {
      if (pendingEventsRef.current.length === 0) return;
      const batch = pendingEventsRef.current.splice(0);
      // Measure how long it takes to process the batch in the caller's callback
      const t0 = performance.now();
      onBatchEventsRef.current(batch);
      const processingMs = Math.round(performance.now() - t0);
      // Record event count + processing time for each channel event
      for (let i = 0; i < batch.length; i++) {
        recordRealtimeEvent(channelName, i === 0 ? processingMs : undefined);
      }
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

      const count = activeChannels.get(channelName) ?? 1;
      if (count <= 1) activeChannels.delete(channelName);
      else activeChannels.set(channelName, count - 1);

      // Unregister from global performance monitor
      unregisterActiveChannel(channelName);

      if (import.meta.env.DEV) {
        leakDetector?.realtimeChannels?.delete?.(channelName);
      }
    };
  }, [channelName, enabled, debounceMs, tables.join(',')]);
}
