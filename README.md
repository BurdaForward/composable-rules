# RULES

This is a small zero-dependency library mainly intended to make rules around deeplink
manipulation more maintainable, readable and composable(we don't wanna end up
with 8 nested `if`s).

## Using the package

Make sure the package is installed.

```sh
npm i -S composable-rules
```

Then import the package in you code depending on whether you use ES Modules, NodeJs require, or Browser scripts.

```js
// ESM
import rules from 'composable-rules';

// NodeJS
const rules = require('composable-rules');

// Browser that support ESM: unpkg link
<script type="module" src="https://unpkg.com/composable-rules@1.0.0"></script>
// or for older browser (window global)
<script src="https://unpkg.com/composable-rules@1.0.0/dist/index.umd.js"></script>
```

## API

**Matchers**

- `not`: negates a matchers.
- `always`: A matchers that always matches.
- `all`: Matcher combinator which takes a list of matchers. It is true when all passed matchers are true, false otherwise.
- `one`: Matcher combinator which takes a list of matchers. It is only true when at least one of the passed matchers is true, false otherwise.

**Combining and enhancing rules**
- `injectFacts`: Takes a function and a `rule`. The function is passed the `facts` and can return a new transformed version of `facts`(should copy instead of mutate). This is useful for passing, that are specific to one rule only.
- `transformOutput`: Takes a function and a `rule`. If the rules `matcher` matches, then the function is called with the output of the rules `action`. This is useful for modying(immtuable!) an action''s return value on a higher level.
- `applyIf`: Checks if the passed matcher matches before running the rule. Takes a `matcher` function and a `rule` and runs only that rule when the matcher matches in addition to the matcher the rule already has. The rule is then run and the `action`'s value is returned.
- `applyAll`: Takes `rules` and combines a them so that when run all supplied rules will be run in order for those whose matcher returns `true`. It returns the modified value, in our case the modified URL.
- `applyFirst`: Takes `rules` and combines a them so that when run, only the first supplied rule will be run whose matcher returns `true`. It returns the modified value, in our case the modified URL.
- `applyChain`: Takes `rules` and combines a them so that when run, only rules will be run as long as their matcher returns `true`. As soon as a rule does not match it it stops. It returns the modified value, in our case the modified URL.

**Running rules**
- `run`: Takes a `rule`, `facts` and an intial `value` and runs the rule. It returns the modified value, in our case the modified URL. If no rule matches the retuned value is the original input value.
- `detailedRun`: Like `run` but with a more detailed output and different default value. Takes a `rule`, `facts` and an intial `value` and runs the rule. It returns an object which looks like this: `{ value: <value>, foundMatch: boolean }`. The value will the modified value, in our case the modified URL or `null` when no rule is matched. `foundMatch` is a boolean indicating if any rule matched.

## The nurl library

To simplify url manipulation we use the [`nurl`](https://github.com/codeinthehole/nurl), which is easier
to use than NodeJS's `url` module and has an immutable URL type.

## How to use

Rules consists of `matcher`s and `action`s. The `action` will only get executed
when the `matcher` matches.

```js
const nurl = require('nurl');
const { all, applyAll, applyFirst, run} = require('./rules');

// MATCHERS
const isSaturnHost = (facts, url) => url.hostname === 'mediamarkt.de';
const hasRewriteParam = (facts, url) => url.hasQueryParam('rewrite');

const myRule = {
  // use `all` to combine functions requiring both to return `true`
  matcher: all([isSaturnHost, hasRewriteParam]),
  // if matcher matches, rewrite to saturn.de, `url` will be url object
  // and contains modifications made so far by previous rules
  action: (facts, url) => {
    return url.setHostname('saturn.de') // return new url object
  }
}
```

Then run the rules like this
```js

// arbitrary data that is passed to the matchers and actions
const deeplink = nurl.parse('https://someurl.com/iphone8?param=value');
const facts = {
  ...,
  url: deeplink
};

// combine rules, using `applyAll` will run all rules with passing matchers in order
// this only creates a new rule and doesn't run it yet
const combinedRule  = applyAll([myRule, anotherRule]);
// run the rule on some data
const manipulatedUrl = run(
  combinedRule,
  facts,
  deeplink // the initial url
  );

// OR combine rules, checking for the first match and ignoring the rest
// this only creates a new rule and doesn't run the rule yet
const combinedRule  = applyFirst([myRule, anotherRule]);
// run the rule on some data
const manipulatedUrl = run(
  combinedRule,
  facts,
  deeplink
  );


// extra facts can be injected locally scoped to a rule like this:
const addSpecificFacts = (facts) => ({ ...facts, specificData: { a: 42 } })
const combinedRule  = applyFirst([
  injectFacts(addSpecificFacts, myRule), // this rule will have access to a transformed facts object
  anotherRule
]);
// run the rule on some data
```
