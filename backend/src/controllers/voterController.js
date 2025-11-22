import pool from '../db.js';
import { setVoterToken } from '../middleware/auth.js';

export async function loginWithAccessCode(req, res) {
  const { accessCode } = req.body || {};
  if (!accessCode) {
    return res.status(400).json({ message: 'Access code is required' });
  }

  try {
    const [rows] = await pool.query('SELECT id, voted FROM voters WHERE access_code = ?', [accessCode]);
    if (rows.length === 0) {
      return res.status(401).json({ message: 'Invalid access code' });
    }
    const voter = rows[0];

    if (voter.voted) {
      return res.status(400).json({ message: 'This access code has already been used' });
    }

    setVoterToken(res, { voterId: voter.id });

    await pool.query(
      'INSERT INTO audit_logs (actor, action, details) VALUES (?, ?, ?)',
      ['voter', 'login', `Voter ${voter.id} logged in with access code`]
    );

    return res.json({ message: 'Login successful' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
}

export async function getBallot(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT p.id AS position_id, p.name AS position_name, p.description,
              c.id AS candidate_id, c.full_name, c.alias
       FROM positions p
       JOIN candidates c ON c.position_id = p.id
       ORDER BY p.id, c.id`
    );

    const positions = [];
    const byId = new Map();
    for (const row of rows) {
      if (!byId.has(row.position_id)) {
        const pos = {
          id: row.position_id,
          name: row.position_name,
          description: row.description,
          candidates: [],
        };
        byId.set(row.position_id, pos);
        positions.push(pos);
      }
      byId.get(row.position_id).candidates.push({
        id: row.candidate_id,
        fullName: row.full_name,
        alias: row.alias,
      });
    }

    return res.json({ positions });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
}

export async function submitBallot(req, res) {
  const voterId = req.voter?.voterId;
  const { votes } = req.body || {};

  if (!Array.isArray(votes) || votes.length === 0) {
    return res.status(400).json({ message: 'Votes array is required' });
  }

  const conn = await pool.getConnection();
  try {
    // Load all positions
    const [positionRows] = await conn.query('SELECT id FROM positions ORDER BY id');
    const positionIds = positionRows.map((p) => p.id);

    // Basic validation: one vote per position, no duplicates
    const seenPositions = new Set();
    for (const v of votes) {
      if (!v.positionId || !v.candidateId) {
        await conn.release();
        return res.status(400).json({ message: 'Each vote must include positionId and candidateId' });
      }
      if (!positionIds.includes(v.positionId)) {
        await conn.release();
        return res.status(400).json({ message: `Invalid positionId ${v.positionId}` });
      }
      if (seenPositions.has(v.positionId)) {
        await conn.release();
        return res.status(400).json({ message: 'Duplicate position in ballot' });
      }
      seenPositions.add(v.positionId);
    }

    if (seenPositions.size !== positionIds.length) {
      await conn.release();
      return res.status(400).json({ message: 'You must vote for exactly one candidate in every position' });
    }

    await conn.beginTransaction();

    // Lock voter row and ensure they have not voted yet
    const [voterRows] = await conn.query('SELECT id, voted FROM voters WHERE id = ? FOR UPDATE', [voterId]);
    if (voterRows.length === 0) {
      await conn.rollback();
      await conn.release();
      return res.status(400).json({ message: 'Voter not found' });
    }
    if (voterRows[0].voted) {
      await conn.rollback();
      await conn.release();
      return res.status(400).json({ message: 'This access code has already been used' });
    }

    // Validate that each candidate belongs to the specified position
    for (const v of votes) {
      const [candRows] = await conn.query(
        'SELECT id FROM candidates WHERE id = ? AND position_id = ?',
        [v.candidateId, v.positionId]
      );
      if (candRows.length === 0) {
        await conn.rollback();
        await conn.release();
        return res.status(400).json({ message: `Invalid candidate for position ${v.positionId}` });
      }
    }

    // Insert votes
    for (const v of votes) {
      await conn.query(
        'INSERT INTO votes (voter_id, position_id, candidate_id) VALUES (?, ?, ?)',
        [voterId, v.positionId, v.candidateId]
      );
    }

    await conn.query('UPDATE voters SET voted = 1 WHERE id = ?', [voterId]);

    await conn.query(
      'INSERT INTO audit_logs (actor, action, details) VALUES (?, ?, ?)',
      ['voter', 'submit_ballot', `Voter ${voterId} submitted a complete ballot`]
    );

    await conn.commit();
    await conn.release();

    return res.json({ message: 'Ballot submitted successfully' });
  } catch (err) {
    console.error(err);
    try {
      await conn.rollback();
      await conn.release();
    } catch (_) {}
    return res.status(500).json({ message: 'Server error while submitting ballot' });
  }
}