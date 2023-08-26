import { RequestHandler } from "express";
const Sequelize = require("sequelize");
const db = require("../models");
const Setting = db.setting;

export const getSetting: RequestHandler = async (req, res, next) => {
  try {
    const setting = await Setting.findOne();
    res.json({ success: true, data: setting });
  } catch (err) {
    console.log(err);
    res.status(500).send({
      status: "Error",
      message: "Something went wrong!",
    });
    return;
  }
};

export const saveSetting: RequestHandler = async (req, res, next) => {
  if (
    !req.body.varianceRate ||
    !req.body.rebalanceRate ||
    req.body.autoSwap === undefined ||
    req.body.autoAddLiquidity === undefined
  ) {
    res.status(400).send({
      status: "failed",
      message: "Content can not be empty!",
    });
    return;
  }

  try {
    const setting = await Setting.findOne();
    await setting.update({
      varianceRate: req.body.varianceRate,
      rebalanceRate: req.body.rebalanceRate,
      autoSwap: req.body.autoSwap ? 1 : 0,
      autoAddLiquidity: req.body.autoAddLiquidity ? 1 : 0,
    });

    res.json({ success: true, data: setting });
  } catch (err) {
    console.log(err);
    res.status(500).send({
      status: "Error",
      message: "Something went wrong!",
    });
    return;
  }
};
