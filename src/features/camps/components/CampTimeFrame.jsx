import { getCampTimeFrameDisplay } from '../utils/campTimeFrame';

export function CampTimeFrame({
  camp,
  startTime,
  endTime,
  campSlot,
  durationHours,
  timeFrame,
  showLabel = false,
  compact = false,
  className = '',
}) {
  const data = getCampTimeFrameDisplay({
    camp,
    startTime,
    endTime,
    campSlot,
    durationHours,
    timeFrame,
  });

  if (!data.hasContent) {
    return <span className="camps-cell-empty">—</span>;
  }

  const rootClass = [
    'camp-time-frame',
    compact ? 'camp-time-frame--compact' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={rootClass}>
      {showLabel ? <span className="camp-time-frame-label">Time Frame</span> : null}
      <div className="camp-time-frame-card">
        <div className="camp-time-frame-top">
          {data.slot || data.durationHours ? (
            <span className="camp-time-frame-slot">
              {data.slot || '—'}
              {data.durationHours ? (
                <span className="camp-time-frame-duration">{data.durationHours} hr</span>
              ) : null}
            </span>
          ) : null}
        </div>
        {data.timeRange ? (
          <div className="camp-time-frame-range">{data.timeRange}</div>
        ) : null}
      </div>
    </div>
  );
}
