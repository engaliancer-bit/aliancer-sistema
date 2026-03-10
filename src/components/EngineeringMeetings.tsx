import { useState, lazy, Suspense } from 'react';
import LoadingFallback from './LoadingFallback';

const MeetingsList = lazy(() => import('./meetings/MeetingsList'));
const MeetingNew = lazy(() => import('./meetings/MeetingNew'));
const MeetingDetail = lazy(() => import('./meetings/MeetingDetail'));

type View = { type: 'list' } | { type: 'new' } | { type: 'detail'; id: string };

export default function EngineeringMeetings() {
  const [view, setView] = useState<View>({ type: 'list' });

  return (
    <Suspense fallback={<LoadingFallback />}>
      {view.type === 'list' && (
        <MeetingsList
          onNewMeeting={() => setView({ type: 'new' })}
          onViewMeeting={(id) => setView({ type: 'detail', id })}
        />
      )}
      {view.type === 'new' && (
        <MeetingNew
          onBack={() => setView({ type: 'list' })}
          onCreated={(id) => setView({ type: 'detail', id })}
        />
      )}
      {view.type === 'detail' && (
        <MeetingDetail
          meetingId={view.id}
          onBack={() => setView({ type: 'list' })}
        />
      )}
    </Suspense>
  );
}
