const { buildHandler, makeWebpackConfig } = require("webpack-cloud-functions");

buildHandler(
  makeWebpackConfig({
    mode: "production",
    ...require("../scripts/webpackOptions.js"),
  })
).catch((error) => {
  console.error(error);
  process.exit(1);
});
