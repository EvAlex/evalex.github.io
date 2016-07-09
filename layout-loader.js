

function LayoutLoader() {
    var httpBackend = new HttpBackend();

    this.loadLayout = loadLayout;
    this.defaultSettings = getDefaultSettings();

    function loadLayout(settings) {
        
    }

    function getJson(url) {
        
    }

    function getDefaultSettings() {
        return {
            url: '/',
            mergeSections: [
                {
                    src: 'head',
                    dest: 'head'
                },
                {
                    src: 'body',
                    dest: '#partial-content'
                }
            ]
        }
    }
}

function HttpBackend() {
    
    generateMethods();

    //////////////////////////////////////////////////////////

    function generateMethods() {
        var methods = ['GET', 'PUT', 'POST', 'DELETE'],
            converters = [{ name: '', fn: returnAsIs }, { name: 'Json', fn: stringToJson }];

        for (var i = 0; i < methods.length; i++) {
            for (var j = 0; j < converters.length; j++) {
                var methodName = methods[i].toLowerCase() + converters[j].name,
                    context = { method: methods[i], dataConverterFn: converters[j].fn };
                this[methodName] = (function (url, data, cb) {
                    if (typeof cb === 'undefined' && typeof data === 'function') {
                        cb = data;
                        data = null;
                    }
                    return performRequest(url, this.method, data, this.dataConverterFn, cb);
                }).bind(context);
            }
        }
    }

    function performRequest(url, method, data, dataConverterFn, cb) {
        var xhr = new XMLHttpRequest();
        xhr.addEventListener('readystatechange', function (e) {
            if (xhr.readyState === 4) {
                var err = xhr.status >= 200 && xhr.status < 300
                        ? null
                        : { status: xhr.status },
                    data = err === null
                        ? null
                        : dataConverterFn(xhr.responseText);
                cb(err, data);
            }
        })
        xhr.open(method, url);
        if (data) {
            xhr.send(data);
        }
    }

    function returnAsIs(data) {
        return data;
    }

    function stringToJson(data) {
        return JSON.parse(data);
    }
}