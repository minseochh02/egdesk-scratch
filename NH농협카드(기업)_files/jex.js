/*! 
 * jex javascript library v0.1.90 
 * Copyright 2011, 2018 Webcash. All Rights Reserved. 
 * http://jexframe.com 
 * 
 * Created: 2018-05-16 14:17:42 
 */ 

!function(t,e){"object"==typeof exports&&"undefined"!=typeof module?module.exports=e():"function"==typeof define&&define.amd?define(e):t.ES6Promise=e()}(this,function(){"use strict";function t(t){var e=typeof t;return null!==t&&("object"===e||"function"===e)}function e(t){return"function"==typeof t}function n(t){B=t}function r(t){G=t}function o(){return function(){return process.nextTick(a)}}function i(){return"undefined"!=typeof z?function(){z(a)}:c()}function s(){var t=0,e=new J(a),n=document.createTextNode("");return e.observe(n,{characterData:!0}),function(){n.data=t=++t%2}}function u(){var t=new MessageChannel;return t.port1.onmessage=a,function(){return t.port2.postMessage(0)}}function c(){var t=setTimeout;return function(){return t(a,1)}}function a(){for(var t=0;t<W;t+=2){var e=V[t],n=V[t+1];e(n),V[t]=void 0,V[t+1]=void 0}W=0}function f(){try{var t=Function("return this")().require("vertx");return z=t.runOnLoop||t.runOnContext,i()}catch(e){return c()}}function l(t,e){var n=this,r=new this.constructor(p);void 0===r[Z]&&O(r);var o=n._state;if(o){var i=arguments[o-1];G(function(){return P(o,r,i,n._result)})}else E(n,r,t,e);return r}function h(t){var e=this;if(t&&"object"==typeof t&&t.constructor===e)return t;var n=new e(p);return g(n,t),n}function p(){}function v(){return new TypeError("You cannot resolve a promise with itself")}function d(){return new TypeError("A promises callback cannot return that same promise.")}function _(t){try{return t.then}catch(e){return nt.error=e,nt}}function y(t,e,n,r){try{t.call(e,n,r)}catch(o){return o}}function m(t,e,n){G(function(t){var r=!1,o=y(n,e,function(n){r||(r=!0,e!==n?g(t,n):S(t,n))},function(e){r||(r=!0,j(t,e))},"Settle: "+(t._label||" unknown promise"));!r&&o&&(r=!0,j(t,o))},t)}function b(t,e){e._state===tt?S(t,e._result):e._state===et?j(t,e._result):E(e,void 0,function(e){return g(t,e)},function(e){return j(t,e)})}function w(t,n,r){n.constructor===t.constructor&&r===l&&n.constructor.resolve===h?b(t,n):r===nt?(j(t,nt.error),nt.error=null):void 0===r?S(t,n):e(r)?m(t,n,r):S(t,n)}function g(e,n){e===n?j(e,v()):t(n)?w(e,n,_(n)):S(e,n)}function A(t){t._onerror&&t._onerror(t._result),T(t)}function S(t,e){t._state===$&&(t._result=e,t._state=tt,0!==t._subscribers.length&&G(T,t))}function j(t,e){t._state===$&&(t._state=et,t._result=e,G(A,t))}function E(t,e,n,r){var o=t._subscribers,i=o.length;t._onerror=null,o[i]=e,o[i+tt]=n,o[i+et]=r,0===i&&t._state&&G(T,t)}function T(t){var e=t._subscribers,n=t._state;if(0!==e.length){for(var r=void 0,o=void 0,i=t._result,s=0;s<e.length;s+=3)r=e[s],o=e[s+n],r?P(n,r,o,i):o(i);t._subscribers.length=0}}function M(t,e){try{return t(e)}catch(n){return nt.error=n,nt}}function P(t,n,r,o){var i=e(r),s=void 0,u=void 0,c=void 0,a=void 0;if(i){if(s=M(r,o),s===nt?(a=!0,u=s.error,s.error=null):c=!0,n===s)return void j(n,d())}else s=o,c=!0;n._state!==$||(i&&c?g(n,s):a?j(n,u):t===tt?S(n,s):t===et&&j(n,s))}function x(t,e){try{e(function(e){g(t,e)},function(e){j(t,e)})}catch(n){j(t,n)}}function C(){return rt++}function O(t){t[Z]=rt++,t._state=void 0,t._result=void 0,t._subscribers=[]}function k(){return new Error("Array Methods must be provided an Array")}function F(t){return new ot(this,t).promise}function Y(t){var e=this;return new e(U(t)?function(n,r){for(var o=t.length,i=0;i<o;i++)e.resolve(t[i]).then(n,r)}:function(t,e){return e(new TypeError("You must pass an array to race."))})}function q(t){var e=this,n=new e(p);return j(n,t),n}function D(){throw new TypeError("You must pass a resolver function as the first argument to the promise constructor")}function K(){throw new TypeError("Failed to construct 'Promise': Please use the 'new' operator, this object constructor cannot be called as a function.")}function L(){var t=void 0;if("undefined"!=typeof global)t=global;else if("undefined"!=typeof self)t=self;else try{t=Function("return this")()}catch(e){throw new Error("polyfill failed because global object is unavailable in this environment")}var n=t.Promise;if(n){var r=null;try{r=Object.prototype.toString.call(n.resolve())}catch(e){}if("[object Promise]"===r&&!n.cast)return}t.Promise=it}var N=void 0;N=Array.isArray?Array.isArray:function(t){return"[object Array]"===Object.prototype.toString.call(t)};var U=N,W=0,z=void 0,B=void 0,G=function(t,e){V[W]=t,V[W+1]=e,W+=2,2===W&&(B?B(a):X())},H="undefined"!=typeof window?window:void 0,I=H||{},J=I.MutationObserver||I.WebKitMutationObserver,Q="undefined"==typeof self&&"undefined"!=typeof process&&"[object process]"==={}.toString.call(process),R="undefined"!=typeof Uint8ClampedArray&&"undefined"!=typeof importScripts&&"undefined"!=typeof MessageChannel,V=new Array(1e3),X=void 0;X=Q?o():J?s():R?u():void 0===H&&"function"==typeof require?f():c();var Z=Math.random().toString(36).substring(2),$=void 0,tt=1,et=2,nt={error:null},rt=0,ot=function(){function t(t,e){this._instanceConstructor=t,this.promise=new t(p),this.promise[Z]||O(this.promise),U(e)?(this.length=e.length,this._remaining=e.length,this._result=new Array(this.length),0===this.length?S(this.promise,this._result):(this.length=this.length||0,this._enumerate(e),0===this._remaining&&S(this.promise,this._result))):j(this.promise,k())}return t.prototype._enumerate=function(t){for(var e=0;this._state===$&&e<t.length;e++)this._eachEntry(t[e],e)},t.prototype._eachEntry=function(t,e){var n=this._instanceConstructor,r=n.resolve;if(r===h){var o=_(t);if(o===l&&t._state!==$)this._settledAt(t._state,e,t._result);else if("function"!=typeof o)this._remaining--,this._result[e]=t;else if(n===it){var i=new n(p);w(i,t,o),this._willSettleAt(i,e)}else this._willSettleAt(new n(function(e){return e(t)}),e)}else this._willSettleAt(r(t),e)},t.prototype._settledAt=function(t,e,n){var r=this.promise;r._state===$&&(this._remaining--,t===et?j(r,n):this._result[e]=n),0===this._remaining&&S(r,this._result)},t.prototype._willSettleAt=function(t,e){var n=this;E(t,void 0,function(t){return n._settledAt(tt,e,t)},function(t){return n._settledAt(et,e,t)})},t}(),it=function(){function t(e){this[Z]=C(),this._result=this._state=void 0,this._subscribers=[],p!==e&&("function"!=typeof e&&D(),this instanceof t?x(this,e):K())}return t.prototype["catch"]=function(t){return this.then(null,t)},t.prototype["finally"]=function(t){var e=this,n=e.constructor;return e.then(function(e){return n.resolve(t()).then(function(){return e})},function(e){return n.resolve(t()).then(function(){throw e})})},t}();return it.prototype.then=l,it.all=F,it.race=Y,it.resolve=h,it.reject=q,it._setScheduler=n,it._setAsap=r,it._asap=G,it.polyfill=L,it.Promise=it,it});
!function(t,e){"object"==typeof exports&&"undefined"!=typeof module?module.exports=e():"function"==typeof define&&define.amd?define(e):t.ES6Promise=e()}(this,function(){"use strict";function t(t){var e=typeof t;return null!==t&&("object"===e||"function"===e)}function e(t){return"function"==typeof t}function n(t){B=t}function r(t){G=t}function o(){return function(){return process.nextTick(a)}}function i(){return"undefined"!=typeof z?function(){z(a)}:c()}function s(){var t=0,e=new J(a),n=document.createTextNode("");return e.observe(n,{characterData:!0}),function(){n.data=t=++t%2}}function u(){var t=new MessageChannel;return t.port1.onmessage=a,function(){return t.port2.postMessage(0)}}function c(){var t=setTimeout;return function(){return t(a,1)}}function a(){for(var t=0;t<W;t+=2){var e=V[t],n=V[t+1];e(n),V[t]=void 0,V[t+1]=void 0}W=0}function f(){try{var t=Function("return this")().require("vertx");return z=t.runOnLoop||t.runOnContext,i()}catch(e){return c()}}function l(t,e){var n=this,r=new this.constructor(p);void 0===r[Z]&&O(r);var o=n._state;if(o){var i=arguments[o-1];G(function(){return P(o,r,i,n._result)})}else E(n,r,t,e);return r}function h(t){var e=this;if(t&&"object"==typeof t&&t.constructor===e)return t;var n=new e(p);return g(n,t),n}function p(){}function v(){return new TypeError("You cannot resolve a promise with itself")}function d(){return new TypeError("A promises callback cannot return that same promise.")}function _(t){try{return t.then}catch(e){return nt.error=e,nt}}function y(t,e,n,r){try{t.call(e,n,r)}catch(o){return o}}function m(t,e,n){G(function(t){var r=!1,o=y(n,e,function(n){r||(r=!0,e!==n?g(t,n):S(t,n))},function(e){r||(r=!0,j(t,e))},"Settle: "+(t._label||" unknown promise"));!r&&o&&(r=!0,j(t,o))},t)}function b(t,e){e._state===tt?S(t,e._result):e._state===et?j(t,e._result):E(e,void 0,function(e){return g(t,e)},function(e){return j(t,e)})}function w(t,n,r){n.constructor===t.constructor&&r===l&&n.constructor.resolve===h?b(t,n):r===nt?(j(t,nt.error),nt.error=null):void 0===r?S(t,n):e(r)?m(t,n,r):S(t,n)}function g(e,n){e===n?j(e,v()):t(n)?w(e,n,_(n)):S(e,n)}function A(t){t._onerror&&t._onerror(t._result),T(t)}function S(t,e){t._state===$&&(t._result=e,t._state=tt,0!==t._subscribers.length&&G(T,t))}function j(t,e){t._state===$&&(t._state=et,t._result=e,G(A,t))}function E(t,e,n,r){var o=t._subscribers,i=o.length;t._onerror=null,o[i]=e,o[i+tt]=n,o[i+et]=r,0===i&&t._state&&G(T,t)}function T(t){var e=t._subscribers,n=t._state;if(0!==e.length){for(var r=void 0,o=void 0,i=t._result,s=0;s<e.length;s+=3)r=e[s],o=e[s+n],r?P(n,r,o,i):o(i);t._subscribers.length=0}}function M(t,e){try{return t(e)}catch(n){return nt.error=n,nt}}function P(t,n,r,o){var i=e(r),s=void 0,u=void 0,c=void 0,a=void 0;if(i){if(s=M(r,o),s===nt?(a=!0,u=s.error,s.error=null):c=!0,n===s)return void j(n,d())}else s=o,c=!0;n._state!==$||(i&&c?g(n,s):a?j(n,u):t===tt?S(n,s):t===et&&j(n,s))}function x(t,e){try{e(function(e){g(t,e)},function(e){j(t,e)})}catch(n){j(t,n)}}function C(){return rt++}function O(t){t[Z]=rt++,t._state=void 0,t._result=void 0,t._subscribers=[]}function k(){return new Error("Array Methods must be provided an Array")}function F(t){return new ot(this,t).promise}function Y(t){var e=this;return new e(U(t)?function(n,r){for(var o=t.length,i=0;i<o;i++)e.resolve(t[i]).then(n,r)}:function(t,e){return e(new TypeError("You must pass an array to race."))})}function q(t){var e=this,n=new e(p);return j(n,t),n}function D(){throw new TypeError("You must pass a resolver function as the first argument to the promise constructor")}function K(){throw new TypeError("Failed to construct 'Promise': Please use the 'new' operator, this object constructor cannot be called as a function.")}function L(){var t=void 0;if("undefined"!=typeof global)t=global;else if("undefined"!=typeof self)t=self;else try{t=Function("return this")()}catch(e){throw new Error("polyfill failed because global object is unavailable in this environment")}var n=t.Promise;if(n){var r=null;try{r=Object.prototype.toString.call(n.resolve())}catch(e){}if("[object Promise]"===r&&!n.cast)return}t.Promise=it}var N=void 0;N=Array.isArray?Array.isArray:function(t){return"[object Array]"===Object.prototype.toString.call(t)};var U=N,W=0,z=void 0,B=void 0,G=function(t,e){V[W]=t,V[W+1]=e,W+=2,2===W&&(B?B(a):X())},H="undefined"!=typeof window?window:void 0,I=H||{},J=I.MutationObserver||I.WebKitMutationObserver,Q="undefined"==typeof self&&"undefined"!=typeof process&&"[object process]"==={}.toString.call(process),R="undefined"!=typeof Uint8ClampedArray&&"undefined"!=typeof importScripts&&"undefined"!=typeof MessageChannel,V=new Array(1e3),X=void 0;X=Q?o():J?s():R?u():void 0===H&&"function"==typeof require?f():c();var Z=Math.random().toString(36).substring(2),$=void 0,tt=1,et=2,nt={error:null},rt=0,ot=function(){function t(t,e){this._instanceConstructor=t,this.promise=new t(p),this.promise[Z]||O(this.promise),U(e)?(this.length=e.length,this._remaining=e.length,this._result=new Array(this.length),0===this.length?S(this.promise,this._result):(this.length=this.length||0,this._enumerate(e),0===this._remaining&&S(this.promise,this._result))):j(this.promise,k())}return t.prototype._enumerate=function(t){for(var e=0;this._state===$&&e<t.length;e++)this._eachEntry(t[e],e)},t.prototype._eachEntry=function(t,e){var n=this._instanceConstructor,r=n.resolve;if(r===h){var o=_(t);if(o===l&&t._state!==$)this._settledAt(t._state,e,t._result);else if("function"!=typeof o)this._remaining--,this._result[e]=t;else if(n===it){var i=new n(p);w(i,t,o),this._willSettleAt(i,e)}else this._willSettleAt(new n(function(e){return e(t)}),e)}else this._willSettleAt(r(t),e)},t.prototype._settledAt=function(t,e,n){var r=this.promise;r._state===$&&(this._remaining--,t===et?j(r,n):this._result[e]=n),0===this._remaining&&S(r,this._result)},t.prototype._willSettleAt=function(t,e){var n=this;E(t,void 0,function(t){return n._settledAt(tt,e,t)},function(t){return n._settledAt(et,e,t)})},t}(),it=function(){function t(e){this[Z]=C(),this._result=this._state=void 0,this._subscribers=[],p!==e&&("function"!=typeof e&&D(),this instanceof t?x(this,e):K())}return t.prototype["catch"]=function(t){return this.then(null,t)},t.prototype["finally"]=function(t){var e=this,n=e.constructor;return e.then(function(e){return n.resolve(t()).then(function(){return e})},function(e){return n.resolve(t()).then(function(){throw e})})},t}();return it.prototype.then=l,it.all=F,it.race=Y,it.resolve=h,it.reject=q,it._setScheduler=n,it._setAsap=r,it._asap=G,it.polyfill=L,it.Promise=it,it.polyfill(),it});
/*!
 * html2canvas 1.0.0-alpha.12 <https://html2canvas.hertzen.com>
 * Copyright (c) 2018 Niklas von Hertzen <https://hertzen.com>
 * Released under MIT License
 */
!function(A,e){"object"==typeof exports&&"object"==typeof module?module.exports=e():"function"==typeof define&&define.amd?define([],e):"object"==typeof exports?exports.html2canvas=e():A.html2canvas=e()}(this,function(){return function(A){var e={};function t(r){if(e[r])return e[r].exports;var n=e[r]={i:r,l:!1,exports:{}};return A[r].call(n.exports,n,n.exports,t),n.l=!0,n.exports}return t.m=A,t.c=e,t.d=function(A,e,r){t.o(A,e)||Object.defineProperty(A,e,{configurable:!1,enumerable:!0,get:r})},t.n=function(A){var e=A&&A.__esModule?function(){return A.default}:function(){return A};return t.d(e,"a",e),e},t.o=function(A,e){return Object.prototype.hasOwnProperty.call(A,e)},t.p="",t(t.s=27)}([function(A,e,t){"use strict";Object.defineProperty(e,"__esModule",{value:!0});var r=function(){return function(A,e){if(Array.isArray(A))return A;if(Symbol.iterator in Object(A))return function(A,e){var t=[],r=!0,n=!1,B=void 0;try{for(var a,s=A[Symbol.iterator]();!(r=(a=s.next()).done)&&(t.push(a.value),!e||t.length!==e);r=!0);}catch(A){n=!0,B=A}finally{try{!r&&s.return&&s.return()}finally{if(n)throw B}}return t}(A,e);throw new TypeError("Invalid attempt to destructure non-iterable instance")}}(),n=function(){function A(A,e){for(var t=0;t<e.length;t++){var r=e[t];r.enumerable=r.enumerable||!1,r.configurable=!0,"value"in r&&(r.writable=!0),Object.defineProperty(A,r.key,r)}}return function(e,t,r){return t&&A(e.prototype,t),r&&A(e,r),e}}();var B=/^#([a-f0-9]{3})$/i,a=function(A){var e=A.match(B);return!!e&&[parseInt(e[1][0]+e[1][0],16),parseInt(e[1][1]+e[1][1],16),parseInt(e[1][2]+e[1][2],16),null]},s=/^#([a-f0-9]{6})$/i,o=function(A){var e=A.match(s);return!!e&&[parseInt(e[1].substring(0,2),16),parseInt(e[1].substring(2,4),16),parseInt(e[1].substring(4,6),16),null]},i=/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/,c=function(A){var e=A.match(i);return!!e&&[Number(e[1]),Number(e[2]),Number(e[3]),null]},l=/^rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d?\.?\d+)\s*\)$/,u=function(A){var e=A.match(l);return!!(e&&e.length>4)&&[Number(e[1]),Number(e[2]),Number(e[3]),Number(e[4])]},Q=function(A){return[Math.min(A[0],255),Math.min(A[1],255),Math.min(A[2],255),A.length>3?A[3]:null]},w=function(A){var e=g[A.toLowerCase()];return e||!1},U=function(){function A(e){!function(A,e){if(!(A instanceof e))throw new TypeError("Cannot call a class as a function")}(this,A);var t=Array.isArray(e)?Q(e):a(e)||c(e)||u(e)||w(e)||o(e)||[0,0,0,null],n=r(t,4),B=n[0],s=n[1],i=n[2],l=n[3];this.r=B,this.g=s,this.b=i,this.a=l}return n(A,[{key:"isTransparent",value:function(){return 0===this.a}},{key:"toString",value:function(){return null!==this.a&&1!==this.a?"rgba("+this.r+","+this.g+","+this.b+","+this.a+")":"rgb("+this.r+","+this.g+","+this.b+")"}}]),A}();e.default=U;var g={transparent:[0,0,0,0],aliceblue:[240,248,255,null],antiquewhite:[250,235,215,null],aqua:[0,255,255,null],aquamarine:[127,255,212,null],azure:[240,255,255,null],beige:[245,245,220,null],bisque:[255,228,196,null],black:[0,0,0,null],blanchedalmond:[255,235,205,null],blue:[0,0,255,null],blueviolet:[138,43,226,null],brown:[165,42,42,null],burlywood:[222,184,135,null],cadetblue:[95,158,160,null],chartreuse:[127,255,0,null],chocolate:[210,105,30,null],coral:[255,127,80,null],cornflowerblue:[100,149,237,null],cornsilk:[255,248,220,null],crimson:[220,20,60,null],cyan:[0,255,255,null],darkblue:[0,0,139,null],darkcyan:[0,139,139,null],darkgoldenrod:[184,134,11,null],darkgray:[169,169,169,null],darkgreen:[0,100,0,null],darkgrey:[169,169,169,null],darkkhaki:[189,183,107,null],darkmagenta:[139,0,139,null],darkolivegreen:[85,107,47,null],darkorange:[255,140,0,null],darkorchid:[153,50,204,null],darkred:[139,0,0,null],darksalmon:[233,150,122,null],darkseagreen:[143,188,143,null],darkslateblue:[72,61,139,null],darkslategray:[47,79,79,null],darkslategrey:[47,79,79,null],darkturquoise:[0,206,209,null],darkviolet:[148,0,211,null],deeppink:[255,20,147,null],deepskyblue:[0,191,255,null],dimgray:[105,105,105,null],dimgrey:[105,105,105,null],dodgerblue:[30,144,255,null],firebrick:[178,34,34,null],floralwhite:[255,250,240,null],forestgreen:[34,139,34,null],fuchsia:[255,0,255,null],gainsboro:[220,220,220,null],ghostwhite:[248,248,255,null],gold:[255,215,0,null],goldenrod:[218,165,32,null],gray:[128,128,128,null],green:[0,128,0,null],greenyellow:[173,255,47,null],grey:[128,128,128,null],honeydew:[240,255,240,null],hotpink:[255,105,180,null],indianred:[205,92,92,null],indigo:[75,0,130,null],ivory:[255,255,240,null],khaki:[240,230,140,null],lavender:[230,230,250,null],lavenderblush:[255,240,245,null],lawngreen:[124,252,0,null],lemonchiffon:[255,250,205,null],lightblue:[173,216,230,null],lightcoral:[240,128,128,null],lightcyan:[224,255,255,null],lightgoldenrodyellow:[250,250,210,null],lightgray:[211,211,211,null],lightgreen:[144,238,144,null],lightgrey:[211,211,211,null],lightpink:[255,182,193,null],lightsalmon:[255,160,122,null],lightseagreen:[32,178,170,null],lightskyblue:[135,206,250,null],lightslategray:[119,136,153,null],lightslategrey:[119,136,153,null],lightsteelblue:[176,196,222,null],lightyellow:[255,255,224,null],lime:[0,255,0,null],limegreen:[50,205,50,null],linen:[250,240,230,null],magenta:[255,0,255,null],maroon:[128,0,0,null],mediumaquamarine:[102,205,170,null],mediumblue:[0,0,205,null],mediumorchid:[186,85,211,null],mediumpurple:[147,112,219,null],mediumseagreen:[60,179,113,null],mediumslateblue:[123,104,238,null],mediumspringgreen:[0,250,154,null],mediumturquoise:[72,209,204,null],mediumvioletred:[199,21,133,null],midnightblue:[25,25,112,null],mintcream:[245,255,250,null],mistyrose:[255,228,225,null],moccasin:[255,228,181,null],navajowhite:[255,222,173,null],navy:[0,0,128,null],oldlace:[253,245,230,null],olive:[128,128,0,null],olivedrab:[107,142,35,null],orange:[255,165,0,null],orangered:[255,69,0,null],orchid:[218,112,214,null],palegoldenrod:[238,232,170,null],palegreen:[152,251,152,null],paleturquoise:[175,238,238,null],palevioletred:[219,112,147,null],papayawhip:[255,239,213,null],peachpuff:[255,218,185,null],peru:[205,133,63,null],pink:[255,192,203,null],plum:[221,160,221,null],powderblue:[176,224,230,null],purple:[128,0,128,null],rebeccapurple:[102,51,153,null],red:[255,0,0,null],rosybrown:[188,143,143,null],royalblue:[65,105,225,null],saddlebrown:[139,69,19,null],salmon:[250,128,114,null],sandybrown:[244,164,96,null],seagreen:[46,139,87,null],seashell:[255,245,238,null],sienna:[160,82,45,null],silver:[192,192,192,null],skyblue:[135,206,235,null],slateblue:[106,90,205,null],slategray:[112,128,144,null],slategrey:[112,128,144,null],snow:[255,250,250,null],springgreen:[0,255,127,null],steelblue:[70,130,180,null],tan:[210,180,140,null],teal:[0,128,128,null],thistle:[216,191,216,null],tomato:[255,99,71,null],turquoise:[64,224,208,null],violet:[238,130,238,null],wheat:[245,222,179,null],white:[255,255,255,null],whitesmoke:[245,245,245,null],yellow:[255,255,0,null],yellowgreen:[154,205,50,null]};e.TRANSPARENT=new U([0,0,0,0])},function(A,e,t){"use strict";Object.defineProperty(e,"__esModule",{value:!0}),e.calculateLengthFromValueWithUnit=e.LENGTH_TYPE=void 0;var r,n=function(){function A(A,e){for(var t=0;t<e.length;t++){var r=e[t];r.enumerable=r.enumerable||!1,r.configurable=!0,"value"in r&&(r.writable=!0),Object.defineProperty(A,r.key,r)}}return function(e,t,r){return t&&A(e.prototype,t),r&&A(e,r),e}}(),B=t(3);(r=B)&&r.__esModule;var a=e.LENGTH_TYPE={PX:0,PERCENTAGE:1},s=function(){function A(e){!function(A,e){if(!(A instanceof e))throw new TypeError("Cannot call a class as a function")}(this,A),this.type="%"===e.substr(e.length-1)?a.PERCENTAGE:a.PX;var t=parseFloat(e);this.value=isNaN(t)?0:t}return n(A,[{key:"isPercentage",value:function(){return this.type===a.PERCENTAGE}},{key:"getAbsoluteValue",value:function(A){return this.isPercentage()?A*(this.value/100):this.value}}],[{key:"create",value:function(e){return new A(e)}}]),A}();e.default=s;e.calculateLengthFromValueWithUnit=function(A,e,t){switch(t){case"px":case"%":return new s(e+t);case"em":case"rem":var r=new s(e);return r.value*="em"===t?parseFloat(A.style.font.fontSize):function A(e){var t=e.parent;return t?A(t):parseFloat(e.style.font.fontSize)}(A),r;default:return new s("0")}}},function(A,e,t){"use strict";Object.defineProperty(e,"__esModule",{value:!0}),e.parseBoundCurves=e.calculatePaddingBoxPath=e.calculateBorderBoxPath=e.parsePathForBorder=e.parseDocumentSize=e.calculateContentBox=e.calculatePaddingBox=e.parseBounds=e.Bounds=void 0;var r=function(){function A(A,e){for(var t=0;t<e.length;t++){var r=e[t];r.enumerable=r.enumerable||!1,r.configurable=!0,"value"in r&&(r.writable=!0),Object.defineProperty(A,r.key,r)}}return function(e,t,r){return t&&A(e.prototype,t),r&&A(e,r),e}}(),n=a(t(7)),B=a(t(32));function a(A){return A&&A.__esModule?A:{default:A}}var s=e.Bounds=function(){function A(e,t,r,n){!function(A,e){if(!(A instanceof e))throw new TypeError("Cannot call a class as a function")}(this,A),this.left=e,this.top=t,this.width=r,this.height=n}return r(A,null,[{key:"fromClientRect",value:function(e,t,r){return new A(e.left+t,e.top+r,e.width,e.height)}}]),A}(),o=(e.parseBounds=function(A,e,t){return s.fromClientRect(A.getBoundingClientRect(),e,t)},e.calculatePaddingBox=function(A,e){return new s(A.left+e[3].borderWidth,A.top+e[0].borderWidth,A.width-(e[1].borderWidth+e[3].borderWidth),A.height-(e[0].borderWidth+e[2].borderWidth))},e.calculateContentBox=function(A,e,t){var r=e[0].value,n=e[1].value,B=e[2].value,a=e[3].value;return new s(A.left+a+t[3].borderWidth,A.top+r+t[0].borderWidth,A.width-(t[1].borderWidth+t[3].borderWidth+a+n),A.height-(t[0].borderWidth+t[2].borderWidth+r+B))},e.parseDocumentSize=function(A){var e=A.body,t=A.documentElement;if(!e||!t)throw new Error("");var r=Math.max(Math.max(e.scrollWidth,t.scrollWidth),Math.max(e.offsetWidth,t.offsetWidth),Math.max(e.clientWidth,t.clientWidth)),n=Math.max(Math.max(e.scrollHeight,t.scrollHeight),Math.max(e.offsetHeight,t.offsetHeight),Math.max(e.clientHeight,t.clientHeight));return new s(0,0,r,n)},e.parsePathForBorder=function(A,e){switch(e){case 0:return o(A.topLeftOuter,A.topLeftInner,A.topRightOuter,A.topRightInner);case 1:return o(A.topRightOuter,A.topRightInner,A.bottomRightOuter,A.bottomRightInner);case 2:return o(A.bottomRightOuter,A.bottomRightInner,A.bottomLeftOuter,A.bottomLeftInner);case 3:default:return o(A.bottomLeftOuter,A.bottomLeftInner,A.topLeftOuter,A.topLeftInner)}},function(A,e,t,r){var n=[];return A instanceof B.default?n.push(A.subdivide(.5,!1)):n.push(A),t instanceof B.default?n.push(t.subdivide(.5,!0)):n.push(t),r instanceof B.default?n.push(r.subdivide(.5,!0).reverse()):n.push(r),e instanceof B.default?n.push(e.subdivide(.5,!1).reverse()):n.push(e),n}),i=(e.calculateBorderBoxPath=function(A){return[A.topLeftOuter,A.topRightOuter,A.bottomRightOuter,A.bottomLeftOuter]},e.calculatePaddingBoxPath=function(A){return[A.topLeftInner,A.topRightInner,A.bottomRightInner,A.bottomLeftInner]},e.parseBoundCurves=function(A,e,t){var r=t[i.TOP_LEFT][0].getAbsoluteValue(A.width),B=t[i.TOP_LEFT][1].getAbsoluteValue(A.height),a=t[i.TOP_RIGHT][0].getAbsoluteValue(A.width),s=t[i.TOP_RIGHT][1].getAbsoluteValue(A.height),o=t[i.BOTTOM_RIGHT][0].getAbsoluteValue(A.width),l=t[i.BOTTOM_RIGHT][1].getAbsoluteValue(A.height),u=t[i.BOTTOM_LEFT][0].getAbsoluteValue(A.width),Q=t[i.BOTTOM_LEFT][1].getAbsoluteValue(A.height),w=[];w.push((r+a)/A.width),w.push((u+o)/A.width),w.push((B+Q)/A.height),w.push((s+l)/A.height);var U=Math.max.apply(Math,w);U>1&&(r/=U,B/=U,a/=U,s/=U,o/=U,l/=U,u/=U,Q/=U);var g=A.width-a,C=A.height-l,d=A.width-o,F=A.height-Q;return{topLeftOuter:r>0||B>0?c(A.left,A.top,r,B,i.TOP_LEFT):new n.default(A.left,A.top),topLeftInner:r>0||B>0?c(A.left+e[3].borderWidth,A.top+e[0].borderWidth,Math.max(0,r-e[3].borderWidth),Math.max(0,B-e[0].borderWidth),i.TOP_LEFT):new n.default(A.left+e[3].borderWidth,A.top+e[0].borderWidth),topRightOuter:a>0||s>0?c(A.left+g,A.top,a,s,i.TOP_RIGHT):new n.default(A.left+A.width,A.top),topRightInner:a>0||s>0?c(A.left+Math.min(g,A.width+e[3].borderWidth),A.top+e[0].borderWidth,g>A.width+e[3].borderWidth?0:a-e[3].borderWidth,s-e[0].borderWidth,i.TOP_RIGHT):new n.default(A.left+A.width-e[1].borderWidth,A.top+e[0].borderWidth),bottomRightOuter:o>0||l>0?c(A.left+d,A.top+C,o,l,i.BOTTOM_RIGHT):new n.default(A.left+A.width,A.top+A.height),bottomRightInner:o>0||l>0?c(A.left+Math.min(d,A.width-e[3].borderWidth),A.top+Math.min(C,A.height+e[0].borderWidth),Math.max(0,o-e[1].borderWidth),l-e[2].borderWidth,i.BOTTOM_RIGHT):new n.default(A.left+A.width-e[1].borderWidth,A.top+A.height-e[2].borderWidth),bottomLeftOuter:u>0||Q>0?c(A.left,A.top+F,u,Q,i.BOTTOM_LEFT):new n.default(A.left,A.top+A.height),bottomLeftInner:u>0||Q>0?c(A.left+e[3].borderWidth,A.top+F,Math.max(0,u-e[3].borderWidth),Q-e[2].borderWidth,i.BOTTOM_LEFT):new n.default(A.left+e[3].borderWidth,A.top+A.height-e[2].borderWidth)}},{TOP_LEFT:0,TOP_RIGHT:1,BOTTOM_RIGHT:2,BOTTOM_LEFT:3}),c=function(A,e,t,r,a){var s=(Math.sqrt(2)-1)/3*4,o=t*s,c=r*s,l=A+t,u=e+r;switch(a){case i.TOP_LEFT:return new B.default(new n.default(A,u),new n.default(A,u-c),new n.default(l-o,e),new n.default(l,e));case i.TOP_RIGHT:return new B.default(new n.default(A,e),new n.default(A+o,e),new n.default(l,u-c),new n.default(l,u));case i.BOTTOM_RIGHT:return new B.default(new n.default(l,e),new n.default(l,e+c),new n.default(A+o,u),new n.default(A,u));case i.BOTTOM_LEFT:default:return new B.default(new n.default(l,u),new n.default(l-o,u),new n.default(A,e+c),new n.default(A,e))}}},function(A,e,t){"use strict";Object.defineProperty(e,"__esModule",{value:!0});var r,n=function(){function A(A,e){for(var t=0;t<e.length;t++){var r=e[t];r.enumerable=r.enumerable||!1,r.configurable=!0,"value"in r&&(r.writable=!0),Object.defineProperty(A,r.key,r)}}return function(e,t,r){return t&&A(e.prototype,t),r&&A(e,r),e}}(),B=t(0),a=(r=B)&&r.__esModule?r:{default:r},s=t(4),o=t(5),i=t(12),c=t(33),l=t(34),u=t(35),Q=t(36),w=t(37),U=t(38),g=t(8),C=t(39),d=t(40),F=t(18),E=t(17),f=t(19),h=t(11),H=t(41),p=t(20),N=t(42),I=t(43),K=t(44),T=t(45),m=t(2),v=t(21),y=t(14);var b=["INPUT","TEXTAREA","SELECT"],S=function(){function A(e,t,r,n){var B=this;!function(A,e){if(!(A instanceof e))throw new TypeError("Cannot call a class as a function")}(this,A),this.parent=t,this.tagName=e.tagName,this.index=n,this.childNodes=[],this.listItems=[],"number"==typeof e.start&&(this.listStart=e.start);var s=e.ownerDocument.defaultView,S=s.pageXOffset,_=s.pageYOffset,D=s.getComputedStyle(e,null),M=(0,l.parseDisplay)(D.display),O="radio"===e.type||"checkbox"===e.type,R=(0,f.parsePosition)(D.position);if(this.style={background:O?v.INPUT_BACKGROUND:(0,o.parseBackground)(D,r),border:O?v.INPUT_BORDERS:(0,i.parseBorder)(D),borderRadius:(e instanceof s.HTMLInputElement||e instanceof HTMLInputElement)&&O?(0,v.getInputBorderRadius)(e):(0,c.parseBorderRadius)(D),color:O?v.INPUT_COLOR:new a.default(D.color),display:M,float:(0,u.parseCSSFloat)(D.float),font:(0,Q.parseFont)(D),letterSpacing:(0,w.parseLetterSpacing)(D.letterSpacing),listStyle:M===l.DISPLAY.LIST_ITEM?(0,g.parseListStyle)(D):null,lineBreak:(0,U.parseLineBreak)(D.lineBreak),margin:(0,C.parseMargin)(D),opacity:parseFloat(D.opacity),overflow:-1===b.indexOf(e.tagName)?(0,d.parseOverflow)(D.overflow):d.OVERFLOW.HIDDEN,overflowWrap:(0,F.parseOverflowWrap)(D.overflowWrap?D.overflowWrap:D.wordWrap),padding:(0,E.parsePadding)(D),position:R,textDecoration:(0,h.parseTextDecoration)(D),textShadow:(0,H.parseTextShadow)(D.textShadow),textTransform:(0,p.parseTextTransform)(D.textTransform),transform:(0,N.parseTransform)(D),visibility:(0,I.parseVisibility)(D.visibility),wordBreak:(0,K.parseWordBreak)(D.wordBreak),zIndex:(0,T.parseZIndex)(R!==f.POSITION.STATIC?D.zIndex:"auto")},this.isTransformed()&&(e.style.transform="matrix(1,0,0,1,0,0)"),M===l.DISPLAY.LIST_ITEM){var P=(0,y.getListOwner)(this);if(P){var X=P.listItems.length;P.listItems.push(this),this.listIndex=e.hasAttribute("value")&&"number"==typeof e.value?e.value:0===X?"number"==typeof P.listStart?P.listStart:1:P.listItems[X-1].listIndex+1}}"IMG"===e.tagName&&e.addEventListener("load",function(){B.bounds=(0,m.parseBounds)(e,S,_),B.curvedBounds=(0,m.parseBoundCurves)(B.bounds,B.style.border,B.style.borderRadius)}),this.image=L(e,r),this.bounds=O?(0,v.reformatInputBounds)((0,m.parseBounds)(e,S,_)):(0,m.parseBounds)(e,S,_),this.curvedBounds=(0,m.parseBoundCurves)(this.bounds,this.style.border,this.style.borderRadius)}return n(A,[{key:"getClipPaths",value:function(){var A=this.parent?this.parent.getClipPaths():[];return this.style.overflow!==d.OVERFLOW.VISIBLE?A.concat([(0,m.calculatePaddingBoxPath)(this.curvedBounds)]):A}},{key:"isInFlow",value:function(){return this.isRootElement()&&!this.isFloating()&&!this.isAbsolutelyPositioned()}},{key:"isVisible",value:function(){return!(0,s.contains)(this.style.display,l.DISPLAY.NONE)&&this.style.opacity>0&&this.style.visibility===I.VISIBILITY.VISIBLE}},{key:"isAbsolutelyPositioned",value:function(){return this.style.position!==f.POSITION.STATIC&&this.style.position!==f.POSITION.RELATIVE}},{key:"isPositioned",value:function(){return this.style.position!==f.POSITION.STATIC}},{key:"isFloating",value:function(){return this.style.float!==u.FLOAT.NONE}},{key:"isRootElement",value:function(){return null===this.parent}},{key:"isTransformed",value:function(){return null!==this.style.transform}},{key:"isPositionedWithZIndex",value:function(){return this.isPositioned()&&!this.style.zIndex.auto}},{key:"isInlineLevel",value:function(){return(0,s.contains)(this.style.display,l.DISPLAY.INLINE)||(0,s.contains)(this.style.display,l.DISPLAY.INLINE_BLOCK)||(0,s.contains)(this.style.display,l.DISPLAY.INLINE_FLEX)||(0,s.contains)(this.style.display,l.DISPLAY.INLINE_GRID)||(0,s.contains)(this.style.display,l.DISPLAY.INLINE_LIST_ITEM)||(0,s.contains)(this.style.display,l.DISPLAY.INLINE_TABLE)}},{key:"isInlineBlockOrInlineTable",value:function(){return(0,s.contains)(this.style.display,l.DISPLAY.INLINE_BLOCK)||(0,s.contains)(this.style.display,l.DISPLAY.INLINE_TABLE)}}]),A}();e.default=S;var L=function(A,e){if(A instanceof A.ownerDocument.defaultView.SVGSVGElement||A instanceof SVGSVGElement){var t=new XMLSerializer;return e.loadImage("data:image/svg+xml,"+encodeURIComponent(t.serializeToString(A)))}switch(A.tagName){case"IMG":var r=A;return e.loadImage(r.currentSrc||r.src);case"CANVAS":var n=A;return e.loadCanvas(n);case"IFRAME":var B=A.getAttribute("data-html2canvas-internal-iframe-key");if(B)return B}return null}},function(A,e,t){"use strict";Object.defineProperty(e,"__esModule",{value:!0});e.contains=function(A,e){return 0!=(A&e)},e.distance=function(A,e){return Math.sqrt(A*A+e*e)},e.copyCSSStyles=function(A,e){for(var t=A.length-1;t>=0;t--){var r=A.item(t);"content"!==r&&e.style.setProperty(r,A.getPropertyValue(r))}return e},e.SMALL_IMAGE="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"},function(A,e,t){"use strict";Object.defineProperty(e,"__esModule",{value:!0}),e.parseBackgroundImage=e.parseBackground=e.calculateBackgroundRepeatPath=e.calculateBackgroundPosition=e.calculateBackgroungPositioningArea=e.calculateBackgroungPaintingArea=e.calculateGradientBackgroundSize=e.calculateBackgroundSize=e.BACKGROUND_ORIGIN=e.BACKGROUND_CLIP=e.BACKGROUND_SIZE=e.BACKGROUND_REPEAT=void 0;var r=i(t(0)),n=i(t(1)),B=i(t(31)),a=i(t(7)),s=t(2),o=t(17);function i(A){return A&&A.__esModule?A:{default:A}}var c=e.BACKGROUND_REPEAT={REPEAT:0,NO_REPEAT:1,REPEAT_X:2,REPEAT_Y:3},l=e.BACKGROUND_SIZE={AUTO:0,CONTAIN:1,COVER:2,LENGTH:3},u=e.BACKGROUND_CLIP={BORDER_BOX:0,PADDING_BOX:1,CONTENT_BOX:2},Q=e.BACKGROUND_ORIGIN=u,w=function A(e){switch(function(A,e){if(!(A instanceof e))throw new TypeError("Cannot call a class as a function")}(this,A),e){case"contain":this.size=l.CONTAIN;break;case"cover":this.size=l.COVER;break;case"auto":this.size=l.AUTO;break;default:this.value=new n.default(e)}},U=(e.calculateBackgroundSize=function(A,e,t){var r=0,n=0,a=A.size;if(a[0].size===l.CONTAIN||a[0].size===l.COVER){var s=t.width/t.height,o=e.width/e.height;return s<o!=(a[0].size===l.COVER)?new B.default(t.width,t.width/o):new B.default(t.height*o,t.height)}return a[0].value&&(r=a[0].value.getAbsoluteValue(t.width)),a[0].size===l.AUTO&&a[1].size===l.AUTO?n=e.height:a[1].size===l.AUTO?n=r/e.width*e.height:a[1].value&&(n=a[1].value.getAbsoluteValue(t.height)),a[0].size===l.AUTO&&(r=n/e.height*e.width),new B.default(r,n)},e.calculateGradientBackgroundSize=function(A,e){var t=A.size,r=t[0].value?t[0].value.getAbsoluteValue(e.width):e.width,n=t[1].value?t[1].value.getAbsoluteValue(e.height):t[0].value?r:e.height;return new B.default(r,n)},new w("auto")),g=(e.calculateBackgroungPaintingArea=function(A,e){switch(e){case u.BORDER_BOX:return(0,s.calculateBorderBoxPath)(A);case u.PADDING_BOX:default:return(0,s.calculatePaddingBoxPath)(A)}},e.calculateBackgroungPositioningArea=function(A,e,t,r){var n=(0,s.calculatePaddingBox)(e,r);switch(A){case Q.BORDER_BOX:return e;case Q.CONTENT_BOX:var B=t[o.PADDING_SIDES.LEFT].getAbsoluteValue(e.width),a=t[o.PADDING_SIDES.RIGHT].getAbsoluteValue(e.width),i=t[o.PADDING_SIDES.TOP].getAbsoluteValue(e.width),c=t[o.PADDING_SIDES.BOTTOM].getAbsoluteValue(e.width);return new s.Bounds(n.left+B,n.top+i,n.width-B-a,n.height-i-c);case Q.PADDING_BOX:default:return n}},e.calculateBackgroundPosition=function(A,e,t){return new a.default(A[0].getAbsoluteValue(t.width-e.width),A[1].getAbsoluteValue(t.height-e.height))},e.calculateBackgroundRepeatPath=function(A,e,t,r,n){switch(A.repeat){case c.REPEAT_X:return[new a.default(Math.round(n.left),Math.round(r.top+e.y)),new a.default(Math.round(n.left+n.width),Math.round(r.top+e.y)),new a.default(Math.round(n.left+n.width),Math.round(t.height+r.top+e.y)),new a.default(Math.round(n.left),Math.round(t.height+r.top+e.y))];case c.REPEAT_Y:return[new a.default(Math.round(r.left+e.x),Math.round(n.top)),new a.default(Math.round(r.left+e.x+t.width),Math.round(n.top)),new a.default(Math.round(r.left+e.x+t.width),Math.round(n.height+n.top)),new a.default(Math.round(r.left+e.x),Math.round(n.height+n.top))];case c.NO_REPEAT:return[new a.default(Math.round(r.left+e.x),Math.round(r.top+e.y)),new a.default(Math.round(r.left+e.x+t.width),Math.round(r.top+e.y)),new a.default(Math.round(r.left+e.x+t.width),Math.round(r.top+e.y+t.height)),new a.default(Math.round(r.left+e.x),Math.round(r.top+e.y+t.height))];default:return[new a.default(Math.round(n.left),Math.round(n.top)),new a.default(Math.round(n.left+n.width),Math.round(n.top)),new a.default(Math.round(n.left+n.width),Math.round(n.height+n.top)),new a.default(Math.round(n.left),Math.round(n.height+n.top))]}},e.parseBackground=function(A,e){return{backgroundColor:new r.default(A.backgroundColor),backgroundImage:d(A,e),backgroundClip:g(A.backgroundClip),backgroundOrigin:C(A.backgroundOrigin)}},function(A){switch(A){case"padding-box":return u.PADDING_BOX;case"content-box":return u.CONTENT_BOX}return u.BORDER_BOX}),C=function(A){switch(A){case"padding-box":return Q.PADDING_BOX;case"content-box":return Q.CONTENT_BOX}return Q.BORDER_BOX},d=function(A,e){var t=f(A.backgroundImage).map(function(A){if("url"===A.method){var t=e.loadImage(A.args[0]);A.args=t?[t]:[]}return A}),r=A.backgroundPosition.split(","),n=A.backgroundRepeat.split(","),B=A.backgroundSize.split(",");return t.map(function(A,e){var t=(B[e]||"auto").trim().split(" ").map(F),a=(r[e]||"auto").trim().split(" ").map(E);return{source:A,repeat:function(A){switch(A.trim()){case"no-repeat":return c.NO_REPEAT;case"repeat-x":case"repeat no-repeat":return c.REPEAT_X;case"repeat-y":case"no-repeat repeat":return c.REPEAT_Y;case"repeat":return c.REPEAT}return c.REPEAT}("string"==typeof n[e]?n[e]:n[0]),size:t.length<2?[t[0],U]:[t[0],t[1]],position:a.length<2?[a[0],a[0]]:[a[0],a[1]]}})},F=function(A){return"auto"===A?U:new w(A)},E=function(A){switch(A){case"bottom":case"right":return new n.default("100%");case"left":case"top":return new n.default("0%");case"auto":return new n.default("0")}return new n.default(A)},f=e.parseBackgroundImage=function(A){var e=/^\s$/,t=[],r=[],n="",B=null,a="",s=0,o=0,i=function(){var A="";if(n){'"'===a.substr(0,1)&&(a=a.substr(1,a.length-2)),a&&r.push(a.trim());var e=n.indexOf("-",1)+1;"-"===n.substr(0,1)&&e>0&&(A=n.substr(0,e).toLowerCase(),n=n.substr(e)),"none"!==(n=n.toLowerCase())&&t.push({prefix:A,method:n,args:r})}r=[],n=a=""};return A.split("").forEach(function(A){if(0!==s||!e.test(A)){switch(A){case'"':B?B===A&&(B=null):B=A;break;case"(":if(B)break;if(0===s)return void(s=1);o++;break;case")":if(B)break;if(1===s){if(0===o)return s=0,void i();o--}break;case",":if(B)break;if(0===s)return void i();if(1===s&&0===o&&!n.match(/^url$/i))return r.push(a.trim()),void(a="")}0===s?n+=A:a+=A}}),i(),t}},function(A,e,t){"use strict";Object.defineProperty(e,"__esModule",{value:!0});e.PATH={VECTOR:0,BEZIER_CURVE:1,CIRCLE:2}},function(A,e,t){"use strict";Object.defineProperty(e,"__esModule",{value:!0});var r=t(6);e.default=function A(e,t){!function(A,e){if(!(A instanceof e))throw new TypeError("Cannot call a class as a function")}(this,A),this.type=r.PATH.VECTOR,this.x=e,this.y=t}},function(A,e,t){"use strict";Object.defineProperty(e,"__esModule",{value:!0}),e.parseListStyle=e.parseListStyleType=e.LIST_STYLE_TYPE=e.LIST_STYLE_POSITION=void 0;var r=t(5),n=e.LIST_STYLE_POSITION={INSIDE:0,OUTSIDE:1},B=e.LIST_STYLE_TYPE={NONE:-1,DISC:0,CIRCLE:1,SQUARE:2,DECIMAL:3,CJK_DECIMAL:4,DECIMAL_LEADING_ZERO:5,LOWER_ROMAN:6,UPPER_ROMAN:7,LOWER_GREEK:8,LOWER_ALPHA:9,UPPER_ALPHA:10,ARABIC_INDIC:11,ARMENIAN:12,BENGALI:13,CAMBODIAN:14,CJK_EARTHLY_BRANCH:15,CJK_HEAVENLY_STEM:16,CJK_IDEOGRAPHIC:17,DEVANAGARI:18,ETHIOPIC_NUMERIC:19,GEORGIAN:20,GUJARATI:21,GURMUKHI:22,HEBREW:22,HIRAGANA:23,HIRAGANA_IROHA:24,JAPANESE_FORMAL:25,JAPANESE_INFORMAL:26,KANNADA:27,KATAKANA:28,KATAKANA_IROHA:29,KHMER:30,KOREAN_HANGUL_FORMAL:31,KOREAN_HANJA_FORMAL:32,KOREAN_HANJA_INFORMAL:33,LAO:34,LOWER_ARMENIAN:35,MALAYALAM:36,MONGOLIAN:37,MYANMAR:38,ORIYA:39,PERSIAN:40,SIMP_CHINESE_FORMAL:41,SIMP_CHINESE_INFORMAL:42,TAMIL:43,TELUGU:44,THAI:45,TIBETAN:46,TRAD_CHINESE_FORMAL:47,TRAD_CHINESE_INFORMAL:48,UPPER_ARMENIAN:49,DISCLOSURE_OPEN:50,DISCLOSURE_CLOSED:51},a=e.parseListStyleType=function(A){switch(A){case"disc":return B.DISC;case"circle":return B.CIRCLE;case"square":return B.SQUARE;case"decimal":return B.DECIMAL;case"cjk-decimal":return B.CJK_DECIMAL;case"decimal-leading-zero":return B.DECIMAL_LEADING_ZERO;case"lower-roman":return B.LOWER_ROMAN;case"upper-roman":return B.UPPER_ROMAN;case"lower-greek":return B.LOWER_GREEK;case"lower-alpha":return B.LOWER_ALPHA;case"upper-alpha":return B.UPPER_ALPHA;case"arabic-indic":return B.ARABIC_INDIC;case"armenian":return B.ARMENIAN;case"bengali":return B.BENGALI;case"cambodian":return B.CAMBODIAN;case"cjk-earthly-branch":return B.CJK_EARTHLY_BRANCH;case"cjk-heavenly-stem":return B.CJK_HEAVENLY_STEM;case"cjk-ideographic":return B.CJK_IDEOGRAPHIC;case"devanagari":return B.DEVANAGARI;case"ethiopic-numeric":return B.ETHIOPIC_NUMERIC;case"georgian":return B.GEORGIAN;case"gujarati":return B.GUJARATI;case"gurmukhi":return B.GURMUKHI;case"hebrew":return B.HEBREW;case"hiragana":return B.HIRAGANA;case"hiragana-iroha":return B.HIRAGANA_IROHA;case"japanese-formal":return B.JAPANESE_FORMAL;case"japanese-informal":return B.JAPANESE_INFORMAL;case"kannada":return B.KANNADA;case"katakana":return B.KATAKANA;case"katakana-iroha":return B.KATAKANA_IROHA;case"khmer":return B.KHMER;case"korean-hangul-formal":return B.KOREAN_HANGUL_FORMAL;case"korean-hanja-formal":return B.KOREAN_HANJA_FORMAL;case"korean-hanja-informal":return B.KOREAN_HANJA_INFORMAL;case"lao":return B.LAO;case"lower-armenian":return B.LOWER_ARMENIAN;case"malayalam":return B.MALAYALAM;case"mongolian":return B.MONGOLIAN;case"myanmar":return B.MYANMAR;case"oriya":return B.ORIYA;case"persian":return B.PERSIAN;case"simp-chinese-formal":return B.SIMP_CHINESE_FORMAL;case"simp-chinese-informal":return B.SIMP_CHINESE_INFORMAL;case"tamil":return B.TAMIL;case"telugu":return B.TELUGU;case"thai":return B.THAI;case"tibetan":return B.TIBETAN;case"trad-chinese-formal":return B.TRAD_CHINESE_FORMAL;case"trad-chinese-informal":return B.TRAD_CHINESE_INFORMAL;case"upper-armenian":return B.UPPER_ARMENIAN;case"disclosure-open":return B.DISCLOSURE_OPEN;case"disclosure-closed":return B.DISCLOSURE_CLOSED;case"none":default:return B.NONE}},s=(e.parseListStyle=function(A){var e=(0,r.parseBackgroundImage)(A.getPropertyValue("list-style-image"));return{listStyleType:a(A.getPropertyValue("list-style-type")),listStyleImage:e.length?e[0]:null,listStylePosition:s(A.getPropertyValue("list-style-position"))}},function(A){switch(A){case"inside":return n.INSIDE;case"outside":default:return n.OUTSIDE}})},function(A,e,t){"use strict";Object.defineProperty(e,"__esModule",{value:!0});var r=function(){function A(A,e){for(var t=0;t<e.length;t++){var r=e[t];r.enumerable=r.enumerable||!1,r.configurable=!0,"value"in r&&(r.writable=!0),Object.defineProperty(A,r.key,r)}}return function(e,t,r){return t&&A(e.prototype,t),r&&A(e,r),e}}(),n=t(20),B=t(22);var a=function(){function A(e,t,r){!function(A,e){if(!(A instanceof e))throw new TypeError("Cannot call a class as a function")}(this,A),this.text=e,this.parent=t,this.bounds=r}return r(A,null,[{key:"fromTextNode",value:function(e,t){var r=o(e.data,t.style.textTransform);return new A(r,t,(0,B.parseTextBounds)(r,t,e))}}]),A}();e.default=a;var s=/(^|\s|:|-|\(|\))([a-z])/g,o=function(A,e){switch(e){case n.TEXT_TRANSFORM.LOWERCASE:return A.toLowerCase();case n.TEXT_TRANSFORM.CAPITALIZE:return A.replace(s,i);case n.TEXT_TRANSFORM.UPPERCASE:return A.toUpperCase();default:return A}};function i(A,e,t){return A.length>0?e+t.toUpperCase():A}},function(A,e,t){"use strict";Object.defineProperty(e,"__esModule",{value:!0});var r=t(23),n=function(A){return 0===A[0]&&255===A[1]&&0===A[2]&&255===A[3]},B={get SUPPORT_RANGE_BOUNDS(){var A=function(A){if(A.createRange){var e=A.createRange();if(e.getBoundingClientRect){var t=A.createElement("boundtest");t.style.height="123px",t.style.display="block",A.body.appendChild(t),e.selectNode(t);var r=e.getBoundingClientRect(),n=Math.round(r.height);if(A.body.removeChild(t),123===n)return!0}}return!1}(document);return Object.defineProperty(B,"SUPPORT_RANGE_BOUNDS",{value:A}),A},get SUPPORT_SVG_DRAWING(){var A=function(A){var e=new Image,t=A.createElement("canvas"),r=t.getContext("2d");e.src="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'></svg>";try{r.drawImage(e,0,0),t.toDataURL()}catch(A){return!1}return!0}(document);return Object.defineProperty(B,"SUPPORT_SVG_DRAWING",{value:A}),A},get SUPPORT_BASE64_DRAWING(){return function(A){var e=function(A,e){var t=new Image,r=A.createElement("canvas"),n=r.getContext("2d");return new Promise(function(A){t.src=e;var B=function(){try{n.drawImage(t,0,0),r.toDataURL()}catch(e){return A(!1)}return A(!0)};t.onload=B,t.onerror=function(){return A(!1)},!0===t.complete&&setTimeout(function(){B()},500)})}(document,A);return Object.defineProperty(B,"SUPPORT_BASE64_DRAWING",{value:function(){return e}}),e}},get SUPPORT_FOREIGNOBJECT_DRAWING(){var A="function"==typeof Array.from&&"function"==typeof window.fetch?function(A){var e=A.createElement("canvas");e.width=100,e.height=100;var t=e.getContext("2d");t.fillStyle="rgb(0, 255, 0)",t.fillRect(0,0,100,100);var B=new Image,a=e.toDataURL();B.src=a;var s=(0,r.createForeignObjectSVG)(100,100,0,0,B);return t.fillStyle="red",t.fillRect(0,0,100,100),(0,r.loadSerializedSVG)(s).then(function(e){t.drawImage(e,0,0);var B=t.getImageData(0,0,100,100).data;t.fillStyle="red",t.fillRect(0,0,100,100);var s=A.createElement("div");return s.style.backgroundImage="url("+a+")",s.style.height="100px",n(B)?(0,r.loadSerializedSVG)((0,r.createForeignObjectSVG)(100,100,0,0,s)):Promise.reject(!1)}).then(function(A){return t.drawImage(A,0,0),n(t.getImageData(0,0,100,100).data)}).catch(function(A){return!1})}(document):Promise.resolve(!1);return Object.defineProperty(B,"SUPPORT_FOREIGNOBJECT_DRAWING",{value:A}),A},get SUPPORT_CORS_IMAGES(){var A=void 0!==(new Image).crossOrigin;return Object.defineProperty(B,"SUPPORT_CORS_IMAGES",{value:A}),A},get SUPPORT_RESPONSE_TYPE(){var A="string"==typeof(new XMLHttpRequest).responseType;return Object.defineProperty(B,"SUPPORT_RESPONSE_TYPE",{value:A}),A},get SUPPORT_CORS_XHR(){var A="withCredentials"in new XMLHttpRequest;return Object.defineProperty(B,"SUPPORT_CORS_XHR",{value:A}),A}};e.default=B},function(A,e,t){"use strict";Object.defineProperty(e,"__esModule",{value:!0}),e.parseTextDecoration=e.TEXT_DECORATION_LINE=e.TEXT_DECORATION=e.TEXT_DECORATION_STYLE=void 0;var r,n=t(0),B=(r=n)&&r.__esModule?r:{default:r};var a=e.TEXT_DECORATION_STYLE={SOLID:0,DOUBLE:1,DOTTED:2,DASHED:3,WAVY:4},s=e.TEXT_DECORATION={NONE:null},o=e.TEXT_DECORATION_LINE={UNDERLINE:1,OVERLINE:2,LINE_THROUGH:3,BLINK:4},i=function(A){switch(A){case"underline":return o.UNDERLINE;case"overline":return o.OVERLINE;case"line-through":return o.LINE_THROUGH}return o.BLINK};e.parseTextDecoration=function(A){var e,t="none"===(e=A.textDecorationLine?A.textDecorationLine:A.textDecoration)?null:e.split(" ").map(i);return null===t?s.NONE:{textDecorationLine:t,textDecorationColor:A.textDecorationColor?new B.default(A.textDecorationColor):null,textDecorationStyle:function(A){switch(A){case"double":return a.DOUBLE;case"dotted":return a.DOTTED;case"dashed":return a.DASHED;case"wavy":return a.WAVY}return a.SOLID}(A.textDecorationStyle)}}},function(A,e,t){"use strict";Object.defineProperty(e,"__esModule",{value:!0}),e.parseBorder=e.BORDER_SIDES=e.BORDER_STYLE=void 0;var r,n=t(0),B=(r=n)&&r.__esModule?r:{default:r};var a=e.BORDER_STYLE={NONE:0,SOLID:1},s=e.BORDER_SIDES={TOP:0,RIGHT:1,BOTTOM:2,LEFT:3},o=Object.keys(s).map(function(A){return A.toLowerCase()});e.parseBorder=function(A){return o.map(function(e){var t=new B.default(A.getPropertyValue("border-"+e+"-color")),r=function(A){switch(A){case"none":return a.NONE}return a.SOLID}(A.getPropertyValue("border-"+e+"-style")),n=parseFloat(A.getPropertyValue("border-"+e+"-width"));return{borderColor:t,borderStyle:r,borderWidth:isNaN(n)?0:n}})}},function(A,e,t){"use strict";Object.defineProperty(e,"__esModule",{value:!0});e.toCodePoints=function(A){for(var e=[],t=0,r=A.length;t<r;){var n=A.charCodeAt(t++);if(n>=55296&&n<=56319&&t<r){var B=A.charCodeAt(t++);56320==(64512&B)?e.push(((1023&n)<<10)+(1023&B)+65536):(e.push(n),t--)}else e.push(n)}return e},e.fromCodePoint=function(){if(String.fromCodePoint)return String.fromCodePoint.apply(String,arguments);var A=arguments.length;if(!A)return"";for(var e=[],t=-1,r="";++t<A;){var n=arguments.length<=t?void 0:arguments[t];n<=65535?e.push(n):(n-=65536,e.push(55296+(n>>10),n%1024+56320)),(t+1===A||e.length>16384)&&(r+=String.fromCharCode.apply(String,e),e.length=0)}return r};for(var r="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/",n="undefined"==typeof Uint8Array?[]:new Uint8Array(256),B=0;B<r.length;B++)n[r.charCodeAt(B)]=B;e.decode=function(A){var e=.75*A.length,t=A.length,r=void 0,B=0,a=void 0,s=void 0,o=void 0,i=void 0;"="===A[A.length-1]&&(e--,"="===A[A.length-2]&&e--);var c="undefined"!=typeof ArrayBuffer&&"undefined"!=typeof Uint8Array&&void 0!==Uint8Array.prototype.slice?new ArrayBuffer(e):new Array(e),l=Array.isArray(c)?c:new Uint8Array(c);for(r=0;r<t;r+=4)a=n[A.charCodeAt(r)],s=n[A.charCodeAt(r+1)],o=n[A.charCodeAt(r+2)],i=n[A.charCodeAt(r+3)],l[B++]=a<<2|s>>4,l[B++]=(15&s)<<4|o>>2,l[B++]=(3&o)<<6|63&i;return c},e.polyUint16Array=function(A){for(var e=A.length,t=[],r=0;r<e;r+=2)t.push(A[r+1]<<8|A[r]);return t},e.polyUint32Array=function(A){for(var e=A.length,t=[],r=0;r<e;r+=4)t.push(A[r+3]<<24|A[r+2]<<16|A[r+1]<<8|A[r]);return t}},function(A,e,t){"use strict";Object.defineProperty(e,"__esModule",{value:!0}),e.createCounterText=e.inlineListItemElement=e.getListOwner=void 0;var r=t(4),n=o(t(3)),B=o(t(9)),a=t(8),s=t(24);function o(A){return A&&A.__esModule?A:{default:A}}var i=["OL","UL","MENU"],c=(e.getListOwner=function(A){var e=A.parent;if(!e)return null;do{if(-1!==i.indexOf(e.tagName))return e;e=e.parent}while(e);return A.parent},e.inlineListItemElement=function(A,e,t){var s=e.style.listStyle;if(s){var o=A.ownerDocument.defaultView.getComputedStyle(A,null),i=A.ownerDocument.createElement("html2canvaswrapper");switch((0,r.copyCSSStyles)(o,i),i.style.position="absolute",i.style.bottom="auto",i.style.display="block",i.style.letterSpacing="normal",s.listStylePosition){case a.LIST_STYLE_POSITION.OUTSIDE:i.style.left="auto",i.style.right=A.ownerDocument.defaultView.innerWidth-e.bounds.left-e.style.margin[1].getAbsoluteValue(e.bounds.width)+7+"px",i.style.textAlign="right";break;case a.LIST_STYLE_POSITION.INSIDE:i.style.left=e.bounds.left-e.style.margin[3].getAbsoluteValue(e.bounds.width)+"px",i.style.right="auto",i.style.textAlign="left"}var c=void 0,l=e.style.margin[0].getAbsoluteValue(e.bounds.width),u=s.listStyleImage;if(u)if("url"===u.method){var Q=A.ownerDocument.createElement("img");Q.src=u.args[0],i.style.top=e.bounds.top-l+"px",i.style.width="auto",i.style.height="auto",i.appendChild(Q)}else{var w=.5*parseFloat(e.style.font.fontSize);i.style.top=e.bounds.top-l+e.bounds.height-1.5*w+"px",i.style.width=w+"px",i.style.height=w+"px",i.style.backgroundImage=o.listStyleImage}else"number"==typeof e.listIndex&&(c=A.ownerDocument.createTextNode(F(e.listIndex,s.listStyleType,!0)),i.appendChild(c),i.style.top=e.bounds.top-l+"px");var U=A.ownerDocument.body;U.appendChild(i),c?(e.childNodes.push(B.default.fromTextNode(c,e)),U.removeChild(i)):e.childNodes.push(new n.default(i,e,t,0))}},{integers:[1e3,900,500,400,100,90,50,40,10,9,5,4,1],values:["M","CM","D","CD","C","XC","L","XL","X","IX","V","IV","I"]}),l={integers:[9e3,8e3,7e3,6e3,5e3,4e3,3e3,2e3,1e3,900,800,700,600,500,400,300,200,100,90,80,70,60,50,40,30,20,10,9,8,7,6,5,4,3,2,1],values:["Ք","Փ","Ւ","Ց","Ր","Տ","Վ","Ս","Ռ","Ջ","Պ","Չ","Ո","Շ","Ն","Յ","Մ","Ճ","Ղ","Ձ","Հ","Կ","Ծ","Խ","Լ","Ի","Ժ","Թ","Ը","Է","Զ","Ե","Դ","Գ","Բ","Ա"]},u={integers:[1e4,9e3,8e3,7e3,6e3,5e3,4e3,3e3,2e3,1e3,400,300,200,100,90,80,70,60,50,40,30,20,19,18,17,16,15,10,9,8,7,6,5,4,3,2,1],values:["י׳","ט׳","ח׳","ז׳","ו׳","ה׳","ד׳","ג׳","ב׳","א׳","ת","ש","ר","ק","צ","פ","ע","ס","נ","מ","ל","כ","יט","יח","יז","טז","טו","י","ט","ח","ז","ו","ה","ד","ג","ב","א"]},Q={integers:[1e4,9e3,8e3,7e3,6e3,5e3,4e3,3e3,2e3,1e3,900,800,700,600,500,400,300,200,100,90,80,70,60,50,40,30,20,10,9,8,7,6,5,4,3,2,1],values:["ჵ","ჰ","ჯ","ჴ","ხ","ჭ","წ","ძ","ც","ჩ","შ","ყ","ღ","ქ","ფ","ჳ","ტ","ს","რ","ჟ","პ","ო","ჲ","ნ","მ","ლ","კ","ი","თ","ჱ","ზ","ვ","ე","დ","გ","ბ","ა"]},w=function(A,e,t,r,n,B){return A<e||A>t?F(A,n,B.length>0):r.integers.reduce(function(e,t,n){for(;A>=t;)A-=t,e+=r.values[n];return e},"")+B},U=function(A,e,t,r){var n="";do{t||A--,n=r(A)+n,A/=e}while(A*e>=e);return n},g=function(A,e,t,r,n){var B=t-e+1;return(A<0?"-":"")+(U(Math.abs(A),B,r,function(A){return(0,s.fromCodePoint)(Math.floor(A%B)+e)})+n)},C=function(A,e){var t=arguments.length>2&&void 0!==arguments[2]?arguments[2]:". ",r=e.length;return U(Math.abs(A),r,!1,function(A){return e[Math.floor(A%r)]})+t},d=function(A,e,t,n,B,s){if(A<-9999||A>9999)return F(A,a.LIST_STYLE_TYPE.CJK_DECIMAL,B.length>0);var o=Math.abs(A),i=B;if(0===o)return e[0]+i;for(var c=0;o>0&&c<=4;c++){var l=o%10;0===l&&(0,r.contains)(s,1)&&""!==i?i=e[l]+i:l>1||1===l&&0===c||1===l&&1===c&&(0,r.contains)(s,2)||1===l&&1===c&&(0,r.contains)(s,4)&&A>100||1===l&&c>1&&(0,r.contains)(s,8)?i=e[l]+(c>0?t[c-1]:"")+i:1===l&&c>0&&(i=t[c-1]+i),o=Math.floor(o/10)}return(A<0?n:"")+i},F=e.createCounterText=function(A,e,t){var r=t?". ":"",n=t?"、":"",B=t?", ":"";switch(e){case a.LIST_STYLE_TYPE.DISC:return"•";case a.LIST_STYLE_TYPE.CIRCLE:return"◦";case a.LIST_STYLE_TYPE.SQUARE:return"◾";case a.LIST_STYLE_TYPE.DECIMAL_LEADING_ZERO:var s=g(A,48,57,!0,r);return s.length<4?"0"+s:s;case a.LIST_STYLE_TYPE.CJK_DECIMAL:return C(A,"〇一二三四五六七八九",n);case a.LIST_STYLE_TYPE.LOWER_ROMAN:return w(A,1,3999,c,a.LIST_STYLE_TYPE.DECIMAL,r).toLowerCase();case a.LIST_STYLE_TYPE.UPPER_ROMAN:return w(A,1,3999,c,a.LIST_STYLE_TYPE.DECIMAL,r);case a.LIST_STYLE_TYPE.LOWER_GREEK:return g(A,945,969,!1,r);case a.LIST_STYLE_TYPE.LOWER_ALPHA:return g(A,97,122,!1,r);case a.LIST_STYLE_TYPE.UPPER_ALPHA:return g(A,65,90,!1,r);case a.LIST_STYLE_TYPE.ARABIC_INDIC:return g(A,1632,1641,!0,r);case a.LIST_STYLE_TYPE.ARMENIAN:case a.LIST_STYLE_TYPE.UPPER_ARMENIAN:return w(A,1,9999,l,a.LIST_STYLE_TYPE.DECIMAL,r);case a.LIST_STYLE_TYPE.LOWER_ARMENIAN:return w(A,1,9999,l,a.LIST_STYLE_TYPE.DECIMAL,r).toLowerCase();case a.LIST_STYLE_TYPE.BENGALI:return g(A,2534,2543,!0,r);case a.LIST_STYLE_TYPE.CAMBODIAN:case a.LIST_STYLE_TYPE.KHMER:return g(A,6112,6121,!0,r);case a.LIST_STYLE_TYPE.CJK_EARTHLY_BRANCH:return C(A,"子丑寅卯辰巳午未申酉戌亥",n);case a.LIST_STYLE_TYPE.CJK_HEAVENLY_STEM:return C(A,"甲乙丙丁戊己庚辛壬癸",n);case a.LIST_STYLE_TYPE.CJK_IDEOGRAPHIC:case a.LIST_STYLE_TYPE.TRAD_CHINESE_INFORMAL:return d(A,"零一二三四五六七八九","十百千萬","負",n,14);case a.LIST_STYLE_TYPE.TRAD_CHINESE_FORMAL:return d(A,"零壹貳參肆伍陸柒捌玖","拾佰仟萬","負",n,15);case a.LIST_STYLE_TYPE.SIMP_CHINESE_INFORMAL:return d(A,"零一二三四五六七八九","十百千萬","负",n,14);case a.LIST_STYLE_TYPE.SIMP_CHINESE_FORMAL:return d(A,"零壹贰叁肆伍陆柒捌玖","拾佰仟萬","负",n,15);case a.LIST_STYLE_TYPE.JAPANESE_INFORMAL:return d(A,"〇一二三四五六七八九","十百千万","マイナス",n,0);case a.LIST_STYLE_TYPE.JAPANESE_FORMAL:return d(A,"零壱弐参四伍六七八九","拾百千万","マイナス",n,7);case a.LIST_STYLE_TYPE.KOREAN_HANGUL_FORMAL:return d(A,"영일이삼사오육칠팔구","십백천만","마이너스 ",B,7);case a.LIST_STYLE_TYPE.KOREAN_HANJA_INFORMAL:return d(A,"零一二三四五六七八九","十百千萬","마이너스 ",B,0);case a.LIST_STYLE_TYPE.KOREAN_HANJA_FORMAL:return d(A,"零壹貳參四五六七八九","拾百千","마이너스 ",B,7);case a.LIST_STYLE_TYPE.DEVANAGARI:return g(A,2406,2415,!0,r);case a.LIST_STYLE_TYPE.GEORGIAN:return w(A,1,19999,Q,a.LIST_STYLE_TYPE.DECIMAL,r);case a.LIST_STYLE_TYPE.GUJARATI:return g(A,2790,2799,!0,r);case a.LIST_STYLE_TYPE.GURMUKHI:return g(A,2662,2671,!0,r);case a.LIST_STYLE_TYPE.HEBREW:return w(A,1,10999,u,a.LIST_STYLE_TYPE.DECIMAL,r);case a.LIST_STYLE_TYPE.HIRAGANA:return C(A,"あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわゐゑをん");case a.LIST_STYLE_TYPE.HIRAGANA_IROHA:return C(A,"いろはにほへとちりぬるをわかよたれそつねならむうゐのおくやまけふこえてあさきゆめみしゑひもせす");case a.LIST_STYLE_TYPE.KANNADA:return g(A,3302,3311,!0,r);case a.LIST_STYLE_TYPE.KATAKANA:return C(A,"アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヰヱヲン",n);case a.LIST_STYLE_TYPE.KATAKANA_IROHA:return C(A,"イロハニホヘトチリヌルヲワカヨタレソツネナラムウヰノオクヤマケフコエテアサキユメミシヱヒモセス",n);case a.LIST_STYLE_TYPE.LAO:return g(A,3792,3801,!0,r);case a.LIST_STYLE_TYPE.MONGOLIAN:return g(A,6160,6169,!0,r);case a.LIST_STYLE_TYPE.MYANMAR:return g(A,4160,4169,!0,r);case a.LIST_STYLE_TYPE.ORIYA:return g(A,2918,2927,!0,r);case a.LIST_STYLE_TYPE.PERSIAN:return g(A,1776,1785,!0,r);case a.LIST_STYLE_TYPE.TAMIL:return g(A,3046,3055,!0,r);case a.LIST_STYLE_TYPE.TELUGU:return g(A,3174,3183,!0,r);case a.LIST_STYLE_TYPE.THAI:return g(A,3664,3673,!0,r);case a.LIST_STYLE_TYPE.TIBETAN:return g(A,3872,3881,!0,r);case a.LIST_STYLE_TYPE.DECIMAL:default:return g(A,48,57,!0,r)}}},function(A,e,t){"use strict";Object.defineProperty(e,"__esModule",{value:!0});var r=function(){function A(A,e){for(var t=0;t<e.length;t++){var r=e[t];r.enumerable=r.enumerable||!1,r.configurable=!0,"value"in r&&(r.writable=!0),Object.defineProperty(A,r.key,r)}}return function(e,t,r){return t&&A(e.prototype,t),r&&A(e,r),e}}(),n=t(6),B=t(11);var a=function(A,e){var t=Math.max.apply(null,A.colorStops.map(function(A){return A.stop})),r=1/Math.max(1,t);A.colorStops.forEach(function(A){e.addColorStop(r*A.stop,A.color.toString())})},s=function(){function A(e){!function(A,e){if(!(A instanceof e))throw new TypeError("Cannot call a class as a function")}(this,A),this.canvas=e||document.createElement("canvas")}return r(A,[{key:"render",value:function(A){this.ctx=this.canvas.getContext("2d"),this.options=A,this.canvas.width=Math.floor(A.width*A.scale),this.canvas.height=Math.floor(A.height*A.scale),this.canvas.style.width=A.width+"px",this.canvas.style.height=A.height+"px",this.ctx.scale(this.options.scale,this.options.scale),this.ctx.translate(-A.x,-A.y),this.ctx.textBaseline="bottom",A.logger.log("Canvas renderer initialized ("+A.width+"x"+A.height+" at "+A.x+","+A.y+") with scale "+this.options.scale)}},{key:"clip",value:function(A,e){var t=this;A.length&&(this.ctx.save(),A.forEach(function(A){t.path(A),t.ctx.clip()})),e(),A.length&&this.ctx.restore()}},{key:"drawImage",value:function(A,e,t){this.ctx.drawImage(A,e.left,e.top,e.width,e.height,t.left,t.top,t.width,t.height)}},{key:"drawShape",value:function(A,e){this.path(A),this.ctx.fillStyle=e.toString(),this.ctx.fill()}},{key:"fill",value:function(A){this.ctx.fillStyle=A.toString(),this.ctx.fill()}},{key:"getTarget",value:function(){return this.canvas.getContext("2d").setTransform(1,0,0,1,0,0),Promise.resolve(this.canvas)}},{key:"path",value:function(A){var e=this;this.ctx.beginPath(),Array.isArray(A)?A.forEach(function(A,t){var r=A.type===n.PATH.VECTOR?A:A.start;0===t?e.ctx.moveTo(r.x,r.y):e.ctx.lineTo(r.x,r.y),A.type===n.PATH.BEZIER_CURVE&&e.ctx.bezierCurveTo(A.startControl.x,A.startControl.y,A.endControl.x,A.endControl.y,A.end.x,A.end.y)}):this.ctx.arc(A.x+A.radius,A.y+A.radius,A.radius,0,2*Math.PI,!0),this.ctx.closePath()}},{key:"rectangle",value:function(A,e,t,r,n){this.ctx.fillStyle=n.toString(),this.ctx.fillRect(A,e,t,r)}},{key:"renderLinearGradient",value:function(A,e){var t=this.ctx.createLinearGradient(A.left+e.direction.x1,A.top+e.direction.y1,A.left+e.direction.x0,A.top+e.direction.y0);a(e,t),this.ctx.fillStyle=t,this.ctx.fillRect(A.left,A.top,A.width,A.height)}},{key:"renderRadialGradient",value:function(A,e){var t=this,r=A.left+e.center.x,n=A.top+e.center.y,B=this.ctx.createRadialGradient(r,n,0,r,n,e.radius.x);if(B)if(a(e,B),this.ctx.fillStyle=B,e.radius.x!==e.radius.y){var s=A.left+.5*A.width,o=A.top+.5*A.height,i=e.radius.y/e.radius.x,c=1/i;this.transform(s,o,[1,0,0,i,0,0],function(){return t.ctx.fillRect(A.left,c*(A.top-o)+o,A.width,A.height*c)})}else this.ctx.fillRect(A.left,A.top,A.width,A.height)}},{key:"renderRepeat",value:function(A,e,t,r,n){this.path(A),this.ctx.fillStyle=this.ctx.createPattern(this.resizeImage(e,t),"repeat"),this.ctx.translate(r,n),this.ctx.fill(),this.ctx.translate(-r,-n)}},{key:"renderTextNode",value:function(A,e,t,r,n){var a=this;this.ctx.font=[t.fontStyle,t.fontVariant,t.fontWeight,t.fontSize,t.fontFamily].join(" "),A.forEach(function(A){if(a.ctx.fillStyle=e.toString(),n&&A.text.trim().length?n.slice(0).reverse().forEach(function(e){a.ctx.shadowColor=e.color.toString(),a.ctx.shadowOffsetX=e.offsetX*a.options.scale,a.ctx.shadowOffsetY=e.offsetY*a.options.scale,a.ctx.shadowBlur=e.blur,a.ctx.fillText(A.text,A.bounds.left,A.bounds.top+A.bounds.height)}):a.ctx.fillText(A.text,A.bounds.left,A.bounds.top+A.bounds.height),null!==r){var s=r.textDecorationColor||e;r.textDecorationLine.forEach(function(e){switch(e){case B.TEXT_DECORATION_LINE.UNDERLINE:var r=a.options.fontMetrics.getMetrics(t).baseline;a.rectangle(A.bounds.left,Math.round(A.bounds.top+r),A.bounds.width,1,s);break;case B.TEXT_DECORATION_LINE.OVERLINE:a.rectangle(A.bounds.left,Math.round(A.bounds.top),A.bounds.width,1,s);break;case B.TEXT_DECORATION_LINE.LINE_THROUGH:var n=a.options.fontMetrics.getMetrics(t).middle;a.rectangle(A.bounds.left,Math.ceil(A.bounds.top+n),A.bounds.width,1,s)}})}})}},{key:"resizeImage",value:function(A,e){if(A.width===e.width&&A.height===e.height)return A;var t=this.canvas.ownerDocument.createElement("canvas");return t.width=e.width,t.height=e.height,t.getContext("2d").drawImage(A,0,0,A.width,A.height,0,0,e.width,e.height),t}},{key:"setOpacity",value:function(A){this.ctx.globalAlpha=A}},{key:"transform",value:function(A,e,t,r){this.ctx.save(),this.ctx.translate(A,e),this.ctx.transform(t[0],t[1],t[2],t[3],t[4],t[5]),this.ctx.translate(-A,-e),r(),this.ctx.restore()}}]),A}();e.default=s},function(A,e,t){"use strict";Object.defineProperty(e,"__esModule",{value:!0});var r=function(){function A(A,e){for(var t=0;t<e.length;t++){var r=e[t];r.enumerable=r.enumerable||!1,r.configurable=!0,"value"in r&&(r.writable=!0),Object.defineProperty(A,r.key,r)}}return function(e,t,r){return t&&A(e.prototype,t),r&&A(e,r),e}}();var n=function(){function A(e,t,r){!function(A,e){if(!(A instanceof e))throw new TypeError("Cannot call a class as a function")}(this,A),this.enabled="undefined"!=typeof window&&e,this.start=r||Date.now(),this.id=t}return r(A,[{key:"child",value:function(e){return new A(this.enabled,e,this.start)}},{key:"log",value:function(){if(this.enabled&&window.console&&window.console.log){for(var A=arguments.length,e=Array(A),t=0;t<A;t++)e[t]=arguments[t];Function.prototype.bind.call(window.console.log,window.console).apply(window.console,[Date.now()-this.start+"ms",this.id?"html2canvas ("+this.id+"):":"html2canvas:"].concat([].slice.call(e,0)))}}},{key:"error",value:function(){if(this.enabled&&window.console&&window.console.error){for(var A=arguments.length,e=Array(A),t=0;t<A;t++)e[t]=arguments[t];Function.prototype.bind.call(window.console.error,window.console).apply(window.console,[Date.now()-this.start+"ms",this.id?"html2canvas ("+this.id+"):":"html2canvas:"].concat([].slice.call(e,0)))}}}]),A}();e.default=n},function(A,e,t){"use strict";Object.defineProperty(e,"__esModule",{value:!0}),e.parsePadding=e.PADDING_SIDES=void 0;var r,n=t(1),B=(r=n)&&r.__esModule?r:{default:r};e.PADDING_SIDES={TOP:0,RIGHT:1,BOTTOM:2,LEFT:3};var a=["top","right","bottom","left"];e.parsePadding=function(A){return a.map(function(e){return new B.default(A.getPropertyValue("padding-"+e))})}},function(A,e,t){"use strict";Object.defineProperty(e,"__esModule",{value:!0});var r=e.OVERFLOW_WRAP={NORMAL:0,BREAK_WORD:1};e.parseOverflowWrap=function(A){switch(A){case"break-word":return r.BREAK_WORD;case"normal":default:return r.NORMAL}}},function(A,e,t){"use strict";Object.defineProperty(e,"__esModule",{value:!0});var r=e.POSITION={STATIC:0,RELATIVE:1,ABSOLUTE:2,FIXED:3,STICKY:4};e.parsePosition=function(A){switch(A){case"relative":return r.RELATIVE;case"absolute":return r.ABSOLUTE;case"fixed":return r.FIXED;case"sticky":return r.STICKY}return r.STATIC}},function(A,e,t){"use strict";Object.defineProperty(e,"__esModule",{value:!0});var r=e.TEXT_TRANSFORM={NONE:0,LOWERCASE:1,UPPERCASE:2,CAPITALIZE:3};e.parseTextTransform=function(A){switch(A){case"uppercase":return r.UPPERCASE;case"lowercase":return r.LOWERCASE;case"capitalize":return r.CAPITALIZE}return r.NONE}},function(A,e,t){"use strict";Object.defineProperty(e,"__esModule",{value:!0}),e.reformatInputBounds=e.inlineSelectElement=e.inlineTextAreaElement=e.inlineInputElement=e.getInputBorderRadius=e.INPUT_BACKGROUND=e.INPUT_BORDERS=e.INPUT_COLOR=void 0;var r=l(t(9)),n=t(5),B=t(12),a=l(t(50)),s=l(t(7)),o=l(t(0)),i=l(t(1)),c=(t(2),t(22),t(4));function l(A){return A&&A.__esModule?A:{default:A}}e.INPUT_COLOR=new o.default([42,42,42]);var u=new o.default([165,165,165]),Q=new o.default([222,222,222]),w={borderWidth:1,borderColor:u,borderStyle:B.BORDER_STYLE.SOLID},U=(e.INPUT_BORDERS=[w,w,w,w],e.INPUT_BACKGROUND={backgroundColor:Q,backgroundImage:[],backgroundClip:n.BACKGROUND_CLIP.PADDING_BOX,backgroundOrigin:n.BACKGROUND_ORIGIN.PADDING_BOX},new i.default("50%")),g=[U,U],C=[g,g,g,g],d=new i.default("3px"),F=[d,d],E=[F,F,F,F],f=(e.getInputBorderRadius=function(A){return"radio"===A.type?C:E},e.inlineInputElement=function(A,e){if("radio"===A.type||"checkbox"===A.type){if(A.checked){var t=Math.min(e.bounds.width,e.bounds.height);e.childNodes.push("checkbox"===A.type?[new s.default(e.bounds.left+.39363*t,e.bounds.top+.79*t),new s.default(e.bounds.left+.16*t,e.bounds.top+.5549*t),new s.default(e.bounds.left+.27347*t,e.bounds.top+.44071*t),new s.default(e.bounds.left+.39694*t,e.bounds.top+.5649*t),new s.default(e.bounds.left+.72983*t,e.bounds.top+.23*t),new s.default(e.bounds.left+.84*t,e.bounds.top+.34085*t),new s.default(e.bounds.left+.39363*t,e.bounds.top+.79*t)]:new a.default(e.bounds.left+t/4,e.bounds.top+t/4,t/4))}}else f(h(A),A,e,!1)},e.inlineTextAreaElement=function(A,e){f(A.value,A,e,!0)},e.inlineSelectElement=function(A,e){var t=A.options[A.selectedIndex||0];f(t&&t.text||"",A,e,!1)},e.reformatInputBounds=function(A){return A.width>A.height?(A.left+=(A.width-A.height)/2,A.width=A.height):A.width<A.height&&(A.top+=(A.height-A.width)/2,A.height=A.width),A},function(A,e,t,n){var B=e.ownerDocument.body;if(A.length>0&&B){var a=e.ownerDocument.createElement("html2canvaswrapper");(0,c.copyCSSStyles)(e.ownerDocument.defaultView.getComputedStyle(e,null),a),a.style.position="absolute",a.style.left=t.bounds.left+"px",a.style.top=t.bounds.top+"px",n||(a.style.whiteSpace="nowrap");var s=e.ownerDocument.createTextNode(A);a.appendChild(s),B.appendChild(a),t.childNodes.push(r.default.fromTextNode(s,t)),B.removeChild(a)}}),h=function(A){var e="password"===A.type?new Array(A.value.length+1).join("•"):A.value;return 0===e.length?A.placeholder||"":e}},function(A,e,t){"use strict";Object.defineProperty(e,"__esModule",{value:!0}),e.parseTextBounds=e.TextBounds=void 0;var r,n=t(2),B=t(11),a=t(10),s=(r=a)&&r.__esModule?r:{default:r},o=t(24);var i=e.TextBounds=function A(e,t){!function(A,e){if(!(A instanceof e))throw new TypeError("Cannot call a class as a function")}(this,A),this.text=e,this.bounds=t},c=(e.parseTextBounds=function(A,e,t){for(var r=0!==e.style.letterSpacing?(0,o.toCodePoints)(A).map(function(A){return(0,o.fromCodePoint)(A)}):(0,o.breakWords)(A,e),n=r.length,a=t.parentNode?t.parentNode.ownerDocument.defaultView:null,u=a?a.pageXOffset:0,Q=a?a.pageYOffset:0,w=[],U=0,g=0;g<n;g++){var C=r[g];if(e.style.textDecoration!==B.TEXT_DECORATION.NONE||C.trim().length>0)if(s.default.SUPPORT_RANGE_BOUNDS)w.push(new i(C,l(t,U,C.length,u,Q)));else{var d=t.splitText(C.length);w.push(new i(C,c(t,u,Q))),t=d}else s.default.SUPPORT_RANGE_BOUNDS||(t=t.splitText(C.length));U+=C.length}return w},function(A,e,t){var r=A.ownerDocument.createElement("html2canvaswrapper");r.appendChild(A.cloneNode(!0));var B=A.parentNode;if(B){B.replaceChild(r,A);var a=(0,n.parseBounds)(r,e,t);return r.firstChild&&B.replaceChild(r.firstChild,r),a}return new n.Bounds(0,0,0,0)}),l=function(A,e,t,r,B){var a=A.ownerDocument.createRange();return a.setStart(A,e),a.setEnd(A,e+t),n.Bounds.fromClientRect(a.getBoundingClientRect(),r,B)}},function(A,e,t){"use strict";Object.defineProperty(e,"__esModule",{value:!0});var r=function(){function A(A,e){for(var t=0;t<e.length;t++){var r=e[t];r.enumerable=r.enumerable||!1,r.configurable=!0,"value"in r&&(r.writable=!0),Object.defineProperty(A,r.key,r)}}return function(e,t,r){return t&&A(e.prototype,t),r&&A(e,r),e}}();var n=function(){function A(e){!function(A,e){if(!(A instanceof e))throw new TypeError("Cannot call a class as a function")}(this,A),this.element=e}return r(A,[{key:"render",value:function(A){var e=this;this.options=A,this.canvas=document.createElement("canvas"),this.ctx=this.canvas.getContext("2d"),this.canvas.width=Math.floor(A.width)*A.scale,this.canvas.height=Math.floor(A.height)*A.scale,this.canvas.style.width=A.width+"px",this.canvas.style.height=A.height+"px",A.logger.log("ForeignObject renderer initialized ("+A.width+"x"+A.height+" at "+A.x+","+A.y+") with scale "+A.scale);var t=B(Math.max(A.windowWidth,A.width)*A.scale,Math.max(A.windowHeight,A.height)*A.scale,A.scrollX*A.scale,A.scrollY*A.scale,this.element);return a(t).then(function(t){return A.backgroundColor&&(e.ctx.fillStyle=A.backgroundColor.toString(),e.ctx.fillRect(0,0,A.width*A.scale,A.height*A.scale)),e.ctx.drawImage(t,-A.x*A.scale,-A.y*A.scale),e.canvas})}}]),A}();e.default=n;var B=e.createForeignObjectSVG=function(A,e,t,r,n){var B="http://www.w3.org/2000/svg",a=document.createElementNS(B,"svg"),s=document.createElementNS(B,"foreignObject");return a.setAttributeNS(null,"width",A),a.setAttributeNS(null,"height",e),s.setAttributeNS(null,"width","100%"),s.setAttributeNS(null,"height","100%"),s.setAttributeNS(null,"x",t),s.setAttributeNS(null,"y",r),s.setAttributeNS(null,"externalResourcesRequired","true"),a.appendChild(s),s.appendChild(n),a},a=e.loadSerializedSVG=function(A){return new Promise(function(e,t){var r=new Image;r.onload=function(){return e(r)},r.onerror=t,r.src="data:image/svg+xml;charset=utf-8,"+encodeURIComponent((new XMLSerializer).serializeToString(A))})}},function(A,e,t){"use strict";Object.defineProperty(e,"__esModule",{value:!0}),e.breakWords=e.fromCodePoint=e.toCodePoints=void 0;var r=t(46);Object.defineProperty(e,"toCodePoints",{enumerable:!0,get:function(){return r.toCodePoints}}),Object.defineProperty(e,"fromCodePoint",{enumerable:!0,get:function(){return r.fromCodePoint}});var n,B=t(3),a=((n=B)&&n.__esModule,t(18));e.breakWords=function(A,e){for(var t=(0,r.LineBreaker)(A,{lineBreak:e.style.lineBreak,wordBreak:e.style.overflowWrap===a.OVERFLOW_WRAP.BREAK_WORD?"break-word":e.style.wordBreak}),n=[],B=void 0;!(B=t.next()).done;)n.push(B.value.slice());return n}},function(A,e,t){"use strict";Object.defineProperty(e,"__esModule",{value:!0}),e.FontMetrics=void 0;var r=function(){function A(A,e){for(var t=0;t<e.length;t++){var r=e[t];r.enumerable=r.enumerable||!1,r.configurable=!0,"value"in r&&(r.writable=!0),Object.defineProperty(A,r.key,r)}}return function(e,t,r){return t&&A(e.prototype,t),r&&A(e,r),e}}(),n=t(4);e.FontMetrics=function(){function A(e){!function(A,e){if(!(A instanceof e))throw new TypeError("Cannot call a class as a function")}(this,A),this._data={},this._document=e}return r(A,[{key:"_parseMetrics",value:function(A){var e=this._document.createElement("div"),t=this._document.createElement("img"),r=this._document.createElement("span"),B=this._document.body;if(!B)throw new Error("");e.style.visibility="hidden",e.style.fontFamily=A.fontFamily,e.style.fontSize=A.fontSize,e.style.margin="0",e.style.padding="0",B.appendChild(e),t.src=n.SMALL_IMAGE,t.width=1,t.height=1,t.style.margin="0",t.style.padding="0",t.style.verticalAlign="baseline",r.style.fontFamily=A.fontFamily,r.style.fontSize=A.fontSize,r.style.margin="0",r.style.padding="0",r.appendChild(this._document.createTextNode("Hidden Text")),e.appendChild(r),e.appendChild(t);var a=t.offsetTop-r.offsetTop+2;e.removeChild(r),e.appendChild(this._document.createTextNode("Hidden Text")),e.style.lineHeight="normal",t.style.verticalAlign="super";var s=t.offsetTop-e.offsetTop+2;return B.removeChild(e),{baseline:a,middle:s}}},{key:"getMetrics",value:function(A){var e=A.fontFamily+" "+A.fontSize;return void 0===this._data[e]&&(this._data[e]=this._parseMetrics(A)),this._data[e]}}]),A}()},function(A,e,t){"use strict";Object.defineProperty(e,"__esModule",{value:!0}),e.Proxy=void 0;var r,n=t(10),B=(r=n)&&r.__esModule?r:{default:r};e.Proxy=function(A,e){if(!e.proxy)return Promise.reject(null);var t=e.proxy;return new Promise(function(r,n){var a=B.default.SUPPORT_CORS_XHR&&B.default.SUPPORT_RESPONSE_TYPE?"blob":"text",s=B.default.SUPPORT_CORS_XHR?new XMLHttpRequest:new XDomainRequest;if(s.onload=function(){if(s instanceof XMLHttpRequest)if(200===s.status)if("text"===a)r(s.response);else{var A=new FileReader;A.addEventListener("load",function(){return r(A.result)},!1),A.addEventListener("error",function(A){return n(A)},!1),A.readAsDataURL(s.response)}else n("");else r(s.responseText)},s.onerror=n,s.open("GET",t+"?url="+encodeURIComponent(A)+"&responseType="+a),"text"!==a&&s instanceof XMLHttpRequest&&(s.responseType=a),e.imageTimeout){var o=e.imageTimeout;s.timeout=o,s.ontimeout=function(){return n("")}}s.send()})}},function(A,e,t){"use strict";var r=Object.assign||function(A){for(var e=1;e<arguments.length;e++){var t=arguments[e];for(var r in t)Object.prototype.hasOwnProperty.call(t,r)&&(A[r]=t[r])}return A},n=s(t(15)),B=s(t(16)),a=t(28);function s(A){return A&&A.__esModule?A:{default:A}}var o=function(A,e){var t=e||{},s=new B.default("boolean"!=typeof t.logging||t.logging);s.log("html2canvas 1.0.0-alpha.12");var o=A.ownerDocument;if(!o)return Promise.reject("Provided element is not within a Document");var i=o.defaultView,c={async:!0,allowTaint:!1,backgroundColor:"#ffffff",imageTimeout:15e3,logging:!0,proxy:null,removeContainer:!0,foreignObjectRendering:!1,scale:i.devicePixelRatio||1,target:new n.default(t.canvas),useCORS:!1,windowWidth:i.innerWidth,windowHeight:i.innerHeight,scrollX:i.pageXOffset,scrollY:i.pageYOffset},l=(0,a.renderElement)(A,r({},c,t),s);return l};o.CanvasRenderer=n.default,A.exports=o},function(A,e,t){"use strict";Object.defineProperty(e,"__esModule",{value:!0}),e.renderElement=void 0;var r=function(){return function(A,e){if(Array.isArray(A))return A;if(Symbol.iterator in Object(A))return function(A,e){var t=[],r=!0,n=!1,B=void 0;try{for(var a,s=A[Symbol.iterator]();!(r=(a=s.next()).done)&&(t.push(a.value),!e||t.length!==e);r=!0);}catch(A){n=!0,B=A}finally{try{!r&&s.return&&s.return()}finally{if(n)throw B}}return t}(A,e);throw new TypeError("Invalid attempt to destructure non-iterable instance")}}(),n=(Q(t(16)),t(29)),B=Q(t(51)),a=Q(t(23)),s=Q(t(10)),o=t(2),i=t(54),c=t(25),l=t(0),u=Q(l);function Q(A){return A&&A.__esModule?A:{default:A}}e.renderElement=function A(e,t,Q){var w=e.ownerDocument,U=new o.Bounds(t.scrollX,t.scrollY,t.windowWidth,t.windowHeight),g=w.documentElement?new u.default(getComputedStyle(w.documentElement).backgroundColor):l.TRANSPARENT,C=w.body?new u.default(getComputedStyle(w.body).backgroundColor):l.TRANSPARENT,d=e===w.documentElement?g.isTransparent()?C.isTransparent()?t.backgroundColor?new u.default(t.backgroundColor):null:C:g:t.backgroundColor?new u.default(t.backgroundColor):null;return(t.foreignObjectRendering?s.default.SUPPORT_FOREIGNOBJECT_DRAWING:Promise.resolve(!1)).then(function(s){return s?(u=new i.DocumentCloner(e,t,Q,!0,A)).inlineFonts(w).then(function(){return u.resourceLoader.ready()}).then(function(){var A=new a.default(u.documentElement),r=w.defaultView,n=r.pageXOffset,B=r.pageYOffset,s="HTML"===e.tagName||"BODY"===e.tagName?(0,o.parseDocumentSize)(w):(0,o.parseBounds)(e,n,B),i=s.width,c=s.height,l=s.left,U=s.top;return A.render({backgroundColor:d,logger:Q,scale:t.scale,x:"number"==typeof t.x?t.x:l,y:"number"==typeof t.y?t.y:U,width:"number"==typeof t.width?t.width:Math.ceil(i),height:"number"==typeof t.height?t.height:Math.ceil(c),windowWidth:t.windowWidth,windowHeight:t.windowHeight,scrollX:t.scrollX,scrollY:t.scrollY})}):(0,i.cloneWindow)(w,U,e,t,Q,A).then(function(A){var e=r(A,3),a=e[0],s=e[1],i=e[2];var u=(0,n.NodeParser)(s,i,Q),U=s.ownerDocument;return d===u.container.style.background.backgroundColor&&(u.container.style.background.backgroundColor=l.TRANSPARENT),i.ready().then(function(A){var e=new c.FontMetrics(U);var r=U.defaultView,n=r.pageXOffset,i=r.pageYOffset,l="HTML"===s.tagName||"BODY"===s.tagName?(0,o.parseDocumentSize)(w):(0,o.parseBounds)(s,n,i),g=l.width,C=l.height,F=l.left,E=l.top,f={backgroundColor:d,fontMetrics:e,imageStore:A,logger:Q,scale:t.scale,x:"number"==typeof t.x?t.x:F,y:"number"==typeof t.y?t.y:E,width:"number"==typeof t.width?t.width:Math.ceil(g),height:"number"==typeof t.height?t.height:Math.ceil(C)};if(Array.isArray(t.target))return Promise.all(t.target.map(function(A){return new B.default(A,f).render(u)}));var h=new B.default(t.target,f).render(u);return!0===t.removeContainer&&a.parentNode&&a.parentNode.removeChild(a),h})});var u})}},function(A,e,t){"use strict";Object.defineProperty(e,"__esModule",{value:!0}),e.NodeParser=void 0;var r=i(t(30)),n=i(t(3)),B=i(t(9)),a=t(21),s=t(14),o=t(8);function i(A){return A&&A.__esModule?A:{default:A}}e.NodeParser=function(A,e,t){var B=0,a=new n.default(A,null,e,B++),s=new r.default(a,null,!0);return l(A,a,s,e,B),s};var c=["SCRIPT","HEAD","TITLE","OBJECT","BR","OPTION"],l=function A(e,t,i,l,w){for(var U,g=e.firstChild;g;g=U){U=g.nextSibling;var C=g.ownerDocument.defaultView;if(g instanceof C.Text||g instanceof Text||C.parent&&g instanceof C.parent.Text)g.data.trim().length>0&&t.childNodes.push(B.default.fromTextNode(g,t));else if(g instanceof C.HTMLElement||g instanceof HTMLElement||C.parent&&g instanceof C.parent.HTMLElement){if(-1===c.indexOf(g.nodeName)){var d=new n.default(g,t,l,w++);if(d.isVisible()){"INPUT"===g.tagName?(0,a.inlineInputElement)(g,d):"TEXTAREA"===g.tagName?(0,a.inlineTextAreaElement)(g,d):"SELECT"===g.tagName?(0,a.inlineSelectElement)(g,d):d.style.listStyle&&d.style.listStyle.listStyleType!==o.LIST_STYLE_TYPE.NONE&&(0,s.inlineListItemElement)(g,d,l);var F="TEXTAREA"!==g.tagName,E=u(d,g);if(E||Q(d)){var f=E||d.isPositioned()?i.getRealParentStackingContext():i,h=new r.default(d,f,E);f.contexts.push(h),F&&A(g,d,h,l,w)}else i.children.push(d),F&&A(g,d,i,l,w)}}}else if(g instanceof C.SVGSVGElement||g instanceof SVGSVGElement||C.parent&&g instanceof C.parent.SVGSVGElement){var H=new n.default(g,t,l,w++),p=u(H,g);if(p||Q(H)){var N=p||H.isPositioned()?i.getRealParentStackingContext():i,I=new r.default(H,N,p);N.contexts.push(I)}else i.children.push(H)}}},u=function(A,e){return A.isRootElement()||A.isPositionedWithZIndex()||A.style.opacity<1||A.isTransformed()||w(A,e)},Q=function(A){return A.isPositioned()||A.isFloating()},w=function(A,e){return"BODY"===e.nodeName&&A.parent instanceof n.default&&A.parent.style.background.backgroundColor.isTransparent()}},function(A,e,t){"use strict";Object.defineProperty(e,"__esModule",{value:!0});var r,n=function(){function A(A,e){for(var t=0;t<e.length;t++){var r=e[t];r.enumerable=r.enumerable||!1,r.configurable=!0,"value"in r&&(r.writable=!0),Object.defineProperty(A,r.key,r)}}return function(e,t,r){return t&&A(e.prototype,t),r&&A(e,r),e}}(),B=t(3);(r=B)&&r.__esModule,t(19);var a=function(){function A(e,t,r){!function(A,e){if(!(A instanceof e))throw new TypeError("Cannot call a class as a function")}(this,A),this.container=e,this.parent=t,this.contexts=[],this.children=[],this.treatAsRealStackingContext=r}return n(A,[{key:"getOpacity",value:function(){return this.parent?this.container.style.opacity*this.parent.getOpacity():this.container.style.opacity}},{key:"getRealParentStackingContext",value:function(){return!this.parent||this.treatAsRealStackingContext?this:this.parent.getRealParentStackingContext()}}]),A}();e.default=a},function(A,e,t){"use strict";Object.defineProperty(e,"__esModule",{value:!0});e.default=function A(e,t){!function(A,e){if(!(A instanceof e))throw new TypeError("Cannot call a class as a function")}(this,A),this.width=e,this.height=t}},function(A,e,t){"use strict";Object.defineProperty(e,"__esModule",{value:!0});var r,n=function(){function A(A,e){for(var t=0;t<e.length;t++){var r=e[t];r.enumerable=r.enumerable||!1,r.configurable=!0,"value"in r&&(r.writable=!0),Object.defineProperty(A,r.key,r)}}return function(e,t,r){return t&&A(e.prototype,t),r&&A(e,r),e}}(),B=t(6),a=t(7),s=(r=a)&&r.__esModule?r:{default:r};var o=function(A,e,t){return new s.default(A.x+(e.x-A.x)*t,A.y+(e.y-A.y)*t)},i=function(){function A(e,t,r,n){!function(A,e){if(!(A instanceof e))throw new TypeError("Cannot call a class as a function")}(this,A),this.type=B.PATH.BEZIER_CURVE,this.start=e,this.startControl=t,this.endControl=r,this.end=n}return n(A,[{key:"subdivide",value:function(e,t){var r=o(this.start,this.startControl,e),n=o(this.startControl,this.endControl,e),B=o(this.endControl,this.end,e),a=o(r,n,e),s=o(n,B,e),i=o(a,s,e);return t?new A(this.start,r,a,i):new A(i,s,B,this.end)}},{key:"reverse",value:function(){return new A(this.end,this.endControl,this.startControl,this.start)}}]),A}();e.default=i},function(A,e,t){"use strict";Object.defineProperty(e,"__esModule",{value:!0}),e.parseBorderRadius=void 0;var r,n=function(){return function(A,e){if(Array.isArray(A))return A;if(Symbol.iterator in Object(A))return function(A,e){var t=[],r=!0,n=!1,B=void 0;try{for(var a,s=A[Symbol.iterator]();!(r=(a=s.next()).done)&&(t.push(a.value),!e||t.length!==e);r=!0);}catch(A){n=!0,B=A}finally{try{!r&&s.return&&s.return()}finally{if(n)throw B}}return t}(A,e);throw new TypeError("Invalid attempt to destructure non-iterable instance")}}(),B=t(1),a=(r=B)&&r.__esModule?r:{default:r};var s=["top-left","top-right","bottom-right","bottom-left"];e.parseBorderRadius=function(A){return s.map(function(e){var t=A.getPropertyValue("border-"+e+"-radius").split(" ").map(a.default.create),r=n(t,2),B=r[0],s=r[1];return void 0===s?[B,B]:[B,s]})}},function(A,e,t){"use strict";Object.defineProperty(e,"__esModule",{value:!0});var r=e.DISPLAY={NONE:1,BLOCK:2,INLINE:4,RUN_IN:8,FLOW:16,FLOW_ROOT:32,TABLE:64,FLEX:128,GRID:256,RUBY:512,SUBGRID:1024,LIST_ITEM:2048,TABLE_ROW_GROUP:4096,TABLE_HEADER_GROUP:8192,TABLE_FOOTER_GROUP:16384,TABLE_ROW:32768,TABLE_CELL:65536,TABLE_COLUMN_GROUP:1<<17,TABLE_COLUMN:1<<18,TABLE_CAPTION:1<<19,RUBY_BASE:1<<20,RUBY_TEXT:1<<21,RUBY_BASE_CONTAINER:1<<22,RUBY_TEXT_CONTAINER:1<<23,CONTENTS:1<<24,INLINE_BLOCK:1<<25,INLINE_LIST_ITEM:1<<26,INLINE_TABLE:1<<27,INLINE_FLEX:1<<28,INLINE_GRID:1<<29},n=function(A,e){return A|function(A){switch(A){case"block":return r.BLOCK;case"inline":return r.INLINE;case"run-in":return r.RUN_IN;case"flow":return r.FLOW;case"flow-root":return r.FLOW_ROOT;case"table":return r.TABLE;case"flex":return r.FLEX;case"grid":return r.GRID;case"ruby":return r.RUBY;case"subgrid":return r.SUBGRID;case"list-item":return r.LIST_ITEM;case"table-row-group":return r.TABLE_ROW_GROUP;case"table-header-group":return r.TABLE_HEADER_GROUP;case"table-footer-group":return r.TABLE_FOOTER_GROUP;case"table-row":return r.TABLE_ROW;case"table-cell":return r.TABLE_CELL;case"table-column-group":return r.TABLE_COLUMN_GROUP;case"table-column":return r.TABLE_COLUMN;case"table-caption":return r.TABLE_CAPTION;case"ruby-base":return r.RUBY_BASE;case"ruby-text":return r.RUBY_TEXT;case"ruby-base-container":return r.RUBY_BASE_CONTAINER;case"ruby-text-container":return r.RUBY_TEXT_CONTAINER;case"contents":return r.CONTENTS;case"inline-block":return r.INLINE_BLOCK;case"inline-list-item":return r.INLINE_LIST_ITEM;case"inline-table":return r.INLINE_TABLE;case"inline-flex":return r.INLINE_FLEX;case"inline-grid":return r.INLINE_GRID}return r.NONE}(e)};e.parseDisplay=function(A){return A.split(" ").reduce(n,0)}},function(A,e,t){"use strict";Object.defineProperty(e,"__esModule",{value:!0});var r=e.FLOAT={NONE:0,LEFT:1,RIGHT:2,INLINE_START:3,INLINE_END:4};e.parseCSSFloat=function(A){switch(A){case"left":return r.LEFT;case"right":return r.RIGHT;case"inline-start":return r.INLINE_START;case"inline-end":return r.INLINE_END}return r.NONE}},function(A,e,t){"use strict";Object.defineProperty(e,"__esModule",{value:!0});e.parseFont=function(A){return{fontFamily:A.fontFamily,fontSize:A.fontSize,fontStyle:A.fontStyle,fontVariant:A.fontVariant,fontWeight:function(A){switch(A){case"normal":return 400;case"bold":return 700}var e=parseInt(A,10);return isNaN(e)?400:e}(A.fontWeight)}}},function(A,e,t){"use strict";Object.defineProperty(e,"__esModule",{value:!0});e.parseLetterSpacing=function(A){if("normal"===A)return 0;var e=parseFloat(A);return isNaN(e)?0:e}},function(A,e,t){"use strict";Object.defineProperty(e,"__esModule",{value:!0});var r=e.LINE_BREAK={NORMAL:"normal",STRICT:"strict"};e.parseLineBreak=function(A){switch(A){case"strict":return r.STRICT;case"normal":default:return r.NORMAL}}},function(A,e,t){"use strict";Object.defineProperty(e,"__esModule",{value:!0}),e.parseMargin=void 0;var r,n=t(1),B=(r=n)&&r.__esModule?r:{default:r};var a=["top","right","bottom","left"];e.parseMargin=function(A){return a.map(function(e){return new B.default(A.getPropertyValue("margin-"+e))})}},function(A,e,t){"use strict";Object.defineProperty(e,"__esModule",{value:!0});var r=e.OVERFLOW={VISIBLE:0,HIDDEN:1,SCROLL:2,AUTO:3};e.parseOverflow=function(A){switch(A){case"hidden":return r.HIDDEN;case"scroll":return r.SCROLL;case"auto":return r.AUTO;case"visible":default:return r.VISIBLE}}},function(A,e,t){"use strict";Object.defineProperty(e,"__esModule",{value:!0}),e.parseTextShadow=void 0;var r,n=t(0),B=(r=n)&&r.__esModule?r:{default:r};var a=/^([+-]|\d|\.)$/i;e.parseTextShadow=function(A){if("none"===A||"string"!=typeof A)return null;for(var e="",t=!1,r=[],n=[],s=0,o=null,i=function(){e.length&&(t?r.push(parseFloat(e)):o=new B.default(e)),t=!1,e=""},c=function(){r.length&&null!==o&&n.push({color:o,offsetX:r[0]||0,offsetY:r[1]||0,blur:r[2]||0}),r.splice(0,r.length),o=null},l=0;l<A.length;l++){var u=A[l];switch(u){case"(":e+=u,s++;break;case")":e+=u,s--;break;case",":0===s?(i(),c()):e+=u;break;case" ":0===s?i():e+=u;break;default:0===e.length&&a.test(u)&&(t=!0),e+=u}}return i(),c(),0===n.length?null:n}},function(A,e,t){"use strict";Object.defineProperty(e,"__esModule",{value:!0}),e.parseTransform=void 0;var r,n=t(1),B=(r=n)&&r.__esModule?r:{default:r};var a=function(A){return parseFloat(A.trim())},s=/(matrix|matrix3d)\((.+)\)/,o=(e.parseTransform=function(A){var e=i(A.transform||A.webkitTransform||A.mozTransform||A.msTransform||A.oTransform);return null===e?null:{transform:e,transformOrigin:o(A.transformOrigin||A.webkitTransformOrigin||A.mozTransformOrigin||A.msTransformOrigin||A.oTransformOrigin)}},function(A){if("string"!=typeof A){var e=new B.default("0");return[e,e]}var t=A.split(" ").map(B.default.create);return[t[0],t[1]]}),i=function(A){if("none"===A||"string"!=typeof A)return null;var e=A.match(s);if(e){if("matrix"===e[1]){var t=e[2].split(",").map(a);return[t[0],t[1],t[2],t[3],t[4],t[5]]}var r=e[2].split(",").map(a);return[r[0],r[1],r[4],r[5],r[12],r[13]]}return null}},function(A,e,t){"use strict";Object.defineProperty(e,"__esModule",{value:!0});var r=e.VISIBILITY={VISIBLE:0,HIDDEN:1,COLLAPSE:2};e.parseVisibility=function(A){switch(A){case"hidden":return r.HIDDEN;case"collapse":return r.COLLAPSE;case"visible":default:return r.VISIBLE}}},function(A,e,t){"use strict";Object.defineProperty(e,"__esModule",{value:!0});var r=e.WORD_BREAK={NORMAL:"normal",BREAK_ALL:"break-all",KEEP_ALL:"keep-all"};e.parseWordBreak=function(A){switch(A){case"break-all":return r.BREAK_ALL;case"keep-all":return r.KEEP_ALL;case"normal":default:return r.NORMAL}}},function(A,e,t){"use strict";Object.defineProperty(e,"__esModule",{value:!0});e.parseZIndex=function(A){var e="auto"===A;return{auto:e,order:e?0:parseInt(A,10)}}},function(A,e,t){"use strict";Object.defineProperty(e,"__esModule",{value:!0});var r=t(13);Object.defineProperty(e,"toCodePoints",{enumerable:!0,get:function(){return r.toCodePoints}}),Object.defineProperty(e,"fromCodePoint",{enumerable:!0,get:function(){return r.fromCodePoint}});var n=t(47);Object.defineProperty(e,"LineBreaker",{enumerable:!0,get:function(){return n.LineBreaker}})},function(A,e,t){"use strict";Object.defineProperty(e,"__esModule",{value:!0}),e.LineBreaker=e.inlineBreakOpportunities=e.lineBreakAtIndex=e.codePointsToCharacterClasses=e.UnicodeTrie=e.BREAK_ALLOWED=e.BREAK_NOT_ALLOWED=e.BREAK_MANDATORY=e.classes=e.LETTER_NUMBER_MODIFIER=void 0;var r,n=function(){function A(A,e){for(var t=0;t<e.length;t++){var r=e[t];r.enumerable=r.enumerable||!1,r.configurable=!0,"value"in r&&(r.writable=!0),Object.defineProperty(A,r.key,r)}}return function(e,t,r){return t&&A(e.prototype,t),r&&A(e,r),e}}(),B=function(){return function(A,e){if(Array.isArray(A))return A;if(Symbol.iterator in Object(A))return function(A,e){var t=[],r=!0,n=!1,B=void 0;try{for(var a,s=A[Symbol.iterator]();!(r=(a=s.next()).done)&&(t.push(a.value),!e||t.length!==e);r=!0);}catch(A){n=!0,B=A}finally{try{!r&&s.return&&s.return()}finally{if(n)throw B}}return t}(A,e);throw new TypeError("Invalid attempt to destructure non-iterable instance")}}(),a=t(48),s=t(49),o=(r=s)&&r.__esModule?r:{default:r},i=t(13);var c=e.LETTER_NUMBER_MODIFIER=50,l=10,u=13,Q=15,w=17,U=18,g=19,C=20,d=21,F=22,E=24,f=25,h=26,H=27,p=28,N=30,I=32,K=33,T=34,m=35,v=37,y=38,b=39,S=40,L=42,_=(e.classes={BK:1,CR:2,LF:3,CM:4,NL:5,SG:6,WJ:7,ZW:8,GL:9,SP:l,ZWJ:11,B2:12,BA:u,BB:14,HY:Q,CB:16,CL:w,CP:U,EX:g,IN:C,NS:d,OP:F,QU:23,IS:E,NU:f,PO:h,PR:H,SY:p,AI:29,AL:N,CJ:31,EB:I,EM:K,H2:T,H3:m,HL:36,ID:v,JL:y,JV:b,JT:S,RI:41,SA:L,XX:43},e.BREAK_MANDATORY="!"),D=e.BREAK_NOT_ALLOWED="×",M=e.BREAK_ALLOWED="÷",O=e.UnicodeTrie=(0,a.createTrieFromBase64)(o.default),R=[N,36],P=[1,2,3,5],X=[l,8],z=[H,h],x=P.concat(X),V=[y,b,S,T,m],k=[Q,u],J=e.codePointsToCharacterClasses=function(A){var e=arguments.length>1&&void 0!==arguments[1]?arguments[1]:"strict",t=[],r=[],n=[];return A.forEach(function(A,B){var a=O.get(A);if(a>c?(n.push(!0),a-=c):n.push(!1),-1!==["normal","auto","loose"].indexOf(e)&&-1!==[8208,8211,12316,12448].indexOf(A))return r.push(B),t.push(16);if(4===a||11===a){if(0===B)return r.push(B),t.push(N);var s=t[B-1];return-1===x.indexOf(s)?(r.push(r[B-1]),t.push(s)):(r.push(B),t.push(N))}return r.push(B),31===a?t.push("strict"===e?d:v):a===L?t.push(N):29===a?t.push(N):43===a?A>=131072&&A<=196605||A>=196608&&A<=262141?t.push(v):t.push(N):void t.push(a)}),[r,t,n]},G=function(A,e,t,r){var n=r[t];if(Array.isArray(A)?-1!==A.indexOf(n):A===n)for(var B=t;B<=r.length;){var a=r[++B];if(a===e)return!0;if(a!==l)break}if(n===l)for(var s=t;s>0;){var o=r[--s];if(Array.isArray(A)?-1!==A.indexOf(o):A===o)for(var i=t;i<=r.length;){var c=r[++i];if(c===e)return!0;if(c!==l)break}if(o!==l)break}return!1},Y=function(A,e){for(var t=A;t>=0;){var r=e[t];if(r!==l)return r;t--}return 0},W=function(A,e,t,r,n){if(0===t[r])return D;var B=r-1;if(Array.isArray(n)&&!0===n[B])return D;var a=B-1,s=B+1,o=e[B],i=a>=0?e[a]:0,c=e[s];if(2===o&&3===c)return D;if(-1!==P.indexOf(o))return _;if(-1!==P.indexOf(c))return D;if(-1!==X.indexOf(c))return D;if(8===Y(B,e))return M;if(11===O.get(A[B])&&(c===v||c===I||c===K))return D;if(7===o||7===c)return D;if(9===o)return D;if(-1===[l,u,Q].indexOf(o)&&9===c)return D;if(-1!==[w,U,g,E,p].indexOf(c))return D;if(Y(B,e)===F)return D;if(G(23,F,B,e))return D;if(G([w,U],d,B,e))return D;if(G(12,12,B,e))return D;if(o===l)return M;if(23===o||23===c)return D;if(16===c||16===o)return M;if(-1!==[u,Q,d].indexOf(c)||14===o)return D;if(36===i&&-1!==k.indexOf(o))return D;if(o===p&&36===c)return D;if(c===C&&-1!==R.concat(C,g,f,v,I,K).indexOf(o))return D;if(-1!==R.indexOf(c)&&o===f||-1!==R.indexOf(o)&&c===f)return D;if(o===H&&-1!==[v,I,K].indexOf(c)||-1!==[v,I,K].indexOf(o)&&c===h)return D;if(-1!==R.indexOf(o)&&-1!==z.indexOf(c)||-1!==z.indexOf(o)&&-1!==R.indexOf(c))return D;if(-1!==[H,h].indexOf(o)&&(c===f||-1!==[F,Q].indexOf(c)&&e[s+1]===f)||-1!==[F,Q].indexOf(o)&&c===f||o===f&&-1!==[f,p,E].indexOf(c))return D;if(-1!==[f,p,E,w,U].indexOf(c))for(var N=B;N>=0;){var L=e[N];if(L===f)return D;if(-1===[p,E].indexOf(L))break;N--}if(-1!==[H,h].indexOf(c))for(var x=-1!==[w,U].indexOf(o)?a:B;x>=0;){var J=e[x];if(J===f)return D;if(-1===[p,E].indexOf(J))break;x--}if(y===o&&-1!==[y,b,T,m].indexOf(c)||-1!==[b,T].indexOf(o)&&-1!==[b,S].indexOf(c)||-1!==[S,m].indexOf(o)&&c===S)return D;if(-1!==V.indexOf(o)&&-1!==[C,h].indexOf(c)||-1!==V.indexOf(c)&&o===H)return D;if(-1!==R.indexOf(o)&&-1!==R.indexOf(c))return D;if(o===E&&-1!==R.indexOf(c))return D;if(-1!==R.concat(f).indexOf(o)&&c===F||-1!==R.concat(f).indexOf(c)&&o===U)return D;if(41===o&&41===c){for(var W=t[B],j=1;W>0&&41===e[--W];)j++;if(j%2!=0)return D}return o===I&&c===K?D:M},j=(e.lineBreakAtIndex=function(A,e){if(0===e)return D;if(e>=A.length)return _;var t=J(A),r=B(t,2),n=r[0],a=r[1];return W(A,a,n,e)},function(A,e){e||(e={lineBreak:"normal",wordBreak:"normal"});var t=J(A,e.lineBreak),r=B(t,3),n=r[0],a=r[1],s=r[2];return"break-all"!==e.wordBreak&&"break-word"!==e.wordBreak||(a=a.map(function(A){return-1!==[f,N,L].indexOf(A)?v:A})),[n,a,"keep-all"===e.wordBreak?s.map(function(e,t){return e&&A[t]>=19968&&A[t]<=40959}):null]}),q=(e.inlineBreakOpportunities=function(A,e){var t=(0,i.toCodePoints)(A),r=D,n=j(t,e),a=B(n,3),s=a[0],o=a[1],c=a[2];return t.forEach(function(A,e){r+=(0,i.fromCodePoint)(A)+(e>=t.length-1?_:W(t,o,s,e+1,c))}),r},function(){function A(e,t,r,n){!function(A,e){if(!(A instanceof e))throw new TypeError("Cannot call a class as a function")}(this,A),this._codePoints=e,this.required=t===_,this.start=r,this.end=n}return n(A,[{key:"slice",value:function(){return i.fromCodePoint.apply(void 0,function(A){if(Array.isArray(A)){for(var e=0,t=Array(A.length);e<A.length;e++)t[e]=A[e];return t}return Array.from(A)}(this._codePoints.slice(this.start,this.end)))}}]),A}());e.LineBreaker=function(A,e){var t=(0,i.toCodePoints)(A),r=j(t,e),n=B(r,3),a=n[0],s=n[1],o=n[2],c=t.length,l=0,u=0;return{next:function(){if(u>=c)return{done:!0};for(var A=D;u<c&&(A=W(t,s,a,++u,o))===D;);if(A!==D||u===c){var e=new q(t,A,l,u);return l=u,{value:e,done:!1}}return{done:!0}}}}},function(A,e,t){"use strict";Object.defineProperty(e,"__esModule",{value:!0}),e.Trie=e.createTrieFromBase64=e.UTRIE2_INDEX_2_MASK=e.UTRIE2_INDEX_2_BLOCK_LENGTH=e.UTRIE2_OMITTED_BMP_INDEX_1_LENGTH=e.UTRIE2_INDEX_1_OFFSET=e.UTRIE2_UTF8_2B_INDEX_2_LENGTH=e.UTRIE2_UTF8_2B_INDEX_2_OFFSET=e.UTRIE2_INDEX_2_BMP_LENGTH=e.UTRIE2_LSCP_INDEX_2_LENGTH=e.UTRIE2_DATA_MASK=e.UTRIE2_DATA_BLOCK_LENGTH=e.UTRIE2_LSCP_INDEX_2_OFFSET=e.UTRIE2_SHIFT_1_2=e.UTRIE2_INDEX_SHIFT=e.UTRIE2_SHIFT_1=e.UTRIE2_SHIFT_2=void 0;var r=function(){function A(A,e){for(var t=0;t<e.length;t++){var r=e[t];r.enumerable=r.enumerable||!1,r.configurable=!0,"value"in r&&(r.writable=!0),Object.defineProperty(A,r.key,r)}}return function(e,t,r){return t&&A(e.prototype,t),r&&A(e,r),e}}(),n=t(13);var B=e.UTRIE2_SHIFT_2=5,a=e.UTRIE2_SHIFT_1=11,s=e.UTRIE2_INDEX_SHIFT=2,o=e.UTRIE2_SHIFT_1_2=a-B,i=e.UTRIE2_LSCP_INDEX_2_OFFSET=65536>>B,c=e.UTRIE2_DATA_BLOCK_LENGTH=1<<B,l=e.UTRIE2_DATA_MASK=c-1,u=e.UTRIE2_LSCP_INDEX_2_LENGTH=1024>>B,Q=e.UTRIE2_INDEX_2_BMP_LENGTH=i+u,w=e.UTRIE2_UTF8_2B_INDEX_2_OFFSET=Q,U=e.UTRIE2_UTF8_2B_INDEX_2_LENGTH=32,g=e.UTRIE2_INDEX_1_OFFSET=w+U,C=e.UTRIE2_OMITTED_BMP_INDEX_1_LENGTH=65536>>a,d=e.UTRIE2_INDEX_2_BLOCK_LENGTH=1<<o,F=e.UTRIE2_INDEX_2_MASK=d-1,E=(e.createTrieFromBase64=function(A){var e=(0,n.decode)(A),t=Array.isArray(e)?(0,n.polyUint32Array)(e):new Uint32Array(e),r=Array.isArray(e)?(0,n.polyUint16Array)(e):new Uint16Array(e),B=r.slice(12,t[4]/2),a=2===t[5]?r.slice((24+t[4])/2):t.slice(Math.ceil((24+t[4])/4));return new E(t[0],t[1],t[2],t[3],B,a)},e.Trie=function(){function A(e,t,r,n,B,a){!function(A,e){if(!(A instanceof e))throw new TypeError("Cannot call a class as a function")}(this,A),this.initialValue=e,this.errorValue=t,this.highStart=r,this.highValueIndex=n,this.index=B,this.data=a}return r(A,[{key:"get",value:function(A){var e=void 0;if(A>=0){if(A<55296||A>56319&&A<=65535)return e=((e=this.index[A>>B])<<s)+(A&l),this.data[e];if(A<=65535)return e=((e=this.index[i+(A-55296>>B)])<<s)+(A&l),this.data[e];if(A<this.highStart)return e=g-C+(A>>a),e=this.index[e],e+=A>>B&F,e=((e=this.index[e])<<s)+(A&l),this.data[e];if(A<=1114111)return this.data[this.highValueIndex]}return this.errorValue}}]),A}())},function(A,e,t){"use strict";A.exports="KwAAAAAAAAAACA4AIDoAAPAfAAACAAAAAAAIABAAGABAAEgAUABYAF4AZgBeAGYAYABoAHAAeABeAGYAfACEAIAAiACQAJgAoACoAK0AtQC9AMUAXgBmAF4AZgBeAGYAzQDVAF4AZgDRANkA3gDmAOwA9AD8AAQBDAEUARoBIgGAAIgAJwEvATcBPwFFAU0BTAFUAVwBZAFsAXMBewGDATAAiwGTAZsBogGkAawBtAG8AcIBygHSAdoB4AHoAfAB+AH+AQYCDgIWAv4BHgImAi4CNgI+AkUCTQJTAlsCYwJrAnECeQKBAk0CiQKRApkCoQKoArACuALAAsQCzAIwANQC3ALkAjAA7AL0AvwCAQMJAxADGAMwACADJgMuAzYDPgOAAEYDSgNSA1IDUgNaA1oDYANiA2IDgACAAGoDgAByA3YDfgOAAIQDgACKA5IDmgOAAIAAogOqA4AAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAK8DtwOAAIAAvwPHA88D1wPfAyAD5wPsA/QD/AOAAIAABAQMBBIEgAAWBB4EJgQuBDMEIAM7BEEEXgBJBCADUQRZBGEEaQQwADAAcQQ+AXkEgQSJBJEEgACYBIAAoASoBK8EtwQwAL8ExQSAAIAAgACAAIAAgACgAM0EXgBeAF4AXgBeAF4AXgBeANUEXgDZBOEEXgDpBPEE+QQBBQkFEQUZBSEFKQUxBTUFPQVFBUwFVAVcBV4AYwVeAGsFcwV7BYMFiwWSBV4AmgWgBacFXgBeAF4AXgBeAKsFXgCyBbEFugW7BcIFwgXIBcIFwgXQBdQF3AXkBesF8wX7BQMGCwYTBhsGIwYrBjMGOwZeAD8GRwZNBl4AVAZbBl4AXgBeAF4AXgBeAF4AXgBeAF4AXgBeAGMGXgBqBnEGXgBeAF4AXgBeAF4AXgBeAF4AXgB5BoAG4wSGBo4GkwaAAIADHgR5AF4AXgBeAJsGgABGA4AAowarBrMGswagALsGwwbLBjAA0wbaBtoG3QbaBtoG2gbaBtoG2gblBusG8wb7BgMHCwcTBxsHCwcjBysHMAc1BzUHOgdCB9oGSgdSB1oHYAfaBloHaAfaBlIH2gbaBtoG2gbaBtoG2gbaBjUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHbQdeAF4ANQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQd1B30HNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1B4MH2gaKB68EgACAAIAAgACAAIAAgACAAI8HlwdeAJ8HpweAAIAArwe3B14AXgC/B8UHygcwANAH2AfgB4AA6AfwBz4B+AcACFwBCAgPCBcIogEYAR8IJwiAAC8INwg/CCADRwhPCFcIXwhnCEoDGgSAAIAAgABvCHcIeAh5CHoIewh8CH0Idwh4CHkIegh7CHwIfQh3CHgIeQh6CHsIfAh9CHcIeAh5CHoIewh8CH0Idwh4CHkIegh7CHwIfQh3CHgIeQh6CHsIfAh9CHcIeAh5CHoIewh8CH0Idwh4CHkIegh7CHwIfQh3CHgIeQh6CHsIfAh9CHcIeAh5CHoIewh8CH0Idwh4CHkIegh7CHwIfQh3CHgIeQh6CHsIfAh9CHcIeAh5CHoIewh8CH0Idwh4CHkIegh7CHwIfQh3CHgIeQh6CHsIfAh9CHcIeAh5CHoIewh8CH0Idwh4CHkIegh7CHwIfQh3CHgIeQh6CHsIfAh9CHcIeAh5CHoIewh8CH0Idwh4CHkIegh7CHwIfQh3CHgIeQh6CHsIfAh9CHcIeAh5CHoIewh8CH0Idwh4CHkIegh7CHwIfQh3CHgIeQh6CHsIfAh9CHcIeAh5CHoIewh8CH0Idwh4CHkIegh7CHwIfQh3CHgIeQh6CHsIfAh9CHcIeAh5CHoIewh8CH0Idwh4CHkIegh7CHwIfQh3CHgIeQh6CHsIfAh9CHcIeAh5CHoIewh8CH0Idwh4CHkIegh7CHwIfQh3CHgIeQh6CHsIfAh9CHcIeAh5CHoIewh8CH0Idwh4CHkIegh7CHwIfQh3CHgIeQh6CHsIfAh9CHcIeAh5CHoIewh8CH0Idwh4CHkIegh7CHwIfQh3CHgIeQh6CHsIfAh9CHcIeAh5CHoIewh8CH0Idwh4CHkIegh7CHwIfQh3CHgIeQh6CHsIfAh9CHcIeAh5CHoIewh8CH0Idwh4CHkIegh7CHwIfQh3CHgIeQh6CHsIfAh9CHcIeAh5CHoIewh8CH0Idwh4CHkIegh7CHwIfQh3CHgIeQh6CHsIfAh9CHcIeAh5CHoIewh8CH0Idwh4CHkIegh7CHwIhAiLCI4IMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwAJYIlgiWCJYIlgiWCJYIlgiWCJYIlgiWCJYIlgiWCJYIlgiWCJYIlgiWCJYIlgiWCJYIlgiWCJYIlgiWCJYIlggwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAANQc1BzUHNQc1BzUHNQc1BzUHNQc1B54INQc1B6II2gaqCLIIugiAAIAAvgjGCIAAgACAAIAAgACAAIAAgACAAIAAywiHAYAA0wiAANkI3QjlCO0I9Aj8CIAAgACAAAIJCgkSCRoJIgknCTYHLwk3CZYIlgiWCJYIlgiWCJYIlgiWCJYIlgiWCJYIlgiWCJYIlgiWCJYIlgiWCJYIlgiWCJYIlgiWCJYIlgiWCJYIlgiAAIAAAAFAAXgBeAGAAcABeAHwAQACQAKAArQC9AJ4AXgBeAE0A3gBRAN4A7AD8AMwBGgEAAKcBNwEFAUwBXAF4QkhCmEKnArcCgAHHAsABz4LAAcABwAHAAd+C6ABoAG+C/4LAAcABwAHAAc+DF4MAAcAB54M3gweDV4Nng3eDaABoAGgAaABoAGgAaABoAGgAaABoAGgAaABoAGgAaABoAGgAaABoAEeDqABVg6WDqABoQ6gAaABoAHXDvcONw/3DvcO9w73DvcO9w73DvcO9w73DvcO9w73DvcO9w73DvcO9w73DvcO9w73DvcO9w73DvcO9w73DvcO9w73DncPAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcAB7cPPwlGCU4JMACAAIAAgABWCV4JYQmAAGkJcAl4CXwJgAkwADAAMAAwAIgJgACLCZMJgACZCZ8JowmrCYAAswkwAF4AXgB8AIAAuwkABMMJyQmAAM4JgADVCTAAMAAwADAAgACAAIAAgACAAIAAgACAAIAAqwYWBNkIMAAwADAAMADdCeAJ6AnuCR4E9gkwAP4JBQoNCjAAMACAABUK0wiAAB0KJAosCjQKgAAwADwKQwqAAEsKvQmdCVMKWwowADAAgACAALcEMACAAGMKgABrCjAAMAAwADAAMAAwADAAMAAwADAAMAAeBDAAMAAwADAAMAAwADAAMAAwADAAMAAwAIkEPQFzCnoKiQSCCooKkAqJBJgKoAqkCokEGAGsCrQKvArBCjAAMADJCtEKFQHZCuEK/gHpCvEKMAAwADAAMACAAIwE+QowAIAAPwEBCzAAMAAwADAAMACAAAkLEQswAIAAPwEZCyELgAAOCCkLMAAxCzkLMAAwADAAMAAwADAAXgBeAEELMAAwADAAMAAwADAAMAAwAEkLTQtVC4AAXAtkC4AAiQkwADAAMAAwADAAMAAwADAAbAtxC3kLgAuFC4sLMAAwAJMLlwufCzAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAApwswADAAMACAAIAAgACvC4AAgACAAIAAgACAALcLMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAvwuAAMcLgACAAIAAgACAAIAAyguAAIAAgACAAIAA0QswADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAANkLgACAAIAA4AswADAAMAAwADAAMAAwADAAMAAwADAAMAAwAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACJCR4E6AswADAAhwHwC4AA+AsADAgMEAwwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMACAAIAAGAwdDCUMMAAwAC0MNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQw1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHPQwwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADUHNQc1BzUHNQc1BzUHNQc2BzAAMAA5DDUHNQc1BzUHNQc1BzUHNQc1BzUHNQdFDDAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAgACAAIAATQxSDFoMMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwAF4AXgBeAF4AXgBeAF4AYgxeAGoMXgBxDHkMfwxeAIUMXgBeAI0MMAAwADAAMAAwAF4AXgCVDJ0MMAAwADAAMABeAF4ApQxeAKsMswy7DF4Awgy9DMoMXgBeAF4AXgBeAF4AXgBeAF4AXgDRDNkMeQBqCeAM3Ax8AOYM7Az0DPgMXgBeAF4AXgBeAF4AXgBeAF4AXgBeAF4AXgBeAF4AXgCgAAANoAAHDQ4NFg0wADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAeDSYNMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwAIAAgACAAIAAgACAAC4NMABeAF4ANg0wADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwAD4NRg1ODVYNXg1mDTAAbQ0wADAAMAAwADAAMAAwADAA2gbaBtoG2gbaBtoG2gbaBnUNeg3CBYANwgWFDdoGjA3aBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gaUDZwNpA2oDdoG2gawDbcNvw3HDdoG2gbPDdYN3A3fDeYN2gbsDfMN2gbaBvoN/g3aBgYODg7aBl4AXgBeABYOXgBeACUG2gYeDl4AJA5eACwO2w3aBtoGMQ45DtoG2gbaBtoGQQ7aBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gZJDjUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1B1EO2gY1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQdZDjUHNQc1BzUHNQc1B2EONQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHaA41BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1B3AO2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gY1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1B2EO2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gZJDtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBkkOeA6gAKAAoAAwADAAMAAwAKAAoACgAKAAoACgAKAAgA4wADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAD//wQABAAEAAQABAAEAAQABAAEAA0AAwABAAEAAgAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAKABMAFwAeABsAGgAeABcAFgASAB4AGwAYAA8AGAAcAEsASwBLAEsASwBLAEsASwBLAEsAGAAYAB4AHgAeABMAHgBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAFgAbABIAHgAeAB4AUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQABYADQARAB4ABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsABAAEAAQABAAEAAUABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAkAFgAaABsAGwAbAB4AHQAdAB4ATwAXAB4ADQAeAB4AGgAbAE8ATwAOAFAAHQAdAB0ATwBPABcATwBPAE8AFgBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAHQAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB0AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgBQAB4AHgAeAB4AUABQAFAAUAAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAAeAB4AHgAeAFAATwBAAE8ATwBPAEAATwBQAFAATwBQAB4AHgAeAB4AHgAeAB0AHQAdAB0AHgAdAB4ADgBQAFAAUABQAFAAHgAeAB4AHgAeAB4AHgBQAB4AUAAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4ABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAJAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAkACQAJAAkACQAJAAkABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAeAB4AHgAeAFAAHgAeAB4AKwArAFAAUABQAFAAGABQACsAKwArACsAHgAeAFAAHgBQAFAAUAArAFAAKwAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AKwAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4ABAAEAAQABAAEAAQABAAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArACsAUAAeAB4AHgAeAB4AHgArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwAYAA0AKwArAB4AHgAbACsABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQADQAEAB4ABAAEAB4ABAAEABMABAArACsAKwArACsAKwArACsAVgBWAFYAVgBWAFYAVgBWAFYAVgBWAFYAVgBWAFYAVgBWAFYAVgBWAFYAVgBWAFYAVgBWAFYAKwArACsAKwArAFYAVgBWAB4AHgArACsAKwArACsAKwArACsAKwArACsAHgAeAB4AHgAeAB4AHgAeAB4AGgAaABoAGAAYAB4AHgAEAAQABAAEAAQABAAEAAQABAAEAAQAEwAEACsAEwATAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABABLAEsASwBLAEsASwBLAEsASwBLABoAGQAZAB4AUABQAAQAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQABMAUAAEAAQABAAEAAQABAAEAB4AHgAEAAQABAAEAAQABABQAFAABAAEAB4ABAAEAAQABABQAFAASwBLAEsASwBLAEsASwBLAEsASwBQAFAAUAAeAB4AUAAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AKwAeAFAABABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAABAAEAAQABAAEAAQABAAEAAQABAAEAFAAKwArACsAKwArACsAKwArACsAKwArACsAKwArAEsASwBLAEsASwBLAEsASwBLAEsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAABAAEAAQABAAEAAQABAAEAAQAUABQAB4AHgAYABMAUAArACsAKwArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAAEAAQABAAEAFAABAAEAAQABAAEAFAABAAEAAQAUAAEAAQABAAEAAQAKwArAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAAEAAQABAArACsAHgArAFAAUABQAFAAUABQAFAAUABQAFAAUAArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArAFAAUABQAFAAUABQAFAAUAArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAeAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAAEAAQABABQAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAFAABAAEAAQABAAEAAQABABQAFAAUABQAFAAUABQAFAAUABQAAQABAANAA0ASwBLAEsASwBLAEsASwBLAEsASwAeAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAABAAEAAQAKwBQAFAAUABQAFAAUABQAFAAKwArAFAAUAArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQACsAUABQAFAAUABQAFAAUAArAFAAKwArACsAUABQAFAAUAArACsABABQAAQABAAEAAQABAAEAAQAKwArAAQABAArACsABAAEAAQAUAArACsAKwArACsAKwArACsABAArACsAKwArAFAAUAArAFAAUABQAAQABAArACsASwBLAEsASwBLAEsASwBLAEsASwBQAFAAGgAaAFAAUABQAFAAUABMAB4AGwBQAB4AKwArACsABAAEAAQAKwBQAFAAUABQAFAAUAArACsAKwArAFAAUAArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQACsAUABQAFAAUABQAFAAUAArAFAAUAArAFAAUAArAFAAUAArACsABAArAAQABAAEAAQABAArACsAKwArAAQABAArACsABAAEAAQAKwArACsABAArACsAKwArACsAKwArAFAAUABQAFAAKwBQACsAKwArACsAKwArACsASwBLAEsASwBLAEsASwBLAEsASwAEAAQAUABQAFAABAArACsAKwArACsAKwArACsAKwArACsABAAEAAQAKwBQAFAAUABQAFAAUABQAFAAUAArAFAAUABQACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQACsAUABQAFAAUABQAFAAUAArAFAAUAArAFAAUABQAFAAUAArACsABABQAAQABAAEAAQABAAEAAQABAArAAQABAAEACsABAAEAAQAKwArAFAAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAUABQAAQABAArACsASwBLAEsASwBLAEsASwBLAEsASwAeABsAKwArACsAKwArACsAKwBQAAQABAAEAAQABAAEACsABAAEAAQAKwBQAFAAUABQAFAAUABQAFAAKwArAFAAUAArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAAEAAQABAAEAAQAKwArAAQABAArACsABAAEAAQAKwArACsAKwArACsAKwArAAQABAArACsAKwArAFAAUAArAFAAUABQAAQABAArACsASwBLAEsASwBLAEsASwBLAEsASwAeAFAAUABQAFAAUABQAFAAKwArACsAKwArACsAKwArACsAKwAEAFAAKwBQAFAAUABQAFAAUAArACsAKwBQAFAAUAArAFAAUABQAFAAKwArACsAUABQACsAUAArAFAAUAArACsAKwBQAFAAKwArACsAUABQAFAAKwArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwArACsAKwAEAAQABAAEAAQAKwArACsABAAEAAQAKwAEAAQABAAEACsAKwBQACsAKwArACsAKwArAAQAKwArACsAKwArACsAKwArACsAKwBLAEsASwBLAEsASwBLAEsASwBLAFAAUABQAB4AHgAeAB4AHgAeABsAHgArACsAKwArACsABAAEAAQABAArAFAAUABQAFAAUABQAFAAUAArAFAAUABQACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQACsAKwArAFAABAAEAAQABAAEAAQABAArAAQABAAEACsABAAEAAQABAArACsAKwArACsAKwArAAQABAArAFAAUABQACsAKwArACsAKwBQAFAABAAEACsAKwBLAEsASwBLAEsASwBLAEsASwBLACsAKwArACsAKwArACsAKwBQAFAAUABQAFAAUABQAB4AUAAEAAQABAArAFAAUABQAFAAUABQAFAAUAArAFAAUABQACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwBQAFAAUABQAFAAUABQAFAAUABQACsAUABQAFAAUABQACsAKwAEAFAABAAEAAQABAAEAAQABAArAAQABAAEACsABAAEAAQABAArACsAKwArACsAKwArAAQABAArACsAKwArACsAKwArAFAAKwBQAFAABAAEACsAKwBLAEsASwBLAEsASwBLAEsASwBLACsAUABQACsAKwArACsAKwArACsAKwArACsAKwArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAABAAEAFAABAAEAAQABAAEAAQABAArAAQABAAEACsABAAEAAQABABQAB4AKwArACsAKwBQAFAAUAAEAFAAUABQAFAAUABQAFAAUABQAFAABAAEACsAKwBLAEsASwBLAEsASwBLAEsASwBLAFAAUABQAFAAUABQAFAAUABQABoAUABQAFAAUABQAFAAKwArAAQABAArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQACsAKwArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArAFAAUABQAFAAUABQAFAAUABQACsAUAArACsAUABQAFAAUABQAFAAUAArACsAKwAEACsAKwArACsABAAEAAQABAAEAAQAKwAEACsABAAEAAQABAAEAAQABAAEACsAKwArACsAKwArAEsASwBLAEsASwBLAEsASwBLAEsAKwArAAQABAAeACsAKwArACsAKwArACsAKwArACsAKwArAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXAAqAFwAXAAqACoAKgAqACoAKgAqACsAKwArACsAGwBcAFwAXABcAFwAXABcACoAKgAqACoAKgAqACoAKgAeAEsASwBLAEsASwBLAEsASwBLAEsADQANACsAKwArACsAKwBcAFwAKwBcACsAKwBcAFwAKwBcACsAKwBcACsAKwArACsAKwArAFwAXABcAFwAKwBcAFwAXABcAFwAXABcACsAXABcAFwAKwBcACsAXAArACsAXABcACsAXABcAFwAXAAqAFwAXAAqACoAKgAqACoAKgArACoAKgBcACsAKwBcAFwAXABcAFwAKwBcACsAKgAqACoAKgAqACoAKwArAEsASwBLAEsASwBLAEsASwBLAEsAKwArAFwAXABcAFwAUAAOAA4ADgAOAB4ADgAOAAkADgAOAA0ACQATABMAEwATABMACQAeABMAHgAeAB4ABAAEAB4AHgAeAB4AHgAeAEsASwBLAEsASwBLAEsASwBLAEsAUABQAFAAUABQAFAAUABQAFAAUAANAAQAHgAEAB4ABAAWABEAFgARAAQABABQAFAAUABQAFAAUABQAFAAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArACsAKwArAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAANAAQABAAEAAQABAANAAQABABQAFAAUABQAFAABAAEAAQABAAEAAQABAAEAAQABAAEACsABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEACsADQANAB4AHgAeAB4AHgAeAAQAHgAeAB4AHgAeAB4AKwAeAB4ADgAOAA0ADgAeAB4AHgAeAB4ACQAJACsAKwArACsAKwBcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAKgAqACoAKgAqACoAKgAqACoAKgAqACoAKgAqACoAKgAqACoAKgAqAFwASwBLAEsASwBLAEsASwBLAEsASwANAA0AHgAeAB4AHgBcAFwAXABcAFwAXAAqACoAKgAqAFwAXABcAFwAKgAqACoAXAAqACoAKgBcAFwAKgAqACoAKgAqACoAKgBcAFwAXAAqACoAKgAqAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAKgAqACoAKgAqACoAKgAqACoAKgAqACoAXAAqAEsASwBLAEsASwBLAEsASwBLAEsAKgAqACoAKgAqACoAUABQAFAAUABQAFAAKwBQACsAKwArACsAKwBQACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAAeAFAAUABQAFAAWABYAFgAWABYAFgAWABYAFgAWABYAFgAWABYAFgAWABYAFgAWABYAFgAWABYAFgAWABYAFgAWABYAFgAWABYAFkAWQBZAFkAWQBZAFkAWQBZAFkAWQBZAFkAWQBZAFkAWQBZAFkAWQBZAFkAWQBZAFkAWQBZAFkAWQBZAFkAWQBaAFoAWgBaAFoAWgBaAFoAWgBaAFoAWgBaAFoAWgBaAFoAWgBaAFoAWgBaAFoAWgBaAFoAWgBaAFoAWgBaAFoAUABQAFAAUABQAFAAUABQAFAAKwBQAFAAUABQACsAKwBQAFAAUABQAFAAUABQACsAUAArAFAAUABQAFAAKwArAFAAUABQAFAAUABQAFAAUABQACsAUABQAFAAUAArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQACsAUABQAFAAUAArACsAUABQAFAAUABQAFAAUAArAFAAKwBQAFAAUABQACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArAFAAUABQAFAAKwArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQACsAKwAEAAQABAAeAA0AHgAeAB4AHgAeAB4AHgBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAAeAB4AHgAeAB4AHgAeAB4AHgAeACsAKwArACsAKwArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwArAFAAUABQAFAAUABQACsAKwANAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAAeAB4AUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAA0AUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQABYAEQArACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAADQANAA0AUABQAFAAUABQAFAAUABQAFAAUABQACsAKwArACsAKwArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArAFAAUABQAFAABAAEAAQAKwArACsAKwArACsAKwArACsAKwArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAAQABAAEAA0ADQArACsAKwArACsAKwArACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAAEAAQAKwArACsAKwArACsAKwArACsAKwArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArAFAAUABQACsABAAEACsAKwArACsAKwArACsAKwArACsAKwArAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXAAqACoAKgAqACoAKgAqACoAKgAqACoAKgAqACoAKgAqACoAKgAqACoADQANABUAXAANAB4ADQAbAFwAKgArACsASwBLAEsASwBLAEsASwBLAEsASwArACsAKwArACsAKwBQAFAAUABQAFAAUABQAFAAUABQACsAKwArACsAKwArAB4AHgATABMADQANAA4AHgATABMAHgAEAAQABAAJACsASwBLAEsASwBLAEsASwBLAEsASwArACsAKwArACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArACsAKwArACsAKwArACsAUABQAFAAUABQAAQABABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAABABQACsAKwArACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQACsAKwArACsAKwArACsAKwArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArAAQABAAEAAQABAAEAAQABAAEAAQABAAEACsAKwArACsABAAEAAQABAAEAAQABAAEAAQABAAEAAQAKwArACsAKwAeACsAKwArABMAEwBLAEsASwBLAEsASwBLAEsASwBLAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcACsAKwBcAFwAXABcAFwAKwArACsAKwArACsAKwArACsAKwArAFwAXABcAFwAXABcAFwAXABcAFwAXABcACsAKwArACsAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAKwArACsAKwArACsASwBLAEsASwBLAEsASwBLAEsASwBcACsAKwArACoAKgBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAABAAEAAQABAAEACsAKwAeAB4AXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAKgAqACoAKgAqACoAKgAqACoAKgArACoAKgAqACoAKgAqACoAKgAqACoAKgAqACoAKgAqACoAKgAqACoAKgAqACoAKgAqACoAKgAqACoAKgArACsABABLAEsASwBLAEsASwBLAEsASwBLACsAKwArACsAKwArAEsASwBLAEsASwBLAEsASwBLAEsAKwArACsAKwArACsAKgAqACoAKgAqACoAKgBcACoAKgAqACoAKgAqACsAKwAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAArAAQABAAEAAQABABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAAEAAQABAAEAAQAUABQAFAAUABQAFAAUAArACsAKwArAEsASwBLAEsASwBLAEsASwBLAEsADQANAB4ADQANAA0ADQAeAB4AHgAeAB4AHgAeAB4AHgAeAAQABAAEAAQABAAEAAQABAAEAB4AHgAeAB4AHgAeAB4AHgAeACsAKwArAAQABAAEAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQAUABQAEsASwBLAEsASwBLAEsASwBLAEsAUABQAFAAUABQAFAAUABQAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAArACsAKwArACsAKwArACsAHgAeAB4AHgBQAFAAUABQAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAArACsAKwANAA0ADQANAA0ASwBLAEsASwBLAEsASwBLAEsASwArACsAKwBQAFAAUABLAEsASwBLAEsASwBLAEsASwBLAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAANAA0AUABQAFAAUABQAFAAUABQAFAAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArAB4AHgAeAB4AHgAeAB4AHgArACsAKwArACsAKwArACsABAAEAAQAHgAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAFAAUABQAFAABABQAFAAUABQAAQABAAEAFAAUAAEAAQABAArACsAKwArACsAKwAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQAKwAEAAQABAAEAAQAHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgArACsAUABQAFAAUABQAFAAKwArAFAAUABQAFAAUABQAFAAUAArAFAAKwBQACsAUAArAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AKwArAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeACsAHgAeAB4AHgAeAB4AHgAeAFAAHgAeAB4AUABQAFAAKwAeAB4AHgAeAB4AHgAeAB4AHgAeAFAAUABQAFAAKwArAB4AHgAeAB4AHgAeACsAHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgArACsAUABQAFAAKwAeAB4AHgAeAB4AHgAeAA4AHgArAA0ADQANAA0ADQANAA0ACQANAA0ADQAIAAQACwAEAAQADQAJAA0ADQAMAB0AHQAeABcAFwAWABcAFwAXABYAFwAdAB0AHgAeABQAFAAUAA0AAQABAAQABAAEAAQABAAJABoAGgAaABoAGgAaABoAGgAeABcAFwAdABUAFQAeAB4AHgAeAB4AHgAYABYAEQAVABUAFQAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgANAB4ADQANAA0ADQAeAA0ADQANAAcAHgAeAB4AHgArAAQABAAEAAQABAAEAAQABAAEAAQAUABQACsAKwBPAFAAUABQAFAAUAAeAB4AHgAWABEATwBQAE8ATwBPAE8AUABQAFAAUABQAB4AHgAeABYAEQArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwArACsAGwAbABsAGwAbABsAGwAaABsAGwAbABsAGwAbABsAGwAbABsAGwAbABsAGwAaABsAGwAbABsAGgAbABsAGgAbABsAGwAbABsAGwAbABsAGwAbABsAGwAbABsAGwAbABsABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArAB4AHgBQABoAHgAdAB4AUAAeABoAHgAeAB4AHgAeAB4AHgAeAB4ATwAeAFAAGwAeAB4AUABQAFAAUABQAB4AHgAeAB0AHQAeAFAAHgBQAB4AUAAeAFAATwBQAFAAHgAeAB4AHgAeAB4AHgBQAFAAUABQAFAAHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgBQAB4AUABQAFAAUABPAE8AUABQAFAAUABQAE8AUABQAE8AUABPAE8ATwBPAE8ATwBPAE8ATwBPAE8ATwBQAFAAUABQAE8ATwBPAE8ATwBPAE8ATwBPAE8AUABQAFAAUABQAFAAUABQAFAAHgAeAFAAUABQAFAATwAeAB4AKwArACsAKwAdAB0AHQAdAB0AHQAdAB0AHQAdAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAdAB4AHQAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHQAeAB0AHQAeAB4AHgAdAB0AHgAeAB0AHgAeAB4AHQAeAB0AGwAbAB4AHQAeAB4AHgAeAB0AHgAeAB0AHQAdAB0AHgAeAB0AHgAdAB4AHQAdAB0AHQAdAB0AHgAdAB4AHgAeAB4AHgAdAB0AHQAdAB4AHgAeAB4AHQAdAB4AHgAeAB4AHgAeAB4AHgAeAB4AHQAeAB4AHgAdAB4AHgAeAB4AHgAdAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHQAdAB4AHgAdAB0AHQAdAB4AHgAdAB0AHgAeAB0AHQAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAdAB0AHgAeAB0AHQAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB0AHgAeAB4AHQAeAB4AHgAeAB4AHgAeAB0AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAdAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeABQAHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAWABEAFgARAB4AHgAeAB4AHgAeAB0AHgAeAB4AHgAeAB4AHgAlACUAHgAeAB4AHgAeAB4AHgAeAB4AFgARAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeACUAJQAlACUAHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwBPAE8ATwBPAE8ATwBPAE8ATwBPAE8ATwBPAE8ATwBPAE8ATwBPAE8ATwBPAE8ATwBPAE8ATwBPAE8ATwBPAE8AHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQBPAE8ATwBPAE8ATwBPAE8ATwBPAE8ATwBPAE8ATwBPAE8ATwBPAE8ATwBQAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB4AHgAeAB4AHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHgAeAB0AHQAdAB0AHgAeAB4AHgAeAB4AHgAeAB4AHgAdAB0AHgAdAB0AHQAdAB0AHQAdAB4AHgAeAB4AHgAeAB4AHgAdAB0AHgAeAB0AHQAeAB4AHgAeAB0AHQAeAB4AHgAeAB0AHQAdAB4AHgAdAB4AHgAdAB0AHQAdAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHQAdAB0AHQAeAB4AHgAeAB4AHgAeAB4AHgAdAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AJQAlACUAJQAeAB0AHQAeAB4AHQAeAB4AHgAeAB0AHQAeAB4AHgAeACUAJQAdAB0AJQAeACUAJQAlACAAJQAlAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AJQAlACUAHgAeAB4AHgAdAB4AHQAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHQAdAB4AHQAdAB0AHgAdACUAHQAdAB4AHQAdAB4AHQAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAlAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB0AHQAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AJQAlACUAJQAlACUAJQAlACUAJQAlACUAHQAdAB0AHQAlAB4AJQAlACUAHQAlACUAHQAdAB0AJQAlAB0AHQAlAB0AHQAlACUAJQAeAB0AHgAeAB4AHgAdAB0AJQAdAB0AHQAdAB0AHQAlACUAJQAlACUAHQAlACUAIAAlAB0AHQAlACUAJQAlACUAJQAlACUAHgAeAB4AJQAlACAAIAAgACAAHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAdAB4AHgAeABcAFwAXABcAFwAXAB4AEwATACUAHgAeAB4AFgARABYAEQAWABEAFgARABYAEQAWABEAFgARAE8ATwBPAE8ATwBPAE8ATwBPAE8ATwBPAE8ATwBPAE8ATwBPAE8ATwBPAE8AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAWABEAHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AFgARABYAEQAWABEAFgARABYAEQAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeABYAEQAWABEAFgARABYAEQAWABEAFgARABYAEQAWABEAFgARABYAEQAWABEAHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AFgARABYAEQAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeABYAEQAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHQAdAB0AHQAdAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AKwArAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AKwArACsAHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AKwAeAB4AHgAeAB4AHgAeAB4AHgArACsAKwArACsAKwArACsAKwArACsAKwArAB4AHgAeAB4AKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAEAAQABAAeAB4AKwArACsAKwArABMADQANAA0AUAATAA0AUABQAFAAUABQAFAAUABQACsAKwArACsAKwArACsAUAANACsAKwArACsAKwArACsAKwArACsAKwArACsAKwAEAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArACsAKwArACsAKwArACsAKwBQAFAAUABQAFAAUABQACsAUABQAFAAUABQAFAAUAArAFAAUABQAFAAUABQAFAAKwBQAFAAUABQAFAAUABQACsAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXAA0ADQANAA0ADQANAA0ADQAeAA0AFgANAB4AHgAXABcAHgAeABcAFwAWABEAFgARABYAEQAWABEADQANAA0ADQATAFAADQANAB4ADQANAB4AHgAeAB4AHgAMAAwADQANAA0AHgANAA0AFgANAA0ADQANAA0ADQANACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACsAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAKwArACsAKwArACsAKwArACsAKwArACsAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwAlACUAJQAlACUAJQAlACUAJQAlACUAJQArACsAKwArAA0AEQARACUAJQBHAFcAVwAWABEAFgARABYAEQAWABEAFgARACUAJQAWABEAFgARABYAEQAWABEAFQAWABEAEQAlAFcAVwBXAFcAVwBXAFcAVwBXAAQABAAEAAQABAAEACUAVwBXAFcAVwA2ACUAJQBXAFcAVwBHAEcAJQAlACUAKwBRAFcAUQBXAFEAVwBRAFcAUQBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFEAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBRAFcAUQBXAFEAVwBXAFcAVwBXAFcAUQBXAFcAVwBXAFcAVwBRAFEAKwArAAQABAAVABUARwBHAFcAFQBRAFcAUQBXAFEAVwBRAFcAUQBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFEAVwBRAFcAUQBXAFcAVwBXAFcAVwBRAFcAVwBXAFcAVwBXAFEAUQBXAFcAVwBXABUAUQBHAEcAVwArACsAKwArACsAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAKwArAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwArACUAJQBXAFcAVwBXACUAJQAlACUAJQAlACUAJQAlACUAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAKwArACsAKwArACUAJQAlACUAKwArACsAKwArACsAKwArACsAKwArACsAUQBRAFEAUQBRAFEAUQBRAFEAUQBRAFEAUQBRAFEAUQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACsAVwBXAFcAVwBXAFcAVwBXAFcAVwAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlAE8ATwBPAE8ATwBPAE8ATwAlAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXACUAJQAlACUAJQAlACUAJQAlACUAVwBXAFcAVwBXAFcAVwBXAFcAVwBXACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAEcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAKwArACsAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQArACsAKwArACsAKwArACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAADQATAA0AUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABLAEsASwBLAEsASwBLAEsASwBLAFAAUAArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAFAABAAEAAQABAAeAAQABAAEAAQABAAEAAQABAAEAAQAHgBQAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AUABQAAQABABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAAQABAAeAA0ADQANAA0ADQArACsAKwArACsAKwArACsAHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAFAAUABQAFAAUABQAFAAUABQAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AUAAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgBQAB4AHgAeAB4AHgAeAFAAHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgArAB4AHgAeAB4AHgAeAB4AHgArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAUABQAFAAUABQAFAAUABQAFAAUABQAAQAUABQAFAABABQAFAAUABQAAQAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAAQABAAEAAQABAAeAB4AHgAeACsAKwArACsAUABQAFAAUABQAFAAHgAeABoAHgArACsAKwArACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAADgAOABMAEwArACsAKwArACsAKwArACsABAAEAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAAQABAAEAAQABAAEACsAKwArACsAKwArACsAKwANAA0ASwBLAEsASwBLAEsASwBLAEsASwArACsAKwArACsAKwAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABABQAFAAUABQAFAAUAAeAB4AHgBQAA4AUAArACsAUABQAFAAUABQAFAABAAEAAQABAAEAAQABAAEAA0ADQBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQAKwArACsAKwArACsAKwArACsAKwArAB4AWABYAFgAWABYAFgAWABYAFgAWABYAFgAWABYAFgAWABYAFgAWABYAFgAWABYAFgAWABYAFgAWABYACsAKwArAAQAHgAeAB4AHgAeAB4ADQANAA0AHgAeAB4AHgArAFAASwBLAEsASwBLAEsASwBLAEsASwArACsAKwArAB4AHgBcAFwAXABcAFwAKgBcAFwAXABcAFwAXABcAFwAXABcAEsASwBLAEsASwBLAEsASwBLAEsAXABcAFwAXABcACsAUABQAFAAUABQAFAAUABQAFAABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEACsAKwArACsAKwArACsAKwArAFAAUABQAAQAUABQAFAAUABQAFAAUABQAAQABAArACsASwBLAEsASwBLAEsASwBLAEsASwArACsAHgANAA0ADQBcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAKgAqACoAXAAqACoAKgBcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXAAqAFwAKgAqACoAXABcACoAKgBcAFwAXABcAFwAKgAqAFwAKgBcACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArAFwAXABcACoAKgBQAFAAUABQAFAAUABQAFAAUABQAFAABAAEAAQABAAEAA0ADQBQAFAAUAAEAAQAKwArACsAKwArACsAKwArACsAKwBQAFAAUABQAFAAUAArACsAUABQAFAAUABQAFAAKwArAFAAUABQAFAAUABQACsAKwArACsAKwArACsAKwArAFAAUABQAFAAUABQAFAAKwBQAFAAUABQAFAAUABQACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAAEAAQABAAEAAQABAAEAAQADQAEAAQAKwArAEsASwBLAEsASwBLAEsASwBLAEsAKwArACsAKwArACsAVABVAFUAVQBVAFUAVQBVAFUAVQBVAFUAVQBVAFUAVQBVAFUAVQBVAFUAVQBVAFUAVQBVAFUAVQBUAFUAVQBVAFUAVQBVAFUAVQBVAFUAVQBVAFUAVQBVAFUAVQBVAFUAVQBVAFUAVQBVAFUAVQBVACsAKwArACsAKwArACsAKwArACsAKwArAFkAWQBZAFkAWQBZAFkAWQBZAFkAWQBZAFkAWQBZAFkAWQBZAFkAKwArACsAKwBaAFoAWgBaAFoAWgBaAFoAWgBaAFoAWgBaAFoAWgBaAFoAWgBaAFoAWgBaAFoAWgBaAFoAWgBaAFoAKwArACsAKwAGAAYABgAGAAYABgAGAAYABgAGAAYABgAGAAYABgAGAAYABgAGAAYABgAGAAYABgAGAAYABgAGAAYABgAGAAYAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXACUAJQBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAJQAlACUAJQAlACUAUABQAFAAUABQAFAAUAArACsAKwArACsAKwArACsAKwArACsAKwBQAFAAUABQAFAAKwArACsAKwArAFYABABWAFYAVgBWAFYAVgBWAFYAVgBWAB4AVgBWAFYAVgBWAFYAVgBWAFYAVgBWAFYAVgArAFYAVgBWAFYAVgArAFYAKwBWAFYAKwBWAFYAKwBWAFYAVgBWAFYAVgBWAFYAVgBWAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAEQAWAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUAAaAB4AKwArAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQAGAARABEAGAAYABMAEwAWABEAFAArACsAKwArACsAKwAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEACUAJQAlACUAJQAWABEAFgARABYAEQAWABEAFgARABYAEQAlACUAFgARACUAJQAlACUAJQAlACUAEQAlABEAKwAVABUAEwATACUAFgARABYAEQAWABEAJQAlACUAJQAlACUAJQAlACsAJQAbABoAJQArACsAKwArAFAAUABQAFAAUAArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwArAAcAKwATACUAJQAbABoAJQAlABYAEQAlACUAEQAlABEAJQBXAFcAVwBXAFcAVwBXAFcAVwBXABUAFQAlACUAJQATACUAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXABYAJQARACUAJQAlAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwAWACUAEQAlABYAEQARABYAEQARABUAVwBRAFEAUQBRAFEAUQBRAFEAUQBRAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAEcARwArACsAVwBXAFcAVwBXAFcAKwArAFcAVwBXAFcAVwBXACsAKwBXAFcAVwBXAFcAVwArACsAVwBXAFcAKwArACsAGgAbACUAJQAlABsAGwArAB4AHgAeAB4AHgAeAB4AKwArACsAKwArACsAKwArACsAKwAEAAQABAAQAB0AKwArAFAAUABQAFAAUABQAFAAUABQAFAAUABQACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwBQAFAAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArACsAKwArACsADQANAA0AKwArACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQACsAKwArAB4AHgAeAB4AHgAeAB4AHgAeAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgBQAFAAHgAeAB4AKwAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgArACsAKwArAB4AKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4ABAArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArAAQAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwArACsAKwArACsAKwArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArACsAKwArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAAEAAQABAAEAAQAKwArACsAKwArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQACsADQBQAFAAUABQACsAKwArACsAUABQAFAAUABQAFAAUABQAA0AUABQAFAAUABQACsAKwArACsAKwArACsAKwArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArACsAKwArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwArACsAKwArACsAKwArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwArACsAKwArACsAKwArACsAKwArAB4AKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwBQAFAAUABQAFAAUAArACsAUAArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQACsAUABQACsAKwArAFAAKwArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArAA0AUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAB4AHgBQAFAAUABQAFAAUABQACsAKwArACsAKwArACsAUABQAFAAUABQAFAAUABQAFAAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQACsAUABQACsAKwArACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwArACsADQBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwArACsAKwArAB4AUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwArACsAKwBQAFAAUABQAFAABAAEAAQAKwAEAAQAKwArACsAKwArAAQABAAEAAQAUABQAFAAUAArAFAAUABQACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQACsAKwArACsABAAEAAQAKwArACsAKwAEAFAAUABQAFAAUABQAFAAUAArACsAKwArACsAKwArACsADQANAA0ADQANAA0ADQANAB4AKwArACsAKwArACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAB4AUABQAFAAUABQAFAAUABQAB4AUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAABAAEACsAKwArACsAUABQAFAAUABQAA0ADQANAA0ADQANABQAKwArACsAKwArACsAKwArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArACsAKwANAA0ADQANAA0ADQANAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQACsAKwArACsAKwArACsAHgAeAB4AHgArACsAKwArACsAKwArACsAKwArACsAKwBQAFAAUABQAFAAUABQACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArACsAKwArACsAKwArACsAKwArACsAKwArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwArACsAKwArACsAKwBQAFAAUABQAFAAUAAEAAQABAAEAAQABAAEAA0ADQAeAB4AHgAeAB4AKwArACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAEsASwBLAEsASwBLAEsASwBLAEsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsABABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAAQABAAEAAQABAAEAAQABAAEAAQABAAeAB4AHgANAA0ADQANACsAKwArACsAKwArACsAKwArACsAKwArACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwArACsAKwArACsAKwBLAEsASwBLAEsASwBLAEsASwBLACsAKwArACsAKwArAFAAUABQAFAAUABQAFAABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEACsASwBLAEsASwBLAEsASwBLAEsASwANAA0ADQANACsAKwArACsAKwArACsAKwArACsAKwArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAABAAeAA4AUAArACsAKwArACsAKwArACsAKwAEAFAAUABQAFAADQANAB4ADQAeAAQABAAEAB4AKwArAEsASwBLAEsASwBLAEsASwBLAEsAUAAOAFAADQANAA0AKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwArACsAKwArACsAKwArACsAKwArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAAEAAQABAAEAAQABAAEAAQABAAEAAQABAANAA0AHgANAA0AHgAEACsAUABQAFAAUABQAFAAUAArAFAAKwBQAFAAUABQACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwBQAFAAUABQAFAAUABQAFAAUABQAA0AKwArACsAKwArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAAEAAQABAAEAAQABAAEAAQABAAEAAQAKwArACsAKwArAEsASwBLAEsASwBLAEsASwBLAEsAKwArACsAKwArACsABAAEAAQABAArAFAAUABQAFAAUABQAFAAUAArACsAUABQACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAAQABAAEAAQABAArACsABAAEACsAKwAEAAQABAArACsAUAArACsAKwArACsAKwAEACsAKwArACsAKwBQAFAAUABQAFAABAAEACsAKwAEAAQABAAEAAQABAAEACsAKwArAAQABAAEAAQABAArACsAKwArACsAKwArACsAKwArACsABAAEAAQABAAEAAQABABQAFAAUABQAA0ADQANAA0AHgBLAEsASwBLAEsASwBLAEsASwBLACsADQArAB4AKwArAAQABAAEAAQAUABQAB4AUAArACsAKwArACsAKwArACsASwBLAEsASwBLAEsASwBLAEsASwArACsAKwArACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAAEAAQABAAEAAQABAAEACsAKwAEAAQABAAEAAQABAAEAAQABAAOAA0ADQATABMAHgAeAB4ADQANAA0ADQANAA0ADQANAA0ADQANAA0ADQANAA0AUABQAFAAUAAEAAQAKwArAAQADQANAB4AUAArACsAKwArACsAKwArACsAKwArACsASwBLAEsASwBLAEsASwBLAEsASwArACsAKwArACsAKwAOAA4ADgAOAA4ADgAOAA4ADgAOAA4ADgAOACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsASwBLAEsASwBLAEsASwBLAEsASwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXAArACsAKwAqACoAKgAqACoAKgAqACoAKgAqACoAKgAqACoAKgArACsAKwArAEsASwBLAEsASwBLAEsASwBLAEsAXABcAA0ADQANACoASwBLAEsASwBLAEsASwBLAEsASwBQAFAAUABQAFAAUABQAFAAUAArACsAKwArACsAKwArACsAKwArACsAKwBQAFAABAAEAAQABAAEAAQABAAEAAQABABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAAEAAQABAAEAAQABAAEAFAABAAEAAQABAAOAB4ADQANAA0ADQAOAB4ABAArACsAKwArACsAKwArACsAUAAEAAQABAAEAAQABAAEAAQABAAEAAQAUABQAFAAUAArACsAUABQAFAAUAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAA0ADQANACsADgAOAA4ADQANACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwBQAFAAUABQAFAAUABQAFAAUAArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAABAAEAAQABAAEAAQABAAEACsABAAEAAQABAAEAAQABAAEAFAADQANAA0ADQANACsAKwArACsAKwArACsAKwArACsASwBLAEsASwBLAEsASwBLAEsASwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArACsAKwAOABMAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwArAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAArAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAArACsAKwArACsAKwArACsAKwBQAFAAUABQAFAAUABQACsAUABQACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAAEAAQABAAEAAQABAArACsAKwAEACsABAAEACsABAAEAAQABAAEAAQABABQAAQAKwArACsAKwArACsAKwArAEsASwBLAEsASwBLAEsASwBLAEsAKwArACsAKwArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQACsAKwArACsAKwArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQACsADQANAA0ADQANACsAKwArACsAKwArACsAKwArACsAKwBQAFAAUABQACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAASABIAEgAQwBDAEMAUABQAFAAUABDAFAAUABQAEgAQwBIAEMAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAASABDAEMAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABIAEMAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArAEsASwBLAEsASwBLAEsASwBLAEsAKwArACsAKwANAA0AKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwArAAQABAAEAAQABAANACsAKwArACsAKwArACsAKwArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAAEAAQABAAEAAQABAAEAA0ADQANAB4AHgAeAB4AHgAeAFAAUABQAFAADQAeACsAKwArACsAKwArACsAKwArACsASwBLAEsASwBLAEsASwBLAEsASwArAFAAUABQAFAAUABQAFAAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArACsAKwArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArAFAAUABQAFAAUAArACsAKwArACsAKwArACsAKwArACsAUAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsABAAEAAQABABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAEcARwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwArACsAKwArACsAKwArACsAKwArACsAKwArAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAKwArACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAKwArACsAKwArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwArACsAKwArACsAKwBQAFAAUABQAFAAUABQAFAAUABQACsAKwAeAAQABAANAAQABAAEAAQAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeACsAKwArACsAKwArACsAKwArACsAHgAeAB4AHgAeAB4AHgArACsAHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4ABAAEAAQABAAEAB4AHgAeAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQAHgAeAAQABAAEAAQABAAEAAQAHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAEAAQABAAEAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArAB4AHgAEAAQABAAeACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AKwArACsAKwArACsAKwArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwArACsAKwArACsAKwArACsAKwArACsAKwArAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeACsAHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgArAFAAUAArACsAUAArACsAUABQACsAKwBQAFAAUABQACsAHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AKwBQACsAUABQAFAAUABQAFAAUAArAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgArAFAAUABQAFAAKwArAFAAUABQAFAAUABQAFAAUAArAFAAUABQAFAAUABQAFAAKwAeAB4AUABQAFAAUABQACsAUAArACsAKwBQAFAAUABQAFAAUABQACsAHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAAeAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAFAAUABQAFAAUABQAFAAUABQAFAAUAAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAHgAeAB4AHgAeAB4AHgAeAB4AKwArAEsASwBLAEsASwBLAEsASwBLAEsASwBLAEsASwBLAEsASwBLAEsASwBLAEsASwBLAEsASwBLAEsASwBLAEsASwBLAEsABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAB4AHgAeAB4ABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAB4AHgAeAB4AHgAeAB4AHgAEAB4AHgAeAB4AHgAeAB4AHgAeAB4ABAAeAB4ADQANAA0ADQAeACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArAAQABAAEAAQABAArAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsABAAEAAQABAAEAAQABAArAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAArACsABAAEAAQABAAEAAQABAArAAQABAArAAQABAAEAAQABAArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwBQAFAAUABQAFAAKwArAFAAUABQAFAAUABQAFAAUABQAAQABAAEAAQABAAEAAQAKwArACsAKwArACsAKwArACsAHgAeAB4AHgAEAAQABAAEAAQABAAEACsAKwArACsAKwBLAEsASwBLAEsASwBLAEsASwBLACsAKwArACsAFgAWAFAAUABQAFAAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArAFAAUAArAFAAKwArAFAAKwBQAFAAUABQAFAAUABQAFAAUABQACsAUABQAFAAUAArAFAAKwBQACsAKwArACsAKwArAFAAKwArACsAKwBQACsAUAArAFAAKwBQAFAAUAArAFAAUAArAFAAKwArAFAAKwBQACsAUAArAFAAKwBQACsAUABQACsAUAArACsAUABQAFAAUAArAFAAUABQAFAAUABQAFAAKwBQAFAAUABQACsAUABQAFAAUAArAFAAKwBQAFAAUABQAFAAUABQAFAAUABQACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQACsAKwArACsAKwBQAFAAUAArAFAAUABQAFAAUAArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArAB4AHgArACsAKwArACsAKwArACsAKwArACsAKwArACsATwBPAE8ATwBPAE8ATwBPAE8ATwBPAE8ATwAlACUAJQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAeACUAHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHgAeACUAJQAlACUAHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAdACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACkAKQApACkAKQApACkAKQApACkAKQApACkAKQApACkAKQApACkAKQApACkAKQApACkAKQAlACUAJQAlACUAIAAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlAB4AHgAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAHgAeACUAJQAlACUAJQAeACUAJQAlACUAJQAgACAAIAAlACUAIAAlACUAIAAgACAAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAIQAhACEAIQAhACUAJQAgACAAJQAlACAAIAAgACAAIAAgACAAIAAgACAAIAAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAIAAgACAAIAAlACUAJQAlACAAJQAgACAAIAAgACAAIAAgACAAIAAlACUAJQAgACUAJQAlACUAIAAgACAAJQAgACAAIAAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAeACUAHgAlAB4AJQAlACUAJQAlACAAJQAlACUAJQAeACUAHgAeACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAHgAeAB4AHgAeAB4AHgAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlAB4AHgAeAB4AHgAeAB4AHgAeAB4AJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAIAAgACUAJQAlACUAIAAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAIAAlACUAJQAlACAAIAAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAeAB4AHgAeAB4AHgAeAB4AJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlAB4AHgAeAB4AHgAeACUAJQAlACUAJQAlACUAIAAgACAAJQAlACUAIAAgACAAIAAgAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AFwAXABcAFQAVABUAHgAeAB4AHgAlACUAJQAgACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAIAAgACAAJQAlACUAJQAlACUAJQAlACUAIAAlACUAJQAlACUAJQAlACUAJQAlACUAIAAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAlACUAJQAlACUAJQAlACUAJQAlACUAJQAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAlACUAJQAlAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AJQAlACUAJQAlACUAJQAlAB4AHgAeAB4AHgAeAB4AHgAeAB4AJQAlACUAJQAlACUAHgAeAB4AHgAeAB4AHgAeACUAJQAlACUAJQAlACUAJQAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeACUAJQAlACUAJQAlACUAJQAlACUAJQAlACAAIAAgACAAIAAlACAAIAAlACUAJQAlACUAJQAgACUAJQAlACUAJQAlACUAJQAlACAAIAAgACAAIAAgACAAIAAgACAAJQAlACUAIAAgACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACsAKwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAJQAlACUAJQAlACUAJQAlACUAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAJQAlACUAJQAlACUAJQAlACUAJQAlAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQArAAQAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsA"},function(A,e,t){"use strict";Object.defineProperty(e,"__esModule",{value:!0});var r=t(6);e.default=function A(e,t,n){!function(A,e){if(!(A instanceof e))throw new TypeError("Cannot call a class as a function")}(this,A),this.type=r.PATH.CIRCLE,this.x=e,this.y=t,this.radius=n}},function(A,e,t){"use strict";Object.defineProperty(e,"__esModule",{value:!0});var r,n=function(){return function(A,e){if(Array.isArray(A))return A;if(Symbol.iterator in Object(A))return function(A,e){var t=[],r=!0,n=!1,B=void 0;try{for(var a,s=A[Symbol.iterator]();!(r=(a=s.next()).done)&&(t.push(a.value),!e||t.length!==e);r=!0);}catch(A){n=!0,B=A}finally{try{!r&&s.return&&s.return()}finally{if(n)throw B}}return t}(A,e);throw new TypeError("Invalid attempt to destructure non-iterable instance")}}(),B=function(){function A(A,e){for(var t=0;t<e.length;t++){var r=e[t];r.enumerable=r.enumerable||!1,r.configurable=!0,"value"in r&&(r.writable=!0),Object.defineProperty(A,r.key,r)}}return function(e,t,r){return t&&A(e.prototype,t),r&&A(e,r),e}}(),a=t(2),s=(t(25),t(52)),o=t(9),i=(r=o)&&r.__esModule?r:{default:r},c=t(5),l=t(12);var u=function(){function A(e,t){!function(A,e){if(!(A instanceof e))throw new TypeError("Cannot call a class as a function")}(this,A),this.target=e,this.options=t,e.render(t)}return B(A,[{key:"renderNode",value:function(A){A.isVisible()&&(this.renderNodeBackgroundAndBorders(A),this.renderNodeContent(A))}},{key:"renderNodeContent",value:function(A){var e=this,t=function(){if(A.childNodes.length&&A.childNodes.forEach(function(t){if(t instanceof i.default){var r=t.parent.style;e.target.renderTextNode(t.bounds,r.color,r.font,r.textDecoration,r.textShadow)}else e.target.drawShape(t,A.style.color)}),A.image){var t=e.options.imageStore.get(A.image);if(t){var r=(0,a.calculateContentBox)(A.bounds,A.style.padding,A.style.border),n="number"==typeof t.width&&t.width>0?t.width:r.width,B="number"==typeof t.height&&t.height>0?t.height:r.height;n>0&&B>0&&e.target.clip([(0,a.calculatePaddingBoxPath)(A.curvedBounds)],function(){e.target.drawImage(t,new a.Bounds(0,0,n,B),r)})}}},r=A.getClipPaths();r.length?this.target.clip(r,t):t()}},{key:"renderNodeBackgroundAndBorders",value:function(A){var e=this,t=!A.style.background.backgroundColor.isTransparent()||A.style.background.backgroundImage.length,r=A.style.border.some(function(A){return A.borderStyle!==l.BORDER_STYLE.NONE&&!A.borderColor.isTransparent()}),n=function(){var r=(0,c.calculateBackgroungPaintingArea)(A.curvedBounds,A.style.background.backgroundClip);t&&e.target.clip([r],function(){A.style.background.backgroundColor.isTransparent()||e.target.fill(A.style.background.backgroundColor),e.renderBackgroundImage(A)}),A.style.border.forEach(function(t,r){t.borderStyle===l.BORDER_STYLE.NONE||t.borderColor.isTransparent()||e.renderBorder(t,r,A.curvedBounds)})};if(t||r){var B=A.parent?A.parent.getClipPaths():[];B.length?this.target.clip(B,n):n()}}},{key:"renderBackgroundImage",value:function(A){var e=this;A.style.background.backgroundImage.slice(0).reverse().forEach(function(t){"url"===t.source.method&&t.source.args.length?e.renderBackgroundRepeat(A,t):/gradient/i.test(t.source.method)&&e.renderBackgroundGradient(A,t)})}},{key:"renderBackgroundRepeat",value:function(A,e){var t=this.options.imageStore.get(e.source.args[0]);if(t){var r=(0,c.calculateBackgroungPositioningArea)(A.style.background.backgroundOrigin,A.bounds,A.style.padding,A.style.border),n=(0,c.calculateBackgroundSize)(e,t,r),B=(0,c.calculateBackgroundPosition)(e.position,n,r),a=(0,c.calculateBackgroundRepeatPath)(e,B,n,r,A.bounds),s=Math.round(r.left+B.x),o=Math.round(r.top+B.y);this.target.renderRepeat(a,t,n,s,o)}}},{key:"renderBackgroundGradient",value:function(A,e){var t=(0,c.calculateBackgroungPositioningArea)(A.style.background.backgroundOrigin,A.bounds,A.style.padding,A.style.border),r=(0,c.calculateGradientBackgroundSize)(e,t),n=(0,c.calculateBackgroundPosition)(e.position,r,t),B=new a.Bounds(Math.round(t.left+n.x),Math.round(t.top+n.y),r.width,r.height),o=(0,s.parseGradient)(A,e.source,B);if(o)switch(o.type){case s.GRADIENT_TYPE.LINEAR_GRADIENT:this.target.renderLinearGradient(B,o);break;case s.GRADIENT_TYPE.RADIAL_GRADIENT:this.target.renderRadialGradient(B,o)}}},{key:"renderBorder",value:function(A,e,t){this.target.drawShape((0,a.parsePathForBorder)(t,e),A.borderColor)}},{key:"renderStack",value:function(A){var e=this;if(A.container.isVisible()){var t=A.getOpacity();t!==this._opacity&&(this.target.setOpacity(A.getOpacity()),this._opacity=t);var r=A.container.style.transform;null!==r?this.target.transform(A.container.bounds.left+r.transformOrigin[0].value,A.container.bounds.top+r.transformOrigin[1].value,r.transform,function(){return e.renderStackContent(A)}):this.renderStackContent(A)}}},{key:"renderStackContent",value:function(A){var e=w(A),t=n(e,5),r=t[0],B=t[1],a=t[2],s=t[3],o=t[4],i=Q(A),c=n(i,2),l=c[0],u=c[1];this.renderNodeBackgroundAndBorders(A.container),r.sort(U).forEach(this.renderStack,this),this.renderNodeContent(A.container),u.forEach(this.renderNode,this),s.forEach(this.renderStack,this),o.forEach(this.renderStack,this),l.forEach(this.renderNode,this),B.forEach(this.renderStack,this),a.sort(U).forEach(this.renderStack,this)}},{key:"render",value:function(A){this.options.backgroundColor&&this.target.rectangle(this.options.x,this.options.y,this.options.width,this.options.height,this.options.backgroundColor),this.renderStack(A);var e=this.target.getTarget();return e}}]),A}();e.default=u;var Q=function(A){for(var e=[],t=[],r=A.children.length,n=0;n<r;n++){var B=A.children[n];B.isInlineLevel()?e.push(B):t.push(B)}return[e,t]},w=function(A){for(var e=[],t=[],r=[],n=[],B=[],a=A.contexts.length,s=0;s<a;s++){var o=A.contexts[s];o.container.isPositioned()||o.container.style.opacity<1||o.container.isTransformed()?o.container.style.zIndex.order<0?e.push(o):o.container.style.zIndex.order>0?r.push(o):t.push(o):o.container.isFloating()?n.push(o):B.push(o)}return[e,t,r,n,B]},U=function(A,e){return A.container.style.zIndex.order>e.container.style.zIndex.order?1:A.container.style.zIndex.order<e.container.style.zIndex.order?-1:A.container.index>e.container.index?1:-1}},function(A,e,t){"use strict";Object.defineProperty(e,"__esModule",{value:!0}),e.transformWebkitRadialGradientArgs=e.parseGradient=e.RadialGradient=e.LinearGradient=e.RADIAL_GRADIENT_SHAPE=e.GRADIENT_TYPE=void 0;var r=function(){return function(A,e){if(Array.isArray(A))return A;if(Symbol.iterator in Object(A))return function(A,e){var t=[],r=!0,n=!1,B=void 0;try{for(var a,s=A[Symbol.iterator]();!(r=(a=s.next()).done)&&(t.push(a.value),!e||t.length!==e);r=!0);}catch(A){n=!0,B=A}finally{try{!r&&s.return&&s.return()}finally{if(n)throw B}}return t}(A,e);throw new TypeError("Invalid attempt to destructure non-iterable instance")}}(),n=(i(t(3)),t(53)),B=i(t(0)),a=t(1),s=i(a),o=t(4);function i(A){return A&&A.__esModule?A:{default:A}}function c(A,e){if(!(A instanceof e))throw new TypeError("Cannot call a class as a function")}var l=/^(to )?(left|top|right|bottom)( (left|top|right|bottom))?$/i,u=/^([+-]?\d*\.?\d+)% ([+-]?\d*\.?\d+)%$/i,Q=/(px)|%|( 0)$/i,w=/^(from|to|color-stop)\((?:([\d.]+)(%)?,\s*)?(.+?)\)$/i,U=/^\s*(circle|ellipse)?\s*((?:([\d.]+)(px|r?em|%)\s*(?:([\d.]+)(px|r?em|%))?)|closest-side|closest-corner|farthest-side|farthest-corner)?\s*(?:at\s*(?:(left|center|right)|([\d.]+)(px|r?em|%))\s+(?:(top|center|bottom)|([\d.]+)(px|r?em|%)))?(?:\s|$)/i,g=e.GRADIENT_TYPE={LINEAR_GRADIENT:0,RADIAL_GRADIENT:1},C=e.RADIAL_GRADIENT_SHAPE={CIRCLE:0,ELLIPSE:1},d={left:new s.default("0%"),top:new s.default("0%"),center:new s.default("50%"),right:new s.default("100%"),bottom:new s.default("100%")},F=e.LinearGradient=function A(e,t){c(this,A),this.type=g.LINEAR_GRADIENT,this.colorStops=e,this.direction=t},E=e.RadialGradient=function A(e,t,r,n){c(this,A),this.type=g.RADIAL_GRADIENT,this.colorStops=e,this.shape=t,this.center=r,this.radius=n},f=(e.parseGradient=function(A,e,t){var r=e.args,n=e.method,B=e.prefix;return"linear-gradient"===n?h(r,t,!!B):"gradient"===n&&"linear"===r[0]?h(["to bottom"].concat(y(r.slice(3))),t,!!B):"radial-gradient"===n?H(A,"-webkit-"===B?v(r):r,t):"gradient"===n&&"radial"===r[0]?H(A,y(v(r.slice(1))),t):void 0},function(A,e,t){for(var r=[],n=e;n<A.length;n++){var a=A[n],o=Q.test(a),i=a.lastIndexOf(" "),c=new B.default(o?a.substring(0,i):a),l=o?new s.default(a.substring(i+1)):n===e?new s.default("0%"):n===A.length-1?new s.default("100%"):null;r.push({color:c,stop:l})}for(var u=r.map(function(A){var e=A.color,r=A.stop;return{color:e,stop:0===t?0:r?r.getAbsoluteValue(t)/t:null}}),w=u[0].stop,U=0;U<u.length;U++)if(null!==w){var g=u[U].stop;if(null===g){for(var C=U;null===u[C].stop;)C++;for(var d=C-U+1,F=(u[C].stop-w)/d;U<C;U++)w=u[U].stop=w+F}else w=g}return u}),h=function(A,e,t){var r=(0,n.parseAngle)(A[0]),B=l.test(A[0]),a=B||null!==r||u.test(A[0]),s=a?null!==r?p(t?r-.5*Math.PI:r,e):B?I(A[0],e):K(A[0],e):p(Math.PI,e),i=a?1:0,c=Math.min((0,o.distance)(Math.abs(s.x0)+Math.abs(s.x1),Math.abs(s.y0)+Math.abs(s.y1)),2*e.width,2*e.height);return new F(f(A,i,c),s)},H=function(A,e,t){var r=e[0].match(U),n=r&&("circle"===r[1]||void 0!==r[3]&&void 0===r[5])?C.CIRCLE:C.ELLIPSE,B={},s={};r&&(void 0!==r[3]&&(B.x=(0,a.calculateLengthFromValueWithUnit)(A,r[3],r[4]).getAbsoluteValue(t.width)),void 0!==r[5]&&(B.y=(0,a.calculateLengthFromValueWithUnit)(A,r[5],r[6]).getAbsoluteValue(t.height)),r[7]?s.x=d[r[7].toLowerCase()]:void 0!==r[8]&&(s.x=(0,a.calculateLengthFromValueWithUnit)(A,r[8],r[9])),r[10]?s.y=d[r[10].toLowerCase()]:void 0!==r[11]&&(s.y=(0,a.calculateLengthFromValueWithUnit)(A,r[11],r[12])));var o={x:void 0===s.x?t.width/2:s.x.getAbsoluteValue(t.width),y:void 0===s.y?t.height/2:s.y.getAbsoluteValue(t.height)},i=m(r&&r[2]||"farthest-corner",n,o,B,t);return new E(f(e,r?1:0,Math.min(i.x,i.y)),n,o,i)},p=function(A,e){var t=e.width,r=e.height,n=.5*t,B=.5*r,a=(Math.abs(t*Math.sin(A))+Math.abs(r*Math.cos(A)))/2,s=n+Math.sin(A)*a,o=B-Math.cos(A)*a;return{x0:s,x1:t-s,y0:o,y1:r-o}},N=function(A){return Math.acos(A.width/2/((0,o.distance)(A.width,A.height)/2))},I=function(A,e){switch(A){case"bottom":case"to top":return p(0,e);case"left":case"to right":return p(Math.PI/2,e);case"right":case"to left":return p(3*Math.PI/2,e);case"top right":case"right top":case"to bottom left":case"to left bottom":return p(Math.PI+N(e),e);case"top left":case"left top":case"to bottom right":case"to right bottom":return p(Math.PI-N(e),e);case"bottom left":case"left bottom":case"to top right":case"to right top":return p(N(e),e);case"bottom right":case"right bottom":case"to top left":case"to left top":return p(2*Math.PI-N(e),e);case"top":case"to bottom":default:return p(Math.PI,e)}},K=function(A,e){var t=A.split(" ").map(parseFloat),n=r(t,2),B=n[0],a=n[1],s=B/100*e.width/(a/100*e.height);return p(Math.atan(isNaN(s)?1:s)+Math.PI/2,e)},T=function(A,e,t,r){return[{x:0,y:0},{x:0,y:A.height},{x:A.width,y:0},{x:A.width,y:A.height}].reduce(function(A,n){var B=(0,o.distance)(e-n.x,t-n.y);return(r?B<A.optimumDistance:B>A.optimumDistance)?{optimumCorner:n,optimumDistance:B}:A},{optimumDistance:r?1/0:-1/0,optimumCorner:null}).optimumCorner},m=function(A,e,t,r,n){var B=t.x,a=t.y,s=0,i=0;switch(A){case"closest-side":e===C.CIRCLE?s=i=Math.min(Math.abs(B),Math.abs(B-n.width),Math.abs(a),Math.abs(a-n.height)):e===C.ELLIPSE&&(s=Math.min(Math.abs(B),Math.abs(B-n.width)),i=Math.min(Math.abs(a),Math.abs(a-n.height)));break;case"closest-corner":if(e===C.CIRCLE)s=i=Math.min((0,o.distance)(B,a),(0,o.distance)(B,a-n.height),(0,o.distance)(B-n.width,a),(0,o.distance)(B-n.width,a-n.height));else if(e===C.ELLIPSE){var c=Math.min(Math.abs(a),Math.abs(a-n.height))/Math.min(Math.abs(B),Math.abs(B-n.width)),l=T(n,B,a,!0);i=c*(s=(0,o.distance)(l.x-B,(l.y-a)/c))}break;case"farthest-side":e===C.CIRCLE?s=i=Math.max(Math.abs(B),Math.abs(B-n.width),Math.abs(a),Math.abs(a-n.height)):e===C.ELLIPSE&&(s=Math.max(Math.abs(B),Math.abs(B-n.width)),i=Math.max(Math.abs(a),Math.abs(a-n.height)));break;case"farthest-corner":if(e===C.CIRCLE)s=i=Math.max((0,o.distance)(B,a),(0,o.distance)(B,a-n.height),(0,o.distance)(B-n.width,a),(0,o.distance)(B-n.width,a-n.height));else if(e===C.ELLIPSE){var u=Math.max(Math.abs(a),Math.abs(a-n.height))/Math.max(Math.abs(B),Math.abs(B-n.width)),Q=T(n,B,a,!1);i=u*(s=(0,o.distance)(Q.x-B,(Q.y-a)/u))}break;default:s=r.x||0,i=void 0!==r.y?r.y:s}return{x:s,y:i}},v=e.transformWebkitRadialGradientArgs=function(A){var e="",t="",r="",n="",B=0,a=/^(left|center|right|\d+(?:px|r?em|%)?)(?:\s+(top|center|bottom|\d+(?:px|r?em|%)?))?$/i,s=/^\d+(px|r?em|%)?(?:\s+\d+(px|r?em|%)?)?$/i,o=A[B].match(a);o&&B++;var i=A[B].match(/^(circle|ellipse)?\s*(closest-side|closest-corner|farthest-side|farthest-corner|contain|cover)?$/i);i&&(e=i[1]||"","contain"===(r=i[2]||"")?r="closest-side":"cover"===r&&(r="farthest-corner"),B++);var c=A[B].match(s);c&&B++;var l=A[B].match(a);l&&B++;var u=A[B].match(s);u&&B++;var Q=l||o;Q&&Q[1]&&(n=Q[1]+(/^\d+$/.test(Q[1])?"px":""),Q[2]&&(n+=" "+Q[2]+(/^\d+$/.test(Q[2])?"px":"")));var w=u||c;return w&&(t=w[0],w[1]||(t+="px")),!n||e||t||r||(t=n,n=""),n&&(n="at "+n),[[e,r,t,n].filter(function(A){return!!A}).join(" ")].concat(A.slice(B))},y=function(A){return A.map(function(A){return A.match(w)}).map(function(e,t){if(!e)return A[t];switch(e[1]){case"from":return e[4]+" 0%";case"to":return e[4]+" 100%";case"color-stop":return"%"===e[3]?e[4]+" "+e[2]:e[4]+" "+100*parseFloat(e[2])+"%"}})}},function(A,e,t){"use strict";Object.defineProperty(e,"__esModule",{value:!0});var r=/([+-]?\d*\.?\d+)(deg|grad|rad|turn)/i;e.parseAngle=function(A){var e=A.match(r);if(e){var t=parseFloat(e[1]);switch(e[2].toLowerCase()){case"deg":return Math.PI*t/180;case"grad":return Math.PI/200*t;case"rad":return t;case"turn":return 2*Math.PI*t}}return null}},function(A,e,t){"use strict";Object.defineProperty(e,"__esModule",{value:!0}),e.cloneWindow=e.DocumentCloner=void 0;var r=function(){return function(A,e){if(Array.isArray(A))return A;if(Symbol.iterator in Object(A))return function(A,e){var t=[],r=!0,n=!1,B=void 0;try{for(var a,s=A[Symbol.iterator]();!(r=(a=s.next()).done)&&(t.push(a.value),!e||t.length!==e);r=!0);}catch(A){n=!0,B=A}finally{try{!r&&s.return&&s.return()}finally{if(n)throw B}}return t}(A,e);throw new TypeError("Invalid attempt to destructure non-iterable instance")}}(),n=function(){function A(A,e){for(var t=0;t<e.length;t++){var r=e[t];r.enumerable=r.enumerable||!1,r.configurable=!0,"value"in r&&(r.writable=!0),Object.defineProperty(A,r.key,r)}}return function(e,t,r){return t&&A(e.prototype,t),r&&A(e,r),e}}(),B=t(2),a=t(26),s=u(t(55)),o=t(4),i=t(5),c=u(t(15)),l=t(56);function u(A){return A&&A.__esModule?A:{default:A}}var Q=e.DocumentCloner=function(){function A(e,t,r,n,B){!function(A,e){if(!(A instanceof e))throw new TypeError("Cannot call a class as a function")}(this,A),this.referenceElement=e,this.scrolledElements=[],this.copyStyles=n,this.inlineImages=n,this.logger=r,this.options=t,this.renderer=B,this.resourceLoader=new s.default(t,r,window),this.pseudoContentData={counters:{},quoteDepth:0},this.documentElement=this.cloneNode(e.ownerDocument.documentElement)}return n(A,[{key:"inlineAllImages",value:function(A){var e=this;if(this.inlineImages&&A){var t=A.style;Promise.all((0,i.parseBackgroundImage)(t.backgroundImage).map(function(A){return"url"===A.method?e.resourceLoader.inlineImage(A.args[0]).then(function(A){return A&&"string"==typeof A.src?'url("'+A.src+'")':"none"}).catch(function(A){0}):Promise.resolve(""+A.prefix+A.method+"("+A.args.join(",")+")")})).then(function(A){A.length>1&&(t.backgroundColor=""),t.backgroundImage=A.join(",")}),A instanceof HTMLImageElement&&this.resourceLoader.inlineImage(A.src).then(function(e){if(e&&A instanceof HTMLImageElement&&A.parentNode){var t=A.parentNode,r=(0,o.copyCSSStyles)(A.style,e.cloneNode(!1));t.replaceChild(r,A)}}).catch(function(A){0})}}},{key:"inlineFonts",value:function(A){var e=this;return Promise.all(Array.from(A.styleSheets).map(function(e){return e.href?fetch(e.href).then(function(A){return A.text()}).then(function(A){return U(A,e.href)}).catch(function(A){return[]}):w(e,A)})).then(function(A){return A.reduce(function(A,e){return A.concat(e)},[])}).then(function(A){return Promise.all(A.map(function(A){return fetch(A.formats[0].src).then(function(A){return A.blob()}).then(function(A){return new Promise(function(e,t){var r=new FileReader;r.onerror=t,r.onload=function(){var A=r.result;e(A)},r.readAsDataURL(A)})}).then(function(e){return A.fontFace.setProperty("src",'url("'+e+'")'),"@font-face {"+A.fontFace.cssText+" "})}))}).then(function(t){var r=A.createElement("style");r.textContent=t.join("\n"),e.documentElement.appendChild(r)})}},{key:"createElementClone",value:function(A){var e=this;if(this.copyStyles&&A instanceof HTMLCanvasElement){var t=A.ownerDocument.createElement("img");try{return t.src=A.toDataURL(),t}catch(A){0}}if(A instanceof HTMLIFrameElement){var r=A.cloneNode(!1),n=N();r.setAttribute("data-html2canvas-internal-iframe-key",n);var a=(0,B.parseBounds)(A,0,0),s=a.width,i=a.height;return this.resourceLoader.cache[n]=K(A,this.options).then(function(A){return e.renderer(A,{async:e.options.async,allowTaint:e.options.allowTaint,backgroundColor:"#ffffff",canvas:null,imageTimeout:e.options.imageTimeout,logging:e.options.logging,proxy:e.options.proxy,removeContainer:e.options.removeContainer,scale:e.options.scale,foreignObjectRendering:e.options.foreignObjectRendering,useCORS:e.options.useCORS,target:new c.default,width:s,height:i,x:0,y:0,windowWidth:A.ownerDocument.defaultView.innerWidth,windowHeight:A.ownerDocument.defaultView.innerHeight,scrollX:A.ownerDocument.defaultView.pageXOffset,scrollY:A.ownerDocument.defaultView.pageYOffset},e.logger.child(n))}).then(function(e){return new Promise(function(t,n){var B=document.createElement("img");B.onload=function(){return t(e)},B.onerror=n,B.src=e.toDataURL(),r.parentNode&&r.parentNode.replaceChild((0,o.copyCSSStyles)(A.ownerDocument.defaultView.getComputedStyle(A),B),r)})}),r}if(A instanceof HTMLStyleElement&&A.sheet&&A.sheet.cssRules){var l=[].slice.call(A.sheet.cssRules,0).reduce(function(A,t){try{return t&&t.cssText?A+t.cssText:A}catch(r){return e.logger.log("Unable to access cssText property",t.name),A}},""),u=A.cloneNode(!1);return u.textContent=l,u}return A.cloneNode(!1)}},{key:"cloneNode",value:function(A){var e=A.nodeType===Node.TEXT_NODE?document.createTextNode(A.nodeValue):this.createElementClone(A),t=A.ownerDocument.defaultView,r=A instanceof t.HTMLElement?t.getComputedStyle(A):null,n=A instanceof t.HTMLElement?t.getComputedStyle(A,":before"):null,B=A instanceof t.HTMLElement?t.getComputedStyle(A,":after"):null;this.referenceElement===A&&e instanceof t.HTMLElement&&(this.clonedReferenceElement=e),e instanceof t.HTMLBodyElement&&h(e);for(var a=(0,l.parseCounterReset)(r,this.pseudoContentData),s=(0,l.resolvePseudoContent)(A,n,this.pseudoContentData),i=A.firstChild;i;i=i.nextSibling)i.nodeType===Node.ELEMENT_NODE&&("SCRIPT"===i.nodeName||i.hasAttribute("data-html2canvas-ignore")||"function"==typeof this.options.ignoreElements&&this.options.ignoreElements(i))||this.copyStyles&&"STYLE"===i.nodeName||e.appendChild(this.cloneNode(i));var c=(0,l.resolvePseudoContent)(A,B,this.pseudoContentData);if((0,l.popCounters)(a,this.pseudoContentData),A instanceof t.HTMLElement&&e instanceof t.HTMLElement)switch(n&&this.inlineAllImages(C(A,e,n,s,d)),B&&this.inlineAllImages(C(A,e,B,c,F)),!r||!this.copyStyles||A instanceof HTMLIFrameElement||(0,o.copyCSSStyles)(r,e),this.inlineAllImages(e),0===A.scrollTop&&0===A.scrollLeft||this.scrolledElements.push([e,A.scrollLeft,A.scrollTop]),A.nodeName){case"CANVAS":this.copyStyles||g(A,e);break;case"TEXTAREA":case"SELECT":e.value=A.value}return e}}]),A}(),w=function(A,e){return(A.cssRules?Array.from(A.cssRules):[]).filter(function(A){return A.type===CSSRule.FONT_FACE_RULE}).map(function(A){for(var t=(0,i.parseBackgroundImage)(A.style.getPropertyValue("src")),r=[],n=0;n<t.length;n++)if("url"===t[n].method&&t[n+1]&&"format"===t[n+1].method){var B=e.createElement("a");B.href=t[n].args[0],e.body&&e.body.appendChild(B);var a={src:B.href,format:t[n+1].args[0]};r.push(a)}return{formats:r.filter(function(A){return/^woff/i.test(A.format)}),fontFace:A.style}}).filter(function(A){return A.formats.length})},U=function(A,e){var t=document.implementation.createHTMLDocument(""),r=document.createElement("base");r.href=e;var n=document.createElement("style");return n.textContent=A,t.head&&t.head.appendChild(r),t.body&&t.body.appendChild(n),n.sheet?w(n.sheet,t):[]},g=function(A,e){try{if(e){e.width=A.width,e.height=A.height;var t=A.getContext("2d"),r=e.getContext("2d");t?r.putImageData(t.getImageData(0,0,A.width,A.height),0,0):r.drawImage(A,0,0)}}catch(A){}},C=function(A,e,t,r,n){if(t&&t.content&&"none"!==t.content&&"-moz-alt-content"!==t.content&&"none"!==t.display){var B=e.ownerDocument.createElement("html2canvaspseudoelement");if((0,o.copyCSSStyles)(t,B),r)for(var a=r.length,s=0;s<a;s++){var c=r[s];switch(c.type){case l.PSEUDO_CONTENT_ITEM_TYPE.IMAGE:var u=e.ownerDocument.createElement("img");u.src=(0,i.parseBackgroundImage)("url("+c.value+")")[0].args[0],u.style.opacity="1",B.appendChild(u);break;case l.PSEUDO_CONTENT_ITEM_TYPE.TEXT:B.appendChild(e.ownerDocument.createTextNode(c.value))}}return B.className=E+" "+f,e.className+=n===d?" "+E:" "+f,n===d?e.insertBefore(B,e.firstChild):e.appendChild(B),B}},d=":before",F=":after",E="___html2canvas___pseudoelement_before",f="___html2canvas___pseudoelement_after",h=function(A){H(A,"."+E+d+'{\n    content: "" !important;\n    display: none !important;\n}\n         .'+f+F+'{\n    content: "" !important;\n    display: none !important;\n}')},H=function(A,e){var t=A.ownerDocument.createElement("style");t.innerHTML=e,A.appendChild(t)},p=function(A){var e=r(A,3),t=e[0],n=e[1],B=e[2];t.scrollLeft=n,t.scrollTop=B},N=function(){return Math.ceil(Date.now()+1e7*Math.random()).toString(16)},I=/^data:text\/(.+);(base64)?,(.*)$/i,K=function(A,e){try{return Promise.resolve(A.contentWindow.document.documentElement)}catch(t){return e.proxy?(0,a.Proxy)(A.src,e).then(function(A){var e=A.match(I);return e?"base64"===e[2]?window.atob(decodeURIComponent(e[3])):decodeURIComponent(e[3]):Promise.reject()}).then(function(e){return T(A.ownerDocument,(0,B.parseBounds)(A,0,0)).then(function(A){var t=A.contentWindow.document;t.open(),t.write(e);var r=m(A).then(function(){return t.documentElement});return t.close(),r})}):Promise.reject()}},T=function(A,e){var t=A.createElement("iframe");return t.className="html2canvas-container",t.style.visibility="hidden",t.style.position="fixed",t.style.left="-10000px",t.style.top="0px",t.style.border="0",t.width=e.width.toString(),t.height=e.height.toString(),t.scrolling="no",t.setAttribute("data-html2canvas-ignore","true"),A.body?(A.body.appendChild(t),Promise.resolve(t)):Promise.reject("")},m=function(A){var e=A.contentWindow,t=e.document;return new Promise(function(r,n){e.onload=A.onload=t.onreadystatechange=function(){var e=setInterval(function(){t.body.childNodes.length>0&&"complete"===t.readyState&&(clearInterval(e),r(A))},50)}})},v=(e.cloneWindow=function(A,e,t,r,n,B){var a=new Q(t,r,n,!1,B),s=A.defaultView.pageXOffset,o=A.defaultView.pageYOffset;return T(A,e).then(function(n){var B=n.contentWindow,i=B.document,c=m(n).then(function(){a.scrolledElements.forEach(p),B.scrollTo(e.left,e.top),!/(iPad|iPhone|iPod)/g.test(navigator.userAgent)||B.scrollY===e.top&&B.scrollX===e.left||(i.documentElement.style.top=-e.top+"px",i.documentElement.style.left=-e.left+"px",i.documentElement.style.position="absolute");var t=Promise.resolve([n,a.clonedReferenceElement,a.resourceLoader]),s=r.onclone;return a.clonedReferenceElement instanceof B.HTMLElement||a.clonedReferenceElement instanceof A.defaultView.HTMLElement||a.clonedReferenceElement instanceof HTMLElement?"function"==typeof s?Promise.resolve().then(function(){return s(i)}).then(function(){return t}):t:Promise.reject("")});return i.open(),i.write(v(document.doctype)+"<html></html>"),function(A,e,t){!A.defaultView||e===A.defaultView.pageXOffset&&t===A.defaultView.pageYOffset||A.defaultView.scrollTo(e,t)}(t.ownerDocument,s,o),i.replaceChild(i.adoptNode(a.documentElement),i.documentElement),i.close(),c})},function(A){var e="";return A&&(e+="<!DOCTYPE ",A.name&&(e+=A.name),A.internalSubset&&(e+=A.internalSubset),A.publicId&&(e+='"'+A.publicId+'"'),A.systemId&&(e+='"'+A.systemId+'"'),e+=">"),e})},function(A,e,t){"use strict";Object.defineProperty(e,"__esModule",{value:!0}),e.ResourceStore=void 0;var r,n=function(){function A(A,e){for(var t=0;t<e.length;t++){var r=e[t];r.enumerable=r.enumerable||!1,r.configurable=!0,"value"in r&&(r.writable=!0),Object.defineProperty(A,r.key,r)}}return function(e,t,r){return t&&A(e.prototype,t),r&&A(e,r),e}}(),B=t(10),a=(r=B)&&r.__esModule?r:{default:r},s=t(26);function o(A,e){if(!(A instanceof e))throw new TypeError("Cannot call a class as a function")}var i=function(){function A(e,t,r){o(this,A),this.options=e,this._window=r,this.origin=this.getOrigin(r.location.href),this.cache={},this.logger=t,this._index=0}return n(A,[{key:"loadImage",value:function(A){var e=this;if(this.hasResourceInCache(A))return A;if(g(A))return this.cache[A]=d(A,this.options.imageTimeout||0),A;if(!C(A)||a.default.SUPPORT_SVG_DRAWING){if(!0===this.options.allowTaint||w(A)||this.isSameOrigin(A))return this.addImage(A,A,!1);if(!this.isSameOrigin(A)){if("string"==typeof this.options.proxy)return this.cache[A]=(0,s.Proxy)(A,this.options).then(function(A){return d(A,e.options.imageTimeout||0)}),A;if(!0===this.options.useCORS&&a.default.SUPPORT_CORS_IMAGES)return this.addImage(A,A,!0)}}}},{key:"inlineImage",value:function(A){var e=this;return w(A)?d(A,this.options.imageTimeout||0):this.hasResourceInCache(A)?this.cache[A]:this.isSameOrigin(A)||"string"!=typeof this.options.proxy?this.xhrImage(A):this.cache[A]=(0,s.Proxy)(A,this.options).then(function(A){return d(A,e.options.imageTimeout||0)})}},{key:"xhrImage",value:function(A){var e=this;return this.cache[A]=new Promise(function(t,r){var n=new XMLHttpRequest;if(n.onreadystatechange=function(){if(4===n.readyState)if(200!==n.status)r("Failed to fetch image "+A.substring(0,256)+" with status code "+n.status);else{var e=new FileReader;e.addEventListener("load",function(){var A=e.result;t(A)},!1),e.addEventListener("error",function(A){return r(A)},!1),e.readAsDataURL(n.response)}},n.responseType="blob",e.options.imageTimeout){var B=e.options.imageTimeout;n.timeout=B,n.ontimeout=function(){return r("")}}n.open("GET",A,!0),n.send()}).then(function(A){return d(A,e.options.imageTimeout||0)}),this.cache[A]}},{key:"loadCanvas",value:function(A){var e=String(this._index++);return this.cache[e]=Promise.resolve(A),e}},{key:"hasResourceInCache",value:function(A){return void 0!==this.cache[A]}},{key:"addImage",value:function(A,e,t){var r=this;var n=function(A){return new Promise(function(n,B){var a=new Image;if(a.onload=function(){return n(a)},A&&!t||(a.crossOrigin="anonymous"),a.onerror=B,a.src=e,!0===a.complete&&setTimeout(function(){n(a)},500),r.options.imageTimeout){var s=r.options.imageTimeout;setTimeout(function(){return B("")},s)}})};return this.cache[A]=U(e)&&!C(e)?a.default.SUPPORT_BASE64_DRAWING(e).then(n):n(!0),A}},{key:"isSameOrigin",value:function(A){return this.getOrigin(A)===this.origin}},{key:"getOrigin",value:function(A){var e=this._link||(this._link=this._window.document.createElement("a"));return e.href=A,e.href=e.href,e.protocol+e.hostname+e.port}},{key:"ready",value:function(){var A=this,e=Object.keys(this.cache),t=e.map(function(e){return A.cache[e].catch(function(A){return null})});return Promise.all(t).then(function(A){return new c(e,A)})}}]),A}();e.default=i;var c=e.ResourceStore=function(){function A(e,t){o(this,A),this._keys=e,this._resources=t}return n(A,[{key:"get",value:function(A){var e=this._keys.indexOf(A);return-1===e?null:this._resources[e]}}]),A}(),l=/^data:image\/svg\+xml/i,u=/^data:image\/.*;base64,/i,Q=/^data:image\/.*/i,w=function(A){return Q.test(A)},U=function(A){return u.test(A)},g=function(A){return"blob"===A.substr(0,4)},C=function(A){return"svg"===A.substr(-3).toLowerCase()||l.test(A)},d=function(A,e){return new Promise(function(t,r){var n=new Image;n.onload=function(){return t(n)},n.onerror=r,n.src=A,!0===n.complete&&setTimeout(function(){t(n)},500),e&&setTimeout(function(){return r("")},e)})}},function(A,e,t){"use strict";Object.defineProperty(e,"__esModule",{value:!0}),e.parseContent=e.resolvePseudoContent=e.popCounters=e.parseCounterReset=e.TOKEN_TYPE=e.PSEUDO_CONTENT_ITEM_TYPE=void 0;var r=function(){return function(A,e){if(Array.isArray(A))return A;if(Symbol.iterator in Object(A))return function(A,e){var t=[],r=!0,n=!1,B=void 0;try{for(var a,s=A[Symbol.iterator]();!(r=(a=s.next()).done)&&(t.push(a.value),!e||t.length!==e);r=!0);}catch(A){n=!0,B=A}finally{try{!r&&s.return&&s.return()}finally{if(n)throw B}}return t}(A,e);throw new TypeError("Invalid attempt to destructure non-iterable instance")}}(),n=t(14),B=t(8),a=e.PSEUDO_CONTENT_ITEM_TYPE={TEXT:0,IMAGE:1},s=e.TOKEN_TYPE={STRING:0,ATTRIBUTE:1,URL:2,COUNTER:3,COUNTERS:4,OPENQUOTE:5,CLOSEQUOTE:6},o=(e.parseCounterReset=function(A,e){if(!A||!A.counterReset||"none"===A.counterReset)return[];for(var t=[],n=A.counterReset.split(/\s*,\s*/),B=n.length,a=0;a<B;a++){var s=n[a].split(/\s+/),o=r(s,2),i=o[0],c=o[1];t.push(i);var l=e.counters[i];l||(l=e.counters[i]=[]),l.push(parseInt(c||0,10))}return t},e.popCounters=function(A,e){for(var t=A.length,r=0;r<t;r++)e.counters[A[r]].pop()},e.resolvePseudoContent=function(A,e,t){if(!e||!e.content||"none"===e.content||"-moz-alt-content"===e.content||"none"===e.display)return null;var n=o(e.content),B=n.length,i=[],u="",Q=e.counterIncrement;if(Q&&"none"!==Q){var w=Q.split(/\s+/),U=r(w,2),g=U[0],C=U[1],d=t.counters[g];d&&(d[d.length-1]+=void 0===C?1:parseInt(C,10))}for(var F=0;F<B;F++){var E=n[F];switch(E.type){case s.STRING:u+=E.value||"";break;case s.ATTRIBUTE:A instanceof HTMLElement&&E.value&&(u+=A.getAttribute(E.value)||"");break;case s.COUNTER:var f=t.counters[E.name||""];f&&(u+=l([f[f.length-1]],"",E.format));break;case s.COUNTERS:var h=t.counters[E.name||""];h&&(u+=l(h,E.glue,E.format));break;case s.OPENQUOTE:u+=c(e,!0,t.quoteDepth),t.quoteDepth++;break;case s.CLOSEQUOTE:t.quoteDepth--,u+=c(e,!1,t.quoteDepth);break;case s.URL:u&&(i.push({type:a.TEXT,value:u}),u=""),i.push({type:a.IMAGE,value:E.value||""})}}return u&&i.push({type:a.TEXT,value:u}),i},e.parseContent=function(A,e){if(e&&e[A])return e[A];for(var t=[],r=A.length,n=!1,B=!1,a=!1,o="",c="",l=[],u=0;u<r;u++){var Q=A.charAt(u);switch(Q){case"'":case'"':B?o+=Q:(n=!n,a||n||(t.push({type:s.STRING,value:o}),o=""));break;case"\\":B?(o+=Q,B=!1):B=!0;break;case"(":n?o+=Q:(a=!0,c=o,o="",l=[]);break;case")":if(n)o+=Q;else if(a){switch(o&&l.push(o),c){case"attr":l.length>0&&t.push({type:s.ATTRIBUTE,value:l[0]});break;case"counter":if(l.length>0){var w={type:s.COUNTER,name:l[0]};l.length>1&&(w.format=l[1]),t.push(w)}break;case"counters":if(l.length>0){var U={type:s.COUNTERS,name:l[0]};l.length>1&&(U.glue=l[1]),l.length>2&&(U.format=l[2]),t.push(U)}break;case"url":l.length>0&&t.push({type:s.URL,value:l[0]})}a=!1,o=""}break;case",":n?o+=Q:a&&(l.push(o),o="");break;case" ":case"\t":n?o+=Q:o&&(i(t,o),o="");break;default:o+=Q}"\\"!==Q&&(B=!1)}return o&&i(t,o),e&&(e[A]=t),t}),i=function(A,e){switch(e){case"open-quote":A.push({type:s.OPENQUOTE});break;case"close-quote":A.push({type:s.CLOSEQUOTE})}},c=function(A,e,t){var r=A.quotes?A.quotes.split(/\s+/):["'\"'","'\"'"],n=2*t;return n>=r.length&&(n=r.length-2),e||++n,r[n].replace(/^["']|["']$/g,"")},l=function(A,e,t){for(var r=A.length,a="",s=0;s<r;s++)s>0&&(a+=e||""),a+=(0,n.createCounterText)(A[s],(0,B.parseListStyleType)(t||"decimal"),!1);return a}}])});
(function() {

   "use strict";


//IE, Edge 지원 안함. node.before();
(function (arr) {
    arr.forEach(function (item) {
      if (item.hasOwnProperty('before')) {
        return;
      }
      Object.defineProperty(item, 'before', {
        configurable: true,
        enumerable: true,
        writable: true,
        value: function before() {
          var argArr = Array.prototype.slice.call(arguments),
            docFrag = document.createDocumentFragment();
          
          argArr.forEach(function (argItem) {
            var isNode = argItem instanceof Node;
            docFrag.appendChild(isNode ? argItem : document.createTextNode(String(argItem)));
          });
          
          this.parentNode.insertBefore(docFrag, this);
        }
      });
    });
  })([Element.prototype, CharacterData.prototype, DocumentType.prototype]);

//IE 지원 안함. node.remove();
(function (arr) {
    arr.forEach(function (item) {
      if (item.hasOwnProperty('remove')) {
        return;
      }
      Object.defineProperty(item, 'remove', {
        configurable: true,
        enumerable: true,
        writable: true,
        value: function remove() {
          if (this.parentNode !== null)
            this.parentNode.removeChild(this);
        }
      });
    });
  })([Element.prototype, CharacterData.prototype, DocumentType.prototype]);
// Source: https://gist.github.com/k-gun/c2ea7c49edf7b757fe9561ba37cb19ca
// classList polyfill
;(function() {
    // helpers
    var regExp = function(name) {
        return new RegExp('(^| )'+ name +'( |$)');
    };
    var forEach = function(list, fn, scope) {
        for (var i = 0; i < list.length; i++) {
            fn.call(scope, list[i]);
        }
    };

    // class list object with basic methods
    function ClassList(element) {
        this.element = element;
    }

    ClassList.prototype = {
        add: function() {
            forEach(arguments, function(name) {
                if (!this.contains(name)) {
                    this.element.className += this.element.className.length > 0 ? ' ' + name : name;
                }
            }, this);
        },
        remove: function() {
            forEach(arguments, function(name) {
                this.element.className =
                    this.element.className.replace(regExp(name), '');
            }, this);
        },
        toggle: function(name) {
            return this.contains(name) 
                ? (this.remove(name), false) : (this.add(name), true);
        },
        contains: function(name) {
            return regExp(name).test(this.element.className);
        },
        // bonus..
        replace: function(oldName, newName) {
            this.remove(oldName), this.add(newName);
        }
    };

    // IE8/9, Safari
    if (!('classList' in Element.prototype)) {
        Object.defineProperty(Element.prototype, 'classList', {
            get: function() {
                return new ClassList(this);
            }
        });
    }

    // replace() support for others
    if (window.DOMTokenList && DOMTokenList.prototype.replace == null) {
        DOMTokenList.prototype.replace = ClassList.prototype.replace;
    }
})();

  //https://gist.github.com/Aldlevine/3f716f447322edbb3671
  //axe-core 에서사용.
  (function(){
    
    // performance.now already exists
    if(window.performance && window.performance.now)
        return;
    
    // performance exists and has the necessary methods to hack out the current DOMHighResTimestamp
    if(
        window.performance &&
        window.performance.timing && 
        window.performance.timing.navigationStart &&
        window.performance.mark &&
        window.performance.clearMarks &&
        window.performance.getEntriesByName
    ){
        window.performance.now = function(){
            window.performance.clearMarks('__PERFORMANCE_NOW__');
            window.performance.mark('__PERFORMANCE_NOW__');
            return window.performance.getEntriesByName('__PERFORMANCE_NOW__')[0].startTime;
        };
        return;
    }
    
    // All else fails, can't access a DOMHighResTimestamp, use a boring old Date...
    window.performance = window.performance || {};
    var start = (new Date()).valueOf();
    window.performance.now = function(){
        return (new Date()).valueOf() - start;
    };
           
})();

//https://github.com/davidchambers/Base64.js
;(function () {

    if (window.btoa && window.atob) {   //jexjs 수정 browser가 지원하는 경우는 사용안함.
        return;
    }
    var object =
      typeof exports != 'undefined' ? exports :
      typeof self != 'undefined' ? self : // #8: web workers
      $.global; // #31: ExtendScript
  
    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  
    function InvalidCharacterError(message) {
      this.message = message;
    }
    InvalidCharacterError.prototype = new Error;
    InvalidCharacterError.prototype.name = 'InvalidCharacterError';
  
    // encoder
    // [https://gist.github.com/999166] by [https://github.com/nignag]
    object.btoa || (
    object.btoa = function (input) {
      var str = String(input);
      for (
        // initialize result and counter
        var block, charCode, idx = 0, map = chars, output = '';
        // if the next str index does not exist:
        //   change the mapping table to "="
        //   check if d has no fractional digits
        str.charAt(idx | 0) || (map = '=', idx % 1);
        // "8 - idx % 1 * 8" generates the sequence 2, 4, 6, 8
        output += map.charAt(63 & block >> 8 - idx % 1 * 8)
      ) {
        charCode = str.charCodeAt(idx += 3/4);
        if (charCode > 0xFF) {
          throw new InvalidCharacterError("'btoa' failed: The string to be encoded contains characters outside of the Latin1 range.");
        }
        block = block << 8 | charCode;
      }
      return output;
    });
  
    // decoder
    // [https://gist.github.com/1020396] by [https://github.com/atk]
    object.atob || (
    object.atob = function (input) {
      var str = String(input).replace(/[=]+$/, ''); // #31: ExtendScript bad parse of /=
      if (str.length % 4 == 1) {
        throw new InvalidCharacterError("'atob' failed: The string to be decoded is not correctly encoded.");
      }
      for (
        // initialize result and counters
        var bc = 0, bs, buffer, idx = 0, output = '';
        // get next character
        buffer = str.charAt(idx++);
        // character found in table? initialize bit storage and add its ascii value;
        ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer,
          // and if not first of each 4 characters,
          // convert the first 8 bits to one ascii character
          bc++ % 4) ? output += String.fromCharCode(255 & bs >> (-2 * bc & 6)) : 0
      ) {
        // try to find character in table (0-63, not found => -1)
        buffer = chars.indexOf(buffer);
      }
      return output;
    });
  
  }());

// IE9 지원
//https://github.com/inexorabletash/polyfill/blob/master/typedarray.js
/*
 Copyright (c) 2010, Linden Research, Inc.
 Copyright (c) 2014, Joshua Bell

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
 $/LicenseInfo$
 */

// Original can be found at:
//   https://bitbucket.org/lindenlab/llsd
// Modifications by Joshua Bell inexorabletash@gmail.com
//   https://github.com/inexorabletash/polyfill

// ES3/ES5 implementation of the Krhonos Typed Array Specification
//   Ref: http://www.khronos.org/registry/typedarray/specs/latest/
//   Date: 2011-02-01
//
// Variations:
//  * Allows typed_array.get/set() as alias for subscripts (typed_array[])
//  * Gradually migrating structure from Khronos spec to ES2015 spec
//
// Caveats:
//  * Beyond 10000 or so entries, polyfilled array accessors (ta[0],
//    etc) become memory-prohibitive, so array creation will fail. Set
//    self.TYPED_ARRAY_POLYFILL_NO_ARRAY_ACCESSORS=true to disable
//    creation of accessors. Your code will need to use the
//    non-standard get()/set() instead, and will need to add those to
//    native arrays for interop.
(function(global) {
    'use strict';
    var undefined = (void 0); // Paranoia
  
    // Beyond this value, index getters/setters (i.e. array[0], array[1]) are so slow to
    // create, and consume so much memory, that the browser appears frozen.
    var MAX_ARRAY_LENGTH = 1e5;
  
    // Approximations of internal ECMAScript conversion functions
    function Type(v) {
      switch(typeof v) {
      case 'undefined': return 'undefined';
      case 'boolean': return 'boolean';
      case 'number': return 'number';
      case 'string': return 'string';
      default: return v === null ? 'null' : 'object';
      }
    }
  
    // Class returns internal [[Class]] property, used to avoid cross-frame instanceof issues:
    function Class(v) { return Object.prototype.toString.call(v).replace(/^\[object *|\]$/g, ''); }
    function IsCallable(o) { return typeof o === 'function'; }
    function ToObject(v) {
      if (v === null || v === undefined) throw TypeError();
      return Object(v);
    }
    function ToInt32(v) { return v >> 0; }
    function ToUint32(v) { return v >>> 0; }
  
    // Snapshot intrinsics
    var LN2 = Math.LN2,
        abs = Math.abs,
        floor = Math.floor,
        log = Math.log,
        max = Math.max,
        min = Math.min,
        pow = Math.pow,
        round = Math.round;
  
    // emulate ES5 getter/setter API using legacy APIs
    // http://blogs.msdn.com/b/ie/archive/2010/09/07/transitioning-existing-code-to-the-es5-getter-setter-apis.aspx
    // (second clause tests for Object.defineProperty() in IE<9 that only supports extending DOM prototypes, but
    // note that IE<9 does not support __defineGetter__ or __defineSetter__ so it just renders the method harmless)
  
    (function() {
      var orig = Object.defineProperty;
      var dom_only = !(function(){try{return Object.defineProperty({},'x',{});}catch(_){return false;}}());
  
      if (!orig || dom_only) {
        Object.defineProperty = function (o, prop, desc) {
          // In IE8 try built-in implementation for defining properties on DOM prototypes.
          if (orig)
            try { return orig(o, prop, desc); } catch (_) {}
          if (o !== Object(o))
            throw TypeError('Object.defineProperty called on non-object');
          if (Object.prototype.__defineGetter__ && ('get' in desc))
            Object.prototype.__defineGetter__.call(o, prop, desc.get);
          if (Object.prototype.__defineSetter__ && ('set' in desc))
            Object.prototype.__defineSetter__.call(o, prop, desc.set);
          if ('value' in desc)
            o[prop] = desc.value;
          return o;
        };
      }
    }());
  
    // ES5: Make obj[index] an alias for obj._getter(index)/obj._setter(index, value)
    // for index in 0 ... obj.length
    function makeArrayAccessors(obj) {
      if ('TYPED_ARRAY_POLYFILL_NO_ARRAY_ACCESSORS' in global)
        return;
  
      if (obj.length > MAX_ARRAY_LENGTH) throw RangeError('Array too large for polyfill');
  
      function makeArrayAccessor(index) {
        Object.defineProperty(obj, index, {
          'get': function() { return obj._getter(index); },
          'set': function(v) { obj._setter(index, v); },
          enumerable: true,
          configurable: false
        });
      }
  
      var i;
      for (i = 0; i < obj.length; i += 1) {
        makeArrayAccessor(i);
      }
    }
  
    // Internal conversion functions:
    //    pack<Type>()   - take a number (interpreted as Type), output a byte array
    //    unpack<Type>() - take a byte array, output a Type-like number
  
    function as_signed(value, bits) { var s = 32 - bits; return (value << s) >> s; }
    function as_unsigned(value, bits) { var s = 32 - bits; return (value << s) >>> s; }
  
    function packI8(n) { return [n & 0xff]; }
    function unpackI8(bytes) { return as_signed(bytes[0], 8); }
  
    function packU8(n) { return [n & 0xff]; }
    function unpackU8(bytes) { return as_unsigned(bytes[0], 8); }
  
    function packU8Clamped(n) { n = round(Number(n)); return [n < 0 ? 0 : n > 0xff ? 0xff : n & 0xff]; }
  
    function packI16(n) { return [n & 0xff, (n >> 8) & 0xff]; }
    function unpackI16(bytes) { return as_signed(bytes[1] << 8 | bytes[0], 16); }
  
    function packU16(n) { return [n & 0xff, (n >> 8) & 0xff]; }
    function unpackU16(bytes) { return as_unsigned(bytes[1] << 8 | bytes[0], 16); }
  
    function packI32(n) { return [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff]; }
    function unpackI32(bytes) { return as_signed(bytes[3] << 24 | bytes[2] << 16 | bytes[1] << 8 | bytes[0], 32); }
  
    function packU32(n) { return [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff]; }
    function unpackU32(bytes) { return as_unsigned(bytes[3] << 24 | bytes[2] << 16 | bytes[1] << 8 | bytes[0], 32); }
  
    function packIEEE754(v, ebits, fbits) {
  
      var bias = (1 << (ebits - 1)) - 1;
  
      function roundToEven(n) {
        var w = floor(n), f = n - w;
        if (f < 0.5)
          return w;
        if (f > 0.5)
          return w + 1;
        return w % 2 ? w + 1 : w;
      }
  
      // Compute sign, exponent, fraction
      var s, e, f;
      if (v !== v) {
        // NaN
        // http://dev.w3.org/2006/webapi/WebIDL/#es-type-mapping
        e = (1 << ebits) - 1; f = pow(2, fbits - 1); s = 0;
      } else if (v === Infinity || v === -Infinity) {
        e = (1 << ebits) - 1; f = 0; s = (v < 0) ? 1 : 0;
      } else if (v === 0) {
        e = 0; f = 0; s = (1 / v === -Infinity) ? 1 : 0;
      } else {
        s = v < 0;
        v = abs(v);
  
        if (v >= pow(2, 1 - bias)) {
          // Normalized
          e = min(floor(log(v) / LN2), 1023);
          var significand = v / pow(2, e);
          if (significand < 1) {
            e -= 1;
            significand *= 2;
          }
          if (significand >= 2) {
            e += 1;
            significand /= 2;
          }
          var d = pow(2, fbits);
          f = roundToEven(significand * d) - d;
          e += bias;
          if (f / d >= 1) {
            e += 1;
            f = 0;
          }
          if (e > 2 * bias) {
            // Overflow
            e = (1 << ebits) - 1;
            f = 0;
          }
        } else {
          // Denormalized
          e = 0;
          f = roundToEven(v / pow(2, 1 - bias - fbits));
        }
      }
  
      // Pack sign, exponent, fraction
      var bits = [], i;
      for (i = fbits; i; i -= 1) { bits.push(f % 2 ? 1 : 0); f = floor(f / 2); }
      for (i = ebits; i; i -= 1) { bits.push(e % 2 ? 1 : 0); e = floor(e / 2); }
      bits.push(s ? 1 : 0);
      bits.reverse();
      var str = bits.join('');
  
      // Bits to bytes
      var bytes = [];
      while (str.length) {
        bytes.unshift(parseInt(str.substring(0, 8), 2));
        str = str.substring(8);
      }
      return bytes;
    }
  
    function unpackIEEE754(bytes, ebits, fbits) {
      // Bytes to bits
      var bits = [], i, j, b, str,
          bias, s, e, f;
  
      for (i = 0; i < bytes.length; ++i) {
        b = bytes[i];
        for (j = 8; j; j -= 1) {
          bits.push(b % 2 ? 1 : 0); b = b >> 1;
        }
      }
      bits.reverse();
      str = bits.join('');
  
      // Unpack sign, exponent, fraction
      bias = (1 << (ebits - 1)) - 1;
      s = parseInt(str.substring(0, 1), 2) ? -1 : 1;
      e = parseInt(str.substring(1, 1 + ebits), 2);
      f = parseInt(str.substring(1 + ebits), 2);
  
      // Produce number
      if (e === (1 << ebits) - 1) {
        return f !== 0 ? NaN : s * Infinity;
      } else if (e > 0) {
        // Normalized
        return s * pow(2, e - bias) * (1 + f / pow(2, fbits));
      } else if (f !== 0) {
        // Denormalized
        return s * pow(2, -(bias - 1)) * (f / pow(2, fbits));
      } else {
        return s < 0 ? -0 : 0;
      }
    }
  
    function unpackF64(b) { return unpackIEEE754(b, 11, 52); }
    function packF64(v) { return packIEEE754(v, 11, 52); }
    function unpackF32(b) { return unpackIEEE754(b, 8, 23); }
    function packF32(v) { return packIEEE754(v, 8, 23); }
  
    //
    // 3 The ArrayBuffer Type
    //
  
    (function() {
  
      function ArrayBuffer(length) {
        length = ToInt32(length);
        if (length < 0) throw RangeError('ArrayBuffer size is not a small enough positive integer.');
        Object.defineProperty(this, 'byteLength', {value: length});
        Object.defineProperty(this, '_bytes', {value: Array(length)});
  
        for (var i = 0; i < length; i += 1)
          this._bytes[i] = 0;
      }
  
      global.ArrayBuffer = global.ArrayBuffer || ArrayBuffer;
  
      //
      // 5 The Typed Array View Types
      //
  
      function $TypedArray$() {
  
        // %TypedArray% ( length )
        if (!arguments.length || typeof arguments[0] !== 'object') {
          return (function(length) {
            length = ToInt32(length);
            if (length < 0) throw RangeError('length is not a small enough positive integer.');
            Object.defineProperty(this, 'length', {value: length});
            Object.defineProperty(this, 'byteLength', {value: length * this.BYTES_PER_ELEMENT});
            Object.defineProperty(this, 'buffer', {value: new ArrayBuffer(this.byteLength)});
            Object.defineProperty(this, 'byteOffset', {value: 0});
  
           }).apply(this, arguments);
        }
  
        // %TypedArray% ( typedArray )
        if (arguments.length >= 1 &&
            Type(arguments[0]) === 'object' &&
            arguments[0] instanceof $TypedArray$) {
          return (function(typedArray){
            if (this.constructor !== typedArray.constructor) throw TypeError();
  
            var byteLength = typedArray.length * this.BYTES_PER_ELEMENT;
            Object.defineProperty(this, 'buffer', {value: new ArrayBuffer(byteLength)});
            Object.defineProperty(this, 'byteLength', {value: byteLength});
            Object.defineProperty(this, 'byteOffset', {value: 0});
            Object.defineProperty(this, 'length', {value: typedArray.length});
  
            for (var i = 0; i < this.length; i += 1)
              this._setter(i, typedArray._getter(i));
  
          }).apply(this, arguments);
        }
  
        // %TypedArray% ( array )
        if (arguments.length >= 1 &&
            Type(arguments[0]) === 'object' &&
            !(arguments[0] instanceof $TypedArray$) &&
            !(arguments[0] instanceof ArrayBuffer || Class(arguments[0]) === 'ArrayBuffer')) {
          return (function(array) {
  
            var byteLength = array.length * this.BYTES_PER_ELEMENT;
            Object.defineProperty(this, 'buffer', {value: new ArrayBuffer(byteLength)});
            Object.defineProperty(this, 'byteLength', {value: byteLength});
            Object.defineProperty(this, 'byteOffset', {value: 0});
            Object.defineProperty(this, 'length', {value: array.length});
  
            for (var i = 0; i < this.length; i += 1) {
              var s = array[i];
              this._setter(i, Number(s));
            }
          }).apply(this, arguments);
        }
  
        // %TypedArray% ( buffer, byteOffset=0, length=undefined )
        if (arguments.length >= 1 &&
            Type(arguments[0]) === 'object' &&
            (arguments[0] instanceof ArrayBuffer || Class(arguments[0]) === 'ArrayBuffer')) {
          return (function(buffer, byteOffset, length) {
  
            byteOffset = ToUint32(byteOffset);
            if (byteOffset > buffer.byteLength)
              throw RangeError('byteOffset out of range');
  
            // The given byteOffset must be a multiple of the element
            // size of the specific type, otherwise an exception is raised.
            if (byteOffset % this.BYTES_PER_ELEMENT)
              throw RangeError('buffer length minus the byteOffset is not a multiple of the element size.');
  
            if (length === undefined) {
              var byteLength = buffer.byteLength - byteOffset;
              if (byteLength % this.BYTES_PER_ELEMENT)
                throw RangeError('length of buffer minus byteOffset not a multiple of the element size');
              length = byteLength / this.BYTES_PER_ELEMENT;
  
            } else {
              length = ToUint32(length);
              byteLength = length * this.BYTES_PER_ELEMENT;
            }
  
            if ((byteOffset + byteLength) > buffer.byteLength)
              throw RangeError('byteOffset and length reference an area beyond the end of the buffer');
  
            Object.defineProperty(this, 'buffer', {value: buffer});
            Object.defineProperty(this, 'byteLength', {value: byteLength});
            Object.defineProperty(this, 'byteOffset', {value: byteOffset});
            Object.defineProperty(this, 'length', {value: length});
  
          }).apply(this, arguments);
        }
  
        // %TypedArray% ( all other argument combinations )
        throw TypeError();
      }
  
      // Properties of the %TypedArray Instrinsic Object
  
      // %TypedArray%.from ( source , mapfn=undefined, thisArg=undefined )
      Object.defineProperty($TypedArray$, 'from', {value: function(iterable) {
        return new this(iterable);
      }});
  
      // %TypedArray%.of ( ...items )
      Object.defineProperty($TypedArray$, 'of', {value: function(/*...items*/) {
        return new this(arguments);
      }});
  
      // %TypedArray%.prototype
      var $TypedArrayPrototype$ = {};
      $TypedArray$.prototype = $TypedArrayPrototype$;
  
      // WebIDL: getter type (unsigned long index);
      Object.defineProperty($TypedArray$.prototype, '_getter', {value: function(index) {
        if (arguments.length < 1) throw SyntaxError('Not enough arguments');
  
        index = ToUint32(index);
        if (index >= this.length)
          return undefined;
  
        var bytes = [], i, o;
        for (i = 0, o = this.byteOffset + index * this.BYTES_PER_ELEMENT;
             i < this.BYTES_PER_ELEMENT;
             i += 1, o += 1) {
          bytes.push(this.buffer._bytes[o]);
        }
        return this._unpack(bytes);
      }});
  
      // NONSTANDARD: convenience alias for getter: type get(unsigned long index);
      Object.defineProperty($TypedArray$.prototype, 'get', {value: $TypedArray$.prototype._getter});
  
      // WebIDL: setter void (unsigned long index, type value);
      Object.defineProperty($TypedArray$.prototype, '_setter', {value: function(index, value) {
        if (arguments.length < 2) throw SyntaxError('Not enough arguments');
  
        index = ToUint32(index);
        if (index >= this.length)
          return;
  
        var bytes = this._pack(value), i, o;
        for (i = 0, o = this.byteOffset + index * this.BYTES_PER_ELEMENT;
             i < this.BYTES_PER_ELEMENT;
             i += 1, o += 1) {
          this.buffer._bytes[o] = bytes[i];
        }
      }});
  
      // get %TypedArray%.prototype.buffer
      // get %TypedArray%.prototype.byteLength
      // get %TypedArray%.prototype.byteOffset
      // -- applied directly to the object in the constructor
  
      // %TypedArray%.prototype.constructor
      Object.defineProperty($TypedArray$.prototype, 'constructor', {value: $TypedArray$});
  
      // %TypedArray%.prototype.copyWithin (target, start, end = this.length )
      Object.defineProperty($TypedArray$.prototype, 'copyWithin', {value: function(target, start) {
        var end = arguments[2];
  
        var o = ToObject(this);
        var lenVal = o.length;
        var len = ToUint32(lenVal);
        len = max(len, 0);
        var relativeTarget = ToInt32(target);
        var to;
        if (relativeTarget < 0)
          to = max(len + relativeTarget, 0);
        else
          to = min(relativeTarget, len);
        var relativeStart = ToInt32(start);
        var from;
        if (relativeStart < 0)
          from = max(len + relativeStart, 0);
        else
          from = min(relativeStart, len);
        var relativeEnd;
        if (end === undefined)
          relativeEnd = len;
        else
          relativeEnd = ToInt32(end);
        var final;
        if (relativeEnd < 0)
          final = max(len + relativeEnd, 0);
        else
          final = min(relativeEnd, len);
        var count = min(final - from, len - to);
        var direction;
        if (from < to && to < from + count) {
          direction = -1;
          from = from + count - 1;
          to = to + count - 1;
        } else {
          direction = 1;
        }
        while (count > 0) {
          o._setter(to, o._getter(from));
          from = from + direction;
          to = to + direction;
          count = count - 1;
        }
        return o;
      }});
  
      // %TypedArray%.prototype.entries ( )
      // -- defined in es6.js to shim browsers w/ native TypedArrays
  
      // %TypedArray%.prototype.every ( callbackfn, thisArg = undefined )
      Object.defineProperty($TypedArray$.prototype, 'every', {value: function(callbackfn) {
        if (this === undefined || this === null) throw TypeError();
        var t = Object(this);
        var len = ToUint32(t.length);
        if (!IsCallable(callbackfn)) throw TypeError();
        var thisArg = arguments[1];
        for (var i = 0; i < len; i++) {
          if (!callbackfn.call(thisArg, t._getter(i), i, t))
            return false;
        }
        return true;
      }});
  
      // %TypedArray%.prototype.fill (value, start = 0, end = this.length )
      Object.defineProperty($TypedArray$.prototype, 'fill', {value: function(value) {
        var start = arguments[1],
            end = arguments[2];
  
        var o = ToObject(this);
        var lenVal = o.length;
        var len = ToUint32(lenVal);
        len = max(len, 0);
        var relativeStart = ToInt32(start);
        var k;
        if (relativeStart < 0)
          k = max((len + relativeStart), 0);
        else
          k = min(relativeStart, len);
        var relativeEnd;
        if (end === undefined)
          relativeEnd = len;
        else
          relativeEnd = ToInt32(end);
        var final;
        if (relativeEnd < 0)
          final = max((len + relativeEnd), 0);
        else
          final = min(relativeEnd, len);
        while (k < final) {
          o._setter(k, value);
          k += 1;
        }
        return o;
      }});
  
      // %TypedArray%.prototype.filter ( callbackfn, thisArg = undefined )
      Object.defineProperty($TypedArray$.prototype, 'filter', {value: function(callbackfn) {
        if (this === undefined || this === null) throw TypeError();
        var t = Object(this);
        var len = ToUint32(t.length);
        if (!IsCallable(callbackfn)) throw TypeError();
        var res = [];
        var thisp = arguments[1];
        for (var i = 0; i < len; i++) {
          var val = t._getter(i); // in case fun mutates this
          if (callbackfn.call(thisp, val, i, t))
            res.push(val);
        }
        return new this.constructor(res);
      }});
  
      // %TypedArray%.prototype.find (predicate, thisArg = undefined)
      Object.defineProperty($TypedArray$.prototype, 'find', {value: function(predicate) {
        var o = ToObject(this);
        var lenValue = o.length;
        var len = ToUint32(lenValue);
        if (!IsCallable(predicate)) throw TypeError();
        var t = arguments.length > 1 ? arguments[1] : undefined;
        var k = 0;
        while (k < len) {
          var kValue = o._getter(k);
          var testResult = predicate.call(t, kValue, k, o);
          if (Boolean(testResult))
            return kValue;
          ++k;
        }
        return undefined;
      }});
  
      // %TypedArray%.prototype.findIndex ( predicate, thisArg = undefined )
      Object.defineProperty($TypedArray$.prototype, 'findIndex', {value: function(predicate) {
        var o = ToObject(this);
        var lenValue = o.length;
        var len = ToUint32(lenValue);
        if (!IsCallable(predicate)) throw TypeError();
        var t = arguments.length > 1 ? arguments[1] : undefined;
        var k = 0;
        while (k < len) {
          var kValue = o._getter(k);
          var testResult = predicate.call(t, kValue, k, o);
          if (Boolean(testResult))
            return k;
          ++k;
        }
        return -1;
      }});
  
      // %TypedArray%.prototype.forEach ( callbackfn, thisArg = undefined )
      Object.defineProperty($TypedArray$.prototype, 'forEach', {value: function(callbackfn) {
        if (this === undefined || this === null) throw TypeError();
        var t = Object(this);
        var len = ToUint32(t.length);
        if (!IsCallable(callbackfn)) throw TypeError();
        var thisp = arguments[1];
        for (var i = 0; i < len; i++)
          callbackfn.call(thisp, t._getter(i), i, t);
      }});
  
      // %TypedArray%.prototype.indexOf (searchElement, fromIndex = 0 )
      Object.defineProperty($TypedArray$.prototype, 'indexOf', {value: function(searchElement) {
        if (this === undefined || this === null) throw TypeError();
        var t = Object(this);
        var len = ToUint32(t.length);
        if (len === 0) return -1;
        var n = 0;
        if (arguments.length > 0) {
          n = Number(arguments[1]);
          if (n !== n) {
            n = 0;
          } else if (n !== 0 && n !== (1 / 0) && n !== -(1 / 0)) {
            n = (n > 0 || -1) * floor(abs(n));
          }
        }
        if (n >= len) return -1;
        var k = n >= 0 ? n : max(len - abs(n), 0);
        for (; k < len; k++) {
          if (t._getter(k) === searchElement) {
            return k;
          }
        }
        return -1;
      }});
  
      // %TypedArray%.prototype.join ( separator )
      Object.defineProperty($TypedArray$.prototype, 'join', {value: function(separator) {
        if (this === undefined || this === null) throw TypeError();
        var t = Object(this);
        var len = ToUint32(t.length);
        var tmp = Array(len);
        for (var i = 0; i < len; ++i)
          tmp[i] = t._getter(i);
        return tmp.join(separator === undefined ? ',' : separator); // Hack for IE7
      }});
  
      // %TypedArray%.prototype.keys ( )
      // -- defined in es6.js to shim browsers w/ native TypedArrays
  
      // %TypedArray%.prototype.lastIndexOf ( searchElement, fromIndex = this.length-1 )
      Object.defineProperty($TypedArray$.prototype, 'lastIndexOf', {value: function(searchElement) {
        if (this === undefined || this === null) throw TypeError();
        var t = Object(this);
        var len = ToUint32(t.length);
        if (len === 0) return -1;
        var n = len;
        if (arguments.length > 1) {
          n = Number(arguments[1]);
          if (n !== n) {
            n = 0;
          } else if (n !== 0 && n !== (1 / 0) && n !== -(1 / 0)) {
            n = (n > 0 || -1) * floor(abs(n));
          }
        }
        var k = n >= 0 ? min(n, len - 1) : len - abs(n);
        for (; k >= 0; k--) {
          if (t._getter(k) === searchElement)
            return k;
        }
        return -1;
      }});
  
      // get %TypedArray%.prototype.length
      // -- applied directly to the object in the constructor
  
      // %TypedArray%.prototype.map ( callbackfn, thisArg = undefined )
      Object.defineProperty($TypedArray$.prototype, 'map', {value: function(callbackfn) {
        if (this === undefined || this === null) throw TypeError();
        var t = Object(this);
        var len = ToUint32(t.length);
        if (!IsCallable(callbackfn)) throw TypeError();
        var res = []; res.length = len;
        var thisp = arguments[1];
        for (var i = 0; i < len; i++)
          res[i] = callbackfn.call(thisp, t._getter(i), i, t);
        return new this.constructor(res);
      }});
  
      // %TypedArray%.prototype.reduce ( callbackfn [, initialValue] )
      Object.defineProperty($TypedArray$.prototype, 'reduce', {value: function(callbackfn) {
        if (this === undefined || this === null) throw TypeError();
        var t = Object(this);
        var len = ToUint32(t.length);
        if (!IsCallable(callbackfn)) throw TypeError();
        // no value to return if no initial value and an empty array
        if (len === 0 && arguments.length === 1) throw TypeError();
        var k = 0;
        var accumulator;
        if (arguments.length >= 2) {
          accumulator = arguments[1];
        } else {
          accumulator = t._getter(k++);
        }
        while (k < len) {
          accumulator = callbackfn.call(undefined, accumulator, t._getter(k), k, t);
          k++;
        }
        return accumulator;
      }});
  
      // %TypedArray%.prototype.reduceRight ( callbackfn [, initialValue] )
      Object.defineProperty($TypedArray$.prototype, 'reduceRight', {value: function(callbackfn) {
        if (this === undefined || this === null) throw TypeError();
        var t = Object(this);
        var len = ToUint32(t.length);
        if (!IsCallable(callbackfn)) throw TypeError();
        // no value to return if no initial value, empty array
        if (len === 0 && arguments.length === 1) throw TypeError();
        var k = len - 1;
        var accumulator;
        if (arguments.length >= 2) {
          accumulator = arguments[1];
        } else {
          accumulator = t._getter(k--);
        }
        while (k >= 0) {
          accumulator = callbackfn.call(undefined, accumulator, t._getter(k), k, t);
          k--;
        }
        return accumulator;
      }});
  
      // %TypedArray%.prototype.reverse ( )
      Object.defineProperty($TypedArray$.prototype, 'reverse', {value: function() {
        if (this === undefined || this === null) throw TypeError();
        var t = Object(this);
        var len = ToUint32(t.length);
        var half = floor(len / 2);
        for (var i = 0, j = len - 1; i < half; ++i, --j) {
          var tmp = t._getter(i);
          t._setter(i, t._getter(j));
          t._setter(j, tmp);
        }
        return t;
      }});
  
      // %TypedArray%.prototype.set(array, offset = 0 )
      // %TypedArray%.prototype.set(typedArray, offset = 0 )
      // WebIDL: void set(TypedArray array, optional unsigned long offset);
      // WebIDL: void set(sequence<type> array, optional unsigned long offset);
      Object.defineProperty($TypedArray$.prototype, 'set', {value: function(index, value) {
        if (arguments.length < 1) throw SyntaxError('Not enough arguments');
        var array, sequence, offset, len,
            i, s, d,
            byteOffset, byteLength, tmp;
  
        if (typeof arguments[0] === 'object' && arguments[0].constructor === this.constructor) {
          // void set(TypedArray array, optional unsigned long offset);
          array = arguments[0];
          offset = ToUint32(arguments[1]);
  
          if (offset + array.length > this.length) {
            throw RangeError('Offset plus length of array is out of range');
          }
  
          byteOffset = this.byteOffset + offset * this.BYTES_PER_ELEMENT;
          byteLength = array.length * this.BYTES_PER_ELEMENT;
  
          if (array.buffer === this.buffer) {
            tmp = [];
            for (i = 0, s = array.byteOffset; i < byteLength; i += 1, s += 1) {
              tmp[i] = array.buffer._bytes[s];
            }
            for (i = 0, d = byteOffset; i < byteLength; i += 1, d += 1) {
              this.buffer._bytes[d] = tmp[i];
            }
          } else {
            for (i = 0, s = array.byteOffset, d = byteOffset;
                 i < byteLength; i += 1, s += 1, d += 1) {
              this.buffer._bytes[d] = array.buffer._bytes[s];
            }
          }
        } else if (typeof arguments[0] === 'object' && typeof arguments[0].length !== 'undefined') {
          // void set(sequence<type> array, optional unsigned long offset);
          sequence = arguments[0];
          len = ToUint32(sequence.length);
          offset = ToUint32(arguments[1]);
  
          if (offset + len > this.length) {
            throw RangeError('Offset plus length of array is out of range');
          }
  
          for (i = 0; i < len; i += 1) {
            s = sequence[i];
            this._setter(offset + i, Number(s));
          }
        } else {
          throw TypeError('Unexpected argument type(s)');
        }
      }});
  
      // %TypedArray%.prototype.slice ( start, end )
      Object.defineProperty($TypedArray$.prototype, 'slice', {value: function(start, end) {
        var o = ToObject(this);
        var lenVal = o.length;
        var len = ToUint32(lenVal);
        var relativeStart = ToInt32(start);
        var k = (relativeStart < 0) ? max(len + relativeStart, 0) : min(relativeStart, len);
        var relativeEnd = (end === undefined) ? len : ToInt32(end);
        var final = (relativeEnd < 0) ? max(len + relativeEnd, 0) : min(relativeEnd, len);
        var count = final - k;
        var c = o.constructor;
        var a = new c(count);
        var n = 0;
        while (k < final) {
          var kValue = o._getter(k);
          a._setter(n, kValue);
          ++k;
          ++n;
        }
        return a;
      }});
  
      // %TypedArray%.prototype.some ( callbackfn, thisArg = undefined )
      Object.defineProperty($TypedArray$.prototype, 'some', {value: function(callbackfn) {
        if (this === undefined || this === null) throw TypeError();
        var t = Object(this);
        var len = ToUint32(t.length);
        if (!IsCallable(callbackfn)) throw TypeError();
        var thisp = arguments[1];
        for (var i = 0; i < len; i++) {
          if (callbackfn.call(thisp, t._getter(i), i, t)) {
            return true;
          }
        }
        return false;
      }});
  
      // %TypedArray%.prototype.sort ( comparefn )
      Object.defineProperty($TypedArray$.prototype, 'sort', {value: function(comparefn) {
        if (this === undefined || this === null) throw TypeError();
        var t = Object(this);
        var len = ToUint32(t.length);
        var tmp = Array(len);
        for (var i = 0; i < len; ++i)
          tmp[i] = t._getter(i);
        function sortCompare(x, y) {
          if (x !== x && y !== y) return +0;
          if (x !== x) return 1;
          if (y !== y) return -1;
          if (comparefn !== undefined) {
            return comparefn(x, y);
          }
          if (x < y) return -1;
          if (x > y) return 1;
          return +0;
        }
        tmp.sort(sortCompare);
        for (i = 0; i < len; ++i)
          t._setter(i, tmp[i]);
        return t;
      }});
  
      // %TypedArray%.prototype.subarray(begin = 0, end = this.length )
      // WebIDL: TypedArray subarray(long begin, optional long end);
      Object.defineProperty($TypedArray$.prototype, 'subarray', {value: function(start, end) {
        function clamp(v, min, max) { return v < min ? min : v > max ? max : v; }
  
        start = ToInt32(start);
        end = ToInt32(end);
  
        if (arguments.length < 1) { start = 0; }
        if (arguments.length < 2) { end = this.length; }
  
        if (start < 0) { start = this.length + start; }
        if (end < 0) { end = this.length + end; }
  
        start = clamp(start, 0, this.length);
        end = clamp(end, 0, this.length);
  
        var len = end - start;
        if (len < 0) {
          len = 0;
        }
  
        return new this.constructor(
          this.buffer, this.byteOffset + start * this.BYTES_PER_ELEMENT, len);
      }});
  
      // %TypedArray%.prototype.toLocaleString ( )
      // %TypedArray%.prototype.toString ( )
      // %TypedArray%.prototype.values ( )
      // %TypedArray%.prototype [ @@iterator ] ( )
      // get %TypedArray%.prototype [ @@toStringTag ]
      // -- defined in es6.js to shim browsers w/ native TypedArrays
  
      function makeTypedArray(elementSize, pack, unpack) {
        // Each TypedArray type requires a distinct constructor instance with
        // identical logic, which this produces.
        var TypedArray = function() {
          Object.defineProperty(this, 'constructor', {value: TypedArray});
          $TypedArray$.apply(this, arguments);
          makeArrayAccessors(this);
        };
        if ('__proto__' in TypedArray) {
          TypedArray.__proto__ = $TypedArray$;
        } else {
          TypedArray.from = $TypedArray$.from;
          TypedArray.of = $TypedArray$.of;
        }
  
        TypedArray.BYTES_PER_ELEMENT = elementSize;
  
        var TypedArrayPrototype = function() {};
        TypedArrayPrototype.prototype = $TypedArrayPrototype$;
  
        TypedArray.prototype = new TypedArrayPrototype();
  
        Object.defineProperty(TypedArray.prototype, 'BYTES_PER_ELEMENT', {value: elementSize});
        Object.defineProperty(TypedArray.prototype, '_pack', {value: pack});
        Object.defineProperty(TypedArray.prototype, '_unpack', {value: unpack});
  
        return TypedArray;
      }
  
      var Int8Array = makeTypedArray(1, packI8, unpackI8);
      var Uint8Array = makeTypedArray(1, packU8, unpackU8);
      var Uint8ClampedArray = makeTypedArray(1, packU8Clamped, unpackU8);
      var Int16Array = makeTypedArray(2, packI16, unpackI16);
      var Uint16Array = makeTypedArray(2, packU16, unpackU16);
      var Int32Array = makeTypedArray(4, packI32, unpackI32);
      var Uint32Array = makeTypedArray(4, packU32, unpackU32);
      var Float32Array = makeTypedArray(4, packF32, unpackF32);
      var Float64Array = makeTypedArray(8, packF64, unpackF64);
  
      global.Int8Array = global.Int8Array || Int8Array;
      global.Uint8Array = global.Uint8Array || Uint8Array;
      global.Uint8ClampedArray = global.Uint8ClampedArray || Uint8ClampedArray;
      global.Int16Array = global.Int16Array || Int16Array;
      global.Uint16Array = global.Uint16Array || Uint16Array;
      global.Int32Array = global.Int32Array || Int32Array;
      global.Uint32Array = global.Uint32Array || Uint32Array;
      global.Float32Array = global.Float32Array || Float32Array;
      global.Float64Array = global.Float64Array || Float64Array;
    }());
  
    //
    // 6 The DataView View Type
    //
  
    (function() {
      function r(array, index) {
        return IsCallable(array.get) ? array.get(index) : array[index];
      }
  
      var IS_BIG_ENDIAN = (function() {
        var u16array = new Uint16Array([0x1234]),
            u8array = new Uint8Array(u16array.buffer);
        return r(u8array, 0) === 0x12;
      }());
  
      // DataView(buffer, byteOffset=0, byteLength=undefined)
      // WebIDL: Constructor(ArrayBuffer buffer,
      //                     optional unsigned long byteOffset,
      //                     optional unsigned long byteLength)
      function DataView(buffer, byteOffset, byteLength) {
        if (!(buffer instanceof ArrayBuffer || Class(buffer) === 'ArrayBuffer')) throw TypeError();
  
        byteOffset = ToUint32(byteOffset);
        if (byteOffset > buffer.byteLength)
          throw RangeError('byteOffset out of range');
  
        if (byteLength === undefined)
          byteLength = buffer.byteLength - byteOffset;
        else
          byteLength = ToUint32(byteLength);
  
        if ((byteOffset + byteLength) > buffer.byteLength)
          throw RangeError('byteOffset and length reference an area beyond the end of the buffer');
  
        Object.defineProperty(this, 'buffer', {value: buffer});
        Object.defineProperty(this, 'byteLength', {value: byteLength});
        Object.defineProperty(this, 'byteOffset', {value: byteOffset});
      };
  
      // get DataView.prototype.buffer
      // get DataView.prototype.byteLength
      // get DataView.prototype.byteOffset
      // -- applied directly to instances by the constructor
  
      function makeGetter(arrayType) {
        return function GetViewValue(byteOffset, littleEndian) {
          byteOffset = ToUint32(byteOffset);
  
          if (byteOffset + arrayType.BYTES_PER_ELEMENT > this.byteLength)
            throw RangeError('Array index out of range');
  
          byteOffset += this.byteOffset;
  
          var uint8Array = new Uint8Array(this.buffer, byteOffset, arrayType.BYTES_PER_ELEMENT),
              bytes = [];
          for (var i = 0; i < arrayType.BYTES_PER_ELEMENT; i += 1)
            bytes.push(r(uint8Array, i));
  
          if (Boolean(littleEndian) === Boolean(IS_BIG_ENDIAN))
            bytes.reverse();
  
          return r(new arrayType(new Uint8Array(bytes).buffer), 0);
        };
      }
  
      Object.defineProperty(DataView.prototype, 'getUint8', {value: makeGetter(Uint8Array)});
      Object.defineProperty(DataView.prototype, 'getInt8', {value: makeGetter(Int8Array)});
      Object.defineProperty(DataView.prototype, 'getUint16', {value: makeGetter(Uint16Array)});
      Object.defineProperty(DataView.prototype, 'getInt16', {value: makeGetter(Int16Array)});
      Object.defineProperty(DataView.prototype, 'getUint32', {value: makeGetter(Uint32Array)});
      Object.defineProperty(DataView.prototype, 'getInt32', {value: makeGetter(Int32Array)});
      Object.defineProperty(DataView.prototype, 'getFloat32', {value: makeGetter(Float32Array)});
      Object.defineProperty(DataView.prototype, 'getFloat64', {value: makeGetter(Float64Array)});
  
      function makeSetter(arrayType) {
        return function SetViewValue(byteOffset, value, littleEndian) {
          byteOffset = ToUint32(byteOffset);
          if (byteOffset + arrayType.BYTES_PER_ELEMENT > this.byteLength)
            throw RangeError('Array index out of range');
  
          // Get bytes
          var typeArray = new arrayType([value]),
              byteArray = new Uint8Array(typeArray.buffer),
              bytes = [], i, byteView;
  
          for (i = 0; i < arrayType.BYTES_PER_ELEMENT; i += 1)
            bytes.push(r(byteArray, i));
  
          // Flip if necessary
          if (Boolean(littleEndian) === Boolean(IS_BIG_ENDIAN))
            bytes.reverse();
  
          // Write them
          byteView = new Uint8Array(this.buffer, byteOffset, arrayType.BYTES_PER_ELEMENT);
          byteView.set(bytes);
        };
      }
  
      Object.defineProperty(DataView.prototype, 'setUint8', {value: makeSetter(Uint8Array)});
      Object.defineProperty(DataView.prototype, 'setInt8', {value: makeSetter(Int8Array)});
      Object.defineProperty(DataView.prototype, 'setUint16', {value: makeSetter(Uint16Array)});
      Object.defineProperty(DataView.prototype, 'setInt16', {value: makeSetter(Int16Array)});
      Object.defineProperty(DataView.prototype, 'setUint32', {value: makeSetter(Uint32Array)});
      Object.defineProperty(DataView.prototype, 'setInt32', {value: makeSetter(Int32Array)});
      Object.defineProperty(DataView.prototype, 'setFloat32', {value: makeSetter(Float32Array)});
      Object.defineProperty(DataView.prototype, 'setFloat64', {value: makeSetter(Float64Array)});
  
      global.DataView = global.DataView || DataView;
  
    }());
  
  }(self));
  /* Blob.js
 * A Blob implementation.
 * 2018-01-12
 *
 * By Eli Grey, http://eligrey.com
 * By Devin Samarin, https://github.com/dsamarin
 * License: MIT
 *   See https://github.com/eligrey/Blob.js/blob/master/LICENSE.md
 */

/*global self, unescape */
/*jslint bitwise: true, regexp: true, confusion: true, es5: true, vars: true, white: true,
  plusplus: true */

/*! @source http://purl.eligrey.com/github/Blob.js/blob/master/Blob.js */

(function (view) {
	"use strict";

	view.URL = view.URL || view.webkitURL;

	if (view.Blob && view.URL) {
		try {
			new Blob;
			return;
		} catch (e) {}
	}

	// Internally we use a BlobBuilder implementation to base Blob off of
	// in order to support older browsers that only have BlobBuilder
	var BlobBuilder = view.BlobBuilder || view.WebKitBlobBuilder || view.MozBlobBuilder || (function(view) {
		var
			  get_class = function(object) {
				return Object.prototype.toString.call(object).match(/^\[object\s(.*)\]$/)[1];
			}
			, FakeBlobBuilder = function BlobBuilder() {
				this.data = [];
			}
			, FakeBlob = function Blob(data, type, encoding) {
				this.data = data;
				this.size = data.length;
				this.type = type;
				this.encoding = encoding;
			}
			, FBB_proto = FakeBlobBuilder.prototype
			, FB_proto = FakeBlob.prototype
			, FileReaderSync = view.FileReaderSync
			, FileException = function(type) {
				this.code = this[this.name = type];
			}
			, file_ex_codes = (
				  "NOT_FOUND_ERR SECURITY_ERR ABORT_ERR NOT_READABLE_ERR ENCODING_ERR "
				+ "NO_MODIFICATION_ALLOWED_ERR INVALID_STATE_ERR SYNTAX_ERR"
			).split(" ")
			, file_ex_code = file_ex_codes.length
			, real_URL = view.URL || view.webkitURL || view
			, real_create_object_URL = real_URL.createObjectURL
			, real_revoke_object_URL = real_URL.revokeObjectURL
			, URL = real_URL
			, btoa = view.btoa
			, atob = view.atob

			, ArrayBuffer = view.ArrayBuffer
			, Uint8Array = view.Uint8Array

			, origin = /^[\w-]+:\/*\[?[\w\.:-]+\]?(?::[0-9]+)?/
		;
		FakeBlob.fake = FB_proto.fake = true;
		while (file_ex_code--) {
			FileException.prototype[file_ex_codes[file_ex_code]] = file_ex_code + 1;
		}
		// Polyfill URL
		if (!real_URL.createObjectURL) {
			URL = view.URL = function(uri) {
				var
					  uri_info = document.createElementNS("http://www.w3.org/1999/xhtml", "a")
					, uri_origin
				;
				uri_info.href = uri;
				if (!("origin" in uri_info)) {
					if (uri_info.protocol.toLowerCase() === "data:") {
						uri_info.origin = null;
					} else {
						uri_origin = uri.match(origin);
						uri_info.origin = uri_origin && uri_origin[1];
					}
				}
				return uri_info;
			};
		}
		URL.createObjectURL = function(blob) {
			var
				  type = blob.type
				, data_URI_header
			;
			if (type === null) {
				type = "application/octet-stream";
			}
			if (blob instanceof FakeBlob) {
				data_URI_header = "data:" + type;
				if (blob.encoding === "base64") {
					return data_URI_header + ";base64," + blob.data;
				} else if (blob.encoding === "URI") {
					return data_URI_header + "," + decodeURIComponent(blob.data);
				} if (btoa) {
					return data_URI_header + ";base64," + btoa(blob.data);
				} else {
					return data_URI_header + "," + encodeURIComponent(blob.data);
				}
			} else if (real_create_object_URL) {
				return real_create_object_URL.call(real_URL, blob);
			}
		};
		URL.revokeObjectURL = function(object_URL) {
			if (object_URL.substring(0, 5) !== "data:" && real_revoke_object_URL) {
				real_revoke_object_URL.call(real_URL, object_URL);
			}
		};
		FBB_proto.append = function(data/*, endings*/) {
			var bb = this.data;
			// decode data to a binary string
			if (Uint8Array && (data instanceof ArrayBuffer || data instanceof Uint8Array)) {
				var
					  str = ""
					, buf = new Uint8Array(data)
					, i = 0
					, buf_len = buf.length
				;
				for (; i < buf_len; i++) {
					str += String.fromCharCode(buf[i]);
				}
				bb.push(str);
			} else if (get_class(data) === "Blob" || get_class(data) === "File") {
				if (FileReaderSync) {
					var fr = new FileReaderSync;
					bb.push(fr.readAsBinaryString(data));
				} else {
					// async FileReader won't work as BlobBuilder is sync
					throw new FileException("NOT_READABLE_ERR");
				}
			} else if (data instanceof FakeBlob) {
				if (data.encoding === "base64" && atob) {
					bb.push(atob(data.data));
				} else if (data.encoding === "URI") {
					bb.push(decodeURIComponent(data.data));
				} else if (data.encoding === "raw") {
					bb.push(data.data);
				}
			} else {
				if (typeof data !== "string") {
					data += ""; // convert unsupported types to strings
				}
				// decode UTF-16 to binary string
				bb.push(unescape(encodeURIComponent(data)));
			}
		};
		FBB_proto.getBlob = function(type) {
			if (!arguments.length) {
				type = null;
			}
			return new FakeBlob(this.data.join(""), type, "raw");
		};
		FBB_proto.toString = function() {
			return "[object BlobBuilder]";
		};
		FB_proto.slice = function(start, end, type) {
			var args = arguments.length;
			if (args < 3) {
				type = null;
			}
			return new FakeBlob(
				  this.data.slice(start, args > 1 ? end : this.data.length)
				, type
				, this.encoding
			);
		};
		FB_proto.toString = function() {
			return "[object Blob]";
		};
		FB_proto.close = function() {
			this.size = 0;
			delete this.data;
		};
		return FakeBlobBuilder;
	}(view));

	view.Blob = function(blobParts, options) {
		var type = options ? (options.type || "") : "";
		var builder = new BlobBuilder();
		if (blobParts) {
			for (var i = 0, len = blobParts.length; i < len; i++) {
				if (Uint8Array && blobParts[i] instanceof Uint8Array) {
					builder.append(blobParts[i].buffer);
				}
				else {
					builder.append(blobParts[i]);
				}
			}
		}
		var blob = builder.getBlob(type);
		if (!blob.slice && blob.webkitSlice) {
			blob.slice = blob.webkitSlice;
		}
		return blob;
	};

	var getPrototypeOf = Object.getPrototypeOf || function(object) {
		return object.__proto__;
	};
	view.Blob.prototype = getPrototypeOf(new view.Blob());
}(
	   typeof self !== "undefined" && self
	|| typeof window !== "undefined" && window
	|| this
));

/**
 * ## jexjs javascript library <br />
 *
 * @class jexjs
 */
var jexjs = {
    version : "0.1.90",
    name : 'jexjs'
};

// 전역 객체로 선언
window.jexjs = jexjs;
window.jj = window.jexjs;

/**
 * 전역 설정을 저장하기 위한 변수
 *
 * @property jexjs.global
 * @type {Object}
 */
jexjs.global = {};

/**
 * 플러그인 설정을 저장하기 위한 변수
 * @property jexjs.global.plugins
 * @type {Object}
 */
jexjs.global.plugins = {};

 /************************************************************************************
 * String 객체를 확장한다.
 * @class String
 ************************************************************************************/
/**
 * Usage : "".startsWith("st") <br />
 * 문자열이 "st"로 시작할 경우 true, 그렇지 않을 경우 false를 리턴한다.
 *
 * @method startsWith
 * @param {String} str
 * @return {Boolean} {str}로 시작할 경우 true, 그렇지 않을 경우 false
 */
if (typeof String.prototype.startsWith !== 'function') {
    String.prototype.startsWith = function(str) {
        return new RegExp("^" + str).test(this);
    };
}

/**
 * Usage : "".endsWith("st") <br />
 * 문자열이 "st"로 끝나는 경우 경우 true, 그렇지 않을 경우 false를 리턴한다.
 *
 * @method endsWith
 * @param {String} str
 * @return {Boolean} {str}로 끝나는 경우 true, 그렇지 않을 경우 false
 */
if (typeof String.prototype.endsWith !== 'function') {
    String.prototype.endsWith = function(str) {
        return new RegExp(str + "$").test(this);
    };
}

jexjs.isString = function( stringData ) {
    if ( "string" == typeof stringData ) {
        return true;
    }
    return false;
};

/**
 * @method trim
 * @param {String} data 좌우 공백을 제거하기 위한 문자열
 * @return {String}
 */
jexjs.trim = function(data) {
    if (data && typeof data.trim === 'function') {
        return data.trim();
    }

    return data;
};

/************************************************************************************
 * Date 객체를 확장한다.
 * @class Date
 ************************************************************************************/

/**
 * 날짜 및 시간을 특정 형태로 변환해준다. <br />
 * <table>
 *     <tr><td colspan="3" style="text-align:center;">ex) 2009년 7월 4일 15시 3분 55초</td></tr>
 *     <tr style="text-align:center;">
 *         <td>패턴</td>
 *         <td>설명</td>
 *         <td>결과</td>
 *     </tr>
 *     <tr><td>YYYY(yyyy)</td><td>년</td><td>2009</td></tr>
 *     <tr><td>YY(yy)</td><td>년</td><td>09</td></tr>
 *     <tr><td>Y(y)</td><td>년</td><td>9</td></tr>
 *     <tr><td>MM</td><td>월</td><td>07</td></tr>
 *     <tr><td>M</td><td>월</td><td>7</td></tr>
 *     <tr><td>dd</td><td>일</td><td>04</td></tr>
 *     <tr><td>d</td><td>일</td><td>4</td></tr>
 *     <tr><td>HH</td><td>시간 (00~23)</td><td>08</td></tr>
 *     <tr><td>H</td><td>시간 (0~23)</td><td>8</td></tr>
 *     <tr><td>hh</td><td>시간 (00 01 02 ... 11, 12 01 02 ... 11)</td><td>15</td></tr>
 *     <tr><td>h</td><td>시간 (0 1 2 ... 11, 12 1 2 ... 11)</td><td>3</td></tr>
 *     <tr><td>mm</td><td>분</td><td>03</td></tr>
 *     <tr><td>m</td><td>분</td><td>3</td></tr>
 *     <tr><td>ss</td><td>초</td><td>55</td></tr>
 *     <tr><td>s</td><td>초</td><td>55</td></tr>
 *     <tr><td>A</td><td>AM; PM</td><td>PM</td></tr>
 *     <tr><td>a</td><td>am; pm</td><td>pm</td></tr>
 *     <tr><td>AA(aa)</td><td>오전; 오후</td><td>오후</td></tr>
 * </table>
 *
 * @method format
 * @param {String} pattern
 * @returns {String}
 * @example
 *      var date = new Date(2014, 9-1, 5, 14, 2, 44);
 *      date.format("yyyy-MM-dd hh:mm:ss"); // --> 2014-09-05 02:02:44
 *      date.format("yyyy년"); // --> 2014년
 *      date.format("dd/MM/yy"); // --> 05/09/14
 *      date.format("aa h시"); // --> 오후 2시
 */
Date.prototype.format = function(pattern) {
    if (typeof pattern !== 'string') {        return pattern;     }

    var year = null,
        month = null,
        day = null,
        hour = null,
        minute = null,
        second = null,
        am_pm = null
        ;

    // year
    if (/yyyy/.test(pattern) || /YYYY/.test(pattern)) {
        year = this.getFullYear();

        pattern = pattern.replace(/yyyy/g, year);
        pattern = pattern.replace(/YYYY/g, year);
    }

    // year
    if (/yy/.test(pattern) || /YY/.test(pattern)) {
        year = (this.getFullYear() + "").substring(2);

        pattern = pattern.replace(/yy/g, year);
        pattern = pattern.replace(/YY/g, year);
    }

    // year
    if (/y/.test(pattern) || /Y/.test(pattern)) {
        year = parseInt((this.getFullYear() + "").substring(2), 10);
        pattern = pattern.replace(/y/g, year);
        pattern = pattern.replace(/Y/g, year);
    }

    // month
    if (/MM/.test(pattern)) {
        month = this.getMonth() + 1;

        if (month < 10) {
            month = "0" + month;
        }

        pattern = pattern.replace(/MM/g, month);
    }

    // month
    if (/M/.test(pattern)) {
        month = this.getMonth() + 1;
        pattern = pattern.replace(/M/g, month);
    }

    // day
    if (/dd/.test(pattern)) {
        day = this.getDate();

        if (day < 10) {
            day = "0" + day;
        }

        pattern = pattern.replace(/dd/g, day);
    }

    // day
    if (/d/.test(pattern)) {
        day = this.getDate();
        pattern = pattern.replace(/d/g, day);
    }

    // hour : 0 ~ 23
    if (/HH/.test(pattern)) {
        hour = this.getHours();

        if (hour < 10) {
            hour = "0" + hour;
        }

        pattern = pattern.replace(/HH/g, hour);
    }

    // hour : 0 ~ 23
    if (/H/.test(pattern)) {
        hour = this.getHours();
        pattern = pattern.replace(/H/g, hour);
    }

    // hour (am)00 01 02 ... 11, (pm)12 01 02 03 ... 11
    if (/hh/.test(pattern)) {
        hour = this.getHours();
        if (hour > 12) {
            hour = hour - 12;
        }

        if (hour < 10) {
            hour = "0" + hour;
        }

        pattern = pattern.replace(/hh/g, hour);
    }

    // hour (am)0 1 2 ... 11, (pm)12 1 2 3 ... 11
    if (/h/.test(pattern)) {
        hour = this.getHours();
        if (hour > 12) {
            hour = hour - 12;
        }
        pattern = pattern.replace(/h/g, hour);
    }

    // minute
    if (/mm/.test(pattern)) {
        minute = this.getMinutes();
        if (minute < 10) {
            minute = "0" + minute;
        }

        pattern = pattern.replace(/mm/g, minute);
    }

    // minute
    if (/m/.test(pattern)) {
        minute = this.getMinutes();
        pattern = pattern.replace(/m/g, minute);
    }

    // second
    if (/ss/.test(pattern)) {
        second = this.getSeconds();
        if (second < 10) {
            second = "0" + second;
        }

        pattern = pattern.replace(/ss/g, second);
    }

    if (/s/.test(pattern)) {
        second = this.getSeconds();
        pattern = pattern.replace(/s/g, second);
    }

    // 오전, 오후
    if (/aa/.test(pattern) || /AA/.test(pattern)) {
        am_pm = (this.getHours() < 12)? "오전": "오후";
        pattern = pattern.replace(/aa/g, am_pm);
        pattern = pattern.replace(/AA/g, am_pm);
    }

    // am, pm
    if (/A/.test(pattern)) {
        am_pm = (this.getHours() < 12)? "AM": "PM";
        pattern = pattern.replace(/A/g, am_pm);
    }

    // am, pm
    if (/a/.test(pattern)) {
        am_pm = (this.getHours() < 12)? "am": "pm";
        pattern = pattern.replace(/a/g, am_pm);
    }


    return pattern;
};

/**
 *
 * @method format
 * @param {String} pattern
 * @param {Date} date 없을 경우 현재 시간을 기준으로 생성
 * @returns {String}
 * @static
 * @example
 *      var now = Date.format("yyyyMMdd"); // --> 20140925
 *      var now = Date.format("yyyyMMdd", new Date(2014, 9, 25)); // --> 20140925
 */
Date.format = function(pattern, date) {
    if (date instanceof Date) {
        return date.format(pattern);
    } else {
        return new Date().format(pattern);
    }
};

var JexDateUtil = {
	DAYS_OF_MONTH : [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
};

/**
 * 해당월의 시작요일을 반환한다.
 * 0 : 일요일 ~ 6 : 토요일
 * @param year
 * @param month
 * @return day
 */
JexDateUtil.getFirstDayOfMonth = function (year, month) {
	return new Date(year, month-1,1).getDay();
};

/**
 * 해당월의 마지막 일을 반환한다.
 * 
 * @param year
 * @param month
 * @return last day ex) 28,29,30,31
 * 
 */
JexDateUtil.getLastDayOfMonth = function (year, month) {
	var day = null;
	if ( 2 === month && ( 0 === year%4 && (0 !== year%100 || 0 === year%400) ) ) {
		return 29;
	} else {
		return JexDateUtil.DAYS_OF_MONTH(month-1);
	}
};
 
/************************************************************************************
 * Array 관련 함수
 ************************************************************************************/
if (typeof Array.prototype.jexPushByIndex !== 'function') {
    Array.prototype.jexPushByIndex = function( _data, _idx ) {
        var idx = _idx | this.length;
        
        if( undefined === _idx || null === _idx ){
            this.push( _data );
        }else{
            if ( _idx > this.length ){
                this.push( _data );
            }else{
                this.splice( _idx, 0, _data);
            }
        }
        return this.length;
    };
}

/**
 * 해당 객체가 Array 타입인지에 대한 검사를 수행한다.
 *
 * @method isArray
 * @param {Object} obj Array 타입의 객체인지 확인하고 싶은 객체
 * @return {Boolean}
 */
jexjs.isArray = function(obj) {
    if (typeof Array.isArray === 'function') {
        return Array.isArray(obj);
    }

    if (this.type(obj) === 'Array') {
        return true;
    }

    return false;
};

/**
 * Array 루프를 돌려준다. callback 함수 내에서 this로 value scope를 넘겨준다.
 *
 * @method forEach
 * @param {Array} arr 반복문을 돌릴 배열
 * @param {Function } fn 사용자 정의 함수
 * <br />
 *
 * <h4>callback 파라미터</h4>
 * <table>
 *     <tr>
 *         <td>index</td><td>Number</td><td>배열 인덱스</td>
 *     </tr>
 *     <tr>
 *         <td>value</td><td>{ Object }</td><td>배열 값</td>
 *     </tr>
 * </table>
 *
 * @example
 *      jexjs.forEach( [ 1, 2, 3 ], function( index, value ) { ... } );
 */
jexjs.forEach = function ( arr, fn ) {
    if ( jexjs.isArray(arr) ) {
        for (var i = 0; i < arr.length; i++) {
            var value = arr[i];

            var result = fn.apply(value, [i, value]);

            if (typeof result === 'boolean' && !result) {
                break;
            }
        }
    } else {
        jexjs.warn('jexjs.forEach : Array 타입만 사용할 수 있습니다. arr : ' + typeof arr);
    }
};

/**
 * 해당 객체가 Array 타입인지에 대한 검사를 수행한다.
 *
 * @method isArray
 * @param {Object} obj Array 타입의 객체인지 확인하고 싶은 객체
 * @return {Boolean}
 */
jexjs.isArray = function(obj) {
    if (typeof Array.isArray === 'function') {
        return Array.isArray(obj);
    }

    if (this.type(obj) === 'Array') {
        return true;
    }

    return false;
};

/************************************************************************************
 * JexUtil
 ************************************************************************************/
jexjs._isProjectScope = function(){
    if ( window.jexFrame ) {
        return false;
    }
    return true;
};

jexjs._isJQueryObject = function( jqueryObj ) {
    return jqueryObj instanceof jQuery;
};

/** 
 * Dom Element를 반환합니다.
 * String, HTMLElement 객체를 모두 HTML Element로 변환해줍니다.
 */
jexjs._getHtmlElement = function( unknownElement, scope ) {
    if( jexjs.isNull(scope) ) {
        scope = window;
    }
    if ( jexjs.isString( unknownElement ) ) {
        return scope.document.getElementById( unknownElement );
    } else {
        return unknownElement;
    }
};

/**
 * @param elem elementId or element 객체
 * @return elementId;
 */
jexjs._getElementId = function( elem ) {
    if( jexjs.isHtmlElement( elem ) ){
        return elem.getAttribute("id");
    } else {
        return elem;
    }
};

/* jexjs 하위 함수 호출 */
jexjs._callAllIframeFunction = function( fnName ){
    if ( jexjs.hasIframe() ) {
        var maxFrameLength = window.frames.length;
        var frm = null;
        for(var i=0; i < maxFrameLength; i++ ) {
            frm = window.frames[i];
            if( frm.jexjs && frm.jexjs._isProjectScope() ) {
                jexjs.debug("    jexjs : "+ fnName +" childFrmae["+i+"] call" );
                frm.jexjs[fnName].apply(null, Array.prototype.slice.call(arguments, 1) );
            }
        }
    }
};

jexjs.isHtmlElement = function( element ) {
    //ie8 이상인경우
    if ( "undefined" !== typeof HTMLElement) {    
        return element instanceof HTMLElement;
    } else if ( element.nodeType && element.nodeType === 1) {
        return true;
    } else {
        return false;
    }
};

jexjs.isCanvasElement = function ( canvasElem ) {
    return canvasElem instanceof HTMLCanvasElement;
};

jexjs.hasIframe = function(){
    if ( 0 < window.frames.length ) {
        return true;
    }
    return false;
};

jexjs.isFunction = function( func ){
    if ( "function" == typeof func ){
        return true;
    }
    return false;
};

/**
 * target 객체를 확장한다.
 *
 * 
 * @method extend
 * @param {Object} target 확장하고자 하는 object
 * @param {Object} obj {key:value, key:value, ...}
 * @returns {Object}
 * @example
 *      var my_target = {};
 *      jexjs.extend(my_target, {'id': 'jexjs', 'name': 'jexscript'});
 */

/**
 * target 객체를 확장한다. <br />
 * 기본적으로 확장하고자 하는 모든 값을 target에 설정한다. (deep = true) <br />
 * target에 존재하는 키 값에 대해서만 확장을 하려면 (deep = false)로 설정한다. <br />
 *
 * @method extend
 * @param {Object} target 확장하고자 하는 object
 * @param {String} key
 * @param {Object} value 2번째 파라미터가 object라면 {Boolean} _deep default : true
 * @param {Boolean} _deep default : true
 * @returns {Object}
 * @example
 *      var my_target = {};
 *      jexjs.extend(my_target, 'id', 'jexjs');
 */
jexjs.extend = function(target, key, value, _deep) {
    if ( jexjs.isNull(target) ) {      target = {};   }
    if ( jexjs.isNull(key) )    {      return target;  }

    var deep = true;

    if ( typeof key === 'object' ) {
        if ( typeof value === 'boolean' && value === false ) {
            deep = false;
        }

        for ( var k in key ) {
            jexjs._extendFromKeyValue(target, k, key[k], deep);
        }
    } else if ( typeof key === 'string' ) {
        if ( typeof _deep === 'boolean' && _deep === false ) {
            deep = false;
        }

        jexjs._extendFromKeyValue(target, key, value, deep);
    }

    return target;
};

jexjs._extendFromKeyValue = function(target, key, value, deep) {
    if ( typeof target[key] == 'undefined' && !deep ) {
        return target;
    }

    if ( jexjs.isArray(value) ) {
        target[key] = jexjs.cloneArray(value);
    } else if ( "function" == typeof value ) {
        target[key] = value;
    } else if ( jexjs.isHtmlElement( value ) ) {
        target[key] = value;
    } 
    else if ( typeof value === 'object' && null !== value ) {
        if ( typeof target[key] !== 'object' ) {
            target[key] = {};
        }

        for (var j in value ) {
            jexjs.extend(target[key], j, value[j], deep);
        }
    } else {
        target[key] = value;
    }

    return target;
};

/**
 * data를 복사한 객체를 리턴한다.
 *
 * @method clone
 * @param {Object} data
 * @returns {Object}
 * @example
 *      var clonedData = jexjs.clone(originalData);
 */
jexjs.clone = function( data ) {
    if (jexjs.isArray(data)) {
        return jexjs.cloneArray(data);
    } else {
        var cloned = {};
        jexjs.extend(cloned, data);

        return cloned;
    }
};

/**
 * Array를 복제한다. 내부에 object를 데이터로 갖고 있을 경우, object copy도 수행한다.
 * @param {Array} arr
 * @returns {Array}
 * @example
 *      var clonedArr = jexjs.cloneArray(['1', '2', { id: 'hi' }]);
 */
jexjs.cloneArray = function( arr ) {
    if ( !jexjs.isArray(arr) ) {
        return arr;
    }

    var clonedArr = arr.slice(0);

    jexjs.forEach(clonedArr, function(i, v) {
        if ( jexjs.isArray(v) ) {
            clonedArr[i] = jexjs.cloneArray(v);
        } else if ( typeof v === 'object' ) {
            clonedArr[i] = jexjs.clone(v);
        }
    });
    return clonedArr;
};

/**
 * @method parseJSON
 * @param {String} data JSON 형태를 갖춘 문자열 데이터
 * @return {Object}
 */
jexjs.parseJSON = function( data ) {
    if (typeof data === 'string') {
        return JSON.parse( data );
    }

    return data;
};

/**
 * 해당 문자열이 json 형태인지 확인
 *
 * @method isJSONExp
 * @param {String} data json 형태임을 확인하고 싶은 문자열
 * @return {Boolean}
 */
jexjs.isJSONExp = function(data) {
    if (typeof data !== 'string') {
        return false;
    }
    return /(^{[^}]+})|^\[[^\]]+\](\})$/.test(data);
};

jexjs._hasJSONField = function ( data, field ) {
    if ( typeof data[ field ] === "undefined") {
        return false;
    }
    return true;
};

/**
 * JSON 객체에 해당 필드가 존재하는지 여부를 check 합니다.
 * 
 * @method hasJSONField
 * @param {JSON} data
 * @param {String} or {Array} field
 * @return {Boolean}
 */
jexjs.hasJSONField = function( data, field ) {
    if ( typeof field  === "string") {
        return jexjs._hasJSONField( data, field );
    } else if ( jexjs.isArray( field ) ) {
        var hasField = false, f;
        for( var i =0; i < field.length; i++) {
            f = field[i];
            if ( !jexjs._hasJSONField( data, f) ) {
                return false;
            }
        }
        return true;
    }
};


/**
 * @method isNull
 * @param {data} Object null 여부를 확인하고 싶은 객체
 * @return {Boolean}
 */
jexjs.isNull = function(data) {
    if (data === null || data === undefined) {
        return true;
    }

    return false;
};


/**
 * @method empty
 * @param {data} 값이 비어있는지 여부를 확인하고 싶은 객체
 * @return {Boolean}
 */
jexjs.empty = function(data) {

    if ( data === null || data === undefined ) {
        return true;
    } else if ( typeof data === 'string' && jexjs.trim(data) === '' ) {
        return true;
    } else if ( jexjs.isArray(data) && typeof data[0] === 'undefined' ) {
        return true;
    } else if ( typeof data === 'object') {
        var count = 0;

        for ( var i in data ) {
            count++;
        }

        if ( count === 0 ) {
            return true;
        }
    }

    return false;
};

/**
 * 
 * @method null2Void
 * @param {data} 문자열 data
 * @return {String} 값이 null인 경우에는 ""를 반환하며, 그렇지 않은 경우에는 입력받은 값 그대로 반환한다.
 */
jexjs.null2Void = function(data){
	return jexjs.isNull(data)? "" : data;
};

/**
 * @method type
 * @param {obj} Object 타입을 알고 싶은 객체
 * @return {String} javascript 식별 가능한 형태의 객체 문자열을 리턴한다. <br />
 * 					[ Undefined Null Array RegExp String Number Boolean Function Object Date Error ]
 */
jexjs.type = function(obj) {
    return Object.prototype.toString.call(obj).match(/^\[object\s(.*)\]$/)[1];
};

/**
 * parameter string을 만들어준다.
 * @param {JSONObject} params 
 * @example jexjs.param({{
            "key1":"val1",
            "key2":"val2",
            "key3":"val3"
        }}) => "key1=val1&key2=val2&key3=value3"
 */
jexjs.param = function(params) {
    var paramString = "";
    var cnt = 0, value = null;
    for (var key in params ) {
        if ( cnt !== 0 ) {
            paramString = paramString.concat("&");
        }
        value = (jexjs.empty(params[key])? "" : params[key]);
        paramString = paramString.concat( key );
        paramString = paramString.concat("=");
        paramString = paramString.concat( encodeURIComponent( value ));
        cnt++;
    }
    return paramString;
};

/************************************************************************************
 * Jex Cookie
 ************************************************************************************/
jexjs.cookie = {};

jexjs.cookie.option = {
		expires : 365*10,
    	path	 : "/",
    	prefix  : ''
};

jexjs.cookieSetup = function( settings ) {
	jexjs.extend(jexjs.cookie.option, settings );
};
/**
 * cookie 정보를 저장한다.
 * @method set
  * @param {String} cookieName
  * @param {String} cookieValue
  * @param {JSONObject} option
  * @example jexjs.cookie.set("USER_ID", "testid", { expires : 5 , path : "/" });
 */
jexjs.cookie.set = function( cookieName, cookieValue, option ) {
	var name = jexjs.cookie.option.prefix + cookieName;
	var d = new Date();
	if(3 == arguments.length && typeof option === "object"){
		jexjs.extend(jexjs.cookie.option, option);
	}
	d.setDate( d.getDate() + jexjs.cookie.option.expires );
	document.cookie = name + "=" + encodeURIComponent(cookieValue) + "; path="+jexjs.cookie.option.path+"; expires=" + d.toGMTString() + ";";
};

 /**
 * cookie 정보를 불러온다.
 * @method get
 * @param {String} cookieName
 * @returns {String} cookieValue
 * @example cookie.get("USER_ID");
 */
jexjs.cookie.get = function( cookieName ) {
	var name = jexjs.cookie.option.prefix + cookieName + "=";
	var ca = document.cookie.split(';');
	for(var i=0; i<ca.length; i++) {
	    var c = ca[i];
	    while (c.charAt(0)==' ') c = c.substring(1);
	    if (c.indexOf(name) != -1) return decodeURIComponent(c.substring(name.length, c.length));
	}
	return "";
};

/**
* cookie 값을 삭제합니다.
* @param {Object} cookieName
*/
jexjs.cookie.remove = function(cookieName) {
	var name = jexjs.cookie.option.prefix + cookieName;
	jexjs.cookie.set( name, "" , { expires : -1 } );
};

 /************************************************************************************
 * Jex Storage
 ************************************************************************************/
if ( typeof Storage == "undefined" ){
    jexjs.error("storage 가 지원되지 않는 browser 입니다.");
} else{
 jexjs.sessionStorage = {};
 jexjs.localStorage = {};
  /**
  * sessionStroage에 저장합니다.
  */
 jexjs.sessionStorage.set = function( key, value ) {
     var input = value;
     
     if ( !jexjs.isNull( input )) {
         if ( "string" != typeof input && jexjs.isJSONExp( JSON.stringify( input ) ) ) { //JSON
             input = JSON.stringify( input );
         } else if( jexjs.isArray(input) ){  //Array
             input = JSON.stringify( input );
         } 
         input = encodeURIComponent( input );
     }
     sessionStorage.setItem( key, input );
 };
 /**
  * sessionStroage 값을 가져옵니다.
  */
 jexjs.sessionStorage.get = function( key ) {
     var result = sessionStorage.getItem(key);
     if ( !jexjs.isNull(result) ) {
         result = decodeURIComponent( result );
         
         if ( jexjs.isJSONExp( result ) ) {
             return jexjs.parseJSON ( result );
         }else {
             try {
                 var tmpResult = jexjs.parseJSON ( result );
                 if ( jexjs.isArray(tmpResult) ){
                     return tmpResult;
                 }
             }catch(e){
             }
         }
     }
     return result;
 };
/**
 * sessionStorage 값을 삭제합니다.
 */
 jexjs.sessionStorage.remove =  function( key ) {
     sessionStorage.removeItem( key );
 };

  /**
  * localStorage 저장합니다.
  */
 jexjs.localStorage.set = function( key, value ) {
     var input = value;
     if ( !jexjs.isNull( input )) {
         if ( "string" != typeof value && jexjs.isJSONExp( JSON.stringify( input ) ) ) { //JSON
             input = JSON.stringify( input );
         } else if( jexjs.isArray(input) ){  //Array
             input = JSON.stringify( input );
         } 
         input = encodeURIComponent( input );
     }
     localStorage.setItem( key, input );
 };
 /**
  * localStorage 값을 가져옵니다.
  */
 jexjs.localStorage.get = function( key ) {
     var result = localStorage.getItem(key);
     if ( !jexjs.isNull(result) ) {
         result = decodeURIComponent( result );
         if ( jexjs.isJSONExp( result ) ) {
             return jexjs.parseJSON ( result);
         }else {
             try {
                 var tmpResult = jexjs.parseJSON ( result );
                 if ( jexjs.isArray(tmpResult) ){
                     return tmpResult;
                 }
             }catch(e){
                 
             }
         }
     }
     return result;
 };
/**
 * localStorage 값을 삭제합니다.
 */
 jexjs.localStorage.remove =  function( key ) {
     localStorage.removeItem( key );
 };
}

/************************************************************************************
 * Jex File Util
 ************************************************************************************/
/**
 * dataUrl -> Blob로 변경
 */
jexjs.dataURLtoBlob = function ( dataURL ) {
    
    var byteString = atob(dataURL.split(',')[1]);

    var mimeString = dataURL.split(',')[0].split(':')[1].split(';')[0];

    var ab = new ArrayBuffer(byteString.length);
    var ia = new Uint8Array(ab);
    for ( var i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }

    return new Blob( [ia], { type: mimeString });
};

jexjs.isBlob = function( blobData ) {
    return window.Blob && "[object Blob]" === Object.prototype.toString.call(maybeBlob);
};

jexjs.isFile = function( fileData ) {
    return window.File && "[object File]" === Object.prototype.toString.call(maybeFile);
};

jexjs.isFileList = function( fileList ) {
    return window.File && "[object FileList]" === Object.prototype.toString.call(maybeFile);
};

/************************************************************************************
 * Jex Event Util
 ************************************************************************************/
jexjs.event = {
    //Event 추가
    attach : function( element , type, myHandler ) {
        if ( element.addEventListener ) {                // For IE8 이하버전 이외의 모든 브라우져
			element.addEventListener( type, myHandler, false );
		} else if ( element.attachEvent ) {              // For IE 8 and earlier versions
			element.attachEvent("on" + type , myHandler );
		} else {
			element["on"+type] = myHandler;
		}
    },
    //Event 삭제
    detach : function( element, type, myHandler ) {
        if ( element.removeEventListener ) {                  // For IE8 이하버전 이외의 모든 브라우져
            element.removeEventListener(type, myHandler, false);
        } else if ( element.detachEvent ) {                     // For IE 8 and earlier versions
            element.detachEvent("on"+type, myHandler);
        } else {
        	element["on"+type] = null;
         }
    },
    preventDefault : function(e){
        if (e.preventDefault) {
            e.preventDefault();
        } else {
            e.returnValue = false;
        }
    },
    stopPropagation : function(e){
        if ( e.stopPropagation ) {
            e.stopPropagation();
        } else {
            e.cancelBubble = true;
        }
    },
    getEvent : function( event ){
    	return event ? event : window.event;
    },
    getTarget : function( event ){
    	return event.target || event.srcElement;
    },
    getRelatedTarget : function ( event ) {
    	if ( event.relatedTarget ) {
    		return event.relatedTarget;
    	} else if ( event.toElement ) {
    		return event.toElement;
    	} else if( event.fromElement ) {
    		return event.fromElement;
    	} else {
    		return null;
    	}
    },
    getButton : function( event ) {
    	if ( document.implementation.hasFeature("MouseEvents","2.0") ) {
    		return event.button;
    	} else {
    		switch( event.button ) {
    		case 0:
    		case 1:
    		case 3:
    		case 5:
    		case 7:
    			return 0;
    		case 2:
    		case 6:
    			return 2;
    		case 4:
    			return 1;
    		}
    	}
    } 
};

/************************************************************************************
 * Jex Event Util
 ************************************************************************************/
jexjs.cssUtil = {
    getComputedStyle: function( elem, prop ) {
        if (window.getComputedStyle && window.getComputedStyle(elem, null)) {
            return window.getComputedStyle(elem, null).getPropertyValue(prop);
        } else {
            return elem.style[prop];
        }
    }
};
/**
 * logger 정보를 저장하기 위한 변수
 * @property jexjs.global.logger.level
 * @type {String}
 * @default "off"
 * off, error, warn, info, debug
 * off : 출력안함
 * error : javascript exception 발생시킴
 * debug : 
 */
jexjs.global.logger = {
    _ENUM_LEVEL : ['OFF','ERROR','WARN','INFO','DEBUG'],
    level:1
};

/**
 * debug 모드로 작동할 지에 대한 설정 <br />
 * url?jex_debug=true 로 debug 모드를 작동시킬 수 있다.
 *
 * @property jexjs.global.debug
 * @type {boolean}
 * @default false
 */
jexjs.global.debug = false;

/**
 * @method error
 * @param {String} msg 메시지
 * @return {Error} 에러를 발생한다.
 */
jexjs.error = function(msg) {
    jexjs.logger.error(msg);
};

/**
 * @method warn
 * @param {String} msg 메시지
 */
jexjs.warn = function(message) {
    jexjs.logger.warn(message);
};

/**
 * @method info
 * @param {String} msg 메시지
 */
jexjs.info = function(message) {
    jexjs.logger.info(message);
};

/**
 * @method debug
 * @param {String} msg 메시지
 */
jexjs.debug = function(message) {
    jexjs.logger.debug(message);
};


/**
 * URL query string의 내용을 caching해 놓기위한 객체
 * @readOnly
 */
jexjs.global._url_parameter = {};

/**
 * parameter는 onload 시 URL의 query string을 기본으로 파라미터를 설정한다.
 * 등록된 parameter가 있을 경우 key 값에 해당하는 데이터를 리턴한다.
 *
 * @method getParameter
 * @param {String} key
 * @return {String}
 */
jexjs.getParameter = function(key) {
    return jexjs.global._url_parameter[key];
};

/**
 * parameter는 onload 시 URL의 query string을 기본으로 파라미터를 설정한다.
 * 등록된 parameter object를 리턴한다.
 *
 * @method getParameterMap
 * @return {Object}
 */
jexjs.getParameterMap = function() {
    return jexjs.global._url_parameter;
};

// parsing URL query string
// URL에 존재하는 파라미터 값을 설정한다.
(function() {
    var queryString = window.location ? window.location.search : "";

    if (queryString.indexOf("?") > -1) {
        var startIndex = queryString.indexOf("?") + 1,
            endIndex = queryString.indexOf("#")
            ;

        queryString = (endIndex > -1) ?
            queryString.substring(startIndex, endIndex) :
            queryString.substring(startIndex);

        var queryArray = queryString.split("&");
        for (var i = 0; i < queryArray.length; i++) {
            var keyValue = queryArray[i].split("="),
                key = keyValue[0],
                value;

            if (keyValue.length === 1) {
                value = "";
            } else {
                value = keyValue[1];
            }

            jexjs.global._url_parameter[key] = decodeURIComponent(value);
        }
    }
})();

/**
 * 로그레벨을 설정합니다. 
 * @param enumLevel 'OFF','ERROR','WARN','INFO','DEBUG'
 */
jexjs.setLogLevel = function( enumLevel ){
    var globalLogger = jexjs.global.logger;
    enumLevel = enumLevel.toUpperCase();
    var level = globalLogger._ENUM_LEVEL.indexOf( enumLevel );
    if ( -1 < level ) {
        globalLogger.level = level;
    }
};

/**
 * 현재의 로그레벨을 반환합니다.
 */
jexjs.getLogLevel = function(){
    var globalLogger = jexjs.global.logger;
    return globalLogger._ENUM_LEVEL[ globalLogger.level ];
};

//사용하지 말것!! 호환성위해 남겨둠
// set debug = true if parameter 'jex_debug' exists 
(function() {
    var debug = jexjs.getParameter("jex_debug");
    if ("boolean" == typeof debug ) {
        if(debug) {
            jexjs.global.logger.level = 4;
        }
    }
})();

// set debug logLevel
(function() {
    var level = jexjs.getParameter("jex_logger_level");
    if ( "string" == typeof level ) {
        jexjs.setLogLevel(level);
    }
})();


/**
 * 사용하지 말것!!!! 호환성유지를 위해 남겨둔다. 
 * debug 사용여부를 설정한다.
 * @method setDebug
 * @param {Boolean} true or false
 * @example
 *      jexjs.setDebug(true);
 */
jexjs.setDebug = function( isDebug ) {
    var globalLogger = jexjs.global.logger;
    if ( isDebug ){
        globalLogger.level = 4;
    } else {
        globalLogger.level = 1;
    }
};
/**
 * 사용하지 말것!!!! 호환성유지를 위해 남겨둔다. 
 */
jexjs.isDebug = function() {
    var globalLogger = jexjs.global.logger;
    
    if ( 4 == globalLogger.level ) {
        return true;
    } else {
        return false;
    }    
};

/**
 * 사용하지 말것!!!! 호환성유지를 위해 남겨둔다. 
 */
jexjs.log = function(message) {
    jexjs.logger.debug(message);
};
/**
 * 사용자에게 알림창을 띄운다.
 *
 * @method alert
 * @param {String} message 옵션. 안내 메시지
 * @example
 *      jexjs.alert("잘못된 정보입니다.");
 */
jexjs.alert = function(message) {
    alert(message);
};

/**
 * 사용자로부터 Ok, Cancel 중 하나를 입력받을 수 있는 창을 띄운다.
 *
 * @method confirm
 * @param {String} message 옵션. 안내 메시지
 * @returns {Boolean}
 * @example
 *      var doSave = jexjs.confirm("저장하시겠습니까?");
 */
jexjs.confirm = function(message) {
    return confirm(message);
};

/**
 * 사용자로부터 값을 입력받을 수 있는 창을 띄운다.
 *
 * @method prompt
 * @param {String} message 안내 메시지.
 * @param {String} text 옵션. 기본 입력 값을 설정할 수 있다.
 * @returns {String}
 * @example
 *      var userInput = jexjs.prompt("아이디를 입력해주세요.", "hello@gmail.com");
 */
jexjs.prompt = function(message, text) {
    return prompt(message, text);
};

jexjs.getCode = function(group, key) {
    return jexjs.plugin('code_manager').getCode(group, key);
};

jexjs.getSimpleCode = function(group, key) {
    return jexjs.plugin('code_manager').getSimpleCode(group, key);
};

/**
 * {{#crossLink "jexjs.plugins/require:method"}}{{/crossLink}} 함수를 이용하여 플러그인을 생성한다. <br />
 *
 * @example
 *      var myPlugin = jexjs.plugin('myPlugin', 'param1', 'param2', ...);
 *
 *
 * @method plugin
 * @param {String} key 등록된 plugin key
 * @returns {Object}
 *
 */
jexjs.plugin = function(key) {
    return jexjs.plugins.require.apply(this, arguments);
};

/**
 * jexjs가 선언되어있는 최상위 window를 (parent, opener) 가져옵니다.
 * @method getRoot
 * @returns {window} 최상위 window
 * @example
 *      var root_jexjs = jexjs.getRoot();
 */
jexjs.getRoot = function(p,b){
	
	if(jexjs.isNull(p)) {
		p = (jexjs.isNull(opener))? parent:opener;
		if(jexjs.isNull(p)) {
		    p = window;
		}
		b = window;
	}
	try {
	    if(!p.jexjs) return b;
    } catch ( e ) {
        return b;
    }

	if( p === b ) return b;
	else return jexjs.getRoot(p.parent,p);
};

/**
 * @method getOpener
 * @returns {window}
 * @example
 *      jexjs.getOpener();
 */
jexjs.getOpener = function(){
	return ( jexjs.isNull(opener) ) ? parent : opener;
};

/**
 * jexjs가 선언되어있는 최상위 parent window를 가져옵니다.
 * @method getRootParent
 * @returns {window} 최상위 parent window
 * @example jexjs.getRootParent();
 */
jexjs.getRootParent = function(p,b){
	
	if(jexjs.isNull(p) && jexjs.isNull(b)) {
		p = parent;
		b = window;
		if(jexjs.isNull(p)) {
			p = window;
		}
	}
	try {
	    if(!p.jexjs) return b;
    } catch ( e ) {
        return b;
    }

	if( p === b ) return b;
	else return jexjs.getRootParent(p.parent,p);
};

/**
 * 브라우져 정보와 버전을 확인하기 위해 사용
 */
jexjs.global._navigator = window.navigator;

jexjs.getBrowser = function( customUserAgent ){
	
	if ( !customUserAgent ) customUserAgent = jexjs.global._navigator.userAgent.toLowerCase();
	else customUserAgent = customUserAgent.toLowerCase();
    var version = "";
    var chooseBrowser = null;
    var browser = {
            'msie': false,
            'chrome': false,
            'firefox': false,
            'safari': false,
            'opera' : false,
            'version':''
    };
    
    var matchs = customUserAgent.match(/(opera|chrome|safari|firefox|msie|trident(?=\/))[\/]?\s*([\d.]+)/i) || [];
	
    //해당 브라우져만 true 설정
	for(var b in browser){
		if ( b === matchs[1] ) {
			browser[b] = true;
			chooseBrowser = b;
		}
	}
	
	//MSIE값보다 trident 버전이 더 높은경우 trident값을 따름.
	if( /msie/i.test( matchs[1]) ){
		//IE - 'MSIE' 형식이 아닌경우
		var trident =  /\btrident(?=\/)[\/]?\s*([\d.]+)/g.exec(customUserAgent) || [];
		if ( chooseBrowser )	browser[ chooseBrowser ] = false;
		browser.msie = true;
		browser.version = ( parseFloat(matchs[2]) < ( parseFloat(trident[1]) + 4 ) ? parseFloat(trident[1]) + 4 : matchs[2] );
		return browser;
	}
	//IE - 'MSIE' 형식이 아닌경우
	else if(/trident/i.test(matchs[1]) ){
		var rv =  /\brv[ :]+([\d.]+)/g.exec(customUserAgent) || [];
		if ( chooseBrowser )	browser[ chooseBrowser ] = false;
		browser.msie = true;
		browser.version = rv[1] || '';
		return browser;
	}//opera user agent에 firefox가 포함된 경우
	else if( matchs[1] === 'firefox' ){
		version = customUserAgent.match(/\bopera[\/ ]?([\d.]+)/);
        
        if( null !== version ) {
        	if ( chooseBrowser )	browser[ chooseBrowser ] = false;
        	browser.opera = true;
        	browser.version = version[1];
        	return browser;
         }
	}
	
	browser.version = ( matchs[2] ? matchs[2] : navigator.appVersion );
	if((version = customUserAgent.match(/version\/([\d.]+)/i))!== null) {
		browser.version = version[1];
	}
	
    return browser;
};

//보안문제로 https 인경우만 가능
jexjs.getGeolocation = function( callback ) {
    if ( "geolocation" in jexjs.global._navigator) {
        var geolocation = jexjs.global._navigator.geolocation;
        geolocation.getCurrentPosition( function( position ){
            var geo = {
                    'latitude' : position.coords.latitude,
                    'longitude' : position.coords.longitude  
            };
            callback.call( undefined, geo);
        });
         
    } else {
         callback.call(undefined, {} );
    }
};

jexjs._isJexMobile = function() {
    return false;
};

/**
 * TODO TEMP
 * jQquery의 기능을 임시로 사용하기 위해 만듦.
 * 추후에 구현예정 
 */
jexjs.$ = jQuery;


/**
 * logger <br />
 * jexjs.isDebug() === true 일 때에만 로그를 출력한다.
 *
 *
 * TODO
 * 현재 isDebug 에 대한 체크로만 로깅을 진행하는데
 *  # hash 값을 통해서 console, html logger를 변경하거나 하는 등의 내용에 대해서
 *  좀 더 고민해봐야한다.
 *
 *
 * @class jexjs.logger
 */

(function() {

    if (typeof console === 'undefined' || !console) {    console = {};    }
    if (typeof console.log === 'undefined') {
        console.log = function(message) {};
    }
    // level : off, error, warn, info, debug
    
    var ConsoleLogger = function(){
        
        var globalLogger = jexjs.global.logger;
        
        function _getLevelNumber(){
            return globalLogger.level;
        }
        
        function _print( message ){
            if ( jexjs._isJexMobile() ){
                if ( jexjs.isEmulator() ){
                    console.log(message);
                }
            } else {
                console.log(message);
            }
        }
        
        return {
            error: function(message) {
                if ( 0 < _getLevelNumber() ){
                    throw new Error(message);
                }
            },
            warn : function(message) {
                if ( 1 < _getLevelNumber() ) {
                    _print(message);
                }
            },
            info : function(message) {
                if ( 2 < _getLevelNumber() ) {
                    _print(message);
                }
            },
            debug: function(message) {
                if ( 3 < _getLevelNumber() ) {
                    _print(message);
                }
            }
        };
    };
    
    var HtmlLogger = function() {

        /**
         * div #jexjs-logger
         *      div .jexjs-logger-badge
         *      div .jexjs-logger-console
         *          ul
         *              li .jexjs-logger-console-line
         */
        var id = "jexjs-logger",
            classBadge = "jexjs-logger-badge",
            classConsole = "jexjs-logger-console",
            classConsoleLine = "jexjs-logger-console-line",

            classDisplayNone = "jexjs-hide" // core css display:none
        ;
        var globalLogger = jexjs.global.logger;

        var $logger = jexjs.$("#" + id);
        if ($logger.length === 0) {
            var html = '<div id="' + id + '">' +
                '<div class="' + classBadge + '"></div>' +
                '<div class="' + classConsole + ' ' + classDisplayNone + '">' +
                    '<ul></ul>' +
                '</div>' +
            '</div>'
            ;

            $logger = jexjs.$(html).appendTo("body");
        }

        var $console = $logger.find('.' + classConsole),
            $ul = $console.find("ul");

        $logger.find('.' + classBadge).on('click', function() {
            if ($console.css('display') === "none") {
                $console.removeClass('jexjs-hide');
            } else {
                $console.addClass('jexjs-hide');
            }
        });

        function _getLevelNumber(){
            return globalLogger.level;
        }
        
        function appendLine(message) {
            message = 'jexjs : ' + message;
            jexjs.$('<li class="' + classConsoleLine + '">' + message + '</li>').appendTo($ul);
        }

        return {
            error: function(message) {
                if ( 0 < _getLevelNumber() ){
                    throw new Error(message);
                }
            },
            warn : function(message) {
                if ( 1 < _getLevelNumber() ) {
                    appendLine(message);
                }
            },
            info : function(message) {
                if ( 2 < _getLevelNumber() ) {
                    appendLine(message);
                }
            },
            debug: function(message) {
                if ( 3 < _getLevelNumber() ) {
                    appendLine(message);
                }
            }
        };
    };

    if (jexjs.getParameter("jex_logger") !== "html") {
        jexjs.logger = new ConsoleLogger();
    } else {
        jexjs.logger = new HtmlLogger();
    }
})();

jexjs.debug("[init] loading jexjs modules");


/**
 * event <br />
 *
 * jexjs에서 실제로 event가 발생하지 않도록, 
 * @class Loader
 */
(function() {
    
    var Loader = function(){
        
        var _beforeOnload = [],
            _afterOnload = [],
            _beforeReload = [],
            _afterReload = [];
        
        var _pageLoader = [];
        
        function _reload (){

            var i,max;
            
            for (i=0, max = _beforeReload.length; i < max; i++) {
                _beforeReload[i]();
            }
            
            for(i=0; i < _pageLoader.length; i++){
                if ( "function" == typeof _pageLoader[i].reload ){
                    _pageLoader[i].reload();
                }
            }
            
            for(i=0, max = _afterReload.length; i < max; i++ ){
                _afterReload[i]();
            }
        }
        
        return {
            pushInstance : function( pageLoader ){
                _pageLoader.push( pageLoader );
            },
            getInstance : function(){
                return _pageLoader;
            },
            reload : function(){
                _reload();
            },
            addBeforeOnload : function( _fn, _index ){
                var idx = _index | _beforeOnload.length;
                if ("function" == typeof _fn ) {
                   _beforeOnload.jexPushByIndex( _fn, _index );
                }else{
                    jexjs.error("jexjs loader : addBeforeOnload [error] : function만 event에 추가할 수 있습니다.");
                }
            },
            getBeforeOnload : function(){
                return _beforeOnload;
            },
            addAfterOnload : function( _fn, _index ){
                var idx = _index | _afterOnload.length;
                if ("function" == typeof _fn ) {
                   _afterOnload.jexPushByIndex( _fn, _index );
                }else{
                    jexjs.error("jexjs loader : addAfterOnload [error] : function만 event에 추가할 수 있습니다.");
                }
            },
            getAfterOnload : function(){
                return _afterOnload;
            },
            addBeforeReload : function(_fn, _index) {
                var idx = _index | _beforeReload.length;
                if ("function" == typeof _fn) {
                    _beforeReload.jexPushByIndex(_fn, _index);
                } else {
                    jexjs.error("jexjs loader : addBeforeReload [error] : function만 event에 추가할 수 있습니다.");
                }
            },
            getBeforeReload : function() {
                return _beforeReload;
            },
            addAfterReload : function(_fn, _index) {
                var idx = _index | _afterReload.length;
                if ("function" == typeof _fn) {
                    _afterReload.jexPushByIndex(_fn, _index);
                } else {
                    jexjs.error("jexjs loader : addAfterReload [error] : function만 event에 추가할 수 있습니다.");
                }
            },
            getAfterReload : function() {
                return _afterReload;
            }
        };
    };
    jexjs.loader = new Loader();
})();
/**
 * 플러그인 등록 및 생성을 도와준다.
 *
 * @class jexjs.plugins
 * @static
 */
jexjs.plugins = {
    _plugins : {},

    /**
     * 플러그인 등록을 위한 함수 <br />
     * Class 에는 function() { } 원형을 추가해야 하며, init 함수를 반드시 포함해야한다. <br />
     * init 함수는 n개의 파라미터를 받도록 정의할 수 있고, jexjs.plugins.require('key', 'param1', 'param2', ...) 처럼 <br />
     * 2번째 이후의 모든 파라미터를 init 함수로 넘겨준다. <br />
     *  function init(param1, param2, ...) {   ... } <br />
     *
     *
     * @example
     *      객체를 리턴함으로써 특정 메소드만 public 메소드로써 생성하는 방법
     *      jexjs.plugins.define('test_plugin', function() {
     *          return {
     *              init: function(my_param, param2) {
     *                  ...
     *              }
     *          };
     *      });
     *
     * @example
     *      function() { }을 생성한 후 prototype을 통해 함수를 정의하고 등록하는 방법
     *      var myPlugin = function() { };
     *      myPlugin.prototype.init = function() { ... };
     *
     *      jexjs.plugins.define('test_plugin', myPlugin);
     *
     * @example
     *      의존성 플러그인을 함께 선언하는 방법
     *      jexjs.plugins.define('test_plugin', [ 'dep', 'mod', 'reg' ], function(dep, mode, reg) {
     *          ...
     *      });
     *
     *
     * @method define
     * @param {String} key
     * @param {Array: key} _dependencies 옵션값. 의존 플러그인이 있을 경우에 사용 할 수 있다.
     * @param {Class} _Class
     */
    define : function(key, _dependencies, _Class, isStatic){
        var dependencies, Class;
        var global = jexjs.global.plugins[key]   = {};

        if (jexjs.isArray(_dependencies)) {
            dependencies = _dependencies;
            Class = _Class;
            global.isStatic = !!isStatic;
        } else {
            Class = _dependencies;
            global.isStatic = _Class;
        }

        global.dependencies = jexjs.clone(dependencies) || [];
        jexjs.plugins._plugins[key] = Class;
        jexjs.debug("  [plugin] define '" + key + "'");
    },

    /**
     * 등록된 플러그인을 생성해준다. <br />
     * {{#crossLink " jexjs/plugin:method"}}{{/crossLink}} 함수를 이용하여 생성할 수도 있다. <br />
     *
     * @example
     *      var pluginObject = jexjs.plugins.require('test_plugin', 'param1', 'param2');
     *      pluginObject.myMethod();
     *
     *
     * @method require
     * @param {String} key
     * @returns {Object} plugin object
     */
    require : function(key) {
        var args = Array.prototype.slice.call(arguments, 1);

        var Plugin = jexjs.plugins._plugins[key];

        if (jexjs.isNull(Plugin)) {
            jexjs.error("jexjs.plugins." + key + " is not defined.");
        }

        var global = jexjs.global.plugins[key];

        if (global.isStatic && global.instance) {
            return global.instance;
        }

        var dependencies = global.dependencies,
            dependencyPlugins = [];

        for (var i = 0; i < dependencies.length; i++) {
            var dependency = jexjs.plugins.require(dependencies[i]);
            dependencyPlugins.push(dependency);
        }

        //var plugin = new Plugin();
        var plugin = Object.create(Plugin.prototype);
        var publicScope = Plugin.apply(plugin, dependencyPlugins);

        if (typeof publicScope.init === 'function') {
            //publicScope.init.apply( this , args);
            publicScope.init.apply( publicScope , args);
        }

        if (global.isStatic) {
            global.instance = publicScope;
        }

        return publicScope;
    }
};




/* ==================================================================================
 * ajax 통신을 수행한다.
 *
 * - dependency
 *      jQuery.ajax
 *
 * 기존 버전 호환을 위해서 .createAjaxUtil(url) 함수를 유지한다.
 * 
 * ajax -> success -> filter -> filter의 true, false 에 따라 업무 success, error 함수 호출
 *      -> error -> ajax 호출시 error 함수 구현되어있지 않으면, 공통 error Function, 있으면 업무 error 함수 호출
 * 
 * ================================================================================== */
jexjs.plugins.define('ajax', function() {
    var
        // ajax 통신 시 전달할 파라미터를 저장한다.
        _parameter = {},

        // 사용자 정의 callback
        _callback = {
            success: null,
            error: null
        },

        _global     = jexjs.global.plugins.ajax,

        url         = "",
        context_path = _global.contextPath || "",
        url_prefix  = _global.prefix || "",
        url_suffix  = _global.suffix || ".jct",
        filters     = _global.filters || [],
        filter      = true,
        beforeExecutes = _global.beforeExecutes || [];
    
        if( _global.callback ) jexjs.extend( _callback , _global.callback );
    
    var indicator = _global.indicator || jexjs.plugin('indicator', { modal: true });

    var option = {
            userData : false
    };
    
    // ajax 통신에 필요한 설정 기본값
    var settings = {
        type: "POST",
        url: "",
        data: {},
        cache: false,
        headers: {
            "cache-control": "no-cache",
            "pragma": "no-cache"
        }
    };

    jexjs.extend(settings, _global.settings);
    
    var jexExecutor = {
        execute: function(settings, _parameter, option ) {
            if ( option.userData ){
                for(var key in _parameter){
                    settings.data[key] = _parameter[key];
                }
            }else {
                settings.data = {
                    "_JSON_": encodeURIComponent(JSON.stringify(_parameter))
                };
            }
            
            if ( settings.delay && typeof settings.delay == "number"){
                var delay = settings.delay;
                delete settings.delay;
                setTimeout(function(){
                    jQuery.ajax(settings);
                },delay);
            } else {
                jQuery.ajax(settings);
            } 
        }
    };
    
    var _jexExecutor = _global.executor || jexExecutor;
    
    if ( 0 < beforeExecutes.length ){
        _jexExecutor.beforeExecutes = beforeExecutes;
    }
    
    function _execute() {
        
        _beforeExecute();
        
        var pSettings = jexjs.clone( settings );
        
        if ( _jexExecutor.beforeExecutes && 0 < _jexExecutor.beforeExecutes.length ) {
            for(var i=0; i < _jexExecutor.beforeExecutes.length; i++) {
                pSettings = _jexExecutor.beforeExecutes[i](pSettings);
            }
        }
        
        jexjs.extend( settings, pSettings );
        
        _jexExecutor.execute(settings, _parameter, option );
    }

    function _getUrl ( context_path , url_prefix,  url, url_suffix){
        
        var fullUrl = context_path + url_prefix;
        
        if ( -1 == url.indexOf(".jct") ){
            fullUrl += url + url_suffix;
        } else {
            fullUrl += url;
        }
        fullUrl = fullUrl.replace( /\/\//g, "/");
        return fullUrl;
    }
    
    function _beforeExecute() {
        settings.success    = _jQueryAjaxSuccess;
        settings.error      = _jQueryAjaxError;
        settings.url        = _getUrl( context_path , url_prefix , url , url_suffix );

        _showIndicator();
    }

    function _jQueryAjaxSuccess(data,textStatus, jqXHR) {
        var result = data;
        if (typeof result === 'string' && jexjs.isJSONExp(result)) {
            result = jexjs.parseJSON(result);
        }

        //jqXHR.getAllResponseHeaders();  jqXHR.getResponseHeader("date")

        jexjs.debug('    jexjs.plugin.ajax : ' + settings.url + ' 호출 성공');

        if ( _checkFilter(result,jqXHR) ) {
            if (typeof _callback.success === "function") {
                _callback.success(result,jqXHR);
            }
        } else {
            _jQueryAjaxError(result,jqXHR);
        }

        _complete();
    }

    function _checkFilter(result) {
        if (!filter) {
            return true;
        }

        var filterResult = true;
        for (var i = 0, length = filters.length; i < length; i++) {
            jexjs.debug('    jexjs.plugin.ajax : ' + ( i + 1) + ' filter start');
            var doNext = filters[i](result);

            if (typeof doNext === 'boolean' && !doNext) {
                filterResult = false;
                jexjs.debug('    jexjs.plugin.ajax : ' + ( i + 1) + ' filter failed');
                jexjs.debug(result);
                break;
            }

            if (i === length -1) {
                jexjs.debug('    jexjs.plugin.ajax : all filter passed.');
            }
        }

        return filterResult;
    }

    function _jQueryAjaxError(data,jqXHR) {
        jexjs.debug('  jexjs.plugin.ajax [error] : 호출 실패! ' + settings.url);
        jexjs.debug('  jexjs.plugin.ajax [error] : [' + data.status+'] ' + data.statusText);
        if (typeof _callback.error === "function") {
            _callback.error(data,jqXHR);
        }
        _complete();
    }

    function _complete() {
        _hideIndicator();
    }

    function _setIndicator( _indicator ) {
        if (typeof _indicator === 'object') {
            if ( typeof _indicator.show === 'function' && typeof _indicator.hide === 'function' ) {
                indicator = _indicator;
            }
        } else if ( typeof _indicator === 'boolean' &&  _indicator === false ){
          indicator = _indicator;  
        }
    }

    function _showIndicator() {
        if (indicator) {
            indicator.show();
        }
    }

    function _hideIndicator() {
        if (indicator) {
            indicator.hide();
        }
    }

    return {
        init: function(_url, _indicator) {
            url = _url;

            _setIndicator( _indicator );
        },

        setIndicator: function( _indicator ) {
            _setIndicator( _indicator );
        },
        
        getIndicator : function(){
            return indicator;
        },

        /**
         * 파라미터를 설정하는 함수 <br />
         * {key} 값에 {value} 값을 설정한다.
         *
         * @method set
         * @param {String} key
         * @param {Object} value
         */

        /**
         * 파라미터를 설정하는 함수 <br />
         * {key} 값에 {value} 값을 설정한다.
         *
         * @method set
         * @param {Object} obj {key: value, key: value, ...}
         */
        set: function(key, value) {
            jexjs.extend(_parameter, key, value);
        },

        /**
         * 파라미터에 저장된 값을 얻어온다.
         *
         * @method get
         * @param {key} String
         * @return {Object} key 값에 저장된 데이터
         */
        get: function(key) {
            return _parameter[key];
        },

        /**
         * 현재 ajax 플러그인에 설정된 설정 값을 꺼낸다. <br />
         * prefix, suffix 는 내부적으로 url_prefix, url_suffix를 리턴한다.
         *
         * @method setting
         * @param {String} key 가져오고자 하는 설정값의 key
         * @returns {Object}
         * @example
         *      var checkUrl = jexAjax.setting('url');
         *      var checkSuffix = jexAjax.setting('suffix');
         */

        /**
         * ajax 통신을 위한 설정 값을 지정한다. <br />
         * prefix, suffix 는 내부적으로 url_prefix, url_suffix 로 지정하고 제거한 후에 <br />
         * 나머지 설정 값은 ajax 통신을 위해 사용한다.
         *
         * @method setting
         * @param {String} key
         * @param {Object} value
         * @example
         *      jexAjax.setting('url', 'new_url');
         */

        /**
         * ajax 통신을 위한 설정 값을 지정한다. <br />
         * prefix, suffix 는 내부적으로 url_prefix, url_suffix 로 지정하고 제거한 후에 <br />
         * 나머지 설정 값은 ajax 통신을 위해 사용한다.
         *
         * @method setting
         * @param {Object} obj {key: value, key: value, ...}
         * @example
         *      jexAjax.setting({
         *          'prefix': '/plugin',
         *          'suffix': '.jct',
         *          'url': 'new_url',
         *          'async': false
         *      });
         */
        setting: function(key, value) {
            if (arguments.length === 1 && typeof key === 'string') {
                if (key === 'contextPath') {
                     return context_path;
                } else if (key === 'prefix') {
                    return url_prefix;
                } else if (key === 'suffix') {
                    return url_suffix;
                } else if (key === 'url') {
                    return url;
                } else if (key === 'filter') {
                    return filter;
                } else if (key == 'userData'){
                    return option.userData;
                } else {
                    return settings[key];
                }
            }

            if (typeof key === 'object') {
                for (var k in key) {
                    this._setting(k, key[k]);
                }
            } else if (typeof key === 'string') {
                this._setting(key, value);
            }
        },
        _setting: function(key, value) {
             if (key === 'contextPath') {
                 context_path = value;
            } else if (key === 'url') {
                url = value;
            } else if (key === 'prefix') {
                url_prefix = value;
            } else if (key === 'suffix') {
                url_suffix = value;
            } else if ( key === 'userData') {
                option.userData = value;
            } else if (key === 'filter') {
                if (typeof value === 'boolean') {
                    filter = value;
                }
            } else {
                jexjs.extend(settings, key, value);
            }
        },

        /**
         * 사용자 callback을 지정한다.
         *
         * @method callback
         * @param {String} key 'success' | 'error'
         * @param {Function} fn 사용자 callback
         *
         * @example
         *      function your_success(data) { }
         *      function your_error(data) { }
         *
         *      jexAjax.callback('success', your_success);
         *      jexAjax.callback('error', your_error);
         */

        /**
         * 사용자 callback을 지정한다.
         *
         * @method callback
         * @param {Object} obj {key: Fn, key: Fn, ... }
         *
         * @example
         *      function your_success(data) { }
         *      function your_error(data) { }
         *
         *      jexAjax.callback({
         *          'success': your_success,
         *          'error': your_error
         *      });
         */
        callback: function(key, value) {
            jexjs.extend(_callback, key, value);
        },

        /**
         * executor를 설정한다. <br />
         * default : jQuery.ajax를 사용하는 executor <br /><br />
         *
         * execute 함수를 반드시 구현해야 하며, settings, parameter 를 변수로 받을 수 있다. <br />
         * execute 함수는 처리 후 반드시 settings.success, settings.error 함수를 호출해줌으로 써 <br />
         * callback 처리를 해주어야 한다.
         *
         * @method executor
         * @param {Object} executor
         * @example
         *      jexAjax.executor({
         *          execute: function(settings, parameter) {
         *              if (success) {
         *                  settings.success({});
         *              } else {
         *                  settings.error({});
         *              }
         *          }
         *      });
         */
        executor: function(executor) {
            if (typeof executor.execute === 'function') {
                _jexExecutor = executor;
            } else {
                jexjs.error("jexjs.plugin.ajax.executor must implements execute function");
            }
        },

        /**
         * ajax 통신을 수행한다.
         * @method execute
         * @param {Function} callback
         * @example
         *      jexAjax.execute();
         *      jexAjax.execute(function(data) {
         *          // success!!!!!
         *      });
         *
         *      jexAjax.execute({
         *          success: function(data) {
         *              // success
         *          },
         *          error: function(data) {
         *              // error
         *          }
         *      });
         *
         */
        execute: function(callback) {
            if (typeof callback === 'function') {
                this.callback('success', callback);
            } else if (typeof callback === 'object') {
                if (typeof callback.success === 'function') {
                    this.callback('success', callback.success);
                }
                if (typeof callback.error === 'function') {
                    this.callback('error', callback.error);
                }
            }

            _execute();
        }
    };
});

/**
 * ajax Error 인지 아닌지를 판단합니다.
 * ERROR값이 true 인경우
 * @parameter dat ajax action호출 후 반한된 데이터값
 * @example {"COMMON_HEAD":{"ERROR":true,"MESSAGE":"","CODE":""}}
 */
jexjs.isJexError = function( dat ){
    if ( !jexjs.isNull( dat ) && !jexjs.isNull(dat.COMMON_HEAD) ) {
        if ( !jexjs.isNull(dat.COMMON_HEAD.ERROR) && dat.COMMON_HEAD.ERROR ){
            return true;
        }
    }
    return false;
};

/**
 * ajax Error 인경우 ErrorCode를 반환해줍니다.
 * @parameter dat ajax action호출 후 반한된 데이터값
 * @example {"COMMON_HEAD":{"ERROR":true,"c":"","CODE":""}}
 */
jexjs.getJexErrorCode = function( dat ) {
    if ( !jexjs.isNull( dat ) && !jexjs.isNull(dat.COMMON_HEAD) ) {
        return dat.COMMON_HEAD.CODE;
    }
    return null;
};

/**
 * ajax Error 인경우 ErrorMessage 값을 반환해줍니다.
 * @parameter dat ajax action호출 후 반한된 데이터값
 * @example {"COMMON_HEAD":{"ERROR":true,"MESSAGE":"","CODE":""}}
 */
jexjs.getJexErrorMessage = function( dat ){
    if ( !jexjs.isNull( dat ) && !jexjs.isNull(dat.COMMON_HEAD) ) {
        return dat.COMMON_HEAD.MESSAGE;
    }
    return null;
};

/**
 * 기존 jex2.0 호환위해 사용. jexMobile에서 사용.
 * @param {String} url
 * @returns { jexjs.plugin.ajax }
 */
jexjs.createAjaxUtil = function (url) {
    return jexjs.plugin('ajax', url);
};

/**
 * 공통 ajax값을 setting 합니다. 기존에 이미 설정되어있는 경우 값을 덮어 씌움.
 * @param {Object} settings 공통 ajax 설정 값
 */
jexjs.ajaxSetup = function(settings) {
    if (jexjs.isNull(settings)) {
        return;
    }

    var globalAjax = jexjs.global.plugins.ajax;

    //indicator
    if (typeof settings.indicator === 'object') {
        if ( typeof settings.indicator.show === 'function' && typeof settings.indicator.hide === 'function' ) {
            globalAjax.indicator = settings.indicator;
            delete settings.indicator;
        }
    } else if ( typeof settings.indicator === 'boolean' &&  settings.indicator === false ){
        globalAjax.indicator = settings.indicator;  
        delete settings.indicator;
    }
    
    //settings
    if (typeof settings.prefix === 'string') {
        globalAjax.prefix = settings.prefix;
        delete settings.prefix;
    }
    if (typeof settings.suffix === 'string') {
        globalAjax.suffix = settings.suffix;
        delete settings.suffix;
    }
    if (typeof settings.contextPath === 'string') {
        globalAjax.contextPath = settings.contextPath;
        delete settings.contextPath;
    }
    
    globalAjax.settings = settings;
};

/**
 * 공통 ajax 값을 확장합니다.
 * @param {Object} settings 공통 ajax 설정 값
 */
jexjs.ajaxSetupExtend = function (settings) {
    if (jexjs.isNull(settings)) {
        return;
    }

    var globalAjax = jexjs.global.plugins.ajax;

    //indicator
    if (typeof settings.indicator === 'object') {
        if ( typeof settings.indicator.show === 'function' && typeof settings.indicator.hide === 'function' ) {
            globalAjax.indicator = settings.indicator;
            delete settings.indicator;
        }
    } else if ( typeof settings.indicator === 'boolean' &&  settings.indicator === false ){
        globalAjax.indicator = settings.indicator;  
        delete settings.indicator;
    }
    
    //settings
    if (typeof settings.prefix === 'string') {
        globalAjax.prefix = settings.prefix;
        delete settings.prefix;
    }
    if (typeof settings.suffix === 'string') {
        globalAjax.suffix = settings.suffix;
        delete settings.suffix;
    }
    if (typeof settings.contextPath === 'string') {
        globalAjax.contextPath = settings.contextPath;
        delete settings.contextPath;
    }
    
    jexjs.extend(globalAjax.settings, settings);
};

/**
 * ajaxError : 공통 error 함수를 정의합니다. ajax 호출이 실패하였을 경우 수행됩니다.
 */
jexjs.ajaxError = function( errFn ){
    var globalAjax = jexjs.global.plugins.ajax;
    
    if (!globalAjax.callback) {
        globalAjax.callback = [];
    }

    if (typeof errFn !== 'function') {
        return;
    }
    
    globalAjax.callback.error =  errFn;
};

/**
 * ajaxFilter : ajax호출이 성공적으로 끝난 후에 등록된 필터들을 순서대로 실행한다. <br>
 *      filter는 false를 리턴할 경우에만 종료를 하고 <br>
 *      그 외의 경우 모든 filter를 호출한 후 callback (success) 함수를 실행한다. <br>
 *      false를 리턴할 경우, 공통 에러 처리 혹은 callback (error) 함수를 실행한다. <br>
 *
 * @method addAjaxFilter
 * @param {Function} filter
 * @param {Number} index 필터 추가 위치
 * @example
 *      jexjs.addAjaxFilter(function(data) {
 *          // data는 ajax 호출 후 성공적으로 내려온 값이다.
 *          return false; // 필터를 종료하고 error 처리 실행
 *      });
 */
jexjs.ajaxFilter = function(filter, _index) {
    var globalAjax = jexjs.global.plugins.ajax;

    if (!globalAjax.filters) {
        globalAjax.filters = [];
    }

    if (typeof filter !== 'function') {
        return;
    }

    var index = (typeof _index === 'number') ? _index : globalAjax.filters.length;

    if ( index >= globalAjax.filters.length ) {
        globalAjax.filters.push(filter);
    } else {
        if (index === 0) {
            var result = [];
            result.push(filter);
            globalAjax.filters = result.concat(globalAjax.filters);
        } else {
            var pre = globalAjax.filters.splice(0, index);
            pre.push( filter );

            globalAjax.filters = pre.concat(globalAjax.filters);
        }
    }
};

/**
 * @deprecated
 * @param {Function} filter
 */
jexjs.addAjaxFilter = function(filter) {
    jexjs.debug('    jexjs.addAjaxFilter is deprecated. change method name to `jexjs.ajaxFilter`');
    jexjs.ajaxFilter(filter);
};

/**
 * ajax execute함수를 쏘기전에 호출해주는 전처리 실행함수
 * @param {function} beforeExecute
 */
jexjs.addAjaxBeforeExecute = function( beforeExecute ){
    
    if ( typeof beforeExecute != 'function'){
        return;
    }
    
    var globalAjax = jexjs.global.plugins.ajax;
    if ( !globalAjax.beforeExecutes ){
        globalAjax.beforeExecutes = [];
    }
    
    globalAjax.beforeExecutes.push( beforeExecute );
};

/**
 * global Executor 구현
 */
jexjs.setAjaxExecutor = function ( executor ) {
    var globalAjax = jexjs.global.plugins.ajax;
    if( "function" == typeof executor.execute ) {
        globalAjax.executor = executor;
    }else  {
        jexjs.error("jexjs.plugin.ajax.executor must implements execute function");
    }
};

/* ==================================================================================
 * code manager은 jex framework와 통신하여 code 에 해당하는 값을 얻어 온다. <br />
 *
 * var jexCodeManager = jexjs.plugin("code_manager"); <br />
 *
 * @class jexjs.plugins.code_manager
 * ================================================================================== */
jexjs.plugins.define('code_manager', function() {
    // init static data on global
    if (!jexjs.global.plugins.code_manager.cachedCode) {
        jexjs.global.plugins.code_manager.cachedCode = {};
    }

    if (!jexjs.global.plugins.code_manager.cachedCodeList) {
        jexjs.global.plugins.code_manager.cachedCodeList = {};
    }

    if (!jexjs.global.plugins.code_manager.cachedSimpleCode) {
        jexjs.global.plugins.code_manager.cachedSimpleCode = {};
    }
    
    if (!jexjs.global.plugins.code_manager.settings) {
        jexjs.global.plugins.code_manager.settings = {};
    }
    
    /*
     DV_CD 는 _code.jct 를 호출할 때 어떤 형태의 데이터를 리턴받을지에 대한 코드 값이다.
     jexstudio > 코드 관리에서 등록된 코드 목록을 호출할 때 사용한다.

     1 : "코드 값"           - GROUP, KEY 값과 함께 넘길 경우, { RESULT: "String" } 형태로 데이터를 받는다.
     2 : [ 키, 코드 배열 ]    - GROUP 값과 넘길 경우, { RESULT: [{KEY: "", CODE: ""}, ... ] } 형태로 데이터를 받는다.
     3 : "심플코드 값"        - GROUP, KEY 값과 함께 넘길 경우, { RESULT: "String" } 형태로 데이터를 받는다.
     4 : [ 키, 심플코드 배열 ] - GROUP 값과 넘길 경우, { RESULT: [{KEY: "", CODE: ""}, ... ] } 형태로 데이터를 받는다.
     */
    var DV_CD = {
        "CODE_FROM__GROUP_KEY": 1,
        "CODE_FROM__GROUP": 3,

        "SIMPLE_CODE_FROM__GROUP_KEY": 2,
        "SIMPLE_CODE_FROM__GROUP": 4
    };

    var defaultOrderOption = {
        baseField   : 'KEY', // KEY, CODE, USR
        order       : 'ASC' //  ASC, DESC
    };

    var lastOrder = {
        baseField   : defaultOrderOption.baseField,
        order       : defaultOrderOption.order
    };

    var globalSettings = jexjs.global.plugins.code_manager.settings;
    var cache = (jexjs.isNull( globalSettings.cache )? false : globalSettings.cache);
    
    var cachedCode = jexjs.global.plugins.code_manager.cachedCode;
    var cachedCodeList = jexjs.global.plugins.code_manager.cachedCodeList;
    var cachedSimpleCode = jexjs.global.plugins.code_manager.cachedSimpleCode;

    var code_url = '_code';

    var contextPath = globalSettings.contextPath || "",
    	 urlPrefix = globalSettings.prefix || "",
        urlSuffix = globalSettings.suffix || ".jct";

    /* jexjs.ajax 플러그인의 Executor를 교체할 수 있다. */
    var ajaxDummyExecutor;

    function getCode(cacheData, group, key, dv_cd, orderOpts) {
        var orderBase   = orderOpts.ORDER_BASE || defaultOrderOption.baseField,
            order       = orderOpts.ORDER      || defaultOrderOption.order;

        if (lastOrder.baseField !== orderBase || lastOrder.order !== order) {
            cacheData[group] = undefined;
            lastOrder.baseField     = orderBase;
            lastOrder.order         = order;
        }

        if ( cache ){
            if (key) {
                if (typeof cacheData[group] === 'object' &&
                    typeof cacheData[group][key] !== 'undefined') {
    
                        return cacheData[group][key];
                }
            } else {
                if (typeof cacheData[group] === 'object') {
                    return jexjs.clone(cacheData[group]);
                }
            }
        }

        var jexAjax = jexjs.createAjaxUtil(code_url);
        jexAjax.set('DV_CD', dv_cd);
        jexAjax.set('GROUP', group);
        jexAjax.set('ORDER_BASE', orderBase);
        jexAjax.set('ORDER', order);
        if (key) {
            jexAjax.set('KEY', key);
        }
        
        if (contextPath) {
            jexAjax.setting('contextPath', contextPath);
        }

        if (urlPrefix) {
            jexAjax.setting('prefix', urlPrefix);
        }

        if (urlSuffix) {
            jexAjax.setting('suffix', urlSuffix);
        }

        jexAjax.setting('async', false);

        if (ajaxDummyExecutor) {
            jexAjax.executor( { execute: ajaxDummyExecutor } );
        }

        jexAjax.execute(function(data) {
            if (data.RESULT) {
                var target = { };
                target[group] = { };

                var hasData = false;

                if ( jexjs.isArray(data.RESULT) ) {
                    delete cacheData[group];
                    jexjs.forEach(data.RESULT, function(index, value) {
                        hasData = true;
                        var each = value;
                        target[group][each.KEY] = each.CODE;
                    });
                } else if ( typeof data.RESULT === 'string' && key ) {
                    hasData = true;
                    target[group][key] = data.RESULT;
                }

                if (hasData) {
                    jexjs.extend( cacheData, target );
                }
            }
        });

        if (key) {
            if (typeof cacheData[group] === 'object' &&
                typeof cacheData[group][key] !== 'undefined') {

                return cacheData[group][key];
            }
        } else {
            if (typeof cacheData[group] === 'object') {
                return jexjs.clone(cacheData[group]);
            }
        }

        return null;
    }


    function getCodeList(cacheDataList, group, orderOpts) {
        var orderBase   = orderOpts.ORDER_BASE || defaultOrderOption.baseField,
            order       = orderOpts.ORDER      || defaultOrderOption.order;

        if (lastOrder.baseField !== orderBase || lastOrder.order !== order) {
            cacheDataList[group] = undefined;
            lastOrder.baseField     = orderBase;
            lastOrder.order         = order;
        }

        if ( cache ){
            if (typeof cacheDataList[group] === 'object') {
                return jexjs.clone(cacheDataList[group]);
            }
        }

        var jexAjax = jexjs.createAjaxUtil(code_url);
        jexAjax.set('DV_CD', DV_CD.CODE_FROM__GROUP);
        jexAjax.set('GROUP', group);
        jexAjax.set('ORDER_BASE', orderBase);
        jexAjax.set('ORDER', order);
        if (contextPath) {
            jexAjax.setting('contextPath', contextPath);
        }
        if (urlPrefix) {
            jexAjax.setting('prefix', urlPrefix);
        }
        if (urlSuffix) {
            jexAjax.setting('suffix', urlSuffix);
        }
        jexAjax.setting('async', false);

        if (ajaxDummyExecutor) {
            jexAjax.executor( { execute: ajaxDummyExecutor } );
        }

        jexAjax.execute(function(data) {
            if (data.RESULT) {
                if ( jexjs.isArray(data.RESULT) ) {
                    delete cacheDataList[group];
                    cacheDataList[group] = data.RESULT;

                }
            }
        });

        if (typeof cacheDataList[group] === 'object') {
            return jexjs.clone(cacheDataList[group]);
        }

        return null;
    }

    function getUrl() {
        var result = code_url;

        if (urlPrefix) {
            result = urlPrefix + result;
        }

        if (urlSuffix) {
            result = result + urlSuffix;
        }
        
        if (contextPath) {
            result = contextPath + result;
        }

        return result;
    }
    
    return {
        init: function( orderOpt ) {
            if ( orderOpt ) {
                defaultOrderOption.baseField    = orderOpt.ORDER_BASE || 'KEY';
                defaultOrderOption.order        = orderOpt.ORDER || 'ASC';
                lastOrder.baseField = defaultOrderOption.baseField;
                lastOrder.order = defaultOrderOption.order;
                if ( orderOpt.cache ){
                    cache = orderOpt.cache;
                } 
            }
        },

        /**
         * @method getCode
         * @param {String} group    그룹 코드 값. 필수
         * @param {String} _key      키 코드 값. 선택
         * @returns { Object || String }
         */
        getCode: function(group, _key, _orderOpts) {
            var url = getUrl();

            var key = null,
                orderOpts = { };
            if (typeof _key === 'string') {
                key = _key;
                orderOpts = _orderOpts || {};
            } else if (typeof _key === 'object') {
                orderOpts = _key;
            }

            if (!cachedCode[url]) {
                cachedCode[url] = { };
            }

            var cacheData = cachedCode[url];

            var dv_cd = DV_CD.CODE_FROM__GROUP;
            if (cacheData[group] && key) {
                dv_cd = DV_CD.CODE_FROM__GROUP_KEY;
            }
            return getCode(cacheData, group, key, dv_cd, orderOpts);
        },
        /**
         * group에 대한 코드 목록을 list 형태로 반환합니다.
         * @method getCodeList
         * @param {String} group
         * @param {Object} orderOpts
         */
        getCodeList : function(group, orderOpts) {
            var url = getUrl();

            orderOpts = orderOpts || {};

            if (!cachedCodeList[url]) {
                cachedCodeList[url] = {};
            }

            var cacheDataList = cachedCodeList[url];

            return getCodeList(cacheDataList, group, orderOpts);

        },
        /**
         * @method getSimpleCode
         * @param {String} group    그룹 코드 값. 필수
         * @param {String} _key      키 코드 값. 선택
         * @returns { Object || String }
         */
        getSimpleCode: function(group, _key, _orderOpts) {
            var url = getUrl();

            if (!cachedSimpleCode[url]) {
                cachedSimpleCode[url] = { };
            }

            var key = null,
                orderOpts = {};
            if (typeof _key === 'string') {
                key = _key;
                orderOpts = _orderOpts || {};
            } else if (typeof _key === 'object') {
                orderOpts = _key;
            }

            var cacheData = cachedSimpleCode[url];

            var dv_cd = DV_CD.SIMPLE_CODE_FROM__GROUP;
            if (cacheData[group] && _key) {
                dv_cd = DV_CD.SIMPLE_CODE_FROM__GROUP_KEY;
            }

            return getCode(cacheData, group, _key, dv_cd, orderOpts);
        },

        /**
         * 호출 URL을 변경할 때 사용한다. 기본 url : _code
         * @method url
         * @param _url
         */
        url: function(_url) {
            code_url = _url;
        },
        
        contextPath: function(_contextPath) {
        	contextPath = _contextPath;
        },

        urlPrefix: function(_urlPrefix) {
            urlPrefix = _urlPrefix;
        },

        urlSuffix: function(_urlSuffix) {
            urlSuffix = _urlSuffix;
        },

        dummy: function( executor ) {
            if (typeof executor === 'function') {
                ajaxDummyExecutor = executor;
            }
        },
        removeCache : function(){
            var url = getUrl();
            if (cachedCode[url]) {
                delete cachedCode[url];
            }
            if (cachedSimpleCode[url]) {
                delete cachedSimpleCode[url];
            }
        },
        isCache : function(){
            return cache;
        }
    };
});

/**
 * @param settings { JSONObject }
 * cache : true or false 
 */
jexjs.codeManagerSetup = function( settings ){
    if (jexjs.isNull(settings)) {
        return;
    }
    var codeManagerGrobal = jexjs.global.plugins.code_manager;
    codeManagerGrobal.settings = settings;
};
/**
 * dom 플러그인을 생성한다. <br />
 *
 * var jexDom = jexjs.plugin("dom"); <br />
 *
 * @class jexjs.plugins.dom
 */

jexjs.plugins.define('dom', function() {

	var _OPT = {
		'TYPE' : {
			'JSON' : 'Json',
			'ARRAY' : 'Array'
		}
	};
	    
	var  _opt = {
            TYPE : _OPT.TYPE.JSON  // Json or Array
	};

    function _init ( opt ) {
        jexjs.extend( _opt, opt );
    }
    
	function get(domId, findName) {
		var $scope = jexjs.$("#" + domId);
		if ($scope.length === 0) {
			return;
		}

		if (!findName) {
			return;
		}

		var $find = $scope.find('[name="' + findName + '"]');
		if ($find.length === 0) {
			return;
		}

		var tagName = $find[0].tagName.toLowerCase(), result;

		if ("input" === tagName) {
			var type = $find.attr("type").toLowerCase();

			if ("checkbox" === type) {
				result = [];

				$scope.find('[name="' + findName + '"]:checked').each(function() {
				    
				    if ( _opt.TYPE == _OPT.TYPE.JSON ) {
				        result.push({'value':jexjs.$(this).val()});
				    } else {
				        result.push(jexjs.$(this).val());
				    }
				});

				return result;
			} else if ("radio" === type) {
				return jexjs.null2Void($scope.find('[name="' + findName + '"]:checked').val());
			}

			return $find.val();
		} else if ("select" === tagName) {
			return jexjs.null2Void($find.val());
		} else if ("textarea" === tagName) {
			return $find.val();
		} else {
			return $find.html();
		}
	}

	function getAll(domId) {
		var result = {};

		jexjs.$("#" + domId).find("[name]").each(function() {
			var key = jexjs.$(this).attr("name");

			if (!key) {
				return true;
			}

			if (typeof result[key] === "undefined") {
				result[key] = jexjs.null2Void(get(domId, key));
			}
		});

		return result;
	}

	function set(domId, findName, value) {
		var $scope = jexjs.$("#" + domId);
		if ($scope.length === 0) {
			return;
		}

		if (!findName) {
			return;
		}

		var $find = $scope.find('[name="' + findName + '"]');
		if ($find.length === 0) {
			return;
		}

		var tagName = $find[0].tagName.toLowerCase();

		if ("input" === tagName) {
			var type = $find.attr("type");
			if ("checkbox" === type) {
			    
				if (typeof value === "string") {
					if ("" === value.trim()) {
						$find.each(function() {
							jexjs.$(this)[0].checked = false;
						});
					} else {
						var checkbox = $scope.find('[name="' + findName + '"][value="' + value + '"]')[0];
						if (checkbox) {
							checkbox.checked = true;
						}
					}
				} else if (jexjs.isArray(value)) {
					for (var i = 0; i < value.length; i++) {
						if( value[i].value && "string" === typeof value[i].value ) {
							set(domId, findName, value[i].value);
						}else{
							set(domId, findName, value[i]);
						}
					}
				}
			} else if ("radio" === type) {
				if ("" === value.trim()) {
					$find.each(function() {
						jexjs.$(this)[0].checked = false;
					});
				} else {
					var radio = $scope.find('[name="' + findName + '"][value="' + value + '"]')[0];
					if (radio) {
						radio.checked = true;
					}
				}
			} else {
				$find.val(value);
			}
		} else if ("select" === tagName) {
	        $find.val(value);
		} else if ("textarea" === tagName) {
			$find.val(value);
		} else {
			$find.html( value );
		}
	}

	function setAll(domId, params) {
		for ( var i in params) {
			set(domId, i, params[i]);
		}
	}

	function clear(domId, findName) {
       var $scope = jexjs.$("#" + domId);
        if ($scope.length === 0) {
            return;
        }

        if (!findName) {
            return;
        }

        var $find = $scope.find('[name="' + findName + '"]');
        if ($find.length === 0) {
            return;
        }

        var tagName = $find[0].tagName.toLowerCase();
        if ( "select" === tagName ) {   	//clear 할때, selectbox는 첫 value로 selected 설정
            if ( 0 < $find.children("option").length ){
                set( domId, findName, $find.children("option").eq(0).val() );
                return;
            }
        } else if ( "input" === tagName) {   //clear 할때, radio는 첫 value로 checked 설정
			 var type = $find.attr("type");
			 if( "radio" === type ) {
					if ( 0 < $find.length ){
						set( domId, findName, $find.eq(0).val() );
						return;
					}
			 }
				
        }
        set(domId, findName, "");
	}

	function clearAll(domId) {
		jexjs.$("#" + domId).find("[name]").each(function() {
			clear(domId, jexjs.$(this).attr("name"));
		});
	}
	
	return {
		init : function( opt ) {
		    _init( opt );
		},
		/**
		 * {domId} 하위 태그들 중 name={findName} 인 태그의 값을 리턴한다. <br />
		 * [type=checkbox] 인 경우 Array 형태로 리턴한다.
		 *
		 * @method get
		 * @param {String} domId
		 * @param {String} findName
		 * @returns {String | Array}
		 * @example
		 *      jexjs.plugin("dom").get("my_form", "loginId");     // jex@jexframe.com
		 *      jexjs.plugin("dom").get("more_info", "hobby");     // [ "book", "computer" ]
		 */
		get : function(domId, findName) {
			return get(domId, findName);
		},

		/**
		 * {domId} 하위 태그들 중 name={findName} 인 태그의 값을 설정한다.
		 *
		 * @method set
		 * @param {String} domId
		 * @param {String} findName
		 * @param {String | Array} value [type=checkbox]의 경우 Array 형태의 파라미터도 가능하다.
		 * @example
		 *      jexjs.plugin("dom").set("my_form", "loginId", "jex@jexframe.com");
		 *      jexjs.plugin("dom").set("more_info", "hobby", [ "book", "computer" ]);
		 */
		set : function(domId, findName, value) {
			set(domId, findName, value);
		},

		/**
		 * {domId}의 하위 태그들 중 name 태그를 갖는 태그의 value를 리턴한다. <br />
		 * @method getAll
		 * @param {String} domId
		 * @returns {Object}
		 * @example
		 *      var getAll = jexjs.plugin("dom").getAll("my_form");
		 *      getAll.loginId  // jex@jexframe.com
		 */
		getAll : function(domId) {
			return getAll(domId);
		},

		/**
		 * {domId}의 하위 태그들 중 [name=params의 키] 를 만족하는 태그들의 값을 설정한다.
		 * @method setAll
		 * @param {String} domId
		 * @param {Object} params
		 */
		setAll : function(domId, params) {
			setAll(domId, params);
		},

		/**
		 * {domId}의 하위 태그 중 [name={findName}]을 만족하는 태그의 value를 초기화한다. <br />
		 *   - [type=checkbox, radio] = checked: false <br />
		 *   - [all] = value: ""
		 *
		 * @method clear
		 * @param {String} domId
		 * @param {String} findName
		 */
		clear : function(domId, findName) {
			clear(domId, findName);
		},

		/**
		 * {domId}의 하위 태그 중 [name] 속성을 갖는 모든 태그의 값을 clear 시킨다. <br />
		 * @method clearAll
		 * @param {String} domId
		 */
		clearAll : function(domId) {
			clearAll(domId);
		}
	};
});


jexjs.dom = jexjs.plugin("dom", {
    'TYPE' : "Array"
});
/**
 * 삭제예정. 쓰지 마세요!! 
 * 일단 이미 사용한 경우를 위해 남겨두자!!!
 */

 if ("undefined" == typeof FormData) {
    jexjs.debug('FormData 객체가 존재하지 않는 브라우져에서는 "file_upload" plugin 사용이 불가능합니다.');
 } else {
    jexjs.plugins.define('file_upload', function() {

        var _global = jexjs.global.plugins.file_upload;
        var _checkType = null;  //file type과 data타입은 함께 사용할 수 없으므로 valid check 
        var _parameter = {}; // file외의 일반 text data
        var formData = new FormData();  //실제 ajax 호출시 사용되는 data
        var form_file_upload_id = "jex_file_upload_form";
        var random = new Date().getTime(),
            template_form = '<form method="post" enctype="multipart/form-data" style="position:absolute; top: -1000px; left: -1000px;"></form>',
            template_iframe = '<iframe style="display:none;"></iframe>',
            template_file = '<input type="file" />',
            template_submit = '<input type="submit" value="upload" />';

        var contextPath = _global.contextPath || "",
            prefix = _global.prefix || "",
            suffix = _global.suffix || ".jct",
            url,
            $form,
            $targetFrame,
            files = [];
        var success;
        
        var options = {
                type : "file",     // file : 일반 input type, data : 파일선택화면을 띄우지 않고 data로 입력받은경우.
                multiple : false,  // input type="file" 에서 다건선택가능
                reset:true         // input type="file" 선택시 새로 file 선택하지 않고 추가된파일 계속 가지고있을건지 여부
        };
        
        var events = {
                
        };
        
        if ( _global.options ){
            jexjs.extend( options, _global.options );
        }
        
        function init( _url , option ) {
            
            settings( option );
            
            initDom();

            url = _url;

            $form.attr({
                'action': getUrl( _url ),
                'target': $targetFrame.attr('name')
            });
        }
        
        function settings ( key, value ){
            if ( typeof key === 'object' ){
                for( var k in key){
                    _settings( k, key[k]);
                }
            }else if ( typeof key === 'string'){
                _settings( key, value );
            }
        }
        
        function _settings ( key, value ){
            if ( 'contextPath' === key ){
                contextPath = value;
            }else if ( 'prefix' === key ){
                prefix = value;
            }else if ( 'suffix' === key ){
                suffix = value;
            }
            options[ key ] = value;
        }
        
        function getUrl( _url ){
            var fullUrl = "";
            
            if ( !jexjs.empty( contextPath )){
                fullUrl += contextPath + "/" ;
            }
            if ( !jexjs.empty( prefix )){
                fullUrl += prefix + "/" ;
            }
            
            //id에 .jct 확장자 넘어온경우
            if ( -1 != fullUrl.indexOf(".jct") && ".jct" == suffix) {
                fullUrl +=  _url;
            } else {
                fullUrl +=  _url + suffix;
            }
            
            return fullUrl;
        }

        function initDom() {
            var random = new Date().getTime();
            $form = jexjs.$('#' + form_file_upload_id + "_" + random);
            if ($form.length === 0) {
                $form = jexjs.$(template_form);
                $form.appendTo("body");
            }

            if ($form.find('input[type=submit]').length === 0) {
                $form.append(jexjs.$(template_submit));
            }

            $form.off('submit').on('submit', function(event) {
                var $inputFile = $(jexjs.$(this).find("input[type=file]")[0]);

                if ( "file" == options.type ) {
                    //파일 다건 선택
                    if ( options.multiple ){
                        var _files = files;
                        for( var i = 0; i < _files.length; i++ ){
                            formData.append( $inputFile.attr('name'), _files[i] );
                        }
                    }//파일 단건 선택
                    else{
                        formData.append( $inputFile.attr('name'), $inputFile[0].files[0] );
                    }
                }
                
                //file 객체외의 데이터가 있는 경우 추가
                if ( _parameter ) {
                    for( var key in _parameter ) {
                        if ( "object" == typeof _parameter[key] ) {
                            formData.append(key, JSON.stringify( _parameter[key] ));
                        } else {
                            formData.append(key, _parameter[key] );
                        }
                    }
                }
                
                jQuery.ajax({
                    url: getUrl(url),
                    type: 'POST',
                    data: formData,
                    async: false,
                    cache: false,
                    processData: false,
                    contentType: false,
                    success: function(data, textStatus, jqXHR) {
                        if (typeof success === 'function') {
                            success(data);
                        }
                    },
                    error: function(jqXHR, textStatus, errorThrown) {
                        jexjs.warn("file_upload plugin:: error :: "+textStatus);
                    }
                });

                return false;
            });

            $targetFrame = jexjs.$(template_iframe);
            $targetFrame.attr('name', 'jex_fileupload_frame');
            $targetFrame.appendTo("body");
        }
        
        function add(name, _callback) {
            
            var $input_file = $form.find('input[name=' + name + ']')[0];
            
            if (typeof $input_file !== 'undefined') {
                $input_file.remove();
            }
                
            $input_file = jexjs.$(template_file)
                .attr({
                    'id': name,
                    'name': name
                });

            if ( options.multiple ){
                $input_file.prop("multiple",true);
            }
            
            $form.append($input_file);
            
            $input_file.on('change', function( e ) {
                var targetFiles = e.target.files || e.dataTransfer.files;
                if ( !jexjs.empty(targetFiles)){
                    for(var k=0; k < targetFiles.length; k++){
                        jexjs.debug("    jexjs.plugin.file_upload : e.files["+k+"]::"+ targetFiles[k].name);
                    }
                }
                
                if ( options.reset ){
                    files = targetFiles;
                }else {
                    for(var i=0; i < targetFiles.length; i++){
                        var isDuplicate = false;
                        for(var j=0; j < files.length; j++){
                            if ( files[j].name == targetFiles[i].name){
                                jexjs.debug("    jexjs.plugin.file_upload : overwrite file::"+ targetFiles[i].name);
                                files[j] = targetFiles[i];
                                isDuplicate = true;
                            }
                        }
                        if ( !isDuplicate ){
                            jexjs.debug("    jexjs.plugin.file_upload : add file::"+ targetFiles[i].name);
                            files.push(targetFiles[i]);
                        }
                    }
                }
                
                if (typeof _callback === "function") {
                    _callback( $input_file[0], jexjs.clone(files) );
                }
            });

            $input_file.click();
        }
        
        function addFormData( name, value ){
            formData.append( name, value );
        }
        
        function _removeFile( orgFileName ) {
            var file, newFiles = [];
            var isRemove = false;
            for ( var i = 0; i < files.length; i++ ){
                file = files[i];
                if ( orgFileName != file.name ){
                    newFiles.push(file);
                }else{
                    isRemove = true;
                }
            }
            files = newFiles;
            if ( isRemove ){
                jexjs.debug("    jexjs.plugin.file_upload : remove file::"+ orgFileName);
                return 1;
            }
            return 0;
        }
        
        function removeFileList(name, orgFileName, _callback ){
            var $input_file = $form.find('input[name=' + name + ']')[0];
            var removeCount = 0;
            if ( "string" == typeof orgFileName ) {
                removeCount =  _removeFile(orgFileName);
            }else if ( jexjs.isArray(orgFileName) ) {
                for(var i=0; i < orgFileName.length; i++){
                    removeCount += _removeFile( orgFileName[i] );
                }
            }
            _callback( $input_file[0], jexjs.clone(files), removeCount );
        }
        
        function upload(_callback) {
            success = _callback;

            $form.find('input[type=submit]').click();
        }

        function setUrl(_url) {
            url = _url;
            $form.attr('action', getUrl(_url) );
        }

        return {
            init: function(_url , option) {
                init(_url, option);
            },
            //일반데이터 추가
            setData : function( key , value ){
                jexjs.extend(_parameter, key, value);
            },
            //파일추가
            add: function(name, fileData ) {
                var type = "file";
                if ( "function" != typeof fileData ) {
                    type = "data";
                    options.type = type;
                }
                
                if ( null === _checkType ) {
                    _checkType = type;
                } else {
                    if ( _checkType != type ) {
                        jexjs.error("    jexjs.plugin.file_upload:: file Type과 data Type을 함께 사용할 수 없습니다. ");
                    }
                }
                
                if ( "function" == typeof fileData ) {  //File 선택하여 추가
                    add(name, fileData);
                } else {    //File Data 추가
                    addFormData(name, fileData);
                }
            },
            //파일삭제
            remove : function( name, fileNameList , callback) {
                removeFileList( name, fileNameList , callback);
            },
            //파일업로드
            upload: function(_callback) {
                upload(_callback);
            },
            url: function(_url) {
                setUrl(_url);
            }
        };
    });
 }
/* ========================================================================
 * jexjs.plugins.form
 * 생성시 기준 element 이하에서 'keydown : enter' 이벤트가 발생할 경우
 * 지정된 element의 지정된 event를 실행시킨다.
 * ======================================================================== */

// auto binding
$(function() {
    $(document.body ).find('[jex-form]').each(function() {
        var $scope = $( this );
        var $target = $scope.find('[jex-submit]');
        var event = $target.attr('jex-submit');

        function isExceptElement( e ) {
            var targetNode = e.target;
            var tagName = targetNode.tagName.toLowerCase() ;
            
            if ( "textarea" == tagName ) {
                return true;
            } else if ( "input" == tagName )  {
                var type = targetNode.getAttribute("type").toLowerCase();
                if ( "submit" == type ) {
                    return true;
                }
            } else if( "button" == tagName ) {
                return true;
            }
            
            return false;
        }
        
        $scope.on('keydown', function(e) {
            var keyCode = e.which || e.keyCode;
            if (keyCode === 13) {
                if ( !isExceptElement( e ) ) {
                    jexjs.debug('    jexjs.plugins.form : jex-submit event 실행');
                    if ($target) {
                        $target.trigger(event);
                        return false;
                    }
                }
            }
        });
    });
});

jexjs.plugins.define('form', function() {
    var $scope,
        $target,
        event;

    var attr = {
        form: 'jex-form',
        submit: 'jex-submit'
    };

    function get$(element) {
        if (typeof element === 'string') {
            if (!element.startsWith('#')) {
                element = '#' + element;
            }

            return jexjs.$( element );
        } else if (element && element instanceof jQuery) {
            return element;
        } else if (element && element instanceof HTMLElement) {
            return jexjs.$( element );
        }
    }

    function isExceptElement( e ) {
        var targetNode = e.target;
        var tagName = targetNode.tagName.toLowerCase() ;
        
        if ( "textarea" == tagName ) {
            return true;
        } else if ( "input" == tagName )  {
            var type = targetNode.getAttribute("type").toLowerCase();
            if ( "button" == type ) {
                return true;
            }
        } else if( "button" == tagName ) {
            return true;
        }
        
        return false;
    }
    
    function listen() {
        $scope.on('keydown', function(e) {
            var keyCode = e.which || e.keyCode;

            if (keyCode === 13) {
                if ( !isExceptElement( e ) ) {
                    jexjs.debug('    jexjs.plugins.form : jex-submit event 실행');
                    if ($target) {
                        $target.trigger(event);
                        return false;
                    }
                }
            }
        });
    }

    return {
        init: function(element) {
            $scope = get$(element);

            if (!$scope) {
                jexjs.error('form 플러그인은 `elementId | HTMLElement | jQueryElement` 중 하나를 파라미터로 입력해야 합니다.');
            }

            if ($scope.attr( attr.form )) {
                var $submitElement = $scope.find('[' + attr.submit + ']');
                var _event = $submitElement.attr( attr.submit );

                listen();

                $target = $submitElement;
                event = _event;
            }
        },
        setSubmit: function(_element, _event) {
            var _$target = get$(_element);

            if (!_$target) {
                jexjs.error('jexjs.plugins.form : setSubmit시 대상이 될 수 있는 `elementId | HTMLElement | jQueryElement`중 하나를 파라미터로 입력해야 합니다.');
            }

            if (typeof _event !== 'string') {
                jexjs.error('jexjs.plugins.form : setSubmit시 이벤트명은 문자열로 입력해야 합니다.');
            }

            $target = _$target;
            event = _event;

            listen();
        }
    };
});


/* ==================================================================================
 * indicator 플러그인은 사용자에게 '현재 ~ 작업을 진행 중' 임을 나타낼 때 사용한다.
 * 이를 나타내기 위해서 기본적으로 메인 화면을 덮는 `배경` 위에 진행 중을 표시하는 `이미지`로 구성해서 사용한다.
 * #jexjs-indicator-wrap
 *   .jexjs-indicator
 *      .jexjs-indicator-bg
 *          .jexjs-indicator-img
 *
 * indicator 는 document.body 마다 하나씩만 존재할 수 있다. 즉, 최초 생성 후에는 제거하지 않는다.
 *
 * var jexIndicator = jexjs.plugin('indicator');
 * ================================================================================== */

var indicatorCountCheck = 0;
jexjs.plugins.define('indicator', [ 'template' ], function($template) {

    var id = {
        'wrap' : 'jexjs-indicator-wrap'
    };
    
    var name = {
        'theme': {
            'def'   : 'jexjs-indicator-theme-default',
            'modal'     : 'jexjs-indicator-theme-modal',
            'user'  :   'jexjs-indicator-theme-user'
        }
    };

    var cssClass = {    //기본 디자인
        wrapper : '',
        bg: 'jexjs-indicator',
        imgBg: 'jexjs-indicator-bg',
        img: 'jexjs-indicator-img',
        modal: 'modal',
        active : 'active'
    };
    
    var targetCssClass = {  //target을 입력받아 특정 영역에 indicator를 사용할때의 기본 디자인
        bg: 'jexjs-indicator-target',
        imgBg: 'jexjs-indicator-bg-target'
    };

    var template = {
        wrapper: '<div id="#{ id }" class="#{ classWrapper }"></div>',
        indicator: '<div name="#{ themeName }" class="#{ classBg }"><div class="#{ classImgBg }"><span class="#{ classImg }"></span></div></div>'
    };

    var options = {
        scopeWindow: null,
        modal: false,
        user : false,
        target : null   //기본적으로는 indicator wrap 이 body에 추가되지만, target이 있는 경우는 target에 indicator가 추가.
                        //위치의 기준이 되는 태그이기때문에, target은 "position:relative"로 설정하여야 한다. 그리고 width, hegith.
    };
    
    var fn = {
        show : function( $indicator ){
            $indicator.addClass( cssClass.active );
        },
        hide : function( $indicator){
            $indicator.removeClass( cssClass.active );
        }
    };

    var $indicator;

    function init() {
        var scope = options.scopeWindow || jexjs.getRootParent() || window;
        var wrapper = null;

        // target이 없는 경우.
        if ( jexjs.isNull(options.target) ) {
            wrapper = scope.document.getElementById(id.wrap);
            
            //wrapper가 append 되어있지 않으면, 생성.
            if (jexjs.isNull(wrapper)) {
                jexjs.debug('    jexjs.plugin.indicator: init indicator-wrapper');

                var wrapperTemplate = $template.render(template.wrapper, { 
                    id: id.wrap,
                    classWrapper : cssClass.wrapper
                }),
                    $wrapper = jexjs.$(wrapperTemplate);
                jexjs.$(scope.document.body).append($wrapper);
                
                wrapper = $wrapper[0];
            }
        }// target id가 있는 경우.
        else {
            wrapper = jexjs._getHtmlElement( options.target, scope );
            cssClass = jexjs.extend( cssClass, targetCssClass );
        }

        var themeName = name.theme.def;
        if ( options.user ){
            themeName = name.theme.user;
        }else if (options.modal) {
            themeName = name.theme.modal;
        }

        var $tmpIndicator = jexjs.$(wrapper).find('[ name="'+ themeName +'"]');
        if ($tmpIndicator.length > 0) {
            $indicator = $tmpIndicator;
        } else {
            
            var html = $template.render(template.indicator, {
                themeName: themeName,
                classBg: cssClass.bg,
                classImgBg: cssClass.imgBg,
                classImg: cssClass.img
            });

            $indicator = jexjs.$( html );

            if (options.modal) {
                $indicator.addClass( cssClass.modal );
            }
            jexjs.$(wrapper).append($indicator);
        }
    }
    function show() {
        //console.log("show : indicatorCountCheck : " + (++indicatorCountCheck));
        ++indicatorCountCheck;
        fn.show( $indicator );
    }

    function hide() {
        if ( (--indicatorCountCheck) <= 0 ) {
            fn.hide( $indicator );
            indicatorCountCheck = 0;
        }
    }

    return {
        init: function(_opts) {
            if (_opts) {
                
                if (typeof _opts.css === 'object') {
                    options.user = true;    //사용자 정의 class
                    cssClass = jexjs.extend( cssClass, _opts.css );
                    delete _opts.css;
                }
                
                if ( _opts.fn ){
                    if (typeof _opts.fn.show === 'function') {
                        fn.show = _opts.fn.show;
                    }
                    if (typeof _opts.fn.hide === 'function') {
                        fn.hide = _opts.fn.hide;
                    }
                    delete _opts.fn;
                }
                
                if (typeof _opts.scopeWindow === 'object') {
                    options.scopeWindow = _opts.scopeWindow;
                    delete _opts.scopeWindow;
                }
                
                options = jexjs.extend( options, _opts );
                
                if ( _opts.target ) {
                    id.wrap = id.wrap + "_" + jexjs._getElementId(_opts.target);
                }
            }
            init();
        },
        show: function() {
            show();
        },
        hide: function() {
            hide();
        }
    };
});
/* ========================================================================
 * jexjs.plugins.input
 * 사용자의 키보드 입력에 대한 제어를 담당하는 플러그인
 * ======================================================================== */

jexjs.plugins.define('input', function() {
    var rules = jexjs.global.plugins.input.rules || {};

    var inputAttr = 'jex-input';

    function listen( $scope ) {
        if ( jexjs.empty($scope.attr(inputAttr)) ) {
            $scope.find('[' + inputAttr + ']').each(function() {
                listen( jexjs.$(this) );
            });
        } else {
            var checkList = ($scope.attr( inputAttr ) || '').split(';');
            jexjs.forEach(checkList, function(index, value) {
                var each = jexjs.trim(value);

                if (jexjs.empty(each)) {
                    return true;
                }

                var fn = rules[ each ];

                if (!fn) {
                    jexjs.error(' [ input ] 등록되지 않은 rule 입니다. ' + each);
                }

                fn( $scope );
            });
        }
    }

    return {
        addRule: function( name, fn ) {
            rules[name] = fn;
        },
        listen: function( $scope ) {
            listen( $scope );
        },
        rules: rules
    };
}, true);


/* ==================================================================================
 * ml 플러그인은 페이지에서 다국어를 사용하는 경우 필요한 플러그인이다.
 *
 * jexjs.plugin('ml');
 * ================================================================================== */

jexjs.plugins.define('ml', [ 'indicator', 'ajax','template', 'queue', 'code_manager' ], function( $indicator, $ajax, $template, $queue, $codeManager ) {
    
    var _globalMl =  jexjs.global.plugins.ml,
    _viewId = (function(){
                var viewId = null;
                var pathName = window.location.pathname || window.location.href;
                var matchList = pathName.match(/(\w)+.act/g);
                if ( matchList && matchList.length == 1 ){
                    viewId = matchList[0].replace(".act","");
                    return viewId;
                }else {
                    jexjs.debug("    jexjs.plugin.ml : view Id 추출 실패!! "+ pathName);
                }
            })();
    
    var _CONST = {
            TRANSLATE_MODE_Y : true,    //dom 번역을 한다.
            TRANSLATE_MODE_N : false    //dom 번역없이 param 값에 대한 변경만
    };
    
    var _settings = {
            isUseHeader : true,
            isUseBody : true,
            contextPath : null,
            prefix : null,
            url : "jexMLang",
            suffix : "",
            codeManager : $codeManager,
            isTranslateLocal : false,    //페이지 최초 road시 loca언어인경우에는 번역할필요가 없으나 HTML parameter를 사용하면 필요하여 추가 ( isTranslateServer : false 일때 )
            isTranslateServer : false    //페이지 최초 road시 번역된 Html 이 내려오는경우 true, 번역되지 않은 data가 내려오는 경우 false
    };
    
    var _FUNC = {
            'beforeInit' : function( info ){
            },
            'afterInit' : function( info ){
            },
            'beforeChange' : function( info ){
                info.indicator.show();
            },
            'afterChange' : function( info ){
                info.indicator.hide();
            },
            //{ 'VIEW_ID':viewId, 'ML_ID': mlKey, 'ML_TP':_ML_TP.HTML }
            'isInsertMlKey' : function(){
                return true;
            },
            //{ 'VIEW_ID':viewId, 'ML_ID': mlKey, 'ML_TP':_ML_TP.HTML }
            'setInsertViewId' : function(){
                return _viewId;
            }
    };
    var _ML_ATTR = "data-jex-ml" ,
        _ML_ATTR_VIEW_ID = "data-jex-view",
        _ML_ATTR_NOMAL_VIEW_ID = "data-jex-nomal-view", //사용하지 말기. jex-view와 동일한처리
        _ML_ATTR_OPT_DYNAMIC = "data-jex-ml-opt-dynamic",
        _ML_ATTR_PARAM = "data-jex-param",
        _ML_ATTR_META_VIEW_ID = "data-jex-ml-id",   //서버번역일때, script에서 다국어 data를 가져오는 view id를 알려주기위해 함께 내려줌.
        _ML_TP = {
            HTML : "V",
            JS   : "J"
        },
        _ML_ACTION = {
            LOAD: 'LOAD',       //해당 언어에 대한 다국어 데이터를 반환하며, 쿠키에 언어코드는 set 하지 않는다.
            SET : 'SET',        //해당 언어에 대한 다국어 데이터를 반환하며, 쿠키에 언어코드도 set
            INSERT : 'INSERT'   //page에 대한 다국어 key insert
        },
        _ML_ATTR_CODE_GROUP = "data-jex-code-group",
        _ML_ATTR_CODE_KEY = "data-jex-code-key",
        _ML_ATTR_CODE_TEPLATE = "data-jex-code-tpl",
        _IS_ML_DEBUG = false,
        _IS_LOADED = false,  //local단어일때는 ajax호출하지 않음. false인경우는 한번도 다국어정보를 read 하지 않은 상태
        _CACHED_ML_DATA = {},
        _LOCAL_JS_ML_DATA = {},
        _LOAD_VIEW_LIST = [];
    
    //local 다국어 정보를 서버에서 주는 경우는 이미 local 다국어 정보를 가지고 있음.
    var _LOCAL_HTML_ML_DATA = null;
    try{
        _LOCAL_HTML_ML_DATA  = htmlOriginalValues;
        jexjs.debug("    jexjs.plugin.ml : Local Data from Server : "+ JSON.stringify(_LOCAL_HTML_ML_DATA));
    }catch (e){
        _LOCAL_HTML_ML_DATA = {};
    }
        
    $indicator = jexjs.plugin("indicator",{ modal : true});
    
    if ( _globalMl.settings ){
        jexjs.extend( _settings, _globalMl.settings);
    }
    
    if ( _globalMl.event ){
        jexjs.extend( _FUNC, _globalMl.func );
    }
    
    function setLocalLang( localLang ){
        jexjs.cookie.set("JEX_LOCAL_LANG", localLang);
    }
    
    function setLang ( lang ){
        jexjs.cookie.set("JEX_LANG", lang);
    }
    
    /**
     * 초기화
     */
    function _init( settings ){

        _setSettings( settings );
        
        //meta 태그에 view id가 있는경우
        var headNodes = document.head || document.getElementsByTagName("head")[0]; // ie8 document.head 없음.
        var metaNode = headNodes.querySelector("meta["+_ML_ATTR_META_VIEW_ID+"]");
        if ( null !== metaNode ) {
            _viewId = metaNode.getAttribute( _ML_ATTR_META_VIEW_ID );
            jexjs.debug("    jexjs.plugin.ml : init : meta tag view id load ::"+ _viewId);
        }
        
        try {
            jexjs.debug("    jexjs.plugin.ml : init : isUseHeader :" + _settings.isUseHeader);
            jexjs.debug("    jexjs.plugin.ml : init : isUseBody :" + _settings.isUseBody);
            jexjs.debug("    jexjs.plugin.ml : init : contextPath :" + _settings.contextPath);
            jexjs.debug("    jexjs.plugin.ml : init : prefix :" + _settings.prefix);
            jexjs.debug("    jexjs.plugin.ml : init : url :" + _settings.url);
            jexjs.debug("    jexjs.plugin.ml : init : suffix :" + _settings.suffix);
            jexjs.debug("    jexjs.plugin.ml : init : isTranslateLocal :" + _settings.isTranslateLocal);
            jexjs.debug("    jexjs.plugin.ml : init : isTranslateServer :" + _settings.isTranslateServer);
        } catch(e) {
            
        }
        //  Dom Element에서 local 단어 추출하여 저장
        //  - 서버에서 번역을 해주지 않는 경우.
        //  - 서버에서 번역을 해주는 모드인데, local 언어인경우는 local 단어 추출
        if ( !_settings.isTranslateServer || ( _settings.isTranslateServer && jexjs.getLang() == jexjs.getLocalLang()) ){
            //local 단어 load
            _saveLocalMl();
        }
        //local단어가 아닌경우만 해당 언어의 다국어정보 load
        if ( jexjs.getLang() != jexjs.getLocalLang() ) {
            _loadViewData();
        }
        //TODO 초기설정과 chagne를 분리하게되면 _initChange를 public 함수로 변경하면됨.
        //현재 언어로 번역
        _initChange();
    }
    
    function _initChange() {
        
        if ( "function" == typeof _FUNC.beforeInit){
            _FUNC.beforeInit.call(undefined,  {
                'LANG' : jexjs.getLang(),
                'indicator' : $indicator
            });
        }
        
        function _afterInitFn() {
            if ( "function" == typeof _FUNC.afterInit ) {
                _FUNC.afterInit.call(undefined , {
                        'LANG' : jexjs.getLang(),
                        'indicator' : $indicator
                });
            }
        }
       
        // 서버에서 번역을 해주는 경우, param 만 값 치환
        if ( _settings.isTranslateServer ){
            _changeDom( _CONST.TRANSLATE_MODE_N, jexjs.getLang(), _afterInitFn );
        }
        // 서버에서 번역을 해주지 않는 경우
        else {
            if ( !jexjs.empty(_CACHED_ML_DATA) ){   //local언어가 아닌경우 해당언어로 dom 변경
                _changeDom( _CONST.TRANSLATE_MODE_Y, jexjs.getLang(), _afterInitFn );
            }else{  // local 단어 인경우
                //html에 parameter 를 사용하는 경우는 local단어인경우도 변환작업 필요.
                if( _settings.isTranslateLocal ){
                    _changeDom( _CONST.TRANSLATE_MODE_N, jexjs.getLang(), _afterInitFn );
                }else{
                    _afterInitFn();
                }
            }
        }
    }
    
    //settings
    function _setSettings( settings ){
        var lang = jexjs.getLang();
        var localLang = jexjs.getLocalLang();
        
        // local단어와 기본언어 단어가 쿠키에없거나 parameter에 없으면, 기본값은 KO;
        if ( jexjs.empty(lang)){
            if( settings && settings.LANG ){
                setLang( settings.LANG);
            }else{
                setLang("KO");
            }
        }
        if ( jexjs.empty(localLang) ){
            if( settings && settings.LOCAL_LANG ){
                setLocalLang( settings.LOCAL_LANG);
            }else{
                setLocalLang("KO");
            }
        }
        
        if ( settings ){
            if ( settings.jexFunction ){
                var jexFunction = settings.jexFunction;
                for(var fnNm in jexFunction){
                    if ( "function" == typeof jexFunction[fnNm]){
                        _FUNC[fnNm] = jexFunction[fnNm];
                    }
                }
                delete settings.jexFunction;
            }else if (settings.LANG){
                delete settings.LANG;
            }else if (settings.LOCAL_LANG){
                delete settings.LOCAL_LANG;
            }
        }
        
        jexjs.extend( _settings, settings );
    }
    
    //Dom Element의 text 정보를 저장
    function _saveLocalMl(){
        
        if ( _settings.isUseHeader ){
            try{
                var headNodes = document.head || document.getElementsByTagName("head")[0]; // ie8 document.head 없음.
                var localHeadNodes = headNodes.cloneNode(true);
                _readRocalMl( localHeadNodes.childNodes );
            }catch(e){
                jexjs.debug("    jexjs.plugin.ml : _saveLocalMl read head error");
            }
        }
        
        if ( _settings.isUseBody ){
            var bodyNodes = document.body,
            localBodyNodes = bodyNodes.cloneNode(true);
            _readRocalMl( localBodyNodes.childNodes );
        }
    }
    
    //local 단어정보를 메모리에 저장
    function _readRocalMl( nodes ){
        var node = null,
        mlAttrNm = null,
        mlAttrValue = null,
        subAttr = null,
        mlValue = null;
        for(var i=0, len = nodes.length; i < len; i++){
            node = nodes[i];
            if ( 1 == node.nodeType ){  //element 인경우만 처리
                if ( node.hasChildNodes() ){
                    _readRocalMl( node.childNodes );
                }
                for(var j=0, atts = node.attributes, attsLen = atts.length; j < attsLen; j++){
                    mlAttrNm = atts[j].name;
                    mlAttrValue = atts[j].value;

                    if( "" === mlAttrValue.trim() ){    //다국어 key 가 공백이면 무시
                        continue;
                    }
                    
                    if ( mlAttrNm == _ML_ATTR ) {   //다국어 key
                        mlValue = node.innerHTML;
                        if ( jexjs.getLocalLang() == jexjs.getLang() ){    //local언어인경우 local단어 없으면, ajax 호출
                            if ( "" === mlValue.trim() ){
                                var word = getHtmlMlData( null, mlAttrValue, jexjs.getLang() );
                                if (jexjs.empty(word)){
                                    jexjs.debug("    jexjs.plugin.ml : _readRocalMl : "+ mlAttrValue +" 다국어 key의 local단어가 없습니다. 성능개선을 위해 local단어를 추가해주세요.");
                                    _loadViewData();
                                }
                            }
                        }
                        _LOCAL_HTML_ML_DATA[ mlAttrValue ] = node.innerHTML;
                    } else if( _ML_ATTR_OPT_DYNAMIC != mlAttrNm && mlAttrNm.startsWith( _ML_ATTR ) ) {   //attribute 다국어 key
                        subAttr = mlAttrNm.substr(_ML_ATTR.length + 1);
                        _LOCAL_HTML_ML_DATA[ mlAttrValue ] = node.getAttribute(subAttr);
                    }
                }
            }
        }
    }
    
    // domId 나 html contents를 parameter로 받아 다국어 번역된 contents를 return 해 줍니다.
    // display 언어가 local단어와 동일하면 번역하지 않습니다.
    function _translateHtml( p_contents, option ){
        var contents;
        var newContents;
        var async = option.async;
        
        //sync 인경우만 clone 하여 사용
        if ( !async ) {
            if ( jexjs.isNull( p_contents.childNodes ) ){
                newContents = jexjs.$(p_contents).clone(true);
            }else{
                newContents = jexjs.$(p_contents).clone(true)[0];
            }
        }else{
            newContents = p_contents;
        }
        
        if ( jexjs.isNull( newContents.childNodes ) ){
            _readRocalMl( newContents );
            //local언어가 아닌경우
            if ( jexjs.getLocalLang() != jexjs.getLang() ){
                _changeDomNodes( _CONST.TRANSLATE_MODE_Y, newContents , jexjs.getLang() );
            }//local언어인경우
            else{
                if ( _settings.isTranslateLocal ){
                    _changeDomNodes( _CONST.TRANSLATE_MODE_Y, newContents , jexjs.getLang() );
                }
            }
        }else{
            _readRocalMl( newContents.childNodes );
            //local언어가 아닌경우
            if ( jexjs.getLocalLang() != jexjs.getLang() ){
                _changeDomNodes( _CONST.TRANSLATE_MODE_Y, newContents.childNodes , jexjs.getLang() );
            }//local언어인경
            else{
                if ( _settings.isTranslateLocal ){
                    _changeDomNodes( _CONST.TRANSLATE_MODE_Y, newContents.childNodes , jexjs.getLang() );
                }
            }
        }
        return newContents;
    }
    
    //언어변경 이벤트 발생시
    function _change( lang, opt ){

        var param = {
                'LANG' :lang,
                'indicator' : $indicator
        };
        
        if ( "function" == typeof _FUNC.beforeChange ){
            _FUNC.beforeChange.call(undefined, param);
        }
        
        function fn(){
            var localLang = jexjs.getLocalLang();
            
            if ( localLang != lang && jexjs.empty( _CACHED_ML_DATA[ lang ] ) ){
                _loadViewData( lang );
                if ( 0 < _LOAD_VIEW_LIST.length){
                    for(var i=0 ; i < _LOAD_VIEW_LIST.length; i++){ // 다른 load view가 load 된적이 있는 경우는 언어변경시에도 함께 load
                        _addLoadView(_LOAD_VIEW_LIST[i]);
                    }
                }
            }else{
                setLang( lang );    //이미 load된 언어인경우 언어정보만 쿠키에 저장
            }
            _changeDom( _CONST.TRANSLATE_MODE_Y, lang, function(){
                jexjs.loader.reload();
                if ( "function" == typeof _FUNC.afterChange ){
                    _FUNC.afterChange.call(undefined , param);
                }
            });
        }
        
        if ( opt && opt.delay ){
            setTimeout( fn , opt.delay );
        }else{
            fn();
        }
    }
    
    //언어코드에 대한 정보로 Dom 변경
    function _changeDom( isTranslate, lang, callback ){
          if ( _settings.isUseHeader ){
              var headNodes = document.head || document.getElementsByTagName("head")[0]; // ie8 document.heade 없음.
              _changeDomNodes( isTranslate, headNodes.childNodes , lang );
          }
        
          if ( _settings.isUseBody ){
              var bodyNodes = document.body;
              _changeDomNodes( isTranslate, bodyNodes.childNodes, lang );
          }
              
          if ( "function" == typeof callback ){
              callback();
          }
//        var headNodes, newHeadNodes, bodyNodes, newBodyNodes;
//        
//        //ie8 인경우 
//        jexjs.debug("jexjs.plugin.ml [ getHtmlMlData ] : isMsie=" +jexjs.getBrowser().msie+" , version="+ jexjs.getBrowser().version );
//        if ( jexjs.getBrowser().msie && "8.0" == jexjs.getBrowser().version ){
//            if ( _settings.isUseHeader ){
//                headNodes = document.head || document.getElementsByTagName("head")[0]; // ie8 document.heade 없음.
//                _changeDomNodes( headNodes.childNodes , lang );
//            }
//            if ( _settings.isUseBody ){
//                bodyNodes = document.body;
//                _changeDomNodes( bodyNodes.childNodes, lang );
//            }
//        }
//        //ie8 외의 경우
//        else {
//            if ( _settings.isUseHeader ){
//                headNodes = document.head || document.getElementsByTagName("head")[0]; // ie8 document.heade 없음.
//                newHeadNodes = jexjs.$("head").clone(true)[0];
//                _changeDomNodes( newHeadNodes.childNodes , lang );
//            }
//            if ( _settings.isUseBody ){
//                bodyNodes = document.body;
//                newBodyNodes = jexjs.$("body").clone(true)[0];
//                _changeDomNodes( newBodyNodes.childNodes, lang );
//            }
//            if ( _settings.isUseHeader ){
//                headNodes.parentNode.replaceChild(newHeadNodes, headNodes);
//            }
//            if ( _settings.isUseBody ){
//                bodyNodes.parentNode.replaceChild(newBodyNodes, bodyNodes);
//            }
//        }
    }
    
    function _changeDomNodes( isTranslate, newNodes, lang , parentCodeGroup){

        var node = null,
        attrNm = null,
        attrValue = null,
        subAttr = null,
        insertViewId = null,
        isDynamic = null,
        codeManager = _settings.codeManager,
        codeTemplate = null,
        codeGroup = parentCodeGroup,
        mlWord = null,
        params = {};
        
        for(var i=0, len = newNodes.length; i < len; i++){
            node = newNodes[i];
            if ( 1 == node.nodeType ){  //element 인경우만 처리
                
                //view Id
                if ( node.hasAttribute( _ML_ATTR_VIEW_ID )){
                    insertViewId = node.getAttribute( _ML_ATTR_VIEW_ID );
                } else if ( node.hasAttribute( _ML_ATTR_NOMAL_VIEW_ID )){   //사용하지 말것. view id와 동일한처리
                    insertViewId = node.getAttribute( _ML_ATTR_NOMAL_VIEW_ID );
                }else{
                    insertViewId = null;
                }
                
                if ( isTranslate ) {    // 번역이 필요한 경우만 필요
                    //codeGroup 있는 경우
                    if ( node.hasAttribute( _ML_ATTR_CODE_GROUP ) ){
                        codeGroup = codeManager.getCode(node.getAttribute( _ML_ATTR_CODE_GROUP ));
                    }
                    
                    //code template 확인
                    if ( node.hasAttribute( _ML_ATTR_CODE_TEPLATE )){
                        codeTemplate = node.getAttribute( _ML_ATTR_CODE_TEPLATE );
                    }
                }
                //auto insert 여부 확인
                if ( node.hasAttribute( _ML_ATTR_OPT_DYNAMIC )){
                    isDynamic = ( "true" == node.getAttribute( _ML_ATTR_OPT_DYNAMIC ) ? true : false );
                }
                
                for(var j=0, atts = node.attributes, attsLen = atts.length; j < attsLen; j++){
                    attrNm = atts[j].name;
                    attrValue = atts[j].value;
                    
                    if ( "" === attrValue.trim() ) continue;    //다국어 key에 대한 값이 없는 경우 무시
                    
                    if ( attrNm == _ML_ATTR ) { //다국어 key
                        if ( node.hasAttribute( _ML_ATTR_PARAM ) ){
                            params = node.getAttribute( _ML_ATTR_PARAM );
                            if ( jexjs.isJSONExp( params ) ){
                                params = JSON.parse( params );
                            }else{
                                params = {};
                            }
                        }
                        mlWord = getHtmlMlData( insertViewId, attrValue , lang, isDynamic, params );
                        
                        if ( isTranslate || ( !isTranslate && !jexjs.empty(params) ) ) {    // 번역을 하지 않아도 되는 경우는 param이 있는 경우만 다시 변경
                            node.innerHTML = mlWord;
                        }
                    }
                    else if( _ML_ATTR_OPT_DYNAMIC != attrNm && attrNm.startsWith( _ML_ATTR ) ) { //attribute 다국어 key
                        subAttr = attrNm.substr( _ML_ATTR.length + 1);
                        if ( node.hasAttribute( _ML_ATTR_PARAM +"-" + subAttr ) ){
                            params = node.getAttribute( _ML_ATTR_PARAM +"-" + subAttr );
                            if ( jexjs.isJSONExp( params ) ){
                                params = JSON.parse( params );
                            }else{
                                params = {};
                            }
                        }
                        
                        mlWord = getHtmlMlData( insertViewId, attrValue , lang, isDynamic, params );
                        
                        if ( isTranslate || ( !isTranslate && !jexjs.empty(params) ) ) {    // 번역을 하지 않아도 되는 경우는 param이 있는 경우만 다시 변경
                            node.setAttribute(subAttr, mlWord);
                        }
                    }else if ( isTranslate && attrNm == _ML_ATTR_CODE_KEY ){  // code key
                        if ( codeGroup ){
                            if ( codeTemplate ){
                                var codeData = { 
                                     'KEY' : attrValue,
                                    'CODE': codeGroup[attrValue]
                                };
                                setNodeData( node, $template.render(codeTemplate, codeData ));
                            }else{
                                setNodeData( node, codeGroup[attrValue]);
                            }
                        }
                    }
                }
                
                if ( node.hasChildNodes() ){
                    _changeDomNodes( isTranslate, node.childNodes, lang, codeGroup );
                }
            }
        }
    }
    
    //
    function getNodeData ( node ){
        if( "input" == node.tagName.toLowerCase() && "text" == node.getAttribute("type")){
            return node.value;
        }else{
            return node.innerHTML;
        }
    }
    
    //코드인경우 사용
    function setNodeData ( node, value ){
        if( "input" == node.tagName.toLowerCase() && "text" == node.getAttribute("type")){
            node.value = value;
        }else{
            node.innerHTML = value;
        }
    }
    
    /**
     * html local key 를 가져옵니다.
     */
    function _getHtmlLocalData( key ){
        return _LOCAL_HTML_ML_DATA[ key ];
    }
    
    /**
     * HTML 캐시된 단어를 가져옵니다.
     * LANG 단어 > 사전의 LOCAL_LANG의 단어
     */
    function _getHtmlCachedData( key, lang ){
        var mlData = _CACHED_ML_DATA[lang];
        var htmlData = {};
        
        if ( mlData &&  mlData[_ML_TP.HTML] ) {
            htmlData = mlData[_ML_TP.HTML];
            if (htmlData[key]) {
                return htmlData[key];
            }
        }
        return null;
    }
    
    /**
     * javascript local단어를 저장합니다.
     */
    function _setJsLocalData( key, localWrd ){
        _LOCAL_JS_ML_DATA[ key ] = localWrd;
        jexjs.debug("    jexjs.plugin.ml : setJsLocalData :" + JSON.stringify(_LOCAL_JS_ML_DATA));
    }
    
    /**
     * javascript local단어를 가져옵니다.
     */
    function _getJsLocalData( key ){
        return _LOCAL_JS_ML_DATA[ key ];
    }
        
    /**
     * javascript cacheed된 data를 가져옵니다.
     * LANG 단어 > 사전의 LOCAL_LANG의 단어
     */
    function _getJsCachedData( key, lang){
        var mlData = _CACHED_ML_DATA[lang];
        var jsData = {};
        if ( mlData && mlData[_ML_TP.JS] ) {
            jsData = mlData[_ML_TP.JS];
            if (jsData[key]) {
                return jsData[key];
            }
        }
        return null;
    }
    
    /**
     * key에 대한 HTML data 반환
     * local언어인경우 local 사용
     * 그외의 언어인경우
     * HTML LANG 사전단어 > HTML LOCAL 단어 > HTML LOCAL_LANG에 대한 사전단어 > JS LANG 사전단어 > JS LOCAL 단어 > JS LOCAL_LANG에 대한 사전단어
     */
    function getHtmlMlData ( insertViewId, mlKey, lang, isDynamic, params ) {
        
        var localLang = jexjs.getLocalLang();
        insertViewId = insertViewId || _FUNC.setInsertViewId.call(undefined, { 'ML_ID': mlKey, 'ML_TP':_ML_TP.HTML }) || _viewId; 
        var localWrd = _getHtmlLocalData( mlKey );
        var word = null;
        var mlDataOfLang = _CACHED_ML_DATA[ lang ];
        
        if ( jexjs.isNull( mlDataOfLang ) && localLang != lang ) {
            jexjs.debug("    jexjs.plugin.ml : getHtmlMlData :" + lang +" 언어가 load 되어있지 않습니다.");
        }
        
        word  = _getHtmlCachedData( mlKey, lang ) || _getHtmlCachedData( mlKey, localLang ) || _getJsCachedData( mlKey, lang ) || _getJsCachedData( mlKey, localLang ) ;
        
        //다국어 정보를 load 했지만, 다국어 ID가 없는 경우 id insert.
        //일단 dynamic attribute 있는 경우에는 insert 안함.
        if ( _IS_LOADED && jexjs.isNull( word ) ){
            var isInsertMlKey = ( !jexjs.isNull(isDynamic)? !isDynamic : _FUNC.isInsertMlKey.call(undefined, { 'VIEW_ID':insertViewId, 'ML_ID': mlKey, 'ML_TP':_ML_TP.HTML } ));
            if ( isInsertMlKey ){
                _insertMlKey( insertViewId, _ML_TP.HTML, mlKey, localWrd, lang, isDynamic );
            }else{
                jexjs.debug("    jexjs.plugin.ml : getHtmlMlData : viewId=" +insertViewId+" ,mlkey="+ mlKey+" , localwrd="+localWrd+" 를 db에 insert 요청안함");
            }
        }
        
        // local 언어인경우 HTML에 등록된 단어 사용, 없는 경우 사전의 local단어 , js local data
        if( lang == localLang ){
             word = _getHtmlLocalData( mlKey ) || _getHtmlCachedData( mlKey, localLang ) || _getJsLocalData( mlKey ) || _getJsCachedData( mlKey, localLang );
        }
        // local 언어가 아닌경우, 해당언어에 등록된 단어 반환. but, 없는경우 local언어 단어 사용.
        else {
            word  = _getHtmlCachedData( mlKey, lang ) || _getJsCachedData( mlKey, lang );
            if ( jexjs.isNull(word) ){
                word =  _getHtmlLocalData( mlKey ) ||  _getHtmlCachedData( mlKey, localLang ) || _getJsLocalData( mlKey ) ||  _getJsCachedData( mlKey, localLang );
            }
        }
        
        //단어에 parameter가 있는 경우 render
        
        if ( !jexjs.empty(params) ){
            word = _getRenderHtml( word, params );
        }
        
        return word;
    }
    
    /**
     * html에서는 #{ ID } 표현이 불가능하기때문에, #[ ID ] 사용
     */
    function _getRenderHtml( template , param){
        var startVar = '#[',
            endVar = ']',
            changeStartVar = '#{',
            changeEndVar = '}',
            i_start,
            i_end,
            result = '',
            cursor=0;
        
        while (( i_start = template.indexOf(startVar, cursor)) != -1) {
            
            i_end = template.indexOf(endVar, i_start);
            if (i_end === -1) {
                jexjs.error("  template] render error : can not found ']' ");
            }
            result += template.substring(cursor, i_start);
            result = result.concat( changeStartVar );
            result += template.substring(i_start + startVar.length, i_end + endVar.length - 1);
            result = result.concat( changeEndVar );
            cursor = i_end + 1;
        }
        
        result += template.substring(cursor);
        return getRender( result , param );
    }
    /**
     * key에 대한 JS data 반환
     * 해당언어에 다국어 id가 없는 경우 debug 모드인경우 다국어 id insert 하고 다국어정보 다시 불러옴.
     * 우선순위 : local 언어인경우 - parameter로 입력받은 local단어 -> 사전의 local 언어의 단어
     * 우선순위 : local 언어아닌경우 - 현재 언어의 단어 -> parameter로 입력받은 local단어 > 사전의 local 언어의 단어
     */
    function getJsMlData ( mlKey, _localWrd, _param, _option ){
        
        var localWrd = null, param = null, option = null;
        
        if ("string" == typeof _localWrd ){
            localWrd = _localWrd;
            
            param = _param;
            option = _option;
            _setJsLocalData( mlKey, localWrd );
        }else{
            param = _localWrd;
            option = _param;
        }
        
        if( jexjs.isNull(option)){
            option = {};
        }
        
        var lang = option.LANG || jexjs.getLang();
        var localLang = jexjs.getLocalLang();
        var word = null;
        var mlDataOfLang = _CACHED_ML_DATA[ lang ];
        var insertViewId = null;
        
        if ( jexjs.isNull( mlDataOfLang ) && localLang != lang ){
            jexjs.debug("    jexjs.plugin.ml : getJsMlData :" + lang +" 언어가 load 되어있지 않습니다.");
        }
        
        word  = _getJsCachedData( mlKey, lang ) || _getJsCachedData( mlKey, localLang );
        
        //다국어 정보를 load 했지만, 다국어 ID가 없는 경우 id insert
        if ( _IS_LOADED && jexjs.isNull( word ) ){
            insertViewId = option.VIEW_ID || option.NOMAL_VIEW_ID || _FUNC.setInsertViewId.call(undefined, { 'ML_ID': mlKey, 'ML_TP':_ML_TP.JS }) || _viewId; 
            if ( _FUNC.isInsertMlKey.call(undefined, { 'VIEW_ID':insertViewId, 'ML_ID': mlKey, 'ML_TP':_ML_TP.JS } ) ){
                _insertMlKey( insertViewId, _ML_TP.JS, mlKey, localWrd, lang );
            }else{
                jexjs.debug("    jexjs.plugin.ml : getJsMlData : " + insertViewId + " | " + mlKey +" 를 db에 insert 요청안함");
            }
        }
        
        // local언어인경우
        if ( lang == localLang ){
            word = _getJsLocalData( mlKey );
        }// local 언어가 아닌경우
        else{
            word  = _getJsCachedData( mlKey , lang ) || _getJsLocalData( mlKey ) || _getJsCachedData( mlKey , localLang );
        }
        
        return word ? getRender( word , param ): null;
   }
    
    /**
     * lang이 없는 경우는 localLang 데이터 반환, 있는 경우는 해당언어 데이터 반환, "ALL"인경우 전체 데이터 반환
     * @param lang 언어코드
     */
    function _loadViewData( _lang, p_action ){
        
        var lang = _lang || jexjs.getLang();
        
        //언어코드 없는 경우는 local 언어에 대한 다국어정보를 반환
        var action = p_action || _ML_ACTION.SET;
        var jaxAjax = jexjs.createAjaxUtil( _settings.url );
        jaxAjax.set("ACTION", action );
        jaxAjax.set("VIEW_ID", _viewId);
        if ( !jexjs.empty(lang) ){
            jaxAjax.set("LANG", lang);  //ALL로 보내면 전체 언어 가져옮.
        }
        if ( !jexjs.isNull( _settings.prefix ) ){
            jaxAjax.setting('prefix', _settings.prefix  );
        }
        if ( !jexjs.isNull( _settings.suffix ) ){
            jaxAjax.setting('suffix', _settings.suffix  );
        }
        if ( !jexjs.isNull( _settings.contextPath ) ){
            jaxAjax.setting('contextPath', _settings.contextPath  );
        }
        jaxAjax.setting('async', false );
        jaxAjax.setIndicator(false);
        jaxAjax.execute(function(data) {
            jexjs.debug("    jexjs.plugin.ml : _loadViewData:" + _viewId + " 다국어 정보 "+ lang +" 요청!!");
            jexjs.debug("    jexjs.plugin.ml : data:" + JSON.stringify(data));
            
            _IS_LOADED = true; 
            if ( data.ML_DATA ) {
                if ( data.ML_DATA[ data.LANG ] ){
                    _setCacheData( data.ML_DATA[ data.LANG ] , data.LANG );
                }
                if ( jexjs.getLocalLang() != data.LANG &&  data.ML_DATA[ jexjs.getLocalLang() ] ){
                    _setCacheData( data.ML_DATA[ jexjs.getLocalLang() ] , jexjs.getLocalLang() );
                }
            }
            
            if ( action == _ML_ACTION.SET){
                if ( data.LANG ) setLang( data.LANG );
            }
            
            if( data.debug ){
                _IS_ML_DEBUG = data.debug;
            }else{
                _IS_ML_DEBUG = false;
            }
        });
    }
    
    //현재 viewid 페이지 외에 view를 load 합니다.
    function _addLoadView( viewId ){
        _addLoadViewList( viewId ); //추가적으로 load된 view가 있는경우,
        var lang = jexjs.getLang();
        var jaxAjax = jexjs.createAjaxUtil( _settings.url );
        jaxAjax.set("ACTION", _ML_ACTION.LOAD );
        jaxAjax.set("VIEW_ID", viewId);
        jaxAjax.set("LANG", lang);  //ALL로 보내면 전체 언어 가져옮.
        if ( !jexjs.isNull( _settings.prefix ) ){
            jaxAjax.setting('prefix', _settings.prefix  );
        }
        if ( !jexjs.isNull( _settings.suffix ) ){
            jaxAjax.setting('suffix', _settings.suffix  );
        }
        if ( !jexjs.isNull( _settings.contextPath ) ){
            jaxAjax.setting('contextPath', _settings.contextPath  );
        }
        jaxAjax.setting('async', false );
        jaxAjax.setIndicator(false);
        jaxAjax.execute(function(data) {
            jexjs.debug("    jexjs.plugin.ml : _addViewLoad:" + viewId + " 다국어 정보 "+ lang +"추가 요청!!");
            jexjs.debug("    jexjs.plugin.ml : add data:" + JSON.stringify(data));
            if ( data.ML_DATA ) {
                if ( data.ML_DATA[ data.LANG ] ){
                    _setCacheData( data.ML_DATA[ data.LANG ] , data.LANG );
                }
                if ( jexjs.getLocalLang() != data.LANG &&  data.ML_DATA[ jexjs.getLocalLang() ] ){
                    _setCacheData( data.ML_DATA[ jexjs.getLocalLang() ] , jexjs.getLocalLang() );
                }
            }
        });
    }
    
    //load한 다국어 정보를 cache 합니다.
    function _setCacheData( data , lang ){
        
        if ( !_CACHED_ML_DATA[lang] ){
            _CACHED_ML_DATA[lang] = jexjs.clone( data );
        } else{
            jexjs.extend( _CACHED_ML_DATA[lang], data );
        }
        
        // View or JS가 하나도 없는 경우 빈 object 생성.
        if( jexjs.isNull( _CACHED_ML_DATA[lang][_ML_TP.HTML] ) ){
            _CACHED_ML_DATA[lang][_ML_TP.HTML] = {};
        }
        if( jexjs.isNull( _CACHED_ML_DATA[lang][_ML_TP.JS] ) ){
            _CACHED_ML_DATA[lang][_ML_TP.JS] = {};
        }
    }
    
    /**
     * 다국어 debug 모드인경우, view Load 할때 or js key 호출시 등록되지 않은 다국어 key 인경우 DB에 자동으로 insert 한다.
     */
   function _insertMlKey ( insertViewId, mlTp, mlKey, localWrd, lang, isDynamic ){
       jexjs.debug("    jexjs.plugin.ml : _insertMlKey : debug=" + _IS_ML_DEBUG );
       
       if ( _IS_ML_DEBUG && !jexjs.empty(mlKey)){
           jexjs.debug("    jexjs.plugin.ml : _insertMlKey : insertViewId="+insertViewId+", mltp="+mlTp+", mlKey=" + mlKey +" ,localWrd="+ localWrd +" 를 db에 insert 요청");
           var jaxAjax = jexjs.createAjaxUtil( _settings.url );
           jaxAjax.set("ACTION", _ML_ACTION.INSERT );
           jaxAjax.set("ML_TP", mlTp );
           jaxAjax.set("VIEW_ID", insertViewId);
           jaxAjax.set("ML_ID", mlKey );
           if( !jexjs.isNull( localWrd ) ){
               jaxAjax.set("LOCAL_WRD", localWrd );
           }
           jaxAjax.set("CHG_YN", 'Y' );
           jaxAjax.set("USR_REG_YN", 'Y' );
           if ( !jexjs.isNull( _settings.prefix ) ){
               jaxAjax.setting('prefix', _settings.prefix  );
           }
           if ( !jexjs.isNull( _settings.suffix ) ){
               jaxAjax.setting('suffix', _settings.suffix  );
           }
           if ( !jexjs.isNull(_settings.contextPath) ){
               jaxAjax.setting('contextPath', _settings.contextPath  );
           }
           jaxAjax.setIndicator(false);
           jaxAjax.execute(function(data) {
               jexjs.debug("    jexjs.plugin.ml : _insertMlKey : insertViewId="+insertViewId+", mltp="+mlTp+", mlKey=" + mlKey +" ,localWrd="+ localWrd +" 를 db에 insert");
               _loadViewData( lang, _ML_ACTION.LOAD );
           });
       }
   }
   
   function getRender( template , params ){
       if ( params && "object" == typeof params ){
           return $template.render( template , params );
       }else{
           return template;
       }
   }
   
   /**
    * LOAD 된 VIEW LIST 목록에 view id를 추가합니다.
    */
   function _addLoadViewList( viewId ){
       var isAlreadyIncludeView = false; 
       if ( 0 === _LOAD_VIEW_LIST.length ){
           _LOAD_VIEW_LIST.push(viewId);
       }else{
           for(var i=0; i < _LOAD_VIEW_LIST.length; i++){
               if ( viewId == _LOAD_VIEW_LIST[i] ){
                   isAlreadyIncludeView = true;
                   break;
               }
           }
           if( !isAlreadyIncludeView ){
               _LOAD_VIEW_LIST.push(viewId);
           }
       }
   }
    
    //TODO
    function _getJsText( mlKey, lang ){
        var originalText = getJsMlData( mlKey, param, lang );
        return _toJsText( originalText );
    }

    //TODO
    function _getHtmlText( mlKey, lang ){
        var originalText = getHtmlMlData( mlKey, lang);
        return _toHtmlText( originalText );
    }
    
    //TODO
    function _toHtmlText ( text ){
        var htmlText = "";
        //TODO 공백 -> &nbsp;
        //TODO \n -> <br> (html) , <br /> (xhtml)
        return text;
    }
    
    //TODO
    function _toJsText( text ){
        var jsText = "";
        //TODO &nbsp; -> 공백 
        //TODO <br> (html) , <br /> (xhtml) -> \n
        return text;
    }
    
    return {
        /**
         * 객체 생성시 처리할 로직
         */
        init: function( settings ) {
            _init( settings );
        },
        getViewId : function(){
            return _viewId;
        },
        /**
         * 함수를 추가합니다. 
         * setViewId , beforeChange, afterChange, change function
         */
        addFunction : function(fnNm , fn ){
            if ( "function" == typeof fn ){
                _FUNC[fnNm] = fn ;
            }
        },
        /**
         * 언어코드에 다국어정보를 가져온뒤 Dom Element 변경
         * @param lang 언어코드
         */
        change : function( lang, opt ){
            _change(lang, opt);
        },
        /**
         * 입력한 그대로의 값을 반환
         * @param {string} mlKey 다국어 key
         * @param {string} localWrd local단어
         * @param {JSONObject} param
         * @param {JSONObject} option { "VIEW_ID" : "COM_ID" };
         * @example jexjs.plugin("ml").get("key1","{USR_NM} 님 안녕하세요.",{"USR_NM":"이름"}, { "VIEW_ID" : "login_0001_01" });
         *  jexjs.plugin("ml").get("key1", {"USR_NM":"이름"}, { "VIEW_ID" : "login_0001_01" });
         */
        get : function ( mlKey, localWrd, param, option ){
            return getJsMlData.apply(this, arguments );
        },
        /**
         * 해당언어로 번역한 html을 반환합니다.
         */
        translateHtml : function( contents , opt ){
            if ( !opt ){ opt = {};}
            opt.async  = false;
            return _translateHtml( contents, opt );
        },
        asyncTranslateHtml : function( contents , opt ){
            if ( !opt ){ opt = {};}
            opt.async  = true;
            _translateHtml( contents, opt );
        },
        /**
         * viewId를 load 합니다.
         */
        addLoadView: function( viewId ){
            _addLoadView( viewId );
        }
        //,
        /**
         * js용 다국어 정보 반환
         */
//        getJsText : function( mlKey, param, lang ){
//            return _getJsText( mlKey, param, lang );
//        },
        /**
         * html용 다국어 정보 반환
         */
//        getHtmlText : function( mlKey, lang ){
//            return _getHtmlText( mlKey, lang );
//        }
    };
},true );

/**
 * 현재 display되고 있는 언어가 무엇인지 상관없이 프로젝트의 local언어가 무엇인지 반환한다. 
 */
jexjs.getLocalLang = function() {
    return jexjs.cookie.get("JEX_LOCAL_LANG");
};

/**
 * 현재 display되고 있는 언어가 무엇인지, 언어코드를 반환한다.
 * 언어코드는 ISO 639-1 2bytes 언어코드를 따른다.
 */
jexjs.getLang = function() {
    return jexjs.cookie.get("JEX_LANG");
};

/**
 * 되도록 사용하지 말것!!
 * 씨티에서만 사용.
 * - 언어버튼 눌렀을때 location 후 해당 언어로 표시해주기 위해 사용.
 * - 쿠키만 변경하고 location  되지 않으면, display 된 값과 쿠키값이 다른경우가 발생하여 새로고침시 언어 변경될수있음
 */
jexjs.setLang = function( lang ) {
    jexjs.cookie.set("JEX_LANG", lang);
};

/**
 * Mobile인 경우 App에서 언어가 변경된 경우 Web으로 언어변경을 알린다.
 * 
 */
jexjs.setChangeLangListener = function( fn ) {
    if ( "function" == typeof fn ) {
        if ( jexjs._isJexMobile() ) {
            jexMobile._addCallFunctionFromNative( 'appcall_changeLang', fn);
        } else {
            jex.warn("jex.mobile.js 에서만 사용가능한 함수입니다.");
        }
    }
};

/**
 * Mobile인 경우 Web에서 언어변경시 App으로 언어변경을 알린다.
 */
jexjs.noticeChangeLang = function ( lang ) {
    if ( jexjs._isJexMobile() ) {
        jexMobile.callNative('changeLang', {'JEX_LANG':lang });
    } else {
        jex.warn("jex.mobile.js 에서만 사용가능한 함수입니다.");
    }
};
/* ==================================================================================
 * pageloader
 *
 * jexjs.plugin('pageloader');
 * ================================================================================== */

jexjs.plugins.define('pageloader', function( ) {
    
    var _pageInfo = {
        'onload': null,     //실제 onload 된경우 발생하는 이벤트
        'reload' : null,    //실제로는 onload 되지않았지만, load 해야하는 경우 사용되는 event
        'event' : null      //event
    };
    
    function _onload(){
        
        var i, max;
        var beforeOnload = jexjs.loader.getBeforeOnload();
        var afterOnload = jexjs.loader.getAfterOnload();
        var beforeReload = jexjs.loader.getBeforeReload();
        var afterReload = jexjs.loader.getAfterReload();
        
        var fn = null;
        for( i=0, max = beforeOnload.length; i < max; i++ ){
            fn = beforeOnload.pop();
            fn();
        }
        
        for( i=0, max = beforeReload.length; i < max; i++ ){
            beforeReload[i]();
        }

        // TODO queue 사용하도록 변경
        if ( "function" == typeof _pageInfo.onload ){
            _pageInfo.onload();
        }
        
        if ( "function" == typeof _pageInfo.reload ){
            _pageInfo.reload();
        }
        
        for( i=0, max = afterReload.length; i < max; i++ ){
            afterReload[i]();
        }
        
        for( i=0, max = afterOnload.length; i < max; i++ ){
            fn = afterOnload.pop();
            fn();
        }
    }
    
    function _reload(){
        if ( "function" == typeof _pageInfo.reload ){
            _pageInfo.reload();
        }
    }
    
    return {
        /**
         * 객체 생성시 처리할 로직
         */
        init: function( pageInfo ) {
            
            var self = this;
            jexjs.loader.pushInstance( this );
            
            for( var prop in pageInfo){
                if ( undefined !== _pageInfo[prop] && "function" == typeof pageInfo[prop]){
                    _pageInfo[prop] = pageInfo[prop];
                }
            }
            
            $(document).ready(function() {
                self.onload();
            });
            
            if ( "function" == typeof _pageInfo.event ){
                _pageInfo.event.apply(this, arguments);
            }
        },
        onload : function(){
            _onload();
        },
        reload : function(){
            _reload();
        },
        bindAllEvent : function(){
            if ( "function" == typeof _pageInfo.event ){
                _pageInfo.event.apply(this, arguments);
            }
        },
        addEvent : function( selector, eventId, fn ){
            jexjs.debug("    jexjs.plugin.pageloader : addEvent: "+selector+","+eventId);
            
            if( "function" == typeof fn){
                //TODO 추후에 이벤트 jquery 대신에 script로 변경
                jexjs.$( selector ).bind( eventId, function(){
                   fn.apply(this, arguments); 
                });
                
            }else{
                jexjs.error("    jexjs.plugin.pageloader : addEvent : function만 event에 추가할 수 있습니다.");
            }
        }
    };
});

jexjs.createPageloader = function( pageInfo ){
    return jexjs.plugin("pageloader", pageInfo );
};
/* ==================================================================================
 * queue 플러그인은 비동기로 실행되는 함수들을 순차적으로 호출하기 위한 용도로 사용된다.
 *
 * jexjs.plugin('queue');
 * ================================================================================== */
jexjs.plugins.define('queue', function() {

    var jobList = [];
    var isRun = false;

    var _next = function( addedJob ) {
        if (typeof addedJob === 'function') {
            jobList.push( addedJob );
        }

        if ( !isRun ) {
            if (jobList.length > 0) {
                isRun = true;

                var job = jobList.shift();
                
                job(function() {
                    isRun = false;
                    _next();
                });
            }
        }
    };

    return {
        next: function( job ) {
            _next( job );
            return this;
        }
    };
});


/* ==================================================================================
 * screenshot 플러그인은 화면에 출력된 html document를 이미지파일로 렌더링해주는 플러그인이다.
 *  - Dependency : html2canvas ( http://html2canvas.hertzen.com/ )
 *
 * jexjs.plugin('screenshot');
 * ================================================================================== */
jexjs.plugins.define('screenshot', [], function ( ) {

    var _IFRAME_ATTR = "jex_screenshot_iframe",
    _IFRAME_IMG_ATTR = "jex_screenshot_iframe_img",
    iframeMap = {};

    function log(msg) {
        return 'jexjs.plugins.screenshot : ' + msg;
    }

    function randomIframeKey() {
        return Math.ceil(Date.now() + Math.random() * 10000000).toString();
    }

    if (!window.html2canvas) {
    	if( jexjs.getBrowser().msie && 9 > parserFloat(jexjs.getBrowser().version) ){
    		jexjs.error( log('screenshot 플러그인은 IE9+ 부터 지원합니다.') );
    	}else{
    		jexjs.error( log('html2canvas가 정의되지 않았습니다.') );
    	}
    }

    //임시로 생성했던 iframe img 태그 삭제
    function clearIframeImage( iframeElement, jexQueue ) {
        console.log("## clear iframe src::"+ iframeElement.src);
        var documentElement = iframeElement.contentWindow.document.documentElement;
        var iframeList = documentElement.querySelectorAll("iframe");
        
        if( iframeList.length > 0 ) {
            for( var i=0, len = iframeList.length; i < len; i++ ) {
                clearIframeImage( iframeList[i] , jexQueue );
            }

        }       
        
        if ( jexjs.empty( iframeElement.getAttribute(_IFRAME_ATTR ) )){
            return false;
        }

        jexQueue.next(function( next ){
            var iframeKey = iframeElement.getAttribute( _IFRAME_ATTR );
            var imgList = iframeElement.parentElement.getElementsByTagName("img");
            var key = null;
            for(var i=0; i < imgList.length; i++){
                key = imgList[i].getAttribute( _IFRAME_IMG_ATTR );
                if ( !jexjs.empty(key) && iframeKey == key ) {
                    imgList[i].remove();
                    break;
                }
            }
            iframeElement.removeAttribute( _IFRAME_ATTR );
            console.log("## clear iframe src::"+ iframeElement.src + "iframeMap["+ iframeKey +"] " +iframeMap[iframeKey]  );
            iframeElement.style.display =  iframeMap[iframeKey];
            delete iframeMap[iframeKey];
            next();
        });
    }

    //screenshot을 찍기위해 iframe을 img로 변경
    function iframeToTempImage( iframeElement, jexQueue ){
        jexjs.debug("    jexjs.plugin.screenshot : iframeToTempImage : cur iframe name="+ iframeElement.getAttribute("name"));
        var documentElement = iframeElement.contentWindow.document.documentElement;
        var iframeBody = iframeElement.contentWindow.document.body;
        var iframeList = documentElement.querySelectorAll("iframe");
        
        //빈 iframe 이거나 화면에 보이지 않는 경우는 image randering 안함
        if ( 0 === iframeBody.childNodes.length || 
            "none" == jexjs.cssUtil.getComputedStyle(iframeElement, "display") || 
            ( !jexjs.empty(iframeElement.getAttribute("name")) && -1 !== iframeElement.getAttribute("name").indexOf("jexQms") )
        ) {
            jexjs.debug("    jexjs.plugin.screenshot : iframeToTempImage : "+iframeElement.getAttribute("name")+" image randering 안함");
            return false;
        }
        
        //하위 iframe 먼저 처리
        if( iframeList.length > 0 ) {
            for( var i=0,len=iframeList.length; i < len; i++ ) {
                jexjs.debug("    jexjs.plugin.screenshot : iframeToTempImage : child iframe name="+ iframeList[i].getAttribute("name"));
                iframeToTempImage( iframeList[i] , jexQueue );
            }
        }
        jexjs.debug("    jexjs.plugin.screenshot : iframeToTempImage :"+iframeElement.getAttribute("name")+" image randering 시작");

        jexQueue.next(function( next ){
          var height = Math.max(Math.max(iframeBody.scrollHeight, documentElement.scrollHeight), Math.max(iframeBody.offsetHeight, documentElement.offsetHeight), Math.max(iframeBody.clientHeight, documentElement.clientHeight));
          html2canvas( iframeBody , {
            //foreignObjectRendering : true,
            height : height,
            logging: false
          }).then(function(canvas) {

            var iframeRandomKey = randomIframeKey();
            var img = document.createElement('img');
            img.setAttribute( _IFRAME_IMG_ATTR , iframeRandomKey );
            img.src = canvas.toDataURL();
            iframeElement.setAttribute( _IFRAME_ATTR, iframeRandomKey );
            //iframeElement.before( img );
            iframeElement.parentElement.insertBefore(img, iframeElement)
            console.log("## capture iframe name::"+ iframeElement.getAttribute("name")+", src::"+ iframeElement.src +", iframeRandomKey::" + iframeRandomKey + ", display:"+ iframeElement.style.display);
            iframeMap[iframeRandomKey]=  iframeElement.style.display;
            iframeElement.style.display =  "none";
            next();
          });
      });
    }

    function toCanvas( _callback, _elem ) {
        var jexQueue = jexjs.plugin("queue");
        var elem = _elem || document.body;
        var iframeList = elem.querySelectorAll("iframe");
        var doc = document.documentElement;
        var left = (window.pageXOffset || doc.scrollLeft) - (doc.clientLeft || 0);
        var top = (window.pageYOffset || doc.scrollTop)  - (doc.clientTop || 0);

        window.scrollTo(0, 0);
        if ( iframeList.length > 0 ) {
            for( var i=0, len = iframeList.length; i < len; i++ ) {
                jexjs.debug("    jexjs.plugin.screenshot : toCanvas : child iframe name="+ iframeList[i].getAttribute("name"));
                iframeToTempImage( iframeList[i] , jexQueue );
            }
        }

        jexQueue.next(function( next ){
            html2canvas( elem, {
                //foreignObjectRendering: true,
                logging: false
            }).then(function(canvas) {

                var jexSubQueue = jexjs.plugin("queue");
                jexSubQueue.next(function( subNext ){
                    if ( iframeList.length > 0 ) {
                        for( var i=0, len = iframeList.length; i < len; i++ ) {
                            clearIframeImage( iframeList[i] , jexSubQueue );
                        }
                    }
                    subNext();
                }).next(function( subNext ){
                    canvas.removeAttribute("style");    //canvas size를 지정해버려서 제거.
                    window.scrollTo(left, top);
                    if (typeof _callback === 'function') {
                        _callback( canvas );
                    }
                    subNext();
                });
            });
        });
   }

    function toImage( _callback, _elem ) {
        toCanvas(function(canvas) {
            var img = document.createElement('img');
            var dataUrl = canvas.toDataURL();
            img.src = dataUrl;
            if (typeof _callback === 'function') {
                _callback( img );
            }
        }, _elem);
    }

    function toBlob( _callback, _elem ) {
        toCanvas(function(canvas) {
            var dataUrl = canvas.toDataURL();
            var blob = jexjs.dataURLtoBlob(dataUrl);
            if (typeof _callback === 'function') {
                _callback( blob );
            }
        }, _elem);
    }
    
    function toDataURL( _callback, _elem ) {
        toCanvas(function(canvas) {
            var dataUrl = canvas.toDataURL();
            if (typeof _callback === 'function') {
                _callback( dataUrl );
            }
        }, _elem);
    }

    return {
        toCanvas: function( callback, elem ) {
            toCanvas(callback, elem);
        },
        toImage: function( callback, elem ) {
            toImage(callback, elem);
        },
        toBlob: function( callback, elem ) {
            toBlob(callback, elem);
        },
        toDataURL: function( callback, elem ) {
            toDataURL(callback, elem);
        }
    };
});
/* ==================================================================================
 * template 플러그인은 '문자열 템플릿'과 '변수 맵'을 통해서 하나의 완성된 '문자열'을 만들어주는 플러그인이다.
 *
 * var BANNER_TEMPLATE = 'Welcome to #{ title }. #{ loginUser.loginId }님이 로그인 하였습니다.';
 * var params = {
 *   'title': 'jexjs',
 *   loginUser: {
 *      'loginId': 'helloworld'
 *   }
 * }
 *
 * 일 때, 위 두 재료를 합하여
 *
 *      'Welcome to jexjs. helloworld님이 로그인하였습니다.
 *
 * 를 완성해준다.
 *
 *
 * jexjs.plugin('template');
 * ================================================================================== */
jexjs.plugins.define('template', function() {

    var NOT_FOUND_PARAM = 'undefined';

    function render(_template, params) {
        var
            result = '',
            cursor = 0, // work pointer
            startVar = '#{',
            endVar = '}'
        ;

        (function() {
            var i_start,
                i_end;

            while (( i_start = _template.indexOf(startVar, cursor)) != -1) {
                i_end = _template.indexOf(endVar, i_start);

                if (i_end === -1) {
                    jexjs.error("  template] render error : can not found '}' ");
                }

                result = result + _template.substring(cursor, i_start);

                var this_var = _template.substring(i_start + startVar.length, i_end + endVar.length - 1);

                /*jshint evil: true*/
                var fn = new Function('localScope', 'return localScope.' + this_var);

                var fnResult = NOT_FOUND_PARAM;
                try {
                    fnResult = fn(params);

                    if ( 'undefined' == typeof fnResult) {
                        fnResult = NOT_FOUND_PARAM;
                    }
                } catch(e) { }

                result = result + fnResult;
                cursor = i_end + 1;
            }

            result = result + _template.substring(cursor);
        })();

        return result;
    }


    return {
        init: function( ) {

        },

        /**
         * String 템플릿과 parameter를 합쳐서 완성된 String을 만든다.
         *
         * @method render
         * @param {String} key || template
         * @param {Object} params
         * @returns {String}
         */
        render: function(_keyOrTemplate, params, option) {
            if ( option ) {
                if ( "string" == typeof option.NOT_FOUND_PARAM) {
                    NOT_FOUND_PARAM = option.NOT_FOUND_PARAM;
                }
            }
            var self = this,
                template = self.get(_keyOrTemplate) || _keyOrTemplate;

            return render(template, params);
        },
        renderSpace : function( _keyOrTemplate, params ) {
            return this.render( _keyOrTemplate, params, {
                'NOT_FOUND_PARAM' : ''
            });
        },
        add: function(_id, _template) {
            jexjs.global.plugins.template._list[_id] = _template;
        },
        get: function(_id) {
            return jexjs.global.plugins.template._list[_id];
        },
        _registerFromDom: function() {
            var self = this,
                domTemplateList = document.getElementsByTagName("jex-template"),
                scriptTemplateList = document.getElementsByTagName("script"),
                i, length = domTemplateList.length
                ;

            for (i = 0; i < length; i++) {
                var domTemplate = domTemplateList[i],
                    domId = domTemplate.getAttribute('id'),
                    domText = domTemplate.innerHTML.trim()
                ;

                self.add(domId, domText);
            }

            length = scriptTemplateList.length;
            for( i = 0; i < length; i++) {
                var scriptTemplate = scriptTemplateList[i],
                    scriptId = scriptTemplate.getAttribute('id'),
                    scriptType = scriptTemplate.getAttribute('type'),
                    scriptText = scriptTemplate.innerHTML.trim()
                ;

                if (scriptId && scriptType === "text/jex-template") {
                    self.add(scriptId, scriptText);
                }
            }
        }
    };
}, true);

//jexjs.global.plugins.template.tag = "jex-template"; 옵션
jexjs.global.plugins.template._list = {};

/**
 * 기본 template 정의
 * */
jexjs.template = (function( ){
    return jexjs.plugin("template");
}());

$(document).ready(function() {
    jexjs.plugin("template")._registerFromDom();
});

/**
 * file upload 플러그인 <br />
 *
 * iframe 을 이용하여 form 전송을 통하여 file을 업로드 한다.
 *
 * var file_uploader = jexjs.plugin("file_upload"); <br />
 *
 * @class jexjs.plugins.file_upload
 */

jexjs.plugins.define('upload', function() {

    var _global = jexjs.global.plugins.upload || jexjs.global.plugins.file_upload; //기존 upload와 호환성유지
    var _checkType = null;  //file type과 data타입은 함께 사용할 수 없으므로 valid check 
    var _parameter = {};    // file외의 일반 text data
    var formData = null;
    try {
        formData = new FormData();  //실제 ajax 호출시 사용되는 data
    } catch( e ){
        jexjs.debug("    jexjs.plugin.upload : "+ e);
        jexjs.debug("    jexjs.plugin.upload : IE10 이상만 지원합니다.");
    }
    var form_file_upload_id = "jex_file_upload_form";
    var random = new Date().getTime(),
        template_form = '<form method="post" enctype="multipart/form-data" style="position:absolute; top: -1000px; left: -1000px;"></form>',
        template_iframe = '<iframe style="display:none;"></iframe>',
        template_file = '<input type="file" />',
        template_submit = '<input type="submit" value="upload" />';

    var contextPath = _global.contextPath || "",
        prefix = _global.prefix || "",
        suffix = _global.suffix || ".jct",
        url,
        $form,
        $targetFrame,
        files = [];
    

    var _AjaxUploadSuccess = function( data ){
        
    };
    
    var _AjaxUploadError = function( data ) {
        var code = jexjs.null2Void(jexjs.getJexErrorCode( data ));
        var msg = jexjs.null2Void(jexjs.getJexErrorMessage( data ));
        alert("[ "+ code +" ]" + msg );
    };
    
    //TODO 파일들 각각 업로드 되도록 기능구현하자.
    //TODO progressbar
    //TODO totalSize 계산
    var options = {
            type : "file",      // file : 일반 input type, data : 파일선택화면을 띄우지 않고 data로 입력받은경우.
            async : true,       // aysnc 여부
            multiple : false,   // input type="file" 에서 다건파일 선택가능여부
            reset: true,        // input type="file" 선택시 새로 file 선택하지 않고 추가된파일 계속 가지고있을건지 여부
            name : "FILE_NM",   // 파일 전송시 사용할 기본 input domain 필드명
            dragrable : false,  // drag 설정여부
            isIndicator : false,  // indicator 사용여부
            indicator : null    // indicator 객체
            //TODO allowedExtensions : []  //파일확장자
            //TODO allowedMaxCount : 10,
            //TODO allowedMaxSize : 
            //TODO autoUpload : false
    };
    
    var element = {
            'drop' : null   //drop 되면 파일추가될 영역
    };
    
    var events = {
            onDrop : null,
            onDragover : null,
            onDragleave : null
//            ,
//            onProgress : function( e ){
//                if (e.lengthComputable) {
//                    var percentComplete = e.loaded / e.total;
//                    percentComplete = parseInt(percentComplete * 100);
//                    console.log(percentComplete);
//                    if (percentComplete === 100) {
//
//                    }
//                }
//            }
    };
    
    if ( _global.options ){
        jexjs.extend( options, _global.options );
    }
    
    function _callUserEvent( eventName, e){
        if ( jexjs.isFunction( events[eventName] ) ) {
            events[eventName].call(null, e);
        }
    }
    
    function onDragoverHandler( e ) {
        jexjs.event.preventDefault(e);
        _callUserEvent('onDragover', e);
    }
    
    function onDragleaveHandler( e ) {
        jexjs.event.preventDefault(e);
        _callUserEvent('onDragleave', e);
    }
    
    function onDropHandler( e ) {
        jexjs.event.preventDefault(e);
        
        //drop 할때, 단건인경우는 파일추가되지 않도록 구현.  
        var addFiles = e.target.files || e.dataTransfer.files;
        if( !options.multiple && 1 < addFiles.length ) {
            return false;
        }
        _addFile( e, events.onDrop );
    }
    
    function onChangeHandler( e , _callback ) {
        _addFile( e, _callback );
    }
    
    function _resetFile(){
        files = [];
        formData = new FormData();
    }
    
    function _addFile( e , callback ) {
        var addFiles = e.target.files || e.dataTransfer.files;
        
        //로그출력 추가된 파일
        if ( !jexjs.empty(addFiles)){
            for(var k=0; k < addFiles.length; k++){
                jexjs.debug("    jexjs.plugin.upload : addFiles["+k+"]::"+ addFiles[k].name);
            }
        }
        
        if ( options.reset ){
            _resetFile();
            files = addFiles;
        }else {
            for(var i=0; i < addFiles.length; i++){
                var isDuplicate = false;
                for(var j=0; j < files.length; j++){
                    if ( files[j].name == addFiles[i].name){
                        jexjs.debug("    jexjs.plugin.upload : overwrite file::"+ addFiles[i].name);
                        files[j] = addFiles[i];
                        isDuplicate = true;
                    }
                }
                if ( !isDuplicate ){
                    files.push(addFiles[i]);
                }
            }
        }
        
        //로그출력 전체파일
        if ( !jexjs.empty(files)){
            for(var l=0; l < files.length; l++){
                jexjs.debug("    jexjs.plugin.upload : files["+l+"]::"+ files[l].name);
            }
        }
        
        if (typeof callback === "function") {
            if ( options.multiple ){
                callback( jexjs.clone(files), addFiles, {'event': e } );
            } else {
                callback( jexjs.clone(files)[0], addFiles, {'event': e } );
            }
        }
    }
    
    function initDragAndDrop ( option ) {
        if( option.dragrable ) {
            jexjs.event.attach( element.drop, 'drop', onDropHandler );
            jexjs.event.attach( element.drop, 'dragover', onDragoverHandler );
            jexjs.event.attach( element.drop, 'dragleave', onDragleaveHandler );
        }
    }
    
    function isAllowedExtension ( fileName ) {
        var isValid = false;
        
        if( 0 === options.allowedExtensions.length ) {
            return true;
        }
        
        jexjs.each( options.allowedExtensions , function(idx, ext) {
            if (jexjs.isString(ext)) {
                var extRegex = new RegExp("\\." + ext + "$", "i");
                if (fileName.match(extRegex) !== null) {
                    valid = true;
                    return false;
                }
            }
        });

        return isValid;
    }
    
    function init( _url , option ) {
        
        if ( option ) {
            
            if ( option.event ) {
                jexjs.extend( events, option.event, false );
                delete option.event;
            }
            
            if ( option.element ) {
                for( var key in option.element ) {
                    var elem = option.element[key];
                    element[key] = jexjs._getHtmlElement( option.element[key] );
                }
                delete option.element;
            }
            
            if ( option.indicator ) {
                options.isIndicator = true;
            }
            settings( option );
            
            initDragAndDrop( option );
        }
        
        initDom();

        url = _url;

        $form.attr({
            'action': getUrl( _url ),
            'target': $targetFrame.attr('name')
        });
        
    }
    
    function settings ( key, value ){
        if ( typeof key === 'object' ){
            for( var k in key){
                _settings( k, key[k]);
            }
        }else if ( typeof key === 'string'){
            _settings( key, value );
        }
    }
    
    function _settings ( key, value ){
        if ( 'contextPath' === key ){
            contextPath = value;
        }else if ( 'prefix' === key ){
            prefix = value;
        }else if ( 'suffix' === key ){
            suffix = value;
        }
        options[ key ] = value;
    }
    
    function getUrl( _url ){
        var fullUrl = "";
        
        if ( !jexjs.empty( contextPath )){
            fullUrl += contextPath + "/" ;
        }
        if ( !jexjs.empty( prefix )){
            fullUrl += prefix + "/" ;
        }
        
        //id에 .jct 확장자 넘어온경우
        if ( -1 != fullUrl.indexOf(".jct") && ".jct" == suffix) {
            fullUrl +=  _url;
        } else {
            fullUrl +=  _url + suffix;
        }
        
        return fullUrl;
    }

    function initDom() {
        var random = new Date().getTime();
        $form = jexjs.$('#' + form_file_upload_id + "_" + random);
        if ($form.length === 0) {
            $form = jexjs.$(template_form);
            $form.appendTo("body");
        }

        if ($form.find('input[type=submit]').length === 0) {
            $form.append(jexjs.$(template_submit));
        }

        $form.off('submit').on('submit', function(event) {
            
            var $inputFile = $(jexjs.$(this).find("input[type=file]")[0]);

            if ( "file" == options.type ) {
                //파일 다건 선택
                if ( options.multiple ){
                    var _files = files;
                    for( var i = 0; i < _files.length; i++ ){
                        formData.append( options.name , _files[i] );
                    }
                }//파일 단건 선택
                else{
                    formData.append( options.name , $inputFile[0].files[0] );
                }
            }
            
            //file 객체외의 데이터가 있는 경우 추가
            if ( _parameter ) {
                for( var key in _parameter ) {
                    if ( "object" == typeof _parameter[key] ) {
                        formData.append(key, JSON.stringify( _parameter[key] ));
                    } else {
                        formData.append(key, _parameter[key] );
                    }
                }
            }
            
            if( options.dragrable && !options.isIndicator ) {
                options.indicator = jexjs.plugin("indicator", {
                    target : element.drop
                });
            }
            
            if ( options.indicator ) {
                options.indicator.show();
            }
            
            jQuery.ajax({
                xhr: function(){
                    var xhr = new window.XMLHttpRequest();
//                    xhr.upload.addEventListener("progress", function(e) {
//                        events.onProgress.call(null, e );
//                    }, false);
                    return xhr;
                },
                url: getUrl(url),
                type: 'POST',
                data: formData,
                async: options.async,
                cache: false,
                processData: false,
                contentType: false,
                success: function(data, textStatus, jqXHR) {
                    if ( options.indicator ) {
                        options.indicator.hide();
                    }
                    if ( jexjs.isJexError( data )){
                        _AjaxUploadError( data );
                    } else {
                        _AjaxUploadSuccess( data );
                    }
                },
                error: function(jqXHR, textStatus, errorThrown) {
                    if ( options.indicator ) {
                        options.indicator.hide();
                    }
                    jexjs.warn("    jexjs.plugin.upload:: error :: "+textStatus);
                }
            });

            return false;
        });

        $targetFrame = jexjs.$(template_iframe);
        $targetFrame.attr('name', 'jex_fileupload_frame');
        $targetFrame.appendTo("body");
    }
    
    function add(_callback) {
        
        var $input_file = $($form.find('input[name=' + options.name + ']')[0]);
        
        if (typeof $input_file !== 'undefined') {
            $input_file.remove();
        }
            
        $input_file = jexjs.$(template_file)
            .attr({
                'id': options.name,
                'name': options.name
            });

        if ( options.multiple ){
            $input_file.prop("multiple",true);
        }
        
        $form.append($input_file);
        
        $input_file.on('change', function( e ) {
            onChangeHandler( e, _callback );
        });

        $input_file.click();
    }
    
    function addFormData( value ){
        formData.append( options.name, value );
    }
    
    function _removeFile( orgFileName ) {
        var file, newFiles = [];
        var isRemove = false;
        for ( var i = 0; i < files.length; i++ ){
            file = files[i];
            if ( orgFileName != file.name ){
                newFiles.push(file);
            }else{
                isRemove = true;
            }
        }
        files = newFiles;
        if ( isRemove ){
            jexjs.debug("    jexjs.plugin.upload : remove file::"+ orgFileName);
            return 1;
        }
        return 0;
    }
    
    function removeFileList(orgFileName, _callback ){
        var removeCount = 0;
        var count = 0;
        var removedFiles = [];
        if (  jexjs.isString( orgFileName ) ) {
            removeCount =  _removeFile(orgFileName);
        }else if ( jexjs.isArray(orgFileName) ) {
            for(var i=0; i < orgFileName.length; i++){
                count = _removeFile( orgFileName[i] );
                if ( count == 1 ) {
                    removedFiles = orgFileName[i];
                }
                removeCount+=count;
            }
        }
        
        _callback( jexjs.clone(files), removedFiles, {'removedCount': removeCount});
    }
    
    function upload(_callback) {
        
        if ( "function" == typeof _callback ){
            _AjaxUploadSuccess = _callback;
        }else {
            if( "function" == typeof _callback.success ){
                _AjaxUploadSuccess = _callback.success;
            }
            if( "function" == typeof _callback.error ){
                _AjaxUploadError = _callback.error;
            }
        }
        $form.find('input[type=submit]').click();
        _resetFile();
    }

    function setUrl(_url) {
        url = _url;
        $form.attr('action', getUrl(_url) );
    }

    return {
        init: function(_url , option) {
            init(_url, option);
        },
        /**
         * 일반데이터 추가
         * 
         */
        setData : function( key , value ){
            jexjs.extend(_parameter, key, value);
        },
        /**
         * 파일추가
         * @param name input type=file 인 필드의 name
         * @param fileData input type=file element를 사용하여 파일 추가하는 경우는 callback 함수. 아닌경우는 blob data
         */
        add: function( fileData ) {
            
            var type = "file";
            if ( "function" != typeof fileData ) {
                type = "data";
                options.type = type;
            }
            
            if ( null === _checkType ) {
                _checkType = type;
            } else {
                if ( _checkType != type ) {
                    jexjs.error("    jexjs.plugin.upload:: file Type과 data Type을 함께 사용할 수 없습니다. ");
                }
            }
            
            if ( "function" == typeof fileData ) {  //File 선택하여 추가
                add(fileData);
            } else {    //File Data 추가
                addFormData(fileData);
            }
        },
        /**
         * 파일삭제
         * @param name input type=file 인 필드의 name
         * @param fileNameList
         * @param callback
         */
        remove : function( fileNameList , callback) {
            removeFileList( fileNameList , callback);
        },
        /**
         * 파일업로드
         */
        upload: function(_callback) {
            upload(_callback);
        },
        url: function(_url) {
            setUrl(_url);
        }
    };
});

/**
 * 파일업로드 공통 설정
 */
jexjs.fileUploadSetup = function( settings ){

    if (jexjs.isNull( settings )) {
        return;
    }

    var globalFileUpload = jexjs.global.plugins.upload || jexjs.global.plugins.file_upload; //기존 upload와 호환성유지
    
    //settings
    if (typeof settings.prefix === 'string') {
        globalFileUpload.prefix = settings.prefix;
        delete settings.prefix;
    }
    if (typeof settings.suffix === 'string') {
        globalFileUpload.suffix = settings.suffix;
        delete settings.suffix;
    }
    if (typeof settings.contextPath === 'string') {
        globalFileUpload.contextPath = settings.contextPath;
        delete settings.contextPath;
    }
    
    globalFileUpload.options = settings;
    
};
})();