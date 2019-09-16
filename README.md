#vue-simple-crop

> 基于[Simple-Crop](https://github.com/newbieYoung/Simple-Crop)包装成vue的组件，感谢原项目作者。

<img src="https://raw.githubusercontent.com/newbieYoung/NewbieWebArticles/master/images/simple-crop-0.jpg">

> 左侧是IOS系统自带的图片裁剪功能，右侧为组件的示例一；

可以扫描二维码体验：

<img src="https://raw.githubusercontent.com/newbieYoung/NewbieWebArticles/master/images/simple-crop-1.png">

# 安装
```
npm install vue-simple-crop --save

```
# 引入
```
import simpleCrop from 'vue-simple-crop'
```
模块没打包成umd，需要的话自己拉代码去打包吧。都2020年了。

#使用

###函数调用方式
```
var crop
if(crop){
  crop.show(src)
}else{
  crop = new simpleCrop({
   src,
   ...cropOptions,     
   cropCallback: (base64) => {},
   closeCallback: () => {}
  })
}
```
###组件调用方式

```
Vue.use(simpleCrop)

<simple-crop @crop="callback" :cropOptions="cropOptions">
          选择图片文件
</simple-crop>

callback (file) {
  doSomething(file)
}

```

### 参数
<table style="word-break: normal;">
	<tr>
		<td>参数</td>
		<td>说明</td>
	</tr>
	<tr>
		<td>src</td>
		<td>素材图片地址</td>
	</tr>
	<tr>
		<td>size</td>
		<td>裁剪图片尺寸</td>
	</tr>
	<tr>
		<td>borderWidth</td>
		<td>裁剪框边框宽度</td>
	</tr>
	<tr>
		<td>cropSizePercent</td>
		<td>裁剪框占裁剪显示区域的比例，0.9表示所占比例为90%</td>
	</tr>
	<tr>
		<td>controller</td>
		<td>控制方式，取值有两种，分别为<b>touch</b>表示触摸操作适用于移动端；<b>mouse</b>表示鼠标操作适用于PC</td>
	</tr>
	<tr>
		<td>positionOffset</td>
		<td>裁剪框偏移，一般默认裁剪框在画布中心，如果不想在中心则需要设置这个属性来对其位置进行一定的偏移</td>
	</tr>
	<tr>
        <td>coverColor</td>
        <td>非裁剪框区域遮罩颜色</td>
    </tr>
	<tr>
		<td>funcBtns</td>
		<td>功能按钮设置，取值有四种，分别为<b>close</b>表示关闭功能按钮、<b>reset</b>表示还原功能按钮、<b>around</b>表示整角90度旋转按钮、<b>crop</b>表示裁剪按钮；属性中的顺序决定其DOM元素的层级顺序</td>
	</tr>
	<tr>
		<td>scaleSlider</td>
		<td>是否开启滑动缩放组件，因为在PC端不支持双指触摸，因此需要设置这个属性为true，来启动控制缩放的滑动组件，移动端没必要则设置为false</td>
	</tr>
	<tr>
		<td>rotateSlider</td>
		<td>是否开启旋转滑动组件，本来双指触摸既可以用来控制缩放也可以用来控制旋转，但是实际体验时感觉不能使用一种操作控制两种功能，因此最终只使用双指触摸控制缩放，旋转使用额外组件来控制</td>
	</tr>
	<tr>
		<td>cropCallback</td>
		<td>图片裁剪回调函数，在函数中通过<b>this.$resultCanvas</b>来获取裁剪结果</td>
	</tr>
</table>

更多详细资料看原项目[Simple-Crop](https://github.com/newbieYoung/Simple-Crop)或者看本项目代码，再次感觉原项目作者。




