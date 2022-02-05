# Debugging ember-language-server


## VSCode

  Check out this gist: [https://gist.github.com/lifeart/dc966071ec6c5a3f9d5adc70c2aa8102](https://gist.github.com/lifeart/dc966071ec6c5a3f9d5adc70c2aa8102)

## Emac


The debug console should be initiated through node.js and can be shown in a chromium-based browser.

This guide has been constructed based on an Emacs debugging session. We used stdio as a communication channel but it should translate to other means of communication.

## Approach

We will install uELS locally.  ELS is running in nodejs, which we will instrument to enable debugging.  We will visit the logs in a Chromium based browser.

## Fetching uELS

In order to debug the sources, we need to get hold of them and their dependencies.

### Getting the sources

Sources for uELS can be fetched from https://github.com/lifeart/ember-language-server

    git clone https://github.com/lifeart/ember-language-server.git

In later steps we will use the variable `$PATH_TO_ELS` which you likely want to replace manually.  It's definition would be found by executing the following in the previous directory:

    cd ember-language-server;
    export PATH_TO_ELS=`pwd`
    echo "$PATH_TO_ELS"

### Preparing sources

We need to fetch dependencies and build the sources.

    cd $PATH_TO_ELS
    npm install

After installing the sources, we need to build everything so the TypeScript is JavaScript that node accepts.

We run the following loop when updating and building sources.  This might not be optimal but it's worked so far:

    cd $PATH_TO_ELS
    npm run clean
    npm run compile
    npm run build

This gives us some sources which we will be able to inspect later.

## Setting up debugging

### Support in NodeJS

Node can be informed through a few different keywords that could change over time.  Of interest to us:

- `--inspect[=[host:]port]`: Enables the inspector (default: 127.0.0.1:9229)
- `--inspect-brk[=[host:]port]`: Enables the inspector and breaks at boot

The first option allows us to attach a debugger and lets the process run as usual until we connect the debugger.  The second option breaks at the beginning of the process and is great if something breaks at boot.

### Debug options with ELS

ELS can be started as `node $PATH_TO_ELS/lib/start-server.js`.  We can instrument node as `node --inspect-brk $PATH_TO_ELS/lib/start-server.js`.

Let's elaborate on this.  Looking at the code of `bin/ember-language-server.js`, we see the way the language server is started.  Based on that, we can instrument node.  In order to instrument the ember-language-server for stdio, you'd need to supply arguments either case.

The documentation on inspectors above shows that we can launch an inspector by providing a switch to nodejs.  Combining with the stdio option, this becomes:

    node --inspect-brk=9229 $PATH_TO_ELS/lib/start-server.js --stdio

You can run that command and you should be able to check the sources in the next step.

## Visiting debugger and stepper

We will connect to the debugger from a chromium-based browser by visiting [chrome://inspect](chrome://inspect "Nodejs inspector").

It may be that your development environment allows you to connect to the debugger directly.  Chances are that you're visiting this guide for support.  Debugging through the browser seems to be the solution that works most often and does not have highly unknown dependencies, so we'll go for that in this guide.  This does require a chromium-based browser.

After launching the process, visit [chrome://inspect](chrome://inspect "Nodejs inspector") in a chromium based browser (for example: Chromium, Ungoogled Chromium, Brave, or Google Chrome).  On that page you can open a specific debugger or you can choose "Open dedicated DevTools for Node".  Choosing the dedicated debugger will automatically attach the debugger whenever the language server restarts.  This is handy during debugging.  If unsure, click "Open dedicated DevTools for Node".

Once in the inspector/debugger/stepper, press the play button and you should be good to go.

## EXAMPLE session: Launching with debugging from within Emacs

The previous documentation was generated when debugging an error within ELS as requests flew in from Emacs, with emacs-lsp/lsp-mode.

Most editors that have a language server integration will require some configuration for the language server.  The integration might be templated and hidden from the user.  Emacs's configuration for ELS looks like this:

    (lsp-register-client (make-lsp-client :new-connection (lsp-stdio-connection (list "node" "/home/madnificent/code/javascript/ember-language-server/lib/start-server.js" "--stdio"))
                                          :major-modes '(web-mode js2-mode)
                                          :priority -1
                                          :ignore-messages (list "Initializing Ember Language Server at .*$")
                                          :add-on? t
                                          :server-id 'els))

We first followed the steps in "Fetching uELS", installing in `/home/madnificent/code/javascript/ember-language-server/`.

We then adapted the integration code to the following:

    (lsp-register-client (make-lsp-client :new-connection (lsp-stdio-connection (list "node" "--inspect-brk=9229" "/home/madnificent/code/javascript/ember-language-server/lib/start-server.js" "--stdio"))
                                          :major-modes '(web-mode js2-mode)
                                          :priority -1
                                          :ignore-messages (list "Initializing Ember Language Server at .*$")
                                          :add-on? t
                                          :server-id 'els))

After evaluating that snippet (`C-x C-e` whilst at the end of the expression), we opened an EmbeJS project.  Being in web-mode this requested us to launch ELS.  The ELS launch hangs at this point, because the `--inspect-brk` option does not continue evaluating until we press play in the inspector (see next).

As ELS had launched, we visited chrome://inspect from within Brave, and launched the debugger.  We enabled "Pause on Exceptions" as that was the specific case we were interested in.  Then we pressed "Resume script execution" (which you'd likely identify as the play/pause button).

After our debugging session was over, we evaluated the first `lsp-register-client` once again, so future sessions would not have debugging enabled and start without having the debugger attached.
