import js from "@eslint/js";
import prettier from "eslint-plugin-prettier/recommended";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "public/blueprints/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
    rules: {
      "prettier/prettier": "off",
      "no-console": ["warn", { allow: ["warn", "error", "info"] }],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": "warn",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "warn",
      "object-curly-spacing": ["warn", "always"],
      "object-curly-newline": ["warn", { multiline: true, consistent: true }],
      "array-bracket-spacing": ["warn", "never"],
      "array-bracket-newline": ["warn", { multiline: true, minItems: 3 }],
      "block-spacing": ["warn", "always"],
      "comma-dangle": ["warn", "always-multiline"],
      "comma-spacing": ["warn", { before: false, after: true }],
      "comma-style": ["warn", "last"],
      semi: ["warn", "always"],
      "semi-spacing": ["warn", { before: false, after: true }],
      "semi-style": ["warn", "last"],
      quotes: [
        "warn",
        "double",
        { avoidEscape: true, allowTemplateLiterals: true },
      ],
      indent: ["warn", "tab"],
    },
  },
);
