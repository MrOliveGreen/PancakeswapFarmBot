const router = require('express').Router();
const { body } = require('express-validator');

const { getTokenPrices } = require('./controllers/priceController');
const { getWalletStatus, getTiedAmount, createPosition } = require('./controllers/walletController');

router.post('/getTokenPrices', body(), getTokenPrices);
router.post('/getWalletStatus', body(), getWalletStatus);
router.post('/getTiedAmount', body('inputed', 'amount', 'current'), getTiedAmount);
router.post('/createPosition', body('amount', 'current'), createPosition);

module.exports = router;