module.exports = (api) => {
  api.cache(true);
  return {
    presets: ["@babel/preset-env"],
    overrides: [
      {
        test: /\.tsx?$/,
        presets: ["@babel/preset-typescript"],
      },
    ],
  };
};
