const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const serviceAccount = require('./serviceAccountKey.json');

initializeApp({ credential: cert(serviceAccount) });

// auth sert aux jetons, db sert a lire et ecrire dans Firestore
module.exports = { auth: getAuth(), db: getFirestore(), FieldValue };
