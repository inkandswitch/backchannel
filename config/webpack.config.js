const path = require('path')

module.exports = {
  mode: 'production',
  entry: './src/index.ts',
  output: {
    path: path.resolve(__dirname, '../dist/umd'),
    filename: 'index.js',
    libraryTarget: 'umd',
    globalObject: 'this',
  },
  experiments: {
    asyncWebAssembly: true
  },
  module: {
    rules: [
      {
        test: /\.ts(x*)?$/,
        exclude: /node_modules/,
        use: {
          loader: 'ts-loader',
          options: {
            configFile: 'config/tsconfig.umd.json',
          },
        },
      },
	  {
		test: /\.wasm$/,
		loader: "base64-loader",
		type: "javascript/auto",
		}
    ],
	noParse: /\.wasm$/,
  },
  resolve: {
	  fallback: {
		  "fs": false,
		  "path": require.resolve('path-browserify'),
		  "crypto": require.resolve('crypto-browserify'),
		  "stream": require.resolve('stream-browserify'),
		  "buffer": require.resolve('buffer/')
	  },
	  extensions: ['.wasm', '.ts', '.js'],
  },
}

