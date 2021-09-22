const path = require('path');

module.exports = {
  entry: './index.js',
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: 'bundle.js',
  },
  experiments: {
	  asyncWebAssembly: true
  },
  mode: "development",
  resolve: {
	  fallback: {
		  "fs": false,
		  "crypto": require.resolve('crypto-browserify'),
		  "stream": require.resolve('stream-browserify')
	  },
	  extensions: ['.wasm', '.ts', '.js'],
  },
};