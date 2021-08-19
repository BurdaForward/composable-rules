import curryToArity from "./util.js";

describe("curryToArity", () => {
  const func = (a, b, c) => a + b + c;
  const curriedFunc = curryToArity(func, 3);

  test("can curry a function to arity 3", () => {
    expect(curriedFunc(1)(2)(3)).toEqual(curriedFunc(1, 2, 3));
  });

  test("eventually stops returning functions even if args are undefined", () => {
    expect(curriedFunc()()()).toEqual(NaN);
  });
});
