const Stripe = require('stripe');

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

let stripeInstance = null;

if (stripeSecretKey && stripeSecretKey.trim() !== '') {
  stripeInstance = new Stripe(stripeSecretKey.trim());
} else {
  console.warn('[Stripe Config Warning]: STRIPE_SECRET_KEY is not configured in .env. Stripe operations will require a valid test key.');
}

const getStripe = () => {
  if (!stripeInstance) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (key && key.trim() !== '') {
      stripeInstance = new Stripe(key.trim());
    } else {
      throw new Error('STRIPE_SECRET_KEY is not configured in environment variables. Please check your .env file.');
    }
  }
  return stripeInstance;
};

module.exports = {
  getStripe,
};
