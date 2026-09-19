import { transformAsync, types, type PluginObj } from "@babel/core";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { Plugin } from "vite";

/** Keep named app imports independent of wallet connectors' full chain registry. */
export function createChainImportsPlugin(): Plugin {
  return {
    name: "green-goods-chain-imports",
    apply: "build",
    enforce: "pre",
    async transform(code, id) {
      if (
        !/\/packages\/(client|shared)\/src\/.*\.[jt]sx?$/.test(id) ||
        !/['"]viem\/chains['"]/.test(code)
      )
        return;

      const barrel = await this.resolve("viem/chains", id);
      if (!barrel) return;
      const source = await readFile(barrel.id, "utf8");
      const exports = new Map(
        [
          ...source.matchAll(
            /export\s*\{\s*(\w+)\s*\}\s*from\s*['"](\.\/definitions\/[^'"]+)['"]/g
          ),
        ].map((match) => [match[1], resolve(dirname(barrel.id), match[2])])
      );
      const result = await transformAsync(code, {
        filename: id,
        babelrc: false,
        configFile: false,
        sourceMaps: true,
        parserOpts: { plugins: ["typescript", "jsx"] },
        plugins: [
          (): PluginObj => ({
            visitor: {
              ImportDeclaration(path) {
                if (path.node.source.value !== "viem/chains" || path.node.importKind === "type")
                  return;
                const remaining = [];
                const imports = [];
                for (const specifier of path.node.specifiers) {
                  const imported =
                    types.isImportSpecifier(specifier) && types.isIdentifier(specifier.imported)
                      ? specifier.imported.name
                      : undefined;
                  const target = imported && exports.get(imported);
                  if (
                    target &&
                    types.isImportSpecifier(specifier) &&
                    specifier.importKind !== "type"
                  ) {
                    imports.push(types.importDeclaration([specifier], types.stringLiteral(target)));
                  } else remaining.push(specifier);
                }
                if (!imports.length) return;
                if (remaining.length)
                  imports.push(types.importDeclaration(remaining, path.node.source));
                path.replaceWithMultiple(imports);
              },
            },
          }),
        ],
      });
      if (result?.code) return { code: result.code, map: result.map };
    },
  };
}
