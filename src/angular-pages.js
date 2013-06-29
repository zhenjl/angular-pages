/**
 * Copyright (c) 2013 Zhen, LLC. http://zhen.io
 *
 * MIT License
 *
 * Angular directive that lays out multiple pages and transition between them
 * http://github.com/zhenjl/angular-pages
 *
 */

'use strict';

var app = angular.module("angular-pages", []);

app.directive("znPagesCollection", ['znPagesManager', 'znUtils', function (znPagesManager, znUtils) {
    return {
        restrict: "A",
        scope: true,
        compile: function (element, attrs) {
            znUtils.log(3, {
                "func": "znPagesCollection.compile",
                "arguments": arguments
            });

            var children = element.find("li"),
                ngRepeatElem = angular.element(children[0]),
                expression = ngRepeatElem.attr('ng-repeat'),
                collectionName;

            if (expression != undefined) {
                var match = expression.match(/^\s*(.+)\s+in\s+(.*?)\s*(\s+track\s+by\s+(.+)\s*)?$/),
                    lhs = match[1],
                    trackByExp = match[4];

                collectionName = match[2];
                ngRepeatElem.attr('ng-repeat', lhs + ' in znPagesBuffer track by ' + trackByExp);
                //ngRepeatElem.addClass('zn-animate');
            }

            return function (scope, element, attrs) {
                znUtils.log(3, {
                    "func": "znPagesCollection.link",
                    "arguments": arguments
                });

                var collectionId = attrs['znPagesCollectionId'] ? attrs['znPagesCollectionId'] : 0,
                    parentId = attrs['znPagesContainerId'] ? attrs['znPagesContainerId'] : 0,
                    layout = attrs['znPagesCollection'] === "col" ? "col" : "row",
                    start = attrs['znPagesStart'] ? Math.max(0, parseInt(attrs['znPagesStart']) - 1) : 0,
                    collectionElem = element.wrap('<div id="' + collectionId + '" zn-pages-start="' + start + '" class="zn-pages-' + layout + '"></div>').parent(),
                    children = element.find("li"),
                    collectionManager = znPagesManager.newCollection(collectionId);

                scope.collectionManager = collectionManager;

                collectionManager.attr({
                    "width": collectionElem[0].getBoundingClientRect().width,
                    "height": collectionElem[0].getBoundingClientRect().height,
                    "layout": layout,
                    "startPage": start,
                    "totalPages": children.length,
                    "activePage": start,
                    "parent": parentId
                });

                function slideTo(element, page, animate) {
                    znUtils.log(3, {
                        "func": "znPagesCollection.link.slideTo",
                        "arguments": arguments
                    });

                    animate = (arguments.length < 3) ? true : animate;

                    // Make sure page is within the buffer bound
                    //page = Math.max(0, Math.min(page, scope.znPagesBuffer.length-1));

                    if (collectionManager.attr("layout") === "row") {
                        znUtils.slideX(element, -collectionManager.attr("width") * page, animate);
                    } else {
                        znUtils.slideY(element, -collectionManager.attr("height") * page, animate);
                    }
                }

                if (collectionName) {
                    collectionManager._updateCollection(scope.$eval(collectionName));

                    scope.$watch(collectionName, function (newValue, oldValue) {
                        znUtils.log(3, {
                            "func": "znPagesCollection.link.$watch collectionName",
                            "arguments": arguments
                        });

                        if (newValue != undefined && !angular.equals(newValue,oldValue)) {
                            collectionManager._updateCollection(newValue);
                            scope.znPagesBuffer = collectionManager._buffer();
                            slideTo(collectionElem, collectionManager.attr("activeBufferPage"), false);
                        }
                    }, true);

                    scope.znPagesBuffer = collectionManager._buffer();
                }

                slideTo(collectionElem, collectionManager.attr("activeBufferPage"), false);

                scope.$watch("collectionManager._hasMoved()", function(newValue, oldValue) {
                    // newValue and oldValue are undefined when it's triggered the first time
                    // so let's ignore that

                    if (newValue != undefined && newValue !== oldValue) {
                        znUtils.log(3, {
                            "func": "znPagesCollection.link.$watch collectionManager._hasMoved()",
                            "arguments": arguments
                        });

                        // The new active page should be the old active page + the pages moved
                        // Also making sure the new active page is within buffer bound

                        if (collectionManager._isDynamic()) {
                            slideTo(collectionElem,
                                Math.max(0,
                                    Math.min(collectionManager.attr("activeBufferPage")+collectionManager._pagesMoved(),
                                        collectionManager._buffer().length-1)),
                                true);
                        } else {
                            slideTo(collectionElem,
                                Math.max(0,
                                    Math.min(collectionManager.attr("activeBufferPage")+collectionManager._pagesMoved(),
                                        collectionManager._totalPages()-1)),
                                true);
                        }
                    }
                });

                // the transitionEnd event listener only gets executed when there's animation
                // If animation is set to none, then this will not get called

                collectionElem[0].addEventListener(znUtils.whichTransitionEvent(), function(event) {
                    if (event.target.id.match("^zn-pages-collection")) {
                        scope.$apply(function() {
                            znUtils.log(3, {
                                "func": "znPagesCollection.link.addEventListener transitionEnd",
                                "arguments": arguments
                            });

                            var collectionManager = scope.collectionManager,
                                pagesMoved = collectionManager._pagesMoved();

                            if (collectionManager._isDynamic()) {
                                var newBuffer = collectionManager._updateBuffer(pagesMoved),
                                    activeBufferPage = collectionManager.attr("activeBufferPage");

                                // If we moved to previous page (pagesMoved == -1), and the new buffer and
                                // the old buffer are the same, then it means we are at the top of the collection.
                                // So let's not do anything.
                                //
                                // However, if the buffers are different, then let's make sure it's displaying the
                                // the updated active page, which should be the same page content as before, assuming
                                // the same page content exist in the new buffer

                                if (!(pagesMoved < 0 && angular.equals(newBuffer, scope.znPagesBuffer))) {
                                    scope.znPagesBuffer = newBuffer;
                                    slideTo(collectionElem, activeBufferPage, false);
                                }
                            } else {
                                collectionManager.attr('activePage', Math.max(0,
                                    Math.min(collectionManager.attr("activePage")+collectionManager._pagesMoved(),
                                        collectionManager._totalPages()-1)));
                            }
                        });
                    }
                }, false)
            }
        }
    }
}]);

app.directive("znPages", ["znSwipe", 'znPagesManager', 'znUtils', function (znSwipe, znPagesManager, znUtils) {
    var containerCount = 0;

    return {
        restrict: "A",
        scope: true,
        compile: function (element, attrs) {
            znUtils.log(3, {
                "func": "znPages.compile",
                "arguments": arguments
            });

            containerCount++;

            var layout = attrs['znPages'] === "col" ? attrs['znPages'] : "row",
                containerId = 'zn-pages-container-' + containerCount,
                children = element.find("ul");

            element.addClass('zn-pages-container');

            angular.forEach(children, function (child, index) {
                angular.element(child).attr({
                    'zn-pages-collection': layout,
                    'zn-pages-container-id': containerId,
                    'zn-pages-collection-id': 'zn-pages-collection-' + containerCount + '-' + index
                })
            });

            element.html('<div id="' + containerId + '" class="zn-pages-' + layout + '">' + element.html() + '</div>');

            return function(scope, element, attrs) {
                znUtils.log(3, {
                    "func": "znPages.link",
                    "arguments": arguments
                });

                // We are using collection manager to manage container movement as well
                // Assumption here is the container collection is not ng-repeat/dynamic collection

                var layout = attrs['znPages'] === "col" ? "col" : "row",
                    start = attrs['znPagesStart'] ? Math.max(0, parseInt(attrs['znPagesStart']) - 1) : 0,
                    uls = element.find("ul"),
                    containerElem = angular.element(element.children()[0]), // the newly added div container
                    containerId = containerElem.attr('id'),
                    collectionManager = znPagesManager.newCollection(containerId);

                scope.collectionManager = collectionManager;

                collectionManager.attr({
                    "width": containerElem[0].getBoundingClientRect().width,
                    "height": containerElem[0].getBoundingClientRect().height,
                    "layout": layout,
                    "start": start,
                    "totalPages": uls.length,
                    "activePage": start
                });

                var children = containerElem.children(),
                    childrenIDs = [],
                    childrenElem = {};

                for (var i = 0; i < children.length; i++) {
                    var e = angular.element(children[i]),
                        id = e.attr("id");
                    childrenIDs.push(id);
                    childrenElem[id] = e;
                }

                collectionManager.attr("children", childrenIDs);

                function slideTo(element, page, animate) {
                    znUtils.log(3, {
                        "func": "znPages.link.slideTo",
                        "arguments": arguments
                    });

                    animate = (arguments.length < 3) ? true : animate;

                    // Make sure page is within the buffer bound
                    //page = Math.max(0, Math.min(page, scope.znPagesBuffer.length-1));

                    if (collectionManager.attr("layout") === "row") {
                        znUtils.slideY(element, -collectionManager.attr("height") * page, animate);
                    } else {
                        znUtils.slideX(element, -collectionManager.attr("width") * page, animate);
                    }
                }

                slideTo(containerElem, Math.max(0, Math.min(collectionManager.attr("activeBufferPage"), collectionManager._totalPages()-1)), false);

                scope.$watch("collectionManager._hasMoved()", function(newValue, oldValue) {
                    // newValue and oldValue are undefined when it's triggered the first time
                    // so let's ignore that

                    if (newValue != undefined && newValue !== oldValue) {
                        znUtils.log(3, {
                            "func": "znPages.link.$watch collectionManager._hasMoved()",
                            "arguments": arguments
                        });

                        // The new active page should be the old active page + the pages moved
                        // Also making sure the new active page is within buffer bound

                        slideTo(containerElem, Math.max(0, Math.min(collectionManager.attr("activeBufferPage")+collectionManager._pagesMoved(), collectionManager._totalPages() - 1)), true);
                    }
                });

                containerElem[0].addEventListener(znUtils.whichTransitionEvent(), function(event) {
                    if (event.target.id.match("^zn-pages-container")) {
                        scope.$apply(function() {
                            znUtils.log(3, {
                                "func": "znPages.link.addEventListener transitionEnd",
                                "arguments": arguments
                            });

                            var collectionManager = scope.collectionManager;

                            collectionManager.attr('activePage', Math.max(0,
                                Math.min(collectionManager.attr("activePage")+collectionManager._pagesMoved(),
                                    collectionManager._totalPages()-1)));

                        });
                    }

                }, false);

                var startPos,            // coordinates of the last position
                    moveX;              // moving horizontally (X) or vertically (!X)

                znSwipe.bind(containerElem, {
                    start: function(coords) {
                        startPos = coords;
                        moveX = undefined;
                    },

                    move: function(coords) {
                        if (!startPos) return;

                        var collectionManager = scope.collectionManager;

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
                                cm = collectionManager;
                            } else {
                                childId = collectionManager.attr("children")[collectionManager.attr("activePage")];
                                e = childrenElem[childId];
                                cm = znPagesManager.collection(childId);
                            }

                            active = cm.attr("activeBufferPage");
                            ratio = ((cm._isHead() && offset > 0) || (cm._isTail() && offset < 0)) ? 3 : 1;
                            newX = -cm.attr("width") * active + Math.round(offset / ratio);

                            znUtils.slideX(e, newX, false);
                        } else {
                            offset = coords.y - startPos.y;

                            if (layout === "col") {
                                 childId = collectionManager.attr("children")[collectionManager.attr("activePage")];
                                e = childrenElem[childId];
                                cm = znPagesManager.collection(childId);
                            } else {
                                e = containerElem;
                                cm = collectionManager;
                            }

                            active = cm.attr("activeBufferPage");
                            ratio = ((cm._isHead() && offset > 0) || (cm._isTail() && offset < 0)) ? 3 : 1;
                            newY = -cm.attr("height") * active + Math.round(offset / ratio);

                            znUtils.slideY(e, newY, false);
                        }
                    },

                    end: function(coords) {
                        if (!startPos || moveX == undefined) return;

                        scope.$apply(function() {
                            var cm = null,
                                childId = null,
                                delta = 0,
                                move = false,
                                collectionManager = scope.collectionManager;

                            if (moveX) {
                                if (layout === "col") {
                                    cm = collectionManager;
                                } else {
                                    childId = collectionManager.attr("children")[collectionManager.attr("activePage")];
                                    cm = znPagesManager.collection(childId);
                                }

                                delta = coords.x - startPos.x;
                                move = Math.abs(delta) >= cm.attr("width") * 0.1;

                                if ((cm._isHead() && delta > 0) || (cm._isTail() && delta < 0) || !move) {
                                    cm._hasMoved(0);
                                } else {
                                    delta > 0 ? collectionManager.slideRight() : collectionManager.slideLeft();
                                }
                            } else {
                                if (layout === "col") {
                                    childId = collectionManager.attr("children")[collectionManager.attr("activePage")];
                                    cm = znPagesManager.collection(childId);
                                } else {
                                    cm = collectionManager;
                                }

                                delta = coords.y - startPos.y;
                                move = Math.abs(delta) >= cm.attr("height") * 0.1;

                                if ((cm._isHead() && delta > 0) || (cm._isTail() && delta < 0) || !move) {
                                    cm._hasMoved(0);
                                } else {
                                    delta < 0 ? collectionManager.slideUp() : collectionManager.slideDown();
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

app.factory("znPagesManager", ['znUtils', function (znUtils) {
    var _collections = {};

    function CollectionManager(id, collection) {
        znUtils.log(3, {
            "func": "CollectionManager.constructor",
            "arguments": arguments
        });

        this._options = {
            id: id,                         // Collection ID
            startPage: -1,                  // Starting page number
            collection: null,               // Original item collection that's ng-repeat'ed
            collectionKeys: null,           // The keys to the collection, = collection if array, = keys if object
            totalPages: 0,                  // Total number of pages in this collection
            buffer: [],                     // The current buffer being displayed, size = 3
            bufferStart: -1,                // The starting position of the buffer relative to collectionKeys
            bufferSize: 3,                  // Size of the buffer to start, TODO: allow change of this later
            activeBufferPage: -1,           // The buffer page being displayed
            activeBufferKey: null,          // The buffer page key being displayed
            activePage: -1,                  // The active page in the collection
            moved: 0,                   // Did we update the buffer?
            pagesMoved: 0                   // Number of pages moved
        };

        this._collections = _collections;

        if (collection) {
            this._updateCollection(collection);
        }
    }

    CollectionManager.prototype._updateCollection = function(collection) {
        znUtils.log(3, {
            "func": "CollectionManager._updateCollection",
            "arguments": arguments
        });

        var collectionKeys = [];

        if (collection == undefined) {
            return
        }

        // Get the list of updated keys, and see if we can find the current key in the update list
        // If collection is an array then just use that
        // If collection is an object map, then extract the keys and sort that

        if (angular.isArray(collection)) {
            collectionKeys = collection;
        } else {
            for (var key in collection) {
                if (collection.hasOwnProperty(key) && key.charAt(0) != '$') {
                    collectionKeys.push(key);
                }
            }

            collectionKeys.sort();
        }

        // Save the parameters
        this._options.collectionKeys = collectionKeys;
        this._options.collection = collection;
        this._options.totalPages = collectionKeys.length;

        // Update the display buffer based on the updated collection
        this._updateBuffer();
    };

    CollectionManager.prototype._getKeyPosition = function(key) {
        znUtils.log(3, {
            "func": "CollectionManager._getKeyPosition",
            "arguments": arguments
        });

        // Go through the collection and find the item that matches what's currently being
        // displayed, and update the current page number to the new location of displayed item

        if (this._options.collectionKeys != undefined && key != undefined) {
            for (var i = 0; i < this._options.collectionKeys.length; i++) {
                if (this._options.collectionKeys[i] === key) {
                    return i;
                }
            }
        }

        return -1;
    };

    // Create the buffer for display. Buffer size is 3.
    //
    // TODO: Allow buffer size change
    CollectionManager.prototype._updateBuffer = function(change) {
        znUtils.log(3, {
            "func": "CollectionManager._updateBuffer",
            "arguments": arguments
        });

        var _o = this._options;

        // No collection defined, can't setup the buffer, leaving
        if (!_o.collectionKeys) {
            return;
        }

        var bufferStart, bufferEnd, bufferKeys, activeBufferPage, active;

        if (_o.buffer.length === 0) {
            // buffer size is 0 means there's nothing in the buffer, most likely never set, so let's set
            // it up using the start page.

            active = this._startPage();
        } else if (_o.collectionKeys[_o.activeBufferPage] !== _o.activeBufferKey) {
            // If the actual key in the collection pointed to by the page index in the collection
            // is no longer the same as the saved key, then we know the array has shifted and positions
            // have been changed. So let's find the new index for the saved key, and keep the saved key
            // in the current display, and update the buffer around it

            active = this._getKeyPosition(_o.activeBufferKey);
        } else {
            // By now, we know the buffer has been set before, and that the saved key is the same
            // as the collection key that's pointed to by the page index, then we just keep
            // the same active key and just update the buffer around it

            active = _o.activeBufferPage;
        }

        // active should be previous_active + change
        active = Math.max(0, Math.min(active+(change ? change : 0), _o.totalPages-1));

        // - If the active page is 0, which means it's the beginning, then the bufferStart has to
        //   be 0 as well
        // - If the active page is greater than 0, then let's start the buffer at one element
        //   before the active page, so the displaying page is always in the middle of the buffer
        // - Technically we should never see start < 0

        bufferStart = Math.max(0, Math.min(active-1, _o.totalPages-1));
        activeBufferPage = active - bufferStart;
        bufferEnd = bufferStart + this._options.bufferSize;
        bufferKeys = this._options.collectionKeys.slice(bufferStart, bufferEnd);

        // Create the display buffer, return either array or object map depending on the
        // original collection

        if (angular.isArray(this._options.collection)) {
            this._options.buffer = bufferKeys;
        } else {
            this._options.buffer = {};

            for (var i = 0; i < bufferKeys.length; i++) {
                var key = bufferKeys[i];
                this._options.buffer[key] = this._options.collection[key];
            }
        }

        this._options.bufferStart = bufferStart;
        this._options.activeBufferPage = activeBufferPage;
        this._options.activePage = active;
        this._options.activeBufferKey = this._options.buffer[activeBufferPage];

        return this._options.buffer;
    };

    // Set or get attributes for the collection manager
    CollectionManager.prototype.attr = function(name, value) {
        znUtils.log(3, {
            "func": "CollectionManager.attr",
            "arguments": arguments
        });

        if (angular.isObject(name)) {
            // if the name is a object map, then loop through the properties and set them individually

            for (var i in name) {
                if (name.hasOwnProperty(i)) this.attr(i, name[i]);
            }
        } else if (name != undefined && value != undefined) {
            // if both parameters exist, then we assume we are setting an attribute
            // For a couple of the properties we do some special treatment
            // Otherwise we just save the properties
            if (name === "collection") {
                this._updateCollection(value);
            } else if (name === "start" || name === "startIndex" || name === "startPage") {
                this._startPage(value);
            } else if (name === "activePage") {
                this._options[name] = value;

                // If this is NOT a dynamic collection, i.e., non-ng-repeat, then let's keep
                // the activePage and activeBufferPage the same
                if (!this._isDynamic()) this._options.activeBufferPage = value;
            } else {
                this._options[name] = value;
            }
        } else if (name != undefined) {
            // if name is defined and value is undefined, then we assume we are retrieving
            // a parameter, so that's what we will do
            return this._options[name];
        } else {
            // if all else fails, return undefined
            return undefined;
        }
    };

    CollectionManager.prototype._isDynamic = function() {
        znUtils.log(3, {
            "func": "CollectionManager._isDynamic",
            "arguments": arguments
        });

        return (this._options.collection != null);
    };

    CollectionManager.prototype._isHead = function() {
        znUtils.log(3, {
            "func": "CollectionManager._isDynamic",
            "arguments": arguments
        });

        return (this._options.activePage === 0);
    };

    CollectionManager.prototype._isTail = function() {
        znUtils.log(3, {
            "func": "CollectionManager._isDynamic",
            "arguments": arguments
        });

        return (this._options.activePage === (this._options.totalPages-1));
    };

    CollectionManager.prototype._buffer = function() {
        znUtils.log(3, {
            "func": "CollectionManager._buffer",
            "arguments": arguments
        });

        return this.attr("buffer");
    };

    CollectionManager.prototype._hasMoved = function(moved) {
        znUtils.log(3, {
            "func": "CollectionManager._hasMoved",
            "arguments": arguments
        });

        if (moved != undefined) {
            this._options.pagesMoved = moved;
            this._options.moved++;
        }

        return this._options.moved;
    };

    CollectionManager.prototype._pagesMoved = function() {
        znUtils.log(3, {
            "func": "CollectionManager.pagesMoved",
            "arguments": arguments
        });

        return this._options.pagesMoved;
    };

    CollectionManager.prototype._startPage = function(start) {
        znUtils.log(3, {
            "func": "CollectionManager._startPage",
            "arguments": arguments
        });

        if (start != undefined) {
            this._options.startPage = start;
        }

        return Math.max(0, Math.min(this._options.startPage, this._options.totalPages-1));
    };

    CollectionManager.prototype._totalPages = function(pages) {
        znUtils.log(3, {
            "func": "CollectionManager._totalPages",
            "arguments": arguments
        });

        // if we are setting the total pages, we also need to update the start page because the
        // user may have set the start page before setting the total pages. If they did that,
        // the start page may not be correct as it was bounded to be no bigger than the total page

        if (pages != undefined) {
            this.attr("totalPages", pages);
        }
        return this.attr("totalPages");
    };

    CollectionManager.prototype._slidePrev = function() {
        znUtils.log(3, {
            "func": "CollectionManager.slidePrev",
            "arguments": arguments
        });

        this._options.pagesMoved = -1;
        this._options.moved++;
    };

    CollectionManager.prototype._slideNext = function() {
        znUtils.log(3, {
            "func": "CollectionManager.slideNext",
            "arguments": arguments
        });

        this._options.pagesMoved = 1;
        this._options.moved++;
    };

    CollectionManager.prototype.slideLeft = function() {
        znUtils.log(3, {
            "func": "CollectionManager.slideLeft",
            "arguments": arguments
        });

        if (this._options.id.match("^zn-pages-container")) {
            // If this is a container, then
            // 1. If column layout, slide left means showing column on right
            // 2. If row layout, slide left means showing the page on the right of the active row
            if (this._options.layout === "col") {
                this._slideNext();
            } else {
                var child = this._collections[this._options.children[this._options.activePage]];
                child._slideNext();
            }
        } else if (this._options.id.match("^zn-pages-collection")) {
            // If this is a collection, then
            // 1. If column layout, slide left means showing page on right
            // 2. If row layout, slide left means showing the column on the right of the container
            if (this._options.layout === "col") {
                this._slideNext();
            } else {
                var parent = this._collections[this._options.parent];
                parent._slideNext();
            }
        }
    };

    CollectionManager.prototype.slideRight = function() {
        znUtils.log(3, {
            "func": "CollectionManager.slideRight",
            "arguments": arguments,
            "options": this._options
        });

        if (this._options.id.match("^zn-pages-container")) {
            // If this is a container, then
            // 1. If column layout, slide right means showing column on left
            // 2. If row layout, slide right means showing the page on the left of the active row
            if (this._options.layout === "col") {
                this._slidePrev();
            } else {
                var child = this._collections[this._options.children[this._options.activePage]];
                child._slidePrev();
            }
        } else if (this._options.id.match("^zn-pages-collection")) {
            // If this is a collection, then
            // 1. If column layout, slide right means showing page on left
            // 2. If row layout, slide right means showing the column on the left of the container
            if (this._options.layout === "col") {
                this._slidePrev();
            } else {
                var parent = this._collections[this._options.parent];
                parent._slidePrev();
            }
        }
    };

    CollectionManager.prototype.slideUp = function() {
        znUtils.log(3, {
            "func": "CollectionManager.slideUp",
            "arguments": arguments
        });

        if (this._options.id.match("^zn-pages-container")) {
            // If this is a container, then
            // 1. If column layout, slide up means showing page below in the active row
            // 2. If row layout, slide up means showing the row below
            if (this._options.layout === "col") {
                var child = this._collections[this._options.children[this._options.activePage]];
                child._slideNext();
            } else {
                this._slideNext();
            }
        } else if (this._options.id.match("^zn-pages-collection")) {
            // If this is a collection, then
            // 1. If column layout, slide up means showing page below
            // 2. If row layout, slide up means showing the row below in the parent container
            if (this._options.layout === "col") {
                this._slideNext();
            } else {
                var parent = this._collections[this._options.parent];
                parent._slideNext();
            }
        }
    };

    CollectionManager.prototype.slideDown = function() {
        znUtils.log(3, {
            "func": "CollectionManager.slideDown",
            "arguments": arguments
        });

        if (this._options.id.match("^zn-pages-container")) {
            // If this is a container, then
            // 1. If column layout, slide down means showing page above in the active row
            // 2. If row layout, slide down means showing the row above
            if (this._options.layout === "col") {
                var child = this._collections[this._options.children[this._options.activePage]];
                child._slidePrev();
            } else {
                this._slidePrev();
            }
        } else if (this._options.id.match("^zn-pages-collection")) {
            // If this is a collection, then
            // 1. If column layout, slide down means showing page below
            // 2. If row layout, slide down means showing the row below in the parent container
            if (this._options.layout === "col") {
                this._slidePrev();
            } else {
                var parent = this._collections[this._options.parent];
                parent._slidePrev();
            }
        }
    };

    return {
        newCollection: function(id, collection) {
            znUtils.log(3, {
                "func": "znPagesManager.newCollection",
                "arguments": arguments
            });

            if (!_collections[id]) {
                _collections[id] = new CollectionManager(id, collection);
            } else {
                _collections[id].attr("collection", collection);
            }

            return _collections[id];
        },

        collection: function(id) {
            znUtils.log(3, {
                "func": "znPagesManager.collection",
                "arguments": arguments
            });

            return _collections[id];
        },

        // angular.element("body").injector().get('znPagesManager').collections();
        collections: function() {
            znUtils.log(3, {
                "func": "znPagesManager.collections",
                "arguments": arguments
            });

            return _collections;
        }
    }
}]);

app.value('znUtils', {
    log: function() {
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

    slideX: function(element, width, animate) {
        this.log(3, {
            "func": "znUtils.slideX",
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
            "func": "znUtils.slideY",
            "arguments": arguments
        });

        if (animate === false) {
            element.removeClass("zn-animate").addClass("zn-noanimate");
        } else {
            element.removeClass("zn-noanimate").addClass("zn-animate");
        }

        element.css(this.whichTransformCSS(), 'translateY(' + height + 'px)');
    },

    whichTransitionEvent: function() {
        this.log(3, {
            "func": "znUtils.whichTransitionEvent",
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

    whichTransformCSS: function() {
        this.log(3, {
            "func": "znUtils.whichTransformCSS",
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
});

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

app.factory('znSwipe', [function() {
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
        bind: function(element, eventHandlers) {
            // Absolute total movement, used to control swipe vs. scroll.
            var totalX, totalY;
            // Coordinates of the start position.
            var startCoords;
            // Last event's position.
            var lastPos;
            // Whether a swipe is active.
            var active = false;

            element.bind('touchstart mousedown', function(event) {
                startCoords = getCoordinates(event);
                active = true;
                totalX = 0;
                totalY = 0;
                lastPos = startCoords;
                eventHandlers['start'] && eventHandlers['start'](startCoords);
            });

            element.bind('touchcancel', function(event) {
                active = false;
                eventHandlers['cancel'] && eventHandlers['cancel']();
            });

            element.bind('touchmove mousemove', function(event) {
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

            element.bind('touchend mouseup', function(event) {
                if (!active) return;
                active = false;
                eventHandlers['end'] && eventHandlers['end'](getCoordinates(event));
            });
        }
    };
}]);


