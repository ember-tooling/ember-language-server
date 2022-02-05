const fs = require('fs');
const entry = './dist/bundled/start-worker-server.js';
const vars = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '_'];

const stringsToRemove = vars.map((e) => {
  return vars.map((e_) => {
    return `t.promisify=function(e){if("function"!=typeof e)throw new TypeError('The "original" argument must be of type Function');if(${e}&&e[${e}]){var t;if("function"!=typeof(t=e[${e}]))throw new TypeError('The "util.promisify.custom" argument must be of type Function');return Object.defineProperty(t,${e},{value:t,enumerable:!1,writable:!1,configurable:!0}),t}function t(){for(var t,r,n=new Promise((function(e,n){t=e,r=n})),i=[],s=0;s<arguments.length;s++)i.push(arguments[s]);i.push((function(e,n){e?r(e):t(n)}));try{e.apply(this,i)}catch(e){r(e)}return n}return Object.setPrototypeOf(t,Object.getPrototypeOf(e)),${e}&&Object.defineProperty(t,${e},{value:t,enumerable:!1,writable:!1,configurable:!0}),Object.defineProperties(t,${e_.toLowerCase()}(e))}`
      .trim()
      .toString();
  });
});

const stringToFix = 't.promisify=function(e){}';
const content = fs.readFileSync(entry, 'utf8');
const fixedContent = stringsToRemove.reduce((acc, strs) => {
  let res = acc;
  strs.forEach((str) => {
    res = res.replace(str, stringToFix);
  });
  return res;
}, content);
fs.writeFileSync(entry, fixedContent, 'utf8');
if (content !== fixedContent) {
  console.log('Worker bundle patched');
} else {
  if (!content.includes(stringToFix)) {
    console.info('Worker bundle already patched');
    // throw new Error('Unable to fix worker bundle');
  } else {
    console.log('Worker bundle already patched');
  }
}
