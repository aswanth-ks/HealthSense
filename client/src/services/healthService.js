import api from './api.js';
import { mockOverview, mockHeartRateSeries } from './mockData.js';

const isDemo = () => { try { return localStorage.getItem('demo') === '1'; } catch { return true; } };

// Demo mode uses mock data; signed-in users hit the API and fall back to mock only if it is unreachable.
async function fetchOr(path, params, fallback) {
  if (isDemo()) return fallback();
  try {
    const { data } = await api.get(path, { params });
    return data;
  } catch (err) {
    if (err.response?.status === 401) throw err;
    return fallback();
  }
}

export const getOverview = () => fetchOr('/me/overview', undefined, () => mockOverview);

export const getHeartRateSeries = (range = '24H') => fetchOr('/me/heart-rate', { range }, () => mockHeartRateSeries(range));

export const getLiveSnapshot = () => fetchOr('/me/live', undefined, () => null);

export const getDeviceKey = () => fetchOr('/users/me/device-key', undefined, () => null);

export { isDemo };
