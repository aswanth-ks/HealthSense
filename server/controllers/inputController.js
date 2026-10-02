// User input: daily check-in, symptom log, adaptive-question answers (all stored as source: 'reported').
import mongoose from 'mongoose';
import Reading from '../models/Reading.js';
import SymptomLog from '../models/SymptomLog.js';
import Question from '../models/Question.js';
import TimelineEvent from '../models/TimelineEvent.js';
import { asyncHandler, httpError } from '../middleware/errorHandler.js';
import { cycleWindow } from '../engines/cycleEngine.js';
import { ACTIVITY_STEPS } from '../engines/missingDataEngine.js';
import { updateCycles } from '../services/cycleService.js';
import { SLOT } from '../services/loopService.js';
import { emitToUser } from '../utils/realtime.js';

const SYMPTOM_TYPES = ['pain', 'cramp', 'fatigue', 'wake_sudden', 'headache', 'mood', 'bloating', 'nausea', 'dizziness', 'breathless', 'other'];
const clampNum = (v, lo, hi) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Math.min(hi, Math.max(lo, Number(v))));

/** Replace any reported/estimated value of a cycle-level metric (sleep/steps) with a reported one. */
async function reportCycleValue(userId, metric, value, date = new Date()) {
  const { start, end } = cycleWindow(date);
  await Reading.deleteMany({ userId, metric, source: { $in: ['reported', 'estimated'] }, ts: { $gte: start, $lt: end } });
  await Reading.create({ userId, metric, value, ts: new Date(start.getTime() + SLOT[metric]), source: 'reported', confidence: 1 });
}

/** Answering an open question for the same field closes it. */
async function closeFieldQuestions(userId, field, answer) {
  await Question.updateMany({ userId, field, status: 'open' }, { $set: { status: 'answered', answer, answeredAt: new Date() } });
}

async function afterInput(userId) {
  await updateCycles(userId);
  emitToUser(userId, 'questions', { updated: true });
}

/**
 * POST /api/me/checkin
 * { sleepHours, sleepQuality(1-5), fatigue(0-10), pain(0-10), painLocation, cramps(bool), mood(1-5),
 *   period(bool), cycleDay, notes, date? }
 */
export const checkin = asyncHandler(async (req, res) => {
  const b = req.body || {};
  const userId = req.user._id;
  const when = b.date ? new Date(b.date) : new Date();
  const saved = [];

  const sleep = clampNum(b.sleepHours, 0, 16);
  if (sleep != null) {
    await reportCycleValue(userId, 'sleep', sleep, when);
    await closeFieldQuestions(userId, 'sleep', sleep);
    saved.push(`sleep ${sleep} h`);
  }
  const steps = clampNum(b.steps, 0, 100000);
  if (steps != null) {
    await reportCycleValue(userId, 'steps', steps, when);
    await closeFieldQuestions(userId, 'steps', steps);
  }

  const logs = [];
  const add = (type, severity, extra = {}) => logs.push({ userId, ts: when, type, severity, source: 'reported', ...extra });
  const fatigue = clampNum(b.fatigue, 0, 10);
  if (fatigue != null) add('fatigue', fatigue);
  const pain = clampNum(b.pain, 0, 10);
  if (pain != null && pain > 0) add('pain', pain, { location: b.painLocation || undefined });
  if (b.cramps) add('cramp', pain ?? 5, { location: b.painLocation || 'Lower abdomen' });
  const mood = clampNum(b.mood, 1, 5);
  if (mood != null) add('mood', mood);
  const quality = clampNum(b.sleepQuality, 1, 5);
  if (quality != null) add('sleep_quality', quality);
  if (b.notes) add('other', 0, { notes: String(b.notes).slice(0, 500) });
  if (logs.length) await SymptomLog.insertMany(logs);
  if (fatigue != null) saved.push(`fatigue ${fatigue}/10`);
  if (pain) saved.push(`pain ${pain}/10`);

  if (b.period) {
    const c = req.user.cycle || {};
    const last = c.lastPeriodStart ? new Date(c.lastPeriodStart) : null;
    const day = clampNum(b.cycleDay, 1, 60) || 1;
    const start = new Date(when.getTime() - (day - 1) * 24 * 3600_000);
    if (!last || Math.abs(start - last) > 10 * 24 * 3600_000) {
      req.user.cycle = { ...c, tracking: true, lastPeriodStart: start };
      await req.user.save();
    }
    saved.push(`period day ${day}`);
  }

  await TimelineEvent.create({ userId, ts: when, kind: 'symptom', title: 'Daily check-in', detail: saved.join(' · ') || 'Check-in saved' });
  await afterInput(userId);
  res.status(201).json({ ok: true, saved });
});

/** POST /api/me/symptoms { type, severity, location?, notes? } */
export const logSymptom = asyncHandler(async (req, res) => {
  const { type, severity, location, notes, ts } = req.body || {};
  if (!SYMPTOM_TYPES.includes(type)) throw httpError(400, `type must be one of ${SYMPTOM_TYPES.join(', ')}`);
  const when = ts && !Number.isNaN(new Date(ts).getTime()) && new Date(ts) <= new Date() ? new Date(ts) : new Date();
  const log = await SymptomLog.create({ userId: req.user._id, ts: when, type, severity: clampNum(severity, 0, 10) ?? 5, location, notes, source: 'reported' });
  await TimelineEvent.create({ userId: req.user._id, kind: 'symptom', title: 'Symptom logged', detail: `${type.replace('_', ' ')} · severity ${log.severity}/10` });
  await afterInput(req.user._id);
  res.status(201).json(log);
});

/** GET /api/me/symptoms?days=7 */
export const getSymptoms = asyncHandler(async (req, res) => {
  const days = Math.min(90, Number(req.query.days) || 7);
  const rows = await SymptomLog.find({ userId: req.user._id, ts: { $gte: new Date(Date.now() - days * 24 * 3600_000) } }).sort({ ts: -1 }).lean();
  res.json(rows);
});

const qOut = (q) => ({
  id: q._id, code: q.code, field: q.field, text: q.text, kind: q.kind, options: q.options, unit: q.unit,
  min: q.min, max: q.max, step: q.step, suggested: q.suggested, reason: q.reason, module: q.module,
  status: q.status, answer: q.answer, createdAt: q.createdAt, answeredAt: q.answeredAt,
});

/** GET /api/me/questions?status=open */
export const getQuestions = asyncHandler(async (req, res) => {
  const status = ['open', 'answered', 'dismissed'].includes(req.query.status) ? req.query.status : 'open';
  const rows = await Question.find({ userId: req.user._id, status }).sort({ createdAt: -1 }).limit(50).lean();
  res.json(rows.map(qOut));
});

/** Side effects of an answer: turn it into reported data the engines can use. */
async function applyAnswer(userId, q, answer) {
  const yes = answer === true || answer === 'yes' || answer === 'Yes';
  switch (q.code) {
    case 'missing.sleep':
      await reportCycleValue(userId, 'sleep', clampNum(answer, 0, 16) ?? 0, q.createdAt);
      break;
    case 'missing.steps':
      await reportCycleValue(userId, 'steps', ACTIVITY_STEPS[answer] ?? 5000, q.createdAt);
      break;
    case 'sleep.wake_sudden':
      if (yes) await SymptomLog.create({ userId, type: 'wake_sudden', severity: 6, source: 'reported', notes: 'Answered adaptive question' });
      break;
    case 'sleep.daytime_fatigue':
      await SymptomLog.create({ userId, type: 'fatigue', severity: clampNum(answer, 0, 10) ?? 0, source: 'reported', notes: 'Answered adaptive question' });
      break;
    case 'sleep.snoring':
      if (yes) await SymptomLog.create({ userId, type: 'other', severity: 5, notes: 'Reported loud snoring / witnessed pauses', source: 'reported' });
      break;
    case 'endo.period':
      if (yes) {
        const { default: User } = await import('../models/User.js');
        await User.updateOne({ _id: userId }, { $set: { 'cycle.tracking': true, 'cycle.lastPeriodStart': new Date() } });
      }
      break;
    default:
      break;
  }
}

/** POST /api/me/questions/:id/answer { answer } */
export const answerQuestion = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw httpError(400, 'Invalid id');
  const q = await Question.findOne({ _id: req.params.id, userId: req.user._id });
  if (!q) throw httpError(404, 'Question not found');
  if (q.status !== 'open') throw httpError(409, 'Question already closed');
  const { answer } = req.body || {};
  if (answer === undefined || answer === null || answer === '') throw httpError(400, 'answer is required');

  q.status = 'answered';
  q.answer = answer;
  q.answeredAt = new Date();
  await q.save();
  await applyAnswer(req.user._id, q, answer);
  const shown = typeof answer === 'boolean' ? (answer ? 'Yes' : 'No') : `${answer}${q.unit ? ` ${q.unit}` : ''}`;
  await TimelineEvent.create({ userId: req.user._id, kind: 'answer', title: 'User answered a question', detail: `${q.text} → ${shown}`, refs: { questionId: q._id } });
  await afterInput(req.user._id);
  res.json(qOut(q));
});

/** POST /api/me/questions/:id/dismiss */
export const dismissQuestion = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw httpError(400, 'Invalid id');
  const q = await Question.findOneAndUpdate({ _id: req.params.id, userId: req.user._id, status: 'open' }, { $set: { status: 'dismissed' } }, { new: true });
  if (!q) throw httpError(404, 'Open question not found');
  res.json(qOut(q));
});
