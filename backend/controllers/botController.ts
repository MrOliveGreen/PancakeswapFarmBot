import Moralis from 'moralis';
import { privateKeyToAccount } from 'viem/accounts'

const account = privateKeyToAccount(`0x${process.env.PRIVATE_KEY}`);

exports.doRunBot = async () => {
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

  const response = await Moralis.EvmApi.nft.getWalletNFTTransfers({
    "chain": "0x38",
    "format": "decimal",
    "direction": "both",
    "address": account.address
  });

  console.log(ethPrice?.toJSON()?.usdPrice);
  console.log(usdcPrice?.toJSON()?.usdPrice);
}