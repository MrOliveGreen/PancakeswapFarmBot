import { useEffect, useState } from "react";
import ClipLoader from "react-spinners/ClipLoader";
import _debounce from "lodash/debounce";
import { getTiedAmount, getTokenPrice, getWalletStatus } from "./Api";

const ethPrice = 1700;
const usdcPrice = 0.999;
const myWallet = 0x123123123;
const ethAmount = 2;
const usdcAmount = 123;

const headCells = [
  {
    id: "name",
    label: "Event",
  },
  {
    id: "date",
    label: "Date",
  },
  {
    id: "time",
    label: "Time",
  },
  {
    id: "location",
    label: "Location",
  },
];

function createData(name, date, time, location) {
  return {
    name,
    date,
    time,
    location,
  };
}

const rows = [
  createData("#876361", "12 Dev, 2020", "Elisabeth McQueen", 4),
  createData("#876362", "12 Dev, 2020", "Elisabeth McQueen", 4),
  createData("#876363", "12 Dev, 2020", "Elisabeth McQueen", 4),
  createData("#876364", "12 Dev, 2020", "Elisabeth McQueen", 4),
  createData("#876365", "12 Dev, 2020", "Elisabeth McQueen", 4),
  createData("#876366", "12 Dev, 2020", "Elisabeth McQueen", 4),
];

const Main = () => {
  const [eth, setEth] = useState("");
  const [usdc, setUsdc] = useState("");
  const [ethPrice, setEthPrice] = useState();
  const [usdcPrice, setUsdcPrice] = useState();
  const [myEthAmount, setMyEthAmount] = useState();
  const [myUsdcAmount, setMyUsdcAmount] = useState();
  const [walletAddress, setWalletAddress] = useState("");

  useEffect(() => {
    const fetchTokenPrices = async () => {
      const tokenPrices = await getTokenPrice();
      console.log("tokenPrices =====", tokenPrices);
      if (tokenPrices) {
        setEthPrice(tokenPrices?.ethPrice);
        setUsdcPrice(tokenPrices?.usdcPrice);
      }
    };

    const fetchWalletStatus = async () => {
      const walletStatus = await getWalletStatus();
      console.log("walletStatus =====", walletStatus);
      if (walletStatus) {
        setMyEthAmount(walletStatus.ethAmount);
        setMyUsdcAmount(walletStatus.usdcAmount);
        setWalletAddress(walletStatus.address);
      }
    };

    fetchTokenPrices();
    fetchWalletStatus();
  }, []);

  const debouncedEthGetTiedAmount = _debounce(async () => {
    const data = await getTiedAmount("token0", eth, ethPrice / usdcPrice);
    setUsdc(data.amount);
  }, 500);

  const debouncedUsdcGetTiedAmount = _debounce(async () => {
    const data = await getTiedAmount("token1", usdc, ethPrice / usdcPrice);
    setEth(data.amount);
  }, 500);

  const handleEthInputChange = (event) => {
    setEth(event.target.value);
    debouncedEthGetTiedAmount(); // Call the debounced function
  };

  const handleUsdcInputChange = (event) => {
    setUsdc(event.target.value);
    debouncedUsdcGetTiedAmount(); // Call the debounced function
  };

  useEffect(() => {
    return () => {
      debouncedEthGetTiedAmount.cancel();
      debouncedUsdcGetTiedAmount.cancel();
    };
  }, []);

  useEffect(() => {
    // Run the debounced function whenever `eth` or `usdc` values change
    debouncedEthGetTiedAmount(eth);
  }, [eth]);

  useEffect(() => {
    // Run the debounced function whenever `eth` or `usdc` values change
    debouncedUsdcGetTiedAmount(usdc);
  }, [usdc]);

  return (
    <div className="main">
      <div className="container">
        <div className="d-flex justify-content-between gap-3">
          <div className="d-flex gap-5 mt-3">
            <div className="text-start">
              {ethPrice && usdcPrice ? (
                <>
                  <h5>ETH price: {ethPrice ? ethPrice.toFixed(2) : ""} USD</h5>
                  <h5>
                    USDC price: {usdcPrice ? usdcPrice.toFixed(2) : ""} USD
                  </h5>
                  <h5>ETH/USDC: {(ethPrice / usdcPrice).toFixed(2)} USD</h5>
                </>
              ) : (
                <div
                  style={{
                    minWidth: "260px",
                    textAlign: "center",
                    paddingTop: "10px",
                  }}
                >
                  <ClipLoader color="#ffffff" size={70} />
                </div>
              )}
            </div>
            <div className="text-start">
              {walletAddress && myEthAmount && myUsdcAmount ? (
                <>
                  <h5>{`My Wallet: ${walletAddress.substring(
                    0,
                    5
                  )}...${walletAddress.substring(
                    walletAddress.length - 4
                  )}`}</h5>
                  <h5>ETH(BSC) Amount: {myEthAmount}</h5>
                  <h5>USDC(BSC) Amount: {myUsdcAmount}</h5>
                </>
              ) : (
                <div
                  style={{
                    minWidth: "260px",
                    textAlign: "center",
                    paddingTop: "10px",
                  }}
                >
                  <ClipLoader color="#ffffff" size={70} />
                </div>
              )}
            </div>
          </div>

          <div>
            <h5>Create Position</h5>
            <div className="input-box">
              <h5>ETH</h5>
              <input
                type="text"
                placeholder="Eth amount"
                value={eth}
                onChange={handleEthInputChange}
              />
            </div>
            <div className="input-box">
              <h5>USDC</h5>
              <input
                type="text"
                placeholder="USDC amount"
                value={usdc}
                onChange={handleUsdcInputChange}
              />
            </div>
            <div className="text-end">
              <button
                className="normal-btn text"
                disabled={eth > ethAmount || usdc > usdcAmount}
              >
                Create
              </button>
            </div>
          </div>
        </div>

        <div className="divider"></div>

        <div className="settings">
          <h4>Settings</h4>
          <div className="d-flex align-items-center justify-content-center gap-5">
            <div className="setting-input">
              <label htmlFor="variance">Variance Rate:</label>
              <input id="variance" name="variance" type="text" />%
            </div>
            <div className="setting-input">
              <label htmlFor="rebalance">Rebalance Rate:</label>
              <input id="rebalance" name="rebalance" type="text" />%
            </div>
            <div>
              <div className="d-flex align-items-center gap-2 mb-3">
                <label className="switch">
                  <input type="checkbox" />
                  <span className="slider round"></span>
                </label>
                <label>Auto swap</label>
              </div>
              <div className="d-flex align-items-center gap-2">
                <label className="switch">
                  <input type="checkbox" />
                  <span className="slider round"></span>
                </label>
                <label>Auto add liquidity</label>
              </div>
            </div>
          </div>
        </div>

        <div className="divider"></div>

        <div className="positions">
          <h4>My Positions</h4>

          <div className="table-responsive mt-5">
            <table className="table table-striped custom-table">
              <thead>
                <tr>
                  {headCells.map((cell, index) => (
                    <th scope="col" key={index}>
                      {cell.label}
                    </th>
                  ))}
                  {/* <th scope="col">Order</th> */}
                  {/* <th scope="col">Name</th> */}
                  {/* <th scope="col">Occupation</th> */}
                  {/* <th scope="col">Contact</th> */}
                  {/* <th scope="col">Education</th> */}
                  {/* <th scope="col"></th> */}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, map) => (
                  <tr scope="row" key={map}>
                    {headCells.map((cell, index) => (
                      <td key={index}>{row[cell.id]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Main;
