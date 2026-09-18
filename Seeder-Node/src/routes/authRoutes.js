const express = require('express');
const router = express.Router();
const { signup, verifyEmail, adminLogin } = require('../controllers/authController');

router.post('/signup', signup);

router.get('/verify-email', verifyEmail);

router.post('/admin/login', adminLogin);

module.exports = router;
