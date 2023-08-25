import Moralis from 'moralis';
import { privateKeyToAccount } from 'viem/accounts';
const db = require("../models");
const Sequelize = require("sequelize");
const Op = Sequelize.Op;
const MyPosition = db.myposition;

const account = privateKeyToAccount(`0x${process.env.PRIVATE_KEY}`);

const doAutoStake = () => {

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
            await position.update({ nftId: txn.token_id });
            doAutoStake();
          }
        })
      } else
        resolve(false);
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
}