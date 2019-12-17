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