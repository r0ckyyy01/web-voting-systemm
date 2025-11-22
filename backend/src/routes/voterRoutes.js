import { Router } from 'express';
import { loginWithAccessCode, getBallot, submitBallot } from '../controllers/voterController.js';
import { requireVoterAuth } from '../middleware/auth.js';

const router = Router();

router.post('/login', loginWithAccessCode);
router.get('/ballot', requireVoterAuth, getBallot);
router.post('/ballot', requireVoterAuth, submitBallot);

export default router;