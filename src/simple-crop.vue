<template>
  <a href="javascript:" @click="$refs.fileInput.click()">
    <slot></slot>
    <input type="file" accept="image/*" style="display: none;"
           @change="fileChange" ref="fileInput"/>
  </a>
</template>

<script>
  import SimpleCrop from './core'

  export default {
    props: {
      cropOptions: {
        type: Object,
        default () {
          return {}
        }
      }
    },
    name: 'simple-crop',
    data () {
      return {
        crop: null
      }
    },
    methods: {
      dataURLtoBlob (dataURL = '') {
        let arr = dataURL.split(',')
        let mime = arr[0].match(/:(.*?);/)[1]
        let bstr = window.atob(arr[1])
        let n = bstr.length
        let u8arr = new Uint8Array(n)
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n)
        }
        return new window.Blob([u8arr], { type: mime })
      },
      fileToSrc (file, callback) {
        var reader = new FileReader()
        reader.onload = function (e) {
          callback(e.target.result)
        }
        reader.readAsDataURL(file)
      },
      cropImage (file) {
        this.fileToSrc(file, src => {
          if (!this.crop) {
            this.crop = new SimpleCrop(Object.assign({
              src,
              cropCallback: (base64) => {
                this.$emit('crop', this.dataURLtoBlob(base64))
              },
              closeCallback: () => {
                this.$refs.fileInput.value = ''
                this.$emit('close')
              }
            }, this.cropOptions))
          } else {
            this.crop.show(src)
          }
        })
      },
      fileChange (e) {
        let { files } = e.target
        this.cropImage(files[0])
      }
    },
    computed: {}
  }
</script>
