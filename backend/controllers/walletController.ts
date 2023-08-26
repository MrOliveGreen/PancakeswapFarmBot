import { RequestHandler } from "express";
import {
  createWalletClient,
  createPublicClient,
  http,
  formatUnits,
  getContract,
  parseUnits,
  formatEther,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { bsc } from "viem/chains";
import { bep20EthABI } from "~/abi/bep20Eth";
import { bep20usdcABI } from "~/abi/bep20usdc";
import { PancakeV3PoolABI } from "~/abi/PancakeV3Pool";
import { nonfungiblePositionManagerABI } from "~/abi/NonfungiblePositionManager";
import "isomorphic-unfetch";
import { Token, Percent } from "@pancakeswap/sdk";
import { Pool, Position } from "@pancakeswap/v3-sdk";
import { tryParseTick } from "./functions";
const db = require("../models");
const Setting = db.setting;
const MyPosition = db.myposition;

const walletClient = createWalletClient({
  chain: bsc,
  transport: http(process.env.BSC_RPC_URL),
});

const publicClient = createPublicClient({
  chain: bsc,
  transport: http(process.env.BSC_RPC_URL),
});

const account = privateKeyToAccount(`0x${process.env.PRIVATE_KEY}`);

export const getWalletStatus: RequestHandler = async (req, res, next) => {
  const ethAmount: any = await publicClient.readContract({
    address: `0x${process.env.BSC_PEG_ETHADDR}`,
    abi: bep20EthABI,
    functionName: "balanceOf",
    args: [account.address],
  });

  const usdcAmount: any = await publicClient.readContract({
    address: `0x${process.env.BSC_PEG_USDCADDR}`,
    abi: bep20usdcABI,
    functionName: "balanceOf",
    args: [account.address],
  });

  res.json({
    ethAmount: formatUnits(ethAmount, 18),
    usdcAmount: formatUnits(usdcAmount, 18),
    address: account.address,
  });
};

const eth = new Token(
  56,
  `0x${process.env.BSC_PEG_ETHADDR}`,
  18,
  "weth",
  "ETH"
);
const usdc = new Token(
  56,
  `0x${process.env.BSC_PEG_USDCADDR}`,
  18,
  "usdc",
  "USDC"
);
const fee = 500;

export const getTiedAmount: RequestHandler = async (req, res, next) => {
  if (!req.body.inputed || !req.body.amount || !req.body.current) {
    res.status(400).send({
      status: "failed",
      message: "Content cannot be empty.",
    });
    return;
  }

  const setting = await Setting.findOne({ order: [["id", "desc"]] });
  if (!setting) {
    res.json({
      success: false,
      message: "Cannot find the setting.",
    });
    return;
  }

  const priceCurrent = parseFloat(req.body.current);

  const priceLower =
    priceCurrent - (priceCurrent * parseFloat(setting.varianceRate)) / 100;
  const priceUpper =
    priceCurrent + (priceCurrent * parseFloat(setting.varianceRate)) / 100;

  console.log(priceLower, priceCurrent, priceUpper);

  try {
    const ticks: any = {
      lower: tryParseTick(eth, usdc, fee, priceLower.toString()),
      upper: tryParseTick(eth, usdc, fee, priceUpper.toString()),
    };

    const v3Pool = getContract({
      abi: PancakeV3PoolABI,
      address: `0x${process.env.BSC_V3POOL_ADDR}`,
      publicClient,
      walletClient,
    });
    const slot0: any = await v3Pool.read.slot0();
    const [sqrtPriceX96, tick, , , , feeProtocol] = slot0;
    const liquidity: any = await v3Pool.read.liquidity();

    const pool = new Pool(eth, usdc, fee, sqrtPriceX96, liquidity, tick);
    pool.feeProtocol = feeProtocol;

    let tiedAmount;
    if (req.body.inputed == "token0") {
      const position = Position.fromAmount0({
        pool: pool,
        tickLower: ticks.lower,
        tickUpper: ticks.upper,
        amount0: parseUnits(String(req.body.amount), 18),
        useFullPrecision: true,
      });
      tiedAmount = position.mintAmounts.amount1;
    } else {
      const position = Position.fromAmount1({
        pool: pool,
        tickLower: ticks.lower,
        tickUpper: ticks.upper,
        amount1: parseUnits(String(req.body.amount), 18),
      });
      tiedAmount = position.mintAmounts.amount0;
    }

    res.json({
      success: true,
      amount: formatEther(tiedAmount),
    });
  } catch (e) {
    console.log(e);
    res.json({
      success: false,
      amount: "Error while calculating tied amount.",
    });
  }
};

export const createPosition: RequestHandler = async (req, res, next) => {
  if (!req.body.amount || !req.body.current) {
    res.status(400).send({
      status: "failed",
      message: "Content cannot be empty.",
    });
    return;
  }

  const setting = await Setting.findOne({ order: [["id", "desc"]] });
  if (!setting) {
    res.json({
      success: false,
      message: "Cannot find the setting.",
    });
    return;
  }

  const priceCurrent = parseFloat(req.body.current);

  const priceLower =
    priceCurrent - (priceCurrent * parseFloat(setting.varianceRate)) / 100;
  const priceUpper =
    priceCurrent + (priceCurrent * parseFloat(setting.varianceRate)) / 100;

  console.log(priceLower, priceCurrent, priceUpper);

  const ticks: any = {
    lower: tryParseTick(eth, usdc, fee, priceLower.toString()),
    upper: tryParseTick(eth, usdc, fee, priceUpper.toString()),
  };

  const v3Pool = getContract({
    abi: PancakeV3PoolABI,
    address: `0x${process.env.BSC_V3POOL_ADDR}`,
    publicClient,
    walletClient,
  });
  const slot0: any = await v3Pool.read.slot0();
  const [sqrtPriceX96, tick, , , , feeProtocol] = slot0;
  const liquidity: any = await v3Pool.read.liquidity();

  const pool = new Pool(eth, usdc, fee, sqrtPriceX96, liquidity, tick);
  pool.feeProtocol = feeProtocol;

  const position = Position.fromAmount1({
    pool: pool,
    tickLower: ticks.lower,
    tickUpper: ticks.upper,
    amount1: parseUnits(String(req.body.amount), 18),
  });

  const allowedSlippage: any = process.env.ALLOWED_SLIPPAGE;
  const deadline = Math.floor(Date.now() / 1000) + 20 * 60;
  const options = {
    slippageTolerance: new Percent(BigInt(allowedSlippage), BigInt(10000)),
    recipient: account.address,
    deadline: BigInt(deadline),
    undefined,
    createPool: false,
  };

  const minimumAmounts = position.mintAmountsWithSlippage(
    options.slippageTolerance
  );

  const cdata = {
    token0: position.pool.token0.address,
    token1: position.pool.token1.address,
    fee: position.pool.fee,
    tickLower: position.tickLower,
    tickUpper: position.tickUpper,
    amount0Desired: position.mintAmounts.amount0,
    amount1Desired: position.mintAmounts.amount1,
    amount0Min: minimumAmounts.amount0,
    amount1Min: minimumAmounts.amount1,
    recipient: account.address,
    deadline: BigInt(deadline),
  };

  // const ethAllowance: any = await publicClient.readContract({
  //   address: `0x${process.env.BSC_PEG_ETHADDR}`,
  //   abi: bep20EthABI,
  //   functionName: 'allowance',
  //   args: [account.address, `0x${process.env.NF_V3_POSITION_MANAGER_ADDR}`]
  // });

  // const usdcAllowance: any = await publicClient.readContract({
  //   address: `0x${process.env.BSC_PEG_USDCADDR}`,
  //   abi: bep20usdcABI,
  //   functionName: 'allowance',
  //   args: [account.address, `0x${process.env.NF_V3_POSITION_MANAGER_ADDR}`]
  // });

  // if (position.mintAmounts.amount0 > ethAllowance) {
  //   try {
  //     const ethAllowed = await walletClient.writeContract({
  //       address: `0x${process.env.BSC_PEG_ETHADDR}`,
  //       abi: bep20EthABI,
  //       functionName: 'approve',
  //       args: [`0x${process.env.NF_V3_POSITION_MANAGER_ADDR}`, position.mintAmounts.amount0],
  //       account
  //     });
  //     console.log(ethAllowed);
  //   } catch (e) {
  //     res.json({ success: false, message: 'Eth approve for PositionManager failed.' });
  //     return;
  //   }
  // }

  // if (position.mintAmounts.amount1 > usdcAllowance) {
  //   try {
  //     const usdcAllowed = await walletClient.writeContract({
  //       address: `0x${process.env.BSC_PEG_USDCADDR}`,
  //       abi: bep20usdcABI,
  //       functionName: 'approve',
  //       args: [`0x${process.env.NF_V3_POSITION_MANAGER_ADDR}`, position.mintAmounts.amount1],
  //       account
  //     });
  //     console.log(usdcAllowed);
  //   } catch (e) {
  //     res.json({ success: false, message: 'USDC approve for PositionManager failed.' });
  //     return;
  //   }
  // }

  // try {
  //   const txHash = await walletClient.writeContract({
  //     address: `0x${process.env.NF_V3_POSITION_MANAGER_ADDR}`,
  //     abi: nonfungiblePositionManagerABI,
  //     functionName: 'mint',
  //     args: [cdata],
  //     account,
  //     value: BigInt(0)
  //   });
  //   console.log(txHash);
  const txHash = "0xtesthashhere";
  if (txHash.includes(`0x`)) {
    const mypos = {
      fee: fee,
      tickLower: position.tickLower,
      tickUpper: position.tickUpper,
      amount0Desired: formatUnits(position.mintAmounts.amount0, 18),
      amount1Desired: formatUnits(position.mintAmounts.amount1, 18),
      amount0Min: formatUnits(minimumAmounts.amount0, 18),
      amount1Min: formatUnits(minimumAmounts.amount1, 18),
      recipient: account.address,
      deadline: deadline,
      txHash: txHash,
      isStaked: 0,
      status: 0,
      priceRate: priceCurrent,
      varianceRate: setting.varianceRate,
      rebalanceRate: setting.rebalanceRate,
      prevPos: 0,
      nextPos: 0,
      isProcessing: 0,
    };
    await MyPosition.create(mypos);

    res.json({ success: true, position: mypos });
    //   } else {
    //     res.json({ success: false, message: 'Returned bad hash.' });
    //   }
    // } catch (e) {
    //   res.json({ success: false, message: 'Add liquidity transaction failed.' });
  }
};

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
