const path = require('path')

module.exports = {
  entry: './src/index.ts',
  optimization: { concatenateModules: false, providedExports: false, usedExports: false },
  module: {
    rules: [
      // all files with a '.ts' or '.tsx' extension will be handled by 'ts-loader'
      { test: /\.tsx?$/, use: ["ts-loader"], exclude: /node_modules/ },
    ],
  },
  resolve: {
    "fallback": {
      "crypto": require.resolve("crypto-browserify"),
      "path": require.resolve("path-browserify"),
      "stream": require.resolve("stream-browserify")
    },
    extensions: ['.ts', '.js', '.json']
  },
  mode: 'development',
  output: {
    filename: 'bundle.js',
    libraryTarget: 'umd',
  },
  devtool: 'source-map',
  target: "browserslist:web"
}
