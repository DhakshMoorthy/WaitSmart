const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");
const fs = require("fs");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

config.resolver.extraNodeModules = {
  "@waitsmart/shared": path.resolve(workspaceRoot, "packages/shared"),
};

// Force these critical packages to resolve from mobile/node_modules only,
// preventing React 19 (from admin/superadmin workspaces) from being picked up.
const mobileNodeModules = path.resolve(projectRoot, "node_modules");
const pinnedPackages = ["react", "react-dom", "react-native", "react-native-web", "scheduler"];

const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Pin React-family packages to mobile's versions (React 18)
  const baseName = moduleName.split("/")[0];
  if (pinnedPackages.includes(baseName) || (baseName.startsWith("@") && pinnedPackages.includes(moduleName.split("/").slice(0, 2).join("/")))) {
    try {
      const resolved = require.resolve(moduleName, { paths: [mobileNodeModules] });
      return { filePath: resolved, type: "sourceFile" };
    } catch {
      // Fall through to default resolution if not found
    }
  }

  // Shared package uses ESM `.js` import paths that map to `.ts` sources
  if (
    moduleName.startsWith(".") &&
    moduleName.endsWith(".js") &&
    context.originModulePath?.includes(`${path.sep}packages${path.sep}shared${path.sep}`)
  ) {
    const dir = path.dirname(context.originModulePath);
    const tsCandidate = path.join(dir, moduleName.replace(/\.js$/, ".ts"));
    const tsxCandidate = path.join(dir, moduleName.replace(/\.js$/, ".tsx"));
    if (fs.existsSync(tsCandidate)) {
      return {
        filePath: tsCandidate,
        type: "sourceFile",
      };
    }
    if (fs.existsSync(tsxCandidate)) {
      return {
        filePath: tsxCandidate,
        type: "sourceFile",
      };
    }
  }

  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
