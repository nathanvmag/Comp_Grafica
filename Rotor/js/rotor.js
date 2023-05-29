/**
 * @file
 *
 * Summary.
 * <p>Hierarchical Robot object using a matrix stack.</p>
 *
 * @author Paulo Roma
 * @since 27/09/2016
 * @see <a href="/WebGL/labs/WebGL/Assignment_3/Hierarchy.html">link</a>
 * @see <a href="/WebGL/labs/WebGL/Assignment_3/Hierarchy.js">source</a>
 * @see <a href="/WebGL/labs/WebGL/teal_book/cuon-matrix.js">cuon-matrix</a>
 * @see <a href="/roma/Computer Graphics (3rd Edition).pdf#page=189">Foley</a>
 * @see <a href="https://www.cs.drexel.edu/~david/Classes/ICG/Lectures_new/L-14_HierchModels.pdf">Hierarchical Modeling</a>
 * @see <a href="/WebGL/labs/WebGL/Assignment_3/5.hierarchy.pdf">Hierarchy Tutorial</a>
 * @see <img src="../robot3.png" width="256"> <img src="../robot-full.png" width="420">
 * @see <img src="../camera_view_frustum.svg" width="340"> <img src="../side_view_frustum.png" width="340">
 */

"use strict";

// A few global variables...

/**
 * The OpenGL context.
 * @type {WebGL2RenderingContext}
 */
var gl;

/**
 * Handle to a buffer on the GPU.
 * @type {WebGLBuffer}
 */
var vertexBuffer;

/**
 * Handle to a buffer on the GPU.
 * @type {WebGLBuffer}
 */
var vertexNormalBuffer;

/**
 * Handle to a buffer on the GPU.
 * @type {WebGLBuffer}
 */
var vertexColorBuffer;

/**
 * Handle to the compiled shader program on the GPU.
 * @type {WebGLProgram}
 */
var lightingShader;

/**
 * Joint angles.
 * @type {Object<{String:Number}>}
 */
var joint = {
  blade:0,
  generator:0,
  turbine:45,
  base:0
};


//Rotator matrixes

var shaftMatrix = new Matrix4().setTranslate(0, -5, 0).rotate(joint.turbine,0,1,0);
var baseMatrix = new Matrix4().setTranslate(0, -12.5, 0).rotate(joint.base,0,1,0);
var generatorMatrix = new Matrix4().setTranslate(0, 12, 0).rotate(joint.generator,0,1,0);
var generatorBlobMatrix = new Matrix4().setTranslate(0, 2, 0);
var rotorDummyMatrix = new Matrix4().setTranslate(0, 0, 3.2);
var rotorMatrix = new Matrix4().setTranslate(0, 0, 0.3);
var rotorBlobMatrix = new Matrix4().setTranslate(0, 0, 0.5);
var rotorBladeMatrix = new Matrix4().setTranslate(0, 0,0 );


var shaftMatrixLocal = new Matrix4().setScale(2, 25, 2);
var baseMatrixLocal = new Matrix4().setScale(6, 0.5, 6);
var generatorMatrixLocal = new Matrix4().setScale(4, 3, 6);
var generatorBlobMatrixLocal = new Matrix4().setScale(2.5, 1, 4);
var rotorDummyMatrixLocal = new Matrix4().setScale(0.4,0.4,0.4);
var rotorMatrixLocal = new Matrix4().setScale(1.5,1.5,1);
var rotorBlobLocal = new Matrix4().setScale(0.5, 0.5, 0.5);
var rotorBladeLocal = new Matrix4().setScale(1, 20, 0.3);


//Control Variables
var bladeAnimation=true;
var bladeSpeed=6;
var bladeDirection= 1;

/**
 * Camera position.
 * @type {Array<Number>}
 */
var eye = [20, 20, 20];

/**
 * View matrix.
 * @type {Matrix4}
 */
// prettier-ignore
var viewMatrix = new Matrix4().setLookAt(
  ...eye,     // eye
  0, 0, 0,    // at - looking at the origin
  0, 1, 0     // up vector - y axis
);

/**
 * Model matrix.
 * @type {Matrix4}
 */
var modelMatrix = new Matrix4();

/**
 * Returns the magnitude (length) of a vector.
 * @param {Array<Number>} v n-D vector.
 * @returns {Number} vector length.
 * @see https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array/Reduce
 */
var vecLen = (v) =>
  Math.sqrt(v.reduce((accumulator, value) => accumulator + value * value, 0));

/**
 * View distance.
 * @type {Number}
 */
var viewDistance = vecLen(eye);

/**
 * <p>Projection matrix.</p>
 * Here use aspect ratio 3/2 corresponding to canvas size 600 x 400.
 * @type {Matrix4}
 */
var projection = new Matrix4().setPerspective(45, 1.5, 0.1, 1000);

/**
 * Object to enable rotation by mouse dragging (arcball).
 * @type {SimpleRotator}
 */
var rotator;

/**
 * A very basic stack class,
 * for keeping a hierarchy of transformations.
 * @class
 */
class Stack {
  /**
   * Constructor.
   * @constructs Stack
   */
  constructor() {
    /** Array for holding the stack elements. */
    this.elements = [];
    /** Top of the stack. */
    this.t = 0;
  }

  /**
   * Pushes a given matrix onto this stack.
   * @param {Matrix4} m transformation matrix.
   */
  push(m) {
    this.elements[this.t++] = m;
  }

  /**
   * Return the matrix at the top of this stack.
   * @return {Matrix4} m transformation matrix.
   */
  top() {
    if (this.t < 0) {
      console.log("top = ", this.t);
      console.log("Warning: stack underflow");
    } else {
      return this.elements[this.t - 1];
    }
  }

  /**
   * Pops the matrix at the top of this stack.
   * @return {Matrix4} m transformation matrix.
   */
  pop() {
    if (this.t <= 0) {
      console.log("Warning: stack underflow");
    } else {
      this.t--;
      var temp = this.elements[this.t];
      this.elements[this.t] = undefined;
      return temp;
    }
  }

  /**
   * Returns whether this stack is empty.
   * @returns {Boolean} true if the stack is empty.
   */
  isEmpty() {
    return this.t <= 0;
  }
}

/**
 * <p>A cube model.</p>
 *
 * Creates data (numVertices, vertices, colors, and normal vectors)
 * for a unit cube. <br>
 * (Note this is a "self-invoking" anonymous function.)
 *
 * @type {cube_data}
 */
var cube = (() => {
  // vertices of cube
  // prettier-ignore
  var rawVertices = new Float32Array([
      -0.5, -0.5, 0.5,
      0.5, -0.5, 0.5,
      0.5, 0.5, 0.5,
      -0.5, 0.5, 0.5,
      -0.5, -0.5, -0.5,
      0.5, -0.5, -0.5,
      0.5, 0.5, -0.5,
      -0.5, 0.5, -0.5
    ]);

  // prettier-ignore
  var rawColors = new Float32Array([
      1.0, 0.0, 0.0, 1.0,
      1.0, 0.0, 0.0, 1.0,
      1.0, 0.0, 0.0, 1.0,
      1.0, 0.0, 0.0, 1.0,
      0, 0, 0, 1,  // magenta
      0, 0, 0, 1,  // cyan
    ]);

  // prettier-ignore
  var rawNormals = new Float32Array([
      0, 0, 1,
      1, 0, 0,
      0, 0, -1,
      -1, 0, 0,
      0, 1, 0,
      0, -1, 0
    ]);

  // prettier-ignore
  var indices = new Uint16Array([
      0, 1, 2, 0, 2, 3,  // +z face
      1, 5, 6, 1, 6, 2,  // +x face
      5, 4, 7, 5, 7, 6,  // -z face
      4, 0, 3, 4, 3, 7,  // -x face
      3, 2, 6, 3, 6, 7,  // +y face
      4, 5, 1, 4, 1, 0   // -y face
    ]);

  var verticesArray = [];
  var colorsArray = [];
  var normalsArray = [];
  for (var i = 0; i < 36; ++i) {
    // for each of the 36 vertices...
    var face = Math.floor(i / 6);
    var index = indices[i];

    // (x, y, z): three numbers for each point
    for (var j = 0; j < 3; ++j) {
      verticesArray.push(rawVertices[3 * index + j]);
    }

    // (r, g, b, a): four numbers for each point
    for (var j = 0; j < 4; ++j) {
      colorsArray.push(rawColors[4 * face + j]);
    }

    // three numbers for each point
    for (var j = 0; j < 3; ++j) {
      normalsArray.push(rawNormals[3 * face + j]);
    }
  }

  /**
   * Returned value is an object with four attributes:
   * numVertices, vertices, colors, and normals.
   *
   * @return {Object<{numVertices: Number,
   *                  vertices: Float32Array,
   *                  colors: Float32Array,
   *                  normals: Float32Array}>}
   * cube associated attributes.
   * @callback cube_data
   */
  return {
    numVertices: 36, // number of indices
    vertices: new Float32Array(verticesArray), // 36 * 3 = 108
    colors: new Float32Array(colorsArray), // 36 * 4 = 144
    normals: new Float32Array(normalsArray), // 36 * 3 = 108
  };
})();

/**
 * Return a matrix to transform normals, so they stay
 * perpendicular to surfaces after a linear transformation.
 * @param {Matrix4} model model matrix.
 * @param {Matrix4} view view matrix.
 * @returns {Float32Array} modelview transposed inverse.
 */
function makeNormalMatrixElements(model, view) {
  var n = new Matrix4(view).multiply(model);
  n.transpose();
  n.invert();
  n = n.elements;
  // prettier-ignore
  return new Float32Array([
      n[0], n[1], n[2],
      n[4], n[5], n[6],
      n[8], n[9], n[10]
    ]);
}

/**
 * Translate keydown events to strings.
 * @param {KeyboardEvent} event keyboard event.
 * @return {String | null}
 * @see http://javascript.info/tutorial/keyboard-events
 */
function getChar(event) {
  event = event || window.event;
  let charCode = event.key || String.fromCharCode(event.which);
  return charCode;
}

/**
 * <p>Handler for keydown events.</p>
 * Adjusts object rotations.
 * @param {KeyboardEvent} event keyboard event.
 */
function handleKeyPress(event) {
  var ch = getChar(event);
  var d;
  let opt = document.getElementById("options");
  switch (ch) {
    case "r":
      bladeDirection = bladeDirection = -1;
      break;
    case "R":
      bladeDirection = bladeDirection = 1;
      break;
    case "s":
      bladeSpeed = bladeSpeed - 1 < 2 ? 2 : bladeSpeed - 1;
      break;
    case "S":
      bladeSpeed = bladeSpeed + 1 > 15 ? 15 : bladeSpeed + 1;
      break;
    case "a":
      bladeAnimation = !bladeAnimation;
      break;
    case "G":
      joint.generator += 10;
      generatorMatrix.setTranslate(0, 12, 0).rotate(joint.generator, 0, 1, 0);
      break;
    case "g":
      joint.generator -= 10;
      generatorMatrix.setTranslate(0, 12, 0).rotate(joint.generator, 0, 1, 0);
      break;
    case "T":
      joint.turbine += 10;
      shaftMatrix.setTranslate(0, -5, 0).rotate(joint.turbine, 0, 1, 0);
      break;
    case "t":
      joint.turbine -= 10;
      shaftMatrix.setTranslate(0, -5, 0).rotate(joint.turbine, 0, 1, 0);
      break;
    case "B":
      joint.base += 10;
      baseMatrix.setTranslate(0, -12.5, 0).rotate(joint.base, 0, 1, 0);
      break;
    case "b":
      joint.base -= 10;
      baseMatrix.setTranslate(0, -12.5, 0).rotate(joint.base, 0, 1, 0);
      break;
    case "o":
      joint = {
        blade: joint.blade,
        generator: 0,
        turbine: 45,
        base: 0,
      };
      shaftMatrix.setTranslate(0, -5, 0).rotate(joint.turbine, 0, 1, 0);
      baseMatrix.setTranslate(0, -12.5, 0).rotate(joint.base, 0, 1, 0);
      generatorMatrix.setTranslate(0, 12, 0).rotate(joint.generator, 0, 1, 0);

      eye = [20, 20, 20];

      viewMatrix = new Matrix4().setLookAt(
        ...eye,     // eye
        0, 0, 0,    // at - looking at the origin
        0, 1, 0     // up vector - y axis
      );
      var viewDistance = vecLen(eye);
      rotator.setViewMatrix(viewMatrix.elements);
      rotator.setViewDistance(viewDistance);




    case "ArrowUp":
      // Up pressed
      d = rotator.getViewDistance();
      d = Math.min(d + 1, 90);
      rotator.setViewDistance(d);
      break;
    case "ArrowDown":
      // Down pressed
      d = rotator.getViewDistance();
      d = Math.max(d - 1, 20);
      rotator.setViewDistance(d);
      break;

    default:
      return;
  }

  opt.innerHTML = `<br>${gl.getParameter(
    gl.SHADING_LANGUAGE_VERSION
  )}<br>${gl.getParameter(gl.VERSION)}`;
}

/**
 * <p>Helper function.</p>
 * Renders the cube based on the model transformation
 * on top of the stack and the given local transformation.
 * @param {Matrix4} matrixStack matrix on top of the stack;
 * @param {Matrix4} matrixLocal local transformation.
 */
function renderCube(matrixStack, matrixLocal) {
  // bind the shader
  gl.useProgram(lightingShader);

  // get the index for the a_Position attribute defined in the vertex shader
  var positionIndex = gl.getAttribLocation(lightingShader, "a_Position");
  if (positionIndex < 0) {
    console.log("Failed to get the storage location of a_Position");
    return;
  }

  var normalIndex = gl.getAttribLocation(lightingShader, "a_Normal");
  if (normalIndex < 0) {
    console.log("Failed to get the storage location of a_Normal");
    return;
  }

  var colorIndex = gl.getAttribLocation(lightingShader, "a_Color");
  if (colorIndex < 0) {
    console.log("Failed to get the storage location of a_Color");
    return;
  }

  // "enable" the a_position attribute
  gl.enableVertexAttribArray(positionIndex);
  gl.enableVertexAttribArray(normalIndex);
  gl.enableVertexAttribArray(colorIndex);

  // bind data for points and normals
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.vertexAttribPointer(positionIndex, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexNormalBuffer);
  gl.vertexAttribPointer(normalIndex, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexColorBuffer);
  gl.vertexAttribPointer(colorIndex, 4, gl.FLOAT, false, 0, 0);

  var loc = gl.getUniformLocation(lightingShader, "view");
  gl.uniformMatrix4fv(loc, false, viewMatrix.elements);
  loc = gl.getUniformLocation(lightingShader, "projection");
  gl.uniformMatrix4fv(loc, false, projection.elements);
  loc = gl.getUniformLocation(lightingShader, "u_Color");
  gl.uniform4f(loc, 0.0, 1.0, 0.0, 1.0);
  var loc = gl.getUniformLocation(lightingShader, "lightPosition");
  gl.uniform4f(loc, 5.0, 10.0, 5.0, 1.0);

  var modelMatrixloc = gl.getUniformLocation(lightingShader, "model");
  var normalMatrixLoc = gl.getUniformLocation(lightingShader, "normalMatrix");

  // transform using current model matrix on top of stack
  var current = new Matrix4(matrixStack.top()).multiply(matrixLocal);
  current = new Matrix4(modelMatrix).multiply(current);
  gl.uniformMatrix4fv(modelMatrixloc, false, current.elements);
  gl.uniformMatrix3fv(
    normalMatrixLoc,
    false,
    makeNormalMatrixElements(current, viewMatrix)
  );

  gl.drawArrays(gl.TRIANGLES, 0, cube.numVertices);

  // on safari 10, buffer cannot be disposed before drawing...
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  gl.useProgram(null);
}

/**
 * <p>Code to actually render our geometry.</p>
 * @param {Boolean} useRotator whether a {@link SimpleRotator} should be used.
 */
//Updates contents before draw
function update()
{
	if (bladeAnimation) {
		joint.blade += bladeSpeed*bladeDirection;
		rotorDummyMatrix.setTranslate(0, 0, 3.2).rotate(joint.blade, 0, 0);
	}


}
function draw(useRotator = true) {
  // clear the framebuffer
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  if (useRotator) viewMatrix.elements = rotator.getViewMatrix();


  var s = new Stack();

  s.push(new Matrix4(s.top()).multiply(shaftMatrix));
  renderCube(s, shaftMatrixLocal);

  s.push(new Matrix4(s.top()).multiply(generatorMatrix));
  renderCube(s, generatorMatrixLocal);

  s.push(new Matrix4(s.top()).multiply(rotorDummyMatrix));
  renderCube(s, rotorDummyMatrixLocal);

  s.push(new Matrix4(s.top()).multiply(rotorMatrix));
  renderCube(s, rotorMatrixLocal);

  s.push(new Matrix4(s.top()).multiply(rotorBladeMatrix));
  renderCube(s, rotorBladeLocal);

  s.push(new Matrix4(s.top()).multiply(rotorBlobMatrix));
  renderCube(s, rotorBlobLocal);
  s.pop();
  s.pop();
  s.pop();
  s.pop();

  s.push(new Matrix4(s.top()).multiply(generatorBlobMatrix));
  renderCube(s, generatorBlobMatrixLocal);
  s.pop();
  s.pop();

  //base Relative to shaft
  s.push(new Matrix4(s.top().multiply(baseMatrix)));
  renderCube(s, baseMatrixLocal);
  s.pop();
  s.pop();

  if (!s.isEmpty()) {
    console.log("Warning: pops do not match pushes");
  }
}

/**
 * <p>Entry point when page is loaded.</p>
 *
 * Starts an {@link animate animation} loop.
 *
 * <p>Basically this function does setup that "should" only have to be done once,<br>
 * while draw() does things that have to be repeated each time the canvas is
 * redrawn.</p>
 * @function
 * @memberof Window
 * @name anonymous_load
 * @global
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Window/load_event
 */
window.addEventListener("load", (event) => {
  // retrieve <canvas> element
  var canvas = document.getElementById("theCanvas");

  // key handler
  window.addEventListener("keydown", (event) => {
    if (
      ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].indexOf(
        event.code
      ) > -1
    ) {
      event.preventDefault();
    }
    handleKeyPress(event);
  });

  gl = canvas.getContext("webgl2");
  if (!gl) {
    console.log("Failed to get the rendering context for WebGL");
    return;
  }

  // load and compile the shader pair, using utility from the teal book
  var vshaderSource = document.getElementById(
    "vertexLightingShader"
  ).textContent;
  var fshaderSource = document.getElementById(
    "fragmentLightingShader"
  ).textContent;
  if (!initShaders(gl, vshaderSource, fshaderSource)) {
    console.log("Failed to initialize shaders.");
    return;
  }
  lightingShader = gl.program;
  gl.useProgram(null);

  // At any given time there can only be one buffer bound for each type
  // (ARRAY_BUFFER and ELEMENT_ARRAY_BUFFER),
  // so the flow is to bind a buffer and set its data followed
  // by setting up the vertex attribute pointers for that specific buffer,
  // then proceed to the next buffer:

  // buffer for vertex positions for triangles
  vertexBuffer = gl.createBuffer();
  if (!vertexBuffer) {
    console.log("Failed to create the buffer object");
    return;
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, cube.vertices, gl.STATIC_DRAW);

  // buffer for vertex normals
  vertexNormalBuffer = gl.createBuffer();
  if (!vertexNormalBuffer) {
    console.log("Failed to create the buffer object");
    return;
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexNormalBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, cube.normals, gl.STATIC_DRAW);

  // buffer for vertex colors
  vertexColorBuffer = gl.createBuffer();
  if (!vertexColorBuffer) {
    console.log("Failed to create the buffer object");
    return;
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexColorBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, cube.colors, gl.STATIC_DRAW);

  // buffer is not needed anymore (not necessary, really)
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  // specify a fill color for clearing the framebuffer
  gl.clearColor(0.9, 0.9, 0.9, 1.0);

  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);
  gl.cullFace(gl.BACK);

  // fix aspect ratio
  projection = new Matrix4().setPerspective(
    60,
    canvas.width / canvas.height,
    0.1,
    1000
  );

  // create new rotator object
  rotator = new SimpleRotator(canvas, draw);
  rotator.setViewMatrix(viewMatrix.elements);
  rotator.setViewDistance(viewDistance);

  /**
   * <p>Define an animation loop.</p>
   * Start drawing!
   * @callback animate
   */
  (function animate() {
	update();
    draw();
    requestAnimationFrame(animate);
  })();
});
