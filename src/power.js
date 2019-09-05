// ---------------- jspower utils ------------------ \\
/*
 * $.fn.watch, $.fn.unwatch
 *
 * 2014-04-03
 *
 * By Shmuel Friedman
 * Public Domain.
 * NO WARRANTY EXPRESSED OR IMPLIED. USE AT YOUR OWN RISK.
 */
(function($,window){
// $(object).watch
  $.fn.watch = function (prop, callback) {
      var watchKey = $.camelCase('watch-' + prop);
      return this.each(function () {
          var $this = $(this);
          $this.on(watchKey, callback);

          if ($this.data(watchKey)) return;
          var
              oldval = this[prop]
          , newval = oldval
          , oldDescriptor = Object.getOwnPropertyDescriptor ? Object.getOwnPropertyDescriptor(this, prop) : null
          , oldGetter = oldDescriptor && oldDescriptor.get 
              ? oldDescriptor.get
              : function () {
                  return newval;
              }
          , oldSetter = oldDescriptor && oldDescriptor.set
          , getter = oldGetter
          , setter = function (val) {
              if (newval !== val) {
                  if (oldSetter) {
                      oldSetter(val);
                      val = getter(); //val may changed inside oldSetter
                  }
                  oldval = newval;
                  newval = val;
                  var ret = $this.trigger(watchKey, [prop, oldval, val]);
                  return ret;
              }
          }
          ;

          if (delete this[prop]) { // can't watch constants
              Object.defineProperty(this, prop, {
                  get: getter
                  , set: setter
                  , enumerable: true
                  , configurable: true
              });
          }
          else
              throw 'can\'t watch constants or an inconfigurable properties';
          var state = {
              dispose: function () {
                  $this.removeData(watchKey);
                  delete this[prop]; // remove accessors
                  if (oldDescriptor)
                      Object.defineProperty(this, prop, oldDescriptor);
                  else
                      this[prop] = newval;
                  oldDescriptor = oldGetter = oldSetter = setter = $this = null;
              }.bind(this)
          };
          $this.data(watchKey, state);
      });
  };
  $.fn.unwatch = function (prop, callback) {
      var watchKey = $.camelCase('watch-' + prop);
      this.unbind(watchKey, callback);
      return this.each(function () {
          if (!jQuery._data(this, 'events') || !jQuery._data(this, 'events')[watchKey] || !jQuery._data(this, 'events')[watchKey].length)
              $(this).data(watchKey).dispose();
      });
  };
  let _jspower = {inherit,waitObjectProp,rightJoin,loopAsync,scan};
  if (window.jspower) 
    Object.assign(window.jspower,_jspower); 
  else 
    Object.assign(window, {jspower:_jspower});
  
  function inherit(type, parent, constructorArgs, noConstructorCall) {
      $.extend(type, parent);
      if (typeof parent == 'function')
          type.prototype = !noConstructorCall ? new parent(constructorArgs) : Object.create(parent.prototype);
      else
          type.prototype = parent;
      type.Base = parent;
      type.prototype.constructor = type;
      return type;
  }

  /*Function.prototype.inherit = function (Parent) {
      return Function.inherit(this, Parent);
  }*/
  Function.inherit = function (Type, Parent) {
      if (Type.prototype instanceof Parent && Type.prototype.__constructor)
          return Type.prototype.__constructor;
      //NewType.prototype = Object.create(Type.prototype);
      //NewType.prototype.constructor = NewType;
      var props = $.extend({}, Type.prototype);
      Type.prototype = Object.create(Parent.prototype);
      Type.prototype.constructor = Type;
      Type.prototype.__constructor = NewType;
      $.extend(Type.prototype, props);

      return NewType;

      function NewType() {
          //var instance = this;
          var instance = Object.create(Type.prototype);
          Parent.apply(instance, arguments);
          instance._parent = $.extend({}, instance);
          Object.getOwnPropertyNames(instance._parent).forEach(function (member) {
              if (instance._parent[member] instanceof Function)
                  instance._parent[member] = instance._parent[member].bind(instance);
          });
          Type.apply(instance, arguments);
          return instance;
      }
  };

  /*Function.prototype.inherit = function(Parent, self) {
      var newClass = function() { };
      newClass.prototype = Object.create(this.prototype);
      this.prototype = Object.create(Parent.prototype);
      var callee = this;
      return function() {
          var _parent = {};
          var newInstance = Object.create(callee.prototype);
          Parent.apply(newInstance, arguments);
          newInstance._getParent = function() {
              var _self = this;
              for (var prop in callee.prototype)
                  _parent[prop] = callee.prototype[prop].bind(_self);
              _parent.prototype = Object.create(callee.prototype);
              delete newInstance._getParent;
              newInstance = null;
              return _parent;
          };
          callee.apply(newInstance, arguments);
          return newInstance;
      }
  }*/
  function waitObjectProp(obj, prop, callback, reuse) {
      if (obj[prop])
          callback(obj[prop]);
      else {
          var _callback = (e,p,oldVal,val) => callback(val);
          if (!reuse)
              _callback = function (e,props) {
                  $(obj).unwatch(prop, _callback);
                  callback(obj[prop]);
              };
          $(obj).watch(prop, _callback);
      }
  }
  /*
   * object.watch polyfill
   *
   * 2012-04-03
   *
   * By Eli Grey, http://eligrey.com
   * Public Domain.
   * NO WARRANTY EXPRESSED OR IMPLIED. USE AT YOUR OWN RISK.
   */
  /*Object.defineProperty(Object.prototype, "watch", {
          enumerable: false
      , configurable: true
      , writable: false
      , value: function (prop, handler) {
          var
          oldval = this[prop]
        , newval = oldval
        , getter = function () {
            return newval;
        }
        , setter = function (val) {
            oldval = newval;
            return newval = handler.call(this, prop, oldval, val);
        }
          ;
        
          if (delete this[prop]) { // can't watch constants
              Object.defineProperty(this, prop, {
                  get: getter
            , set: setter
            , enumerable: true
            , configurable: true
              });
          }
      }
      });
  }
   
  // object.unwatch
  if (!Object.prototype.unwatch) {
      Object.defineProperty(Object.prototype, "unwatch", {
          enumerable: false
      , configurable: true
      , writable: false
      , value: function (prop) {
          var val = this[prop];
          delete this[prop]; // remove accessors
          this[prop] = val;
      }
      });
  }*/

  function rightJoin(a, b) {
      if (b instanceof Array) {
          var keys = b; b = {};
          keys.forEach(function (key) {
              if (a[key] != undefined)
                  b[key] = a[key];
          });
      }
      else if (b instanceof Object) {
          for (var key in b) {
              if (a[key] != undefined)
                  b[key] = a[key];
          }
      }
      return b;
  }

  function loopAsync(levels, lengths, callback) {
      var i = [];
      for (var j = 0; j < levels - 1; j++)
          i[j] = 0;
      i[levels - 1] = -1;
      function tick() {
          i[levels - 1]++;
          for (var j = levels - 1; j > 0; j--)
              while (i[0] < lengths(null, 0) && i[j] >= lengths(i, j)) { i[j] = 0; i[j - 1]++; }
          if (i[0] >= lengths(null, 0)) return;
          callback(i);
          setTimeout(tick, 0);
      }
      setTimeout(tick, 0);
  }

  var maxLevel = 30;
  function scan(model, transform, propertyFilter) {
    var res = model;
    const[, , , parent, level] = arguments;
    if (arguments.length <= 3) {
        level = 0;
        if (!propertyFilter)
            propertyFilter = prop => prop != null;
    }
    if (maxLevel != null && level > maxLevel)
        throw 'maximum recursion level reached';
    if (model instanceof Array) {
        res = [];
        for (var i = 0; i < model.length; i++) {
            res[i] = scan(model[i], transform, propertyFilter, model, level + 1);
        }
    } else if (model instanceof Object && !(model instanceof Date)) {
        res = {};
        for (var key in model) {
            if (propertyFilter(key))
                res[key] = scan(model[key], transform, propertyFilter, model, level + 1);
        }
    }
    return transform(res, parent, level);
}

  if (typeof disposable == 'undefined')
      waitObjectProp(jspower, 'disposable', function (obj) { 
        disposable = jspower.disposable; 
      });
})($,window);