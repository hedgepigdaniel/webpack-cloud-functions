// functions/index.js
import { makeHotHandlers, makeWebpackConfig } from "webpack-cloud-functions";
import path from "path";

export const hotHandlers = makeHotHandlers(
  makeWebpackConfig({
    mode: "development",
    context: path.resolve(__dirname, ".."),
    entry: "./src/handlers.ts",
    target: "node12",
  })
);
