/**
 * Copyright (c) 2013 Zhen, LLC. http://zhen.io
 *
 * MIT License
 *
 */

'use strict';

var app = angular.module("angular-pages", []);

app.directive("znPagesPage", ['znPageManager', 'Commons', function (znPageManager, Commons) {

    function process() {
        var scope, element, attrs, phase;

        if (arguments.length === 3) {
            scope = arguments[0];
            element = arguments[1];
            attrs = arguments[2];
            phase = "link";
        } else {
            element = arguments[0];
            attrs = arguments[1];
            phase = "compile";
        }

        var id = attrs.id || undefined,
            containerId = attrs.znPagesContainerId || undefined,
            collectionId = attrs.znPagesCollectionId || undefined,
            isNgInclude = typeof attrs.ngInclude !== 'undefined';

        if (containerId === undefined || collectionId === undefined) return;

        var container = znPageManager.container(containerId),
            collection = container.collection(collectionId),
            page;

        if (container === undefined || collection === undefined) return;

        // If ID exist then it means we've compiled before, which means we have created the page object
        // for this already. So no ID, create new page; if ID, get existing page.
        if (id) {
            page = collection.page(id);
        } else {
            page = collection.newPage();
            id = page.getId();
        }

        if (page.isReady()) return page;

        page.attr({
            "compiles": page.attr("compiles") + 1,
            "isNgInclude": isNgInclude,
            "parent": collection
        });

        element.attr('id', id);
        attrs['id'] = id;

        return page;
    }

    function finalize(scope, element, attrs) {
        var page = scope.page,
            pageId = page.getId(),
            width = element[0].offsetWidth,
            height = element[0].offsetHeight;

        if (page.isReady()) return;

        page.attr({
            "width": width,
            "height": height,
            "ready": true
        });

        scope.$emit("znPagesPageReady", {
            id: pageId
        });
    }

    return {
        restrict: "A",
        scope: true,
        compile: function (element, attrs) {
            var tagName = element[0].tagName.toLowerCase();
            if (tagName !== "li") {
                Commons.log(1, "LI, not " + tagName + ", must be used for collections.");
                return;
            }

            var page = process(element, attrs),
                pageId = page.getId();

            return function (scope, element, attrs) {
                if (!page.isReady()) {
                    scope.page = page;
                    scope.name = pageId;

                    var compiles = page.attr("compiles"),
                        isNgInclude = page.attr("ngInclude");

                    if (isNgInclude) {
                        scope.$on('$includeContentLoaded', function (event) {
                            if (event.targetScope.name === pageId) {
                                process(scope, element, attrs);
                                finalize(scope, element, attrs);
                            }
                        });
                    } else {
                        // For the page, if it's not ng-include, then we just go ahead and finalize
                        // Unlike collection and container, for those, if the element is not ng-include,
                        // their children may.
                        // for page, there's no more children ng-include that we care about.
                        finalize(scope, element, attrs);
                    }
                }
            }
        }
    }
}]);

app.directive("znPagesCollection", ['$compile', 'znPageManager', 'Commons', function ($compile, znPageManager, Commons) {

    function process() {
        var scope, element, attrs, phase;

        if (arguments.length === 3) {
            scope = arguments[0];
            element = arguments[1];
            attrs = arguments[2];
            phase = "link";
        } else {
            element = arguments[0];
            attrs = arguments[1];
            phase = "compile";
        }

        var layout = attrs.znPagesLayout === "col" ? attrs.znPagesLayout : "row",
            id = attrs.id || undefined,
            containerId = attrs.znPagesContainerId || undefined,
            start = typeof attrs.znPagesStart !== 'undefined' ? Math.max(0, parseInt(attrs.znPagesStart)) : 0,
            isNgInclude = typeof attrs.ngInclude !== 'undefined',
            collection, container, ngRepeatCollection,
            dynamic = false;

        if (containerId === undefined) return;

        container = znPageManager.container(containerId);

        // If ID exist then it means we've compiled before, which means we have created the collection object
        // for this already. So no ID, create new collection; if ID, get existing collection.
        if (id) {
            collection = container.collection(id);
        } else {
            collection = container.newCollection();
            id = collection.getId();
            element.addClass("zn-pages-" + layout);
        }

        if (collection.isReady()) return collection;

        attrs['id'] = id;
        attrs['zn-pages-layout'] = layout;
        attrs['zn-pages-start'] = start;

        element.attr({
            "id": id,
            "zn-pages-layout": layout,
            "zn-pages-start": start
        });

        element.removeClass("zn-animate").addClass("zn-noanimate");

        // If it's not ng-include, then let's check to see if this is ng-repeat
        //if (!isNgInclude) {
                // Get the page elements (LIs)
            var children = element.children(),

                // Get the first LI to see if it has ng-repeat attribute
                ngRepeatElem = angular.element(children[0]),

                // Get the ng-repeat expression
                expression = ngRepeatElem.attr('ng-repeat');

            // If this is ng-repeat, then extract the collection name in the expression, and replace
            // it with our own.
            if (expression !== undefined) {
                var match = expression.match(/^\s*(.+)\s+in\s+(.*?)\s*(\s+track\s+by\s+(.+)\s*)?$/),
                    lhs = match[1],
                    trackByExp = match[4];

                ngRepeatCollection = match[2];
                ngRepeatElem.attr('ng-repeat', lhs + ' in znPagesBuffer track by ' + trackByExp);
                dynamic = true;
            }
        //}

        collection.attr({
            "compiles": collection.attr("compiles") + 1,
            "layout": layout,
            "startIndex": start,
            "activeIndex": start,
            "parent": container,
            "dynamic": dynamic,
            "ngInclude": isNgInclude,
            "collectionName": ngRepeatCollection
        });

        if (!ngRepeatCollection) {
            var children = element.children(),
                childrenCount = children.length;

            for (var i = 0; i < childrenCount; i++) {
                var child = children[i];

                angular.element(child).attr({
                    "zn-pages-page": "",
                    "zn-pages-collection-id": id,
                    "zn-pages-container-id": containerId
                });

                // Only run compile explicitly if in link phase
                if (phase === "link") $compile(child)(scope);
            }
        }

        return collection;
    }

    function finalize(scope, element, attrs) {
        var width = element[0].offsetWidth,
            height = element[0].offsetHeight,
            collection = scope.collection,
            id = collection.getId(),
            layout = collection.attr("layout"),
            compiles = collection.attr("compiles");

        if (collection.isReady()) return;

        collection.attr({
            "width": width,
            "height": height
        });

        if (collection.isDynamic()) {

            collection.updateBuffer(scope.$eval(collection.attr("collectionName")));
            scope.znPagesBuffer = collection.getBuffer();
        } else {
            collection.updateBuffer();
        }

        scope.$watch("collection.hasMoved()", function (moved) {
            if (moved !== undefined) {
                var animate = !collection.attr("restart");
                Commons.slideTo(element, collection, animate);
                collection.updateBuffer();
                collection.attr("restart", false);
            }
        });

        collection.attr("ready", true);

        scope.$emit("znPagesCollectionReady", {
            id: id
        });
    }

    function pagesReady(collection) {
        var pages = collection.attr("pages"),
            pageCount = pages.length,
            ready = true;

        for (var i = 0; i < pageCount; i++) {
            ready = ready && pages[i].isReady();
        }

        return ready;
    }

    return {
        restrict: "A",
        scope: true,
        compile: function (element, attrs) {
            var tagName = element[0].tagName.toLowerCase();
            if (tagName !== "ul") {
                Commons.log(1, "UL, not " + tagName + ", must be used for collections.");
                return;
            }

            var collection = process(element, attrs),
                collectionId = collection.getId();

            return function (scope, element, attrs) {
                if (!collection.isReady()) {
                    scope.collection = collection;
                    scope.name = collectionId;

                    var layout = collection.attr("layout"),
                        dynamic = collection.isDynamic(),
                        isNgInclude = collection.attr("ngInclude"),
                        compiles = collection.attr("compiles"),
                        collectionName = collection.attr("collectionName");

                    if (!dynamic) {
                        scope.$on('znPagesPageReady', function (event) {
                            if (pagesReady(collection)) {
                                finalize(scope, element, attrs);
                            }
                        });
                    }

                    if (dynamic) {
                        if (compiles === 1) {
                            // if dynamic then it means this is a ng-repeat element, in which case
                            // we make sure we watch for any changes
                            scope.$watch(collectionName, function (newValue, oldValue) {
                                if (newValue != undefined && !angular.equals(newValue, oldValue)) {
                                    collection.updateBuffer(newValue);
                                    scope.znPagesBuffer = collection.getBuffer();

                                    if (collection.width === 0 || collection.height === 0) {
                                        collection.attr({
                                            "width": element[0].offsetWidth,
                                            "height": element[0].offsetHeight
                                        });
                                    }

                                    Commons.slideTo(element, collection, false);
                                }
                            }, true);
                        }

                        finalize(scope, element, attrs);
                    }

                    if (isNgInclude) {
                        if (compiles === 1) {
                            scope.$on('$includeContentLoaded', function (event) {
                                if (event.targetScope.name === collectionId) process(scope, element, attrs);
                            });
                        }
                    } else {
                        if (!pagesReady(collection)) {
                            process(scope, element, attrs);
                        } else {
                            finalize(scope, element, attrs);
                        }
                    }

                    if (compiles === 1) {
                        // the transitionEnd event listener only gets executed when there's animation
                        // If animation is set to none, then this will not get called
                        element[0].addEventListener(Commons.whichTransitionEvent(), function (event) {
                            if (event.target.getAttribute('id').match(/^zn-pages-collection/)) {
                                scope.$apply(function () {
                                    var collection = scope.collection,
                                        numMoved = collection.attr("numMoved");

                                    if (collection.isDynamic()) {
                                        var newBuffer = collection.getBuffer(),
                                            activeBufferIndex = collection.attr("activeBufferIndex");

                                        // If the new buffer and the old buffer are the same, then it means we are at
                                        // the top of the collection. So let's not do anything.
                                        //
                                        // However, if the buffers are different, then let's make sure it's displaying the
                                        // the updated active page, which should be the same page content as before, assuming
                                        // the same page content exist in the new buffer

                                        if (!angular.equals(newBuffer, scope.znPagesBuffer)) {
                                            scope.znPagesBuffer = newBuffer;
                                            Commons.slideTo(element, collection, false);
                                        }
                                    }
                                });
                            }
                        }, false);
                    }
                }
            }
        }
    }
}]);

app.directive("znPages", ['$window', '$document', '$compile', "znSwipe", 'znPageManager', 'Commons', function ($window, $document, $compile, znSwipe, znPageManager, Commons) {

    function process() {
        var scope, element, attrs, phase;

        if (arguments.length === 3) {
            scope = arguments[0];
            element = arguments[1];
            attrs = arguments[2];
            phase = "link";
        } else {
            element = arguments[0];
            attrs = arguments[1];
            phase = "compile";
        }

        var layout = attrs.znPages === "col" ? attrs.znPages : "row",
            id = attrs.id || undefined,
            start = typeof attrs.znPagesStart !== 'undefined' ? Math.max(0, parseInt(attrs.znPagesStart)) : 0,
            isSwipe = typeof attrs.znPagesSwipe !== 'undefined',
            isNgInclude = typeof attrs.ngInclude !== 'undefined',
            container;

        // If ID exist then it means we've compiled before, which means we have created the container object
        // for this already. So no ID, create new container; if ID, get existing container.
        if (id) {
            container = znPageManager.container(id);
        } else {
            container = znPageManager.newContainer();
            id = container.getId();
            element.addClass("zn-pages-" + layout);
        }

        if (container.isReady()) return container;

        container.attr({
            "compiles": container.attr("compiles")+1,
            "startIndex": start,
            "layout": layout,
            "isSwipe": isSwipe,
            "ngInclude": isNgInclude
        });

        attrs['id'] = id;
        attrs['zn-pages-layout'] = layout;
        attrs['zn-pages-start'] = start;

        element.attr({
            "id": id,
            "zn-pages-layout": layout,
            "zn-pages-start": start
        });

        var children = element.children(),
            childrenCount = children.length;


        // For each child, we set it up to be a zn-pages-collection. This will trigger the compile phase
        // for each of the collections.
        for (var i = 0; i < childrenCount; i++) {
            var child = angular.element(children[i]),
                childStart = child.attr("zn-pages-start") ? parseInt(child.attr("zn-pages-start")) : 0;

            child.attr({
                'zn-pages-collection': "",
                'zn-pages-container-id': id,
                'zn-pages-layout': layout,
                'zn-pages-start': childStart
            });

            child.addClass("zn-pages-" + layout);

            // Call $compile if this is the link phase. Otherwise it means we are in the compile phase,
            // which means no need to call $compile explicitly
            if (phase === "link") $compile(child)(scope);
        }

        return container;
    }

    function finalize(scope, element, attrs) {
        var container = scope.container,
            containerId = container.getId(),
            childrenElem = element.children(),
            width = element[0].offsetWidth,
            height = element[0].offsetHeight,
            layout = container.attr("layout"),
            isSwipe = container.attr("isSwipe"),
            compiles = container.attr("compiles");

        if (container.isReady()) return;

        container.attr({
            "width": width,
            "height": height
        });

        container.updateBuffer();

        scope.$watch("container.hasMoved()", function (newValue, oldValue) {
            if (newValue != undefined && newValue !== oldValue) {
                var animate = !container.attr("restart");
                Commons.slideTo(element, container, animate);
                container.updateBuffer();
                container.attr("restart", false);
            }
        });

        if (isSwipe) {
            var startPos,            // coordinates of the last position
                moveX;               // moving horizontally (X) or vertically (!X)

            znSwipe.bind(element, {
                start: function (coords) {
                    startPos = coords;
                    moveX = undefined;
                },

                move: function (coords) {
                    if (!startPos) return;

                    if (moveX === undefined) {
                        var totalX = Math.abs(coords.x - startPos.x),
                            totalY = Math.abs(coords.y - startPos.y);
                        moveX = (totalX > totalY);
                    }

                    var e, cm, offset, ratio, newX, newY;

                    if (moveX) {
                        offset = coords.x - startPos.x;

                        if (layout === "col") {
                            e = element;
                            cm = container;
                        } else {
                            cm = container.attr("collections")[container.attr("activeIndex")];
                            e = angular.element(childrenElem[container.attr("activeIndex")]);
                        }

                        ratio = ((cm.isHead() && offset > 0) || (cm.isTail() && offset < 0)) ? 3 : 1;
                        newX = cm.getPosition(cm.attr("activeBufferIndex")).width + Math.round(offset / ratio);

                        Commons.slideX(e, newX, false);
                    } else {
                        offset = coords.y - startPos.y;

                        if (layout === "col") {
                            cm = container.attr("collections")[container.attr("activeIndex")];
                            e = angular.element(childrenElem[container.attr("activeIndex")]);
                        } else {
                            e = element;
                            cm = container;
                        }

                        ratio = ((cm.isHead() && offset > 0) || (cm.isTail() && offset < 0)) ? 3 : 1;
                        newY = cm.getPosition(cm.attr("activeBufferIndex")).height + Math.round(offset / ratio);

                        Commons.slideY(e, newY, false);
                    }
                },

                end: function (coords) {
                    if (!startPos || moveX == undefined) return;

                    scope.$apply(function () {
                        var cm = null,
                            childId = null,
                            delta = 0,
                            move = false,
                            container = scope.container;

                        if (moveX) {
                            if (layout === "col") {
                                cm = container;
                            } else {
                                cm = container.attr("collections")[container.attr("activeIndex")];
                            }

                            delta = coords.x - startPos.x;
                            move = Math.abs(delta) >= cm.attr("width") * 0.1;

                            if ((cm.isHead() && delta > 0) || (cm.isTail() && delta < 0) || !move) {
                                var e = angular.element(childrenElem[container.attr("activeIndex")]);
                                Commons.slideX(e, 0, true);
                                cm.slideReset();
                            } else {
                                delta > 0 ? container.slideRight() : container.slideLeft();
                            }
                        } else {
                            if (layout === "col") {
                                cm = container.attr("collections")[container.attr("activeIndex")];
                            } else {
                                cm = container;
                            }

                            delta = coords.y - startPos.y;
                            move = Math.abs(delta) >= cm.attr("height") * 0.1;

                            if ((cm.isHead() && delta > 0) || (cm.isTail() && delta < 0) || !move) {
                                cm.slideReset();
                            } else {
                                delta < 0 ? container.slideUp() : container.slideDown();
                            }
                        }
                    });

                    startPos = null;
                },

                cancel: function () {
                    // TODO: what are we going to do?
                }
            })
        }

        $window.onresize = function() {
            scope.$apply(function() {
                var width = element[0].offsetWidth,
                    height = element[0].offsetHeight;

                container.attr({
                    "width": width,
                    "height": height
                });

                container.slideReset();
            });
        };

        $document.ready(function() {
            scope.$apply(function() {
                var width = element[0].offsetWidth,
                    height = element[0].offsetHeight;

                container.attr({
                    "width": width,
                    "height": height
                });

                container.slideHome();
            });
        });

        container.attr("ready", true);

        scope.$emit("znPagesContainerReady", {
            id: containerId
        });
    }

    function collectionsReady(container) {
        var collections = container.attr("collections"),
            collectionCount = collections.length,
            ready = true;

        for (var i = 0; i < collectionCount; i++) {
            ready = ready && collections[i].isReady();
        }

        return ready;
    }

    return {
        restrict: "A",
        scope: true,
        compile: function (element, attrs) {
            var tagName = element[0].tagName.toLowerCase();
            if (tagName !== "div") {
                Commons.log(1, "DIV, not " + tagName + ", must be used for containers.");
                return;
            }

            var container = process(element, attrs),
                containerId = container.getId();

            return function (scope, element, attrs) {
                if (!container.isReady()) {
                    scope.container = container;
                    scope.name = containerId;

                    // If this function is called during the "link" phase, and we don't already have a wrapper, then
                    // create new wrapper. This wrapper is the outer layer used to hide the rest of the content
                    var parent = element.parent()[0];
                    if (parent.id !== "zn-pages-wrapper") {
                        element.wrap('<div id="zn-pages-wrapper" class="zn-pages-container"></div>');
                    }

                    var isNgInclude = container.attr("ngInclude"),
                        compiles = container.attr("compiles"),
                        collections = container.attr("collections");

                    // If this is the first time after compilation, let's setup the event handlers
                    if (compiles === 1) {
                        scope.$on('znPagesCollectionReady', function (event) {
                            if (collectionsReady(container)) {
                                finalize(scope, element, attrs);
                            }
                        });
                    }

                    if (isNgInclude) {
                        if (compiles === 1) {
                            scope.$on('$includeContentLoaded', function (event) {
                                if (event.targetScope.name === containerId) process(scope, element, attrs);
                            });
                        }
                    } else {
                        if (!collectionsReady(container)) {
                            process(scope, element, attrs);
                        } else {
                            finalize(scope, element, attrs);
                        }
                    }
                }
            }
        }
    }
}]);

app.service("znPageManager", ['Commons', function (Commons) {
    var containers = [];

    /**
     * @ngdoc object
     * @name PageManager.Page
     *
     * @description
     *
     */

    function Page(id, dynamic) {
        var _options = {
            id: id,                             // The page ID
            width: 0,                           // Page width
            height: 0,                          // Page height
            parent: null,                       // The collection holding this page
            ready: false,
            compiles: 0
        };

        angular.extend(this, _options);
    }

    Page.prototype.attr = Commons.attr;
    Page.prototype.toString = Commons.toString;

    Page.prototype.getId = function () {
        return "zn-pages-page-" + this.id;
    };

    Page.prototype.isReady = function () {
        return this.ready;
    };

    /**
     * @ngdoc object
     * @name PageManager.Collection
     *
     * @description
     *
     */

    function Collection(id) {
        var _options = {
            id: id,                             // ID of the page collection
            pages: [],                          // List of Page objects
            activeIndex: 0,                      // Current active page
            buffer: [],                         // display buffer for the collection
            bufferSize: 3,                      // Display buffer size
            activeBufferIndex: 0,                // Current active page of the display buffer
            parent: null,                       // The container holding this collection
            dynamic: false,                     // The collection is dynamic
            collection: null,                   // The dynamic collection,
            numMoved: 0,                        // The number of pages moved
            moved: 0,                        // The collection has moved
            height: 0,
            width: 0,
            layout: "row",
            restart: false,
            ready: false,
            startIndex: 0,
            compiles: 0
        };

        for (var i in _options) this[i] = _options[i];
        //angular.extend(this, _options);
    }

    Collection.prototype.attr = Commons.attr;
    Collection.prototype.toString = Commons.toString;

    Collection.prototype.newPage = function () {
        var page = new Page(this.id + "-" + this.pages.length);
        this.pages.push(page);
        return page;
    };

    Collection.prototype.getId = function () {
        return "zn-pages-collection-" + this.id;
    };

    Collection.prototype.page = function (id) {
        for (var i = 0; i < this.pages.length; i++) {
            if (this.pages[i].getId() === id) {
                return this.pages[i];
            }
        }
    };

    Collection.prototype.isDynamic = function () {
        return this.dynamic;
    };

    Collection.prototype.isReady = function () {
        var count = this.pages.length,
            ready = this.ready;

        for (var i = 0; i < count; i++) {
            ready = ready && this.pages[i].isReady();
        }

        return ready;
    };

    Collection.prototype.isHead = function () {
        return this.activeIndex === 0;
    };

    Collection.prototype.isTail = function () {
        return this.activeIndex === this.length() - 1;
    };

    Collection.prototype.getBuffer = function () {
        return this.buffer;
    };

    Collection.prototype.bufferLength = function () {
        return this.isDynamic() ? this.buffer.length : this.pages.length;
    };

    Collection.prototype.length = function () {
        return this.isDynamic() ? this.collection.length : this.pages.length;
    };

    Collection.prototype.getPosition = function (index) {
        var position = { width: 0, height: 0 };

        var width = this.parent.attr("width"),
            height = this.parent.attr("height");

        position.width = -width * index;
        position.height = -height * index;

        return position;
    };

    Collection.prototype.hasMoved = function () {
        return this.moved;
    };

    Collection.prototype.slideReset = function () {
        this.moved++;
    };

    Collection.prototype.slidePrev = function () {
        this.numMoved = -1;
        this.moved++;
    };

    Collection.prototype.slideNext = function () {
        this.numMoved = 1;
        this.moved++;
    };

    Collection.prototype.slideHome = function () {
        this.numMoved = 0;
        this.activeIndex = this.startIndex;
        this.activeBufferIndex = this.startIndex;
        this.restart = true;

        this.updateBuffer();

        this.moved++;
    };

    Collection.prototype.updateBuffer = function (collection) {
        if (!this.isDynamic()) {
            var active = Math.max(0, Math.min(this.activeIndex + this.numMoved, this.pages.length - 1));
            this.activeIndex = active;
            this.activeBufferIndex = active;
            return;
        }

        if (collection) this.collection = collection;
        if (this.collection === undefined) return;

        var collectionKeys = [], bufferStart, bufferEnd, bufferKeys = [], activeBufferIndex, active;

        // Get the list of updated keys, and see if we can find the current key in the update list
        // If collection is an array then just use that
        // If collection is an object map, then extract the keys and sort that

        if (angular.isArray(this.collection)) {
            collectionKeys = this.collection;
        } else {
            for (var key in this.collection) {
                if (this.collection.hasOwnProperty(key) && key.charAt(0) != '$') {
                    collectionKeys.push(key);
                }
            }
            collectionKeys.sort();
        }

        if (angular.isArray(this.buffer)) {
            bufferKeys = this.buffer;
        } else {
            for (var key in this.buffer) {
                if (this.buffer.hasOwnProperty(key) && key.charAt(0) != '$') {
                    bufferKeys.push(key);
                }
            }
            bufferKeys.sort();
        }

        if (this.buffer.length === 0 || this.reset == true) {
            // buffer size is 0 means there's nothing in the buffer, most likely never set, so let's set
            // it up using the start page.

            active = this.startIndex;
        } else if (collectionKeys[this.activeIndex] !== bufferKeys[this.activeBufferIndex]) {
            // If the actual key in the collection pointed to by the page index in the collection
            // is no longer the same as the saved key, then we know the array has shifted and positions
            // have been changed. So let's find the new index for the saved key, and keep the saved key
            // in the current display, and update the buffer around it

            for (var i = 0; i < collectionKeys.length; i++) {
                if (collectionKeys[i] === bufferKeys[this.activeBufferIndex]) {
                    active = i;
                }
            }

            if (active === undefined) active = this.startIndex;
        } else {
            // By now, we know the buffer has been set before, and that the saved key is the same
            // as the collection key that's pointed to by the page index, then we just keep
            // the same active key and just update the buffer around it

            active = this.activeIndex;
        }

        var a = active;
        // active should be previous_active + change
        active = Math.max(0, Math.min(active + this.numMoved, collectionKeys.length - 1));
        bufferStart = Math.max(0, Math.min(active - 1, collectionKeys.length - 1));
        activeBufferIndex = active - bufferStart;
        bufferEnd = bufferStart + this.bufferSize;
        bufferKeys = collectionKeys.slice(bufferStart, bufferEnd);

        // Create the display buffer, return either array or object map depending on the
        // original collection

        if (angular.isArray(this.collection)) {
            this.buffer = bufferKeys;
        } else {
            this.buffer = {};

            for (var i = 0; i < bufferKeys.length; i++) {
                var key = bufferKeys[i];
                this.buffer[key] = this.collection[key];
            }
        }

        this.activeBufferIndex = activeBufferIndex;
        this.activeIndex = active;
        this.numMoved = 0;

        return this.buffer;
    };

    /**
     * @ngdoc object
     * @name PageManager.Container
     *
     * @description
     *
     */

    function Container(id) {
        var _options = {
            id: id,                             // ID of the page container
            collections: [],                    // List of Collection objects
            activeIndex: 0,                     // Current active collection
            activeBufferIndex: 0,               // Current active collection
            numMoved: 0,                        // The number of pages moved
            moved: 0,                        // The collection has moved
            height: 0,
            width: 0,
            layout: "row",
            isSwipe: true,
            startIndex: 0,
            restart: false,
            ready: false,
            compiles: 0
        };

        angular.extend(this, _options);
    }

    Container.prototype.attr = Commons.attr;
    Container.prototype.toString = Commons.toString;

    Container.prototype.newCollection = function () {
        var col = new Collection(this.id + "-" + this.collections.length);
        this.collections.push(col);
        return col;
    };

    Container.prototype.getId = function () {
        return "zn-pages-container-" + this.id;
    };

    Container.prototype.isReady = function () {
        var count = this.collections.length,
            ready = this.ready;

        for (var i = 0; i < count; i++) {
            ready = ready && this.collections[i].isReady();
        }

        return ready;
    };

    Container.prototype.isHead = function () {
        return this.activeIndex === 0;
    };

    Container.prototype.isTail = function () {
        return this.activeIndex === this.length() - 1;
    };

    Container.prototype.isLeft = function () {
        if (this.layout === "row") {
            return this.collections[this.activeIndex].isHead();
        } else {
            return this.isHead();
        }
    };

    Container.prototype.isRight = function () {
        if (this.layout === "row") {
            return this.collections[this.activeIndex].isTail();
        } else {
            return this.isTail();
        }
    };

    Container.prototype.isTop = function () {
        if (this.layout === "row") {
            return this.isHead();
        } else {
            return this.collections[this.activeIndex].isHead();
        }
    };

    Container.prototype.isBottom = function () {
        if (this.layout === "row") {
            return this.isTail();
        } else {
            return this.collections[this.activeIndex].isTail();
        }
    };

    Container.prototype.length = function () {
        return this.collections.length;
    };

    Container.prototype.collection = function (id) {
        for (var i = 0; i < this.collections.length; i++) {
            if (this.collections[i].getId() === id) {
                return this.collections[i];
            }
        }
    };

    Container.prototype.bufferLength = function () {
        return this.length();
    };

    Container.prototype.hasMoved = function () {
        return this.moved;
    };

    Container.prototype.getPosition = function (index) {
        var position = { width: 0, height: 0 };

        position.width = -this.width * index;
        position.height = -this.height * index;

        return position;
    };

    Container.prototype.slideReset = function () {
        this.moved++;
    };

    Container.prototype.slideHome = function () {
        this.numMoved = 0;
        this.activeIndex = this.startIndex;
        this.activeBufferIndex = this.startIndex;
        this.restart = true;

        this.updateBuffer();

        for (var i = 0; i < this.length(); i++) {
            this.collections[i].slideHome();
        }

        this.moved++;
    };

    Container.prototype.slidePrev = function () {
        this.numMoved = -1;
        this.moved++;
    };

    Container.prototype.slideNext = function () {
        this.numMoved = 1;
        this.moved++;
    };

    Container.prototype.updateBuffer = function () {
        var active = Math.max(0, Math.min(this.activeIndex + this.numMoved, this.collections.length - 1));
        this.activeIndex = active;
        this.activeBufferIndex = active;
    };

    Container.prototype.slideLeft = function () {
        // 1. If column layout, slide left means showing column on right
        // 2. If row layout, slide left means showing the page on the right of the active row
        if (this.layout === "col") {
            this.slideNext();
        } else {
            this.collections[this.activeIndex].slideNext();
        }
    };

    Container.prototype.slideRight = function () {
        // 1. If column layout, slide right means showing column on left
        // 2. If row layout, slide right means showing the page on the left of the active row
        if (this.layout === "col") {
            this.slidePrev();
        } else {
            this.collections[this.activeIndex].slidePrev();
        }
    };

    Container.prototype.slideUp = function () {
        // 1. If column layout, slide up means showing page below in the active row
        // 2. If row layout, slide up means showing the row below
        if (this.layout === "col") {
            this.collections[this.activeIndex].slideNext();
        } else {
            this.slideNext();
        }
    };

    Container.prototype.slideDown = function () {
        // 1. If column layout, slide down means showing page above in the active row
        // 2. If row layout, slide down means showing the row above
        if (this.layout === "col") {
            this.collections[this.activeIndex].slidePrev();
        } else {
            this.slidePrev();
        }
    };

    Container.prototype.initialize = function (options) {
        this.attr(options);

        var active = Math.max(0, Math.min(this.activeIndex + this.numMoved, this.collections.length - 1));
        this.activeIndex = active;
        this.activeBufferIndex = active;
    };

    return {
        newContainer: function () {
            var c = new Container(containers.length);
            containers.push(c);
            return c;
        },

        containers: function () {
            return containers;
        },

        container: function (id) {
            for (var i = 0; i < containers.length; i++) {
                if (containers[i].getId() === id) {
                    return containers[i];
                }
            }
        }
    };
}]);

app.factory("Commons", [ function () {
    return {
        log: function () {
            var debug = true,
                debug2 = true,
                debug3 = true,
                d = parseInt(arguments[0]),
                i;

            if ((d === 1 && debug) || (d === 2 && debug2) || (d === 3 && debug3)) {
                console.log(new Date());
                for (i = 1; i < arguments.length; i++) {
                    console.log(arguments[i]);
                }
            }
        },

        attr: function (name, value) {
            if (angular.isObject(name)) {
                // if the name is a object map, then loop through the properties and set them individually
                for (var i in name) {
                    if (name.hasOwnProperty(i)) this.attr(i, name[i]);
                }
            } else if (name !== undefined && value !== undefined) {
                // if both parameters exist, then we assume we are setting an attribute
                // For a couple of the properties we do some special treatment
                // Otherwise we just save the properties
                this[name] = value;
            } else if (name !== undefined) {
                // if name is defined and value is undefined, then we assume we are retrieving a parameter

                // If it's a collection that is NOT dynamic, or it's a container (which by definition is not
                // dynamic, then activeBufferIndex is really just the activeIndex, so we will return that
                if (((this.getId().match(/^zn-pages-collection/) && !this.isDynamic()) || this.getId().match(/^zn-pages-container/)) && name === "activeBufferIndex") {
                    return this.activeIndex;
                }

                if (name === "activeIndex") {
                    if (this.getId().match(/^zn-pages-container/)) {
                        return Math.max(0, Math.min(this.activeIndex, this.collections.length));
                    } else if (this.getId().match(/^zn-pages-conllection/)) {
                        return Math.max(0, Math.min(this.activeIndex, this.pages.length));
                    } else {
                        return this.activeIndex;
                    }
                }
                return this[name];
            } else {
                // if all else fails, return undefined
                return undefined;
            }
        },

        toString: function () {
            var str = "id: " + this.getId() + "\n";

            for (var i in this) {
                var t = typeof this[i];
                if (t !== 'function') {
                    str += (i + " (" + t + "): " + (this[i] !== null ? this[i].toString() : "null") + "\n");
                }
            }

            return str;
        },

        slideTo: function (element, obj, animate) {
            animate = (arguments.length < 3) ? true : animate;

            var id = obj.getId(),
                layout = obj.attr("layout"),
                active = Math.max(0, Math.min(obj.attr("activeBufferIndex") + obj.attr("numMoved"), obj.bufferLength() - 1)),
                position = obj.getPosition(active);

            if (id.match(/^zn-pages-container/)) {
                // slide container

                if (layout === "row") {
                    this.slideY(element, position.height, animate);
                } else {
                    this.slideX(element, position.width, animate);
                }
            } else {
                // slide collection
                if (layout === "row") {
                    this.slideX(element, position.width, animate);
                } else {
                    this.slideY(element, position.height, animate);
                }

            }
        },

        slideX: function (element, width, animate) {
            if (animate === false) {
                element.removeClass("zn-animate").addClass("zn-noanimate");
            } else {
                element.removeClass("zn-noanimate").addClass("zn-animate");
            }

            element.css(this.whichTransformCSS(), 'translateX(' + width + 'px)');
        },

        slideY: function (element, height, animate) {
            if (animate === false) {
                element.removeClass("zn-animate").addClass("zn-noanimate");
            } else {
                element.removeClass("zn-noanimate").addClass("zn-animate");
            }

            element.css(this.whichTransformCSS(), 'translateY(' + height + 'px)');
        },

        whichTransitionEvent: function () {
            var el = document.createElement('fakeelement'),
                transitions = {
                    'transition': 'transitionend',
                    'OTransition': 'oTransitionEnd',
                    'MozTransition': 'transitionend',
                    'MSTransition': 'mstransitionend',
                    'WebkitTransition': 'webkitTransitionEnd'
                };

            for (var t in transitions) {
                if (transitions.hasOwnProperty(t)) {
                    if (el.style[t] !== undefined) {
                        return transitions[t];
                    }
                }
            }
        },

        whichTransformCSS: function () {
            var el = document.createElement('fakeelement'),
                transforms = {
                    'transform': 'transform',
                    'oTransform': '-o-transform',
                    'mozTransform': '-moz-transform',
                    'webkitTransform': '-webkit-transform',
                    'msTransform': '-ms-transform'
                };

            for (var t in transforms) {
                if (transforms.hasOwnProperty(t)) {
                    if (el.style[t] !== undefined) {
                        return transforms[t];
                    }
                }
            }
        }
    }
}]);

/**
 * @ngdoc object
 * @name ngMobile.$swipe
 *
 * @description
 * The `$swipe` service is a service that abstracts the messier details of hold-and-drag swipe
 * behavior, to make implementing swipe-related directives more convenient.
 *
 * It is used by the `ngSwipeLeft` and `ngSwipeRight` directives in `ngMobile`, and by
 * `ngCarousel` in a separate component.
 *
 * # Usage
 * The `$swipe` service is an object with a single method: `bind`. `bind` takes an element
 * which is to be watched for swipes, and an object with four handler functions. See the
 * documentation for `bind` below.
 */

app.factory('znSwipe', [function () {
    // The total distance in any direction before we make the call on swipe vs. scroll.
    var MOVE_BUFFER_RADIUS = 10;

    function getCoordinates(event) {
        var touches = event.touches && event.touches.length ? event.touches : [event];
        var e = (event.changedTouches && event.changedTouches[0]) ||
            (event.originalEvent && event.originalEvent.changedTouches &&
                event.originalEvent.changedTouches[0]) ||
            touches[0].originalEvent || touches[0];

        return {
            x: e.clientX,
            y: e.clientY
        };
    }

    return {
        /**
         * @ngdoc method
         * @name ngMobile.$swipe#bind
         * @methodOf ngMobile.$swipe
         *
         * @description
         * The main method of `$swipe`. It takes an element to be watched for swipe motions, and an
         * object containing event handlers.
         *
         * The four events are `start`, `move`, `end`, and `cancel`. `start`, `move`, and `end`
         * receive as a parameter a coordinates object of the form `{ x: 150, y: 310 }`.
         *
         * `start` is called on either `mousedown` or `touchstart`. After this event, `$swipe` is
         * watching for `touchmove` or `mousemove` events. These events are ignored until the total
         * distance moved in either dimension exceeds a small threshold.
         *
         * Once this threshold is exceeded, either the horizontal or vertical delta is greater.
         * - If the horizontal distance is greater, this is a swipe and `move` and `end` events follow.
         * - If the vertical distance is greater, this is a scroll, and we let the browser take over.
         *   A `cancel` event is sent.
         *
         * `move` is called on `mousemove` and `touchmove` after the above logic has determined that
         * a swipe is in progress.
         *
         * `end` is called when a swipe is successfully completed with a `touchend` or `mouseup`.
         *
         * `cancel` is called either on a `touchcancel` from the browser, or when we begin scrolling
         * as described above.
         *
         */
        bind: function (element, eventHandlers) {
            // Absolute total movement, used to control swipe vs. scroll.
            var totalX, totalY;
            // Coordinates of the start position.
            var startCoords;
            // Last event's position.
            var lastPos;
            // Whether a swipe is active.
            var active = false;

            element.bind('touchstart mousedown', function (event) {
                startCoords = getCoordinates(event);
                active = true;
                totalX = 0;
                totalY = 0;
                lastPos = startCoords;
                eventHandlers['start'] && eventHandlers['start'](startCoords);
            });

            element.bind('touchcancel', function (event) {
                active = false;
                eventHandlers['cancel'] && eventHandlers['cancel']();
            });

            element.bind('touchmove mousemove', function (event) {
                if (!active) return;

                // Android will send a touchcancel if it thinks we're starting to scroll.
                // So when the total distance (+ or - or both) exceeds 10px in either direction,
                // we either:
                // - On totalX > totalY, we send preventDefault() and treat this as a swipe.
                // - On totalY > totalX, we let the browser handle it as a scroll.

                if (!startCoords) return;
                var coords = getCoordinates(event);

                totalX += Math.abs(coords.x - lastPos.x);
                totalY += Math.abs(coords.y - lastPos.y);

                lastPos = coords;

                if (totalX < MOVE_BUFFER_RADIUS && totalY < MOVE_BUFFER_RADIUS) {
                    return;
                }

                // Prevent the browser from scrolling.
                event.preventDefault();
                eventHandlers['move'] && eventHandlers['move'](coords);
            });

            element.bind('touchend mouseup', function (event) {
                if (!active) return;
                active = false;
                eventHandlers['end'] && eventHandlers['end'](getCoordinates(event));
            });
        }
    };
}]);


