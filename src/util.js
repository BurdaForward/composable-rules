// curry a function to a specified arity
const curryToArity = (fn, arity) => {
  const resolver =
    (...args) =>
    (...innerArgs) => {
      // make sure the function won't return functions endlessly when called with no arguments
      const newArgs =
        arity !== 0 && innerArgs.length === 0 ? [undefined] : innerArgs;
      const allArgs = [...args, ...newArgs];
      return allArgs.length >= arity ? fn(...allArgs) : resolver(...allArgs);
    };
  return resolver();
};

export default curryToArity;
