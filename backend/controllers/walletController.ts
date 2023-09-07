import { RequestHandler } from "express"
import { createWalletClient, createPublicClient, http, formatUnits, getContract, parseUnits, hexToBigInt, formatEther } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { bsc } from 'viem/chains'
import { bep20EthABI } from "~/abi/bep20Eth"
import { bep20usdcABI } from "~/abi/bep20usdc"
import { PancakeV3PoolABI } from "~/abi/PancakeV3Pool"
import { nonfungiblePositionManagerABI } from "~/abi/NonfungiblePositionManager";
import { masterChefV3ABI } from "~/abi/MasterChefV3";
import "isomorphic-unfetch";
import { Percent } from '@pancakeswap/sdk'
import { Pool, Position, NonfungiblePositionManager, MasterChefV3 } from '@pancakeswap/v3-sdk'
import { CurrencyAmount } from '@pancakeswap/swap-sdk-core'
import { eth, usdc, fee, tryParseTick, waitUntilGas, getPool } from "./functions"
import Moralis from 'moralis';

const db = require("../models");
const Setting = db.setting;
const MyPosition = db.myposition;

const walletClient = createWalletClient({
  chain: bsc,
  transport: http(process.env.BSC_RPC_URL)
})

const publicClient = createPublicClient({
  chain: bsc,
  transport: http(process.env.BSC_RPC_URL)
})

const account = privateKeyToAccount(`0x${process.env.PRIVATE_KEY}`);

export const getWalletStatus: RequestHandler = async (req, res, next) => {
  const ethAmount: any = await publicClient.readContract({
    address: `0x${process.env.BSC_PEG_ETHADDR}`,
    abi: bep20EthABI,
    functionName: 'balanceOf',
    args: [account.address]
  });

  const usdcAmount: any = await publicClient.readContract({
    address: `0x${process.env.BSC_PEG_USDCADDR}`,
    abi: bep20usdcABI,
    functionName: 'balanceOf',
    args: [account.address]
  });

  res.json({
    ethAmount: formatUnits(ethAmount, 18),
    usdcAmount: formatUnits(usdcAmount, 18),
    address: account.address
  });
}

export const getTiedAmount: RequestHandler = async (req, res, next) => {
  if (!req.body.inputed || !req.body.amount) {
    res.status(400).send({
      status: "failed",
      message: "Content cannot be empty."
    });
    return;
  }

  let setting = await Setting.findOne({ order: [["id", "desc"]] });
  if (!setting) {
    setting = { varianceRate: process.env.VARIANCE_RATE, rebalanceRate: process.env.REBALANCE_RATE };
  }

  try {
    const ethPrice = await Moralis.EvmApi.token.getTokenPrice({
      "chain": "0x38",
      "exchange": "pancakeswapv2",
      "address": String(process.env.BSC_PEG_ETHADDR)
    });

    const priceCurrent = ethPrice?.toJSON().usdPrice;

    const priceLower = priceCurrent - priceCurrent * parseFloat(setting.varianceRate) / 100;
    const priceUpper = priceCurrent + priceCurrent * parseFloat(setting.varianceRate) / 100;

    const ticks: any = {
      lower: tryParseTick(eth, usdc, fee, priceLower.toString()),
      upper: tryParseTick(eth, usdc, fee, priceUpper.toString()),
    };

    const pool = await getPool(eth, usdc, fee);

    let tiedAmount;
    if (req.body.inputed == "token0") {
      const position = Position.fromAmount0({
        pool: pool,
        tickLower: ticks.lower,
        tickUpper: ticks.upper,
        amount0: parseUnits(String(req.body.amount), 18),
        useFullPrecision: true
      });
      tiedAmount = CurrencyAmount.fromRawAmount(usdc, position.amount1.quotient).toSignificant(6);
    } else {
      const position = Position.fromAmount1({
        pool: pool,
        tickLower: ticks.lower,
        tickUpper: ticks.upper,
        amount1: parseUnits(String(req.body.amount), 18)
      });
      tiedAmount = CurrencyAmount.fromRawAmount(eth, position.amount0.quotient).toSignificant(6);
    }

    res.json({
      success: true,
      amount: tiedAmount,
      current: priceCurrent
    })
  } catch (e) {
    console.log(e)
    res.json({
      success: false,
      amount: 'Error while calculating tied amount.'
    })
  }
}

export const createPosition: RequestHandler = async (req, res, next) => {
  if (!req.body.amount) {
    res.status(400).send({
      status: "failed",
      message: "Content cannot be empty."
    });
    return;
  }

  let setting = await Setting.findOne({ order: [["id", "desc"]] });
  if (!setting) {
    setting = { varianceRate: process.env.VARIANCE_RATE, rebalanceRate: process.env.REBALANCE_RATE };
  }

  const ethPrice = await Moralis.EvmApi.token.getTokenPrice({
    "chain": "0x38",
    "exchange": "pancakeswapv2",
    "address": String(process.env.BSC_PEG_ETHADDR)
  });

  const priceCurrent = ethPrice?.toJSON().usdPrice;

  const priceLower = priceCurrent - priceCurrent * parseFloat(setting.varianceRate) / 100;
  const priceUpper = priceCurrent + priceCurrent * parseFloat(setting.varianceRate) / 100;

  console.log(priceLower, priceCurrent, priceUpper);

  const ticks: any = {
    lower: tryParseTick(eth, usdc, fee, priceLower.toString()),
    upper: tryParseTick(eth, usdc, fee, priceUpper.toString()),
  }

  const pool = await getPool(eth, usdc, fee);

  const position = Position.fromAmount1({
    pool: pool,
    tickLower: ticks.lower,
    tickUpper: ticks.upper,
    amount1: parseUnits(String(req.body.amount), 18)
  });

  const deadline = Math.floor(Date.now() / 1000) + 20 * 60;
  const slippageTolerance = new Percent(BigInt(String(process.env.ALLOWED_SLIPPAGE)), BigInt(10000));
  const minimumAmounts = position.mintAmountsWithSlippage(slippageTolerance);

  const { calldata, value } = NonfungiblePositionManager.addCallParameters(position, {
    slippageTolerance,
    recipient: account.address,
    deadline: deadline.toString(),
    useNative: undefined,
    createPool: false,
  });
  const txn: any = {
    to: `0x${process.env.NF_V3_POSITION_MANAGER_ADDR}`,
    data: calldata,
    value: hexToBigInt(value),
    account,
  }

  const ethAllowance: any = await publicClient.readContract({
    address: `0x${process.env.BSC_PEG_ETHADDR}`,
    abi: bep20EthABI,
    functionName: 'allowance',
    args: [account.address, `0x${process.env.NF_V3_POSITION_MANAGER_ADDR}`]
  });

  const usdcAllowance: any = await publicClient.readContract({
    address: `0x${process.env.BSC_PEG_USDCADDR}`,
    abi: bep20usdcABI,
    functionName: 'allowance',
    args: [account.address, `0x${process.env.NF_V3_POSITION_MANAGER_ADDR}`]
  });

  console.log(position.mintAmounts.amount0, ethAllowance);
  console.log(position.mintAmounts.amount1, usdcAllowance);

  if (position.mintAmounts.amount0 > ethAllowance) {
    try {
      const ethAllowed = await walletClient.writeContract({
        address: `0x${process.env.BSC_PEG_ETHADDR}`,
        abi: bep20EthABI,
        functionName: 'approve',
        args: [`0x${process.env.NF_V3_POSITION_MANAGER_ADDR}`, position.mintAmounts.amount0],
        account
      });
      console.log(ethAllowed);
    } catch (e) {
      res.json({ success: false, message: 'Eth approve for PositionManager failed.' });
      return;
    }
  }

  if (position.mintAmounts.amount1 > usdcAllowance) {
    try {
      const usdcAllowed = await walletClient.writeContract({
        address: `0x${process.env.BSC_PEG_USDCADDR}`,
        abi: bep20usdcABI,
        functionName: 'approve',
        args: [`0x${process.env.NF_V3_POSITION_MANAGER_ADDR}`, position.mintAmounts.amount1],
        account
      });
      console.log(usdcAllowed);
    } catch (e) {
      res.json({ success: false, message: 'USDC approve for PositionManager failed.' });
      return;
    }
  }

  try {
    const gasEstimated = await waitUntilGas(txn, false);

    if (gasEstimated) {
      const txHash = await walletClient.sendTransaction(txn);

      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, confirmations: 2 });
      if (receipt && receipt.status == "success") {
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
          priceAt: priceCurrent,
          priceLower: priceLower,
          priceUpper: priceUpper,
          varianceRate: setting.varianceRate,
          rebalanceRate: setting.rebalanceRate,
          prevPos: 0,
          nextPos: 0,
          isProcessing: 0
        };
        const created = await MyPosition.create(mypos);

        res.json({ success: true, position: created });
      } else
        res.json({ success: false, message: 'Transaction failed. Please check the gas or try again.' });
    } else
      res.json({ success: false, message: 'Transaction reverted. Please check the gas or try again.' });
  } catch (e) {
    console.log(e);
    res.json({ success: false, message: 'Transaction failed. Please check the gas or try again.' });
  }
}

export const removePosition: RequestHandler = async (req, res, next) => {
  if (!req.body.posId) {
    res.status(400).send({
      status: "failed",
      message: "Content cannot be empty."
    });
    return;
  }

  const mypos = await MyPosition.findOne({ where: { id: req.body.posId } });
  if (!mypos) {
    res.json({
      success: false,
      amount: 'Position not found.'
    });
    return;
  }

  if (mypos.status != 0) {
    res.json({
      success: false,
      amount: 'Position already removed.'
    });
    return;
  }

  try {
    const posManager = getContract({ abi: nonfungiblePositionManagerABI, address: `0x${process.env.NF_V3_POSITION_MANAGER_ADDR}`, publicClient, walletClient });
    const posdata = await posManager.read.positions([BigInt(mypos.nftId)]);
    const [, , , , , tickLower, tickUpper, liquidity, , , ,] = posdata;

    const pool = await getPool(eth, usdc, fee);
    const positionSDK = new Position({
      pool,
      liquidity: liquidity.toString(),
      tickLower: tickLower,
      tickUpper: tickUpper,
    });

    const tokenOwner: any = await publicClient.readContract({
      address: `0x${process.env.NF_V3_POSITION_MANAGER_ADDR}`,
      abi: nonfungiblePositionManagerABI,
      functionName: 'ownerOf',
      args: [BigInt(mypos.nftId)]
    });

    const { result } = await publicClient.simulateContract({
      address: `0x${process.env.NF_V3_POSITION_MANAGER_ADDR}`,
      abi: nonfungiblePositionManagerABI,
      functionName: 'collect',
      args: [{ tokenId: BigInt(mypos.nftId), recipient: tokenOwner, amount0Max: BigInt(Number.MAX_SAFE_INTEGER), amount1Max: BigInt(Number.MAX_SAFE_INTEGER) }],
      account: tokenOwner,
      value: BigInt(0)
    });

    const [amount0, amount1] = result;
    const feeValue0 = CurrencyAmount.fromRawAmount(pool.token0, amount0.toString());
    const feeValue1 = CurrencyAmount.fromRawAmount(pool.token1, amount1.toString());

    const liquidityPercentage = new Percent(100, 100);
    const liquidityValue0 = CurrencyAmount.fromRawAmount(eth, positionSDK.amount0.quotient);
    const liquidityValue1 = CurrencyAmount.fromRawAmount(usdc, positionSDK.amount1.quotient);

    const options = {
      tokenId: mypos.nftId,
      liquidityPercentage,
      slippageTolerance: new Percent(BigInt(String(process.env.ALLOWED_SLIPPAGE)), BigInt(10000)),
      deadline: (Math.floor(Date.now() / 1000) + 20 * 60).toString(),
      collectOptions: {
        expectedCurrencyOwed0: feeValue0 ?? CurrencyAmount.fromRawAmount(liquidityValue0.currency, 0),
        expectedCurrencyOwed1: feeValue1 ?? CurrencyAmount.fromRawAmount(liquidityValue1.currency, 0),
        recipient: account.address,
      }
    };

    const isStaked = (tokenOwner.toLowerCase() !== account.address.toLowerCase());
    const managerAddr: any = isStaked ? `0x${process.env.MasterChefV3_ADDR}` : `0x${process.env.NF_V3_POSITION_MANAGER_ADDR}`;
    const interfaceManager = isStaked ? MasterChefV3 : NonfungiblePositionManager
    const { calldata, value } = interfaceManager.removeCallParameters(positionSDK, options);

    const txn = {
      to: managerAddr,
      data: calldata,
      value: hexToBigInt(value),
      account,
    }

    publicClient.estimateGas(txn).then(async (gas) => {
      console.log('Remove gas: ', gas);

      const feeEarned = JSON.stringify({ 'eth': formatUnits(feeValue0.quotient, 18), 'usdc': formatUnits(feeValue1.quotient, 18) });
      let cakeEarned = null;
      if (isStaked) {
        const pendingCake = await publicClient.readContract({
          address: `0x${process.env.MasterChefV3_ADDR}`,
          abi: masterChefV3ABI,
          functionName: 'pendingCake',
          args: [BigInt(mypos.nftId)]
        });

        cakeEarned = formatEther(pendingCake);
      }

      const txHash = await walletClient.sendTransaction(txn);
      console.log(txHash);

      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, confirmations: 2 });
      if (receipt && receipt.status == "success") {
        await mypos.update({ status: 1, isStaked: 0, feeEarned, cakeEarned, txHash });
        res.json({ success: true });
      } else {
        res.json({ success: false, message: "Transaction failed. Please check the gas or try again." });
      }
    }).catch((e) => {
      console.log(e);

      res.json({
        success: false,
        message: "Transaction failed. Please check the gas or try again."
      });
    });
  } catch (e) {
    console.log(e);
    res.json({
      success: false,
      message: "Error while removing the position."
    });
  }
}