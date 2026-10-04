module.exports = {
  plugins: ["prettier"],
  extends: ["plugin:react/recommended", "next/core-web-vitals", "next/typescript"],
  rules: {
    "prettier/prettier": "error",
  },
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: "module",
  },
};
