import { Router } from 'express';
import { loginWithAccessCode, getBallot, submitBallot } from '../controllers/voterController.js';
import { requireVoterAuth } from '../middleware/auth.js';

const router = Router();

// Voter login
router.post('/login', loginWithAccessCode);

// Get ballot (requires voter auth)
router.get('/ballot', requireVoterAuth, getBallot);

// Submit ballot (requires voter auth)
router.post('/submit', requireVoterAuth, submitBallot);

export default router;
