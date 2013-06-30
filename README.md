angular-pages
=============
Angular directive for managing rows/columns of pages and transitions. See [Demo](http://zhenjl.github.io/angular-pages)

Let me start by thanking @revolunet for his awesome angular-carousel directive (https://github.com/revolunet/angular-carousel). Angular-pages is heavily inspired by and borrowed heavily from angular-carousel.

This is my first angular.js project. In fact, this is my first semi-real coding project in the past 7 years. Almost all the frameworks, tools, IDEs have changed in that time. So being able to learn from angular-carousel is a huge advantage. @revolunet has done an amazing job with it and if you are looking for a carousel tool, definitely check it out.

Angular-pages is a angular.js directive that lays out pages in rows and columns, and then allow users to transition between the pages, either by swiping or paging.

### Layout

There are two ways to layout the pages: by row, or by column. Here's an example for layout 3 rows (ul), and each row containing multiple pages (li).

```html
<div zn-pages zn-pages-start="1">
    <ul>
        <li>info page</li>
        <li>settings page</li>
    </ul>
    <ul zn-pages-start="1">
        <li ng-repeat="val in colors" style="background-color: {{ val }}">{{ val }}</li>
    </ul>
    <ul>
        <li>categories page</li>
    </ul>
</div>
```

Angular-pages uses two key attributes:
* __zn-pages__: zn-pages is the main directive used to specify that this is a angular-pages container. By default the layout is by row. You can specify column layout by using ``zn-pages="col"``.
* __zn-pages-start__: You can also indicate the start row and page with ``zn-pages-start`` attribute. This attribute is zero (0) based, so the first page is page 0, second page is page 1, etc. If this attribute appears in the div container, then it indicates the starting row/column. If it's part of the UL, then it indicates the starting page.

Each UL in the div is a row or a column depending on the znPages value. Each LI inside the UL is a page. You can use ng-repeat for the pages. Currently angular-pages does not support ng-repeat for the ULs. So there's always a fixed number of rows or columns. However, the number of pages in the rows/columns can by dynamic.

With the above example, angular-pages will layout the rows and pages in a 2D format. Each angular-pages container is automatically named ``zn-pages-container-#``, where # is the number assigned to the container. The container number is again zero (0) based, so the first container is ``zn-pages-container-0`` and second is ``zn-pages-container-1``.

### Transition

The users can interact with the rows and pages by either swiping (or click-hold-drag in a desktop browser), or by calling the slide-[left,right,up.down] calls for the container.

To get the object reference to the container, you must inject the znPagesManager service into your controller, and then call ``znPagesManager.collection("zn-pages-container-0")`` to retrieve the ``PagesManager`` object for the page container. From there, you can call ``.slideLeft()``, ``.slideRight()``, ``.slideUp()``, or ``.slideDown()``.

For example, in the pagesDemoController we have the following:

```javascript
$scope.slideLeft = function() {
    znPagesManager.collection('zn-pages-container-0').slideLeft();
};

$scope.slideRight = function() {
    znPagesManager.collection('zn-pages-container-0').slideRight();
};

$scope.slideDown = function() {
    znPagesManager.collection('zn-pages-container-0').slideDown();
};

$scope.slideUp = function() {
    znPagesManager.collection('zn-pages-container-0').slideUp();
};
```

Pages in rows and columns move independently from other rows and columns. This means if you slide pages in one row, the page positions in the other rows remain the same. (at least for now.)
