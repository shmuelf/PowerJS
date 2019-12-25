function arr2csv(arr) {
    var keys=Object.keys(arr[0]); 
    return keys
        .concat(arr
            .map(e => keys
                .map(k => e[k].toString().includes(',') 
                        ? `"${e[k].replace('"','\"')}"` 
                        : e[k])
                .join(','))
            .join('\r\n'));
}

Date.prototype.add = function(type, value) {
	var date = new Date(this.getTime());
	type=`${type[0].toUpperCase()}${type.substr(1)}`
	date[`set${type}`](date[`get${type}`]()+value);
	return date;
};