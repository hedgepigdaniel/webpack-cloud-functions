const { buildHandler, makeWebpackConfig } = require("hot-functions");

buildHandler({
  ...makeWebpackConfig({}),
  mode: "production",
  ...require("../scripts/webpackOptions.js"),
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
