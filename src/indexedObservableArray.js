// ---------------- power-js indexed-observable-array ------------------ \\
/*
 * 2013
 *
 * By Shmuel Friedman
 * https://github.com/shmuelf/PowerJS
 * NO WARRANTY EXPRESSED OR IMPLIED. USE AT YOUR OWN RISK.
 */
function indexedObservableArray(arr, indices) {
    var array = arr && ko.isObservable(arr) ? arr : arr ? ko.observableArray(arr) : ko.observableArray(arr = []);

    var _indices = {};

    array.index = function (propName) {
        if (!_indices[propName])
            _indices[propName] = new ArrayIndex(array, propName);
        return _indices[propName];
    };

    array.getBy = function (propName, value) {
        return array.index(propName).get(value);
    }

    array.removeBy = function (propName, value) {
        var index = _indices[propName];
        var idx;
        if (index) 
            idx = index.getIndex(value);
        if (!index || idx == null) {
            var arr = array();
            for (var i = 0; i < arr.length; i++)
                if (arr[i][propName] == value)
                    idx = i;
        }

        if (idx != null)
            return array.splice(idx, 1);

    };

    var oldDispose = array.dispose;
    array.dispose = function () {
        for (var idx in _indices) {
            _indices[idx].dispose();
            delete _indices[idx];
        }
        oldDispose.apply(array, arguments);
    };

    function ArrayIndex(array, propName) {
        var index = {};
        var reverseIdx = [];
        var arr = array();
        for (var i = 0; i < arr.length; i++) {
            var key = arr[i].value[propName];
            index[key] = i;
            reverseIdx[i] = key;
        }
        var arrChanges = array.subscribe(function (changes) {
            var diffIndex = 0;
            changes.forEach(function (change) {
                if (change.status == 'added') {
                    var idx = change.index;// + diffIndex++;
                    for (var i = reverseIdx.length - 1; i >= idx; i--) {
                        var key = reverseIdx[i];
                        index[key] = i + 1;
                        reverseIdx[i + 1] = key;
                    }
                    if (index[change.value[propName]]) // TODO: need to handle duplicate propName
                        console.warn('duplicate id inserted for index ' + propName + ', id:' + change.value[propName] + ', array position ' + index[change.value[propName]] + ' replaced by ' + change.index)
                    index[change.value[propName]] = change.index;
                    reverseIdx[change.index] = change.value[propName];
                }
                else {// if (change.status == 'deleted') {
                    var idx = change.index + diffIndex--;
                    delete index[reverseIdx[idx]];
                    for (var i = idx + 1; i < reverseIdx.length; i++) {
                        index[reverseIdx[i]] = i - 1;
                        //reverseIdx[i + 1] = reverseIdx[i];
                    }
                    reverseIdx.splice(idx, 1);
                }
            });
        }, null, "arrayChange");

        this.get = function (key) {
            return array()[index[key]];
        };

        this.getIndex = function (key) {
            return index[key];
        };

        this.clear = function () {
            arrChanges.dispose();
            index = null;
            reverseIdx = null;
        };

        this.updateId = function (oldId, newId) {
            var pos = index[oldId];
            delete index[oldId];
            index[newId] = pos;
            reverseIdx[pos] = newId;
            if (array()[pos][propName] != newId)
                array()[pos][propName] = newId;
        }
    }

    if (indices)
        indices.forEach(function (idx) { array.index(idx); });

    return array;
}