const express = require('express');
const bcrypt = require('bcryptjs');
const { auth, db, FieldValue } = require('./firebase');
const { consumeVerification } = require('./otp');
const { isPhone, isPin, checkPin } = require('./helpers');

const STARTING_BALANCE = 10000;
const router = express.Router();

// Inscription : numero verifie par OTP + code PIN (le numero sert d'identifiant)
router.post('/register', async (req, res) => {
  const { phone, pin, name } = req.body;
  if (!isPhone(phone) || !isPin(pin)) {
    return res.status(400).json({ error: 'Numero ou code PIN invalide' });
  }
  const cleanName = (typeof name === 'string') ? name.trim() : '';
  try {
    await consumeVerification(db, phone); // refuse si le numero n'a pas ete verifie
    const pinHash = await bcrypt.hash(pin, 10); // le PIN n'est jamais stocke en clair
    const ref = db.collection('users').doc(phone);
    await db.runTransaction(async (t) => {
      const snap = await t.get(ref);
      if (snap.exists) throw new Error('EXISTS');
      t.set(ref, {
        phone: phone,
        name: cleanName,
        pinHash: pinHash,
        balance: STARTING_BALANCE,
        failedAttempts: 0,
        lockedUntil: 0,
        createdAt: FieldValue.serverTimestamp(),
      });
    });
    const token = await auth.createCustomToken(phone);
    res.json({ token, name: cleanName, phone });
  } catch (e) {
    if (e.message === 'NOT_VERIFIED') {
      return res.status(403).json({ error: 'Numero non verifie. Recommence la verification' });
    }
    if (e.message === 'EXISTS') {
      return res.status(409).json({ error: 'Ce numero est deja inscrit' });
    }
    console.error(e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Connexion : numero + code PIN
router.post('/login', async (req, res) => {
  const { phone, pin } = req.body;
  if (!isPhone(phone) || !isPin(pin)) {
    return res.status(400).json({ error: 'Numero ou code PIN invalide' });
  }
  try {
    const failure = await checkPin(phone, pin, 'Numero ou code PIN incorrect');
    if (failure) return res.status(failure.status).json({ error: failure.error });

    const snap = await db.collection('users').doc(phone).get();
    const userData = snap.exists ? snap.data() : {};
    const name = userData.name || '';

    const token = await auth.createCustomToken(phone);
    res.json({ token, name, phone });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
