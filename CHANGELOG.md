# Changelog

## v2.0.0 - 2021-12-08

### Breaking changes
- `run` and `detailedRun` now use `try/catch` internally and return a tuple of <error, value> instead of just the value. This allows straightforward error handling.

### Other Changes
- dev dependency updates
- build now happens with `microbundle` 0.14
- README changes
