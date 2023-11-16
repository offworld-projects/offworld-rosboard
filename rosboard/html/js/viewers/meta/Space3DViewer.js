"use strict";

// Space3DViewer is an extension of a Viewer that implements the common visualization
// framework for 3D stuff.
// Space3DViewer implements drawing functionality, but does not implement any
// message decoding functionality. Child classes that inherit from Space3DViewer
// should decode a message and instruct the plotting framework what to do.

// TODO: - Either support both touch and mouse to interact, or make it a URL parameter
// const INPUT_MODE = "touch"; 
const INPUT_MODE = "mouse";

// TODO: - Set camera mode via a URL parameter
const CAMERA_MODE = "birds-eye";

class Space3DViewer extends Viewer {
  /**
    * Gets called when Viewer is first initialized.
    * @override
  **/
  
  onCreate() {
    let that = this;

    this.gl = GL.create({ version:1 });
	  $(this.gl.canvas).appendTo($(this.card.content))
    $(this.gl.canvas).css("width", "100%");
    $(this.gl.canvas).css("height", "100%");
	  this.gl.animate(); // launch loop

	  this.cam_pos = [0,0,0];
    this.cam_theta = -1.5707;
    this.cam_phi = 0.0001;
    this.cam_r = 50.0;
    this.cam_offset_x = 0.0;
    this.cam_offset_y = 0.0;
    this.cam_offset_z = 0.0;

    this.drawObjectsGl = null;

    //create basic matrices for cameras and transformation
    this.proj = mat4.create();
    this.view = mat4.create();
    this.model = mat4.create();
    this.mvp = mat4.create();
    this.temp = mat4.create();

    if (INPUT_MODE === "mouse") {
      this.gl.captureMouse(true, true);
      this.gl.onmouse = function(e) {
        if(e.dragging) {
          // Controls for birds-eye mode
          if(CAMERA_MODE === "birds-eye") {
            if (e.leftButton) {
              // Left click to pan
              that.cam_offset_x += e.deltax/1000 * Math.sin(that.cam_theta) * that.cam_r;
              that.cam_offset_y -= e.deltay/1000 * Math.sin(that.cam_theta) * that.cam_r;
              that.updatePerspective();
            } else if (e.rightButton) {
              // Right click to rotate camera around z-axisw

              // Get quadrant of mouse drag start location
              console.log(e)
            }
          }
          else if(e.rightButton) {
            that.cam_offset_x += e.deltax/30 * Math.sin(that.cam_theta);
            that.cam_offset_y -= e.deltax/30 * Math.cos(that.cam_theta);
            that.cam_offset_z += e.deltay/30;
            that.updatePerspective();
          } else {
            if(Math.abs(e.deltax) > 100 || Math.abs(e.deltay) > 100) return;
            that.cam_theta -= e.deltax / 300;
            that.cam_phi -= e.deltay / 300;

            // avoid euler singularities
            // also don't let the user flip the entire cloud around
            if(that.cam_phi < 0) {
              that.cam_phi = 0.001;
            }
            if(that.cam_phi > Math.PI) {
              that.cam_phi = Math.PI - 0.001;
            }
            that.updatePerspective();
          }
        }
      }

      this.gl.onmousewheel = function(e) {
        that.cam_r -= e.delta;
        if(that.cam_r < 1.0) that.cam_r = 1.0;
        if(that.cam_r > 1000.0) that.cam_r = 1000.0;
        that.updatePerspective();
      }
    }
    else if (INPUT_MODE === "touch") {
      var touchRegion = ZingTouch.Region(this.gl.canvas)

      // One finger drag to rotate
      var rotateGesture = new ZingTouch.Pan({
        numInputs: 1
      })
      touchRegion.register('rotateGesture', rotateGesture)

      touchRegion.bind(this.gl.canvas, 'rotateGesture', (e) => {
        if (e.detail.data[0]) {
          const change = e.detail.data[0].change;
          if (Math.abs(change.x) > 100 || Math.abs(change.y) > 100) return;
          that.cam_theta -= change.x / 300;
          that.cam_phi -= change.y / 300;

          // avoid euler singularities
          // also don't let the user flip the entire cloud around
          if (that.cam_phi < 0) {
            that.cam_phi = 0.001;
          }
          if (that.cam_phi > Math.PI) {
            that.cam_phi = Math.PI - 0.001;
          }
          that.updatePerspective();
        }
      })

      // Two fingers to pan the view
      var panGesture = new ZingTouch.Pan({
        numInputs: 2
      })
      touchRegion.register('panGesture', panGesture)
      touchRegion.bind(this.gl.canvas, 'panGesture', (e) => {
        if (e.detail.data[0]) {
          that.cam_offset_x += e.detail.data[0].change.x / 30 * Math.sin(that.cam_theta);
          that.cam_offset_y -= e.detail.data[0].change.x / 30 * Math.cos(that.cam_theta);
          that.cam_offset_z += e.detail.data[0].change.y / 30;
          that.updatePerspective();
        }
      })

      // Pinch to zoom in or out
      touchRegion.bind(this.gl.canvas, 'distance', (e) => {
        that.cam_r -= e.detail.change / 5;
        if (that.cam_r < 1.0) that.cam_r = 1.0;
        if (that.cam_r > 1000.0) that.cam_r = 1000.0;
        that.updatePerspective();
      })
    } else {
      console.log("Input mode " + INPUT_MODE + " unknown, should be either mouse or touch");
    }

    this.updatePerspective = () => {
      that.cam_pos[0] = that.cam_offset_x + that.cam_r * Math.sin(that.cam_phi) * Math.cos(that.cam_theta);
      that.cam_pos[1] = that.cam_offset_y + that.cam_r * Math.sin(that.cam_phi) * Math.sin(that.cam_theta);
      that.cam_pos[2] = that.cam_offset_z + that.cam_r * Math.cos(that.cam_phi);

      that.view = mat4.create();
      mat4.perspective(that.proj, 45 * DEG2RAD, that.gl.canvas.width / that.gl.canvas.height, 0.1, 1000);
      mat4.lookAt(that.view, that.cam_pos, [this.cam_offset_x,this.cam_offset_y, this.cam_offset_z], [0,0,1]);
	  mat4.multiply(that.mvp, that.proj, that.view);
      if (that.invert) {
        var old_mvp = mat4.clone(that.mvp);
        var invert_mat4 = mat4.fromValues(
          -1.0,  0.0,  0.0,  0.0,
           0.0,  1.0,  0.0,  0.0,
           0.0,  0.0, -1.0,  0.0,
           0.0,  0.0,  0.0,  1.0
        );
        mat4.multiply(that.mvp, old_mvp, invert_mat4);
      }
    }

    this.updatePerspective();

    this.shader = new Shader('\
      precision highp float;\
      attribute vec3 a_vertex;\
      attribute vec4 a_color;\
      uniform mat4 u_mvp;\
      varying vec4 v_color;\
      void main() {\
          v_color = a_color;\
          gl_Position = u_mvp * vec4(a_vertex,1.0);\
          gl_PointSize = 1.5;\
      }\
      ', '\
      precision highp float;\
      uniform vec4 u_color;\
      varying vec4 v_color;\
      void main() {\
        gl_FragColor = u_color * v_color;\
      }\
    ');
    //generic gl flags and settings
    this.gl.clearColor(0.1,0.1,0.1,1);
    this.gl.disable( this.gl.DEPTH_TEST );

    this.resizeCanvasToDisplaySize = (canvas) => {
      // If the canvas size does not match the size of the <body>,
      // the canvas draw buffer size and display size will be updated to match it.
      const bodyWidth = document.body.clientWidth;
      const bodyHeight = document.body.clientHeight;

      // Check if the canvas is not the same size.
      const needResize = canvas.width  !== bodyWidth ||
                         canvas.height !== bodyHeight;
      
      if (needResize) {
        // Make the canvas the same size
        canvas.width  = bodyWidth;
        canvas.height = bodyHeight;
        that.updatePerspective()
      }
    }

    //rendering loop
    this.gl.ondraw = function() {
      that.gl.clear( that.gl.COLOR_BUFFER_BIT | that.gl.DEPTH_BUFFER_BIT );
      if(!that.drawObjectsGl) return;
      for(let i in that.drawObjectsGl) {
        if(that.drawObjectsGl[i].type === "points") {
          that.shader.uniforms({
            u_color: [1,1,1,1],
            u_mvp: that.mvp
          }).draw(that.drawObjectsGl[i].mesh, gl.POINTS);
        } else if(that.drawObjectsGl[i].type === "lines") {
          that.shader.uniforms({
            u_color: [1,1,1,1],
            u_mvp: that.mvp
          }).draw(that.drawObjectsGl[i].mesh, gl.LINES);
        }
      }
    };

    // initialize static mesh for grid

    this.gridPoints = [];
    this.gridColors = [];
    for(let x=-5.0;x<=5.0+0.001;x+=1.0) {
      this.gridPoints.push(x);
      this.gridPoints.push(-5);
      this.gridPoints.push(0);
      this.gridPoints.push(x);
      this.gridPoints.push(5);
      this.gridPoints.push(0);
      for(let i=0;i<8;i++) {
        this.gridColors.push(1);
      }
    }

    for(let y=-5.0;y<=5.0+0.001;y+=1.0) {
      this.gridPoints.push(-5);
      this.gridPoints.push(y);
      this.gridPoints.push(0);
      this.gridPoints.push(5);
      this.gridPoints.push(y);
      this.gridPoints.push(0);
      for(let i=0;i<8;i++) {
        this.gridColors.push(1);
      }
    }

    this.gridMesh = GL.Mesh.load({vertices: this.gridPoints, colors: this.gridColors}, null, null, this.gl);

    // initialize static mesh for axes

    this.axesPoints = [ 0,0,0, 1,0,0, 0,0,0, 0,1,0, 0,0,0, 0,0,1, ];
    this.axesColors = [ 1,0,0,1, 1,0,0,1, 0,1,0,1, 0,1,0,1, 0,0.5,1,1, 0,0.5,1,1, ];

    this.axesMesh = GL.Mesh.load({vertices: this.axesPoints, colors: this.axesColors});
  }

  _getColor(v, vmin, vmax) {
    // cube edge walk from from http://paulbourke.net/miscellaneous/colourspace/
    let c = [1.0, 1.0, 1.0];

    if (v < vmin)
       v = vmin;
    if (v > vmax)
       v = vmax;
    let dv = vmax - vmin;
    if(dv < 1e-2) dv = 1e-2;

    if (v < (vmin + 0.25 * dv)) {
      c[0] = 0;
      c[1] = 4 * (v - vmin) / dv;
    } else if (v < (vmin + 0.5 * dv)) {
      c[0] = 0;
      c[2] = 1 + 4 * (vmin + 0.25 * dv - v) / dv;
    } else if (v < (vmin + 0.75 * dv)) {
      c[0] = 4 * (v - vmin - 0.5 * dv) / dv;
      c[2] = 0;
    } else {
      c[1] = 1 + 4 * (vmin + 0.75 * dv - v) / dv;
      c[2] = 0;
    }

    return(c);
  }

  draw(drawObjects) {
    this.drawObjects = drawObjects;
    let drawObjectsGl = [];

    // draw grid
    
    drawObjectsGl.push({type: "lines", mesh: this.gridMesh});

    // draw axes

    drawObjectsGl.push({type: "lines", mesh: this.axesMesh});

    for(let i in drawObjects) {
      let drawObject = drawObjects[i];
      if(drawObject.type === "points") {
        let colors = new Float32Array(drawObject.data.length / 3 * 4);
        let zmin = drawObject.zmin || -2;
        let zmax = drawObject.zmax || 2;
        let zrange = zmax - zmin;
        for(let j=0; j < drawObject.data.length / 3; j++) {
          let c = this._getColor(drawObject.data[3*j+2], zmin, zmax)
          colors[4*j] = c[0];
          colors[4*j+1] = c[1];
          colors[4*j+2] = c[2];
          colors[4*j+3] = 1;
        }
        let points = drawObject.data;
        this.resizeCanvasToDisplaySize(this.gl.canvas);
        gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
        drawObjectsGl.push({type: "points", mesh: GL.Mesh.load({vertices: points, colors: colors}, null, null, this.gl)});
      }
    }
    this.drawObjectsGl = drawObjectsGl;
  }
}

Space3DViewer.supportedTypes = [
];

Space3DViewer.maxUpdateRate = 1.0;

Viewer.registerViewer(Space3DViewer);
