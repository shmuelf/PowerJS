(function() {
    var jspower = window.jspower = window.jspower || {};
    if (jspower.injector) return;
    jspower.injector = {fetchSync,SyncPromise};

    jspower.injector.importSync = url => fetchSync(url)
        //.then(response => response.text())
        .then(text => eval(text),/*)
        .catch(*/r => console.error(r)); 

    function fetchSync(url) {
        return new SyncPromise((res,rej)=>{
            let resp;
            var oReq = new XMLHttpRequest();
            //oReq.addEventListener("load", e => res(oReq.responseText));
            oReq.addEventListener("error", e => rej(oReq.responseText));
            oReq.open("GET", url, false);
            oReq.send();
            if (oReq.responseText)
                res(oReq.responseText);
        });
    }
    function SyncPromise(f) {
        let that = this;
        let _cb;
        let _rejcb;
        let resolved;
        let rejected;
        this.then = function(cb,rejcb) {
            _cb = cb;
            _rejcb = rejcb;
            if (resolved !== null && resolved != undefined)
                return Promise.resolve(_cb(resolved)||resolved);
            else if (rejected !== null && rejected != undefined)
                return Promise.reject(_rejcb(rejected)||rejected);
            else
                return Promise.resolve(that);
        };
        let res = (v) => {
            if ((resolved !== null && resolved != undefined) || (rejected !== null && rejected != undefined)) return;
            resolved = v !== null && v != undefined ? v : true;
            if (_cb) _cb(v);
        };
        let rej = (v) => {
            if ((resolved !== null && resolved != undefined) || (rejected !== null && rejected != undefined)) return;
            rejected = v !== null && v != undefined ? v : true;
            if (_rejcb) _rejcb(v);
        };
        /*let ret = */
        f(res, rej);
        return that;
    }

    jspower.injector.importCors = url => fetch(url)
        .then(response => response.text())
        .then(text => eval(text))
        .catch(r => console.error(r));

    //"<meta http-equiv=\"Content-Security-Policy\" content=\"default-src *; style-src 'self' http://* 'unsafe-inline'; script-src 'self' http://* 'unsafe-inline' 'unsafe-eval'\" />"
    /*(function(e, s) {
        e.src = s;
        e.onload = function() {
            window.$$3 = jQuery.noConflict();
            console.log('jQuery injected');
        };
        document.head.appendChild(e);
    })(document.createElement('script'), );*/

    window.imports = jspower.injector.importSync;
    //imports('https://raw.githubusercontent.com/shmuelf/PowerJS/master/src/power-scrapping.js');
    //imports(jqueryPath).then(() => window.$$3 = jQuery.noConflict());
    //imports(lodashUrl);
})();