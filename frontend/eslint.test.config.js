// ESLint config for test files
import js from "@eslint/js";
export default [
  {
    files: ["src/test/**/*.{js,jsx,ts,tsx}", "**/*.test.{js,jsx}", "**/*.spec.{js,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        // Vitest/Jest globals
        describe: "readonly",
        it: "readonly",
        test: "readonly",
        expect: "readonly",
        vi: "readonly",
        vitest: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
        beforeAll: "readonly",
        afterAll: "readonly",
        jest: "readonly",
        // React Testing Library
        fireEvent: "readonly",
        screen: "readonly",
        render: "readonly",
        cleanup: "readonly",
        act: "readonly",
        waitFor: "readonly",
        findByRole: "readonly",
        getByRole: "readonly",
        getByText: "readonly",
        getByLabelText: "readonly",
        getByPlaceholderText: "readonly",
        getByTestId: "readonly",
        queryByRole: "readonly",
        queryByText: "readonly",
        findByText: "readonly",
        within: "readonly",
      },
    },
  },
];