

function LayoutLoader() {
    var httpBackend = new HttpBackend(),
        actualSettings = null,
        self = this;

    this.loadLayout = loadLayout;
    this.defaultSettings = getDefaultSettings();

    function loadLayout(settings) {
        actualSettings = mergeWithDefaultSettings(settings);
        httpBackend.get(actualSettings.url, onLayoutLoaded)
    }

    function onLayoutLoaded(err, layoutHtml) {
        if (err) {
            return console.error('Failed to load layout.', err);
        }
        var layout = new HtmlDocument(layoutHtml),
            partial = new HtmlDocument(document.documentElement);
        mergeDocuments(partial, layout);
    }

    function mergeDocuments(partial, layout) {
        for (var i = 0; i < actualSettings.mergeSections.length; i++) {
            var s = actualSettings.mergeSections[i];
            mergeDocumentsSection(
                partial.querySelector(s.partial),
                layout.querySelector(s.layout));
        }
        for (var i = 0; i < actualSettings.insertSections.length; i++) {
            var s = actualSettings.insertSections[i],
                layoutBody = layout.querySelector('body'),
                partialBody = partial.querySelector('body'),
                layoutSection = layout.querySelector(s.layout),
                partialSection = partial.querySelector(s.partial);
            while (layoutSection.firstChild) {
                layoutSection.removeChild(layoutSection.firstChild);
            }
            while (partialSection.firstChild) {
                layoutSection.appendChild(partialSection.firstChild);
            }
            while (layoutBody.firstChild) {
                partialBody.appendChild(layoutBody.firstChild);
            }            
        }
    }

    /**
     * @param {HTMLElement} elementInPartial
     * @param {HTMLElement} elementInLayout
     */
    function mergeDocumentsSection(elementInPartial, elementInLayout) {
        /*
        for (var j = 0; j < elementInPartial.childNodes.length; j++) {
            var np = elementInPartial.childNodes.item(j),                
                match = null
            for (var i = 0; i < elementInLayout.childNodes.length && match === null; i++) {
                var nl = elementInLayout.childNodes.item(i);
                if (elementsAreSame(np, nl)) {
                    match = nl;
                }
            }
            if (match === null) {
                elementInLayout.appendChild(np);
            }
        }
        */
        for (var i = 0; i < elementInLayout.childNodes.length; i++) {
            var nl = elementInLayout.childNodes.item(i),
                match = null;
            for (var j = 0; j < elementInPartial.childNodes.length && match === null; j++) {
                var np = elementInPartial.childNodes.item(j);
                if (elementsAreSame(np, nl)) {
                    match = np;
                }
            }
            if (match === null) {
                elementInPartial.appendChild(nl);
            }
        }
    }

    /**
     * @param {HTMLElement} e1
     * @param {HTMLElement} e2
     */
    function elementsAreSame(e1, e2) {
        var res = true;
        res = res && e1.nodeName === e2.nodeName;
        res = res && (!e1.hasAttribute && !e2.hasAttribute || !e1.hasAttribute('id') && !e2.hasAttribute('id') || e1.id === e2.id);
        if (e1.nodeName.toLowerCase() === 'meta' && e1.nodeName === e2.nodeName) {
            res = res && (!e1.hasAttribute && !e2.hasAttribute || !e1.hasAttribute('charset') && !e2.hasAttribute('charset') || e1.charset === e2.charset)
            res = res && (!e1.hasAttribute && !e2.hasAttribute || !e1.hasAttribute('name') && !e2.hasAttribute('name') || e1.name === e2.name)
        }
        if (e1.nodeName.toLowerCase() === 'script' && e1.nodeName === e2.nodeName) {
            res = res && (!e1.hasAttribute && !e2.hasAttribute || !e1.hasAttribute('src') && !e2.hasAttribute('src') || e1.src === e2.src)
        }
        if (e1.nodeName.toLowerCase() === 'link' && e1.nodeName === e2.nodeName) {
            res = res && (!e1.hasAttribute && !e2.hasAttribute || !e1.hasAttribute('href') && !e2.hasAttribute('href') || e1.href === e2.href)
        }
        return res;
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
                    partial: 'head',
                    layout: 'head'
                }
            ],
            insertSections: [
                {
                    partial: 'body',
                    layout: '#partial-content'
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
    var html = typeof htmlString === 'string'
        ? getElement(htmlString, 'html')
        : htmlString;

    this.querySelector = querySelector;

    //////////////////////////////////////////////////////////

    function querySelector(selector) {
        return html.querySelector(selector);
    }

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