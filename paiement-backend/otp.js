const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const DEMO_MODE = true;                  // true = aucun vrai SMS, le code est renvoye a l'app
const OTP_TTL_MS = 5 * 60 * 1000;        // validite du code : 5 minutes
const RESEND_DELAY_MS = 60 * 1000;       // delai minimum entre deux codes : 60 secondes
const MAX_VERIFY_ATTEMPTS = 5;           // essais maximum par code
const VERIFIED_TTL_MS = 10 * 60 * 1000;  // numero verifie valable 10 minutes

const isPhone = (v) => typeof v === 'string' && /^\d{8,15}$/.test(v);

// A remplacer par un vrai fournisseur SMS (Twilio, Vonage...) en production
async function sendSms(phone, message) {
  console.log('[SMS simule] vers ' + phone + ' : ' + message);
}

function createOtpRouter(db) {
  const router = express.Router();

  // Demande d'un code OTP
  router.post('/request', async (req, res) => {
    const { phone } = req.body;
    if (!isPhone(phone)) return res.status(400).json({ error: 'Numero invalide' });
    try {
      const userSnap = await db.collection('users').doc(phone).get();
      if (userSnap.exists) {
        return res.status(409).json({ error: 'Ce numero est deja inscrit' });
      }

      const ref = db.collection('otps').doc(phone);
      const snap = await ref.get();
      if (snap.exists) {
        const elapsed = Date.now() - snap.data().lastSentAt;
        if (elapsed < RESEND_DELAY_MS) {
          const wait = Math.ceil((RESEND_DELAY_MS - elapsed) / 1000);
          return res.status(429).json({
            error: 'Attends ' + wait + ' seconde(s) avant de redemander un code',
          });
        }
      }

      const code = String(crypto.randomInt(100000, 1000000)); // 6 chiffres
      await ref.set({
        codeHash: await bcrypt.hash(code, 8),
        expiresAt: Date.now() + OTP_TTL_MS,
        attempts: 0,
        lastSentAt: Date.now(),
      });
      await sendSms(phone, 'Ton code de verification : ' + code + ' (valable 5 minutes)');

      const response = { ok: true, expiresInSeconds: OTP_TTL_MS / 1000 };
      if (DEMO_MODE) response.demoCode = code;
      res.json(response);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // Verification du code saisi
  router.post('/verify', async (req, res) => {
    const { phone, code } = req.body;
    if (!isPhone(phone) || typeof code !== 'string' || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: 'Numero ou code invalide' });
    }
    try {
      const ref = db.collection('otps').doc(phone);
      const snap = await ref.get();
      if (!snap.exists) {
        return res.status(400).json({ error: 'Aucun code demande pour ce numero' });
      }
      const data = snap.data();

      if (Date.now() > data.expiresAt) {
        await ref.delete();
        return res.status(400).json({ error: 'Code expire. Demande un nouveau code' });
      }
      if (data.attempts >= MAX_VERIFY_ATTEMPTS) {
        await ref.delete();
        return res.status(429).json({ error: 'Trop d essais. Demande un nouveau code' });
      }

      const ok = await bcrypt.compare(code, data.codeHash);
      if (!ok) {
        await ref.update({ attempts: data.attempts + 1 });
        return res.status(400).json({ error: 'Code incorrect' });
      }

      await ref.delete(); // un code ne sert qu'une fois
      await db.collection('verifiedPhones').doc(phone).set({
        expiresAt: Date.now() + VERIFIED_TTL_MS,
      });
      res.json({ ok: true, verified: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  return router;
}

// Appelee par /register : le numero doit avoir ete verifie recemment (usage unique)
async function consumeVerification(db, phone) {
  const ref = db.collection('verifiedPhones').doc(phone);
  const snap = await ref.get();
  if (!snap.exists || snap.data().expiresAt < Date.now()) {
    throw new Error('NOT_VERIFIED');
  }
  await ref.delete();
}

module.exports = { createOtpRouter, consumeVerification };
