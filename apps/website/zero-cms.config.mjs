/* eslint-disable import/no-anonymous-default-export */
/** @type {import('@usc/zero-cms-core/node').ZeroCmsUserConfig} */
export default {
  // Base directory holding data.json, media/, and the per-type files under types/.
  // Defaults to this config file's directory; set explicitly for clarity.
  dir: ".zero-cms-store",

  // Where the typed client is generated (importable via the `@cms` tsconfig alias).
  generated: "generated",

  // Glob for type files, relative to `dir`. One Type per file.
  types: "types/**/*.json",

  // New/migrated types are written here (relative to `dir`).
  typesDir: "types",
};
