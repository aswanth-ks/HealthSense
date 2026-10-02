// Runs the risk modules + triage after each cycle update and closes the loop into the next cycle.
import Cycle from '../models/Cycle.js';
import Baseline from '../models/Baseline.js';
import SymptomLog from '../models/SymptomLog.js';
import Question from '../models/Question.js';
import TriageEvent from '../models/TriageEvent.js';
import TimelineEvent from '../models/TimelineEvent.js';
import User from '../models/User.js';
import { assessSleepRisk } from '../modules/sleepRisk.js';
import { assessEndoSymptoms } from '../modules/endoSymptoms.js';
import { triage, nextCyclePriority, levelChange } from '../engines/triageEngine.js';
import { interpret } from '../engines/baselineEngine.js';
import { APNEA_EVENT_NIGHT, cycleQuestions } from '../engines/questionEngine.js';
import { analyzeMenstrual, cycleSymptoms } from './menstrualService.js';
import { dayContext } from '../engines/menstrualEngine.js';
import MenstrualCycle from '../models/MenstrualCycle.js';
import { ask } from './loopService.js';
import { emitToUser } from '../utils/realtime.js';

const DAY = 24 * 3600_000;
const VITAL_LABEL = { hr: 'Heart rate', spo2: 'SpO₂', temp: 'Temperature', resp: 'Respiratory rate' };
const plainBaseline = (b) => (b ? { established: b.established, metrics: b.metrics instanceof Map ? Object.fromEntries(b.metrics) : b.metrics || {} } : { established: false, metrics: {} });

async function latestAnswers(userId) {
  const qs = await Question.find({ userId, status: 'answered', answeredAt: { $gte: new Date(Date.now() - 30 * DAY) } }).sort({ answeredAt: 1 }).lean();
  return Object.fromEntries(qs.map((q) => [q.code, q.answer]));
}

async function timelineOnce(userId, key, event) {
  if (await TimelineEvent.exists({ userId, 'refs.key': key })) return false;
  await TimelineEvent.create({ userId, ...event, refs: { ...(event.refs || {}), key } });
  return true;
}

export async function runTriage(userId) {
  const [user, baselineDoc, cycles, symptoms, answers] = await Promise.all([
    User.findById(userId).lean(),
    Baseline.findOne({ userId }).lean(),
    Cycle.find({ userId }).sort({ start: -1 }).limit(14).lean(),
    SymptomLog.find({ userId, ts: { $gte: new Date(Date.now() - 60 * DAY) } }).lean(),
    latestAnswers(userId),
  ]);
  if (!cycles.length) {
    // No monitoring data yet — cycle-history questions can still reduce uncertainty
    if (user?.cycle?.tracking) {
      const mens0 = await analyzeMenstrual(userId, user);
      const recent = await Question.find({ userId, status: 'answered', answeredAt: { $gte: new Date(Date.now() - 30 * 24 * 3600_000) } }).select('code').lean();
      for (const q of cycleQuestions({ context: mens0.context, pattern: mens0.pattern, answered: new Set(recent.map((r) => r.code)) })) {
        await ask(userId, undefined, q, q.code === 'cycle.period_started' ? 'missing' : 'endoSymptoms');
      }
    }
    return null;
  }
  const baseline = plainBaseline(baselineDoc);

  // Menstrual cycle context (only when the user enabled tracking): a learned, per-person pattern
  const mens = await analyzeMenstrual(userId, user);
  const mensCycles = mens ? await MenstrualCycle.find({ userId }).select('startDate').lean() : [];
  const endoSymptoms = mens ? await cycleSymptoms(userId) : symptoms;

  const modules = [
    assessSleepRisk({ cycles, symptoms, answers, baseline }),
    assessEndoSymptoms({ symptoms: endoSymptoms, cycles, user, answers, cyclePattern: mens?.pattern }),
  ];

  // General deviations: yesterday's averages vs the personal baseline
  const deviations = [];
  const lastClosed = cycles.find((c) => c.status === 'closed' && (c.completeness ?? 0) >= 0.5);
  if (lastClosed && baseline.established) {
    for (const m of ['hr', 'spo2', 'temp', 'resp']) {
      const v = lastClosed.aggregates?.[m]?.mean;
      // Cycle-aware: judge a day in its menstrual-cycle context when a cycle baseline exists for it
      const cb = mens?.baselines?.find((b) => b.metric === m && b.cycleContext === dayContext(lastClosed.start, mensCycles)?.context);
      const stat = cb ? { mean: cb.baselineValue, sd: Math.max((cb.range.hi - cb.range.lo) / 3, 0.01) } : baseline.metrics[m];
      if (v == null || !stat) continue;
      const i = interpret(m, +v.toFixed(1), stat, VITAL_LABEL[m]);
      if (i.band === 'above' || i.band === 'below') deviations.push({ text: `${VITAL_LABEL[m]} ${i.band} your personal baseline (${v.toFixed(1)} vs ${stat.mean})`, weight: 8, metric: m });
    }
  }

  const result = triage(modules, deviations);
  const priority = nextCyclePriority(result, modules);
  // Record explicitly what in this cycle shaped the next one (closed loop)
  priority.influencedBy = [
    ...(modules[0].active ? [`Night-time breathing/SpO₂ pattern across ${modules[0].pattern.disturbedNights} nights`] : []),
    ...(mens?.pattern?.detected ? [`Cycle-associated symptom pattern across ${mens.pattern.cyclesMatched} menstrual cycles (days 1–3)`] : []),
    ...(!mens?.pattern?.detected && modules[1].active ? [`Strong pain reported on ${modules[1].pattern.painDays} days`] : []),
  ];

  // Adaptive questions from cycle context (one step at a time, only when they reduce uncertainty)
  if (mens) {
    const recent = await Question.find({ userId, status: 'answered', answeredAt: { $gte: new Date(Date.now() - 30 * 24 * 3600_000) } }).select('code').lean();
    for (const q of cycleQuestions({ context: mens.context, pattern: mens.pattern, answered: new Set(recent.map((r) => r.code)) })) {
      await ask(userId, cycles[0]._id, q, q.code === 'cycle.period_started' ? 'missing' : 'endoSymptoms');
    }
  }
  const [current, previous] = cycles;

  // ---- Closed loop ----
  // Cycle N stores what it learned (nextPriority); cycle N+1 inherits it (appliedPriority) when it starts.
  const update = {
    triage: { level: result.level, confidence: result.confidence },
    findings: modules.flatMap((m) => m.evidence.map((e) => ({ code: `${m.module}.${e.code}`, text: e.text, severity: e.weight }))),
    nextPriority: { ...priority, fromCycle: current.index, at: new Date() },
    assessment: {
      result, modules, deviations,
      menstrual: mens ? {
        cycleDay: mens.context.cycleDay ?? null,
        period: mens.context.period?.status ?? null,
        pattern: mens.pattern.detected ? { summary: mens.pattern.summary, cyclesMatched: mens.pattern.cyclesMatched } : null,
      } : null,
    },
  };
  if (!current.appliedPriority && previous?.nextPriority) update.appliedPriority = previous.nextPriority;
  // Every cycle keeps its own observations (shown as "what happened" in the closed-loop view)
  for (const c of cycles.slice(1, 3)) {
    if (c.findings?.length) continue;
    const f = [];
    if (c.events?.respPauses) f.push({ code: 'night.resp', text: `${c.events.respPauses} respiratory pauses during the night`, severity: 5 });
    if (c.events?.spo2Dips) f.push({ code: 'night.spo2', text: `${c.events.spo2Dips} SpO₂ dips to 93% or lower`, severity: 5 });
    if (c.sleep?.hours != null) f.push({ code: 'sleep', text: `Sleep ${c.sleep.hours} h (${c.sleep.source})`, severity: 0 });
    if (!f.length) f.push({ code: 'normal', text: 'No night-time disturbances; readings within baseline', severity: 0 });
    await Cycle.updateOne({ _id: c._id }, { $set: { findings: f } });
  }
  // A closed cycle's learning is frozen once the next cycle has started
  await Cycle.updateOne({ _id: current._id }, { $set: update });
  if (previous && !previous.nextPriority && current.status === 'open') {
    await Cycle.updateOne({ _id: previous._id }, { $set: { nextPriority: { ...priority, fromCycle: previous.index, at: new Date() } } });
  }

  // ---- Timeline: significant events ----
  for (const c of [...cycles].reverse()) {
    const ev = (c.events?.spo2Dips || 0) + (c.events?.respPauses || 0);
    if (ev >= APNEA_EVENT_NIGHT) {
      await timelineOnce(userId, `night:${c._id}`, {
        ts: new Date(c.start.getTime() + 4 * 3600_000), kind: 'deviation',
        title: 'Sleep disturbance detected',
        detail: `${c.events.respPauses} respiratory pauses and ${c.events.spo2Dips} SpO₂ dips during the night.`,
      });
    }
  }
  const sleep = modules[0];
  if (sleep.pattern.disturbedNights >= 2) {
    await timelineOnce(userId, `pattern:sleep:${cycles.find((c) => (c.events?.spo2Dips || 0) + (c.events?.respPauses || 0) >= APNEA_EVENT_NIGHT)?._id}`, {
      kind: 'deviation', title: 'Repeated respiratory deviation',
      detail: `Pattern observed across ${sleep.pattern.disturbedNights} nights — deviation from personal baseline.`,
    });
  }
  for (const d of deviations) {
    await timelineOnce(userId, `dev:${lastClosed._id}:${d.metric}`, { ts: new Date(lastClosed.start.getTime() + 12 * 3600_000), kind: 'deviation', title: 'Deviation from personal baseline', detail: d.text });
  }

  // ---- Triage change ----
  const prev = await TriageEvent.findOne({ userId }).sort({ ts: -1 }).lean();
  let changed = null;
  if (!prev || prev.level !== result.level) {
    changed = levelChange(prev?.level, result.level);
    await TriageEvent.create({ userId, cycleId: current._id, level: result.level, prevLevel: prev?.level || null, reasons: result.reasons, confidence: result.confidence, module: result.module });
    await TimelineEvent.create({
      userId, kind: 'triage',
      title: changed === 'initial' ? `Triage level set: ${result.level}` : `Triage level ${changed}: ${prev.level} → ${result.level}`,
      detail: result.reasons.slice(0, 4).join(' · '),
    });
  }

  // ---- Priority change ----
  const prevReason = current.nextPriority?.reason ?? previous?.nextPriority?.reason;
  if (priority.metrics.length && prevReason !== priority.reason) {
    await TimelineEvent.create({ userId, kind: 'priority', title: 'Next monitoring cycle re-prioritised', detail: priority.reason });
  }

  emitToUser(userId, 'triage', { level: result.level, changed });
  return { result, modules, priority, changed };
}
