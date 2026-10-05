const fs = require('fs'); 
const code = fs.readFileSync('src/components/ItemGrid.tsx', 'utf8'); 
let stack = []; 
for(let i=0; i<code.length; i++) { 
    if(code[i] === '(') stack.push({c: '(', i}); 
    else if(code[i] === ')') stack.pop(); 
} 
console.log('Parens length:', stack.length); 

let bStack = []; 
for(let i=0; i<code.length; i++) { 
    if(code[i] === '{') bStack.push({c: '{', i}); 
    else if(code[i] === '}') bStack.pop(); 
} 
console.log('Braces length:', bStack.length); 

stack.slice(-3).forEach(s => console.log('Paren context:', code.substring(s.i-50, s.i+50))); 
bStack.slice(-3).forEach(s => console.log('Brace context:', code.substring(s.i-50, s.i+50)));
