

function LayoutLoader() {
    var httpBackend = new HttpBackend(),
        self = this;

    this.loadLayout = loadLayout;
    this.defaultSettings = getDefaultSettings();

    function loadLayout(settings) {
        settings = mergeWithDefaultSettings(settings);
        httpBackend.get(settings.url, onLayoutLoaded)
    }

    function onLayoutLoaded(err, layout) {
        if (err) {
            return console.error('Failed to load layout.', err);
        }
        debugger;
        var doc = new HtmlDocument(layout);
        document.open();
        document.write(layout);
        document.close();
    }

    function mergeWithDefaultSettings(settings) {
        var defaultSettings = copy(self.defaultSettings);
        return copy(settings, defaultSettings);
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

    function copy(obj, dest) {
        if (typeof dest !== 'object') {
            dest = {};
        }
        for (var key in obj) {
            if (obj.hasOwnProperty(key)) {
                var element = obj[key];
                if (Array.isArray(element)) {
                    dest[key] = [];
                    for (var i = 0; i < element.length; i++) {
                        dest[key].push(copy(element[i]));
                    }
                } else if (typeof element === 'object') {
                    dest[key] = copy(element);
                } else {
                    dest[key] = element;
                }
            }
        }
        return dest;
    }
}

function HtmlDocument(htmlString) {
    this.html = getElement(htmlString, 'html');

    //////////////////////////////////////////////////////////

    function getElement(htmlString, name) {
        var tag = document.createElement(name);
        tag.innerHTML = findFirstTagContent(name, htmlString);
        return tag;      
    }

    function findFirstTagContent(tag, str) {
        var startI = str.indexOf('<' + tag) + 1 + tag.length,
            endI = str.indexOf('</' + tag + '>'),
            i,
            j;
        str = str.substring(startI, endI);
        while (
            (i = str.indexOf('>')) > (j = str.indexOf('="')) && j > 0
        ) {
            str = str.substring(j + 2);
            str = str.substring(str.indexOf('"') + 1);
        }
        str = str.replace(/^\s*>/, '');

        return str;
    }
}

function HttpBackend() {
    
    generateMethods(this);

    //////////////////////////////////////////////////////////

    function generateMethods(target) {
        var methods = ['GET', 'PUT', 'POST', 'DELETE'],
            converters = [{ name: '', fn: returnAsIs }, { name: 'Json', fn: stringToJson }];

        for (var i = 0; i < methods.length; i++) {
            for (var j = 0; j < converters.length; j++) {
                var methodName = methods[i].toLowerCase() + converters[j].name,
                    context = { method: methods[i], dataConverterFn: converters[j].fn };
                target[methodName] = (function (url, data, cb) {
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
                        ? dataConverterFn(xhr.responseText)
                        : null;
                cb(err, data);
            }
        })
        xhr.open(method, url);
        xhr.send(data);
    }

    function returnAsIs(data) {
        return data;
    }

    function stringToJson(data) {
        return JSON.parse(data);
    }
}