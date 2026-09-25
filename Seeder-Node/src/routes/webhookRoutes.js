const express = require('express');
const router = express.Router();
const { handleStripeWebhook } = require('../controllers/webhookController');

// Stripe Webhook Endpoint (Receives raw body via app.js configuration)
// POST /api/stripe/webhook
router.post('/webhook', handleStripeWebhook);

// Stripe Public Configuration (Returns safe publishable key)
// GET /api/stripe/config
router.get('/config', (req, res) => {
  return res.status(200).json({
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
  });
});

module.exports = router;
