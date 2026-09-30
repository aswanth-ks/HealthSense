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
    if (!user?.cycle?.tracking && !answered.has('endo.period')) {
      out.push({
        code: 'endo.period', kind: 'yesno',
        text: 'Are you currently on your period, or did it start in the last few days?',
        reason: `You reported strong pain or cramps on ${painDays.size} days. Linking them to your cycle shows whether the pain follows a monthly pattern.`,
      });
    } else if (!answered.has('endo.activity_impact')) {
      out.push({
        code: 'endo.activity_impact', kind: 'yesno',
        text: 'Did the pain stop you from doing your usual daily activities?',
        reason: `Strong pain was reported on ${painDays.size} days. Impact on daily life is part of the symptom pattern.`,
      });
    }
  }

  return out;
}
