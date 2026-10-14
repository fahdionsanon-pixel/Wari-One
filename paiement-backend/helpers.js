const bcrypt = require('bcryptjs');
const { auth, db } = require('./firebase');

const MAX_ATTEMPTS = 5;   // essais de PIN avant verrouillage
const LOCK_MINUTES = 15;  // duree du verrouillage

const isPhone = (v) => typeof v === 'string' && /^\d{8,15}$/.test(v);
const isPin = (v) => typeof v === 'string' && /^\d{4}$/.test(v);

// Verifie le jeton Firebase envoye par l'app et identifie l'utilisateur
async function verifyToken(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Jeton manquant' });
  try {
    req.user = await auth.verifyIdToken(token);
    next();
  } catch (e) {
    res.status(401).json({ error: 'Jeton invalide' });
  }
}

// Verifie le PIN d'un utilisateur, avec verrouillage apres trop d'echecs.
// Retourne null si le PIN est correct, sinon { status, error }.
async function checkPin(phone, pin, wrongPinMessage) {
  const ref = db.collection('users').doc(phone);
  const snap = await ref.get();
  if (!snap.exists) return { status: 401, error: wrongPinMessage };
  const user = snap.data();

  if (user.lockedUntil && user.lockedUntil > Date.now()) {
    const minutes = Math.ceil((user.lockedUntil - Date.now()) / 60000);
    return {
      status: 429,
      error: 'Compte verrouille. Reessaie dans ' + minutes + ' minute(s)',
    };
  }

  const ok = await bcrypt.compare(pin, user.pinHash);
  if (!ok) {
    const attempts = (user.failedAttempts || 0) + 1;
    if (attempts >= MAX_ATTEMPTS) {
      await ref.update({
        failedAttempts: 0,
        lockedUntil: Date.now() + LOCK_MINUTES * 60000,
      });
    } else {
      await ref.update({ failedAttempts: attempts });
    }
    return { status: 401, error: wrongPinMessage };
  }

  await ref.update({ failedAttempts: 0, lockedUntil: 0 });
  return null;
}

module.exports = { isPhone, isPin, verifyToken, checkPin };
