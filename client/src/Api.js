import axios from "axios";

const api = axios.create({
  baseURL: process.env.REACT_APP_SERVER_URL,
  mode: "no-cors",
  headers: {
    "Content-Type": "application/json",
  },
});

export const getTokenPrice = async () => {
  try {
    const res = await api.post("/getTokenPrices");
    return res.data;
  } catch (error) {
    console.log("error;", error);
  }
};

export const getWalletStatus = async () => {
  try {
    const res = await api.post("/getWalletStatus");
    return res.data;
  } catch (error) {
    console.log("error;", error);
  }
};

export const getTiedAmount = async (inputed, amount) => {
  try {
    const res = await api.post("/getTiedAmount", { inputed, amount });
    return res.data;
  } catch (error) {
    console.log("error;", error);
  }
};

export const createPosition = async (amount) => {
  try {
    const res = await api.post("/createPosition", { amount });
    return res.data;
  } catch (error) {
    console.log("error;", error);
  }
};

export const getSetting = async () => {
  try {
    const res = await api.post("/getSetting");
    return res.data;
  } catch (error) {
    console.log("error;", error);
  }
};

export const saveSetting = async (
  varianceRate,
  rebalanceRate,
  autoSwap,
  autoAddLiquidity
) => {
  try {
    const res = await api.post("/saveSetting", {
      varianceRate,
      rebalanceRate,
      autoSwap,
      autoAddLiquidity,
    });
    return res.data;
  } catch (error) {
    console.log("error;", error);
  }
};

export const getPositions = async () => {
  try {
    const res = await api.post("/getPositions");
    return res.data;
  } catch (error) {
    console.log("error;", error);
  }
};

export const updatePosition = async (props) => {
  try {
    const res = await api.post("/updatePosition", props);
    return res.data;
  } catch (error) {
    console.log("error;", error);
  }
};

export const removePosition = async (posId) => {
  try {
    const res = await api.post("/removePosition", { posId });
    return res.data;
  } catch (error) {
    console.log("error;", error);
  }
};
