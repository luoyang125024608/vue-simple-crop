import vueSimpleCrop from './core'
import simpleCrop from './simple-crop'

vueSimpleCrop.install = Vue => {
  Vue.component(simpleCrop.name, simpleCrop)
}
export default vueSimpleCrop
