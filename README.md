# PowerJS
A focus on core javascript features

examples for using power.js along:
```javascript
var obj = {
  prop1: 1
};
jspower.waitObjectProp(obj, 'service', function(e, svc) { 
  alert('my service is ready'); 
  svc.work(); 
});

setTimeout(function() {
  obj.service = new function() { 
    this.work = function() {
      alert('the service is running');
    }
  }; // two alerts should pop-up in this line
}

$(obj).watch('prop1', function(e, propName, oldVal, newVal) { 
  alert('property'+propName+' has changed from ' + oldVal + ' to ' + newVal); 
});
obj.prop1 = 2; // an alert should pop-up
```
