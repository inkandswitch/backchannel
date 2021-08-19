const path = require('path')

module.exports = {
  entry: './src/bootstrap',
  module: {
    rules: [
      // all files with a '.ts' or '.tsx' extension will be handled by 'ts-loader'
      { test: /\.tsx?$/, use: ["ts-loader"], exclude: /node_modules/ },
      {
        test: /\.wasm$/,
        type: "webassembly/experimental"
      }
    ],
  },
  resolve: {
    extensions: ['.wasm','.ts', '.js', '.json']
  },
  mode: 'development',
  output: {
	library: 'default',
	libraryTarget: "umd",
    filename: 'bundle.js'
  },
  devtool: 'source-map',
  target: "web"
}
