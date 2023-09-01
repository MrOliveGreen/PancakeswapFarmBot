module.exports = (sequelize, Sequelize) => {
    const MyPosition = sequelize.define("position", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      nftId: {
        type: Sequelize.INTEGER
      },
      fee: {
        type: Sequelize.INTEGER
      },
      tickLower: {
        type: Sequelize.STRING
      },
      tickUpper: {
        type: Sequelize.STRING
      },
      amount0Desired: {
        type: Sequelize.STRING
      },
      amount1Desired: {
        type: Sequelize.STRING
      },
      amount0Min: {
        type: Sequelize.STRING
      },
      amount1Min: {
        type: Sequelize.STRING
      },
      recipient: {
        type: Sequelize.STRING
      },
      deadline: {
        type: Sequelize.INTEGER
      },
      txHash: {
        type: Sequelize.STRING
      },
      isStaked: {
        type: Sequelize.INTEGER
      },
      cakeEarned: {
        type: Sequelize.STRING
      },
      feeEarned: {
        type: Sequelize.STRING
      },
      status: {
        type: Sequelize.INTEGER
      },
      priceAt: {
        type: Sequelize.DOUBLE
      },
      priceLower: {
        type: Sequelize.DOUBLE
      },
      priceUpper: {
        type: Sequelize.DOUBLE
      },
      varianceRate: {
        type: Sequelize.DOUBLE
      },
      rebalanceRate: {
        type: Sequelize.DOUBLE
      },
      prevPos: {
        type: Sequelize.INTEGER
      },
      nextPos: {
        type: Sequelize.INTEGER
      },
      isProcessing: {
        type: Sequelize.INTEGER
      }
    });
  
    return MyPosition;
  };