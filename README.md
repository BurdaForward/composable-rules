# Composable rules

Imagine you need to write rules to modify some data based on a growing set of
business logic.
You could write it in vanilla JavaScript but chances are you quickly end up with something like this:

```javascript
if(businessCondition1) {
  if(businessCondition2) {
    if(businessCondition3) {
      if(businessCondition4) {
        if(businessCondition5) {
           // do something
           // KA-ME-HA-ME-HA of death
        }
      }
    }
  }
}
```

![kamehameha](https://media1.giphy.com/media/oTjoawKEq3wYD5fKEh/giphy.gif)

This is a small zero-dependency library created to write rule logic
to manipulate data that's much more maintainable, readable, composable, reusable
and testable than writing plain `if/else` logic.

## Basics

The basic structure of a rule the following:

```javascript
const myRule = {
  // a matcher is a function to check whether the action should be run
  matcher: (facts, previousValue) => true || false,
  // if the matcher returns true, run the action getting facts and the previous rule's
  // value. Return a new value which will be passed on to the next rule.
  action: (facts, url) => {
    return { value: 'something new' } // return new data
  }
}
```

**What are facts?** Are data needed by your rules. `facts` stay the same throughout
the entire evaluation of the rules. Examples: Config data, the current date or
data fetched from an API.

**What's the initialValue?** In the end your rules are there to evaluate logic
and produce a value in the end. The `initialValue` is what gets returned if no
rule is run because the `matcher` returns false. A default value if you will,
similar to the last argument of [`Array.prototype.reduce()`](https://developer.mozilla.org/de/docs/Web/JavaScript/Reference/Global_Objects/Array/Reduce).

## Examples

Using rules always involves three steps:
1. **Defining matchers:** To check whether certain rules should be run or not.
2. **Defining rules:** Rules use `matcher`s to see if their `action` should be run. The action returns a new value
which is passed on to the next rule. If the matcher doesn't match, the `previousValue` is passed on instead. Simple rules can
be combined into more complex rules using function like `applyFirst` or `applyAll`
3. **Evaluate your rules:** Use the `run` or `detailedRun` function to execute your rules for
a given `facts` object and `initialValue`. The return value will the valueare producing.

### A simple example

Let's start with a very simple example. Your product owner wants you to create special offers
for fruit, which follows certain rules. The rules are based on seasonality, what's in stock
and how tropical the fruits are. In the end, the logic should produce and array
of special offers.

**Hint:** Rules are meant to be immutable so create new ones instead of trying to change
existing ones. Running the rules is always _synchronous_, so no async code in
the rules. If you need to fetch data asynchronously, fetch it beforehand and pass
it to `run`/`detailedRun` as `facts` or `initialValue`.

```javascript
import { applyAll, one, run } from '@burdaforward/composable-rules';

const fruitsInStock = [
  { type: 'apple', price: 1 },
  { type: 'pineapple', price: 3 },
  { type: 'melon', price: 4 },
  { type: 'coconut', price: 2 },
  { type: 'orange', price: 1 },
];

// 1. MATCHERS: define matcher functions

const isApple = fruit => fruit.type === 'apple';
const isPineapple = fruit => fruit.type === 'pineapple';
const isCoconut = fruit => fruit.type === 'coconut';

const hasTropicalFruits = (facts, specialOffers) =>
  facts.fruitsInStock.some(isPineapple) && facts.fruitsInStock.some(isCoconut);

const moreThan100Apples = (facts, specialOffers) =>
  facts.fruitsInStock.filter(isApple).length > 100;

const isJuly = (facts, specialOffers) => facts.currentDate.getMonth() === 6;

const isAugust = (facts, specialOffers) => facts.currentDate.getMonth() === 7;

// 2. RULES define your rules

// Rule 1: if there are more than 100 apples in stock, create a special offer selling 100 apples for 50$.
const discountApplesRule = {
  matcher: moreThan100Apples,
  action: (facts, specialOffers) => [
    ...specialOffers,
    { specialOffer: 'Get 100 apples now for only 50$!' },
  ],
};

// Rule 2: in july or august, raise prices for lemons (lemonade season)
const lemonadeRule = {
  matcher: one([isJuly, isAugust]), // combine two matchers requiring one of the to be true
  action: (facts, specialOffers) => [
    ...specialOffers,
    { specialOffer: 'Get your lemonade' },
  ],
};

// Rule 3: if melons, pineapples and coconuts are in stock, offer Pina Colada
const tropicalRule = {
  matcher: hasTropicalFruits,
  action: (facts, specialOffers) => [
    ...specialOffers,
    { specialOffer: 'Aloha Tropical Breeze! Get our Pina Colada now!' },
  ],
};

// combine all rules together
const fruitRule = applyAll([discountApplesRule, lemonadeRule, tropicalRule]);

// 3. run your rules like this:
const facts = { fruitsInStock, currentDate: new Date() };
const specialOffers = run(fruitRule, facts, []);
console.log(specialOffers)
// logs [{ specialOffer: "Get your lemonade!" }, { specialOffer: "Aloha. Tropical triple!" }]
```

Even though this example was simple and involved fruits, you'll see that you
can use this library for any sort of logic no matter what it is. Next up is
real-lift example.

### A real-life example from BurdaForward

The following is an example of a URL rewrite engine, which uses this library
to rewrite urls according to a given set of rules. Here's a small peek into
how this can be done. A URL is passed into the rules and manipulated according to
certain logic. Each manipulation can be implemented as a rule and rules can then
be composed into more complex rules until a whole rewrite engine is built.

**Note:** To simplify url manipulation we use the [`nurl`](https://github.com/codeinthehole/nurl) library, which is easier
to use than NodeJS's `url` module and has an immutable URL type.

Then define and run the rules like this

```javascript
import nurl from 'nurl';
import { all, applyAll, applyFirst, run} from '@burdaforward/composable-rules';

// MATCHERS
const isSaturnHost = (facts, url) => url.hostname === 'saturn.de';
const hasRewriteParam = (facts, url) => url.hasQueryParam('rewrite');

const myRule = {
  // use `all` to combine functions requiring both matchers to return `true`
  matcher: all([isSaturnHost, hasRewriteParam]),
  // if matcher matches, rewrite to saturn.de, `url` will be url object
  // and contains modifications made so far by previous rules
  action: (facts, url) => {
    return url.setHostname('saturn.de') // return new url object
  }
}


// arbitrary data that is passed to the matchers and actions
const deeplink = nurl.parse('https://someurl.com/iphone8?param=value');
const facts = {
  config: { ... },
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
// run the rule on some data, will return the rewritten URL
const manipulatedUrl = run(
  combinedRule,
  facts,
  deeplink
);


// BONUS: extra facts can be injected locally scoped to a rule like this:
const addSpecificFacts = (facts) => ({ ...facts, specificData: { a: 42 } })
const combinedRule  = applyFirst([
  injectFacts(addSpecificFacts, myRule), // this rule will have access to a transformed facts object
  anotherRule
]);
```

#### A note on testing

Since rules are just simple input/output logic, testing them is a breeze. At
BurdaForward set of hundreds of rules has 100% tests coverage and testing is
quick and easy.

```javascript
test('this rule does what I want', () => {
  const output = run(myRule, facts, initialValue);
  expect(output).toEqual(expectedOutput)
})
```

## Installing and importing

Make sure the package is installed.

```sh
npm i -S @burdaforward/composable-rules
```

Then import the package in your code depending on whether you use ES Modules, NodeJs require, or Browser scripts.

### ES Modules

```javascript
// import named exports or all as rules
import { all, run, applyFirst } from '@burdaforward/composable-rules';
import * as rules from '@burdaforward/composable-rules';
```

### NodeJS

```javascript
// import all as rules or descructure the exports
const rules = require('@burdaforward/composable-rules');
const { all, run, applyFirst } = require('@burdaforward/composable-rules');
```

### Browser
```html
<!-- Browsers that support ESM: unpkg link -->
<script type="module">
// import named exports or all as rules
import { all, run, applyFirst } from 'https://unpkg.com/@burdaforward/composable-rules@1.0.0/dist/index.modern.js';
import * as rules from 'https://unpkg.com/@burdaforward/composable-rules@1.0.0/dist/index.modern.js';
</script>

<!-- or for older browsers, access window.composableRules -->
<script src="https://unpkg.com/@burdaforward/composable-rules@1.0.0/dist/index.umd.js"></script>
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

## Contributing

Please open an issue if you run into problems, have questions, or feature requests.
For smaller fixes feel free to submit a pull request. For larger things please
open an issue first, let's discuss it to make sure it fits the package so no work is wasted.


