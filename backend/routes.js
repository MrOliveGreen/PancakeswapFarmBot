const router = require("express").Router();
const { body } = require("express-validator");

const { getTokenPrices } = require("./controllers/priceController");
const {
  getWalletStatus,
  getTiedAmount,
  createPosition,
  getPositions,
} = require("./controllers/walletController");
const { getSetting, saveSetting } = require("./controllers/settingController");

router.post("/getTokenPrices", body(), getTokenPrices);
router.post("/getWalletStatus", body(), getWalletStatus);
router.post(
  "/getTiedAmount",
  body("inputed", "amount", "current"),
  getTiedAmount
);
router.post("/createPosition", body("amount", "current"), createPosition);

router.post("/getSetting", body(), getSetting);
router.post(
  "/saveSetting",
  body("varianceRate", "rebalanceRate", "autoSwap", "autoAddLiquidity"),
  saveSetting
);

router.post("/getPositions", body(), getPositions);

module.exports = router;
