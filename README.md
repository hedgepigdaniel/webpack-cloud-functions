# webpack-cloud-functions

Use webpack to build your cloud functions and get better DX, faster deploys, and faster functions!

## Features

### Developer experience

- Full access to webpack ecosystem of loaders, plugins, etc
- Built in support for hot module reloading (HMR): change your code and the local emulator will update immediately without restarting
- Faster deploys as a result of fewer dependencies in the released function
- Written in Typescript

### Production optimization

- Better start up time and memory usage as a result of webpack optimizations and bundling of dependencies. 2-100 JS files used at runtime instead of 50,000+.

## Getting started

These steps work for Firebase functions, but could probably be easily adapted for other runtimes.

### Install

Start a function project according to the documentation for your provider (Google Cloud Functions. Lambda, etc). If there is an option, it's easiest to choose plain javascript.

Note that you will need two `package.json`: one for the functions runtime (the one that is deployed), and another for your project (including dependencies that webpack will bundle). e.g.

```
package.json # This tracks your project's dependencies for webpack to build
functions/
  package.json # This will be deployed to the cloud function provider
```

Add `webpack-cloud-functions` as a dependency to **both** `package.json`s

### Create a function

Create some code (to be compiled by webpack) that contains handlers for functions:

```javascript
// src/index.js

import * as functions from "firebase-functions";

export default () => () => ({
  helloWorldHandler: (request, response) => {
    functions.logger.info("Hello logs!", { structuredData: true });
    response.send("Hello from Firebase!");
  },
});
```

### Redirect function calls from the entry point to the webpack bundle

Find the entry point for you functions runtime (the file that exports all the functions). For Firebase it is `functions/index.js` by default. This file still needs to export each function - but the functionality of the functions is delegated to the webpack build.

```javascript
// functions/index.js
const functions = require("firebase-functions");
const {
  makeStaticHandlers,
  makeHotHandlers,
  makeWebpackConfig,
} = require("webpack-cloud-functions");
const path = require("path");

// These are the handlers for each exported function compiled by webpack
let hotHandlers;

if (process.env.NODE_ENV === "production") {
  // Production case: serve from the prebuilt webpack bundle
  hotHandlers = makeStaticHandlers(require("./main.js").default());
} else {
  // Local development case: serve from a hot updating development build
  hotHandlers = makeHotHandlers(
    makeWebpackConfig({
      // Custom Webpack configuration
      mode: "development",
      context: path.resolve(__dirname, ".."),
      entry: "./src/index.js", // The entry point for your webpacked code
      target: "node12", // Depends on the functions runtime
      externals: {
        // Dependencies that need to be resolved at runtime (not by webpack)
        "firebase-functions": "commonjs2 firebase-functions",
      },
    })
  );
}

// An example https function. It wraps the `helloWorldHandler` exported from `src/index.js`
exports.helloWorld = functions.https.onRequest(
  hotHandlers.getHandler("helloWorldHandler")
);
```

It should now be possible to run the local functions emulator, and the functions should update seamlessly as you change the code.

### Add a script to build the production bundle

```javascript
// scripts/buildProd.js
const { buildHandler, makeWebpackConfig } = require("webpack-cloud-functions");

buildHandler(
  makeWebpackConfig({
    mode: "production",
    entry: "./src/index.js",
    target: "node12",
    externals: {
      "firebase-functions": "commonjs2 firebase-functions",
    },
    output: {
      // Configure webpack to output the bundle in the functions directory to be deployed
      path: path.resolve(__dirname, "../functions"),
    },
  })
).catch((error) => {
  console.error(error);
  process.exit(1);
});
```

Now if you run `node scripts/buildProd.js`, `functions/main.js` should exist, and it should be possible to deploy the cloud functions!

## Examples

See [examples/firebase](https://github.com/hedgepigdaniel/webpack-cloud-functions/tree/trunk/examples/firebase) for a working example using Firebase Functions.

## Compatibility

| AWS Lambda      | Google Cloud Functions | Firebase Functions | Azure Functions | Netlify Functions |
| --------------- | ---------------------- | ------------------ | --------------- | ----------------- |
| :grey_question: | :grey_question:        | :heavy_check_mark: | :grey_question: | :grey_question:   |

## Warranty

None

## Contributions

Are very welcome, feel free to open a Issue or PR!
