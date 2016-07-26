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

// $(object).watch
$.fn.watch = function (prop, callback) {
    var watchKey = $.camelCase('watch-' + prop);
    return this.each(function () {
        var $this = $(this);
        $this.bind(watchKey, callback);

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

if (typeof disposable == 'undefined')
    waitObjectProp(window, 'jspower', function (obj) { disposable = jspower.disposable; });

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

function waitObjectProp(obj, prop, callback, reuse) {
    if (obj[prop])
        callback();
    else {
        var _callback = callback;
        if (!reuse)
            _callback = function (e) {
                $(obj).unwatch(prop, _callback);
                callback(e, obj[prop]);
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