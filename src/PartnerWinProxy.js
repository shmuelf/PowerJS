// ---------------- power-js-partnerWinProxy ------------------ \\
/*
 * a utility for seamlessly communicating between two browser windows, dispatching an object proxies, 
 * a proxy automatically synchronizes properties, passes method calls & passthrough object events
 * 2014-04-03
 *
 * By Shmuel Friedman
 * https://github.com/shmuelf/PowerJS
 * NO WARRANTY EXPRESSED OR IMPLIED. USE AT YOUR OWN RISK.
 */
function PartnerWinProxy(partnerWin, origin) {
    var self = this;

    var assets = [];
    var services = {};
    var servicesMetadata = {};
    var functionCalls = {};
    var proxies = {};
    var onReady = this.onReady = $.Deferred();
    var getServiceRequests = {};
    var addJQueryProxy = jQueryProxyFactory();
    var handlers = createHandlers();
    var addJQTriggerProxy = addJQueryProxy('trigger', handlers.event.addServiceMember);
    var addJQBindProxy = addJQueryProxy('bind', handlers.event.addServiceMember);
    function postMessage(type, data, excpectResponse) {
        if (!data) data = {};
        data.type = type;
        var ret;
        if (excpectResponse)
            ret = prepareResponseCallback(data);
        partnerWin.postMessage(JSON.stringify(data), origin);
        if (ret)
            return ret;
    }

    window.addEventListener('message', mainMessageHandler, false);
    assets.push({
        dispose: function () {
            window.removeEventListener('message', mainMessageHandler, false);
        }
    });

    postMessage('proxyLoaded');

    this.isValid = function () {
        var ping = postMessage('ping', undefined, true);
        setTimeout(function () {
            if (ping.state() == 'pending')
                ping.reject('timeout');
            ping = null;
        }, 500);
        return ping;
    }
    function registerService(serviceName, serviceDict, options) {
        services[serviceName] = serviceDict;

        var serviceMetadata = registerServiceMembers(serviceName, serviceDict, options);

        if (!servicesMetadata[serviceName]) {
            addJQueryProxy.ignoredMethod('bind', 'signatureUpdated', serviceDict);
            addJQueryProxy.ignoredMethod('trigger', 'signatureUpdated', serviceDict);
            $(serviceDict).bind('signatureUpdated', function (e, update) {
                var ret = registerService(serviceName, serviceDict, options);
                if (update instanceof Object)
                    update.ret = ret;
            });
            servicesMetadata[serviceName] = serviceMetadata;
        }
        
        var serviceCall = { serviceName: serviceName, serviceMetadata: serviceMetadata };
        return postMessage('addProxy', serviceCall, true);
    }

    function registerServiceMembers(serviceName, serviceDict, options) {
        var service = serviceDict;
        var serviceMetadata = (servicesMetadata[serviceName] && servicesMetadata[serviceName].service) || {};
        var addedKeys = [];
        Object.keys(service).forEach(function (k) {
            if (!serviceMetadata[k]) {
                var metadata = getMetadata(serviceName, service, k);
                if (metadata) {
                    serviceMetadata[k] = metadata;
                    addedKeys.push(k);
                }
            }
        });
        
        serviceMetadata = servicesMetadata[serviceName] || { service: serviceMetadata };
        $.extend(true, serviceMetadata, options);

        addedKeys.forEach(function (k) {
            testers.addServiceMember(service, serviceMetadata.service[k], { type: 'addServiceMember', key: k, serviceMetadata: serviceMetadata });
        });

        return serviceMetadata;
    }

    function handleNewProxy(data) {
        var proxy = proxies[data.serviceName] || (proxies[data.serviceName] = new ForeignObjectProxy());
        if (data.serviceMetadata.publish === true) {
            if (!window[data.serviceName])
                window[data.serviceName] = proxy;
        }
        var addedKeys = [];
        Object.keys(data.serviceMetadata.service).forEach(function (k) {
            var memberMetadata = data.serviceMetadata.service[k];
            memberMetadata.serviceType = 'proxy';
            if (!(servicesMetadata[data.serviceName] && servicesMetadata[data.serviceName].service[k])) {
                addedKeys.push(k);
                handlers[memberMetadata.type].addProxyMember.call(self, data.serviceMetadata, memberMetadata, proxy, k);
            }
        });
        if (!servicesMetadata[data.serviceName]) {
            servicesMetadata[data.serviceName] = data.serviceMetadata;
            assets.push(addJQTriggerProxy(proxy, data.serviceName));
            assets.push(addJQBindProxy(proxy, data.serviceName));
        }
        else {
            var serviceMetadata = servicesMetadata[data.serviceName].service;
            addedKeys.forEach(function (k) {
                serviceMetadata[k] = data.serviceMetadata.service[k];
            });
        }
        if (getServiceRequests[data.serviceName]) {
            getServiceRequests[data.serviceName].resolve(proxy);
            delete getServiceRequests[data.serviceName];
        }
        //if (data.id)
        return { unregisteredType: 'general' }; //postMessage('response', { serviceName: data.serviceName, unregisteredType: 'general', id: data.id });
    }

    this.getService = function (serviceName) {
        if (proxies[serviceName])
            return proxies[serviceName];
        else
            return getServiceRequests[serviceName] = $.Deferred();
    }
    
    function createHandlers() {
        var l_handlers = {
            'function': {
                addProxyMember: function (serviceMetadata, memberMetadata, proxy, k) {
                    proxy[k] = function () {
                        var serviceCall = { arguments: Array.prototype.slice.call(arguments), serviceName: memberMetadata.serviceName, key: k };
                        return postMessage('call', serviceCall, true);
                    };
                },
                call: function (service, memberMetadata, data) {
                    if (memberMetadata && memberMetadata.type == 'function') {
                        return{ returnVal: service[data.key].apply(service, data.arguments) };
                    }
                },
                //response: generalResponse,
                getMetadata: function (serviceName, service, key) {
                    if (typeof service[key] == 'function') {
                        var metadata = { serviceName: serviceName, key: key, serviceType: 'service' };
                        metadata.type = 'function';
                        return metadata;
                    }
                }
            },
            'property': new function () {
                var inTransaction;
                this.addServiceMember = $.fn.watch ? function (service, memberMetadata, data) {
                    var fn = function (e, prop, oldval, val) {
                        if (!inTransaction || inTransaction.settingVal != val)
                            postMessage('call', { serviceName: memberMetadata.serviceName, key: data.key, value: val });
                    };
                    $(service).watch(data.key, fn);
                    assets.push({
                        dispose: function () {
                            $(service).unwatch(data.key, fn);
                        }
                    });
                    return true;
                } : undefined;
                this.addProxyMember= function (serviceMetadata, memberMetadata, proxy, k) {
                    function asyncGet() {
                        return postMessage('call', { serviceName: memberMetadata.serviceName, key: k }, true);
                    }
                    function asyncSet(v) {
                        if (!inTransaction || inTransaction.settingVal != v)
                            postMessage('call', { serviceName: memberMetadata.serviceName, key: k, value: v });
                    }
                    var getMethod, setMethod;
                    if (serviceMetadata.cacheProperties || memberMetadata.cacheProperty) {
                        proxy[k] = memberMetadata.initialVal; //undefined;
                        function fn(e, prop, oldVal, val) {
                            asyncSet(val);
                        }
                        $(proxy).watch(k, fn);
                        assets.push({
                            dispose: function () {
                                $(proxy).unwatch(k, fn);
                            }
                        });
                        /*asyncGet().done(function (val) {
                            proxy[k] = val;
                        });*/
                    }
                    else {
                        getMethod = asyncGet;
                        setMethod = asyncSet;
                        Object.defineProperty(proxy, k, {
                            get: getMethod,
                            set: setMethod
                        });
                    }
                    return true;
                };
                this.call = function (service, memberMetadata, data) {
                    if (memberMetadata && memberMetadata.type == 'property') {
                        if ('value' in data) {
                            inTransaction = { settingVal: data.value };
                            service[data.key] = data.value;
                            inTransaction = null;
                        }
                        //else if (data.key && data.id)
                        return { returnVal: service[data.key] };//postMessage('response', { serviceName: memberMetadata.serviceName, key: data.key, returnVal: service[data.key], id: data.id });
                        //return true;
                    }
                };
                //response: generalResponse,
                this.getMetadata = function (serviceName, service, key) {
                    if (typeof service[key] != 'function') {
                        return { serviceName: serviceName, key: key, serviceType: 'service', type: 'property', initialVal: service[key] };
                    }
                };
            },
            'event': {
                addServiceMember: function (method, service, serviceName, eventName) {
                    if (eventName.indexOf('watch') == 0) {
                        var key = eventName.substr(5, 1).toLowerCase() + eventName.substr(6);
                        if (key in service)
                            return false;
                    }
                    var serviceCall = { serviceName: serviceName, subType: method, key: 'event.' + eventName };
                    if (!servicesMetadata[serviceName].service['event.' + eventName])
                        servicesMetadata[serviceName].service['event.' + eventName] = { serviceName: serviceName, key: 'event.' + eventName, type: 'event', serviceType: 'proxy' };
                    /*if (method == 'trigger') */serviceCall.unregisteredType = 'event';
                    postMessage('call', serviceCall); //add response to get return value (e.returnVal)
                    return true;
                },
                call: function (service, memberMetadata, data) {
                    if (!((memberMetadata && memberMetadata.type == 'event') || (data.unregisteredType == 'event')))
                        return false;

                    var eventName = data.key.substr(6); //remove the 'event.' prefix for interacting with jQuery
                    var args;
                    if (data.subType == 'bind') {
                        args = function () {
                            var eventArgs = Array.prototype.slice.call(arguments);
                            /*eventArgs.push(*/eventArgs.splice(0, 1);//);
                            var serviceCall = $.extend({ subType: 'trigger', key: data.key, arguments: eventArgs }, memberMetadata);
                            return postMessage('call', serviceCall, true);
                        };
                    }
                    else if (data.subType == 'trigger') {
                        if (eventName.indexOf('watch') == 0) {
                            var key = eventName.substr(5, 1).toLowerCase() + eventName.substr(6);
                            if (key in service)
                                return false;
                        }
                        args = data.arguments;
                    }
                    else
                        return false;

                    $svc = $(service);

                    if (memberMetadata.serviceType == 'proxy')
                        addJQueryProxy.ignoredMethod(data.subType, eventName, service);
                    $svc[data.subType](eventName, args);
                    if (memberMetadata.serviceType == 'proxy')
                        addJQueryProxy.ignoredMethod(data.subType, eventName, service, true);

                    if (data.subType == 'bind')
                        assets.push({
                            dispose: function () {
                                $svc.unbind(eventName, args);
                            }
                        });
                    else
                        args = null;
                    return true;
                }
            }/*,
            general: {
                response: generalResponse
            },*/
        };
        
        if (PartnerWinProxy.handlers)
            l_handlers = $.extend(true, {}, PartnerWinProxy.handlers, l_handlers);
        return l_handlers;
    }

    function prepareResponseCallback(data) {
        var id = generateGuid();
        ret = $.Deferred();
        var fCall = { defer: ret };
        if (auditCalls)
            fCall.data = data; //{ serviceName: data.serviceName, type: data.type, key: data.key, serviceType: data.serviceType }
        functionCalls[id] = fCall;
        data.id = id;
        return ret;
    }

    var auditCalls = [];
    function handleResponse(data, ret, memberMetadata) {
        if (data.type == 'response') {
            var fCall = functionCalls[data.id];
            if (fCall) {
                if (!data.status || data.status == 'resolved') {
                    fCall.defer.resolve(data.returnVal);
                    if (auditCalls)
                        auditCalls.push(fCall);
                    delete functionCalls[data.id];
                }
                else if (data.status == 'rejected') {
                    fCall.defer.reject.apply(fcall, data.rejectArgs);
                    auditCalls.push(fCall);
                    delete functionCalls[data.id];
                }
                else if (data.status == 'progress') {
                    fCall.defer.notify(data.returnVal);
                }
            }
            return true;
        }
        if (data.id) {
            var serviceCall = $.extend({ id: data.id }, memberMetadata, ret);
            $.when(serviceCall.returnVal).done(function (ret1) {;
                $.extend(serviceCall, { returnVal: ret1, status: 'resolved' });
                if (auditCalls)
                    auditCalls.push({ serviceCall: serviceCall, data: data, memberMetadata: memberMetadata });
                postMessage('response', serviceCall);
                serviceCall = serviceCall.returnVal = null;
            }).fail(function () {
                var args = [].slice.call(arguments, 1);
                //args.push(arguments[0]);
                $.extend(serviceCall, { rejectArgs: args, status: 'rejected' });
                if (auditCalls)
                    auditCalls.push({ serviceCall: serviceCall, data: data, memberMetadata: memberMetadata });
                postMessage('response', serviceCall);
                serviceCall = serviceCall.returnVal = null;
            }).progress(function (ret1) {
                $.extend(serviceCall, { returnVal: ret1, status: 'progress' });
                if (auditCalls)
                    auditCalls.push({ serviceCall: serviceCall, data: data, memberMetadata: memberMetadata });
                postMessage('response', serviceCall);
            });
        }
    }

    function handleServiceMessages(data) {
        var service = services[data.serviceName] || proxies[data.serviceName];
        var memberMetadata = servicesMetadata[data.serviceName].service[data.key];
        if (!memberMetadata && data.unregisteredType)
            memberMetadata = servicesMetadata[data.serviceName].service[data.key] = { serviceName: data.serviceName, key: data.key, type: data.unregisteredType, serviceType: services[data.serviceName] ? 'service' : 'proxy' };
        return { memberMetadata: memberMetadata, ret: testers[data.type](service, memberMetadata, data) };
    }

    //var requestsQueue = [], executeQueueAsync;
    function mainMessageHandler(e) {
        /*requestsQueue.push(e.data);
        if (!executeQueueAsync) {
            executeQueueAsync = */setTimeout(function () {
                var data = e.data;
                //while (data = requestsQueue.shift()) {
                    if (data && (data = JSON.parse(data))) {
                        var ret, memberMetadata;
                        if (data.type == 'proxyLoaded') {
                            if (onReady.state() != 'resolved') {
                                postMessage('proxyLoaded');
                                onReady.resolve();
                            }
                        }
                        else {
                            if (data.type == 'addProxy')
                                ret = handleNewProxy(data);
                            else if (data.type == 'call') {// == 'call' || data.type == 'event' || data.type == 'response')
                                var svcReturn = handleServiceMessages(data);
                                ret = svcReturn.ret;
                                memberMetadata = svcReturn.memberMetadata;
                            }
                        }
                        handleResponse(data, ret, memberMetadata);
                    }
                /*}
                executeQueueAsync = null;*/
            }, 0);
        //}
    }

    function jQueryProxyFactory() {
        var oldFn = {};
        var jqTargets = {};
        var ignoreEvents = {};
        assets.push({
            dispose: function () {
                for (var method in oldFn)
                    $.fn[method] = oldFn[method];
                oldFn = {};
                jqTargets = {};
                ignoreEvents = {};
            }
        });

        function jqAddProxy(method, callback) {

            function jqProxyMethod() {
                var service;
                var ignore = ignoreEvents[method] && ignoreEvents[method][arguments[0]];
                var isListeningMethodOnThis = this.some(function (el) {
                    if (ignore && ignore == el)
                        return false;
                    return jqTargets[method].some(function (tg) {
                        return (el == tg.service ? ((service = tg) && true) : false);
                    });
                });
                if (isListeningMethodOnThis) {
                    var args = [method, service.service];
                    args.push.apply(args, service.args);
                    args.push.apply(args, arguments);
                    callback.apply(this, args);
                }

                return oldFn[method].apply(this, arguments);
            }

            function overrideJQMethodIfNeeded() {
                if (!jqTargets[method]) {
                    jqTargets[method] = [];
                    oldFn[method] = $.fn[method];
                    $.fn[method] = jqProxyMethod;
                    return true;
                }
            }

            function restoreJQMethodIfNeeded() {
                if (jqTargets[method] && !jqTargets[method].length) {
                    delete jqTargets[method];
                    $.fn[method] = oldFn[method];
                    if (ignoreEvents[method])
                        delete ignoreEvents[method];
                }
            }
            
            function addJQProxy(service) {
                if (!overrideJQMethodIfNeeded() && jqTargets[method].some(function (tg) { return tg.service == service }))
                    return;
                var obj = { service: service, args: arguments.length > 1 ? Array.prototype.slice.call(arguments, 1) : [] };
                jqTargets[method].push(obj);

                return {
                    dispose: function () {
                        if (!jqTargets[method])
                            return;
                        var objIdx;
                        if (jqTargets[method].some(function (tg, idx) { if (tg.service == obj) { objIdx = idx; return true; } }))
                            jqTargets[method].splice(objIdx, 1);
                        if (!jqTargets[method].length) {
                            delete jqTargets[method];
                            restoreJQMethodIfNeeded();
                        }
                    }
                };
            }
            return addJQProxy;
        }
        jqAddProxy.ignoredMethod = function (method, param1, service, remove) {
            if (remove)
                delete ignoreEvents[method][param1];
            else {
                if (!ignoreEvents[method])
                    ignoreEvents[method] = {};
                ignoreEvents[method][param1] = service;
            }
        };
        return jqAddProxy;
    }
    //var addJQueryBindProxy = (function () {
    //    var oldBind;
    //    var jqBindTargets = [];
    //    return function (proxy, data) {
    //        jqBindTargets.push(proxy);
    //        if (!oldBind) {
    //            oldBind = $.fn.bind;
    //            $.fn.bind = function () {
    //                if (this.some(function (el) { return jqBindTargets.some(function (tg) { return el == tg }); }))
    //                    postMessage('event', { /*serviceName: ,key, */subType: 'bind', eventName: arguments[0] });

    //                oldBind.apply(this, arguments);
    //            };
    //        }
    //    };
    //})();

    var testers = {};
    (function () {
        var eventTypes = { 'call': true, 'addServiceMember': true, 'addProxyMember': true/*, 'response': true*/ };
        /*for (var memberType in handlers) {
            for (var eventType in handlers[memberType]) {
                if (!eventTypes[eventType])
                    eventTypes[eventType] = true;
            }
        }*/
        for (var eventType in eventTypes) {
            (function() {
                var eventType2 = eventType;
                testers[eventType2] = function (service, memberMetadata, data) {
                    var memberType = data.unregisteredType || (memberMetadata && memberMetadata.type);
                    var handler = handlers[memberType];
                    var ret;
                    if (handler[data.type] && (ret = handler[data.type].apply(self, arguments)))
                        return ret;
                   
                    /*for (var memberType in handlers) {
                        if (handlers[memberType][eventType2] && handlers[memberType][eventType2].apply(handlers[memberType][eventType2], arguments))
                            return true;
                    }*/
                };
            })();
        }
        testers.getMetadata = function () {
            var ret = undefined;
            for (var type in handlers) {
                var handler = handlers[type];
                if (handler.getMetadata /*&& !testers.byPassMetadatas.apply(this, arguments)*/ && (ret = handler.getMetadata.apply(self, arguments)))
                    break;
            }
            return ret;
        };
        testers.byPassMetadatas = function () {
            var ret = undefined;
            for (var type in handlers) {
                var handler = handlers[type];
                if (handler.byPassMetadatas && (ret = handler.byPassMetadatas.apply(self, arguments)))
                    break;
            }
            return ret;
        }
    })();

    this.registerServices = function (servicesDict, options) {
        var ret = $.Deferred();
        onReady.done(function () {
            var deffereds = [];
            Object.keys(servicesDict).forEach(function (serviceName) {
                deffereds.push(registerService(serviceName, servicesDict[serviceName], options));
            });
            $.when.apply($, deffereds)
                .done(ret.resolve).fail(ret.reject).progress(ret.notify);
        });
        return ret
    };
    this.registerService = function (serviceName, serviceDict, options) {
        var ret = $.Deferred();
        onReady.done(function () {
            registerService(serviceName, serviceDict, options)
                .done(ret.resolve).fail(ret.reject).progress(ret.notify);
        });
        return ret;
    };

    this.dispose = function () {
        assets.forEach(function (a) {
            a.dispose();
        });
        assets = [];
    }

    function getMetadata(serviceName, service, key) {
        return testers.getMetadata(serviceName, service, key);
    }

    function generateGuid() {
        var S4 = function () {
            return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
        };
        return (S4() + S4() + "-" + S4() + "-" + S4() + "-" + S4() + "-" + S4() + S4() + S4());
    }

    this._assets = assets;
    this._postMessage = postMessage;
}

jQuery.fn.some = function (fn, thisArg) {
    var result;

    for (var i = 0, iLen = this.length; i < iLen; i++) {

        if (this.hasOwnProperty(i)) {

            if (typeof thisArg == 'undefined') {
                result = fn(this[i], i, this);

            } else {
                result = fn.call(thisArg, this[i], i, this);
            }

            if (result) return true;
        }
    }
    return false;
}


PartnerWinProxy.handlers = {
    'observable': new function () {
        var inTransaction;
        this.addServiceMember = function (service, memberMetadata, data) {
            var pwp = this;
            var fn = function (val) {
                if (!inTransaction || inTransaction.settingVal != val)
                    pwp._postMessage('call', { serviceName: memberMetadata.serviceName, key: data.key, value: val });
            };
            pwp._assets.push(service[data.key].subscribe(fn));
            return true;
        };
        this.addProxyMember = function (serviceMetadata, memberMetadata, proxy, k) {
            var pwp = this;
            function asyncGet() {
                return pwp._postMessage('call', { serviceName: memberMetadata.serviceName, key: k }, true);
            }
            function asyncSet(v) {
                if (!inTransaction || inTransaction.settingVal != v)
                    pwp._postMessage('call', { serviceName: memberMetadata.serviceName, key: k, value: v });
            }
            var getMethod, setMethod;
            if (serviceMetadata.cacheProperties || memberMetadata.cacheProperty) {
                proxy[k] = ko.observable(memberMetadata.initialVal);
                function fn(val) {
                    asyncSet(val);
                }
                pwp._assets.push(proxy[k].subscribe(fn));
                /*asyncGet().done(function (val) {
                    proxy[k](val);
                });*/
            }
            else {
                getMethod = asyncGet;
                setMethod = asyncSet;
                Object.defineProperty(proxy, k, {
                    get: getMethod,
                    set: setMethod
                });
            }
            return true;
        };
        this.call = function (service, memberMetadata, data) {
            var pwp = this;
            if (memberMetadata && memberMetadata.type == 'observable') {
                if ('value' in data) {
                    inTransaction = { settingVal: data.value };
                    service[data.key](data.value);
                    inTransaction = null;
                }
                else if (data.key && data.id)
                    return { returnVal: service[data.key]() }; //pwp._postMessage('response', { serviceName: memberMetadata.serviceName, key: data.key, returnVal: service[data.key], id: data.id });
                return true;
            }
        };
        //response: 'generalResponse',
        this.getMetadata = function (serviceName, service, key) {
            if (ko && ko.isObservable(service[key]))
                return { serviceName: serviceName, key: key, serviceType: 'service', type: 'observable', initialVal: service[key]() };
        };/*,
        byPassMetadatas: function (serviceName, service, key) {
            return typeof service[key] == 'function';
        }*/
    }
};

function ForeignObjectProxy() {

}