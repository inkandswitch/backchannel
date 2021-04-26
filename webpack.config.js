let path = require('path')
let DIST = path.join(__dirname, 'dist')
let webpack = require('webpack')

module.exports = {
  mode: 'development',
  entry: './src/index.tsx',
  devServer: {
    contentBase: DIST,
    compress: true,
    port: 9000,
  },
  plugins: [
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
    })
  ],
  output: {
    path: DIST,
    filename: 'bundle.js',
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js', '.json'],
    fallback: {
      'crypto': require.resolve('crypto-browserify'),
      'stream': require.resolve('stream-browserify')
    }
  },
  module: {
    rules: [
      // all files with a '.ts' or '.tsx' extension will be handled by 'ts-loader'
      { test: /\.tsx?$/, use: ['ts-loader'], exclude: /node_modules/ },
    ],
  },
};
