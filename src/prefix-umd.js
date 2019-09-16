export default function () {
  var style = typeof document !== 'undefined'
    ? document.createElement('p').style
    : {}

  var prefixes = ['O', 'ms', 'Moz', 'Webkit']
  var upper = /([A-Z])/g
  var memo = {}

  /**
   * prefix `key`
   * prefix('transform') // => WebkitTransform
   *
   * @param {String} key
   * @return {String}
   * @api public
   */
  function prefix (key) {
    // Camel case
    key = key.replace(/-([a-z])/g, function (_, char) {
      return char.toUpperCase()
    })

    // Without prefix
    if (style[key] !== undefined) return key

    // With prefix
    var Key = key.charAt(0).toUpperCase() + key.slice(1)
    var i = prefixes.length
    while (i--) {
      var name = prefixes[i] + Key
      if (style[name] !== undefined) return name
    }

    return key
  }

  /**
   * Memoized version of `prefix`
   *
   * @param {String} key
   * @return {String}
   * @api public
   */
  function prefixMemozied (key) {
    if (key in memo) {
      return memo[key]
    } else {
      memo[key] = prefix(key)
      return memo[key]
    }
  }

  /**
   * Create a dashed prefix
   *
   * @param {String} key
   * @return {String}
   * @api public
   */
  function prefixDashed (key) {
    key = prefix(key)
    if (upper.test(key)) {
      key = key.replace(upper, '-$1')
      upper.lastIndex = 0
    }
    return key.toLowerCase()
  }

  return {
    prefix: prefixMemozied,
    dash: prefixDashed
  }
}
