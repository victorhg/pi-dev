import { describe, it, expect } from "vitest";
import {
  inferLanguage,
  detectLanguages,
  isAislopScoreable,
  AISLOP_LANGUAGES,
} from "./languages.js";

describe("inferLanguage", () => {
  it("maps common extensions", () => {
    expect(inferLanguage("src/index.ts")).toBe("typescript");
    expect(inferLanguage("src/app.tsx")).toBe("typescript");
    expect(inferLanguage("src/app.jsx")).toBe("javascript");
    expect(inferLanguage("src/main.py")).toBe("python");
    expect(inferLanguage("src/main.go")).toBe("go");
    expect(inferLanguage("src/lib.rs")).toBe("rust");
    expect(inferLanguage("src/app.rb")).toBe("ruby");
    expect(inferLanguage("src/index.php")).toBe("php");
    expect(inferLanguage("src/App.cs")).toBe("csharp");
    expect(inferLanguage("src/main.cpp")).toBe("cpp");
    expect(inferLanguage("src/Main.java")).toBe("java");
    expect(inferLanguage("src/App.swift")).toBe("swift");
    expect(inferLanguage("src/App.kt")).toBe("kotlin");
    expect(inferLanguage("src/App.svelte")).toBe("svelte");
  });

  it("maps project marker files", () => {
    expect(inferLanguage("package.json")).toBe("javascript");
    expect(inferLanguage("tsconfig.json")).toBe("typescript");
    expect(inferLanguage("pyproject.toml")).toBe("python");
    expect(inferLanguage("go.mod")).toBe("go");
    expect(inferLanguage("Cargo.toml")).toBe("rust");
    expect(inferLanguage("Gemfile")).toBe("ruby");
    expect(inferLanguage("composer.json")).toBe("php");
    expect(inferLanguage("pom.xml")).toBe("java");
    expect(inferLanguage("Package.swift")).toBe("swift");
    expect(inferLanguage("MyProject.csproj")).toBe("csharp");
  });

  it("normalizes Windows separators", () => {
    expect(inferLanguage("src\\index.ts")).toBe("typescript");
  });

  it("returns null for unrecognized paths", () => {
    expect(inferLanguage("README.md")).toBeNull();
    expect(inferLanguage("Dockerfile")).toBeNull();
    expect(inferLanguage("src/unknown.xyz")).toBeNull();
  });
});

describe("detectLanguages", () => {
  it("returns languages ordered by frequency", () => {
    const files = [
      "src/a.ts",
      "src/b.ts",
      "src/c.ts",
      "src/d.py",
      "package.json",
      "README.md",
    ];
    expect(detectLanguages(files)).toEqual(["typescript", "python", "javascript"]);
  });

  it("ignores unrecognized files", () => {
    expect(detectLanguages(["README.md", "Dockerfile"])).toEqual([]);
  });
});

describe("isAislopScoreable", () => {
  it("is true for supported languages", () => {
    expect(isAislopScoreable(["typescript", "python"])).toBe(true);
    expect(isAislopScoreable(["rust"])).toBe(true);
  });

  it("is false when any language is unsupported", () => {
    expect(isAislopScoreable(["typescript", "java"])).toBe(false);
    expect(isAislopScoreable(["swift"])).toBe(false);
    expect(isAislopScoreable(["svelte"])).toBe(false);
  });

  it("is false for an empty set", () => {
    expect(isAislopScoreable([])).toBe(false);
  });

  it("covers the documented ten aislop language targets", () => {
    expect(AISLOP_LANGUAGES).toEqual([
      "typescript",
      "javascript",
      "python",
      "go",
      "rust",
      "ruby",
      "php",
      "csharp",
      "c",
      "cpp",
    ]);
  });
});
