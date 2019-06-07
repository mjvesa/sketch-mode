export const unideGrid = `import "@vaadin/vaadin-grid/theme/lumo/vaadin-grid.js";

class UnideGridElement extends HTMLElement {
  constructor() {
    super();
    let shadow = this.attachShadow({ mode: "open" });
    this.grid = document.createElement("vaadin-grid");
    this.grid.style.height = "100%";
    shadow.appendChild(this.grid);
  }
  set columnCaptions(captions) {
    this.grid.innerHTML = "";
    captions.forEach(caption => {
      const columnName = caption.name;
      const columnPath = caption.path;
      const column = document.createElement("vaadin-grid-column");
      column.setAttribute("path", columnPath);
      column.setAttribute("header", columnName);
      this.grid.appendChild(column);
    });
  }
  set items(theItems) {
    this.grid.items = theItems;
  }
}

customElements.define("unide-grid", UnideGridElement);`;
