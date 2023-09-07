import Moralis from 'moralis';
import { createPublicClient, http, createWalletClient, formatEther, getContract, hexToBigInt, formatUnits, parseUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { bsc } from 'viem/chains'
import { nonfungiblePositionManagerABI } from "~/abi/NonfungiblePositionManager";
import { masterChefV3ABI } from "~/abi/MasterChefV3";
import { PancakeV3PoolABI } from "~/abi/PancakeV3Pool";
import { eth, usdc, fee, waitUntilGas, getPool, getBestTrade, tryParseTick } from "./functions"
import { CurrencyAmount } from '@pancakeswap/swap-sdk-core';
import { Position, NonfungiblePositionManager, MasterChefV3, Pool } from '@pancakeswap/v3-sdk';
import { Percent, ChainId } from '@pancakeswap/sdk';
import { SwapRouter, SMART_ROUTER_ADDRESSES } from '@pancakeswap/smart-router/evm';
import { bep20EthABI } from '~/abi/bep20Eth';
import { bep20usdcABI } from "~/abi/bep20usdc";

const db = require("../models");
const Sequelize = require("sequelize");
const Op = Sequelize.Op;
const MyPosition = db.myposition;
const Setting = db.setting;
const Swap = db.swap;

const walletClient = createWalletClient({
  chain: bsc,
  transport: http(process.env.BSC_RPC_URL)
})

const publicClient = createPublicClient({
  chain: bsc,
  transport: http(process.env.BSC_RPC_URL)
})

const account = privateKeyToAccount(`0x${process.env.PRIVATE_KEY}`);

const doAutoStake = (tokenId: string) => {
  return new Promise(async (resolve, reject) => {
    const tokenOwner: any = await publicClient.readContract({
      address: `0x${process.env.NF_V3_POSITION_MANAGER_ADDR}`,
      abi: nonfungiblePositionManagerABI,
      functionName: 'ownerOf',
      args: [BigInt(tokenId)]
    });

    if (tokenOwner.toLowerCase() == account.address.toLowerCase()) { // not staked yet
      try {
        const wdata: any = {
          address: `0x${process.env.NF_V3_POSITION_MANAGER_ADDR}`,
          abi: nonfungiblePositionManagerABI,
          functionName: 'safeTransferFrom',
          args: [account.address, `0x${process.env.MasterChefV3_ADDR}`, BigInt(tokenId)],
          account
        };
        const gasEstimated = await waitUntilGas(wdata);

        if (gasEstimated) {
          const txHash = await walletClient.writeContract(wdata);
          if (txHash.includes(`0x`))
            resolve(true);
          else
            resolve(false);
        } else
          resolve(false);
      } catch (e) {
        console.log(e);
        resolve(false);
      }
    }
    else
      resolve(false);
  })
}

const checkTokenIds = () => {
  return new Promise(async (resolve, reject) => {
    const positions = await MyPosition.findAll({ where: { txHash: { [Op.ne]: null }, nftId: { [Op.eq]: null } } });
    console.log('NFTID needed: ', positions.length);
    if (positions?.length > 0) {
      try {
        const response = await Moralis.EvmApi.nft.getWalletNFTTransfers({
          "chain": "0x38",
          "format": "decimal",
          "direction": "both",
          "address": account.address
        });

        if (response?.raw?.result?.length > 0) {
          const txns = response.raw.result;
          positions.forEach(async (position: any) => {
            const txn = txns.find(t => t.token_address.toLowerCase() == `0x${process.env.NF_V3_POSITION_MANAGER_ADDR}` && t.transaction_hash.toLowerCase() == position.txHash.toLowerCase());
            console.log(txn);
            if (txn) {
              const receipt = await publicClient.waitForTransactionReceipt({ hash: position.txHash, confirmations: 2 });
              if (receipt && receipt.status == 'success') {
                let staked = await doAutoStake(txn.token_id);
                if (staked)
                  await position.update({ nftId: txn.token_id, isStaked: staked });
                else
                  console.log('Auto stake failed');
              } else {
                console.log('Autostake transaction failed. Receipt returned reverted.');
              }
            }
          });
          resolve(true);
        } else
          resolve(false);
      } catch (e) {
        console.log(e);
        resolve(false);
      }
    } else
      resolve(false);
  });
}

const calcFees = () => {
  return new Promise(async (resolve, reject) => {
    const positions = await MyPosition.findAll({ where: { status: 0, nftId: { [Op.ne]: null }, isStaked: 1, isProcessing: 0 } });
    if (positions?.length > 0) {
      for (let i = 0; i < positions.length; i++) {
        const tokenOwner: any = await publicClient.readContract({
          address: `0x${process.env.NF_V3_POSITION_MANAGER_ADDR}`,
          abi: nonfungiblePositionManagerABI,
          functionName: 'ownerOf',
          args: [BigInt(positions[i].nftId)]
        });

        const { result } = await publicClient.simulateContract({
          address: `0x${process.env.NF_V3_POSITION_MANAGER_ADDR}`,
          abi: nonfungiblePositionManagerABI,
          functionName: 'collect',
          args: [{ tokenId: BigInt(positions[i].nftId), recipient: tokenOwner, amount0Max: BigInt(Number.MAX_SAFE_INTEGER), amount1Max: BigInt(Number.MAX_SAFE_INTEGER) }],
          account: tokenOwner,
          value: BigInt(0)
        });

        const [amount0, amount1] = result;
        const feeValue0 = CurrencyAmount.fromRawAmount(eth, amount0.toString());
        const feeValue1 = CurrencyAmount.fromRawAmount(usdc, amount1.toString());
        const feeEarned = JSON.stringify({ 'eth': formatUnits(feeValue0.quotient, 18), 'usdc': formatUnits(feeValue1.quotient, 18) });

        const updates: any = { feeEarned: feeEarned };
        if (tokenOwner.toLowerCase() == String(`0x${process.env.MasterChefV3_ADDR}`).toLowerCase()) { // staked
          const pendingCake = await publicClient.readContract({
            address: `0x${process.env.MasterChefV3_ADDR}`,
            abi: masterChefV3ABI,
            functionName: 'pendingCake',
            args: [BigInt(positions[i].nftId)]
          });
          updates['cakeEarned'] = formatEther(pendingCake);
        }

        await positions[i].update(updates);
      };

      resolve(true);
    } else
      resolve(false);
  });
}

const autoRemovePos = (posId: number): Promise<Boolean> => {
  return new Promise(async (resolve, reject) => {
    const mypos = await MyPosition.findOne({ where: { id: posId } });
    if (!mypos)
      resolve(false)

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
        console.log('Auto remove gas: ', gas);

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
        if (receipt && receipt.status == 'success') {
          await mypos.update({ status: 1, isStaked: 0, feeEarned, cakeEarned, txHash });
          resolve(true);
        } else {
          console.log('Auto remove pos transaction failed. Receipt returned reverted.');
          resolve(false);
        }
      }).catch((e) => {
        console.log(e);
        resolve(false);
      });
    } catch (e) {
      console.log(e);
      resolve(false);
    }
  });
}

const autoSwap = (posId: number, swapFrom: string): Promise<Boolean> => {
  return new Promise(async (resolve, reject) => {
    const mypos = await MyPosition.findOne({ where: { id: posId } });
    if (!mypos)
      resolve(false)

    const feeEarned = mypos.feeEarned ? JSON.parse(mypos.feeEarned) : null;
    var swapAmountRaw = parseFloat(swapFrom == "usdc" ? mypos.amount1Desired : mypos.amount0Desired);
    if (feeEarned)
      swapAmountRaw += parseFloat(swapFrom == "usdc" ? feeEarned.usdc : feeEarned.eth);

    const earnedAmount = CurrencyAmount.fromRawAmount(swapFrom == "usdc" ? usdc : eth, parseUnits(swapAmountRaw.toString(), 18));
    const rebalanceRate = new Percent(parseInt(mypos.rebalanceRate), 100);
    const swapAmount = earnedAmount.multiply(rebalanceRate);
    console.log('swapAmount: ', swapAmount.quotient);

    const trade: any = await getBestTrade(swapAmount, (swapFrom == "usdc" ? usdc : eth), (swapFrom == "usdc" ? eth : usdc));
    console.log('trade: ', trade);

    const { value, calldata } = SwapRouter.swapCallParameters(trade, {
      recipient: account.address,
      slippageTolerance: new Percent(1),
    });

    const routerAddress = SMART_ROUTER_ADDRESSES[ChainId.BSC];
    const allowance: any = await publicClient.readContract({
      address: `0x${swapFrom == "usdc" ? process.env.BSC_PEG_USDCADDR : process.env.BSC_PEG_ETHADDR}`,
      abi: swapFrom == "usdc" ? bep20usdcABI : bep20EthABI,
      functionName: 'allowance',
      args: [account.address, routerAddress]
    });

    if (swapAmount.quotient > allowance) { // Need to do approve
      try {
        const allowedTx = await walletClient.writeContract({
          address: `0x${swapFrom == "usdc" ? process.env.BSC_PEG_USDCADDR : process.env.BSC_PEG_ETHADDR}`,
          abi: swapFrom == "usdc" ? bep20usdcABI : bep20EthABI,
          functionName: 'approve',
          args: [routerAddress, swapAmount.quotient],
          account
        });
        console.log(`Autoswap ${swapFrom} allowed. Tx: `, allowedTx);
      } catch (e) {
        console.log(e)
        resolve(false);
      }
    }

    const txn = {
      to: routerAddress,
      data: calldata,
      value: hexToBigInt(value),
      account,
    }

    const gasEstimated = await waitUntilGas(txn, false);
    if (gasEstimated) {
      const txHash = await walletClient.sendTransaction(txn);
      console.log(`Autoswap Done. Tx: `, txHash);

      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, confirmations: 2 });
      if (receipt && receipt.status == 'success') {
        await Swap.create({
          posId,
          rebalanceRate: mypos.rebalanceRate,
          swapFrom,
          swapTo: (swapFrom == "usdc" ? "eth" : "usdc"),
          amount: formatUnits(swapAmount.quotient, 18),
          txHash
        });
        resolve(true);
      } else {
        console.log('Auto swap transaction failed. Receipt returned reverted.');
        resolve(false);
      }
    } else {
      console.log('Transaction reverted. Gas estimation failed.');
      resolve(false);
    }
  });
}

const autoCreatePosition = (posId: number) => {
  return new Promise(async (resolve, reject) => {
    const prevpos = await MyPosition.findOne({ where: { id: posId } });
    if (!prevpos)
      resolve(false)

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

      if (usdcAmount) {
        var maxAmount = BigInt(0);
        var position: any;
        const token1Amount = CurrencyAmount.fromRawAmount(usdc, usdcAmount);

        for (let i = 100; i > 0; i--) {
          const rate = new Percent(i, 100);
          const possibleAmount = token1Amount.multiply(rate);
          const possiblePosition = Position.fromAmount1({
            pool: pool,
            tickLower: ticks.lower,
            tickUpper: ticks.upper,
            amount1: possibleAmount.quotient
          });

          if (ethAmount > possiblePosition.amount0.quotient) {
            maxAmount = possibleAmount.quotient;
            position = possiblePosition;
            break;
          }
        }

        if (maxAmount > 0) {
          console.log('Best amount calculated: ', formatUnits(maxAmount, 18));
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
              console.log('Eth approve for PositionManager failed.');
              resolve(false);
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
              console.log('USDC approve for PositionManager failed.');
              resolve(false);
            }
          }

          const gasEstimated = await waitUntilGas(txn, false);
          if (gasEstimated) {
            const txHash = await walletClient.sendTransaction(txn);
            console.log(`Auto Create Position Done. Tx: `, txHash);

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
              prevPos: prevpos.id,
              nextPos: 0,
              isProcessing: 0
            };
            const created = await MyPosition.create(mypos);
            await prevpos.update({ nextPos: created.id });

            resolve(true);
          } else {
            console.log('Transaction reverted. Gas estimation failed.');
            resolve(false);
          }

        } else {
          console.log(`Calculating Max USDC Amount came to 0. Failed to auto create the position.`);
          resolve(false);
        }
      } else {
        console.log(`USDC Amount 0. Failed to auto create the position.`);
        resolve(false);
      }
    } catch (e) {
      console.log(e);
      resolve(false);
    }
  });
}

const monitorPositions = () => {
  return new Promise(async (resolve, reject) => {
    try {
      const ethPrice = await Moralis.EvmApi.token.getTokenPrice({
        "chain": "0x38",
        "exchange": "pancakeswapv2",
        "address": String(process.env.BSC_PEG_ETHADDR)
      });
      const priceCurrent = ethPrice?.toJSON().usdPrice;

      let setting = await Setting.findOne({ order: [["id", "desc"]] });
      if (!setting) {
        setting = { varianceRate: process.env.VARIANCE_RATE, rebalanceRate: process.env.REBALANCE_RATE, autoSwap: 1, autoAddLiquidity: 1 };
      }

      const positions = await MyPosition.findAll({ where: { status: 0, nftId: { [Op.ne]: null }, isStaked: 1, isProcessing: 0 } });
      if (positions?.length > 0) {
        for (let i = 0; i < positions.length; i++) {
          if (priceCurrent <= positions[i].priceLower || priceCurrent >= positions[i].priceUpper) {
            console.log(positions[i].priceLower, priceCurrent, positions[i].priceUpper);
            await positions[i].update({ isProcessing: 1 });

            const isRemoved = await autoRemovePos(positions[i].id);
            if (!isRemoved) {
              console.log(`Position ${positions[i].id}(#${positions[i].nftId}) Auto Position Remove failed.`);
            } else {
              if (setting.autoSwap == 1) {
                const isSwapped = await autoSwap(positions[i].id, priceCurrent <= positions[i].priceLower ? "usdc" : "eth");
                if (!isSwapped) {
                  console.log(`Position ${positions[i].id}(#${positions[i].nftId}) Auto Swap failed.`);
                } else {
                  const isCreated = await autoCreatePosition(positions[i].id);
                  if (!isCreated) {
                    console.log(`From Position ${positions[i].id}(#${positions[i].nftId}) Auto Creation failed.`);
                  } else
                    console.log(`From Position ${positions[i].id}(#${positions[i].nftId}) Auto Creation done.`);
                }
              }
            }

            await positions[i].update({ isProcessing: 0 });
          }
        }
      }

      resolve(true);
    } catch (e) {
      console.log(e);
      resolve(false);
    }
  })
}

exports.doRunBot = async () => {
  await checkTokenIds();
  await calcFees();
  await monitorPositions();
}