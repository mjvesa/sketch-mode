/**
 *  Exporter from model to Polymer3.
 */
import jsImports from "./js_imports.js";
import { unideGrid } from "./unide-grid-import.js";

const kebabToPascalCase = str => {
  const parts = str.split("-");
  let result = "";
  for (const i in parts) {
    result = result.concat(parts[i][0].toUpperCase() + parts[i].slice(1));
  }
  return result;
};

export let modelToP3 = (tagName, design) => {
  let pascalCaseName = kebabToPascalCase(tagName);
  let importedTags = new Set();
  let stack = [];
  let tree = [];
  let tagTree = [];

  let current = document.createElement("div");
  let currentTag = "";
  let currentClosed = true;

  let result = "";
  design.forEach(str => {
    let trimmed = str.trim();
    switch (trimmed) {
      case "(": {
        if (!currentClosed) {
          result = result.concat(">\n");
          currentClosed = true;
        }
        let old = current;
        tree.push(current);

        tagTree.push(currentTag);
        currentTag = stack.pop();
        if (currentTag in jsImports) {
          importedTags.add(currentTag);
        }

        current = document.createElement(currentTag);
        result = result.concat("<" + currentTag);
        old.appendChild(current);
        currentClosed = false;
        break;
      }
      case ")": {
        if (!currentClosed) {
          result = result.concat(">\n");
          currentClosed = true;
        }
        current = tree.pop();
        result = result.concat(`</${currentTag}>\n`);
        currentTag = tagTree.pop();
        break;
      }
      case "=": {
        let tos = stack.pop();
        let nos = stack.pop();
        if (!nos || !tos) {
          return;
        }

        result = result.concat(` ${nos}="${tos}"`);
        current.setAttribute(nos, tos);
        break;
      }
      default:
        stack.push(trimmed);
    }
  });

  let importStrings = "";

  importedTags.forEach(tag => {
    importStrings = importStrings.concat(`${jsImports[tag]}\n`);
  });

  return `import { PolymerElement, html } from '@polymer/polymer/polymer-element.js';
    ${importStrings}
    class ${pascalCaseName} extends PolymerElement {
      static get template() {
        return html\`${result}\`;
      }
    }
    customElements.define("${tagName}", ${pascalCaseName});
  }`;
};
