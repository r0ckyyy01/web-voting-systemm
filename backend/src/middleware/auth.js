import jwt from 'jsonwebtoken';

const VOTER_TOKEN_COOKIE = 'voter_token';
const ADMIN_TOKEN_COOKIE = 'admin_token';

export function setVoterToken(res, payload) {
  const token = jwt.sign(payload, process.env.JWT_SECRET || 'dev-secret', {
    expiresIn: '2h',
  });
  res.cookie(VOTER_TOKEN_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
}

export function setAdminToken(res, payload) {
  const token = jwt.sign(payload, process.env.JWT_SECRET || 'dev-secret', {
    expiresIn: '2h',
  });
  res.cookie(ADMIN_TOKEN_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
}

export function requireVoterAuth(req, res, next) {
  const token = req.cookies?.[VOTER_TOKEN_COOKIE];
  if (!token) return res.status(401).json({ message: 'Not authenticated' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
    req.voter = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid session' });
  }
}

export function requireAdminAuth(req, res, next) {
  const token = req.cookies?.[ADMIN_TOKEN_COOKIE];
  if (!token) return res.status(401).json({ message: 'Not authenticated' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid session' });
  }
}