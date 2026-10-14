const express = require('express');
const { db, FieldValue } = require('./firebase');
const { isPhone, isPin, verifyToken, checkPin } = require('./helpers');

const router = express.Router();

// Retourne le solde de l'utilisateur connecte
router.get('/balance', verifyToken, async (req, res) => {
  const snap = await db.collection('users').doc(req.user.uid).get();
  if (!snap.exists) return res.status(404).json({ error: 'Profil introuvable' });
  const data = snap.data();
  res.json({ balance: data.balance, name: data.name || '' });
});

// Transfere de l'argent a un autre utilisateur (par numero), apres confirmation par PIN
router.post('/transfer', verifyToken, async (req, res) => {
  const { toPhone, amount, pin } = req.body;
  const value = Number(amount);
  if (!isPhone(toPhone) || !Number.isInteger(value) || value <= 0) {
    return res.status(400).json({ error: 'Donnees invalides' });
  }
  if (!isPin(pin)) {
    return res.status(400).json({ error: 'Code PIN requis (4 chiffres)' });
  }
  const fromRef = db.collection('users').doc(req.user.uid);
  const toRef = db.collection('users').doc(toPhone);
  if (toRef.id === fromRef.id) {
    return res.status(400).json({ error: 'Envoi a soi-meme impossible' });
  }
  try {
    // 1) Le PIN est verifie AVANT toute operation sur les soldes
    const failure = await checkPin(req.user.uid, pin, 'Code PIN incorrect');
    if (failure) return res.status(failure.status).json({ error: failure.error });

    // 2) Operation atomique : tout reussit ou rien n'est modifie
    await db.runTransaction(async (t) => {
      const fromSnap = await t.get(fromRef);
      const toSnap = await t.get(toRef);
      if (!toSnap.exists) throw new Error('NO_RECIPIENT');
      if (fromSnap.data().balance < value) throw new Error('INSUFFICIENT');
      t.update(fromRef, { balance: fromSnap.data().balance - value });
      t.update(toRef, { balance: toSnap.data().balance + value });
      t.set(db.collection('transactions').doc(), {
        from: fromRef.id,
        to: toRef.id,
        amount: value,
        createdAt: FieldValue.serverTimestamp(),
      });
    });
    res.json({ ok: true });
  } catch (e) {
    if (e.message === 'NO_RECIPIENT') {
      return res.status(404).json({ error: 'Destinataire introuvable' });
    }
    if (e.message === 'INSUFFICIENT') {
      return res.status(400).json({ error: 'Solde insuffisant' });
    }
    console.error(e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Deposer de l'argent sur son compte
router.post('/deposit', verifyToken, async (req, res) => {
  const { amount } = req.body;
  const value = Math.round(Number(amount));
  if (isNaN(value) || value <= 0) {
    return res.status(400).json({ error: 'Montant invalide' });
  }
  const userRef = db.collection('users').doc(req.user.uid);
  try {
    let newBalance = 0;
    await db.runTransaction(async (t) => {
      const snap = await t.get(userRef);
      if (!snap.exists) throw new Error('NOT_FOUND');
      newBalance = (snap.data().balance || 0) + value;
      t.update(userRef, { balance: newBalance });
      t.set(db.collection('transactions').doc(), {
        from: 'DEPOT',
        to: req.user.uid,
        amount: value,
        createdAt: FieldValue.serverTimestamp(),
      });
    });
    res.json({ ok: true, balance: newBalance });
  } catch (e) {
    if (e.message === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Compte introuvable' });
    }
    console.error(e);
    res.status(500).json({ error: 'Erreur lors du dépôt' });
  }
});

// Retirer de l'argent de son compte (securise par code PIN)
router.post('/withdraw', verifyToken, async (req, res) => {
  const { amount, pin } = req.body;
  const value = Math.round(Number(amount));
  if (isNaN(value) || value <= 0) {
    return res.status(400).json({ error: 'Montant invalide' });
  }
  if (!isPin(pin)) {
    return res.status(400).json({ error: 'Code PIN requis (4 chiffres)' });
  }
  const userRef = db.collection('users').doc(req.user.uid);
  try {
    const failure = await checkPin(req.user.uid, pin, 'Code PIN incorrect');
    if (failure) return res.status(failure.status).json({ error: failure.error });

    let newBalance = 0;
    await db.runTransaction(async (t) => {
      const snap = await t.get(userRef);
      if (!snap.exists) throw new Error('NOT_FOUND');
      const current = snap.data().balance || 0;
      if (current < value) throw new Error('INSUFFICIENT');
      newBalance = current - value;
      t.update(userRef, { balance: newBalance });
      t.set(db.collection('transactions').doc(), {
        from: req.user.uid,
        to: 'RETRAIT',
        amount: value,
        createdAt: FieldValue.serverTimestamp(),
      });
    });
    res.json({ ok: true, balance: newBalance });
  } catch (e) {
    if (e.message === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Compte introuvable' });
    }
    if (e.message === 'INSUFFICIENT') {
      return res.status(400).json({ error: 'Solde insuffisant pour effectuer ce retrait' });
    }
    console.error(e);
    res.status(500).json({ error: 'Erreur lors du retrait' });
  }
});

// Historique : transactions envoyees, recues, depots et retraits
router.get('/transactions', verifyToken, async (req, res) => {
  const uid = req.user.uid;
  const [sent, received] = await Promise.all([
    db.collection('transactions').where('from', '==', uid).get(),
    db.collection('transactions').where('to', '==', uid).get(),
  ]);
  const list = [...sent.docs, ...received.docs].map((d) => {
    const data = d.data();
    let type = data.from === uid ? 'envoye' : 'recu';
    let other = data.from === uid ? data.to : data.from;

    if (data.from === 'DEPOT') {
      type = 'depot';
      other = 'Dépôt d\'argent';
    } else if (data.to === 'RETRAIT') {
      type = 'retrait';
      other = 'Retrait d\'argent';
    }

    return {
      id: d.id,
      type,
      other,
      amount: data.amount,
      date: data.createdAt ? data.createdAt.toMillis() : 0,
    };
  });
  list.sort((a, b) => b.date - a.date);
  res.json(list);
});

module.exports = router;
