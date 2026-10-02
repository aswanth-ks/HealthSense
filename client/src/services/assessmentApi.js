// 3-Day Assessment API. Signed-in users always get their real assessment; sample-data mode gets a clearly
// labelled sample. On failure the page shows "Connection unavailable" — never a fake assessment.
import api from './api.js';
import { isDemo } from './healthService.js';
import { sampleAssessment } from './assessmentSample.js';

export async function getLatestAssessment({ force = false } = {}) {
  if (isDemo()) return sampleAssessment();
  if (force) {
    const { data } = await api.post('/assessments', { assessment_type: '3_day', force_recalculate: true });
    return data;
  }
  const { data } = await api.get('/assessments/latest', { timeout: 45_000 });
  return data;
}

export async function getEvidence(id, { patternId, target } = {}) {
  if (isDemo()) {
    const a = sampleAssessment();
    const ids = patternId ? new Set(a.patterns.find((p) => p.pattern_id === patternId)?.evidence_ids) : target ? new Set(a.professional_evaluation.evidence_ids) : null;
    return { evidence: ids ? a.evidence.filter((e) => ids.has(e.id)) : a.evidence };
  }
  const { data } = await api.get(`/assessments/${id}/evidence`, { params: { pattern_id: patternId, target } });
  return data;
}

export async function sendFeedback(id, helpful) {
  if (isDemo()) return { ok: true };
  const { data } = await api.post(`/assessments/${id}/feedback`, { helpful });
  return data;
}
