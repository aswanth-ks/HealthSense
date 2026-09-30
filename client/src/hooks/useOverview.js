import { useEffect, useState } from 'react';
import { getOverview } from '../services/healthService.js';

export default function useOverview() {
  const [data, setData] = useState(null);
  useEffect(() => {
    let alive = true;
    getOverview().then((d) => alive && setData(d));
    return () => { alive = false; };
  }, []);
  return data;
}
