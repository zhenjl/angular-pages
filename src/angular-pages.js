/**
 * Copyright (c) 2013 Zhen, LLC. http://zhen.io
 *
 * MIT License
 *
 * Angular directive for managing rows/columns of pages and transitions.
 * http://github.com/zhenjl/angular-pages
 *
 * Let me start by thanking @revolunet for his awesome angular-carousel directive
 * (https://github.com/revolunet/angular-carousel). Angular-pages is heavily inspired by
 * and borrowed heavily from angular-carousel.
 *
 * This is my first angular.js project. In fact, this is my first semi-real coding project
 * in the past 7 years. Almost all the frameworks, tools, IDEs have changed in that time.
 * So being able to learn from angular-carousel is a huge advantage. @revolunet has done
 * an amazing job with it and if you are looking for a carousel tool, definitely check it out.
 *
 */

'use strict';

var app = angular.module("angular-pages", []);

app.directive("znPagesPage", ['znPageManager', 'Commons', function (znPageManager, Commons) {

    return {
        restrict: "A",
        scope: true,
        compile: function (element, attrs) {
            Commons.log(3, {
                "func": "znPagesPage.compile",
                "arguments": arguments
            });

            var collectionId = attrs['znPagesCollectionId'] ? attrs['znPagesCollectionId'] : undefined,
                containerId = attrs['znPagesContainerId'] ? attrs['znPagesContainerId'] : undefined;

            if (containerId === undefined || collectionId === undefined) return;

            var container = znPageManager.container(containerId),
                collection = container.collection(collectionId);

            if (container === undefined || collection === undefined) return;

            var page = collection.newPage(),
                pageId = page.getId();

            element.attr("zn-id", pageId);

            return function (scope, element, attrs) {
                page.attr("width", element[0].getBoundingClientRect().width);
                page.attr("height", element[0].getBoundingClientRect().height);
            }
        }
    }
}]);

app.directive("znPagesCollection", ['znPageManager', 'Commons', function (znPageManager, Commons) {

    return {
        restrict: "A",
        scope: true,
        compile: function (element, attrs) {
            Commons.log(3, {
                "func": "znPagesCollection.compile",
                "arguments": arguments
            });

            var children = element.find("li"),
                ngRepeatElem = angular.element(children[0]),
                expression = ngRepeatElem.attr('ng-repeat'),
                containerId = attrs['znPagesContainerId'] ? attrs['znPagesContainerId'] : undefined,
                container = znPageManager.container(containerId),
                collection = container.newCollection(),
                collectionId = collection.getId(),
                collectionName;

            if (containerId === undefined || !container) return;

            if (expression !== undefined) {
                var match = expression.match(/^\s*(.+)\s+in\s+(.*?)\s*(\s+track\s+by\s+(.+)\s*)?$/),
                    lhs = match[1],
                    trackByExp = match[4];

                collectionName = match[2];
                ngRepeatElem.attr('ng-repeat', lhs + ' in znPagesBuffer track by ' + trackByExp);
            } else {
                for (var i = 0; i < children.length; i++) {
                    angular.element(children[i]).attr({
                        "zn-pages-page": "",
                        "zn-pages-collection-id": collectionId,
                        "zn-pages-container-id": containerId
                    });
                }
            }

            element.attr("zn-id", collectionId);
            element.addClass("zn-noanimate");

            return function (scope, element, attrs) {
                Commons.log(3, {
                    "func": "znPagesCollection.link",
                    "arguments": arguments
                });

                var layout = attrs['znPagesLayout'] === "col" ? "col" : "row",
                    start = attrs['znPagesStart'] ? Math.max(0, parseInt(attrs['znPagesStart'])) : 0,
                    width = element[0].getBoundingClientRect().width,
                    height = element[0].getBoundingClientRect().height,
                    ngRepeatCollection = null,
                    dynamic = false;

                scope.collection = collection;

                if (collectionName) {
                    ngRepeatCollection = scope.$eval(collectionName);
                    dynamic = true;

                    scope.$watch(collectionName, function (newValue, oldValue) {
                        Commons.log(3, {
                            "func": "znPagesCollection.link.$watch " + collectionName,
                            "arguments": arguments
                        });

                        if (newValue != undefined && !angular.equals(newValue, oldValue)) {
                            collection.updateBuffer(newValue);
                            scope.znPagesBuffer = collection.getBuffer();

                            if (collection.width === 0 || collection.height === 0) {
                                collection.attr({
                                    "width": element[0].getBoundingClientRect().width,
                                    "height": element[0].getBoundingClientRect().height
                                });
                            }

                            Commons.slideTo(element, collection, false);
                        }
                    }, true);
                }

                collection.attr({
                    "width": width,
                    "height": height,
                    "layout": layout,
                    "startPage": start,
                    "activeIndex": start,
                    "parent": containerId,
                    "dynamic": dynamic,
                    "collection": ngRepeatCollection
                });

                if (collection.isDynamic()) {
                    collection.updateBuffer();
                    scope.znPagesBuffer = collection.getBuffer();
                }

                Commons.slideTo(element, collection, false);

                scope.$watch("collection.hasMoved()", function(newValue, oldValue) {
                    Commons.log(3, {
                        "func": "znPagesCollection.$watch collection.hasMoved()",
                        "arguments": arguments,
                        "collection": collection
                    });

                    if (newValue != undefined && newValue !== oldValue) {
                        Commons.slideTo(element, collection, true);
                        collection.updateBuffer();
                    }
                });

                // the transitionEnd event listener only gets executed when there's animation
                // If animation is set to none, then this will not get called

                element[0].addEventListener(Commons.whichTransitionEvent(), function(event) {

                    if (event.target.getAttribute('zn-id').match(/^zn-pages-collection/)) {
                        scope.$apply(function() {
                            Commons.log(3, {
                                "func": "znPagesCollection.link.addEventListener transitionEnd",
                                "arguments": arguments
                            });

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
}]);

app.directive("znPages", ["znSwipe", 'znPageManager', 'Commons', function (znSwipe, znPageManager, Commons) {

    return {
        restrict: "A",
        scope: true,
        compile: function (element, attrs) {
            Commons.log(3, {
                "func": "znPages.compile",
                "arguments": arguments
            });

            var layout = attrs['znPages'] === "col" ? attrs['znPages'] : "row",
                children = element.find("ul"),
                container = znPageManager.newContainer(),
                containerId = container.getId();

            element.addClass('zn-pages-container');

            for (var i = 0; i < children.length; i++) {
                var e = angular.element(children[i]),
                    start = e.attr("zn-pages-start") ? e.attr("zn-pages-start") : 0,
                    colElem = e.wrap('<div></div>').parent();

                colElem.attr({
                    'zn-pages-collection': "",
                    'zn-pages-container-id': containerId,
                    'zn-pages-layout': layout,
                    'zn-pages-start': start
                });

                colElem.addClass("zn-pages-" + layout);
            }

            element.html('<div zn-id="' + containerId + '" class="zn-pages-' + layout + ' zn-noanimate">' + element.html() + '</div>');

            return function (scope, element, attrs) {
                Commons.log(3, {
                    "func": "znPages.link",
                    "arguments": arguments
                });

                scope.container = container;

                var start = attrs['znPagesStart'] ? Math.max(0, parseInt(attrs['znPagesStart'])) : 0,
                    containerElem = angular.element(element.children()[0]), // the newly added div container
                    childrenElem = containerElem.children();

                container.attr({
                    "width": containerElem[0].getBoundingClientRect().width,
                    "height": containerElem[0].getBoundingClientRect().height,
                    "layout": layout,
                    "start": start,
                    "activeIndex": start
                });

                Commons.slideTo(containerElem, container, false);

                scope.$watch("container.hasMoved()", function(newValue, oldValue) {
                    Commons.log(3, {
                        "func": "znPages.$watch container.hasMoved()",
                        "arguments": arguments
                    });

                    if (newValue != undefined && newValue !== oldValue) {
                        Commons.slideTo(containerElem, container, true);
                        container.updateBuffer();
                    }
                });

                var startPos,            // coordinates of the last position
                    moveX;              // moving horizontally (X) or vertically (!X)

                znSwipe.bind(containerElem, {
                    start: function(coords) {
                        startPos = coords;
                        moveX = undefined;
                    },

                    move: function(coords) {
                        if (!startPos) return;

                        var pageManager = scope.pageManager;

                        if (moveX === undefined) {
                            var totalX = Math.abs(coords.x - startPos.x),
                                totalY = Math.abs(coords.y - startPos.y);
                            moveX = (totalX > totalY);
                        }

                        var e, active, cm, childId, offset, ratio, newX, newY;

                        if (moveX) {
                            offset = coords.x - startPos.x;

                            if (layout === "col") {
                                e = containerElem;
                                cm = container;
                            } else {
                                cm = container.attr("collections")[container.attr("activeIndex")];
                                e = angular.element(childrenElem[container.attr("activeIndex")]);
                            }

                            ratio = ((cm.isHead() && offset > 0) || (cm.isTail() && offset < 0)) ? 3 : 1;
                            newX = cm.activePosition().width + Math.round(offset / ratio);

                            Commons.slideX(e, newX, false);
                        } else {
                            offset = coords.y - startPos.y;

                            if (layout === "col") {
                                cm = container.attr("collections")[container.attr("activeIndex")];
                                e = angular.element(childrenElem[container.attr("activeIndex")]);
                            } else {
                                e = containerElem;
                                cm = container;
                            }

                            active = cm.attr("activeBufferIndex");
                            ratio = ((cm.isHead() && offset > 0) || (cm.isTail() && offset < 0)) ? 3 : 1;
                            newY = cm.activePosition().height + Math.round(offset / ratio);

                            Commons.slideY(e, newY, false);
                        }
                    },

                    end: function(coords) {
                        if (!startPos || moveX == undefined) return;

                        scope.$apply(function() {
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

                    cancel: function() {
                        // TODO: what are we going to do?
                    }
                })
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
            parent: null                        // The collection holding this page
        };

        angular.extend(this, _options);
    }

    Page.prototype.attr = Commons.attr;

    Page.prototype.getId = function () {
        return "zn-pages-page-" + this.id;
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
            layout: "row"
        };

        for (var i in _options) this[i] = _options[i];
        //angular.extend(this, _options);
    }

    Collection.prototype.attr = Commons.attr;

    Collection.prototype.newPage = function () {
        var page = new Page(this.id + "-" + this.pages.length);
        this.pages.push(page);
        return page;
    };

    Collection.prototype.getId = function () {
        return "zn-pages-collection-" + this.id;
    };

    Collection.prototype.isDynamic = function () {
        return this.dynamic;
    };

    Collection.prototype.isHead = function () {
        return this.activeIndex === 0;
    };

    Collection.prototype.isTail = function () {
        return this.activeIndex === this.length()-1;
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

    Collection.prototype.activePosition = function() {
        var active = Math.max(0, Math.min(this.attr("activeBufferIndex")+this.numMoved, this.bufferLength()-1));
        var position = { width: 0, height: 0 };

        if (this.isDynamic()) {
            position.width = -this.width * active;
            position.height = -this.height * active;
        } else {
            for (var i = 0; i < active; i++) {
                position.width -= this.pages[i].attr("width");
                position.height -= this.pages[i].attr("height");
            }

        }

        return position;
    };

    Collection.prototype.hasMoved = function() {
        return this.moved;
    };

    Collection.prototype.slideReset = function() {
        this.moved++;
    };

    Collection.prototype.slidePrev = function() {
        this.numMoved = -1;
        this.moved++;
    };

    Collection.prototype.slideNext = function() {
        this.numMoved = 1;
        this.moved++;
    };

    Collection.prototype.updateBuffer = function (collection) {
        if (!this.isDynamic()) {
            var active = Math.max(0, Math.min(this.activeIndex+this.numMoved, this.pages.length-1));
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

        if (this.buffer.length === 0) {
            // buffer size is 0 means there's nothing in the buffer, most likely never set, so let's set
            // it up using the start page.

            active = this.startPage;
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

            if (active === undefined) active = this.startPage;
        } else {
            // By now, we know the buffer has been set before, and that the saved key is the same
            // as the collection key that's pointed to by the page index, then we just keep
            // the same active key and just update the buffer around it

            active = this.activeIndex;
        }

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
            layout: "row"
        };

        angular.extend(this, _options);
    }

    Container.prototype.attr = Commons.attr;

    Container.prototype.newCollection = function () {
        var col = new Collection(this.id + "-" + this.collections.length);
        this.collections.push(col);
        return col;
    };

    Container.prototype.getId = function () {
        return "zn-pages-container-" + this.id;
    };

    Container.prototype.isHead = function () {
        return this.activeIndex === 0;
    };

    Container.prototype.isTail = function () {
        return this.activeIndex === this.length()-1;
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

    Container.prototype.bufferLength = function() {
        return this.length();
    };

    Container.prototype.hasMoved = function() {
        return this.moved;
    };

    Container.prototype.activePosition = function() {
        var active = Math.max(0, Math.min(this.activeIndex + this.numMoved, this.length()-1));
        var position = { width: 0, height: 0 };

        for (var i = 0; i < active; i++) {
            position.width -= this.collections[i].attr("width");
            position.height -= this.collections[i].attr("height");
        }

        return position;
    };

    Container.prototype.slideReset = function() {
        this.moved++;
    };

    Container.prototype.slidePrev = function() {
        this.numMoved = -1;
        this.moved++;
    };

    Container.prototype.slideNext = function() {
        this.numMoved = 1;
        this.moved++;
    };

    Container.prototype.updateBuffer = function () {
        var active = Math.max(0, Math.min(this.activeIndex+this.numMoved, this.collections.length-1));
        this.activeIndex = active;
        this.activeBufferIndex = active;
    };

    Container.prototype.slideLeft = function() {
        Commons.log(3, {
            "func": "Container.slideLeft",
            "arguments": arguments
        });

        // 1. If column layout, slide left means showing column on right
        // 2. If row layout, slide left means showing the page on the right of the active row
        if (this.layout === "col") {
            this.slideNext();
        } else {
            this.collections[this.activeIndex].slideNext();
        }
    };

    Container.prototype.slideRight = function() {
        Commons.log(3, {
            "func": "Container.slideRight",
            "arguments": arguments
        });

        // 1. If column layout, slide right means showing column on left
        // 2. If row layout, slide right means showing the page on the left of the active row
        if (this.layout === "col") {
            this.slidePrev();
        } else {
            this.collections[this.activeIndex].slidePrev();
        }
    };

    Container.prototype.slideUp = function() {
        Commons.log(3, {
            "func": "Container.slideUp",
            "arguments": arguments
        });

        // 1. If column layout, slide up means showing page below in the active row
        // 2. If row layout, slide up means showing the row below
        if (this.layout === "col") {
            this.collections[this.activeIndex].slideNext();
        } else {
            this.slideNext();
        }
    };

    Container.prototype.slideDown = function() {
        Commons.log(3, {
            "func": "Container.slideDown",
            "arguments": arguments
        });

        // 1. If column layout, slide down means showing page above in the active row
        // 2. If row layout, slide down means showing the row above
        if (this.layout === "col") {
            this.collections[this.activeIndex].slidePrev();
        } else {
            this.slidePrev();
        }
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
            Commons.log(3, {
                "func": "znPageManager.container",
                "arguments": arguments
            });

            for (var i = 0; i < containers.length; i++) {
                if (containers[i].getId() === id) {
                    return containers[i];
                }
            }
        }
    };
}]);

app.factory("Commons", [ function() {
    return {
        log: function () {
            var debug = true,
                debug2 = true,
                debug3 = false,
                d = arguments[0],
                i;

            if ((d === 1 && debug) || (d === 2 && debug2) || (d === 3 && debug3)) {
                console.log(new Date());
                for (i = 1; i < arguments.length; i++) {
                    console.log(arguments[i]);
                }
            } else if (debug3) {
                console.log(new Date());
                for (i = 0; i < arguments.length; i++) {
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
                // if name is defined and value is undefined, then we assume we are retrieving
                // a parameter, so that's what we will do
                if (((this.getId().match(/^zn-pages-collection/) && !this.isDynamic()) || this.getId().match(/^zn-pages-container/)) && name === "activeBufferIndex") {
                    return this.activeIndex;
                }
                return this[name];
            } else {
                // if all else fails, return undefined
                return undefined;
            }
        },

        slideTo: function(element, obj, animate) {
            this.log(3, {
                "func": "Commons.slideTo",
                "arguments": arguments
            });

            animate = (arguments.length < 3) ? true : animate;

            var id = obj.getId(),
                layout = obj.attr("layout"),
                position = obj.activePosition();

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
            this.log(3, {
                "func": "Commons.slideX",
                "arguments": arguments
            });

            if (animate === false) {
                element.removeClass("zn-animate").addClass("zn-noanimate");
            } else {
                element.removeClass("zn-noanimate").addClass("zn-animate");
            }

            element.css(this.whichTransformCSS(), 'translateX(' + width + 'px)');
        },

        slideY: function (element, height, animate) {
            this.log(3, {
                "func": "Commons.slideY",
                "arguments": arguments
            });

            if (animate === false) {
                element.removeClass("zn-animate").addClass("zn-noanimate");
            } else {
                element.removeClass("zn-noanimate").addClass("zn-animate");
            }

            element.css(this.whichTransformCSS(), 'translateY(' + height + 'px)');
        },

        whichTransitionEvent: function () {
            this.log(3, {
                "func": "Commons.whichTransitionEvent",
                "arguments": arguments
            });

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
            this.log(3, {
                "func": "Commons.whichTransformCSS",
                "arguments": arguments
            });

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


