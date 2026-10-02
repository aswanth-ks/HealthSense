import { Moon, Footprints, GraduationCap, Database } from 'lucide-react';
import Card from '../common/Card.jsx';
import SourceBadge from '../common/SourceBadge.jsx';
import { useInput } from '../../context/InputContext.jsx';

const pct = (v) => `${Math.round((v ?? 0) * 100)}%`;

function Row({ icon: Icon, label, children, action }) {
  return (
    <div className="flex items-start gap-3 py-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-canvas text-ink-soft"><Icon size={15} /></span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-ink-mute">{label}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-sm font-medium">{children}</div>
      </div>
      {action}
    </div>
  );
}

// Today's 24-hour monitoring cycle at a glance: progress, completeness, baseline, sleep and activity.
export default function TodayCard({ today, baseline, lastCycle }) {
  const { openCheckin } = useInput();
  const progress = today ? Math.round((today.hoursElapsed / 24) * 100) : 0;

  return (
    <Card eyebrow={today ? `Monitoring cycle ${today.cycleIndex}` : 'Today'} title="Today so far">
      {today ? (
        <>
          <div>
            <div className="flex justify-between text-[11px] text-ink-mute"><span>24-hour cycle</span><span>{progress}% elapsed</span></div>
            <div className="mt-1.5 h-1.5 rounded-full bg-line"><div className="h-full rounded-full bg-brand-500" style={{ width: `${progress}%` }} /></div>
          </div>
          <div className="mt-2 divide-y divide-line">
            <Row icon={Database} label="Data completeness">
              {pct(today.completeness)}
              <span className="text-xs font-normal text-ink-mute">· confidence {pct(today.confidence)}</span>
            </Row>
            <Row
              icon={Moon}
              label="Sleep last night"
              action={(!today.sleep || today.sleep.source === 'estimated') && (
                <button onClick={() => openCheckin({ values: { sleepHours: today.sleep?.hours ?? '' } })} className="text-[11px] text-brand-700 hover:underline">
                  {today.sleep ? 'Correct' : 'Add'}
                </button>
              )}
            >
              {today.sleep ? <>{today.sleep.hours} h <SourceBadge source={today.sleep.source} confidence={today.sleep.confidence} /></> : <span className="font-normal text-ink-mute">Not recorded yet</span>}
            </Row>
            <Row icon={Footprints} label="Activity today">
              {today.steps ? <>{today.steps.value.toLocaleString()} steps <SourceBadge source={today.steps.source} confidence={today.steps.confidence} /></> : <span className="font-normal text-ink-mute">No data yet</span>}
            </Row>
            <Row icon={GraduationCap} label="Personal baseline">
              {baseline?.established
                ? <span className="text-brand-700">Established · {baseline.daysUsed} days</span>
                : <span className="text-amber-700">Learning · {baseline?.daysUsed || 0}/3 days</span>}
            </Row>
          </div>
        </>
      ) : (
        <div className="space-y-3 text-sm text-ink-soft">
          <p>{lastCycle
            ? <>No data received today yet. Your last monitoring cycle was <b className="text-ink">{new Date(lastCycle.start).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</b>.</>
            : 'Your first 24-hour cycle starts when the watch sends data.'}</p>
          <p className="text-xs text-ink-mute">Wear your watch (or start the simulator) and today's cycle will begin automatically.</p>
          <button onClick={() => openCheckin()} className="text-xs font-medium text-brand-700 hover:underline">Add today's check-in →</button>
          <p className="border-t border-line pt-3 text-xs">Personal baseline: {baseline?.established ? <span className="text-brand-700">established · {baseline.daysUsed} days</span> : <span className="text-amber-700">learning · {baseline?.daysUsed || 0}/3 days</span>}</p>
        </div>
      )}
    </Card>
  );
}
