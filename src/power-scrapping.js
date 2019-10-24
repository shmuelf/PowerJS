// ---------------- jspower scrapper ------------------ \\
/*
 * waitForDomQuery, popNav, taskDelay
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
    if (jspower.scrapper) return;
    jspower.scrapper = {};

    let $_$ = document.querySelectorAll.bind(document);
    let $_1 = document.querySelector.bind(document);

    Object.assign(jspower.scrapper, {docReady, waitForDomQuery, popNav});
    Object.assign(window, {$_$,$_1});
    
    jspower.scrapper.searchInDom = (phrase) => {
        const words = phrase.split(' ');
        let query = words.map(w => `span.node_text:contains(${w})`).join(',');
        return $_$(query); //$$3
    };
    
    function docReady(doc) {
      if (!doc) doc = document;
      return new Promise((res,rej) => {
          if (doc.readyState === "complete")
            res();
          else {
            let _res = (e)=> {
                doc.removeEventListener('DOMContentLoaded', _res);
                res(e);
            };
            doc.addEventListener('DOMContentLoaded', _res, false);
          }
      });
    }
    
    async function waitForDomQuery(qry, doc, win, waitForJquery) {
      if (!doc) doc = document;
      if (!win) win = window;
      let $_1;
      if (waitForJquery && jspower.waitObjectProp)
        $_1 = await new Promise((res,rej)=>{
            try {
                jspower.waitObjectProp(win, '$', res);
            }
            catch(ex) { rej(ex); }
        });
      else
        $_1 = (win.$ && win.$.bind(win)) || doc.querySelector.bind(doc);
      let elem = $_1(qry);
      if (elem)
          return elem;
      else {
          await taskDelay(10);
          return await waitForDomQuery(qry);
      }
    }
    
    let win;
    async function popNav(url, domQuery, waitForJquery) {
        if (!win)
            win = launch(url);
        else
            win.location.href = url;
        await taskDelay(10);
        await docReady(win.document);
        if (domQuery) 
            return [
                win, 
                await waitForDomQuery(domQuery, win.document, win, waitForJquery)
            ];
        return win;
    }
    async function taskDelay(millis) {
        await new Promise((rslv,rjct) => {
            setTimeout(rslv, millis);
        });
    }
    function launch(url) {
      var win = window.open(url, '_blank');
      //win.focus();
      return win;
    }

    // var jqueryPath = 'http://code.jquery.com/jquery-latest.min.js';
    // var lodashUrl = 'https://cdn.jsdelivr.net/npm/lodash@4.17.15/lodash.min.js';
    //jspower.injector.importSync(jqueryPath).then(() => jspower.injector.$$3 = jQuery.noConflict());
    //jspower.injector.importSync(lodashUrl);
})();