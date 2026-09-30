import { Router } from 'express';
import { ingest, getConfig } from '../controllers/deviceController.js';
import { deviceAuth } from '../middleware/deviceAuth.js';

const router = Router();
router.post('/ingest', deviceAuth, ingest);
router.get('/device/config', deviceAuth, getConfig);

export default router;
