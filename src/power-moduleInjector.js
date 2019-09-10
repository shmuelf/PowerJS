// ---------------- jspower module-injector ------------------ \\
/*
 * fetchSync,SyncPromise
 *
 * 2019-09-06
 *
 * By Shmuel Friedman
 * https://github.com/shmuelf/PowerJS
 * Public Domain.
 * NO WARRANTY EXPRESSED OR IMPLIED. USE AT YOUR OWN RISK.
 */
(function() {
    var jspower = window.jspower = window.jspower || {};
    if (jspower.injector) return;
    jspower.injector = {fetchSync,SyncPromise};

    jspower.injector.importSync = url => fetchSync(url)
        .then(text => eval(text), r => console.error(r)); 

    let fetchedUrls = {};
    function fetchSync(url) {
        return fetchedUrls[url] || 
            (   fetchedUrls[url] = new SyncPromise((res,rej)=>{
                    let resp;
                    var oReq = new XMLHttpRequest();
                    //oReq.addEventListener("load", e => res(oReq.responseText));
                    oReq.addEventListener("error", e => rej(oReq.responseText));
                    oReq.open("GET", url, false);
                    oReq.send();
                    if (oReq.responseText)
                        res(oReq.responseText);
                })
            );
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

    window.imports = jspower.injector.importSync;
    //imports('https://raw.githubusercontent.com/shmuelf/PowerJS/master/src/power-scrapping.js');
    //imports('http://code.jquery.com/jquery-latest.min.js').then(() => window.$$3 = jQuery.noConflict());
    //imports('https://cdn.jsdelivr.net/npm/lodash@4.17.15/lodash.min.js');

    //following one's from Maciej Bukowski at https://stackoverflow.com/a/38700405/6553339
    jspower.injector.importCors = url => fetch(url)
        .then(response => response.text())
        .then(text => eval(text))
        .catch(r => console.error(r));
})();