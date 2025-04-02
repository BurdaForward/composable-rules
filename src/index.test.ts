import {
  all,
  always,
  applyAll,
  applyChain,
  applyFirst,
  applyIf,
  detailedRun,
  injectFacts,
  not,
  one,
  run,
  transformOutput,
} from "./index";

const passMatcher = () => true;
const failMatcher = () => false;

describe("always", () => {
  test("matches always.", () => {
    expect(always()).toBe(true);
    expect(always({ some: { data: 3 } })).toBe(true);
  });
});

describe("not", () => {
  test("inverts the outcome of a matcher", () => {
    const invertedPassMatcher = not(passMatcher);
    const invertedFailMatcher = not(failMatcher);
    expect(invertedPassMatcher()).toBe(false);
    expect(invertedFailMatcher()).toBe(true);
  });
});

describe("one", () => {
  test("joins matchers and returns true when one is true", () => {
    const matcher = one([passMatcher, failMatcher]);
    expect(matcher()).toBe(true);
  });

  test("joins matchers and returns false when all are false", () => {
    const matcher = one([failMatcher, failMatcher]);
    expect(matcher()).toBe(false);
  });
});

describe("all", () => {
  test("joins matchers and returns true when all are true", () => {
    const matcher = all([passMatcher, passMatcher]);
    expect(matcher()).toBe(true);
  });

  test("joins matchers and returns false when one is false", () => {
    const matcher = all([passMatcher, failMatcher]);
    expect(matcher()).toBe(false);
  });
});

describe("injectFacts", () => {
  const rule = {
    matcher: always,
    action: (facts) => `${facts.newProp}!`,
  };
  const addProp = (facts) => ({ ...facts, newProp: "New" });

  test("injects facts into the rule", () => {
    const modifiedRule = injectFacts(addProp, rule);
    const [, result] = run(modifiedRule, { originalProp: "Old" }, "");
    expect(result).toBe("New!");
  });
  test("injected facts are not accessible on original rule", () => {
    const [, result] = run(rule, { originalProp: "Old" }, "");
    expect(result).toBe("undefined!");
  });
  test("injected facts are available in child rules", () => {
    const modifiedRule = injectFacts(addProp, applyAll([rule]));
    const [, result] = run(modifiedRule, { originalProp: "Old" }, "");
    expect(result).toBe("New!");
  });
  test("also works when combined with transformOutput", () => {
    const modifiedRule = injectFacts(addProp, applyAll([rule]));
    const transformedRule = transformOutput(
      (value) => ({ transformed: value }),
      modifiedRule
    );
    const [, result] = run(transformedRule, { originalProp: "Old" }, "");
    expect(result).toEqual({ transformed: "New!" });
  });
});

describe("applyAll", () => {
  const isTwo = (facts) => facts.number === 2;
  const matchingRule = {
    matcher: isTwo,
    action: (facts, value) => `${value} Match!`,
  };
  const missingRule = {
    matcher: not(isTwo),
    action: (facts, value) => `${value} Miss!`,
  };

  test("builds up a value by applying actions when matchers match", () => {
    const [, result] = run(applyAll([matchingRule, matchingRule]))(
      { number: 2 },
      "Initial."
    );
    expect(result).toBe("Initial. Match! Match!");
  });

  test("won't execute rules that don't match", () => {
    const [, result] = run(applyAll([matchingRule, missingRule]))(
      { number: 2 },
      "Initial."
    );
    expect(result).toBe("Initial. Match!");
  });

  test("returns the inital value if nothing matches", () => {
    const [, result] = run(applyAll([missingRule, missingRule]))(
      { number: 2 },
      "Initial."
    );
    expect(result).toBe("Initial.");
  });

  test("matchers get access to current value", () => {
    const incrementRule = {
      matcher: (facts, number) => number === 2,
      action: (facts, number) => number + 1,
    };
    const [, result] = run(
      applyAll([incrementRule, incrementRule, incrementRule])
    )(null, 2);
    expect(result).toBe(3);
  });
});

describe("applyFirst", () => {
  const isTwo = (facts) => facts.number === 2;
  const matchingRule = {
    matcher: isTwo,
    action: (facts, value) => `${value} Match!`,
  };
  const missingRule = {
    matcher: not(isTwo),
    action: (facts, value) => `${value} Miss!`,
  };

  test("won't execute second rule if first one matched", () => {
    const [, result] = run(applyFirst([matchingRule, matchingRule]))(
      { number: 2 },
      "Initial."
    );
    expect(result).toBe("Initial. Match!");
  });

  test("won't execute first rule if it doesn't match", () => {
    const [, result] = run(applyFirst([missingRule, matchingRule]))(
      { number: 2 },
      "Initial."
    );
    expect(result).toBe("Initial. Match!");
  });

  test("returns the inital value if no rule matches", () => {
    const [, result] = run(applyFirst([missingRule, missingRule]))(
      { number: 2 },
      "Initial."
    );
    expect(result).toBe("Initial.");
  });
});

describe("applyChain", () => {
  const isTwo = (facts) => facts.number === 2;
  const matchingRule = {
    matcher: isTwo,
    action: (facts, value) => `${value} Match!`,
  };
  const missingRule = {
    matcher: not(isTwo),
    action: (facts, value) => `${value} Miss!`,
  };

  test("will execute second rule if first one matched", () => {
    const [, result] = run(applyChain([matchingRule, matchingRule]))(
      { number: 2 },
      "Initial."
    );
    expect(result).toBe("Initial. Match! Match!");
  });

  test("won't execute second rule if it the first one doesn't match", () => {
    const [, result] = run(applyChain([missingRule, matchingRule]))(
      { number: 2 },
      "Initial."
    );
    expect(result).toBe("Initial.");
  });

  test("returns the inital value if no rule matches", () => {
    const [, result] = run(applyChain([missingRule, missingRule]))(
      { number: 2 },
      "Initial."
    );
    expect(result).toBe("Initial.");
  });
});

describe("nested Rules", () => {
  const makeRule = (pass, value) => ({
    matcher: () => pass,
    action: (facts, list) => list.concat(value),
  });

  test("all-rules inside first-rules work when last in all-rule is passing", () => {
    const rule = applyFirst([
      makeRule(false, 1),
      applyAll([makeRule(true, 2), makeRule(false, 3), makeRule(true, 4)]),
      makeRule(true, 5),
    ]);
    const [, result] = run(rule)(null, []);
    expect(result).toEqual([2, 4]);
  });

  test("all-rules inside first-rules work when last in all-rule is false", () => {
    const rule = applyFirst([
      makeRule(false, 1),
      applyAll([makeRule(true, 2), makeRule(false, 3), makeRule(false, 4)]),
      makeRule(true, 5),
    ]);
    const [, result] = run(rule)(null, []);
    expect(result).toEqual([2]);
  });

  test("first-rules inside all-rules work", () => {
    const rule = applyAll([
      makeRule(true, 1),
      applyFirst([makeRule(false, 2), makeRule(true, 3), makeRule(true, 4)]),
      makeRule(true, 5),
    ]);
    const [, result] = run(rule)(null, []);
    expect(result).toEqual([1, 3, 5]);
  });
});

describe("transformOutput", () => {
  const makeRule = (pass, value) => ({
    matcher: () => pass,
    action: (facts, list) => list.concat(value),
  });

  test("transforms output if rule matcher matches", () => {
    const rule = makeRule(true, "original");
    const newRule = transformOutput(() => "transformed", rule);
    const [, result] = run(newRule)(null, []);
    expect(result).toEqual("transformed");
  });

  test("doesn't transforms output if rule doesn't match", () => {
    const rule = makeRule(false, "original");
    const newRule = transformOutput(() => "transformed", rule);
    const [, result] = run(newRule)(null, "original");
    expect(result).toEqual("original");
  });

  test("calls the next rule with the transformed value if it matches when using applyAll", () => {
    const rule1 = makeRule(true, "original");
    const rule2 = makeRule(true, "is nice");
    const newRule = applyAll([
      transformOutput((val) => val.concat(" transformed "), rule1),
      rule2,
    ]);
    const [, result] = run(newRule)(null, "");
    expect(result).toEqual("original transformed is nice");
  });

  test("calls the next rule with the original value if it doesn't match when using applyAll", () => {
    const rule1 = makeRule(false, "original");
    const rule2 = makeRule(true, "is nice");
    const newRule = applyAll([
      transformOutput((val) => val.concat(" transformed "), rule1),
      rule2,
    ]);
    const [, result] = run(newRule)(null, "");
    expect(result).toEqual("is nice");
  });
});

describe("applyIf", () => {
  const makeRule = (pass, value) => ({
    matcher: () => pass,
    action: (facts, list) => list.concat(value),
  });

  test("runs rule only if outer matcher matches", () => {
    const rule = makeRule(true, "running");
    const newRule = applyIf(passMatcher, rule);
    const [, result] = run(newRule)(null, "i am ");
    expect(result).toEqual("i am running");
  });

  test("does not run rule if outer matcher doesn't match", () => {
    const rule = makeRule(true, "running");
    const newRule = applyIf(failMatcher, rule);
    const [, result] = run(newRule)(null, "i am ");
    expect(result).toEqual("i am ");
  });

  test("behaves the same as running the rule by itself if the outer matcher is true", () => {
    const rule = makeRule(true, "running");
    const [, result1] = run(applyIf(passMatcher, rule))(null, "i am ");
    const [, result2] = run(rule)(null, "i am ");
    expect(result1).toEqual(result2);
    expect(result1).toEqual("i am running");
  });

  test("behaves the same as running the rule by itself if the outer matcher is false", () => {
    const rule = makeRule(false, "running");
    const [, result1] = run(applyIf(passMatcher, rule))(null, "i am ");
    const [, result2] = run(rule)(null, "i am ");
    expect(result1).toEqual(result2);
    expect(result1).toEqual("i am ");
  });
});

describe("detailedRun", () => {
  const makeRule = (pass, value) => ({
    matcher: () => pass,
    action: (facts, list) => list.concat(value),
  });

  test("if the rule does not match it returns an object with the initialValue as the value is `null` and foundMatch is `false`", () => {
    const rule = makeRule(false, "running");
    const initialValue = {};
    const [, { value, foundMatch }] = detailedRun(applyIf(passMatcher, rule))(
      null,
      {}
    );
    expect(value).toEqual(initialValue);
    expect(foundMatch).toEqual(false);
  });

  test("if the rule matched it returns an object where the value is set and foundMatch is `true`", () => {
    const rule = makeRule(true, "running");
    const [, { value, foundMatch }] = detailedRun(applyIf(passMatcher, rule))(
      null,
      "i am "
    );
    expect(value).toEqual("i am running");
    expect(foundMatch).toEqual(true);
  });

  describe("error handling", () => {
    test("returns a tuple with an error as the first item when things crash", () => {
      const boomError = new Error("BOOM!");
      const rule = {
        matcher: passMatcher,
        action: () => {
          throw boomError;
        },
      };
      const [err, result] = detailedRun(rule)(null, "i am ");
      expect(err).toEqual(boomError);
      expect(result).toBe(null);
    });

    test("returns a tuple with no error but a result as the second item when things don't crash", () => {
      const rule = {
        matcher: passMatcher,
        action: () => "stuff",
      };
      const [err, result] = detailedRun(rule)(null, "i am ");
      expect(err).toBe(null);
      expect(result).toEqual({ value: "stuff", foundMatch: true });
    });
  });

  describe("with very deep nested rules", () => {
    const transformRule = (rule) => transformOutput((x) => x, rule);
    const rule = Array.from({ length: 10000 }).reduce(
      (acc) => transformRule(acc),
      makeRule(true, "x")
    );
    /** * FIX ME ** */
    test.skip("should not fail due too deep structure", () => {
      const { value, foundMatch } = detailedRun(rule)(null, "");
      expect(value).toEqual("x");
      expect(foundMatch).toEqual(true);
    });
  });
});
