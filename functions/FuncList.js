const express = require("express");
const router = express.Router();

router.post("/FuncList", (req, res) => {
  const functions = [
    {
      Function: "addNumbers",
      Description: "Adds any number of arguments together and returns the sum.",
      Example: "addNumbers(1, 2, 3) => 6",
    },
    {
      Function: "subtractNumbers",
      Description: "Subtracts a sequence of numbers from the first argument.",
      Example: "subtractNumbers(10, 2, 3) => 5",
    },
    {
      Function: "multiplyNumbers",
      Description:
        "Multiplies any number of arguments and returns the product.",
      Example: "multiplyNumbers(2, 3, 4) => 24",
    },
    {
      Function: "divideNumbers",
      Description:
        "Divides a sequence of numbers sequentially from the first argument.",
      Example: "divideNumbers(20, 2, 2) => 5",
    },
  ];

  res.set("Content-Type", "application/json");
  res.status(200).json({ functions });
});

function addNumbers(...args) {
  return args.reduce((sum, num) => sum + num, 0);
}

function subtractNumbers(...args) {
  if (args.length === 0) {
    throw new Error("No numbers provided for subtraction");
  }
  return args.reduce((result, num) => result - num);
}

function multiplyNumbers(...args) {
  if (args.length === 0) {
    throw new Error("No numbers provided for multiplication");
  }
  return args.reduce((product, num) => product * num, 1);
}

function divideNumbers(...args) {
  if (args.length === 0) {
    throw new Error("No numbers provided for division");
  }
  if (args.includes(0)) {
    throw new Error("Division by zero is not allowed");
  }
  return args.reduce((result, num) => result / num);
}

module.exports = {
  addNumbers,
  subtractNumbers,
  multiplyNumbers,
  divideNumbers,
  router,
};
