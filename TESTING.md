 # Coverage  report for integration testing.

 We use `nyc` for getting the coverage results for the integration tests.
 We have the following conditions and aims for getting the coverage results:

  - we spawn a separate process for the server on the integration tests.
  - We would like to have a single coverage report for the entire test.

## Approach

### Server start mode

 There are two ways by which we can spawn the server: ipc and stdio. WE are
 using stdio for spawning the server right now because of a (probable) timing
 sissue setting up the ipc channel across the process lineage `test -> spawned nyc processs ->
 ELS server`. This had manifest in two ways as below:


    1. When running `jest` in `inspect-brk` mode, and when we 'spend' some time
       on a relevant breakpoint  (around connection setup in
       integration-test.js), then the `ipc` channel is setup correctly. But when
       we don't run it in debug mode, the ipc channel is _not_ setup right.

    2.  If all the integration tests are run together (no -t on jest), the first
        test Initialize request alone fails for want of a response from the
        server, but further tests are getting a valid response (with empty
        array) as the project had not been inited.

So because of the above shortcomings, we choose to run the server in stdio
mode. See `package.json` :: `test:coverage` task for the command to run the
tests with coverage (single coverage for all unit and integration tests).

#### Caveat
  Since we use the stdio for communication, we cannot use the same for logging.
  This prevents use of 'RemoteConsole' in the server code while testing is
  enabled. Hence, the remote console is set to `null` by using the flag
  `isELSTesting`.

### Instrumentation

The `nyc` process which we spawn for running the server did not seem to collect
coverage metrics for the server code, unless instrumented using an additional
step before the actual tests are run.


### Errors

Error: Header must provide a Content-Length property

- remove "console.log" from code base.
