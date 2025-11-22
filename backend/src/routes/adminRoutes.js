import { Router } from 'express';
import {
  adminLogin,
  getResults,
  getTurnout,
  exportResultsCsv,
  getAuditLogs,
} from '../controllers/adminController.js';
import { requireAdminAuth } from '../middleware/auth.js';

const router = Router();

router.post('/login', adminLogin);
router.get('/results', requireAdminAuth, getResults);
router.get('/turnout', requireAdminAuth, getTurnout);
router.get('/export', requireAdminAuth, exportResultsCsv);
router.get('/audit-logs', requireAdminAuth, getAuditLogs);

export default router;