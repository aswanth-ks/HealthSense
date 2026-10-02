// Adaptive question engine (spec §27-E). Pure functions.
// Looks at recent cycles + symptoms and asks for the information needed to interpret a pattern.

export const APNEA_EVENT_NIGHT = 3; // a night with ≥3 dips/pauses counts as "disturbed"

/**
 * cycles: recent cycles, newest first, with { id, start, events, sleep }
 * symptoms: recent symptom logs [{ type, severity, ts }]
 * answered: Set of question codes answered in the last few days
 * user: { cycle: { tracking, lastPeriodStart } }
 * returns [{ code, text, kind, options?, min?, max?, reason, field? }]
 */
export function patternQuestions({ cycles, symptoms, answered, user }) {
  const out = [];
  const recent = cycles.slice(0, 7);

  // Sleep-related pattern: repeated disturbed nights
  const disturbed = recent.filter((c) => (c.events?.spo2Dips || 0) + (c.events?.respPauses || 0) >= APNEA_EVENT_NIGHT);
  if (disturbed.length >= 2) {
    const totalEvents = disturbed.reduce((a, c) => a + c.events.spo2Dips + c.events.respPauses, 0);
    const basis = `${totalEvents} breathing/oxygen disturbances across ${disturbed.length} nights`;
    if (!answered.has('sleep.wake_sudden')) {
      out.push({
        code: 'sleep.wake_sudden', kind: 'yesno',
        text: 'You have experienced repeated nighttime disturbances. Did you wake suddenly during sleep?',
        reason: `Detected ${basis}. Knowing whether you woke up helps tell a sensor artefact from a real breathing pattern.`,
      });
    } else if (!answered.has('sleep.daytime_fatigue')) {
      out.push({
        code: 'sleep.daytime_fatigue', kind: 'scale', min: 0, max: 10,
        text: 'How tired have you felt during the day this week?',
        reason: `Follow-up to ${basis}. Daytime tiredness is an important part of the sleep-related risk picture.`,
      });
    } else if (!answered.has('sleep.snoring')) {
      out.push({
        code: 'sleep.snoring', kind: 'yesno',
        text: 'Has anyone told you that you snore loudly or stop breathing in your sleep?',
        reason: `Follow-up to ${basis}.`,
      });
    }
  }

  // Endometriosis-associated symptom pattern: recurring pain/cramps
  const painDays = new Set(
    symptoms.filter((s) => ['pain', 'cramp'].includes(s.type) && s.severity >= 6).map((s) => new Date(s.ts).toDateString())
  );
  if (painDays.size >= 2) {
    // Menstrual questions are only asked when the user opted in to cycle tracking (see cycleQuestions)
    if (!answered.has('endo.activity_impact')) {
      out.push({
        code: 'endo.activity_impact', kind: 'yesno',
        text: 'Did the pain stop you from doing your usual daily activities?',
        reason: `Strong pain was reported on ${painDays.size} days. Impact on daily life is part of the symptom pattern.`,
      });
    }
  }

  return out;
}

/**
 * Cycle-context questions — only asked when they reduce meaningful uncertainty, one step at a time.
 * context: cycleContext(); pattern: recurringPattern(); answered: Set of recently answered codes.
 */
export function cycleQuestions({ context, pattern, answered }) {
  const out = [];
  if (!context?.tracking || !context.known) return out;

  // Missing history: only the latest period is known → ask (once) for the previous one
  if (context.missing?.includes('previous_period_start') && !answered.has('cycle.previous_start')) {
    out.push({
      code: 'cycle.previous_start', field: 'cycle', kind: 'choice',
      options: ['About 3–4 weeks before', 'About 5–6 weeks before', 'More than 6 weeks before', 'Not sure'],
      text: 'Do you remember approximately when your previous period started?',
      reason: 'HealthSense knows your most recent period start but not the one before it. Knowing it improves your cycle estimate.',
    });
  }

  // Missing data: the expected period hasn't been recorded
  const overdueBy = context.nextPeriod ? context.cycleDayRaw > context.length.days + 3 : context.cycleDayRaw > 45;
  if (overdueBy && !answered.has('cycle.period_started')) {
    const expected = context.nextPeriod ? new Date(context.nextPeriod.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : null;
    out.push({
      code: 'cycle.period_started', field: 'cycle', kind: 'yesno',
      text: expected ? `Has your period started since ${expected}?` : 'Has a new period started since your last recorded one?',
      reason: expected
        ? `Your next period was estimated for ${expected} (${Math.round(context.nextPeriod.confidence * 100)}% confidence) but no start has been recorded. Cycle context for your other readings depends on it.`
        : 'Your last recorded period was a while ago. Cycle context for your other readings depends on it.',
    });
  }

  if (pattern?.detected) {
    const basis = `${pattern.cyclesMatched} recent cycles show strong pain on cycle days 1–3`;
    if (!answered.has('cycle.pain_duration')) {
      out.push({
        code: 'cycle.pain_duration', kind: 'choice', options: ['Less than a day', '1–2 days', '3 or more days', 'It varies'],
        text: 'Your recent cycles show a recurring pain pattern. How long does the pain typically last?',
        reason: `${basis}. Knowing the usual duration helps describe the pattern accurately.`,
      });
    } else if (!answered.has('endo.activity_impact')) {
      out.push({
        code: 'endo.activity_impact', kind: 'yesno',
        text: 'Does the pain significantly affect your normal activities?',
        reason: `Follow-up: ${basis}. Impact on daily life is part of the pattern a clinician would want to know.`,
      });
    } else if (!answered.has('cycle.pain_outside_period')) {
      out.push({
        code: 'cycle.pain_outside_period', kind: 'yesno',
        text: 'Does the pain occur outside your menstrual period?',
        reason: `Follow-up: ${basis}. Whether pain is limited to the period changes how the pattern is described.`,
      });
    }
  }
  return out;
}
