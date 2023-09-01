module.exports = (sequelize, Sequelize) => {
    const Swap = sequelize.define("swap", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      posId: {
        type: Sequelize.INTEGER,
      },
      rebalanceRate: {
        type: Sequelize.DOUBLE
      },
      swapFrom: {
        type: Sequelize.STRING,
        length: 10
      },
      swapTo: {
        type: Sequelize.STRING,
        length: 10
      },
      amount: {
        type: Sequelize.STRING
      },
      txHash: {
        type: Sequelize.STRING
      }
    });
  
    return Swap;
  };