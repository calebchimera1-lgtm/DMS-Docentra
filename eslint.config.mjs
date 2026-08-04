import base from "@omniflow/config/eslint/base.js";

export default [
  ...base,
  {
    ignores: [
      "**/dist/**",
      "**/build/**",
      "**/.next/**",
      "**/.turbo/**",
      "**/node_modules/**",
      "**/generated/**",
      "**/coverage/**",
    ],
  },
];
