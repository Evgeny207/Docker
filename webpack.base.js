const webpack = require('webpack');
const postcssImportPlugin = require('postcss-import');
const postcssCssnextPlugin = require('postcss-cssnext');

module.exports = {
  module: {
    loaders: [
      {
        test: /\.((png)|(eot)|(woff)|(woff2)|(ttf)|(svg)|(gif))(\?v=\d+\.\d+\.\d+)?$/,
        loader: 'url-loader?limit=100000',
      },
      {
        test: /\.json$/,
        loader: 'json-loader',
      },
      {
        test: /\.scss$/,
        loader: 'style!css?modules!sass',
      },
      {
        test: /\.css$/,
        loader: 'style!css?modules&importLoaders=1&&localIdentName=cms__[name]__[local]!postcss',
      },
      {
        loader: 'babel',
        test: /\.js?$/,
        exclude: /(node_modules|bower_components)/,
        query: {
          cacheDirectory: true,
          presets: ['react', 'es2015'],
          plugins: [
            'transform-class-properties',
            'transform-object-assign',
            'transform-object-rest-spread',
            'lodash',
            'react-hot-loader/babel',
          ],
        },
      },
    ],
  },

  postcss: [
    postcssImportPlugin({ addDependencyTo: webpack }),
    postcssCssnextPlugin,
  ],
};
