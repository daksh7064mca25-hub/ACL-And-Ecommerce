const express = require('express');
const router = express.Router();
const { signup, verifyEmail, adminLogin, customerLogin } = require('../controllers/authController');

// Customer Signup
router.post('/signup', signup);

// Customer Email Verification
router.get('/verify-email', verifyEmail);

// Admin Login
router.post('/admin/login', adminLogin);

// Customer Login
router.post('/customer/login', customerLogin);
router.post('/login', customerLogin);

module.exports = router;
