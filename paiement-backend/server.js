const express = require('express');
const cors = require('cors');
const { db } = require('./firebase');
const { createOtpRouter } = require('./otp');
const authRoutes = require('./auth');
const paymentRoutes = require('./payments');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/otp', createOtpRouter(db)); // /otp/request et /otp/verify
app.use(authRoutes);                  // /register et /login
app.use(paymentRoutes);               // /balance, /transfer, /transactions

const PORT = 3000;
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('Backend demarre sur http://0.0.0.0:' + PORT + ' (accessible sur le reseau)');
});

// Gestion propre de l'arret
process.on('SIGINT', () => {
  console.log('Arret du serveur...');
  server.close(() => {
    console.log('Serveur arrete.');
    process.exit(0);
  });
});