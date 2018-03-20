// https://github.com/shmuelf/PowerJS
(function (ko, $) {
    var rideKo = false;
    var jspComputed;
    (function () {
        var koComputed = ko.computed;
        jspComputed = function (opts) {
            var comp,
                disposeWhen;
            if (!(opts instanceof Function))
                if (ko.isObservable(opts.disposeWhen)) {
                    disposeWhen = opts.disposeWhen;
                    delete opts.disposeWhen;
                }
            comp = koComputed.apply(ko, arguments);
            if (disposeWhen) {
                var origDispose = comp.dispose;
                var sscr = new jspower.utils.subscribeMatch(disposeWhen, true, function () {
                    comp.dispose();
                });
                if (!disposeWhen())
                    comp.dispose = function () {
                        origDispose.apply(comp, arguments);
                        sscr.dispose();
                    };
            }
            return comp;
        };
    })();
    
    var maxLevel = 30;
    function fromJS(model, level, reuse) {
        var res;
        if (level == null) level = 0;
        if (level > maxLevel)
            throw 'maximum recursion level reached';
        if (model instanceof Array) {
            var clonedArray = [];
            for (var i = 0; i < model.length; i++) {
                clonedArray[i] = fromJS(model[i], level + 1);
            }
            res = ko.observableArray(clonedArray);
        }
        else if (model instanceof Object) {
            res = {};
            for (var key in model) {
                if (isLegalProp(key))
                    res[key] = fromJS(model[key], level + 1);
            }
        }
        else {
            res = ko.observable(model);
        }
        return res;
    }
    
    function toJS(model, level, reuse) {
        var res;
        if (level == null) level = 0;
        if (level > maxLevel)
            throw 'maximum recursion level reached';
        if (ko.isObservable(model)) {
            var unwrapedModel = model();;
            if (model.splice) {//model instanceof ObservableArray
                res = [];
                for (var i = 0; i < unwrapedModel.length; i++) {
                    res[i] = toJS(unwrapedModel[i], level + 1);
                }
            }
            else if (unwrapedModel instanceof Object){
                res = {};
                for (var key in unwrapedModel) {
                    if (key)
                        res[key] = toJS(unwrapedModel[key], level + 1);
                }
            }
            else
                res = unwrapedModel;
        }
        else if (model instanceof Object) {
            res = {};
            for (var key in model) {
                if (isLegalProp(key))
                    res[key] = toJS(model[key], level + 1);
            }
        }
        else 
            res = model;
        return res;
    }
    function isLegalProp(key) {
        return !(key == null || (key.indexOf('jQuery') == 0 && key.length > 20));
    }

    function clearKoMappedObj(obj) {
        var level = arguments[1];
        function clearObservable(obs) {
            if (ko.isComputed(obs))
                obs.dispose();
            /*var sscr = obs._subscriptions;
            Object.keys(sscr).forEach(function (sscrType) { for (var i = sscr[sscrType].length - 1; i >= 0; i--) sscr[sscrType][i].dispose(); });*/
        }
        if (level == null) level = 0;
        if (level > maxLevel) debugger;

        var isKO = ko.isObservable(obj);
        if (isKO) {
            var val = obj();
            //if (obj[key].splice instanceof Function) {
            clearKoMappedObj(val, level + 1);
            clearObservable(obj);
        }
        else if (obj instanceof Function)
            return;
        else if (obj instanceof Array)
            obj.forEach(function (prop) { clearKoMappedObj(prop, level + 1); });
        else if (obj instanceof Object)
            Object.keys(obj).forEach(function (key) { clearKoMappedObj(obj[key], level + 1); });
    }
    
    var jspowerKoUtils = {
        computed: jspComputed,
        utils: {
            fromJS: fromJS,
            toJS: toJS,
            clearComputeds: clearKoMappedObj,
        }
    };
    if (rideKo)
        $.extend(true, window, { ko: jspowerKoUtils });
    else {
        if (typeof waitObjectProp == 'undefined')
            jspower = jspowerKoUtils;
        else
            waitObjectProp(window, 'jspower', function (obj) {
                $.extend(true, obj, jspowerKoUtils);
            });
    }
})(ko, $);
