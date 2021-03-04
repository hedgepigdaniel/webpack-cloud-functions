const functions = require("firebase-functions");
const {
  makeStaticHandlers,
  makeHotHandlers,
  makeWebpackConfig,
} = require("webpack-cloud-functions");
const path = require("path");

let hotHandlers;
if (process.env.NODE_ENV === "production") {
  hotHandlers = makeStaticHandlers(require("./main.js").default());
} else {
  hotHandlers = makeHotHandlers(
    makeWebpackConfig({
      mode: "development",
      context: path.resolve(__dirname, ".."),
      ...require("../scripts/webpackOptions.js"),
    })
  );
}

exports.helloWorld = functions.https.onRequest(
  hotHandlers.getHandler("helloWorldHandler")
);
