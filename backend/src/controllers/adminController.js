import pool from '../db.js';
import bcrypt from 'bcrypt';

export const loginAdmin = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Fetch admin from DB
    const [rows] = await pool.query('SELECT * FROM admins WHERE username = ?', [username]);
    if (!rows.length) return res.status(401).json({ message: 'User not found' });

    // Compare password with stored hash
    const validPassword = await bcrypt.compare(password, rows[0].password);
    if (!validPassword) return res.status(401).json({ message: 'Invalid password' });

    res.json({ message: 'Login successful', admin: { id: rows[0].id, username: rows[0].username } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
