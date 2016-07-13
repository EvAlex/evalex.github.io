+function (window) {
    "use strict";

    if (typeof window.LayoutLoader !== 'undefined') {
        return;
    }

    window.LayoutLoader = LayoutLoader;

    var LayoutLoaderState = {
        idle: 0,
        loadingLayout: 1,
        loadingPartial: 2
    }

    LayoutLoader._state = LayoutLoaderState.idle;
    LayoutLoader.getState = function () { return LayoutLoader._state; };
    LayoutLoader.setState = function (value) { LayoutLoader._state = value; };
    LayoutLoader.history = [];
    function LayoutLoader() {

        this.loadLayout = loadLayout;
        this.ajaxifyNavLinks = ajaxifyNavLinks;
        this.defaultSettings = getDefaultSettings();

        /////////////////////////////////////////////////////////
        var httpBackend = new HttpBackend(),
            loadingScreen = new LoadingScreen(),
            actualSettings = null,
            self = this;

        function loadLayout(settings) {
            if (LayoutLoader.getState() !== LayoutLoaderState.idle) {
                return;
            }
            LayoutLoader.setState(LayoutLoaderState.loadingLayout);

            if (typeof settings === 'undefined') {
                settings = {};
            }

            actualSettings = mergeWithDefaultSettings(settings);
            LayoutLoader.history.push(new LayoutLoaderHistoryEntry(LayoutLoaderHistoryEntryType.loadLayout, actualSettings));
            loadingScreen.show();
            httpBackend.get(actualSettings.url, onLayoutLoaded)
        }

        function ajaxifyNavLinks() {
            window.onpopstate = function (e) {
                loadPartial(window.location);
            };
            Array.prototype.slice.call(document.getElementsByTagName('a'))
                .filter(function (a) { return urlIsWithinCurrentOrigin(a.href) })
                .forEach(function (a) { a.addEventListener('click', onNavLinkClicked) });
        }

        /**
         * @param {MouseEvent} e
         */
        function onNavLinkClicked(e) {
            history.pushState({}, '', e.currentTarget.href);
            loadPartial(e.currentTarget.href);
            e.preventDefault();
            return false;
        }

        function loadPartial(url) {
            if (LayoutLoader.getState() !== LayoutLoaderState.idle) {
                return;
            }
            LayoutLoader.setState(LayoutLoaderState.loadingPartial);
            LayoutLoader.history.push(new LayoutLoaderHistoryEntry(LayoutLoaderHistoryEntryType.loadPartial, { url: url }));
            httpBackend.get(url, onPartialLoaded);
        }

        function urlIsWithinCurrentOrigin(url) {
            return url.indexOf(window.location.origin) === 0 &&
                (url !== window.location.href) &&
                (url !== window.location.href + '#')
                ||
                url.indexOf('/') === 0 && url.indexOf('//') !== 0 &&
                url.length > 0 && url.indexOf('/') !== 1 &&
                url.indexOf('http') !== 0 &&
                (url !== window.location.href) &&
                (url !== window.location.href + '#');
        }

        function onLayoutLoaded(err, layoutHtml) {
            if (err) {
                return console.error('Failed to load layout.', err);
            }

            var layout = new HtmlDocument(layoutHtml),
                partial = new HtmlDocument(document.documentElement);
            mergeDocuments(partial, layout);
            performCompleteCallbacks();
            /* TODO
            ajaxifyNavLinks();
            */

            waitPageReady(actualSettings.loadingScreen.pageLoadTimeout, function () {
                //loadingScreen.hide(0, actualSettings.loadingScreen.fadeOutDelay);
                LayoutLoader.setState(LayoutLoaderState.idle);
            });
        }

        function waitPageReady(timeout, cb) {
            var done = false,
                fn = function () {
                    if (!done && typeof cb === 'function') {
                        done = true;
                        cb();
                    }
                };
            window.setTimeout(fn, timeout);
            document.addEventListener('readystatechange', function () {
                if (document.readyState === 'complete') {
                    fn();
                }
            });
        }

        /**
         * @param {String} partialHtml
         */
        function onPartialLoaded(err, partialHtml) {
            if (err) {
                return console.error('Failed to load partial.', err);
            }

            var layout = new HtmlDocument(document.documentElement),
                partial = new HtmlDocument(partialHtml);

            mergeDocumentsSection(
                partial.html.getElementsByTagName('head')[0],
                layout.html.getElementsByTagName('head')[0],
                MergeStrategy.srcWins);

            var tempNode = document.createElement('div');
            tempNode.style.display = 'none';
            document.body.appendChild(tempNode);
            moveScriptTags(partial.html, tempNode, function () {
                onPartialReady(partial);
            });
        }

        /**
         * @param {HtmlDocument} partial
         */
        function onPartialReady(partial) {
            var e = LayoutLoader.history[LayoutLoader.history.length - 1],
                loadLayoutSettings = self.defaultSettings;
            if (e.type === LayoutLoaderHistoryEntryType.loadLayout) {
                loadLayoutSettings = e.settings;
            }

            var layout = new HtmlDocument(document.documentElement);
            for (var i = 0; i < loadLayoutSettings.insertSections.length; i++) {
                var s = loadLayoutSettings.insertSections[i],
                    layoutSection = layout.querySelector(s.layout),
                    partialSection = partial.querySelector(s.partial),
                    exclude = Array.prototype.slice.call(partialSection.getElementsByTagName('script'))
                        .concat([loadingScreen.getElement()]);
                removeAllChildren(layoutSection);
                moveAllChildren(partialSection, layoutSection, exclude);
            }

            waitPageReady(loadLayoutSettings.loadingScreen.pageLoadTimeout, function () {
                LayoutLoader.setState(LayoutLoaderState.idle);
            });
        }

        function mergeDocuments(partial, layout) {
            for (var i = 0; i < actualSettings.mergeSections.length; i++) {
                var s = actualSettings.mergeSections[i];
                mergeDocumentsSection(
                    layout.querySelector(s.layout),
                    partial.querySelector(s.partial),
                    MergeStrategy.destWins);
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
            moveScriptTags(layoutBody, partialBody);
            moveAllChildren(layoutBody, partialBody);
        }

        function performCompleteCallbacks() {
            for (var i = 0; i < actualSettings.callbacks.complete.length; i++) {
                actualSettings.callbacks.complete[i]();
            }
        }

        /**
         * @param {HTMLElement} src
         * @param {HTMLElement} dest
         * @param {Number} strategy
         */
        function mergeDocumentsSection(src, dest, strategy) {
            var srcLen = src.childNodes.length;
            for (var i = 0; i < src.childNodes.length; i++) {
                var srcNode = src.childNodes.item(i),
                    match = null;
                for (var j = 0; j < dest.childNodes.length && match === null; j++) {
                    var destNode = dest.childNodes.item(j);
                    if (elementsAreSame(destNode, srcNode)) {
                        match = destNode;
                    }
                }
                if (match === null) {
                    dest.appendChild(srcNode);
                } else if (strategy === MergeStrategy.srcWins) {
                    dest.replaceChild(srcNode, match);
                }
                if (src.childNodes.length < srcLen) {
                    srcLen--;
                    i--;
                }
            }
        }
        var MergeStrategy = {
            srcWins: 0,
            destWins: 1
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
         * @param {Function} cb
         */
        function moveAllChildren(src, dest, excludeNodes, cb) {
            if (typeof excludeNodes === 'undefined') {
                excludeNodes = [];
            }
            var index = 0,
                scriptsToMove = [];
            while (src.childNodes[index]) {
                var match = false,
                    cur = src.childNodes[index];
                for (var i = 0; i < excludeNodes.length && !match; i++) {
                    if (excludeNodes[i] === cur) {
                        match = true;
                    }
                }

                if (match) {
                    index++;
                } else {
                    if (cur.nodeName.toLowerCase() === 'script') {
                        scriptsToMove.push(document.importNode(cur));
                        if (!cur.src && cur.innerText.length > 0) {
                            scriptsToMove[scriptsToMove.length - 1].innerText = cur.innerText;
                        }
                        index++;
                    } else {
                        dest.appendChild(cur);
                    }
                }
            }

            //moveScriptTags(src, dest, cb);
        }

        /**
         * @param {Node} src
         * @param {Node} dest
         * @param {Function} cb
         */
        function moveScriptTags(src, dest, cb) {
            var scriptsToMove = [],
                scriptsInSrc = src.getElementsByTagName('script');
            for (var i = 0; i < scriptsInSrc.length; i++) {
                var cur = scriptsInSrc[i];

                scriptsToMove.push(document.importNode(cur));
                if (isInlineScript(cur)) {
                    scriptsToMove[scriptsToMove.length - 1].appendChild(
                        document.importNode(cur.firstChild));
                }
            }

            var moveScripts = function (scripts) {
                if (scripts.length === 0) {
                    if (typeof cb === 'function') {
                        cb();
                    }
                    return;
                }
                var script = scripts.shift();
                if (isInlineScript(script)) {
                    dest.appendChild(script);
                    moveScripts(scripts);
                } else {
                    script.addEventListener('load', function (e) {
                        console.log('Script loaded:', e.currentTarget.src);
                        moveScripts(scripts);
                    });
                    dest.appendChild(script);
                }
            }
            moveScripts(scriptsToMove);
        }

        /**
         * @param {HTMLScriptElement} scriptElement
         * @returns {Boolean}
         */
        function isInlineScript(scriptElement) {
            return !scriptElement.src && scriptElement.firstChild instanceof Text;
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

    /**
     * @type LayoutLoaderHistoryEntryType
     */
    var LayoutLoaderHistoryEntryType = {
        loadLayout: 0,
        loadPartial: 1
    };

    /**
     * @class
     * @param {Number} type History entry type. See LayoutLoaderHistoryEntryType
     * @param {{}} settings Actual setting of the call
     */
    function LayoutLoaderHistoryEntry(type, settings) {
        this.type = type;
        this.settings = settings;
    }

    function HtmlDocument(htmlStringOrElement) {
        var html = typeof htmlStringOrElement === 'string'
            ? createHtmlElement(htmlStringOrElement)
            : htmlStringOrElement;

        this.html = html;
        this.querySelector = querySelector;

        //////////////////////////////////////////////////////////

        function querySelector(selector) {
            return html.querySelector(selector);
        }

        function createHtmlElement(htmlString) {
            var element;
            if (/^(\s*<!doctype)|(<html)/i.test(htmlString)) {
                element = getElement(htmlStringOrElement, 'html');
            } else {
                element = document.createElement('html');
                element.appendChild(document.createElement('head'));
                element.appendChild(document.createElement('body'))
                    .innerHTML = htmlString;
            }
            return element;
        }

        function getElement(htmlString, name) {
            var tag = document.createElement(name);
            tag.innerHTML = findFirstTagContent(name, htmlString);
            return tag;
        }

        function findFirstTagContent(tag, str) {
            if (str.indexOf('<' + tag) === -1) {
                return null;
            }

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