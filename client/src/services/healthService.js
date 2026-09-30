import api from './api.js';
import { mockOverview, mockHeartRateSeries } from './mockData.js';

// Tries the REST API first; falls back to mock data until the backend exists.
export async function getOverview() {
  try {
    const { data } = await api.get('/health/overview');
    return data;
  } catch {
    return mockOverview;
  }
}

export async function getHeartRateSeries(range = '24H') {
  try {
    const { data } = await api.get('/health/heart-rate', { params: { range } });
    return data;
  } catch {
    return mockHeartRateSeries(range);
  }
}
