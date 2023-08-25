const cors = require("cors");
const helmet = require("helmet");
const express = require("express");
const routes = require("./routes");
const app = express();

const db = require("./models");
db.sequelize.sync();

app.use(cors());
app.options("*", cors());

/* var corsOptions = {
  origin: 'https://www.domain.com',
  credentials: true,
  optionsSuccessStatus: 200
}  
app.use(cors(corsOptions)); */

app.use(express.static("public"));
app.use(helmet());
app.use(express.json());
app.use(routes);
// Handling Errors
app.use((err: any, req: any, res: any, next: any) => {
  err.statusCode = err.statusCode || 500;
  err.message = err.message || "Internal Server Error";
  res.status(err.statusCode).json({
    message: err.message,
  });
});

app.listen(3001, () => console.log("Server is running on port 3001"));

import Moralis from 'moralis';
Moralis.start({ apiKey: process.env.MORALIS_API_KEY });

const { doRunBot } = require('./controllers/botController');

// const startBot = async () => {
//   do {
//     await doRunBot();

//     // Give some delay before re-run the bot.
//     await new Promise((res) => { setTimeout(res, 10000); });
//   } while (true); 
// }

// startBot();