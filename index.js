import { Color } from "three";
import { IfcViewerAPI } from "web-ifc-viewer";
import { Dexie } from "dexie";
import {VRButton} from 'three/examples/jsm/webxr/VRButton.js'

import {
  IFCWALL,
  IFCWALLSTANDARDCASE,
  IFCSLAB,
  IFCWINDOW,
  IFCMEMBER,
  IFCPLATE,
  IFCCURTAINWALL,
  IFCFLOWFITTING,
  IFCFLOWSEGMENT,
  IFCFLOWTERMINAL,
  IFCBUILDINGELEMENTPROXY,
  IFCDOOR,
} from "web-ifc";

import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer";

const container = document.getElementById("viewer-container");
const viewer = new IfcViewerAPI({
  container,
  backgroundColor: new Color(0xffffff),
});
viewer.grid.setGrid();
viewer.axes.setAxes();
viewer.IFC.setWasmPath("wasm/");

viewer.dimensions.active = true;

const db = createOrOpenDatabase();

//INDEX

if (window.location.href.indexOf("index.html") != -1) {
  const saveButton = document.getElementById("save-model");
  const loadButton = document.getElementById("load-model");

  const input = document.getElementById("file-input");
  saveButton.onclick = () => input.click();
  input.onchange = preprocessAndSaveIfc;

  const loadInput = document.getElementById("file-load");
  loadButton.onclick = () => loadInput.click();

  function updateButtons() {
    const modelsNames = localStorage.getItem("modelsNames");

    if (!modelsNames) {
      saveButton.classList.remove("disabled");
      loadButton.classList.add("disabled");
    } else {
      saveButton.classList.add("disabled");
      loadButton.classList.remove("disabled");
    }
  }

  updateButtons();
}

//CUSTOM MODEL

if (window.location.href.indexOf("viewer-custom.html") != -1) {

  const helpButton = document.getElementById("help-button");
  helpButton.onclick= () => {
    showHelp(helpButton);
  }

  const saveButton = document.getElementById("add-button");
  const deleteButton = document.getElementById("delete-saved-button");
  deleteButton.onclick = () => removeDatabase();

  const input = document.getElementById("file-input");
  const addModelButton = document.getElementById("add-button");
  addModelButton.onclick = () => input.click();
  input.onchange = preprocessAndSaveIfc;

  const previousDB = localStorage.getItem("modelsNames");
  if (previousDB) {
    loadSavedModel();
    saveButton.classList.add("disallowed")
    deleteButton.classList.remove("disallowed")
  } else {
    saveButton.classList.remove("disallowed")
    deleteButton.classList.add("disallowed")
  }

  pick();

  const dimButton = document.getElementById("dimension-button");
  dimButton.onclick = () => {
    disallowTools();
    dimButton.classList.toggle("active");
    createDimension(dimButton);
  };

  const cleanButton = document.getElementById("clean-button");
  cleanButton.addEventListener("click", () => {
    disallowTools();
    viewer.dimensions.previewActive = false;

    viewer.dimensions.deleteAll();
    viewer.clipper.deleteAllPlanes();
    viewer.clipper.active = false;
    viewer.context.renderer.postProduction.update();

    const commentsDel = document.getElementsByClassName("delete-button");
    for (const i of commentsDel) {
      i.click();
    }
  });

  const commentButton = document.getElementById("comments-button");
  commentButton.addEventListener("click", () => {
    disallowTools();
    commentButton.classList.toggle("active");
    commentCreate(commentButton);
  });

  const clippingButton = document.getElementById("clip-plane");
  clippingButton.onclick = () => {
    disallowTools();
    viewer.clipper.active = true;
    clippingButton.classList.add("active");
    clippingPlane(clippingButton);
  };
}

//GLTF MODEL

if (window.location.href.indexOf("viewer.html") != -1) {
  loadGltfModel();

  const renderer = viewer.context.getRenderer()
  const scene = viewer.context.getScene()
  const camera = viewer.context.getCamera()
  const vrButton = VRButton.createButton(renderer)
  document.body.appendChild(vrButton);

  viewer.context.renderer.renderer.setAnimationLoop(function () {
    renderer.render(scene, camera);
  })
}

// IFC MODEL

if (window.location.href.indexOf("viewer-ifc.html") != -1) {

  const helpButton = document.getElementById("help-button");
  helpButton.onclick= () => {
    showHelp(helpButton);
  }

  const loaderScreen = document.getElementById("loader");
  const progressText = document.getElementById("progress");

  loadModels("./IFC/sample_project.ifc", loaderScreen, progressText);

  pick();

  const dimButton = document.getElementById("dimension-button");
  dimButton.onclick = () => {
    disallowTools();
    dimButton.classList.toggle("active");
    createDimension(dimButton);
  };

  const cleanButton = document.getElementById("clean-button");
  cleanButton.addEventListener("click", () => {
    disallowTools();
    viewer.dimensions.previewActive = false;

    viewer.dimensions.deleteAll();
    viewer.clipper.deleteAllPlanes();
    viewer.clipper.active = false;
    viewer.context.renderer.postProduction.update();

    const commentsDel = document.getElementsByClassName("delete-button");
    for (let i of commentsDel) {
      i.click();
    }
    if (commentsDel) {
      return;
    }
  });

  const propsDrag = document.getElementById("properties");
  dragElement(propsDrag);

  const commentButton = document.getElementById("comments-button");
  commentButton.addEventListener("click", () => {
    disallowTools();
    commentButton.classList.toggle("active");
    commentCreate(commentButton);
  });

  const clippingButton = document.getElementById("clip-plane");
  clippingButton.onclick = () => {
    disallowTools();
    viewer.clipper.active = true;
    clippingButton.classList.add("active");
    clippingPlane(clippingButton);
  };

  const treeButton = document.getElementById("tree-menu");
  const treeMenu = document.getElementById("ifc-tree-menu");
  treeButton.onclick = () => {
    treeMenu.classList.toggle("hidden");
    treeButton.classList.toggle("allowed");
  };

  const propsButton = document.getElementById("get-props");
  const propsTab = document.getElementById("properties");
  propsButton.onclick = () => {
    propsTab.classList.toggle("hidden");
    propsButton.classList.toggle("allowed");
  };
}

async function loadModels(url, loader, textProgress) {
  const model = await viewer.IFC.loadIfcUrl(
    url,
    true,

    (progress) => {
      const progressPercent = Math.trunc(
        (progress.loaded / progress.total) * 100
      );
      textProgress.textContent = `${progressPercent}%`;
    },

    (error) => {
      console.log(error);
    }
  );

  await viewer.shadowDropper.renderShadow(model.modelID);
  viewer.context.renderer.postProduction.active = true;

  loader.classList.add("hidden");

  const project = await viewer.IFC.getSpatialStructure(model.modelID);
  createTreeMenu(project);
}

async function loadGltfModel() {
  const loaderScreen = document.getElementById("loader");
  const progressText = document.getElementById("progress");
  const loader = new GLTFLoader();

  loader.load(
    "./GLTF/police_station.glb",

    (gltf) => {
      viewer.context.scene.add(gltf.scene);
      model = gltf.scene;
      loaderScreen.classList.add("hidden");
    },

    (progress) => {
      const progressPercent = Math.trunc(
        (progress.loaded / progress.total) * 100
      );
      progressText.textContent = `${progressPercent}%`;
    },

    (error) => {
      console.log(error);
    }
  );
}

function createOrOpenDatabase() {
  const db = new Dexie("ModelDatabase");

  db.version(1).stores({
    bimModels: `
      name,
      id,
      category,
      level`,
  });

  return db;
}

async function preprocessAndSaveIfc(event) {
  const file = event.target.files[0];
  url = URL.createObjectURL(file);

  const result = await viewer.GLTF.exportIfcFileAsGltf({
    ifcFileUrl: url,
    splitByFloors: true,
    categories: {
      walls: [IFCWALL, IFCWALLSTANDARDCASE],
      slabs: [IFCSLAB],
      windows: [IFCWINDOW],
      curtainwalls: [IFCMEMBER, IFCPLATE, IFCCURTAINWALL],
      doors: [IFCDOOR],
      pipes: [IFCFLOWFITTING, IFCFLOWSEGMENT, IFCFLOWTERMINAL],
      undefined: [IFCBUILDINGELEMENTPROXY],
    },
  });

  const models = [];

  for (const categoryName in result.gltf) {
    const category = result.gltf[categoryName];
    for (const levelName in category) {
      const file = category[levelName].file;
      if (file) {
        const data = await file.arrayBuffer();

        models.push({
          name: result.id + categoryName + levelName,
          id: result.id,
          category: categoryName,
          level: levelName,
          file: data,
        });
      }
    }
  }

  await db.bimModels.bulkPut(models);

  const names = models.map((model) => model.name);

  const serializedNames = JSON.stringify(names);
  localStorage.setItem("modelsNames", serializedNames);
  location.reload();
}

async function loadSavedModel() {
  const serializedNames = localStorage.getItem("modelsNames");
  const names = JSON.parse(serializedNames);

  if (!serializedNames) {
    return;
  }

  for (const name of names) {
    const savedModel = await db.bimModels.where("name").equals(name).toArray();

    const data = savedModel[0].file;
    const file = new File([data], "example");
    const url = URL.createObjectURL(file);
    await viewer.GLTF.loadModel(url);
  }
}

function removeDatabase() {
  localStorage.removeItem("modelsNames");
  db.delete();
  location.reload();
}

//DIMENSIONS

function createDimension(button) {
  if (button.classList.contains("active")) {
    viewer.dimensions.active = true;
    viewer.dimensions.previewActive = true;

    window.ondblclick = () => {
      viewer.dimensions.create();
    };

    window.onkeydown = (event) => {
      if (event.code === "Delete") {
        viewer.dimensions.delete();
        viewer.context.renderer.postProduction.update();
      } else if (event.code === "Escape") {
        viewer.dimensions.cancelDrawing();
        button.classList.remove("active");
        viewer.dimensions.previewActive = false;
        pick();
      }
    };
  }
}

//TREE MENU

function createTreeMenu(ifcProject) {
  const root = document.getElementById("tree-root");
  removeAllChildren(root);
  const ifcProjectNode = createNestedChild(root, ifcProject);
  ifcProject.children.forEach((child) => {
    constructTreeMenuNode(ifcProjectNode, child);
  });
}

function nodeToString(node) {
  return `${node.type} - ${node.expressID}`;
}

function constructTreeMenuNode(parent, node) {
  const children = node.children;
  if (children.length === 0) {
    createSimpleChild(parent, node);
    return;
  }
  const nodeElement = createNestedChild(parent, node);
  children.forEach((child) => {
    constructTreeMenuNode(nodeElement, child);
  });
}

function createNestedChild(parent, node) {
  const content = nodeToString(node);
  const root = document.createElement("li");
  createTitle(root, content);
  const childrenContainer = document.createElement("ul");
  childrenContainer.classList.add("nested");
  root.appendChild(childrenContainer);
  parent.appendChild(root);
  return childrenContainer;
}

function createTitle(parent, content) {
  const title = document.createElement("span");
  title.classList.add("caret");
  title.onclick = () => {
    title.parentElement.querySelector(".nested").classList.toggle("active-caret");
    title.classList.toggle("caret-down");
  };
  title.textContent = content;
  parent.appendChild(title);
}

function createSimpleChild(parent, node) {
  const content = nodeToString(node);
  const childNode = document.createElement("li");
  childNode.classList.add("leaf-node");
  childNode.textContent = content;
  parent.appendChild(childNode);

  childNode.onmouseenter = () => {
    viewer.IFC.selector.prepickIfcItemsByID(0, [node.expressID]);
    childNode.classList.toggle("highlited")
  };

  childNode.onclick = async () => {
    viewer.IFC.selector.pickIfcItemsByID(0, [node.expressID]);
  };

  childNode.onmouseleave = () => {
    childNode.classList.toggle("highlited")
  }
}

function removeAllChildren(element) {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}

/*GET PROPERTIES*/

function createPropertyEntry(key, value, propsGUI) {
  const propContainer = document.createElement("div");
  propContainer.classList.add("ifc-property-item");

  if (value === null || value === undefined) value = "undefined";
  else if (value.value) value = value.value;

  const keyElement = document.createElement("div");
  keyElement.textContent = key;
  propContainer.appendChild(keyElement);

  const valueElement = document.createElement("div");
  valueElement.classList.add("ifc-property-value");
  valueElement.textContent = value;
  propContainer.appendChild(valueElement);

  propsGUI.appendChild(propContainer);
}

async function loadProps(properties) {
  const propsGUI = document.getElementById("ifc-property-menu-root");
  removeAllChildren(propsGUI);

  delete properties.psets;
  delete properties.mats;
  delete properties.type;

  for (let key in properties) {
    createPropertyEntry(key, properties[key], propsGUI);
  }
}

function dragElement(elmnt) {
  const propsTable = document.getElementById(elmnt.id + "-header");
  let pos1 = 0,
    pos2 = 0,
    pos3 = 0,
    pos4 = 0;
  if (propsTable) {
    propsTable.onmousedown = dragMouseDown;
  } else {
    elmnt.onmousedown = dragMouseDown;
  }

  function dragMouseDown(e) {
    e = e || window.event;
    e.preventDefault();

    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;

    document.onmousemove = elementDrag;
  }

  function elementDrag(e) {
    e = e || window.event;
    e.preventDefault();

    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;

    elmnt.style.top = elmnt.offsetTop - pos2 + "px";
    elmnt.style.left = elmnt.offsetLeft - pos1 + "px";
  }

  function closeDragElement() {
    document.onmouseup = null;
    document.onmousemove = null;
  }
}

//CLIPPING PLANE

function clippingPlane(button) {
  if (button.classList.contains("active")) {
    window.onkeydown = (event) => {
      if (event.code === "Delete") {
        viewer.clipper.deletePlane();
      } else if (event.code === "Escape") {
        button.classList.remove("active");
        viewer.clipper.active = false;
        pick();
      }
    };
    window.ondblclick = () => {
      viewer.clipper.createPlane();
    };
  }
}

//COMMENT

function commentCreate(button) {
  if (button.classList.contains("active")) {
    window.ondblclick = () => {
      const object = viewer.context.castRayIfc();
      const locationPoint = object.point;

      const result = window.prompt("Describe the situation:");
      if (result === null) return;

      const labelContainer = document.createElement("div");
      labelContainer.className = "label-container";

      const deleteButton = document.createElement("button");
      deleteButton.textContent = "X";
      deleteButton.classList.add("delete-button");
      deleteButton.classList.add("hidden");
      labelContainer.appendChild(deleteButton);

      const label = document.createElement("p");
      label.textContent = result;
      label.classList.add("label");
      labelContainer.appendChild(label);

      const labelObject = new CSS2DObject(labelContainer);
      labelObject.position.copy(locationPoint);
      const ifcScene = viewer.context.getScene();
      ifcScene.add(labelObject);

      deleteButton.onclick = () => {
        labelObject.removeFromParent();
        labelObject.element = null;
        labelContainer.remove();
      };

      labelContainer.onmouseenter = () =>
        deleteButton.classList.remove("hidden");
      labelContainer.onmouseleave = () => deleteButton.classList.add("hidden");
    };
    window.onkeydown = (event) => {
      if (event.code === "Escape") {
        button.classList.remove("active");
        pick();
      }
    };
  }
}

function disallowTools() {
  toolButtons = document.getElementsByClassName("active");
  for (i of toolButtons) {
    i.classList.remove("active");
  }
}

async function pick() {
  window.onmousemove = () => viewer.IFC.selector.prePickIfcItem();
  window.ondblclick = async () => {
    const found = await viewer.IFC.selector.pickIfcItem(false, true);
    if (found) {
      const result = await viewer.IFC.getProperties(
        found.modelID,
        found.id,
        true,
        true
      );
      loadProps(result);
    }
  };
}

function showHelp(button){
  const helpScreen = document.getElementById("help-tab")
  button.onclick = () => {
    helpScreen.classList.toggle("hidden")
  };
}