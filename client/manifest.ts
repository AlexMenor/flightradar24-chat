import packageJson from "./package.json";

const manifest: chrome.runtime.ManifestV3 = {
  manifest_version: 3,
  name: "Flightradar24 chat",
  version: packageJson.version,
  description:
    "An extension that allows you to chat with other people following a flight",
  action: {
    default_popup: "src/pages/popup/index.html",
    default_icon: "icon-34.png",
  },
  icons: {
    "128": "icon-128.png",
  },
  web_accessible_resources: [
    {
      resources: [
        "assets/js/*.js",
        "assets/css/*.css",
        "icon-128.png",
        "icon-34.png",
        "OpenSans-Regular.ttf",
      ],
      matches: ["*://*/*"],
    },
  ],
  permissions: ["tabs"],
  host_permissions: ["http://*/"],
};

export default manifest;
