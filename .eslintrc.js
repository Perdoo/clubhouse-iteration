module.exports = {
  extends: ["eslint:recommended", "plugin:prettier/recommended"],
  plugins: ["prettier"],
  env: { es6: true, node: true },
  parserOptions: { ecmaVersion: 2018 },
  rules: {
    "prettier/prettier": ["warn"],
    "max-len": ["error", { code: 88 }],
  },
};
