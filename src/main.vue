<style scoped lang="scss">
  @import "./crop.css";
</style>
<script type="text/jsx">
  import AlloyFinger from 'alloyfinger'
  import Prefix from './prefix-umd'

  // 兼容性处理
  function whichTransitionEvent () {
    var t
    var el = document.createElement('div')
    var transitions = {
      'transition': 'transitionend',
      'OTransition': 'oTransitionEnd',
      'MozTransition': 'transitionend',
      'WebkitTransition': 'webkitTransitionEnd',
      'MsTransition': 'msTransitionEnd'
    }
    for (t in transitions) {
      if (el.style[t] !== undefined) {
        return transitions[t]
      }
    }
  }

  var pf = Prefix()
  var transitionEndEvent = whichTransitionEvent()
  var transformProperty = pf.prefix('transform')
  var transitionProperty = pf.prefix('transition')
  export default {
    props: {
      params: {
        type: Object,
        default () {
          return {}
        }
      }
    },
    name: 'simple-crop',
    data () {
      return {
        passiveSupported: false,
        title: this.params.title,
        size: this.params.size,
        maxScale: this.params.maxScale ? this.params.maxScale : 1,
        type: this.params.type || 'png',
        maxRotate: this.params.maxRotate || 90,
        src: this.params.src,
        privateMultiPoint: false, // 是否开始多点触控
        privateRotateScale: 1,// 旋转缩放
        privateBaseMoveX: 0, // 刻度位置初始化偏移量
        privateDownPoint: [],// 操作点坐标
        privateIsControl: false, // 是否正在操作
        privateBaseAngle: 0, /**
         * 旋转交互分为两种：
         * 一种是整角旋转（90度）；
         * 另一种是基于整角旋转的基础上正负45度旋转。
         */
        cropSizePercent: this.params.cropSizePercent || 0.5,// 默认0.5则表示高度或者宽度最多占50%
        zIndex: this.params.zIndex || 9999,
        debug: this.params.debug || false,
        noBoldCorner: this.params.noBoldCorner || false,// 裁剪框边角是否不加粗
        coverColor: this.params.coverColor || 'rgba(0,0,0,.5)',// 遮罩框背景颜色
        scaleSlider: this.params.scaleSlider !== undefined ? this.params.scaleSlider : true,
        positionOffset: this.params.positionOffset || { top: 0, left: 0 },
        /**
         * 旋转刻度盘
         * startAngle 起始度数
         * endAngle 结束度数
         * gapAngle 间隔度数
         * lineationItemWidth 单个刻度盘宽度，单位像素
         */
        rotateSlider: this.params.rotateSlider || false,
        startAngle: this.params.startAngle || -90,
        endAngle: this.params.endAngle || 90,
        gapAngle: 10,
        lineationItemWidth: 40.5,
        /**
         * 操控方式
         * 默认只支持鼠标操控
         * mouse 鼠标
         * touch 手指
         */
        controller: this.params.controller || ['mouse'],
        /**
         * 默认功能按钮为重新上传、裁剪
         * crop 裁减
         * close 取消
         */
        funcBtns: this.params.funcBtns || ['close', 'crop'],
        borderWidth: this.params.borderWidth || 1,
        borderColor: this.params.borderColor || '#fff',
        hide: false,
        scaleTimes: 1, // 缩放倍数
        rotateAngle: 0, // 旋转角度
        lineationWidth: 1
      }
    },
    created () {
      this.init()
      this.coverDraw = this.params.coverDraw || this.defaultCoverDraw
      this.borderDraw = this.params.borderDraw || this.defaultBorderDraw
      this.cropCallback = this.params.cropCallback
      this.closeCallback = this.params.closeCallback
    },
    mounted () {
      this.$nextTick(() => {
        this.$cropMask = this.$refs.cropMask
        var maskStyle = window.getComputedStyle(this.$cropMask)
        this.maskViewSize = {
          width: parseInt(maskStyle.getPropertyValue('width')),
          height: parseInt(maskStyle.getPropertyValue('height'))
        }
        this.times = (this.size.width / this.maskViewSize.width > this.size.height / this.maskViewSize.height) ? this.size.width / this.maskViewSize.width / this.cropSizePercent : this.size.height / this.maskViewSize.height / this.cropSizePercent

        this.$cropCover = this.$refs.cropCover
        this.cropCoverContext = this.$cropCover.getContext('2d')
        this.$cropCover.width = this.maskViewSize.width * window.devicePixelRatio
        this.$cropCover.height = this.maskViewSize.height * window.devicePixelRatio
        this.$cropContent = this.$refs.cropContent
        // 裁剪框位置相关
        this.cropRect = {
          width: this.size.width / this.times,
          height: this.size.height / this.times
        }
        this.cropRect.left = (this.maskViewSize.width - this.cropRect.width) / 2 - this.positionOffset.left
        this.cropRect.top = (this.maskViewSize.height - this.cropRect.height) / 2 - this.positionOffset.top
        this.cropPoints = this.rectToPoints(this.cropRect)
        this.borderDraw()
        this.coverDraw()
        this.bindEvent()
        this.load()
      })
    },
    methods: {
      init () {
        // 初始化 canvas transform
        this.initCanvasTransform()
        // 判断是否支持passive
        try {
          var options = Object.defineProperty({}, 'passive', {
            get: () => {
              this.passiveSupported = true
            }
          })
          window.addEventListener('test', null, options)
        } catch (err) {}
      },
      // 让canvas transform类似css3 transform
      initCanvasTransform () {
        CanvasRenderingContext2D.prototype._setTransformOrigin = function (x, y) {
          this._transformOrigin = { x: x, y: y }
        }
        CanvasRenderingContext2D.prototype._scale = function (x, y) {
          if (this._transformOrigin == null) {
            this._transformOrigin = { x: 0, y: 0 }
          }
          this.translate(this._transformOrigin.x, this._transformOrigin.y)
          this.scale(x, y)
          this.translate(-this._transformOrigin.x, -this._transformOrigin.y)
        }
        CanvasRenderingContext2D.prototype._rotate = function (deg) {
          if (this._transformOrigin == null) {
            this._transformOrigin = { x: 0, y: 0 }
          }
          this.translate(this._transformOrigin.x, this._transformOrigin.y)
          this.rotate(deg / 180 * Math.PI)
          this.translate(-this._transformOrigin.x, -this._transformOrigin.y)
        }
        CanvasRenderingContext2D.prototype._skew = function (xDeg, yDeg) {
          if (this._transformOrigin == null) {
            this._transformOrigin = { x: 0, y: 0 }
          }
          this.translate(this._transformOrigin.x, this._transformOrigin.y)
          this.transform(1, xDeg / 180 * Math.PI, yDeg / 180 * Math.PI, 1, 0, 0)
          this.translate(-this._transformOrigin.x, -this._transformOrigin.y)
        }
        CanvasRenderingContext2D.prototype._transform = function (a, b, c, d, e, f) {
          if (this._transformOrigin == null) {
            this._transformOrigin = { x: 0, y: 0 }
          }
          this.translate(this._transformOrigin.x, this._transformOrigin.y)
          this.transform(a, b, c, d, e, f)
          this.translate(-this._transformOrigin.x, -this._transformOrigin.y)
        }
      },
      defaultCoverDraw () {},
      defaultBorderDraw () {
        this.cropCoverContext.clearRect(0, 0, this.$cropCover.width, this.$cropCover.height)
        this.cropCoverContext.fillStyle = this.coverColor
        this.cropCoverContext.fillRect(0, 0, this.$cropCover.width, this.$cropCover.height)
        this.cropCoverContext.fillStyle = this.borderColor

        // 绘制边框（边框内嵌）
        var borderRect = {
          left: this.cropRect.left * window.devicePixelRatio,
          top: this.cropRect.top * window.devicePixelRatio,
          width: this.cropRect.width * window.devicePixelRatio,
          height: this.cropRect.height * window.devicePixelRatio
        }
        this.cropCoverContext.fillRect(borderRect.left, borderRect.top, borderRect.width, borderRect.height)

        if (!this.noBoldCorner) {
          // 边框四个角加粗
          var percent = 0.05
          var cornerRectWidth = borderRect.width * percent
          var cornerRectHeight = borderRect.height * percent
          this.cropCoverContext.fillRect(borderRect.left - this.borderWidth, borderRect.top - this.borderWidth, cornerRectWidth, cornerRectHeight)// 左上角
          this.cropCoverContext.fillRect(borderRect.left + borderRect.width - cornerRectWidth + this.borderWidth, borderRect.top - this.borderWidth, cornerRectWidth, cornerRectHeight)// 右上角
          this.cropCoverContext.fillRect(borderRect.left - this.borderWidth, borderRect.top + borderRect.height - cornerRectHeight + this.borderWidth, cornerRectWidth, cornerRectHeight)// 左下角
          this.cropCoverContext.fillRect(borderRect.left + borderRect.width - cornerRectWidth + this.borderWidth, borderRect.top + borderRect.height - cornerRectHeight + this.borderWidth, cornerRectWidth, cornerRectHeight)// 右下角
        }
        // 清空内容区域
        this.cropCoverContext.clearRect(borderRect.left + this.borderWidth, borderRect.top + this.borderWidth, borderRect.width - 2 * this.borderWidth, borderRect.height - 2 * this.borderWidth)
      },
      bindEvent () {
        // 滑动缩放
        if (this.scaleSlider) {
          this.$scaleBtn = this.$refs.scaleBtn
          this.$scaleNum = this.$refs.scaleNum
          this.$scaleOneTimes = this.$refs.scaleOneTimes
          this.$scaleTwoTimes = this.$refs.scaleTwoTimes
          this.$scaleContainer = this.$refs.scaleContainer
          this.$scaleValue = this.$refs.scaleValue

          this.scaleDownX = 0
          this.scaleInitLeft = this.$scaleBtn.getBoundingClientRect().left
          this.scaleCurLeft = this.scaleInitLeft
          this.scaleWidth = this.$scaleNum.getBoundingClientRect().width
        }

        if (this.rotateSlider) {
          this.$nextTick(() => {
            this.$cropRotate = this.$refs.cropRotate
            this.$lineation = this.$refs.lineation
            this.$rotateCurrent = this.$refs.current

            // 初始化刻度位置
            var lineationStyle = window.getComputedStyle(this.$lineation)
            this.lineationWidth = parseFloat(lineationStyle.getPropertyValue('width'))
            var rotateStyle = window.getComputedStyle(this.$cropRotate)
            var rotateWidth = parseFloat(rotateStyle.getPropertyValue('width'))
            this.privateBaseMoveX = -(this.lineationWidth / 2 - rotateWidth / 2)
            this.$lineation.setAttribute('moveX', this.privateBaseMoveX)
            this.$lineation.style[transformProperty] = 'translateX(' + this.privateBaseMoveX + 'px)'
          })
        }

        // 画布相关事件

        /**
         * 触摸事件
         */
        if (this.controller.indexOf('touch') > -1) {
          // 裁剪区域触摸开始
          this.$el.addEventListener('touchstart', (e) => {
            var touch = e.touches[0]
            this.startControl([touch.clientX, touch.clientY])
          })
          var options = this.passiveSupported ? { passive: false, capture: false } : false
          // 裁剪区域触摸移动
          this.$el.addEventListener('touchmove', (e) => {
            var touch = e.touches[0]
            this.move([touch.clientX, touch.clientY])
            e.preventDefault()
          }, options)
          // 裁剪区域触摸结束
          this.$el.addEventListener('touchend', () => {
            this.endControl()
          })
          // 裁剪区域触摸取消
          this.$el.addEventListener('touchcancel', () => {
            this.endControl()
          })

          // 复杂手势事件
          var lastScale = 1
          new AlloyFinger(this.$el, {
            multipointStart: () => {
              this.privateMultiPoint = true// 多点触摸开始
            },
            pinch: (evt) => { // 缩放
              if (this.privateMultiPoint) {
                var scale = evt.zoom
                this.scaleTimes = this.scaleTimes / lastScale * scale
                lastScale = scale
                this.transform(false, true)
              }
            },
            multipointEnd: () => {
              this.privateMultiPoint = false// 多点触摸结束
              lastScale = 1
            }
          })
        }

        /**
         * 鼠标事件
         */
        if (this.controller.indexOf('mouse') > -1) {
          // 裁剪区域鼠标按下
          this.$cropMask.addEventListener('mousedown', (ev) => {
            this.startControl([ev.clientX, ev.clientY])
          })
          // 裁剪区域鼠标移动
          this.$cropMask.addEventListener('mousemove', (ev) => {
            this.move([ev.clientX, ev.clientY])
          })
          // 裁剪区域鼠标松开
          this.$cropMask.addEventListener('mouseup', () => {
            this.endControl()
          })
          // 裁剪区域超出范围
          this.$cropMask.addEventListener('mouseleave', () => {
            this.endControl()
          })
        }
      },
      startControl (point) {
        if (!this.privateIsControl) {
          this.privateIsControl = true
          this.$cropContent.style[transitionProperty] = 'none'
          this.privateDownPoint = point || []
        }
      },
      endControl () {
        if (this.privateIsControl) {
          this.privateIsControl = false
          this.privateDownPoint = []
          this.scaleDownX = 0

          if (!this.isWholeCover(this.contentPoints, this.cropPoints)) { // 如果没有完全包含则需要进行适配变换
            var scaleNum = this.scaleTimes / this.times * this.privateRotateScale
            var transform = ''
            transform += ' scale(' + scaleNum + ')'// 缩放
            transform += ' translateX(' + this._contentCurMoveX / scaleNum + 'px) translateY(' + this._contentCurMoveY / scaleNum + 'px)'// 移动
            transform += ' rotate(' + this.rotateAngle + 'deg) '

            // 适配变换
            var coverTr = this.getCoverTransform(transform)
            var coverMat = this.cssMatrixAnalyze(this.getTransformMatrix(coverTr))
            this._contentCurMoveX = coverMat[4]
            this._contentCurMoveY = coverMat[5]
            this.contentPoints = this.getTransformPoints('scaleY(-1)' + coverTr, this.initContentPoints)

            if (!this.debug) {
              this.$cropContent.style[transformProperty] = this._initTransform + coverTr
            } else {
              this.$cropContent.style[transitionProperty] = 'transform .5s linear'
              var start = coverTr.indexOf(transform) + transform.length
              var coverTrAr = coverTr.substring(start, coverTr.length).trim().split(' ')
              var no = 0
              var tr = this._initTransform + transform + coverTrAr[no]
              this.$cropContent.style[transformProperty] = tr
              this.$cropContent.addEventListener(transitionEndEvent, () => {
                no++
                if (no < coverTr.length) {
                  tr += coverTrAr[no]
                  this.$cropContent.style[transformProperty] = tr
                }
              })
            }
          }
        }
      },
      scaleMove (curMoveX) {
        this.startControl()
        this.$scaleBtn.style[transformProperty] = 'translateX(' + curMoveX + 'px)'
        this.$scaleValue.style.width = curMoveX + 'px'
        this.$scaleBtn.setAttribute('moveX', curMoveX)
        this.scaleCurLeft = this.scaleInitLeft + curMoveX
        this.scaleTimes = this.initScale + curMoveX * 1.0 / this.scaleWidth * (this.maxScale - this.initScale)
        this.transform(false, true)
      },
      load (src) {
        this.src = (src || this.src)
        var self = this
        this.$cropContent.onload = () => {
          // 初始位置垂直水平居中
          self._initTransform = 'translate3d(-50%,-50%,0)'
          self.$cropContent.style.position = 'absolute'
          self.$cropContent.style.left = '50%'
          self.$cropContent.style.top = '50%'
          self.$cropContent.style[transformProperty] = self._initTransform

          var width = self.$cropContent.width / 2
          var height = self.$cropContent.height / 2
          self.initContentPoints = [{
            x: -width,
            y: height
          }, {
            x: width,
            y: height
          }, {
            x: width,
            y: -height
          }, {
            x: -width,
            y: -height
          }]
          self.contentPoints = self.initContentPoints.slice()

          // 计算初始缩放倍数
          if (self.size.width / self.size.height > self.$cropContent.width / self.$cropContent.height) {
            self.initScale = self.size.width / self.$cropContent.width
          } else {
            self.initScale = self.size.height / self.$cropContent.height
          }
          self.maxScale = self.initScale < self.maxScale ? self.maxScale : self.initScale

          self.scaleTimes = self.initScale
          self._contentCurMoveX = -self.positionOffset.left
          self._contentCurMoveY = -self.positionOffset.top

          self.transform()
        }
        this.$cropContent.src = this.src
      },
      show (src) {
        if (src) {
          this.load(src)
        }
        this.hide = false
      },
      move (point) {
        if (this.privateDownPoint.length != 0 && !this.privateMultiPoint) {
          var moveX = point[0] - this.privateDownPoint[0]
          var moveY = point[1] - this.privateDownPoint[1]

          this._contentCurMoveX += moveX
          this._contentCurMoveY += moveY
          this.privateDownPoint = point

          this.transform()
        }
      },
      // 旋转、缩放、移动
      transform (rotateCover, scaleKeepCover) {
        var scaleNum = this.scaleTimes / this.times * this.privateRotateScale
        var transform = ''
        transform += ' scale(' + scaleNum + ')'// 缩放
        transform += ' translateX(' + this._contentCurMoveX / scaleNum + 'px) translateY(' + this._contentCurMoveY / scaleNum + 'px)'// 移动
        transform += ' rotate(' + this.rotateAngle + 'deg)'

        if (scaleKeepCover) { // 缩放时为了保证裁剪框不出现空白，需要在原有变换的基础上再进行一定的位移变换
          transform = this.getCoverTransform(transform, true)
          var scMat = this.cssMatrixAnalyze(this.getTransformMatrix(transform))
          this._contentCurMoveX = scMat[4]
          this._contentCurMoveY = scMat[5]
        }

        if (rotateCover) { // 旋转时需要保证裁剪框不出现空白，需要在原有变换的基础上再进行一定的适配变换
          var rotatePoints = this.getTransformPoints('scaleY(-1)' + transform, this.initContentPoints)
          var coverScale = this.getCoverRectScale(rotatePoints, this.cropPoints)
          this.privateRotateScale = this.privateRotateScale * coverScale
          scaleNum = scaleNum * coverScale
        }

        // 操作变换
        transform = ''
        transform += ' scale(' + scaleNum + ')'// 缩放
        transform += ' translateX(' + this._contentCurMoveX / scaleNum + 'px) translateY(' + this._contentCurMoveY / scaleNum + 'px)'// 移动
        transform += ' rotate(' + this.rotateAngle + 'deg)'
        this.$cropContent.style[transformProperty] = this._initTransform + transform
        this.contentPoints = this.getTransformPoints('scaleY(-1)' + transform, this.initContentPoints)
      },
      // 计算一个矩形刚好包含另一个矩形需要的缩放倍数
      getCoverRectScale (outer, inner) {
        var scale = 1
        var outPoints = []
        // 找出inner中超出outer的点坐标
        for (var i = 0; i < inner.length; i++) {
          var point = inner[i]
          if (!this.isPointInRectCheckByLen(point, outer)) {
            outPoints.push(point)
          }
        }

        if (outPoints.length > 0) {
          for (var i = 0; i < outPoints.length; i++) {
            var num = this.getCoverPointScale(outPoints[i], outer)
            if (num > scale) {
              scale = num
            }
          }
        }

        return scale
      },
      // 判断 矩形A 是否完全包含 矩形B
      isWholeCover (rectA, rectB) {
        for (var i = 0; i < rectB.length; i++) {
          if (!this.isPointInRectCheckByLen(rectB[i], rectA)) {
            return false
          }
        }
        return true
      },
      // 计算一个矩形刚好包含矩形外一点需要的缩放倍数
      getCoverPointScale (point, rectPoints) {
        var pcv = this.getPCVectorProjOnUpAndRight(point, rectPoints)

        // 计算矩形外一点到矩形中心向量在矩形边框向量上的投影距离
        var uLen = this.vecLen(pcv.uproj)
        var height = this.vecLen(pcv.up) / 2
        var rLen = this.vecLen(pcv.rproj)
        var width = this.vecLen(pcv.right) / 2

        // 根据投影距离计算缩放倍数
        var scale1 = 1
        if (uLen > height) {
          scale1 = scale1 + (uLen - height) / height// 只要是正常矩形那么 height 和 width 不可能为0
        }
        var scale2 = 1
        if (rLen > width) {
          scale2 = scale2 + (rLen - width) / width
        }
        var scale = scale2 > scale1 ? scale2 : scale1

        return scale
      },
      // 计算图片内容刚好包含裁剪框的transform变换
      getCoverTransform (transform, onlyTranslate) {
        var cRect = this.getCoveRect(this.cropPoints, this.rotateAngle)
        onlyTranslate = onlyTranslate || false

        // 计算放大倍数
        var uScale = 1// 水平缩放倍数和垂直缩放倍数
        var rScale = 1
        var cup = {
          x: this.contentPoints[1].x - this.contentPoints[2].x,
          y: this.contentPoints[1].y - this.contentPoints[2].y
        }
        var cright = {
          x: this.contentPoints[1].x - this.contentPoints[0].x,
          y: this.contentPoints[1].y - this.contentPoints[0].y
        }
        var tup = {
          x: cRect[1].x - cRect[2].x,
          y: cRect[1].y - cRect[2].y
        }
        var tright = {
          x: cRect[1].x - cRect[0].x,
          y: cRect[1].y - cRect[0].y
        }
        var uAng = this.vecAngle(cup, tup)
        if (Math.abs(180 - uAng) < Math.abs(90 - uAng) || Math.abs(0 - uAng) < Math.abs(90 - uAng)) { // 更接近180或者0
          uScale = this.vecLen(tup) / this.vecLen(cup)
          rScale = this.vecLen(tright) / this.vecLen(cright)
        } else {
          uScale = this.vecLen(tup) / this.vecLen(cright)
          rScale = this.vecLen(tright) / this.vecLen(cup)
        }
        uScale = uScale < 1 ? 1 : uScale
        rScale = rScale < 1 ? 1 : rScale

        var scale = uScale > rScale ? uScale : rScale

        if (onlyTranslate && scale > 1) {
          return transform
        }

        // 复制坐标
        var scalePoints = []
        for (var i = 0; i < this.contentPoints.length; i++) {
          scalePoints.push({
            x: this.contentPoints[i].x,
            y: this.contentPoints[i].y
          })
        }

        // 计算放大后的新坐标
        if (scale > 1) {
          transform += 'scale(' + scale + ')'
          this.privateRotateScale = this.privateRotateScale * scale
          scalePoints = this.getTransformPoints('scaleY(-1)' + transform, this.initContentPoints)
        }

        // 位移变换
        var scaleNum = this.scaleTimes / this.times * this.privateRotateScale
        var count = 0
        var self = this
        var outDetails = []
        do {
          // 找出裁剪框超出的顶点
          outDetails = this.getOutDetails(this.cropPoints, scalePoints)
          if (outDetails.length > 0) {
            count++
            outDetails.sort(function (a, b) { // 找出距离最远的点
              var aLen = self.vecLen(a.iv)
              var bLen = self.vecLen(b.iv)
              if (aLen < bLen) {
                return 1
              }
              if (aLen > bLen) {
                return -1
              }
              return 0
            })

            // 开始移动
            var maxFarOut = outDetails[0]
            var maxFarPcv = maxFarOut.pcv

            // 计算X轴位移
            var uAng = this.vecAngle(maxFarPcv.up, maxFarPcv.uproj)
            var uLen = this.vecLen(maxFarPcv.uproj)
            var moveY = 0

            // if(uAng == 0){ //同方向
            if (Math.abs(uAng) < 90) { // 浮点数精度问题，接近0时小于90 ，接近180时大于90
              moveY = -uLen * maxFarOut.uOver
            } else {
              moveY = uLen * maxFarOut.uOver
            }
            if (moveY !== 0) {
              transform += ' translateY(' + moveY / scaleNum + 'px)'
            }

            // 计算Y轴位移
            var rAng = this.vecAngle(maxFarPcv.right, maxFarPcv.rproj)
            var rLen = this.vecLen(maxFarPcv.rproj)
            var moveX = 0

            if (Math.abs(rAng) < 90) { // 同方向
              moveX = rLen * maxFarOut.rOver
            } else {
              moveX = -rLen * maxFarOut.rOver
            }
            if (moveX !== 0) {
              transform += ' translateX(' + moveX / scaleNum + 'px)'
            }

            // 计算位移后的新坐标
            if (moveX !== 0 || moveY !== 0) {
              for (var i = 0; i < scalePoints.length; i++) {
                scalePoints[i].x = scalePoints[i].x + maxFarOut.iv.x
                scalePoints[i].y = scalePoints[i].y + maxFarOut.iv.y
              }
            }
          }
        } while (count < 2 && outDetails.length > 0)

        return transform
      },
      // 找出一个矩形在另一个矩形外的顶点数据
      getOutDetails (inner, outer) {
        var outDetails = []
        for (var i = 0; i < inner.length; i++) {
          var pt = inner[i]
          if (!this.isPointInRectCheckByLen(pt, outer)) {
            var pcv = this.getPCVectorProjOnUpAndRight(pt, outer)
            var iv = { x: 0, y: 0 }
            var uLen = this.vecLen(pcv.uproj)
            var height = this.vecLen(pcv.up) / 2
            var rLen = this.vecLen(pcv.rproj)
            var width = this.vecLen(pcv.right) / 2
            var uOver = 0
            var rOver = 0
            if (uLen > height) {
              uOver = (uLen - height) / uLen
              iv.x += pcv.uproj.x * uOver
              iv.y += pcv.uproj.y * uOver
            }
            if (rLen > width) {
              rOver = (rLen - width) / rLen
              iv.x += pcv.rproj.x * rOver
              iv.y += pcv.rproj.y * rOver
            }
            var ivLen = this.vecLen(iv)
            outDetails.push({
              x: pt.x,
              y: pt.y,
              iv: iv,
              uOver: uOver,
              rOver: rOver,
              pcv: pcv
            })
          }
        }
        return outDetails
      },
      // 获取刚好包含某个矩形的新矩形
      getCoveRect (rect, angle) {
        if (angle < 0) {
          angle = 90 + angle % 90
        } else {
          angle = angle % 90
        }
        var rad = angle / 180 * Math.PI

        var up = {
          x: rect[1].x - rect[2].x,
          y: rect[1].y - rect[2].y
        }
        var right = {
          x: rect[1].x - rect[0].x,
          y: rect[1].y - rect[0].y
        }
        var rLen = this.vecLen(right)
        var uLen = this.vecLen(up)

        var nRect = []
        nRect[0] = {}
        nRect[0].x = rect[0].x + rLen * Math.sin(rad) * Math.sin(rad)
        nRect[0].y = rect[0].y + rLen * Math.sin(rad) * Math.cos(rad)

        nRect[1] = {}
        nRect[1].x = rect[1].x + uLen * Math.sin(rad) * Math.cos(rad)
        nRect[1].y = rect[1].y - uLen * Math.sin(rad) * Math.sin(rad)

        nRect[2] = {}
        nRect[2].x = rect[2].x - rLen * Math.sin(rad) * Math.sin(rad)
        nRect[2].y = rect[2].y - rLen * Math.sin(rad) * Math.cos(rad)

        nRect[3] = {}
        nRect[3].x = rect[3].x - uLen * Math.sin(rad) * Math.cos(rad)
        nRect[3].y = rect[3].y + uLen * Math.sin(rad) * Math.sin(rad)

        return nRect
      },
      // 计算新的变换坐标
      getTransformPoints (transform, points) {
        var matrix = this.getTransformMatrix(transform)
        var nPoints = []
        for (var i = 0; i < points.length; i++) {
          var item = {
            x: points[i].x,
            y: points[i].y
          }
          item = this.getMatrixPoints(item, matrix)
          nPoints.push(item)
        }
        nPoints.reverse()// 顶点顺序发生了变化，需要颠倒

        return nPoints
      },
      // 获取裁剪图片
      getCropImage () {
        // 复制顶点坐标
        var points1 = []
        for (var i = 0; i < this.cropPoints.length; i++) {
          points1.push({
            x: this.cropPoints[i].x,
            y: this.cropPoints[i].y
          })
        }
        var points2 = []
        for (var i = 0; i < this.contentPoints.length; i++) {
          points2.push({
            x: this.contentPoints[i].x,
            y: this.contentPoints[i].y
          })
        }

        // 计算原点
        var origin = {
          x: points2[0].x,
          y: points2[0].y
        }
        for (var i = 0; i < points2.length; i++) {
          if (points2[i].x < origin.x) {
            origin.x = points2[i].x
          }
          if (points2[i].y > origin.y) {
            origin.y = points2[i].y
          }
        }

        // 转换坐标系
        var scaleNum = this.scaleTimes / this.times * this.privateRotateScale// 把坐标系乘以缩放倍数，转换为实际坐标系
        for (var i = 0; i < points2.length; i++) {
          points2[i].x = Math.abs(points2[i].x - origin.x) / scaleNum
          points2[i].y = Math.abs(points2[i].y - origin.y) / scaleNum
        }
        for (var i = 0; i < points1.length; i++) {
          points1[i].x = Math.abs(points1[i].x - origin.x) / scaleNum
          points1[i].y = Math.abs(points1[i].y - origin.y) / scaleNum
        }

        // 计算图片旋转之前的位置（可以根据宽高校验转换是否有异常）
        var center = this.getPointsCenter(points2)
        var borderTop = {
          x: points2[1].x - points2[0].x,
          y: points2[1].y - points2[0].y
        }
        var width = this.vecLen(borderTop)
        var borderRight = {
          x: points2[2].x - points2[1].x,
          y: points2[2].y - points2[1].y
        }
        var height = this.vecLen(borderRight)
        var imageInitRect = {
          left: center.x - width / 2,
          top: center.y - height / 2,
          width: width,
          height: height
        }

        // 绘制图片
        var imageRect = {
          left: 0,
          top: 0,
          width: 0,
          height: 0
        }
        for (var i = 0; i < points2.length; i++) {
          if (points2[i].x > imageRect.width) {
            imageRect.width = points2[i].x
          }
          if (points2[i].y > imageRect.height) {
            imageRect.height = points2[i].y
          }
        }
        var $imageCanvas = document.createElement('canvas')
        $imageCanvas.width = imageRect.width
        $imageCanvas.height = imageRect.height
        var imageCtx = $imageCanvas.getContext('2d')
        imageCtx._setTransformOrigin(center.x, center.y)// 中心点
        imageCtx._rotate(this.rotateAngle)
        imageCtx.drawImage(this.$cropContent, imageInitRect.left, imageInitRect.top, imageInitRect.width, imageInitRect.height)

        // 计算裁剪位置并截图
        var _cropRect = {
          left: points1[0].x,
          top: points1[0].y,
          width: points1[1].x - points1[0].x,
          height: points1[3].y - points1[0].y
        }
        var $cropCanvas = document.createElement('canvas')
        $cropCanvas.width = _cropRect.width
        $cropCanvas.height = _cropRect.height
        var cropCtx = $cropCanvas.getContext('2d')
        cropCtx.drawImage($imageCanvas, _cropRect.left, _cropRect.top, _cropRect.width, _cropRect.height, 0, 0, _cropRect.width, _cropRect.height)

        // 缩放成最终大小
        let resultCanvas = document.createElement('canvas')
        resultCanvas.width = this.size.width
        resultCanvas.height = this.size.height
        let resultCtx = resultCanvas.getContext('2d')
        resultCtx.drawImage($cropCanvas, 0, 0, this.size.width, this.size.height)
        return resultCtx.canvas.toDataURL('image/' + this.type)
      },
      // 获得矩形点坐标中心
      getPointsCenter (points) {
        var center = {
          x: (points[0].x + points[2].x) / 2,
          y: (points[0].y + points[2].y) / 2
        }
        return center
      },
      // 矩形位置形式转换为顶点坐标形式
      rectToPoints (rect) {
        var points = []
        points.push({
          x: -(this.maskViewSize.width / 2 - rect.left),
          y: this.maskViewSize.height / 2 - rect.top
        })
        points.push({
          x: points[0].x + rect.width,
          y: points[0].y
        })
        points.push({
          x: points[1].x,
          y: points[1].y - rect.height
        })
        points.push({
          x: points[0].x,
          y: points[2].y
        })

        return points
      },
      // 计算矩阵变换后的坐标点
      getMatrixPoints (p, matrix) {
        var mat = this.cssMatrixAnalyze(matrix)

        // var mat3 = [mat[0],mat[2],mat[4],
        //             mat[1],mat[3],mat[5],
        //             0,0,1];

        // var mat3 = [a,c,e,
        //             b,d,f,
        //             0,0,1];

        // var nx = a * x + c * y + 1 * e;
        // var ny = b * x + d * y + 1 * f;
        // var nz = 0 + 0 +1;

        // 计算变换后点坐标
        var nx = mat[0] * p.x + mat[2] * p.y + 1 * mat[4]
        var ny = mat[1] * p.x + mat[3] * p.y + 1 * mat[5]
        var nz = 0 + 0 + 1

        return { x: nx / nz, y: ny / nz }
      },
      // css矩阵解析
      cssMatrixAnalyze (mat) {
        var start = mat.indexOf('matrix(')
        var end = mat.indexOf(')')
        var arr = []
        var numbers = mat.substring(start + 7, end)
        arr = numbers.split(',')
        for (var i = 0; i < arr.length; i++) {
          arr[i] = parseFloat(arr[i])
        }
        return arr
      },
      // 获取transform属性对应的矩形形式
      getTransformMatrix (transform) {
        var $div = document.createElement('div')
        $div.style.visibility = 'hidden'
        $div.style.position = 'fixed'

        $div.style[transformProperty] = transform
        document.body.appendChild($div)

        var style = window.getComputedStyle($div)
        var matrix = style[transformProperty]
        document.body.removeChild($div)

        return matrix
      },
      // 计算向量 a 在向量 b 上的投影向量
      getProjectionVector (vecA, vecB) {
        var bLen = this.vecLen(vecB)
        var ab = vecA.x * vecB.x + vecA.y * vecB.y

        var proj = {
          x: ab / Math.pow(bLen, 2) * vecB.x,
          y: ab / Math.pow(bLen, 2) * vecB.y
        }

        return proj
      },
      // 计算矩形中心到某点的向量在矩形自身坐标系上方向和右方向上的投影向量
      getPCVectorProjOnUpAndRight (point, rectPoints) {
        // 计算矩形自身坐标系的上方向向量和右方向向量
        var up = {
          x: rectPoints[1].x - rectPoints[2].x,
          y: rectPoints[1].y - rectPoints[2].y
        }
        var right = {
          x: rectPoints[1].x - rectPoints[0].x,
          y: rectPoints[1].y - rectPoints[0].y
        }

        // 计算矩形中心点
        var center = this.getPointsCenter(rectPoints)
        var line = {
          x: point.x - center.x,
          y: point.y - center.y
        }

        var uproj = this.getProjectionVector(line, up)
        var rproj = this.getProjectionVector(line, right)

        return {
          up: up,
          uproj: uproj,
          right: right,
          rproj: rproj
        }
      },
      // 根据矩形中心到某一点向量在矩形边框向量的投影长度判断该点是否在矩形内
      isPointInRectCheckByLen (point, rectPoints) {
        var pcv = this.getPCVectorProjOnUpAndRight(point, rectPoints)

        var precision = 100// 保留两位小数

        var uLen = Math.round(this.vecLen(pcv.uproj) * precision)
        var height = Math.round(this.vecLen(pcv.up) / 2 * precision)
        var rLen = Math.round(this.vecLen(pcv.rproj) * precision)
        var width = Math.round(this.vecLen(pcv.right) / 2 * precision)

        return uLen <= height && rLen <= width
      },
      // 根据角度和判断点是否在矩形内
      isPointInRectCheckByAngle (point, rectPoints) {
        // 先计算四个向量
        var vecs = []
        for (var i = 0; i < rectPoints.length; i++) {
          var p = rectPoints[i]
          vecs.push({ x: (p.x - point.x), y: (p.y - point.y) })
        }

        // 计算模最小向量
        var sIndex = 0
        var sLen = 0
        for (var i = 0; i < vecs.length; i++) {
          var len = this.vecLen(vecs[i])
          if (len === 0 || len < sLen) {
            sIndex = i
            sLen = len
          }
        }
        var len = vecs.length
        var sVec = vecs.splice(sIndex, 1)[0]
        var tVec = sVec
        var eVec

        // 依次计算四个向量的夹角
        var angles = []
        for (i = 1; i < len; i++) {
          var data = this.getMinAngle(tVec, vecs)
          tVec = data.vec
          vecs.splice(data.index, 1)
          angles.push(data.angle)

          if (vecs.length === 1) {
            eVec = vecs[0]
          }
        }
        angles.push(this.getMinAngle(eVec, [sVec]).angle)

        var sum = 0
        for (var i = 0; i < angles.length; i++) {
          sum += angles[i]
        }

        // 向量之间的夹角等于360度则表示点在矩形内
        sum = sum.toPrecision(12)// 取12位精度能在大部分情况下解决浮点数误差导致的精度问题
        return sum >= 360;
      },
      // 计算向量数组的中向量和目标向量的最小夹角
      getMinAngle (tVec, aVec) {
        var minAngle = this.vecAngle(tVec, aVec[0])
        var minIndex = 0
        for (var i = 1; i < aVec.length; i++) {
          var angle = this.vecAngle(tVec, aVec[i])
          if (angle < minAngle) {
            minAngle = angle
            minIndex = i
          }
        }
        return { angle: minAngle, vec: aVec[minIndex], index: minIndex }
      },
      // 计算向量夹角
      vecAngle (vec1, vec2) {
        var acos = (vec1.x * vec2.x + vec1.y * vec2.y) / (this.vecLen(vec1) * this.vecLen(vec2))
        if (Math.abs(acos) > 1) { // 因为浮点数精度结果有可能超过1，Math.acos(1.0000001) = NaN
          acos = acos > 0 ? 1 : -1
        }
        var rad = Math.acos(acos)
        var angle = rad * 180 / Math.PI
        return angle
      },
      // 计算向量的模
      vecLen (vec) {
        var len = Math.sqrt(vec.x * vec.x + vec.y * vec.y)
        return len
      },
      renderScaleSlider () {
        return this.scaleSlider ? <div class="crop-scale">
          <div class="one-times-icon" ref="scaleOneTimes" onClick={() => {
            // 最小缩放按钮点击
            this.scaleMove(0)
            this.endControl()
          }}></div>
          <div ref="scaleContainer" class="scale-container"
               onClick={(ev) => {
                 var rect = this.$scaleBtn.getBoundingClientRect()
                 if (this.scaleDownX <= 0) {
                   this.scaleDownX = rect.left + rect.width * 1.0 / 2
                 }
                 if (this.scaleDownX > 0) {
                   var pointX = ev.clientX
                   var moveX = pointX - this.scaleDownX
                   var newCurLeft = this.scaleCurLeft + moveX
                   if (newCurLeft >= this.scaleInitLeft && newCurLeft <= (this.scaleWidth + this.scaleInitLeft)) {
                     var lastMoveX = parseFloat(this.$scaleBtn.getAttribute('moveX'))
                     if (!lastMoveX) {
                       lastMoveX = 0
                     }
                     var curMoveX = lastMoveX + moveX
                     this.scaleMove(curMoveX)
                     this.scaleDownX = 0// 鼠标移动缩放只能由鼠标在缩放按钮上按下触发
                     this.endControl()
                   }
                 }
               }} onMousemove={(ev) => {
            var pointX = ev.clientX
            if (this.scaleDownX > 0) {
              var moveX = pointX - this.scaleDownX
              var newCurLeft = this.scaleCurLeft + moveX
              if (newCurLeft >= this.scaleInitLeft && newCurLeft <= (this.scaleWidth + this.scaleInitLeft)) {
                var lastMoveX = parseFloat(this.$scaleBtn.getAttribute('moveX'))
                if (!lastMoveX) {
                  lastMoveX = 0
                }
                var curMoveX = lastMoveX + moveX
                this.scaleDownX = pointX
                this.scaleMove(curMoveX)
              }
            }
          }} onMouseleave={() => {
            this.endControl()
          }} onMouseup={() => {
            this.endControl()
          }}>
            <div class="scale-num" ref="scaleNum">
              <span class="scale-value" style="width:0px;" ref="scaleValue"></span>
              <span class="scale-btn" ref="scaleBtn" style="left:-8px;" onMousedown={(ev) => {
                this.scaleDownX = ev.clientX
              }}
                    onClick={(ev) => {
                      ev.stopPropagation()
                    }}
              ></span>
            </div>
          </div>
          <div class="two-times-icon" ref="scaleTwoTimes" onClick={() => {
            // 最大缩放按钮点击
            this.scaleMove(this.scaleWidth)
            this.endControl()
          }}></div>
        </div> : null
      },
      renderRotateSlider () {
        var list = () => {
          let res = []
          for (let i = this.startAngle;
               i <= this.endAngle;
               i += this.gapAngle) {
            res.push(
              <li>
                <div class="number">{i}</div>
                <div class="bg"></div>
              </li>
            )
          }
          return res
        }
        return this.rotateSlider ? <div class="crop-rotate" ref="cropRotate" onTouchstart={(e) => {
          // 刻度触摸开始
          var touch = e.touches[0]
          this.startControl([touch.clientX, touch.clientY])
        }}
                                        onTouchmove={(e) => {
                                          // 刻度触摸移动
                                          var touch = e.touches[0]
                                          var point = [touch.clientX, touch.clientY]
                                          var moveX = point[0] - this.privateDownPoint[0]
                                          var lastMoveX = this.$lineation.getAttribute('moveX')
                                          if (!lastMoveX) {
                                            lastMoveX = 0
                                          } else {
                                            lastMoveX = parseFloat(lastMoveX)
                                          }
                                          var curMoveX = lastMoveX + moveX
                                          var angle = (curMoveX - this.privateBaseMoveX) / this.lineationWidth * (this.endAngle - this.startAngle + this.gapAngle)

                                          if (angle <= this.maxRotate && angle >= -this.maxRotate) {
                                            this.$lineation.setAttribute('moveX', curMoveX)
                                            this.$lineation.style[transformProperty] = 'translateX(' + curMoveX + 'px)'
                                            this.rotateAngle = this.privateBaseAngle + angle
                                            this.transform(true)
                                            this.privateDownPoint = point
                                          }
                                          e.stopPropagation()// 阻止事件冒泡
                                          e.preventDefault()
                                        }}
                                        onTouchend={() => {
                                          this.endControl()
                                        }}
                                        onTouchcancel={() => {
                                          this.endControl()
                                        }}

        >
          <ul class="lineation"
              ref="lineation"
              style={{ 'width': this.lineationItemWidth * ((this.endAngle - this.startAngle) / this.gapAngle + 1) + 'px' }}>
            {list()}
          </ul>
          <div class="current" ref="current"></div>
        </div> : null
      },
      renderFuncBtns () {
        let close = <button class="crop-close" onClick={() => {
          this.hide = true
          if (this.closeCallback) {
            this.closeCallback()
          }
        }}></button>
        let around = <button class="crop-around" onClick={() => {
          this.startControl()
          this.rotateAngle = this.privateBaseAngle - 90
          this.privateBaseAngle = this.rotateAngle
          this.$lineation.setAttribute('moveX', this.privateBaseMoveX)
          this.$lineation.style[transformProperty] = 'translateX(' + this.privateBaseMoveX + 'px)'
          this.transform()
          this.endControl()
        }}></button>
        let reset = <button class="crop-reset" onClick={() => {
          this.startControl()
          this.privateRotateScale = 1
          this.privateBaseAngle = 0
          this.rotateAngle = 0
          this._contentCurMoveX = -this.positionOffset.left
          this._contentCurMoveY = -this.positionOffset.top
          this.$lineation.setAttribute('moveX', this.privateBaseMoveX)
          this.$lineation.style[transformProperty] = 'translateX(' + this.privateBaseMoveX + 'px)'
          this.scaleTimes = this.initScale
          this.transform()
          this.endControl()
        }}></button>
        let crop = <button class="crop-btn" onClick={() => {
          this.hide = true
          this.cropCallback(this.getCropImage())
        }}></button>
        let btns = {
          close,
          around,
          reset,
          crop
        }
        return <div class="crop-btns">
          {this.funcBtns.map(key => btns[key])}
        </div>
      }
    },
    render () {
      let title = this.title ? <p class="crop-title">{this.title}</p> : null
      return <div class="crop-whole-cover"
                  style={{ 'zIndex': this.zIndex, 'display': this.hide ? 'none' : 'block' }}>
        <div class="crop-component">
          {title}
          <div class="crop-mask" ref="cropMask">
            <img class="crop-content" ref="cropContent"/>
            <canvas class="crop-cover" ref="cropCover"></canvas>
          </div>
          {this.renderScaleSlider()}
          {this.renderRotateSlider()}
          {this.renderFuncBtns()}
        </div>
      </div>
    },
  }
</script>
