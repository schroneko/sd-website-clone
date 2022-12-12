module.exports = {
  plugins: ["prettier"],
  extends: ["plugin:react/recommended"],
  rules: {
    "prettier/prettier": "error",
  },
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: "module",
  },
};
