import { useEffect, useState } from "react";
import { useDebounce } from "use-debounce";
import ClipLoader from "react-spinners/ClipLoader";
import { useSnackbar } from "notistack";
import {
  createPosition,
  getPositions,
  getSetting,
  getTiedAmount,
  getTokenPrice,
  getWalletStatus,
  saveSetting,
} from "./Api";

const headCells = [
  {
    id: "nftId",
    label: "NFT ID",
  },
  {
    id: "txHash",
    label: "Tx Hash",
  },
  {
    id: "isStaked",
    label: "Staked",
  },
  {
    id: "earned",
    label: "Earned Cake/Fee",
  },
  {
    id: "priceRate",
    label: "Price Rate",
  },
  {
    id: "createdAt",
    label: "Date",
  },
];

const Main = () => {
  const [eth, setEth] = useState();
  const [usdc, setUsdc] = useState();
  const [ethPrice, setEthPrice] = useState();
  const [usdcPrice, setUsdcPrice] = useState();
  const [myEthAmount, setMyEthAmount] = useState();
  const [myUsdcAmount, setMyUsdcAmount] = useState();
  const [walletAddress, setWalletAddress] = useState("");
  const [focus, setFocus] = useState(0);
  const [varianceRate, setVarianceRate] = useState("");
  const [rebalanceRate, setRebalanceRate] = useState("");
  const [autoSwap, setAutoSwap] = useState(false);
  const [autoAddLiquidity, setAutoAddLiquidity] = useState(false);
  const [positions, setPositions] = useState([]);
  const [createLoading, setCreateLoading] = useState(false);
  const { enqueueSnackbar } = useSnackbar();

  const [debouncedEth] = useDebounce(eth, 500);
  const [debouncedUsdc] = useDebounce(usdc, 500);

  useEffect(() => {
    const fetchTokenPrices = async () => {
      const tokenPrices = await getTokenPrice();
      if (tokenPrices) {
        setEthPrice(tokenPrices?.ethPrice);
        setUsdcPrice(tokenPrices?.usdcPrice);
      }
    };

    const fetchWalletStatus = async () => {
      const walletStatus = await getWalletStatus();
      if (walletStatus) {
        setMyEthAmount(walletStatus.ethAmount);
        setMyUsdcAmount(walletStatus.usdcAmount);
        setWalletAddress(walletStatus.address);
      }
    };

    const fetchGetSetting = async () => {
      const res = await getSetting();
      if (res?.success) {
        setVarianceRate(res.data.varianceRate);
        setRebalanceRate(res.data.rebalanceRate);
        setAutoSwap(res.data.autoSwap === 1 ? true : false);
        setAutoAddLiquidity(res.data.autoAddLiquidity === 1 ? true : false);
      }
    };

    const fetchGetPositions = async () => {
      const res = await getPositions();
      if (res?.success) {
        setPositions(res.data);
      }
    };

    setInterval(fetchTokenPrices, 10000);
    fetchWalletStatus();
    fetchGetSetting();
    fetchGetPositions();
  }, []);

  const debouncedEthGetTiedAmount = async () => {
    const data = await getTiedAmount("token0", eth, ethPrice / usdcPrice);
    if (data?.success) setUsdc(parseFloat(data?.amount).toFixed(2));
  };

  const debouncedUsdcGetTiedAmount = async () => {
    const data = await getTiedAmount("token1", usdc, ethPrice / usdcPrice);
    if (data) setEth(parseFloat(data?.amount).toFixed(2));
  };

  const handleEthInputChange = (event) => {
    setEth(event.target.value);
  };

  const handleUsdcInputChange = (event) => {
    setUsdc(event.target.value);
  };

  useEffect(() => {
    // Run the debounced function whenever `eth` or `usdc` values change
    if (focus === 1) {
      debouncedEthGetTiedAmount(); // Call the debounced function
    }
  }, [debouncedEth]);

  useEffect(() => {
    // Run the debounced function whenever `eth` or `usdc` values change
    if (focus === 2) {
      debouncedUsdcGetTiedAmount(usdc);
    }
  }, [debouncedUsdc]);

  const handleCreate = async () => {
    setCreateLoading(false);
    const res = await createPosition(usdc, ethPrice / usdcPrice);
    if (res?.success) {
      setPositions([...positions, res.position]);
      enqueueSnackbar("Position is created successfully!", {
        variant: "success",
        autoHideDuration: 1500,
      });
      setCreateLoading(true);
    } else {
      enqueueSnackbar("Something went wrong!", {
        variant: "error",
        autoHideDuration: 1500,
      });
    }
  };

  const handleSaveSettings = async () => {
    const res = await saveSetting(
      varianceRate,
      rebalanceRate,
      autoSwap,
      autoAddLiquidity
    );
    if (res?.success) {
      enqueueSnackbar("Setting is saved successfully!", {
        variant: "success",
        autoHideDuration: 1500,
      });
    } else {
      enqueueSnackbar("Something went wrong!", {
        variant: "error",
        autoHideDuration: 1500,
      });
    }
  };

  const changeDateFormate = (inputDate) => {
    const date = new Date(inputDate);
    const day = date.getDate();
    const month = date.getMonth() + 1; // Months are zero-indexed, so we add 1
    const year = date.getFullYear();

    const formattedDate = `${month}/${day}/${year}`;
    return formattedDate;
  };

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
                onFocus={(e) => setFocus(1)}
              />
            </div>
            <div className="input-box">
              <h5>USDC</h5>
              <input
                type="text"
                placeholder="USDC amount"
                value={usdc}
                onChange={handleUsdcInputChange}
                onFocus={(e) => setFocus(2)}
              />
            </div>
            <div className="text-end">
              <button
                className="normal-btn text"
                disabled={
                  !eth || !usdc || eth > myEthAmount || usdc > myUsdcAmount
                }
                onClick={handleCreate}
              >
                {createLoading ? (
                  <ClipLoader color="#ffffff" size={35} />
                ) : (
                  "Create"
                )}
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
              <input
                id="variance"
                name="variance"
                type="text"
                value={varianceRate}
                onChange={(e) => setVarianceRate(e.target.value)}
              />
              %
            </div>
            <div className="setting-input">
              <label htmlFor="rebalance">Rebalance Rate:</label>
              <input
                id="rebalance"
                name="rebalance"
                type="text"
                value={rebalanceRate}
                onChange={(e) => setRebalanceRate(e.target.value)}
              />
              %
            </div>
            <div>
              <div className="d-flex align-items-center gap-2 mb-3">
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={autoSwap}
                    onChange={() => setAutoSwap(!autoSwap)}
                  />
                  <span className="slider round"></span>
                </label>
                <label>Auto swap</label>
              </div>
              <div className="d-flex align-items-center gap-2">
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={autoAddLiquidity}
                    onChange={() => setAutoAddLiquidity(!autoAddLiquidity)}
                  />
                  <span className="slider round"></span>
                </label>
                <label>Auto add liquidity</label>
              </div>
            </div>
          </div>
          <button className="normal-btn text mt-5" onClick={handleSaveSettings}>
            Save
          </button>
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
                {positions.map((row, index) => (
                  <tr scope="row" key={index}>
                    {headCells.map((cell, index) => (
                      <td key={index}>
                        {cell.id === "nftId" && !row[cell.id] ? (
                          "?"
                        ) : cell.id === "isStaked" ? (
                          row[cell.id] === 0 ? (
                            "No"
                          ) : (
                            "Yes"
                          )
                        ) : cell.id === "earned" ? (
                          `${row["cakeEarned"] ? row["cakeEarned"] : 0}/${
                            row["feeEarned"] ? row["feeEarned"] : 0
                          }`
                        ) : cell.id === "priceRate" ? (
                          parseFloat(row[cell.id]).toFixed(2)
                        ) : cell.id === "createdAt" ? (
                          changeDateFormate(row[cell.id])
                        ) : cell.id === "txHash" ? (
                          <a
                            href={`https://bscscan.com/tx/${row[cell.id]}`}
                            target="_blank"
                          >
                            {row[cell.id]}
                          </a>
                        ) : (
                          row[cell.id]
                        )}
                      </td>
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
