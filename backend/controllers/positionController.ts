import { RequestHandler } from "express";
const db = require("../models");
const MyPosition = db.myposition;

export const getPositions: RequestHandler = async (req, res, next) => {
  try {
    const positions = await MyPosition.findAll({ order: [["id", "desc"]] });
    res.json({ success: true, data: positions });
  } catch (err) {
    console.log(err);
    res.status(500).send({
      status: "Error",
      message: "Something went wrong!",
    });
    return;
  }
};

export const updatePosition: RequestHandler = async (req, res, next) => {
  if (!req.body.posId) {
    res.status(400).send({
      status: "failed",
      message: "Content can not be empty!",
    });
    return;
  }

  try {
    const position = await MyPosition.findOne({
      where: { id: req.body.posId },
    });
    if (position) {
      await position.update({
        priceLower: req.body.minPrice,
        priceUpper: req.body.maxPrice,
        rebalanceRate: req.body.rebalanceRate,
      });
    } else {
      res.status(500).send({
        status: "Error",
        message: "This position does not exist",
      });
    }
    res.json({ success: true, data: position });
  } catch (err) {
    console.log(err);
    res.status(500).send({
      status: "Error",
      message: "Something went wrong!",
    });
    return;
  }
};
