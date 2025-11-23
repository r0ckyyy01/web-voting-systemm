import pool from '../db.js';

export const loginVoter = async (req, res) => {
  try {
    const { access_code } = req.body;

    const [rows] = await pool.query(
      'SELECT id, name, voted FROM voters WHERE access_code = ?',
      [access_code]
    );

    if (!rows.length) return res.status(401).json({ message: 'Invalid access code' });

    res.json({ message: 'Login successful', voter: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
