module.exports = {
  root: true,
  extends: '@react-native',
  rules: {
    // `void promise()` marks deliberate fire-and-forget calls in effects.
    'no-void': ['warn', {allowAsStatement: true}],
  },
};
