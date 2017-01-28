# ember-language-server

This repository contains the Ember Language Server and the VSCode extension which uses the language server.  

## Development

1. Clone this repository
2. `cd ember-language-server`
3. `cd server`
4. `npm install`
5. `npm run compile` or `npm run watch` (this will compile the server and copies the result into the VSCode extension)
7. `cd ../client`
8. `npm install`
9. `code .`
10. You can run a debug session with the extension activated by pressing `F5`.  
    If you do any changes in the server or in the client you have to restart the debug session.
