/*
 * Copyright (C) 2023  Yomitan Authors
 * Copyright (C) 2019-2022  Yomichan Authors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * Converts an `Error` object to a serializable JSON object.
 * @param {*} error An error object to convert.
 * @returns {{name: string, message: string, stack: string, data?: *}|{value: *, hasValue: boolean}} A simple object which can be serialized by `JSON.stringify()`.
 */
function serializeError(error) {
    try {
        if (typeof error === 'object' && error !== null) {
            const result = {
                name: error.name,
                message: error.message,
                stack: error.stack
            };
            if (Object.prototype.hasOwnProperty.call(error, 'data')) {
                result.data = error.data;
            }
            return result;
        }
    } catch (e) {
        // NOP
    }
    return {
        value: error,
        hasValue: true
    };
}

/**
 * Converts a serialized erorr into a standard `Error` object.
 * @param {{name: string, message: string, stack: string, data?: *}|{value: *, hasValue: boolean}} serializedError A simple object which was initially generated by serializeError.
 * @returns {Error|*} A new `Error` instance.
 */
function deserializeError(serializedError) {
    if (serializedError.hasValue) {
        return serializedError.value;
    }
    const error = new Error(serializedError.message);
    error.name = serializedError.name;
    error.stack = serializedError.stack;
    if (Object.prototype.hasOwnProperty.call(serializedError, 'data')) {
        error.data = serializedError.data;
    }
    return error;
}

/**
 * Checks whether a given value is a non-array object.
 * @param {*} value The value to check.
 * @returns {boolean} `true` if the value is an object and not an array, `false` otherwise.
 */
function isObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Converts any string into a form that can be passed into the RegExp constructor.
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions
 * @param {string} string The string to convert to a valid regular expression.
 * @returns {string} The escaped string.
 */
function escapeRegExp(string) {
    return string.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Reverses a string.
 * @param {string} string The string to reverse.
 * @returns {string} The returned string, which retains proper UTF-16 surrogate pair order.
 */
function stringReverse(string) {
    return [...string].reverse().join('');
}

/**
 * Creates a deep clone of an object or value. This is similar to `JSON.parse(JSON.stringify(value))`.
 * @param {*} value The value to clone.
 * @returns {*} A new clone of the value.
 * @throws An error if the value is circular and cannot be cloned.
 */
const clone = (() => {
    // eslint-disable-next-line no-shadow
    function clone(value) {
        if (value === null) { return null; }
        switch (typeof value) {
            case 'boolean':
            case 'number':
            case 'string':
            case 'bigint':
            case 'symbol':
            case 'undefined':
                return value;
            default:
                return cloneInternal(value, new Set());
        }
    }

    function cloneInternal(value, visited) {
        if (value === null) { return null; }
        switch (typeof value) {
            case 'boolean':
            case 'number':
            case 'string':
            case 'bigint':
            case 'symbol':
            case 'undefined':
                return value;
            case 'function':
                return cloneObject(value, visited);
            case 'object':
                return Array.isArray(value) ? cloneArray(value, visited) : cloneObject(value, visited);
        }
    }

    function cloneArray(value, visited) {
        if (visited.has(value)) { throw new Error('Circular'); }
        try {
            visited.add(value);
            const result = [];
            for (const item of value) {
                result.push(cloneInternal(item, visited));
            }
            return result;
        } finally {
            visited.delete(value);
        }
    }

    function cloneObject(value, visited) {
        if (visited.has(value)) { throw new Error('Circular'); }
        try {
            visited.add(value);
            const result = {};
            for (const key in value) {
                if (Object.prototype.hasOwnProperty.call(value, key)) {
                    result[key] = cloneInternal(value[key], visited);
                }
            }
            return result;
        } finally {
            visited.delete(value);
        }
    }

    return clone;
})();

/**
 * Checks if an object or value is deeply equal to another object or value.
 * @param {*} value1 The first value to check.
 * @param {*} value2 The second value to check.
 * @returns {boolean} `true` if the values are the same object, or deeply equal without cycles. `false` otherwise.
 */
const deepEqual = (() => {
    // eslint-disable-next-line no-shadow
    function deepEqual(value1, value2) {
        if (value1 === value2) { return true; }

        const type = typeof value1;
        if (typeof value2 !== type) { return false; }

        switch (type) {
            case 'object':
            case 'function':
                return deepEqualInternal(value1, value2, new Set());
            default:
                return false;
        }
    }

    function deepEqualInternal(value1, value2, visited1) {
        if (value1 === value2) { return true; }

        const type = typeof value1;
        if (typeof value2 !== type) { return false; }

        switch (type) {
            case 'object':
            case 'function':
            {
                if (value1 === null || value2 === null) { return false; }
                const array = Array.isArray(value1);
                if (array !== Array.isArray(value2)) { return false; }
                if (visited1.has(value1)) { return false; }
                visited1.add(value1);
                return array ? areArraysEqual(value1, value2, visited1) : areObjectsEqual(value1, value2, visited1);
            }
            default:
                return false;
        }
    }

    function areObjectsEqual(value1, value2, visited1) {
        const keys1 = Object.keys(value1);
        const keys2 = Object.keys(value2);
        if (keys1.length !== keys2.length) { return false; }

        const keys1Set = new Set(keys1);
        for (const key of keys2) {
            if (!keys1Set.has(key) || !deepEqualInternal(value1[key], value2[key], visited1)) { return false; }
        }

        return true;
    }

    function areArraysEqual(value1, value2, visited1) {
        const length = value1.length;
        if (length !== value2.length) { return false; }

        for (let i = 0; i < length; ++i) {
            if (!deepEqualInternal(value1[i], value2[i], visited1)) { return false; }
        }

        return true;
    }

    return deepEqual;
})();

/**
 * Creates a new base-16 (lower case) string of a sequence of random bytes of the given length.
 * @param {number} length The number of bytes the string represents. The returned string's length will be twice as long.
 * @returns {string} A string of random characters.
 */
function generateId(length) {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    let id = '';
    for (const value of array) {
        id += value.toString(16).padStart(2, '0');
    }
    return id;
}

/**
 * Creates an unresolved promise that can be resolved later, outside the promise's executor function.
 * @returns {{promise: Promise, resolve: Function, reject: Function}} An object `{promise, resolve, reject}`, containing the promise and the resolve/reject functions.
 */
function deferPromise() {
    let resolve;
    let reject;
    const promise = new Promise((resolve2, reject2) => {
        resolve = resolve2;
        reject = reject2;
    });
    return {promise, resolve, reject};
}

/**
 * Creates a promise that is resolved after a set delay.
 * @param {number} delay How many milliseconds until the promise should be resolved. If 0, the promise is immediately resolved.
 * @param {*} [resolveValue] The value returned when the promise is resolved.
 * @returns {Promise} A promise with two additional properties: `resolve` and `reject`, which can be used to complete the promise early.
 */
function promiseTimeout(delay, resolveValue) {
    if (delay <= 0) {
        const promise = Promise.resolve(resolveValue);
        promise.resolve = () => {}; // NOP
        promise.reject = () => {}; // NOP
        return promise;
    }

    let timer = null;
    let {promise, resolve, reject} = deferPromise();

    const complete = (callback, value) => {
        if (callback === null) { return; }
        if (timer !== null) {
            clearTimeout(timer);
            timer = null;
        }
        resolve = null;
        reject = null;
        callback(value);
    };

    const resolveWrapper = (value) => complete(resolve, value);
    const rejectWrapper = (value) => complete(reject, value);

    timer = setTimeout(() => {
        timer = null;
        resolveWrapper(resolveValue);
    }, delay);

    promise.resolve = resolveWrapper;
    promise.reject = rejectWrapper;

    return promise;
}

/**
 * Creates a promise that will resolve after the next animation frame, using `requestAnimationFrame`.
 * @param {number} [timeout] A maximum duration (in milliseconds) to wait until the promise resolves. If null or omitted, no timeout is used.
 * @returns {Promise<{time: number, timeout: number}>} A promise that is resolved with `{time, timeout}`, where `time` is the timestamp from `requestAnimationFrame`,
 *  and `timeout` is a boolean indicating whether the cause was a timeout or not.
 * @throws The promise throws an error if animation is not supported in this context, such as in a service worker.
 */
function promiseAnimationFrame(timeout=null) {
    return new Promise((resolve, reject) => {
        if (typeof cancelAnimationFrame !== 'function' || typeof requestAnimationFrame !== 'function') {
            reject(new Error('Animation not supported in this context'));
            return;
        }

        let timer = null;
        let frameRequest = null;
        const onFrame = (time) => {
            frameRequest = null;
            if (timer !== null) {
                clearTimeout(timer);
                timer = null;
            }
            resolve({time, timeout: false});
        };
        const onTimeout = () => {
            timer = null;
            if (frameRequest !== null) {
                // eslint-disable-next-line no-undef
                cancelAnimationFrame(frameRequest);
                frameRequest = null;
            }
            resolve({time: performance.now(), timeout: true});
        };

        // eslint-disable-next-line no-undef
        frameRequest = requestAnimationFrame(onFrame);
        if (typeof timeout === 'number') {
            timer = setTimeout(onTimeout, timeout);
        }
    });
}

/**
 * Invokes a standard message handler. This function is used to react and respond
 * to communication messages within the extension.
 * @param {object} details Details about how to handle messages.
 * @param {Function} details.handler A handler function which is passed `params` and `...extraArgs` as arguments.
 * @param {boolean|string} details.async Whether or not the handler is async or not. Values include `false`, `true`, or `'dynamic'`.
 *   When the value is `'dynamic'`, the handler should return an object of the format `{async: boolean, result: any}`.
 * @param {object} params Information which was passed with the original message.
 * @param {Function} callback A callback function which is invoked after the handler has completed. The value passed
 *   to the function is in the format:
 *   - `{result: any}` if the handler invoked successfully.
 *   - `{error: object}` if the handler thew an error. The error is serialized.
 * @param {...*} extraArgs Additional arguments which are passed to the `handler` function.
 * @returns {boolean} `true` if the function is invoked asynchronously, `false` otherwise.
 */
function invokeMessageHandler({handler, async}, params, callback, ...extraArgs) {
    try {
        let promiseOrResult = handler(params, ...extraArgs);
        if (async === 'dynamic') {
            ({async, result: promiseOrResult} = promiseOrResult);
        }
        if (async) {
            promiseOrResult.then(
                (result) => { callback({result}); },
                (error) => { callback({error: serializeError(error)}); }
            );
            return true;
        } else {
            callback({result: promiseOrResult});
            return false;
        }
    } catch (error) {
        callback({error: serializeError(error)});
        return false;
    }
}

/**
 * Base class controls basic event dispatching.
 */
class EventDispatcher {
    /**
     * Creates a new instance.
     */
    constructor() {
        this._eventMap = new Map();
    }

    /**
     * Triggers an event with the given name and specified argument.
     * @param {string} eventName The string representing the event's name.
     * @param {*} [details] The argument passed to the callback functions.
     * @returns {boolean} `true` if any callbacks were registered, `false` otherwise.
     */
    trigger(eventName, details) {
        const callbacks = this._eventMap.get(eventName);
        if (typeof callbacks === 'undefined') { return false; }

        for (const callback of callbacks) {
            callback(details);
        }
        return true;
    }

    /**
     * Adds a single event listener to a specific event.
     * @param {string} eventName The string representing the event's name.
     * @param {Function} callback The event listener callback to add.
     */
    on(eventName, callback) {
        let callbacks = this._eventMap.get(eventName);
        if (typeof callbacks === 'undefined') {
            callbacks = [];
            this._eventMap.set(eventName, callbacks);
        }
        callbacks.push(callback);
    }

    /**
     * Removes a single event listener from a specific event.
     * @param {string} eventName The string representing the event's name.
     * @param {Function} callback The event listener callback to add.
     * @returns {boolean} `true` if the callback was removed, `false` otherwise.
     */
    off(eventName, callback) {
        const callbacks = this._eventMap.get(eventName);
        if (typeof callbacks === 'undefined') { return false; }

        const ii = callbacks.length;
        for (let i = 0; i < ii; ++i) {
            if (callbacks[i] === callback) {
                callbacks.splice(i, 1);
                if (callbacks.length === 0) {
                    this._eventMap.delete(eventName);
                }
                return true;
            }
        }
        return false;
    }

    /**
     * Checks if an event has any listeners.
     * @param {string} eventName The string representing the event's name.
     * @returns {boolean} `true` if the event has listeners, `false` otherwise.
     */
    hasListeners(eventName) {
        const callbacks = this._eventMap.get(eventName);
        return (typeof callbacks !== 'undefined' && callbacks.length > 0);
    }
}

/**
 * Class which stores event listeners added to various objects, making it easy to remove them in bulk.
 */
class EventListenerCollection {
    /**
     * Creates a new instance.
     */
    constructor() {
        this._eventListeners = [];
    }

    /**
     * Returns the number of event listeners that are currently in the object.
     * @type {number}
     */
    get size() {
        return this._eventListeners.length;
    }

    /**
     * Adds an event listener of a generic type.
     * @param {string} type The type of event listener, which can be 'addEventListener', 'addListener', or 'on'.
     * @param {object} object The object to add the event listener to.
     * @param {...*} args The argument array passed to the object's event listener adding function.
     * @returns {void}
     * @throws An error if type is not an expected value.
     */
    addGeneric(type, object, ...args) {
        switch (type) {
            case 'addEventListener': return this.addEventListener(object, ...args);
            case 'addListener': return this.addListener(object, ...args);
            case 'on': return this.on(object, ...args);
            default: throw new Error(`Invalid type: ${type}`);
        }
    }

    /**
     * Adds an event listener using `object.addEventListener`. The listener will later be removed using `object.removeEventListener`.
     * @param {object} object The object to add the event listener to.
     * @param {...*} args The argument array passed to the `addEventListener`/`removeEventListener` functions.
     */
    addEventListener(object, ...args) {
        object.addEventListener(...args);
        this._eventListeners.push(['removeEventListener', object, ...args]);
    }

    /**
     * Adds an event listener using `object.addListener`. The listener will later be removed using `object.removeListener`.
     * @param {object} object The object to add the event listener to.
     * @param {...*} args The argument array passed to the `addListener`/`removeListener` function.
     */
    addListener(object, ...args) {
        object.addListener(...args);
        this._eventListeners.push(['removeListener', object, ...args]);
    }

    /**
     * Adds an event listener using `object.on`. The listener will later be removed using `object.off`.
     * @param {object} object The object to add the event listener to.
     * @param {...*} args The argument array passed to the `on`/`off` function.
     */
    on(object, ...args) {
        object.on(...args);
        this._eventListeners.push(['off', object, ...args]);
    }

    /**
     * Removes all event listeners added to objects for this instance and clears the internal list of event listeners.
     */
    removeAllEventListeners() {
        if (this._eventListeners.length === 0) { return; }
        for (const [removeFunctionName, object, ...args] of this._eventListeners) {
            switch (removeFunctionName) {
                case 'removeEventListener':
                    object.removeEventListener(...args);
                    break;
                case 'removeListener':
                    object.removeListener(...args);
                    break;
                case 'off':
                    object.off(...args);
                    break;
            }
        }
        this._eventListeners = [];
    }
}

/**
 * Class representing a generic value with an override stack.
 * Changes can be observed by listening to the 'change' event.
 */
class DynamicProperty extends EventDispatcher {
    /**
     * Creates a new instance with the specified value.
     * @param {*} value The value to assign.
     */
    constructor(value) {
        super();
        this._value = value;
        this._defaultValue = value;
        this._overrides = [];
    }

    /**
     * Gets the default value for the property, which is assigned to the
     * public value property when no overrides are present.
     * @type {*}
     */
    get defaultValue() {
        return this._defaultValue;
    }

    /**
     * Assigns the default value for the property. If no overrides are present
     * and if the value is different than the current default value,
     * the 'change' event will be triggered.
     * @param {*} value The value to assign.
     */
    set defaultValue(value) {
        this._defaultValue = value;
        if (this._overrides.length === 0) { this._updateValue(); }
    }

    /**
     * Gets the current value for the property, taking any overrides into account.
     * @type {*}
     */
    get value() {
        return this._value;
    }

    /**
     * Gets the number of overrides added to the property.
     * @type {*}
     */
    get overrideCount() {
        return this._overrides.length;
    }

    /**
     * Adds an override value with the specified priority to the override stack.
     * Values with higher priority will take precedence over those with lower.
     * For tie breaks, the override value added first will take precedence.
     * If the newly added override has the highest priority of all overrides
     * and if the override value is different from the current value,
     * the 'change' event will be fired.
     * @param {*} value The override value to assign.
     * @param {number} [priority] The priority value to use, as a number.
     * @returns {string} A string token which can be passed to the clearOverride function
     *  to remove the override.
     */
    setOverride(value, priority=0) {
        const overridesCount = this._overrides.length;
        let i = 0;
        for (; i < overridesCount; ++i) {
            if (priority > this._overrides[i].priority) { break; }
        }
        const token = generateId(16);
        this._overrides.splice(i, 0, {value, priority, token});
        if (i === 0) { this._updateValue(); }
        return token;
    }

    /**
     * Removes a specific override value. If the removed override
     * had the highest priority, and the new value is different from
     * the previous value, the 'change' event will be fired.
     * @param {string} token The token for the corresponding override which is to be removed.
     * @returns {boolean} `true` if an override was returned, `false` otherwise.
     */
    clearOverride(token) {
        for (let i = 0, ii = this._overrides.length; i < ii; ++i) {
            if (this._overrides[i].token === token) {
                this._overrides.splice(i, 1);
                if (i === 0) { this._updateValue(); }
                return true;
            }
        }
        return false;
    }

    /**
     * Updates the current value using the current overrides and default value.
     * If the new value differs from the previous value, the 'change' event will be fired.
     */
    _updateValue() {
        const value = this._overrides.length > 0 ? this._overrides[0].value : this._defaultValue;
        if (this._value === value) { return; }
        this._value = value;
        this.trigger('change', {value});
    }
}

/**
 * This class handles logging of messages to the console and triggering
 * an event for log calls.
 */
class Logger extends EventDispatcher {
    /**
     * Creates a new instance.
     */
    constructor() {
        super();
        this._extensionName = 'Yomichan';
        try {
            const {name, version} = chrome.runtime.getManifest();
            this._extensionName = `${name} ${version}`;
        } catch (e) {
            // NOP
        }
    }

    /**
     * Logs a generic error. This will trigger the 'log' event with the same arguments as the function invocation.
     * @param {Error|object|*} error The error to log. This is typically an `Error` or `Error`-like object.
     * @param {string} level The level to log at. Values include `'info'`, `'debug'`, `'warn'`, and `'error'`.
     *   Other values will be logged at a non-error level.
     * @param {?object} [context] An optional context object for the error which should typically include a `url` field.
     */
    log(error, level, context=null) {
        if (!isObject(context)) {
            context = {url: location.href};
        }

        let errorString;
        try {
            if (typeof error === 'string') {
                errorString = error;
            } else {
                errorString = error.toString();
                if (/^\[object \w+\]$/.test(errorString)) {
                    errorString = JSON.stringify(error);
                }
            }
        } catch (e) {
            errorString = `${error}`;
        }

        let errorStack;
        try {
            errorStack = (typeof error.stack === 'string' ? error.stack.trimRight() : '');
        } catch (e) {
            errorStack = '';
        }

        let errorData;
        try {
            errorData = error.data;
        } catch (e) {
            // NOP
        }

        if (errorStack.startsWith(errorString)) {
            errorString = errorStack;
        } else if (errorStack.length > 0) {
            errorString += `\n${errorStack}`;
        }

        let message = `${this._extensionName} has encountered a problem.`;
        message += `\nOriginating URL: ${context.url}\n`;
        message += errorString;
        if (typeof errorData !== 'undefined') {
            message += `\nData: ${JSON.stringify(errorData, null, 4)}`;
        }
        message += '\n\nIssues can be reported at https://github.com/themoeway/yomitan/issues';

        switch (level) {
            case 'info': console.info(message); break;
            case 'debug': console.debug(message); break;
            case 'warn': console.warn(message); break;
            case 'error': console.error(message); break;
            default: console.log(message); break;
        }

        this.trigger('log', {error, level, context});
    }

    /**
     * Logs a warning. This function invokes `log` internally.
     * @param {Error|object|*} error The error to log. This is typically an `Error` or `Error`-like object.
     * @param {?object} context An optional context object for the error which should typically include a `url` field.
     */
    warn(error, context=null) {
        this.log(error, 'warn', context);
    }

    /**
     * Logs an error. This function invokes `log` internally.
     * @param {Error|object|*} error The error to log. This is typically an `Error` or `Error`-like object.
     * @param {?object} context An optional context object for the error which should typically include a `url` field.
     */
    error(error, context=null) {
        this.log(error, 'error', context);
    }
}

/**
 * This object is the default logger used by the runtime.
 */
const log = new Logger();
