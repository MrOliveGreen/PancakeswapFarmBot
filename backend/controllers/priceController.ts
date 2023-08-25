import Moralis from 'moralis';
import { RequestHandler } from "express";

export const getTokenPrices: RequestHandler = async (req, res, next) => {
  const ethPrice = await Moralis.EvmApi.token.getTokenPrice({
    "chain": "0x38",
    "exchange": "pancakeswapv2",
    "address": String(process.env.BSC_PEG_ETHADDR)
  });

  const usdcPrice = await Moralis.EvmApi.token.getTokenPrice({
    "chain": "0x38",
    "exchange": "pancakeswapv2",
    "address": String(process.env.BSC_PEG_USDCADDR)
  });

  res.json({
    ethPrice: ethPrice?.toJSON().usdPrice,
    usdcPrice: usdcPrice?.toJSON().usdPrice,
  })
}