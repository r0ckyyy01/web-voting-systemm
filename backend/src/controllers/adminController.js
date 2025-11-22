import bcrypt from 'bcrypt';
import pool from '../db.js';
import { setAdminToken } from '../middleware/auth.js';

export async function adminLogin(req, res) {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }

  try {
    const [rows] = await pool.query('SELECT id, username, password_hash FROM admins WHERE username = ?', [
      username,
    ]);
    if (rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const admin = rows[0];
    const ok = await bcrypt.compare(password, admin.password_hash);
    if (!ok) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    setAdminToken(res, { adminId: admin.id, username: admin.username });

    await pool.query(
      'INSERT INTO audit_logs (actor, action, details) VALUES (?, ?, ?)',
      [`admin:${admin.username}`, 'login', `Admin ${admin.username} logged in`]
    );

    return res.json({ message: 'Login successful' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
}

export async function getResults(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT p.id AS position_id, p.name AS position_name,
              c.id AS candidate_id, c.full_name, c.alias,
              COUNT(v.id) AS votes
       FROM positions p
       JOIN candidates c ON c.position_id = p.id
       LEFT JOIN votes v ON v.candidate_id = c.id
       GROUP BY p.id, p.name, c.id, c.full_name, c.alias
       ORDER BY p.id, votes DESC, c.id`
    );

    const positions = [];
    const map = new Map();
    for (const row of rows) {
      if (!map.has(row.position_id)) {
        const pos = {
          id: row.position_id,
          name: row.position_name,
          candidates: [],
        };
        map.set(row.position_id, pos);
        positions.push(pos);
      }
      map.get(row.position_id).candidates.push({
        id: row.candidate_id,
        fullName: row.full_name,
        alias: row.alias,
        votes: row.votes,
      });
    }

    return res.json({ positions });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
}

export async function getTurnout(req, res) {
  try {
    const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM voters');
    const [[{ voted }]] = await pool.query('SELECT COUNT(*) AS voted FROM voters WHERE voted = 1');
    const percentage = total === 0 ? 0 : Math.round((voted / total) * 10000) / 100;
    return res.json({ totalVoters: total, voted, percentage });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
}

export async function exportResultsCsv(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT p.name AS position_name,
              c.full_name,
              c.alias,
              COUNT(v.id) AS votes
       FROM positions p
       JOIN candidates c ON c.position_id = p.id
       LEFT JOIN votes v ON v.candidate_id = c.id
       GROUP BY p.name, c.full_name, c.alias
       ORDER BY p.id, votes DESC, c.id`
    );

    const header = 'Position,Full Name,Alias,Votes';
    const lines = rows.map((r) =>
      [r.position_name, r.full_name, r.alias, r.votes].map((x) => `"${String(x).replace('"', '""')}"`).join(',')
    );
    const csv = [header, ...lines].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="results.csv"');
    return res.send(csv);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
}

export async function getAuditLogs(req, res) {
  try {
    const [rows] = await pool.query(
      'SELECT id, actor, action, details, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 500'
    );
    return res.json({ logs: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
}