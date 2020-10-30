; (function () {

    function Autocomplete(element, options) {

        var id = uniqueId('cp');
        var input = element.get(0);
        var strict = options.strict || false;
        var valueField = options.valueField || "";
        var textField = options.textField || "";
        var settings = options;
        var targetSelection = options.target || element.data("target");

        var minLen = options.minLen || 3;
        var errorClass = options.errorClass;
        var className = options.className;
        var itemClassName = options.itemClassName;
        var selectedItemClassName = options.selectedItemClassName;

        // just an alias to minimize JS file size
        var doc = document;
        var container = doc.createElement("div");
        var containerStyle = container.style;
        var userAgent = navigator.userAgent;
        var mobileFirefox = userAgent.indexOf("Firefox") !== -1 && userAgent.indexOf("Mobile") !== -1;
        var debounceWaitMs = options.debounceWaitMs || 0;
        var preventSubmit = options.preventSubmit || false;
        // 'keyup' event will not be fired on Mobile Firefox, so we have to use 'input' event instead
        var keyUpEventName = mobileFirefox ? "input" : "keyup";
        var items = [];
        var list = [];
        var inputValue = "";
        var showOnFocus = options.showOnFocus;
        var selected;
        var keypressCounter = 0;
        var debounceTimer;
        var isSelected = false;
        var initialized = false;

        //funzioni eventi..
        var init = options.init;
        var onSelect = options.onSelect;
        var fetch = options.fetch;


       $(input).attr("autocomplete", "off");

        if (options.list === undefined) {
            options.list = this.data("list") || this.attr["list"];
        }
        if (!options.list || options.list === "") {
            console.error("Per attivare l'autocomplete è necessario provvedere una lista di stringhe o un oggetto datalist.");
            return;
        }

        //is it a function?
        var fn = window[options.list];
        //is it an object??
        var obj = document.getElementById(options.list) || $(options.list).get(0);
        //is it list of strings??
        var strings = options.list.split(',');

        if (fn) {
            list = [];
            fn(list);
        }
        else if (obj) {
            list = [];
            $(obj).children().each(function (index) {
                //if it is a datalist or a select, contains an option tag with value and text
                let value = $(this).val();
                let text = $(this).text();
                if (value !== text) {
                    list.push({ value: value, text: text });
                }
                else {
                    list.push(value);
                }
            });
        }
        else if (strings.length > 1) {
            list = strings;
        }
        else {
            console.error("Cannot initialize autocomplete items");
        }

        raiseCallback(init);

        if (!list || list === "") {
            console.error("Per attivare l'autocomplete è necessario provvedere una lista di stringhe o un oggetto datalist.");
            return;
        }


        

        function filterItem(text) {
            return function (element) {
                if (typeof element === "string") {
                    return (element.toLowerCase().indexOf(text) > -1);
                }
                else {
                    return (element.text.toLowerCase().indexOf(text) > -1);
                }
            };
        }

        //list = settings.list;
        if (options.fetch === undefined) {
            options.fetch = function (text) {
                text = text.toLowerCase();

                //il cerca vero e proprio lo faccio qui...
                // you can also use AJAX requests instead of preloaded data
                //var suggestions = list.filter(n => n.toLowerCase().startsWith(text));
                var suggestions = [];
                items = list.filter(filterItem(text));
                update();
            };
        }

        container.className = "autocomplete " + (options.className || "");
        
        /**
         * Detach the container from DOM
         */
        function detach() {
            var parent = container.parentNode;
            if (parent) {
                parent.removeChild(container);
            }
        }
        /**
         * Clear debouncing timer if assigned
         */
        function clearDebounceTimer() {
            if (debounceTimer) {
                window.clearTimeout(debounceTimer);
            }
        }
        /**
         * Attach the container to DOM
         */
        function attach() {
            if (!container.parentNode) {
                //input.parentNode.appendChild(container);
                doc.body.appendChild(container);
            }
        }

        /*
         * Check if container for autocomplete is displayed
         */
        function containerDisplayed() {
            return !!container.parentNode;
        }
        /**
         * Clear autocomplete state and hide container
         */
        function clear() {
            // prevent the update call if there are pending AJAX requests
            keypressCounter++;
            items = [];
            inputValue = "";
            selected = undefined;
            detach();
        }
        /**
         * Update autocomplete position
         */
        function updatePosition() {
            if (!containerDisplayed()) {
                return;
            }

            containerStyle.position = "absolute";

            if ($(input).parentsUntil(".modal").length > 0) {
                containerStyle.zIndex = 1100;
            }
            

            containerStyle.height = "auto";
            containerStyle.width = input.offsetWidth + "px";
            var maxHeight = 0;
            var inputRect;
            function calc() {
                var docEl = doc.documentElement;
                var clientTop = docEl.clientTop || doc.body.clientTop || 0;
                var clientLeft = docEl.clientLeft || doc.body.clientLeft || 0;
                var scrollTop = window.pageYOffset || docEl.scrollTop;
                var scrollLeft = window.pageXOffset || docEl.scrollLeft;
                inputRect = input.getBoundingClientRect();
                var top = inputRect.top + input.offsetHeight + scrollTop - clientTop;
                var left = inputRect.left + scrollLeft - clientLeft;
                containerStyle.top = top + "px";
                containerStyle.left = left + "px";
                maxHeight = window.innerHeight - (inputRect.top + input.offsetHeight);
                if (maxHeight < 0) {
                    maxHeight = 0;
                }
                containerStyle.top = top + "px";
                containerStyle.bottom = "";
                containerStyle.left = left + "px";
                containerStyle.maxHeight = maxHeight + "px";
            }
            // the calc method must be called twice, otherwise the calculation may be wrong on resize event (chrome browser)
            calc();
            calc();
            if (options.customize && inputRect) {
                options.customize(input, inputRect, container, maxHeight);
            }
        }
        /**
         * Redraw the autocomplete div element with suggestions
         */
        function update() {
            initialized = true;
            // delete all children from autocomplete DOM container
            while (container.firstChild) {
                container.removeChild(container.firstChild);
            }
            // function for rendering autocomplete suggestions
            var render = function (item, currentValue) {
                var itemElement = doc.createElement("div");

                if (typeof item === "string") {
                    itemElement.textContent = item || "";
                }
                else {
                    itemElement.textContent = item.text || "";
                    itemElement.setAttribute("data-value", item.text);
                }

                itemElement.className = itemClassName;
                return itemElement;
            };
            if (settings.render) {
                render = settings.render;
            }
            // function to render autocomplete groups
            var renderGroup = function (groupName, currentValue) {
                var groupDiv = doc.createElement("div");
                groupDiv.textContent = groupName;
                return groupDiv;
            };
            if (settings.renderGroup) {
                renderGroup = settings.renderGroup;
            }
            var fragment = doc.createDocumentFragment();
            var prevGroup = "#9?$";
            items.forEach(function (item) {
                if (item.group && item.group !== prevGroup) {
                    prevGroup = item.group;
                    var groupDiv = renderGroup(item.group, inputValue);
                    if (groupDiv) {
                        groupDiv.className += " group";
                        fragment.appendChild(groupDiv);
                    }
                }
                var div = render(item, inputValue);
                if (div) {
                    div.addEventListener("click", function (ev) {
                        selected = input;
                        selectItem(item, input);
                        clear();
                        ev.preventDefault();
                        ev.stopPropagation();
                    });
                    if (item === selected) {
                        div.className += " selected " + selectedItemClassName;
                    }
                    fragment.appendChild(div);
                }
            });
            container.appendChild(fragment);
            if (items.length < 1) {
                if (settings.emptyMsg) {
                    var empty = doc.createElement("div");
                    empty.className = "empty";
                    empty.textContent = settings.emptyMsg;
                    container.appendChild(empty);
                }
                else {
                    clear();
                    return;
                }
            }
            attach();
            updatePosition();
            updateScroll();
        }
        function updateIfDisplayed() {
            if (containerDisplayed()) {
                update();
            }
        }
        function resizeEventHandler() {
            updateIfDisplayed();
        }
        function scrollEventHandler(e) {
            if (e.target !== container) {
                updateIfDisplayed();
            }
            else {
                e.preventDefault();
            }
        }
        function keyupEventHandler(ev) {
            var keyCode = ev.which || ev.keyCode || 0;
            var ignore = [38 /* Up */, 13 /* Enter */, 27 /* Esc */, 39 /* Right */, 37 /* Left */, 16 /* Shift */, 17 /* Ctrl */, 18 /* Alt */, 20 /* CapsLock */, 91 /* WindowsKey */, 9 /* Tab */];
            for (var _i = 0, ignore_1 = ignore; _i < ignore_1.length; _i++) {
                var key = ignore_1[_i];
                if (keyCode === key) {
                    return;
                }
            }
            if (keyCode >= 112 /* F1 */ && keyCode <= 123 /* F12 */) {
                return;
            }
            // the down key is used to open autocomplete
            if (keyCode === 40 /* Down */ && containerDisplayed()) {
                return;
            }
            startFetch(0 /* Keyboard */);
        }
        /**
         * Automatically move scroll bar if selected item is not visible
         */
        function updateScroll() {
            var elements = container.getElementsByClassName("selected");
            if (elements.length > 0) {
                var element = elements[0];
                // make group visible
                var previous = element.previousElementSibling;
                if (previous && previous.className.indexOf("group") !== -1 && !previous.previousElementSibling) {
                    element = previous;
                }
                if (element.offsetTop < container.scrollTop) {
                    container.scrollTop = element.offsetTop;
                }
                else {
                    var selectBottom = element.offsetTop + element.offsetHeight;
                    var containerBottom = container.scrollTop + container.offsetHeight;
                    if (selectBottom > containerBottom) {
                        container.scrollTop += selectBottom - containerBottom;
                    }
                }
            }
        }
        /**
         * Select the previous item in suggestions
         */
        function selectPrev() {
            if (items.length < 1) {
                selected = undefined;
            }
            else {
                if (selected === items[0]) {
                    selected = items[items.length - 1];
                }
                else {
                    for (var i = items.length - 1; i > 0; i--) {
                        if (selected === items[i] || i === 1) {
                            selected = items[i - 1];
                            break;
                        }
                    }
                }
            }
        }
        /**
         * Select the next item in suggestions
         */
        function selectNext() {
            if (items.length < 1) {
                selected = undefined;
            }
            if (!selected || selected === items[items.length - 1]) {
                selected = items[0];
                return;
            }
            for (var i = 0; i < (items.length - 1); i++) {
                if (selected === items[i]) {
                    selected = items[i + 1];
                    break;
                }
            }
        }

        function selectItem(item, input) {
            selected = item;
            isSelected = true;
            if (strict) {

                input.setCustomValidity("");
                input.classList.remove(errorClass);
            }
            if (typeof selected === "string") {
                input.value = selected;
            }
            else {
                input.value = selected.text;
                $(input).val(selected.text);
                $(input).data("value", selected.value);
            }

            if (settings.onSelect) {
                settings.onSelect(selected, input, targetSelection);
            }
        }

        function keydownEventHandler(ev) {
            isSelected = false;
            var keyCode = ev.which || ev.keyCode || 0;
            if (keyCode === 38 /* Up */ || keyCode === 40 /* Down */ || keyCode === 27 /* Esc */) {
                var containerIsDisplayed = containerDisplayed();
                if (keyCode === 27 /* Esc */) {
                    clear();
                }
                else {
                    if (!containerDisplayed || items.length < 1) {
                        return;
                    }
                    keyCode === 38 /* Up */
                        ? selectPrev()
                        : selectNext();
                    update();
                }
                ev.preventDefault();
                if (containerIsDisplayed) {
                    ev.stopPropagation();
                }
                return;
            }
            if (keyCode === 13 /* Enter */) {
                if (selected) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    selectItem(selected, input);
                    clear();
                }
                if (preventSubmit) {
                    ev.preventDefault();
                }
            }
            if (keyCode === 9 /* TAB */) {
                if (strict) {
                    if (selected) {
                        selectItem(selected, input);
                        clear();
                    }
                    else {
                        isSelected = false;
                    }
                }
            }
        }
        function focusEventHandler() {
            if (showOnFocus) {
                startFetch(1 /* Focus */);
            }
        }
        function startFetch(trigger) {
            // if multiple keys were pressed, before we get update from server,
            // this may cause redrawing our autocomplete multiple times after the last key press.
            // to avoid this, the number of times keyboard was pressed will be
            // saved and checked before redraw our autocomplete box.
            var savedKeypressCounter = ++keypressCounter;
            var val = input.value;
            if (val.length >= minLen || trigger === 1 /* Focus */) {
                clearDebounceTimer();
                debounceTimer = window.setTimeout(function () {
                    settings.fetch(val, function (elements) {
                        if (keypressCounter === savedKeypressCounter && elements) {
                            items = elements;
                            inputValue = val;
                            selected = items.length > 0 ? items[0] : undefined;
                            update();
                        }
                    }, 0 /* Keyboard */);
                }, trigger === 0 /* Keyboard */ ? debounceWaitMs : 0);
            }
            else {
                clear();
            }
        }
        function blurEventHandler() {
            // we need to delay clear, because when we click on an item, blur will be called before click and remove items from DOM
            setTimeout(function () {
                if (doc.activeElement !== input) {
                    clear();
                }
            }, 200);

            if (strict === true & isSelected === false & initialized === true) {
                if (items.length > 1 & !items.includes(input.value)) {
                    //input.value ="";
                    input.classList.add(errorClass);
                    input.setCustomValidity("Invalid field.");
                }
                else if (items.length === 1 & input.value.length >= minLen) {
                    input.value = selected;
                    input.classList.remove(errorClass);
                    input.setCustomValidity("");
                }
                else if (items.length === 0 & input.value.length >= minLen) {
                    //input.value = "";
                    input.classList.add(errorClass);
                    input.setCustomValidity("Invalid field.");
                }
                else if (items.length === 0 & input.value.length === 0) {
                    input.classList.remove(errorClass);
                    input.setCustomValidity("");
                }
            }

        }
        /**
         * Fixes #26: on long clicks focus will be lost and onSelect method will not be called
         */
        container.addEventListener("mousedown", function (evt) {
            evt.stopPropagation();
            evt.preventDefault();
        });
        /**
         * Fixes #30: autocomplete closes when scrollbar is clicked in IE
         * See: https://stackoverflow.com/a/9210267/13172349
         */
        container.addEventListener("focus", function () { return input.focus(); });
        /**
         * This function will remove DOM elements and clear event handlers
         */
        function destroy() {
            input.removeEventListener("focus", focusEventHandler);
            input.removeEventListener("keydown", keydownEventHandler);
            input.removeEventListener(keyUpEventName, keyupEventHandler);
            input.removeEventListener("blur", blurEventHandler);
            window.removeEventListener("resize", resizeEventHandler);
            doc.removeEventListener("scroll", scrollEventHandler, true);
            clearDebounceTimer();
            clear();
        }
        // setup event handlers
        input.addEventListener("keydown", keydownEventHandler);
        input.addEventListener(keyUpEventName, keyupEventHandler);
        input.addEventListener("blur", blurEventHandler);
        input.addEventListener("focus", focusEventHandler);
        window.addEventListener("resize", resizeEventHandler);
        doc.addEventListener("scroll", scrollEventHandler, true);
        return {
            destroy: destroy
        };
    }

    // Get a unique id
    var idCounter = 0;
    function uniqueId(prefix) {
        var id = ++idCounter + '';
        return prefix ? prefix + id : id;
    }

    function raiseCallback(callbackFunction) {
        if (callbackFunction && typeof callbackFunction === "function") {
            callbackFunction();
        }
    }

    // Default options
    Autocomplete.DEFAULTS = {
        //'default': '',       // default time, 'now' or '13:14' e.g.
        //fromnow: 0,          // set default time to * milliseconds from now (using with default = 'now')
        //placement: 'bottom', // clock popover placement
        //align: 'left',       // popover arrow align
        //donetext: 'Fatto',    // done button text
        //autoclose: false,    // auto close when minute is selected
        //twelvehour: false, // change to 12 hour AM/PM clock from 24 hour
        //vibrate: true        // vibrate the device when dragging clock hand
    };

    // Extends $.fn.clockpicker
    $.fn.autocomplete = function (option) {
        var args = Array.prototype.slice.call(arguments, 1);
        return this.each(function () {
            var $this = $(this),
                data = $this.data('autocomplete');
            if (!data) {
                var options = $.extend({}, Autocomplete.DEFAULTS, $this.data(), typeof option === 'object' && option);
                $this.data('autocomplete', new Autocomplete($this, options));
            } else {
                // Manual operatsions. show, hide, remove, e.g.
                if (typeof data[option] === 'function') {
                    data[option].apply(data, args);
                }
            }
        });
    };

}());
