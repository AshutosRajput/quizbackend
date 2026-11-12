const express = require('express');
const router = express.Router();
const adminRoutes = require('./admin.routes');
const publicRoutes = require('./public.routes');
const mobileRoutes = require('./mobile.routes');

// Health check
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'quiz-eliminate-backend',
  });
});

router.use('/admin', adminRoutes);
router.use('/public', publicRoutes);
router.use('/mobile', mobileRoutes);

module.exports = router;

