import { RiskEvent } from '@/types';
import { cn } from '@/lib/utils';
import { useBoardStore } from '@/store';
import Empty from '@/components/Empty';
import EventCard from '@/components/EventCard';

interface EventListProps {
  events: RiskEvent[];
  selectedEventId: string | null;
  onSelect: (id: string | null) => void;
}

export default function EventList({
  events,
  selectedEventId,
  onSelect,
}: EventListProps) {
  const selectedEventIds = useBoardStore((s) => s.selectedEventIds);
  const toggleEventSelection = useBoardStore((s) => s.toggleEventSelection);

  if (!events || events.length === 0) {
    return (
      <div className="h-full min-h-[400px]">
        <Empty />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-4',
        'sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-2'
      )}
    >
      {events.map((event) => (
        <EventCard
          key={event.event_id}
          event={event}
          selected={selectedEventId === event.event_id}
          batchSelected={selectedEventIds.has(event.event_id)}
          onBatchSelect={() => toggleEventSelection(event.event_id)}
          onClick={() =>
            onSelect(selectedEventId === event.event_id ? null : event.event_id)
          }
        />
      ))}
    </div>
  );
}
