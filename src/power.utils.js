// ---------------- power-js-utils ------------------ \\
/*
 * 2014-04-03
 *
 * By Shmuel Friedman
 * USE AT YOUR OWN RISK.
 */

(function(ko, $) {
    var rideKo = false;

    var disposable = function (func, disposeFunc, onOffSwitch, canInitTester, reuse) {
        var self = this;
        var shouldInit = false;
        var ret = function () {
            if (!self.initialized) {
                if (canInitTester) {
                    shouldInit = true;
                    if (!canInitTester())
                        return;
                }
                self.initializing = true;
                self.initialized = true;
                var returnVal = func.apply(self, arguments);
                self.initializing = false;
                if (returnVal)
                    return returnVal;
                else
                    return ret;
            }
        };
        function dispose() {
            if (self.initialized && !self.initializing) {
                self.initialized = false;
                shouldInit = false;
                if (disposeFunc)
                    disposeFunc.apply(self, arguments);
                if (!(reuse || onOffSwitch))
                    ret.destroy();
            }
        };
        self.dispose = ret.dispose = dispose;
        if (canInitTester)
            ret.retryInitIfFailed = function () {
                if (shouldInit)
                    return ret();
            };
        if (onOffSwitch) {
            function checkIntegrity(on) {
                if (on)
                    ret();
                else
                    ret.dispose();
            }
            ret.onOffSscr = onOffSwitch.subscribe(checkIntegrity);
            checkIntegrity(onOffSwitch());
        }
        ret.instance = self;
        ret.destroy = function () {
            ret.instance = self = null;
            if (ret.onOffSscr) {
                ret.onOffSscr.dispose();
                ret.onOffSscr = null;
            }
        };
        return ret;
    };

    var disposableJEventOptions = {
        reuse: false,
        bindMethods: ['on', 'off']
    };
    var disposableJEvent = function (obj, eventName) {
        var dynStart = 2;
        var options;
        if (eventName instanceof Object) {
            options = $.extend({}, disposableJEventOptions, eventName);
            eventName = options.eventName;
        }
        else
            options = $.extend({}, disposableJEventOptions);

        var args = Array.prototype.slice.apply(arguments, [dynStart]);
        //eventName = eventName + '.' + new Date().getTime();
        args.unshift(eventName);
        
        var $obj = $(obj);
        var ret = new disposable(function () {
            $obj[options.bindMethods[0]].apply($obj, args);
        }, function() {
            $obj[options.bindMethods[1]](eventName, args[args.length - 1]);
            if (!options.reuse)
                ret.destroy();
        }, null, null, options.reuse);
        ret.destroy = function () {
            ret = $obj = null;
        };
        ret();
        return ret;
    }

    // ---------------------    jspower utils    -------------------------- \\
    var jspowerUtils = {
        utils: {
            subscribeMatch: subscribeMatch,
            propDependency: propDependency,
            propDependencies: propDependencies,
            forwardMembers: forwardMembers,
            passThroughEvents: passThroughEvents,
            propAgg: propAgg,
            agg: agg,
            min: min,
            max: max
        },
        models: {
            propDependencyModel: function (obj, key, linkWithWatch) {
                this.obj = obj;
                this.key = key;
                this.linkWithWatch = linkWithWatch;
            }
        },
        disposable: disposable,
        disposableJEvent: disposableJEvent
    };
    if (rideKo)
        $.extend(true, window, { ko: jspowerUtils });
    else
        $.extend(true, window, { jspower: jspowerUtils };

    function getVal(obj) { return ko.isObservable(obj) ? obj() : obj.obj[obj.key]; };

    function setVal(obj, val, convertFn) { if (ko.isObservable(obj)) obj(convertFn(val)); else obj.obj[obj.key] = convertFn(val); };

    function subscribeObj(obj, callback, dontUseWatch) {
        if (ko.isObservable(obj))
            return obj.subscribeChanged(callback);
        else if ((obj.linkWithWatch !== false && !dontUseWatch) && $.fn.watch) {
            var watchFn = function (e, key, oldVal, val) {
                //if (val !== oldVal)
                callback(val, oldVal);
            };
            $(obj.obj).watch(obj.key, watchFn);
            return {
                dispose: function () {
                    $(obj.obj).unwatch(obj.key, watchFn);
                }
            };
        }
    }

    function subscribeMatch(observable, trigerringValue, callback, reuse, dontLaunch) {
        var hasCallbackCalled = false;
        var subscription;
        var that = this === self || this === jspowerUtils.utils ? Object.create(subscribeMatch.prototype) : this;

        that.launch = launch;
        that.dispose = dispose;

        function launch() {
            if ((checkIntegrity(getVal(observable)) && !reuse) || hasCallbackCalled)
                return;

            subscription = subscribeObj(observable, /*!reuse ? */trackChanges/* : checkIntegrity*/);
        }

        function trackChanges(newVal) {
            if (checkIntegrity(newVal) && !reuse)
                dispose();
        }

        function checkIntegrity(val) {
            if (((trigerringValue instanceof Function && trigerringValue(val)) || (val == trigerringValue) /*|| (trigerringValue === undefined)*/) && !hasCallbackCalled) {
                hasCallbackCalled = true;
                /*var ret = */callback();
                return true;
            }
        }

        function dispose() {
            hasCallbackCalled = false;
            if (subscription) {
                subscription.dispose();
                subscription = null;
            }
            if (callback instanceof disposable) {
                callback.dispose();
                callback = null;
            }
        }

        that.hasCallbackCalled = function () {
            return hasCallbackCalled;
        }

        if (!dontLaunch)
            launch.call(that);

        return that;
    }

    function propDependency(subscriber, publisher, oppositeVals, biDirection, leftToRight, rightToLeft, dontInitValues, disposeWhen) {
        var assets = [];
        var init = new disposable(function () {
            var _leftToRight, _rightToLeft;
            var echo = function (val) { return val };
            var oposite = function (val) { return !val };

            if (!oppositeVals) {
                if (!leftToRight) _leftToRight = echo; else _leftToRight = leftToRight;
                if (!rightToLeft) _rightToLeft = echo; else _rightToLeft = rightToLeft;
            }
            else {
                if (!leftToRight) _leftToRight = oposite; else _leftToRight = function (val) { return leftToRight(!val); };
                if (!rightToLeft) _rightToLeft = oposite; else _rightToLeft = function (val) { return rightToLeft(!val); };
            }
            function oneDirectionDependency(subscriber, publisher, convertFn) {
                if (!dontInitValues)
                    setVal(subscriber, getVal(publisher), convertFn);
                return subscribeObj(publisher, function (val, oldVal) {
                    if (oldVal != val && val != getVal(subscriber))
                        setVal(subscriber, val, convertFn);
                }/*, !biDirection*/);
            }
            assets.push(oneDirectionDependency(subscriber, publisher, _rightToLeft));
            if (biDirection)
                assets.push(oneDirectionDependency(publisher, subscriber, _leftToRight));
        }, function () {
            assets.forEach(function (a) { a.dispose(); });
            assets = null;
        }, null, null, disposeWhen);
        init();

        this.dispose = init.dispose;

        if (disposeWhen)
            assets.push(new subscribeMatch(disposeWhen, true, init.dispose));
    };

    function propDependencies(subscriberObj, publisherObj, propsArr, disposeWhen, oppositeVals, biDirection, leftToRight, rightToLeft, dontInitValues) {
        var that = this instanceof propDependencies ? this : Object.create(propDependencies.prototype); // check if running as constructor, else initiating based on empty instance;
        function getSubscribeable(obj, prop) {
            var subscribeable;
            if (typeof prop == 'string') {
                subscribeable = obj[prop];
                if (!ko.isObservable(subscribeable))
                    subscribeable = { obj: obj, key: prop };
            }
            else
                subscribeable = $.extend({ obj: obj }, prop);
            return subscribeable;
        }
        var assets = [];
        for (var i = 0; i < propsArr.length; i++) {
            var prop = propsArr[i];
            var subscriber = getSubscribeable(subscriberObj, prop);
            var publisher = getSubscribeable(publisherObj, prop);
            if (prop instanceof Object)
                assets.push(new propDependency(subscriber, publisher, 'oppositeVals' in prop ? prop.oppositeVals : oppositeVals, 'biDirection' in prop ? prop.biDirection : biDirection, 'leftToRight' in prop ? prop.leftToRight : leftToRight, 'rightToLeft' in prop ? prop.rightToLeft : rightToLeft, 'dontInitValues' in prop ? prop.dontInitValues : dontInitValues));
            else
                assets.push(new propDependency(subscriber, publisher, oppositeVals, biDirection, leftToRight, rightToLeft, dontInitValues));
        }
        that.dispose = function () {
            assets.forEach(function (a) { a.dispose(); });
            assets = null;
        };
        if (disposeWhen)
            assets.push(new subscribeMatch(disposeWhen, true, that.dispose));
        return that;
    }
    
    function forwardMembers(self, source, disposed) {
        var assets = {};
        var members = Array.prototype.slice.call(arguments, arguments.callee.length /*3*/);
        members.forEach(function (m) {
            if (self[m])
                throw 'can\'t overrite method ' + m;
            if (source[m] instanceof Function)
                self[m] = source[m];
            else
                new propDependency({ obj: self, key: m }, { obj: source, key: m }, null, true, null, null, null, disposed); //auto dispose
            assets[m] = function () {
                delete self[m];
            };
        });
        return assets;
    }
    function passThroughEvents(self, source) {
        var events = Array.prototype.slice.call(arguments, arguments.callee.length /*2*/);
        var assets = {};
        events.forEach(function (ev) {
            assets[ev] = new disposableJEvent(source, ev, function (e) {
                var args = Array.prototype.splice.call(arguments, 1);
                //args.push(e);
                $(self).trigger(ev, args);
            });
        })
        return assets;
    }

    /*  // this code can extend propDependency as it was a working example of making propDependency dynamiclly on a group of observables with a complex structure
        var boundFields = ['alias', 'content', { root: 'keyerInstruction', field: 'content', type: LayoutFieldNote, target: 'note' }];
        var dataBound = new disposable(function (field) {
            for (var i = 0; i < boundFields.length; i++) {
                var bound = boundFields[i];
                if (typeof bound == 'string') {
                    this[bound] = new propDependency(fData[bound], { obj: field, key: [bound] }, false, true);
                }
                else {
                    var root = eval('field.' + bound.root)
                    if (root) {
                        var link = new propDependency(fData[bound.target], { obj: field[bound.root], key: bound.field }, false, true);
                        eval('this.' + bound.root + ' = link;');
                    }
                    else {
                        fData[bound.target]('');
                        fData[bound.target].subscribe(function (val) {
                            if (val) {
                                field[bound.root] = new bound.type();
                                field[bound.root][bound.field] = val;
                            }
                            else
                                delete field[bound.root];
                        });
                    }
                }
            }
        }, function () {
            self.dialogContent.validateTips('');
            for (var i = 0; i < boundFields.length; i++) {
                var bound = boundFields[i];
                if (typeof bound == 'string')
                    this[bound].dispose();
                else if (eval('this.' + bound.root))
                    eval('this.' + bound.root + '.dispose()');
            }
        });*/

    // TODO: add underscore.js & use _.min, _.max etc.
    function max(arr, prop) {
        return propAgg(arr, prop, function (propVal, val) {
            return val < propVal ? propVal : val;
        });
    }
    function min(arr, prop) {
        return propAgg(arr, prop, function (propVal, val) {
            return val > propVal ? propVal : val;
        });
    }
    function propAgg(arr, prop, action) {
        var getProp = propGetter(arr, prop);
        return arr.reduce(function (val, item) {
            var propVal = getProp(item);
            return action(propVal, val, item);
        });
    }
    
    function agg(arr, prop) {
        var getProp = propGetter(arr, prop);
        var ret = {};
        arr.forEach(function (item) {
            var val = getProp(item);
            if (!ret[val]) ret[val] = [];
            ret[val].push(item);
        });
        return ret;
    }

    function propGetter(arr, prop) {
        var getProp;
        if (prop instanceof Function)
            getProp = function (item) {
                return prop(item);
            };
        else
            getProp = function (item) {
                return item[prop];
            };
        return getProp;
    }
    

    //function agg(arr, propActions) {
    //    var res = {};
    //    if (propActions instanceof Array) {

    //    }
    //    else {
    //        var getProp = function(item, prop) {
    //            if (prop instanceof Function)
    //                return prop(item);
    //            else
    //                return item[prop];
    //        };
    //        return arr.reduce(function (val, item) { 
    //            var propVal = getProp(item);
    //            return action(propVal, val, item);
    //        });
    //        for (var prop in propActions) {
    //            res[prop] = propAgg(arr, propActions[prop]
    //        }
    //    }
    
    ko.subscribable.fn.subscribeChanged = function (callback, filterNonChange) {
        var oldValue;
        var beforeSubscription, afterSubscription;
        beforeSubscription = this.subscribe(function (_oldValue) {
            oldValue = _oldValue;
        }, this, 'beforeChange');

        afterSubscription = this.subscribe(function (newValue) {
            if (!filterNonChange || (newValue !== oldValue))
                callback(newValue, oldValue);
        });

        return {
            dispose: function () {
                beforeSubscription.dispose();
                afterSubscription.dispose();
                oldValue = null;
            }
        };
    };
})(ko, $);
