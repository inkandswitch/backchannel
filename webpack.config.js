const path = require('path')

module.exports = {
  entry: './src/index.ts',
  module: {
    rules: [
      // all files with a '.ts' or '.tsx' extension will be handled by 'ts-loader'
      { test: /\.tsx?$/, use: ["ts-loader"], exclude: /node_modules/ },
    ],
  },
  resolve: {
    "fallback": {
		"fs": false,
      "crypto": require.resolve("crypto-browserify"),
      "path": require.resolve("path-browserify"),
      "stream": require.resolve("stream-browserify")
    },
    extensions: ['.ts', '.js', '.json']
  },
  experiments: {
	  asyncWebAssembly: true
  },
  mode: 'development',
  output: {
    filename: 'bundle.js',
	library: {
		name: 'Backchannel',
		type: 'commonjs'
	}
  },
  devtool: 'source-map',
  target: "browserslist:web"
}
