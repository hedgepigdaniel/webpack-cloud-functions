const path = require("path");

module.exports = {
  entry: "./src/index.js",
  externals: {
    "firebase-functions": "commonjs2 firebase-functions",
  },
  output: {
    path: path.resolve(__dirname, "../functions"),
  },
};
