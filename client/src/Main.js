import { useEffect, useState } from "react";
import { useDebounce } from "use-debounce";
import ClipLoader from "react-spinners/ClipLoader";
import { useSnackbar } from "notistack";
import Modal from "react-modal";
import {
  createPosition,
  getPositions,
  getSetting,
  getTiedAmount,
  getTokenPrice,
  getWalletStatus,
  removePosition,
  saveSetting,
  updatePosition,
} from "./Api";

const headCells = [
  {
    id: "nftId",
    label: "NFT ID",
  },
  {
    id: "liquidity",
    label: "Liquidity",
  },
  {
    id: "positionStatus",
    label: "Status",
  },
  {
    id: "feeEarned",
    label: "Earned Fee",
  },
  {
    id: "cakeEarned",
    label: "Earned Cake",
  },
  {
    id: "action",
    label: "Action",
  },
];

const Main = () => {
  const { enqueueSnackbar } = useSnackbar();

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
  const [removeLoading, setRemoveLoading] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedData, setSelectedData] = useState({});
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(0);
  const [rebalanceRateDetail, setRebalanceRateDetail] = useState(0);
  const [updateLoading, setUpdateLoading] = useState(null);

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
        setMyEthAmount(parseFloat(walletStatus.ethAmount).toFixed(6));
        setMyUsdcAmount(parseFloat(walletStatus.usdcAmount).toFixed(6));
        setWalletAddress(walletStatus.address);
      }
    };

    const fetchGetSetting = async () => {
      const res = await getSetting();
      if (res?.success) {
        setVarianceRate(res.data?.varianceRate ? res.data?.varianceRate : 10);
        setRebalanceRate(
          res.data?.rebalanceRate ? res.data?.rebalanceRate : 50
        );
        setAutoSwap(
          res.data?.autoSwap ? (res.data?.autoSwap === 1 ? true : false) : true
        );
        setAutoAddLiquidity(
          res.data?.autoAddLiquidity
            ? res.data?.autoAddLiquidity === 1
              ? true
              : false
            : true
        );
      }
    };

    const fetchGetPositions = async () => {
      const res = await getPositions();
      if (res?.success) {
        setPositions(res.data);
      }
    };

    fetchTokenPrices();
    setInterval(fetchTokenPrices, 10000);
    fetchWalletStatus();
    setInterval(fetchWalletStatus, 10000);
    fetchGetSetting();
    fetchGetPositions();
    setInterval(fetchGetPositions, 5000);
  }, []);

  const debouncedEthGetTiedAmount = async () => {
    const data = await getTiedAmount("token0", eth);
    if (data?.success) setUsdc(parseFloat(data?.amount));
  };

  const debouncedUsdcGetTiedAmount = async () => {
    const data = await getTiedAmount("token1", usdc);
    if (data) setEth(parseFloat(data?.amount));
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
    setCreateLoading(true);
    const res = await createPosition(usdc);
    if (res?.success) {
      setPositions([res.position, ...positions]);
      enqueueSnackbar("Position is created successfully!", {
        variant: "success",
        autoHideDuration: 1500,
      });
      setCreateLoading(false);
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
      debouncedUsdcGetTiedAmount();
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

  const showDetailInfo = (data) => {
    setIsOpen(true);
    setSelectedData(data);
    setMinPrice(data.priceLower);
    setMaxPrice(data.priceUpper);
    setRebalanceRateDetail(data.rebalanceRate);
  };

  const handleRemove = async (posId) => {
    setRemoveLoading(posId);
    const res = await removePosition(posId);
    if (res?.success) {
      enqueueSnackbar("Position is removed successfully!", {
        variant: "success",
        autoHideDuration: 1500,
      });
      const getRes = await getPositions();
      if (getRes?.success) {
        setPositions(res.data);
      }
    } else {
      enqueueSnackbar(res?.message, {
        variant: "error",
        autoHideDuration: 1500,
      });
    }
    setRemoveLoading(null);
  };

  const handleUpdate = async (element) => {
    setUpdateLoading(element);
    const propsData =
      element === "price"
        ? { posId: selectedData.id, minPrice, maxPrice }
        : { posId: selectedData.id, rebalanceRate: rebalanceRateDetail };
    const res = await updatePosition(propsData);
    if (res?.success) {
      enqueueSnackbar("Position is updated successfully!", {
        variant: "success",
        autoHideDuration: 1500,
      });
      if (element === "price") {
        setMinPrice(res.data.priceLower);
        setMaxPrice(res.data.priceUpper);
      } else {
        setRebalanceRateDetail(res.data.rebalanceRate);
      }
    } else {
      enqueueSnackbar(res?.message, {
        variant: "error",
        autoHideDuration: 1500,
      });
    }
    setUpdateLoading(null);
  };

  const Status = (row) => {
    if (row.row.status === 1) {
      return <div className="status-box red">Removed</div>;
    } else if (row.row.isProcessing === 1) {
      return <div className="status-box blue">Processing</div>;
    } else if (row.row.isStaked === 1) {
      return <div className="status-box green">Staked</div>;
    } else if (row.row.isStaked === 0) {
      return <div className="status-box yellow">Not Staked</div>;
    }
    return null;
  };

  return (
    <div className="main">
      <div className="container">
        <div className="d-flex justify-content-between gap-3">
          <div className="d-flex gap-5 mt-3">
            <div className="text-start">
              {ethPrice && usdcPrice ? (
                <>
                  <h5>ETH price: {ethPrice ? ethPrice.toFixed(6) : ""} USD</h5>
                  <h5>
                    USDC price: {usdcPrice ? usdcPrice.toFixed(6) : ""} USD
                  </h5>
                  <h5>ETH/USDC: {(ethPrice / usdcPrice).toFixed(6)} USD</h5>
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
                </tr>
              </thead>
              <tbody>
                {positions.map((row, index) => (
                  <tr scope="row" key={index}>
                    <td>{row["nftId"]}</td>
                    <td>
                      {`${row["amount0Desired"]}/`}
                      <br />
                      {`${row["amount1Desired"]}`}
                    </td>
                    <td>
                      <Status row={row} />
                    </td>
                    <td>
                      {row["feeEarned"] ? (
                        <p>
                          {`${JSON.parse(row["feeEarned"]).eth}/ `}
                          <br /> {`${JSON.parse(row["feeEarned"]).usdc}`}
                        </p>
                      ) : (
                        "0/0"
                      )}
                    </td>
                    <td>{row["cakeEarned"]}</td>
                    <td>
                      <div className="d-flex gap-2 justify-content-center">
                        <button
                          className="action-btn remove"
                          disabled={row["status"] === 1}
                          onClick={() => handleRemove(row.id)}
                        >
                          {removeLoading === row.id ? (
                            <ClipLoader color="#ffffff" size={20} />
                          ) : (
                            "Remove"
                          )}
                        </button>
                        <button
                          className="action-btn detail"
                          onClick={() => showDetailInfo(row)}
                        >
                          Detail
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <Modal
        isOpen={isOpen}
        onRequestClose={() => setIsOpen(false)}
        contentLabel="Detail Information"
        overlayClassName={{
          base: "overlay-base",
          afterOpen: "overlay-after",
          beforeClose: "overlay-before",
        }}
        className={{
          base: "content-base",
          afterOpen: "content-after",
          beforeClose: "content-before",
        }}
        closeTimeoutMS={500}
        preventScroll={true}
      >
        <div className="close">
          <i className="fa close-icon" onClick={() => setIsOpen(false)}>
            &#xf00d;
          </i>
        </div>
        <div className="modal-content">
          <h2>Detail Information</h2>
          <div className="text-start mt-3">
            <p>
              Liquidity: {`${selectedData["amount0Desired"]}/`}
              {`${selectedData["amount1Desired"]}`}
            </p>

            <div className="d-flex align-items-center gap-3 mb-3">
              <p className="m-0">Status:</p>
              <Status row={selectedData} />
            </div>

            <div className="d-flex align-items-center gap-3 mb-3">
              <p className="m-0">Tx Hash:</p>
              <a
                href={`https://bscscan.com/tx/${selectedData["txHash"]}`}
                target="_blank"
              >
                {selectedData["txHash"]}
              </a>
            </div>

            <p>
              Earned Fee:{" "}
              {selectedData["feeEarned"]
                ? `${JSON.parse(selectedData["feeEarned"]).eth} /
                          ${JSON.parse(selectedData["feeEarned"]).usdc}`
                : "0/0"}
            </p>

            <p>Earned Cake: {selectedData["cakeEarned"]}</p>

            <p>Created Price At: {selectedData["priceAt"]}</p>

            <p>Variance Rate: {selectedData["varianceRate"]}%</p>

            <div className="d-flex gap-5 align-items-center flex-wrap mb-3 justify-content-between">
              <div className="price-input">
                <label htmlFor="rebalanceRateDetail">Rebalance Rate: </label>
                <input
                  id="rebalanceRateDetail"
                  name="rebalanceRateDetail"
                  type="text"
                  min="1"
                  max="100"
                  value={rebalanceRateDetail}
                  onChange={(e) => {
                    const inputValue = e.target.value;
                    if (
                      !/^\d*$/.test(inputValue) ||
                      Number(inputValue) < 0 ||
                      Number(inputValue) > 101
                    ) {
                      return;
                    }
                    setRebalanceRateDetail(inputValue);
                  }}
                  style={{ width: "100px" }}
                />{" "}
                %
              </div>
              <button
                className="save-btn"
                onClick={() => handleUpdate("rebalance")}
              >
                {updateLoading === "rebalance" ? (
                  <ClipLoader color="#ffffff" size={20} />
                ) : (
                  "Save"
                )}
              </button>
            </div>

            <p>Created At: {changeDateFormate(selectedData["createdAt"])}</p>
            <div className="d-flex gap-5 align-items-center flex-wrap justify-content-between">
              <div>
                <div className="price-input mb-3">
                  <label htmlFor="minPrice">Min Price: </label>
                  <input
                    id="minPrice"
                    name="minPrice"
                    type="text"
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                  />
                </div>

                <div className="price-input">
                  <label htmlFor="maxPrice">Max Price: </label>
                  <input
                    id="maxPrice"
                    name="maxPrice"
                    type="text"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                  />
                </div>
              </div>

              <button
                className="save-btn"
                onClick={() => handleUpdate("price")}
              >
                {updateLoading === "price" ? (
                  <ClipLoader color="#ffffff" size={20} />
                ) : (
                  "Save"
                )}
              </button>
            </div>
            <div className="d-flex align-items-center gap-3 mt-4">
              <p className="m-0">Action:</p>
              <button
                className="action-btn remove dark"
                disabled={selectedData["status"] === 1}
                onClick={() => handleRemove(selectedData.id)}
              >
                {removeLoading === selectedData.id ? (
                  <ClipLoader color="#ffffff" size={20} />
                ) : (
                  "Remove"
                )}
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Main;
