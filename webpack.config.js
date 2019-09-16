/**
 * Created by luoyang on 2018-12-26
 */
const { resolve } = require('path')
const _base = require('../../../build/_base.config')
const merge = require('webpack-merge')

webpackConfig = {
  entry: './src/index.js',
  output: {
    path: resolve(__dirname, './dist'),
    library: 'vue-simple-crop',
    libraryTarget: 'commonjs2',
    filename: 'index.js'
  },
  externals: {
    vue: {
      commonjs2: 'vue'
    }
  }
}
module.exports = () => {
  return merge(_base, webpackConfig)
}
