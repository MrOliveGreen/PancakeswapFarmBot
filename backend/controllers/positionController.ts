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
