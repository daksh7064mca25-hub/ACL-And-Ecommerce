const express = require('express');
const router = express.Router();
const { handleStripeWebhook } = require('../controllers/webhookController');

// Stripe Webhook Endpoint (Receives raw body via app.js configuration)
// POST /api/stripe/webhook
router.post('/webhook', handleStripeWebhook);

module.exports = router;
