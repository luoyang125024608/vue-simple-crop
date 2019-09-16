/**
 * Created by luoyang on 2019-09-09
 */
import Vue from 'vue'
import main from './main.vue'

var instance
var SimpleCropConstructor = Vue.extend(main)
var initInstance = function () {
  instance = new SimpleCropConstructor({
    el: document.createElement('div')
  })
  document.body.appendChild(instance.$el)
}

var vueSimpleCrop = function (options = {}) {
  if (!instance) {
    initInstance()
  }
  Object.assign(instance, options)
  return instance
}
export default vueSimpleCrop
