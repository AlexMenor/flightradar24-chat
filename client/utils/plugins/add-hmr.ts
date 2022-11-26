import * as path from "path";
import { PluginOption } from "vite";
import { readFileSync } from "fs";

const isDev = process.env.__DEV__ === "true";

const DUMMY_CODE = `export default function(){};`;

function getInjectionCode(fileName: string): string {
  return readFileSync(
    path.resolve(__dirname, "..", "reload", "injections", fileName),
    { encoding: "utf8" }
  );
}

export default function addHmr(): PluginOption {
  const idInView = "virtual:reload-on-update-in-view";

  const viewHmrCode = isDev ? getInjectionCode("view.js") : DUMMY_CODE;

  return {
    name: "add-hmr",
    resolveId(id) {
      if (id === idInView) {
        return getResolvedId(id);
      }
    },
    load(id) {
      if (id === getResolvedId(idInView)) {
        return viewHmrCode;
      }
    },
  };
}

function getResolvedId(id: string) {
  return "\0" + id;
}
