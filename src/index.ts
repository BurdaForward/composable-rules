import curryToArity from "./util";

type Rule<Facts = any, Result = any, Input = any> =
  | PlainRule<Facts, Result, Input>
  | InjectedRule<Facts, Result, Input>
  | TransformedRule<Facts, Result, Input>
  | FirstRule<Facts, Result, Input>
  | AllRule<Facts, Result, Input>
  | ChainRule<Facts, Result, Input>
  | IfRule<Facts, Result, Input>;

type Matcher<Facts = any, Input = any> = (
  facts?: Facts,
  input?: Input
) => boolean;
type Mapper<Facts = any> = (facts?: Facts) => Facts;
type Action<Facts, Result, Input> = (facts?: Facts, input?: Input) => Result;
type Transformer = Function;

type PlainRule<Facts = any, Result = any, Input = any> = {
  type?: "plain";
  matcher: Matcher<Facts, Input>;
  action: Action<Facts, Result, Input>;
};

type InjectedRule<Facts = any, Result = any, Input = any> = {
  type: "injected";
  mapper: Mapper<Facts>;
  childRule: Rule<Facts, Result, Input>;
};

type TransformedRule<Facts = any, Result = any, Input = any> = {
  type: "transformed";
  transformer: Transformer;
  rule: Rule<Facts, Result, Input>;
};

type IfRule<Facts = any, Result = any, Input = any> = {
  type: "if";
  matcher: Matcher;
  rule: Rule<Facts, Result, Input>;
};

type AllRule<Facts = any, Result = any, Input = any> = {
  type: "all";
  rules: Rule<Facts, Result, Input>[];
};

type FirstRule<Facts = any, Result = any, Input = any> = {
  type: "first";
  rules: Rule<Facts, Result, Input>[];
};

type ChainRule<Facts = any, Result = any, Input = any> = {
  type: "chain";
  rules: Rule<Facts, Result, Input>[];
};

type RuleResult<Value = any> = {
  foundMatch: boolean;
  value: Value;
};

/* Small library for combining matching functions in a reusable and
 * readable way
 * They can be added to rule which can be run on an object of facts,
 * producing some output.
 */

/* MATCHERS: Rules need matchers, functions that assert a certain condition
 * in order to know whether the rule's action should be applied.
 * Here are some functions to combine matching functions.
 */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const always = (...args: any[]) => true;

const not = (matcher: Matcher) => (facts?: any, value?: any) =>
  !matcher(facts, value);

const one = (matchers: Matcher[]) => (facts?: any, value?: any) =>
  matchers.some((check) => check(facts, value));

const all = (matchers: Matcher[]) => (facts?: any, value?: any) =>
  matchers.every((check) => check(facts, value));

/* COMBINING AND ENHANCING RULES
 * are basically objects with matcher and an action. The action is only applied
 * when the matcher matches. The actions receive some facts data and a current
 * value and return new value which is passed on.
 */

// allows to locally modify the facts object
// facts should be copied and NOT mutated to prevent side effects and mutability
// changes will not leak outside of the current rule
// example:
//   injectFacts(oldFacts => ({ ...oldFacts, newProp: '42' }), rule)
const injectFacts = (mapper: Mapper, rule: Rule): InjectedRule => ({
  type: "injected",
  mapper,
  childRule: rule,
});

// apply a function to the return value of the rule's action, but only if
// the matcher matches.
// example:
//   transformOutput((value) => value + 42, rule)
const transformOutput = (fn: Transformer, rule: Rule): TransformedRule => ({
  type: "transformed",
  transformer: fn,
  rule,
});

// combine a list of rules into a new rule where, once executed, all rules with
// passing matcher are run in order
const applyIf = (matcher: Matcher, rule: Rule): IfRule => ({
  type: "if",
  matcher,
  rule,
});

// combine a list of rules into a new rule where, once executed, all rules with
// passing matcher are run in order
const applyAll = (rules: Rule[]): AllRule => ({
  type: "all",
  rules,
});

// combine a list of rules into a new rule where, once executed, rules are run
// in order until the first matcher matches
const applyFirst = (rules: Rule[]): FirstRule => ({
  type: "first",
  rules,
});

// combine a list of rules into a new rule, where rules are executed as long
// as the previous rule matched
const applyChain = (rules: Rule[]): ChainRule => ({
  type: "chain",
  rules,
});

/* RUNNING RULES
 * Once you have a rule it can be run with the `run()` function
 *
 */

// like run() but keeps track of whether a matcher of a rule passed
// so we can stop execution early when using "firstMatch" rules
// for "injected" or "transformed" rules: they count as matched when the contained rule matches
// for "all" or "first" rules: at least one matcher needs to have matched
// for simple rules the matcher needs to have matched
const runHelp = (rule: Rule, facts: object, state: RuleResult): RuleResult => {
  switch (rule.type) {
    case "injected":
      return runHelp(rule.childRule!, rule.mapper!(facts), state);
    case "transformed": {
      const { foundMatch, value } = runHelp(rule.rule!, facts, state);
      return {
        foundMatch,
        value: foundMatch ? rule.transformer!(value) : value,
      };
    }
    case "if": {
      const subRule = rule.rule!;
      return rule.matcher!(facts, state.value)
        ? runHelp(subRule, facts, state)
        : { foundMatch: false, value: state.value };
    }
    case "all":
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      return runAllMatchingRules(rule.rules!, facts, state);
    case "first":
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      return runFirstMatchingRule(rule.rules!, facts, state);
    case "chain":
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      return runChainOfRules(rule.rules!, facts, state);
    default:
      return rule.matcher(facts, state.value)
        ? { foundMatch: true, value: rule.action(facts, state.value) }
        : { foundMatch: false, value: state.value };
  }
};

const runAllMatchingRules = (
  rules: Rule[],
  facts: object,
  state: RuleResult
): RuleResult => {
  const reducer = (currentState: RuleResult, currentRule: Rule) => {
    const newState = runHelp(currentRule, facts, currentState);
    return {
      foundMatch: currentState.foundMatch || newState.foundMatch,
      value: newState.value,
    };
  };
  return rules.reduce(reducer, state);
};

const runFirstMatchingRule = (
  rules: Rule[],
  facts: object,
  state: RuleResult
): RuleResult => {
  const [nextRule, ...remainingRules] = rules;
  if (!nextRule) {
    return state;
  }
  const { foundMatch, value } = runHelp(nextRule, facts, state);
  return foundMatch
    ? { foundMatch, value }
    : runFirstMatchingRule(remainingRules, facts, state);
};

const runChainOfRules = (
  rules: Rule[],
  facts: object,
  state: RuleResult
): RuleResult => {
  const [nextRule, ...remainingRules] = rules;
  if (!nextRule) {
    return state;
  }
  const { foundMatch, value } = runHelp(nextRule, facts, state);
  return foundMatch
    ? runChainOfRules(remainingRules, facts, { foundMatch, value })
    : state;
};

// like run but with a more detailed return value
// Instead of the plain value it returns an object with the the following shape:
//    { value: <value>, foundMatch: <> }
//    - value: the actual value built-up by the rules, or `null` if no rule matched
//        note that unlike `run` this used `null` instead of the orginal value
//        when no rule matches
//    - foundMatch: is a boolean which indicates whether any rule in this run matched
const detailedRun = curryToArity(
  (rule: Rule, facts: object, initialValue: any) => {
    const state = { foundMatch: false, value: initialValue };
    try {
      const result = runHelp(rule, facts, state);
      return [null, result];
    } catch (err) {
      return [err, null];
    }
  },
  3
);

const run = curryToArity((rule: Rule, facts: object, initialValue: any) => {
  const [err, { value }] = detailedRun(rule, facts, initialValue);
  return [err, value];
}, 3);

export {
  not,
  one,
  always,
  all,
  injectFacts,
  transformOutput,
  applyIf,
  applyAll,
  applyFirst,
  applyChain,
  run,
  detailedRun,
};
