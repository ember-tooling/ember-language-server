const fs = require('fs');
const entry = './dist/bundled/start-worker-server.js';
const stringToRemove = `t.promisify=function(e){if("function"!=typeof e)throw new TypeError('The "original" argument must be of type Function');if(D&&e[D]){var t;if("function"!=typeof(t=e[D]))throw new TypeError('The "util.promisify.custom" argument must be of type Function');return Object.defineProperty(t,D,{value:t,enumerable:!1,writable:!1,configurable:!0}),t}function t(){for(var t,r,n=new Promise((function(e,n){t=e,r=n})),i=[],s=0;s<arguments.length;s++)i.push(arguments[s]);i.push((function(e,n){e?r(e):t(n)}));try{e.apply(this,i)}catch(e){r(e)}return n}return Object.setPrototypeOf(t,Object.getPrototypeOf(e)),D&&Object.defineProperty(t,D,{value:t,enumerable:!1,writable:!1,configurable:!0}),Object.defineProperties(t,i(e))}`.trim();
const stringToFix = 't.promisify=function(e){}';
const content = fs.readFileSync(entry, 'utf8');
const fixedContent = content.replace(stringToRemove, stringToFix);
fs.writeFileSync(entry, fixedContent, 'utf8');
if (content !== fixedContent) {
  console.log('Worker bundle patched');
} else {
  if (!content.includes(stringToFix)) {
    throw new Error('Unable to fix worker bundle');
  } else {
    console.log('Worker bundle already patched');
  }
}
