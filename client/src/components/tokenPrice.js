const ethPrice = 1700;
const usdcPrice = 0.999;
const myWallet = 0x123123123;
const ethAmount = 2;
const usdcAmount = 123;

const TokenPrice = () => {
  return (
    <div className="d-flex gap-5 mt-3">
      <div className="text-start">
        <h5>ETH price: {ethPrice} USD</h5>
        <h5>USDC price: {usdcPrice} USD</h5>
        <h5>ETH/USDC: {(ethPrice / usdcPrice).toFixed(2)} USD</h5>
      </div>
      <div className="text-start">
        <h5>My Wallet: {myWallet}</h5>
        <h5>ETH(BSC) Amount: {ethAmount}</h5>
        <h5>USDC(BSC) Amount: {usdcAmount}</h5>
      </div>
    </div>
  );
};

export default TokenPrice;
