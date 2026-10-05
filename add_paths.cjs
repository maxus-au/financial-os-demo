const fs = require('fs');

let app = fs.readFileSync('tsconfig.app.json', 'utf8');
app = app.replace('"compilerOptions": {', '"compilerOptions": {\n    "baseUrl": ".",\n    "paths": { "@/*": ["./src/*"] },');
fs.writeFileSync('tsconfig.app.json', app);

let base = fs.readFileSync('tsconfig.json', 'utf8');
base = base.replace('"files": [],', '"compilerOptions": {\n    "baseUrl": ".",\n    "paths": { "@/*": ["./src/*"] }\n  },\n  "files": [],');
fs.writeFileSync('tsconfig.json', base);

console.log("Paths added!");
