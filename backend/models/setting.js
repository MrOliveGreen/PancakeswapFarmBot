module.exports = (sequelize, Sequelize) => {
    const Setting = sequelize.define("setting", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      varianceRate: {
        type: Sequelize.DOUBLE
      },
      rebalanceRate: {
        type: Sequelize.DOUBLE
      },
      autoSwap: {
        type: Sequelize.INTEGER,
        comment: "1: auto swap the tokens that are unstaked from pool, 0: do not swap"
      },
      autoAddLiquidity: {
        type: Sequelize.INTEGER,
        comment: "1: auto re-add liquidity to the pool after swap, 0: do not add liquidity"
      }
    });
  
    return Setting;
  };