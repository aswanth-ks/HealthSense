import Reading, { METRICS } from '../models/Reading.js';
import { asyncHandler, httpError } from '../middleware/errorHandler.js';
import { emitToUser } from '../utils/realtime.js';
import { scheduleCycleUpdate } from '../services/cycleService.js';

const MAX_BATCH = 5000;
const clamp01 = (v) => Math.min(1, Math.max(0, v));

/**
 * POST /api/ingest   (header: x-device-key)
 * body: { deviceId, firmware?, battery?, mode?: 'sensor'|'simulation',
 *         readings: [{ metric, value, ts?, quality? }] }
 * `ts` is ISO or epoch ms (defaults to now); `quality` 0-1 becomes the reading's confidence.
 */
export const ingest = asyncHandler(async (req, res) => {
  const receivedAt = Date.now();
  const { deviceId, firmware, battery, mode, readings } = req.body || {};
  if (!Array.isArray(readings) || readings.length === 0) throw httpError(400, 'readings[] is required');
  if (readings.length > MAX_BATCH) throw httpError(413, `Max ${MAX_BATCH} readings per request`);

  const docs = [];
  const rejected = [];
  for (const r of readings) {
    const ts = r.ts ? new Date(r.ts) : new Date(receivedAt);
    if (!METRICS.includes(r.metric) || typeof r.value !== 'number' || !Number.isFinite(r.value) || Number.isNaN(ts.getTime())) {
      rejected.push(r);
      continue;
    }
    docs.push({
      userId: req.user._id,
      metric: r.metric,
      value: r.value,
      ts,
      source: 'measured',
      confidence: typeof r.quality === 'number' ? clamp01(r.quality) : 0.95,
      deviceId: deviceId || req.user.deviceId,
    });
  }
  if (docs.length) {
    await Reading.insertMany(docs, { ordered: false });
    scheduleCycleUpdate(req.user._id);
  }

  // Device status
  const newest = docs.reduce((m, d) => Math.max(m, d.ts.getTime()), 0);
  const d = req.user.device || {};
  d.lastSeen = new Date(receivedAt);
  d.firstSeen = d.firstSeen || d.lastSeen;
  d.packets = (d.packets || 0) + 1;
  if (newest && receivedAt - newest < 60_000) d.latencyMs = Math.max(0, receivedAt - newest); // only for live (not backfill) data
  if (battery !== undefined) d.battery = battery;
  if (firmware) d.firmware = firmware;
  if (mode) d.mode = mode;
  req.user.device = d;
  if (deviceId && !req.user.deviceId) req.user.deviceId = deviceId;
  await req.user.save();

  // Push live data only (skip historical backfill batches)
  const live = docs.filter((x) => receivedAt - x.ts.getTime() < 60_000);
  if (live.length) {
    emitToUser(req.user._id, 'readings', {
      readings: live.map(({ metric, value, ts, source, confidence }) => ({ metric, value, ts, source, confidence })),
      device: deviceStatus(req.user),
    });
  }

  res.status(201).json({ accepted: docs.length, rejected: rejected.length });
});

/** GET /api/device/config — device polls this; Phase 5 fills `priority` from the closed-loop engine. */
export const getConfig = asyncHandler(async (req, res) => {
  res.json({ sampleIntervalSec: 5, uploadIntervalSec: 5, priority: [], nightBoost: false, userId: req.user._id });
});

export function deviceStatus(user) {
  const d = user.device || {};
  const online = !!d.lastSeen && Date.now() - new Date(d.lastSeen).getTime() < 30_000;
  return {
    id: user.deviceId || 'Not paired',
    name: 'HealthSense Watch',
    connected: online,
    lastSeen: d.lastSeen || null,
    battery: d.battery ?? null,
    firmware: d.firmware || null,
    packets: d.packets || 0,
    latencyMs: d.latencyMs ?? null,
    uptimeSec: online && d.firstSeen ? Math.round((Date.now() - new Date(d.firstSeen).getTime()) / 1000) : 0,
    mode: d.mode || '',
    transport: d.transport || 'wifi',
  };
}
