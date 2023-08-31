import Moralis from 'moralis';
import { createPublicClient, http, createWalletClient, formatEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { bsc } from 'viem/chains'
import { nonfungiblePositionManagerABI } from "~/abi/NonfungiblePositionManager";
import { masterChefV3ABI } from "~/abi/MasterChefV3";
import { waitUntilGas, formatCurrencyAmount } from "./functions"
import { Token, CurrencyAmount } from '@pancakeswap/swap-sdk-core'
const db = require("../models");
const Sequelize = require("sequelize");
const Op = Sequelize.Op;
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
            let staked = await doAutoStake(txn.token_id);
            await position.update({ nftId: txn.token_id, isStaked: staked });
          }
        });
        resolve(true);
      } else
        resolve(false);
    } else
      resolve(false);
  });
}

const eth = new Token(56, `0x${process.env.BSC_PEG_ETHADDR}`, 18, 'weth', 'ETH');
const usdc = new Token(56, `0x${process.env.BSC_PEG_USDCADDR}`, 18, 'usdc', 'USDC');

const calcFees = () => {
  return new Promise(async (resolve, reject) => {
    const positions = await MyPosition.findAll({ where: { status: 0 } });
    if (positions?.length > 0) {
      for(let i = 0; i < positions.length; i ++) {
        if(!positions[i].nftId || positions[i].isStaked == 0)
          break;
        
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
        const feeEarned = JSON.stringify({ 'eth': formatCurrencyAmount(feeValue0, 4, 'en-US'), 'usdc': formatCurrencyAmount(feeValue1, 4, 'en-US') });

        const updates: any = { feeEarned: feeEarned };
        if(tokenOwner.toLowerCase() == String(`0x${process.env.MasterChefV3_ADDR}`).toLowerCase()) { // staked
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

exports.doRunBot = async () => {
  // const ethPrice = await Moralis.EvmApi.token.getTokenPrice({
  //   "chain": "0x38",
  //   "exchange": "pancakeswapv2",
  //   "address": String(process.env.BSC_PEG_ETHADDR)
  // });

  // const usdcPrice = await Moralis.EvmApi.token.getTokenPrice({
  //   "chain": "0x38",
  //   "exchange": "pancakeswapv2",
  //   "address": String(process.env.BSC_PEG_USDCADDR)
  // });

  await checkTokenIds();
  await calcFees();
}