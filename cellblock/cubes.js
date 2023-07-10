import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const FLD_W = 9; // Number of BLOCKS wide
const FLD_W_SQ = 81;
const CUBE_W = 100; //Pixel width of a block
const OFFSET = Math.floor((FLD_W * CUBE_W) / 2);
const BOX = new THREE.BoxGeometry(CUBE_W, CUBE_W, CUBE_W);
const SIDE3 = new THREE.MeshBasicMaterial({
  map: new THREE.TextureLoader().load("./pics/3.png")
});
const SIDE9 = new THREE.MeshBasicMaterial({
  map: new THREE.TextureLoader().load("./pics/9.png")
});
const SIDE27 = new THREE.MeshBasicMaterial({
  map: new THREE.TextureLoader().load("./pics/27.png")
});
const SIDE81 = new THREE.MeshBasicMaterial({
  map: new THREE.TextureLoader().load("./pics/81.png")
});
const BLANK = new THREE.MeshBasicMaterial({
  map: new THREE.TextureLoader().load("./pics/blank.png"),
  color: 0xffffff,
  opacity: 0.2,
  transparent: true
});

let session;

function blockIndex(x, y, z) {
  return x + y * FLD_W + z * FLD_W_SQ;
}

const cubistColors = [
  "#880000",
  "#008800",
  "#000088",
  "#228800",
  "#002288",
  "#880022"
];
var usedColors = [];

class Cubist {
  constructor(aName) {
    this.cubistName = aName;
    this.setColor(Cubist.newColor());
  }

  setColor(aColor) {
    if (!aColor) {
      usedColors.splice(usedColors.indexOf(this.cubistColor),1);
      return;
    }
    this.cubistColor = aColor;
    usedColors.push(aColor);
  }

  static newColor() {
    let rslt = "#aaa";
    for (const col of cubistColors) {
      if (usedColors.indexOf(col) < 0) {
        rslt = col;
        break;
      }
    }
    return rslt;
  }
}

class BlockModel extends Croquet.Model {
  init(options = {}) {
    super.init(options);
    this.model = options.model;
    this.cubeValue = options.value;
    this.position = options.position;
    this.color = null;
    this.subscribe(this.id, "block-move", this.blockMove);
  }

  blockMove(data) {
    //Fail if a block already exists adjacent to this block
    if (this.model.existsAdjacent(this.position.x, this.position.y, this.position.z)) { return }

    //Ownership
    let u = this.model.views.get(data.view);
    if (!u) { console.log("User not found"); return; }
    if (this.owner && this.owner != u) { return }
    if (!this.owner) {
      this.owner = u;
      this.publish(this.id, "owner");
    }
    let x = this.position.x + data.delta[0];
    let y = this.position.y + data.delta[1];
    let z = this.position.z + data.delta[2];
    //Fail if the move ends up outside the field of play
    if ( x < 0 || x >= FLD_W || y < 0 || y >= FLD_W || z < 0 || z >= FLD_W) { return }
    //Fail if a block already exists at the new index (should never happen)
    if (this.model.blocks[blockIndex(x, y, z)]) { return }

    let oldIndex = this.index();
    this.position = new THREE.Vector3(x, y, z);
    let newIndex = this.index();
    this.model.moveBlock(oldIndex, newIndex);
  }

  index() {
    return blockIndex(this.position.x, this.position.y, this.position.z);
  }

  matches(aBlock) {
    return (aBlock.value == this.value)
         && (!aBlock.owner || aBlock.owner == this.owner)
  }
  side() {
    switch (this.cubeValue) {
      case 3:
        return SIDE3;
      case 9:
        return SIDE9;
      case 27:
        return SIDE27;
      case 81:
        return SIDE81;
      default:
        return BLANK;
    }
  }

  clearOwner() {
    this.owner = null;
    this.publish(this.id, "owner");
  }
}

BlockModel.register("BlockModel");

class CubesModel extends Croquet.Model {
  static types() {
    return {
      CubistClass: {
        cls: Cubist,
        write: (c) => ({ cubistName: c.cubistName, cubistColor: c.cubistColor }),
        read: ({ cubistName, cubistColor }) => { let c = new Cubist(cubistName); c.setColor(cubistColor); return c }
      },
      "THREE.Vector3": {
        cls: THREE.Vector3,
        write: (v) => ({ x: v.x, y: v.y, z: v.z }),
        read: ({ x, y, z }) => new THREE.Vector3(x, y, z)
      }
    };
  }

  init() {
    super.init();
    this.blocks = new Array();
    this.blockMap = new Map();
    this.initBlocks();
    this.views = new Map();
    this.subscribe(this.id, "new-name", this.changeName);
    this.subscribe(this.sessionId, "view-join", this.viewJoin);
    this.subscribe(this.sessionId, "view-exit", this.viewExit);
  }

  initBlocks() {
    let x, y, z;
    for (let i = 0; i < FLD_W; i++) {
      for (let j = 0; j < 3; j++) {
        do {
          x = i;
          y = THREE.MathUtils.randInt(0, FLD_W);
          z = THREE.MathUtils.randInt(0, FLD_W);
        } while (this.existsAdjacent(x, y, z));

        const blk = BlockModel.create({
          model: this,
          value: 3,
          position: new THREE.Vector3(x, y, z)
        });
        this.blockMap.set(blockIndex(x,y,z),blk);
      }
    }
  }

  /*****************************************************************************
    Returns an array of (up to six) adjacent blocks
    in the six fields adjacent to each face of aBlock
  ******************************************************************************/
  getAdjacent(aBlock, seen = []) {
    let idx = aBlock.index();
    let rslt = [];
    let blk;
    if (aBlock.position.x < FLD_W - 1) {
      blk = this.blockMap.get(idx + 1);
      if (blk && seen.indexOf(blk) < 0 && aBlock.matches(blk)) { rslt.push(blk) }
    }
    if (aBlock.position.x > 1) {
      blk = this.blockMap.get(idx - 1);
      if (blk && seen.indexOf(blk) < 0 && aBlock.matches(blk)) { rslt.push(blk) }
    }
    if (aBlock.position.y < FLD_W - 1) {
      blk = this.blockMap.get(idx + FLD_W);
      if (blk && seen.indexOf(blk) < 0 && aBlock.matches(blk)) { rslt.push(blk) }
    }
    if (aBlock.position.y > 1) {
      blk = this.blockMap.get(idx - FLD_W);
      if (blk && seen.indexOf(blk) < 0 && blk && aBlock.matches(blk)) { rslt.push(blk) }
    }
    if (aBlock.position.z < FLD_W - 1) {
      blk = this.blockMap.get(idx + FLD_W_SQ);
      if (blk && seen.indexOf(blk) < 0 && aBlock.matches(blk)) { rslt.push(blk) }
    }
    if (aBlock.position.z > 1) {
      blk = this.blockMap.get(idx - FLD_W_SQ);
      if (blk && seen.indexOf(blk) < 0 && aBlock.matches(blk)) { rslt.push(blk) }
    }
    return rslt;
  }

  /*****************************************************************************
    Returns an array of ALL adjacent blocks if any;
    given the possible six adjacent blocks returned from getAdjacent,
    each of those can have another block adjacent to it
  ******************************************************************************/
  findAdjacent(aBlock) {
    let seen = [],rslt = [];
    seen.push(aBlock);
    let blks = this.getAdjacent(aBlock,seen);
    rslt = rslt.concat(blks);
    for (const blk of blks) {
      seen.push(blk);
      rslt.concat(this.getAdjacent(blk,seen));
    }
    return rslt
  }

  /*****************************************************************************
    Move one block
  ******************************************************************************/
  moveBlock(oldIndex, newIndex) {
    let aBlock = this.blockMap.get(oldIndex);
    if (!aBlock) {
      console.log("Block not found!");
      return false;
    }
    this.blockMap.delete(oldIndex);
    this.blockMap.set(newIndex,aBlock);
    this.publish(this.id, "move-block", { oldIndex: oldIndex, newIndex: newIndex });

    // see if we have any cubes
    let adjacent = this.getAdjacent(aBlock);
    if (adjacent.length < 2) { return }

    //let newBlks = [], newBlk=null;
    //let mult = Math.floor(adjacent.length / 2); //Up to TEN possible adjacent blocks !!
    //for (let i=0; i<mult; i++) {
    //  newBlks.push(BlockModel.create({ model: this.model, value: 3 * aBlock.cubeValue, position: aBlock.position }));
    //}


    for (const blk of adjacent) {
      let rmv = this.getAdjacent(blk);
      if (rmv.size == 2) {
        for (const b in rmv) {
          i = b.index();
          this.blockMap.delete(i);
          this.publish(this.id,"remove-block",i);
	}
      }

      if (newBlks.length>0) {
        newBlk = newBlks.shift();
        newBlk.position = blk.position;
        this.blockMap.set(idx,newBlk);
        this.publish(this.id,"add-block",idx);
      }
      this.setRandomPosition(blk);
      //this.blockMap.set(blk.index(),blk);
      this.publish(this.id,"add-block",blk.idx);
    }
  }

  /*****************************************************************************
    Determines if fields connected to the six faces of field x,y,z are all empty
  ******************************************************************************/
  existsAdjacent(x, y, z) {
    let idx = blockIndex(x, y, z);
    return ((x < FLD_W - 1 && this.blockMap.get(idx+1))
      || (x > 1 && this.blockMap.get(idx - 1))
      || (y < FLD_W - 1 && this.blockMap.get(idx + FLD_W))
      || (y > 1 && this.blockMap.get(idx - FLD_W))
      || (z < FLD_W - 1 && this.blockMap.get(idx + FLD_W_SQ))
      || (z > 1 && this.blockMap.get(idx - FLD_W_SQ)));
  }

  setRandomPosition(aBlock) {
    let x = THREE.MathUtils.randInt(0, FLD_W);
    let y = THREE.MathUtils.randInt(0, FLD_W);

    for (let z = 0; z < FLD_W; z++) {
      if (!this.existsAdjacent(x,y,z)) {
        aBlock.position = new THREE.Vector3(x, y, z);
        this.blockMap.set(blockIndex(x,y,z),aBlock);
        return true;
      }
    }
  }

  viewJoin(viewId) {
    var isNew = !this.views.get(viewId);
    if (isNew) {
      var cubist,
        nm,
        st,
        sz = this.views.size;
      if (sz < 6) {
        nm = "Visitor" + (sz + 1);
        cubist = new Cubist(nm);
        this.views.set(viewId, cubist);
        //this.publish(viewId,"name");
        this.publish("update", "visitors");
      }
    }
  }

  viewExit(viewId) {
    if (this.views.has(viewId)) {
      const cubist = this.views.get(viewId);
      if (cubist) {
        for (let blk of this.blockMap.values()) {
          if (blk && blk.owner === cubist) { blk.clearOwner() }
        }
      }
      if (this.views.delete(viewId)) {
        this.publish("update", "visitors");
      }
    }
  }

  changeName(data) {
    this.views[data.view] = data.name;
    this.publish("update", "visitors");
  }
}

CubesModel.register("CubesModel");

/*******************************************************************************
 *********************   THREEjs Scene   ***************************************
 *******************************************************************************/
function setupScene() {
  const scene = new THREE.Scene();
  //scene.fog = new THREE.Fog( 0xffffff, 1000, 10000 );

  const cubesCanvas = document.getElementById("cubes");
  const renderer = new THREE.WebGLRenderer({ canvas: cubesCanvas });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  //renderer.setSize(cubesCanvas.clientWidth, cubesCanvas.clientHeight);

  const camera = new THREE.PerspectiveCamera(90,window.innerWidth / window.innerHeight, 0.1, 5000);
  //const camera = new THREE.PerspectiveCamera(90,cubesCanvas.clientWidth / cubesCanvas.clientHeight, 0.1, 5000);

  camera.position.set(0, 50, -1000);
  camera.lookAt(0, 100, 100);
  scene.add(camera);

  function doResize () {
      camera.aspect = window.innerWidth / window.innerHeight; //cubesCanvas.clientWidth / cubesCanvas.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener("resize", doResize, false);


  const raycaster = new THREE.Raycaster();
  const THROTTLE_MS = 1000 / 20; // minimum delay between pointer-move events that we'll handle
  const mouse = new THREE.Vector2();

  function setMouse(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  }

  function onPointerUp(event) {
    event.preventDefault();
    setMouse(event); // convert from window coords to relative (-1 to +1 on each of x, y)
    raycaster.setFromCamera(mouse, camera);
    const intersected = raycaster.intersectObjects(scene.children);
    var block;
    for (let i = 0; i < intersected.length; i++) {
      block = intersected[i].object.children[0];
      if (block && block.q_onClick) {
        // found a block
        let nrml = intersected[i].face.normal.negate();
        //console.log(`clicked at ${ nrml.x }, ${ nrml.y }, ${ nrml.z }`)
        block.q_onClick([nrml.x, nrml.y, nrml.z]);
        break;
      }
    }
  }
  cubesCanvas.addEventListener("pointerup", onPointerUp);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.minDistance = 500;
  controls.enableDamping = true;

  /*
  document.onkeydown = function(e) {
    console.log(e);
    if (e.ctrlKey) {
      controls.enabled = !controls.enabled;
      }
  }
  // cubesCanvas.addEventListener('keydown',onKeyDown);
  */

  // function that the app must invoke when ready to render the scene
  // on each animation frame.
  function sceneRender() {
    renderer.render(scene, camera);
    //controls.update;
  }

  return { scene, sceneRender };
}
/*******************************************************************************
*********************   THREEjs Scene   ****************************************
*******************************************************************************/

class BlockView extends Croquet.View {
  constructor(aBlock) {
    super(aBlock);
    this.block = aBlock;
    this.cube = new THREE.Mesh(BOX, aBlock.side());
    this.block.scene
    this.cube.q_onClick = (data) =>
      this.publish(this.block.id, "block-move", {
        view: this.viewId,
        delta: data
      });
    this.subscribe(this.viewId, "owner", this.doOwner);
    //this.subscribe(this.block.id, "destroy",this.destroy)
  }

  doOwner() {
    let col = "#aaa";
    if (this.block.owner) {
      col = this.block.owner.cubistColor;
    }
    this.cube.texture.color = col;
  }

  destroy() {
    //scene.remove(this.cube);
    return;
  }
}

class CubesView extends Croquet.View {
  constructor(model) {
    super(model);
    this.model = model;
    this.view = model.views.get(this.viewId);
    this.playerName = this.view.playerName;
    this.fields = [];
    this.blocks = [];
    this.lastTime = 0;
    const sceneSpec = setupScene();
    this.scene = sceneSpec.scene;
    this.doRender = sceneSpec.sceneRender;

    //Setup the "grid"
    for (let i = 0; i <= FLD_W; i++) {
      for (let j = 0; j <= FLD_W; j++) {
        for (let k = 0; k <= FLD_W; k++) {
          const cx = new THREE.Mesh(BOX, BLANK);
          this.scene.add(cx);
          cx.position.set(
            i * CUBE_W - OFFSET,
            j * CUBE_W - OFFSET,
            k * CUBE_W
          );
          this.fields[i + j * FLD_W + k * FLD_W * FLD_W] = cx;
        }
      }
    }

    model.blockMap.forEach((v,k) => { this.addBlock(k) });

    this.subscribe(model.id, "move-block", this.moveBlock);
    this.subscribe(model.id, "add-block", this.addBlock);
    this.subscribe(model.id, "remove-block", this.removeBlock);

    this.subscribe(this.viewId, "name", this.doName);
    this.subscribe("update", "visitors", this.updateVisitors);

    this.doRender();
  }

  moveBlock(data) {
    this.fields[data.oldIndex].children = [];
    let bv = this.blocks[data.oldIndex];
    this.blocks[data.oldIndex] = null;
    this.blocks[data.newIndex] = bv;
    this.fields[data.newIndex].add(bv.cube);
    this.doRender();
  }

  addBlock(aIdx) {
      const aBlock = this.model.blockMap.get(aIdx);
      const bv = new BlockView(aBlock);
      this.blocks[aIdx] = bv;
      const cube = this.fields[aIdx];
      this.scene.add(bv.cube);
      cube.add(bv.cube);
      this.doRender();
  }

  removeBlock(aIdx) {
    const bv = this.blocks[aIdx];
    this.blocks[aIdx] = null;
    const cube = this.fields[aIdx];
    cube.remove(bv.cube);
  }

  update(thisTime) {
    if (thisTime - this.lastTime < 250) { return }
    this.lastTime =  thisTime;
    this.doRender();
  }

  updateVisitors(data) {
    // let html = "";
    // for (const plyr of this.model.views.values()) {
    //   html =
    //     html +
    //     `<li class="player"><span style="background-color:${plyr.cubistColor};color:white">${plyr.cubistName}</span></li>`;
    // }
    // players.innerHTML = html;
  }

  doName() {
    // let newName,
    //   tries = 0;
    // do {
    //   newName = window.prompt("Enter a name");
    //   tries += 1;
    // } while (newName === undefined && tries < 5);
    // if (newName) {
    //   this.publish(this.model.id, "new-name", {
    //     view: this.viewId,
    //     name: newName
    //   });
    // } else {
    //   window.alert("name not set! using crap");
    // }
  }
}

session = Croquet.Session.join({
  appId: "us.numero.cubes",
  apiKey: "1m5nMszAACuG8f9ADpq6F25PrIb5LhyHlx6rjDHbd",
  name: Croquet.App.autoSession(), //"Cubissimo",
  password: "paint",
  model: CubesModel,
  view: CubesView
});
