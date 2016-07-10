+function (window) {
    "use strict";

    window.LayoutLoader = LayoutLoader;

    function LayoutLoader() {

        this.loadLayout = loadLayout;
        this.defaultSettings = getDefaultSettings();

        /////////////////////////////////////////////////////////
        var httpBackend = new HttpBackend(),
            loadingScreen = new LoadingScreen(),
            actualSettings = null,
            self = this;

        function loadLayout(settings) {
            if (typeof settings === 'undefined') {
                settings = {};
            }
            actualSettings = mergeWithDefaultSettings(settings);
            loadingScreen.show();
            httpBackend.get(actualSettings.url, onLayoutLoaded)
        }

        function onLayoutLoaded(err, layoutHtml) {
            if (err) {
                return console.error('Failed to load layout.', err);
            }

            var layout = new HtmlDocument(layoutHtml),
                partial = new HtmlDocument(document.documentElement);
            mergeDocuments(partial, layout);
            performCompleteCallbacks();

            window.setTimeout(function () {
                loadingScreen.hide(0, actualSettings.loadingScreen.fadeOutDelay);
            }, actualSettings.loadingScreen.pageLoadTimeout);
            document.addEventListener('readystatechange', function () {
                if (document.readyState === 'complete') {
                    loadingScreen.hide(0, actualSettings.loadingScreen.fadeOutDelay);                
                }
            });
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
                    layoutSection = layout.querySelector(s.layout),
                    partialSection = partial.querySelector(s.partial),
                    exclude = Array.prototype.slice.call(partialSection.getElementsByTagName('script'))
                        .concat([loadingScreen.getElement()]);
                removeAllChildren(layoutSection);
                moveAllChildren(partialSection, layoutSection, exclude);    
            }
            var layoutBody = layout.querySelector('body'),
                partialBody = partial.querySelector('body');
            moveAllChildren(layoutBody, partialBody);    
        }

        function performCompleteCallbacks() {
            for (var i = 0; i < actualSettings.callbacks.complete.length; i++) {
                actualSettings.callbacks.complete[i]();
            }
        }

        /**
         * @param {HTMLElement} elementInPartial
         * @param {HTMLElement} elementInLayout
         */
        function mergeDocumentsSection(elementInPartial, elementInLayout) {
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

        function activateNavLinks() {
            var anchors = document.getElementsByTagName('a'),
                currentHref = ensureEndsWith(window.location.href, '/'),
                currentPath = ensureEndsWith(window.location.pathname, '/');
            for (var i = 0; i < anchors.length; i++) {
                var a = anchors.item(i),
                    href = ensureEndsWith(a.href, '/');
                if (href === currentHref || href === currentPath) {
                    a.classList.add('active');
                    if (a.parentElement.nodeName.toLowerCase() === 'li') {
                        a.parentElement.classList.add('active');
                    }
                } else {
                    a.classList.remove('active');
                    if (a.parentElement.nodeName.toLowerCase() === 'li') {
                        a.parentElement.classList.remove('active');
                    }             
                }
            }
        }

        function ensureEndsWith(str, trailingStr) {
            if (str.substring(str.length - trailingStr.length) !== trailingStr) {
                str += trailingStr;
            }
            return str;
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
                ],
                callbacks: {
                    complete: [
                        activateNavLinks
                    ]
                },
                loadingScreen: {
                    pageLoadTimeout: 1500,
                    fadeOutDelay: 500
                }
            }
        }

        /**
         * Removes all child nodes from specified node
         * @param {Node} node
         */
        function removeAllChildren(node) {
            while (node.firstChild) {
                node.removeChild(node.firstChild);
            }    
        }

        /**
         * Moves all child nodes from src node to dest node
         * @param {Node} src
         * @param {Node} dest
         * @param {Node[]} excludeNodes
         */
        function moveAllChildren(src, dest, excludeNodes) {
            if (typeof excludeNodes === 'undefined') {
                excludeNodes = [];
            }
            var index = 0;
            while (src.childNodes[index]) {
                var match = false;
                for (var i = 0; i < excludeNodes.length && !match; i++) {
                    if (excludeNodes[i] === src.childNodes[index]) {
                        match = true;
                    }
                }

                if (match) {
                    index++;
                } else {
                    dest.appendChild(src.childNodes[index]);
                }
            }
        }

        function copy(obj, dest) {
            if (['number', 'string', 'function', 'undefined'].indexOf(typeof obj) !== -1 || obj === null) {
                return obj;
            }
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

    /**
     * @class 
     *  Represents loading screen that is displayed while page is loading.
     *  LayoutLoader inserts layout, that can contain styles and/or sripts
     *  that affect visual representation. This creates bad user experience
     *  and LoadingScreen should provide solution for this problem.
     * 
     *  The styles are taken from https://github.com/tobiasahlin/SpinKit
     */
    function LoadingScreen() {
        var element = null,
            shown = false,
            self = this;

        this.show = show;
        this.hide = hide;
        this.getElement = getElement;
        this.isShown = isShown;

        ///////////////////////////////

        function show() {
            if (shown === true) {
                return;
            }
            shown = true;

            element = createLoadingScreenElement();
            document.body.appendChild(element);
        }

        function hide(delay, fadeOutDelay) {
            if (shown === false) {
                return;
            }
            shown = false;

            window.setTimeout(function () {
                element.style.transition = 'opacity ' + (fadeOutDelay / 1000) + 's linear';
                element.style.opacity = 0;
                window.setTimeout(function () {
                    document.body.removeChild(element);
                    element = null;
                }, fadeOutDelay);            
            }, delay);
        }

        /**
         * Creates HTMLElement being the visual representation of LoadingScreen.
         * Created element is not yet attached to current document.
         * @returns {HTMLElement}
         */
        function createLoadingScreenElement() {
            var element = createElement('div', 'loading-screen');
            element
                .appendChild(createElement('div', 'ls_inner'))
                    .appendChild(createElement('div', 'ls_spinner-wrap'))
                        .appendChild(createElement('div', 'sk-folding-cube'))
                            .appendChild(createElement('div', 'sk-cube1 sk-cube')).parentElement
                            .appendChild(createElement('div', 'sk-cube2 sk-cube')).parentElement
                            .appendChild(createElement('div', 'sk-cube4 sk-cube')).parentElement
                            .appendChild(createElement('div', 'sk-cube3 sk-cube'));
            return element;
        }

        function getElement() {
            return element;
        }

        function isShown() {
            return shown;
        }

        /**
         * Creates HTMLElement with specified tagName and cssClass
         * @param {String} tagName
         * @param {String} cssClass
         * @returns {HTMLElement}
         */
        function createElement(tagName, cssClass) {
            var e = document.createElement(tagName);
            e.className = cssClass;
            return e;
        }
    }

}(window);