class WaypointPointCloudViewer extends Viewer {
  /**
   * Gets called when Viewer is first initialized.
   * @override
   **/
  onCreate() {
    super.onCreate();
    // Set up the threejs scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#000000");

    // Set up the camera and renderer
    // this.camera = new THREE.PerspectiveCamera(
    //   75,
    //   document.body.clientWidth / document.body.clientHeight,
    //   0.1,
    //   1000
    // );
    const aspect = document.body.clientWidth / document.body.clientHeight;
    const frustumSize = 200;
    var left = (-frustumSize * aspect) / 2;
    var right = (frustumSize * aspect) / 2;
    var top = frustumSize / 2;
    var down = -frustumSize / 2;
    this.camera = new THREE.OrthographicCamera(
      left, right,top, down, 1, 1000
    )
    this.renderer = new THREE.WebGLRenderer();
    this.renderer.setSize(
      document.body.clientWidth,
      document.body.clientHeight
    );
    this.camera.position.set(0, 200, 0);
    this.camera.lookAt(0, 0, 0);
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();

    // Set up the arcball controls
    this.controls = new THREE.ArcballControls(
      this.camera,
      this.renderer.domElement,
      this.scene,
      false
    );
    this.controls.setGizmosVisible(false);
    this.mouseDownX, this.mouseDownY;

    // Set up points buffer
    this.pointsBuffer = new THREE.BufferGeometry();
    this.pointsMesh = new THREE.Points(
      this.pointsBuffer,
      new THREE.PointsMaterial({ vertexColors: true, size: 0.1 })
    );
    this.scene.add(this.pointsMesh);

    this.mapFrame = "map";

    const surveyorTexture = new THREE.TextureLoader().load(
      "icons/surveyor_1_icon.png"
    );
    const diggerTexture = new THREE.TextureLoader().load(
      "icons/surveyor_2_icon.png"
    );
    const surveyorWaypointTexture = new THREE.TextureLoader().load(
      "icons/surveyor_waypoint.png"
    );
    const diggerWaypointTexture = new THREE.TextureLoader().load(
      "icons/digger_waypoint.png"
    );

    this.bots = {
      surveyor: {
        position: {
          x: null,
          y: null,
          heading: null,
        },
        icon: new THREE.Mesh(
          new THREE.PlaneGeometry(2, 2),
          new THREE.MeshBasicMaterial({
            map: surveyorTexture,
            transparent: true,
          })
        ),
        waypoint: new THREE.Mesh(
          new THREE.PlaneGeometry(2, 2),
          new THREE.MeshBasicMaterial({
            map: surveyorWaypointTexture,
            transparent: true,
          })
        ),
      },
      digger: {
        position: {
          x: null,
          y: null,
          heading: null,
        },
        icon: new THREE.Mesh(
          new THREE.PlaneGeometry(2, 2),
          new THREE.MeshBasicMaterial({ map: diggerTexture, transparent: true })
        ),
        waypoint: new THREE.Mesh(
          new THREE.PlaneGeometry(2, 2),
          new THREE.MeshBasicMaterial({
            map: diggerWaypointTexture,
            transparent: true,
          })
        ),
      },
    };

    this.bots.surveyor.icon.position.set(0, 0, 0);
    this.bots.surveyor.icon.rotation.x = -Math.PI / 2;
    this.bots.surveyor.icon.visible = false;
    this.scene.add(this.bots.surveyor.icon);

    this.bots.digger.icon.position.set(0, 0, 0);
    this.bots.digger.icon.rotation.x = -Math.PI / 2;
    this.bots.digger.icon.visible = false;
    this.scene.add(this.bots.digger.icon);

    // Active waypoint icons
    this.bots.surveyor.waypoint.rotation.x = -Math.PI / 2;
    this.bots.surveyor.waypoint.visible = false;
    this.scene.add(this.bots.surveyor.waypoint);
    this.bots.digger.waypoint.rotation.x = -Math.PI / 2;
    this.bots.digger.waypoint.visible = false;
    this.scene.add(this.bots.digger.waypoint);

    // Invisible plane to intersect with the raycaster
    const planeY = 0;

    const onMouseDown = (event) => {
      // Later used to determine if the mouse has moved since the mouse down event
      this.mouseDownX = event.clientX;
      this.mouseDownY = event.clientY;
    };

    const onMouseUp = (event) => {
      // Make sure that the mouse has not moved since the mouse down event
      // If it did, the user is probably just dragging the screen around to pan the map, so we won't send an event
      if (
        this.mouseDownX == event.clientX &&
        this.mouseDownY == event.clientY
      ) {
        // Calculate normalized device coordinates (NDC) from mouse coordinates
        this.pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;

        // Update the raycaster's origin and direction based on the camera and mouse
        this.raycaster.setFromCamera(this.pointer, this.camera);

        // Intersect the ray with the imaginary plane at the desired Z-coordinate
        var intersectionPoint = new THREE.Vector3();
        this.raycaster.ray.intersectPlane(
          new THREE.Plane(new THREE.Vector3(0, 1, 0), planeY),
          intersectionPoint
        );

        // Convert threejs coordinates to map frame coordinates
        const mapFramePoint = {
          x: intersectionPoint.x,
          y: -intersectionPoint.z,
        };

        // Run NAV op
        if (mapFramePoint != null) {
          if (
            confirm(
              "Move to (" +
                mapFramePoint.x +
                ", " +
                mapFramePoint.y +
                ") in frame " +
                this.mapFrame +
                "?"
            )
          ) {
            this.bots[this.activeBot].waypoint.position.set(
              mapFramePoint.x,
              -0.1,
              -mapFramePoint.y
            );
            this.bots[this.activeBot].waypoint.visible = true;
            const yaw = this.getBotToGoalAngle(this.activeBot);
            currentTransport.sendOpRequest({
              op: "NAV.MOVE_TO",
              args: {
                x: mapFramePoint.x,
                y: mapFramePoint.y,
                yaw_rad: yaw,
                frame: this.mapFrame,
              },
            });
          }
        }
      }
    };

    const animate = () => {
      requestAnimationFrame(animate);
      // If the canvas size does not match the size of the <body>,
      // the canvas draw buffer size and display size will be updated to match it.
      const bodyWidth = document.body.clientWidth;
      const bodyHeight = document.body.clientHeight;
      this.renderer.setSize(bodyWidth, bodyHeight);
      this.camera.aspect = bodyWidth / bodyHeight;
      this.camera.updateProjectionMatrix();

      // Lock rotation to a circle around the scene Y-axis
      this.controls.camera.rotation.x = -Math.PI / 2;
      this.controls.camera.rotation.y = 0;

      // Update threejs scene
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };

    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("mouseup", onMouseUp);
    $(this.renderer.domElement).appendTo(this.card.content);
    animate();

    if (sessionStorage.getItem("lastPclMsg")) {
      this.onData(JSON.parse(sessionStorage.getItem("lastPclMsg")));
    }
  }

  updateBotPosition(botName, tfMsg, waypointMsg) {
    if (tfMsg != null) {
      this.bots[botName].position.x = tfMsg.transform.translation.x;
      this.bots[botName].position.y = tfMsg.transform.translation.y;
      const quaternion = rotationToQuaternion(tfMsg.transform.rotation);
      const euler = quaternionToEuler(quaternion);
      this.bots[botName].heading =
        (euler.z + (3 * Math.PI) / 2) % (2 * Math.PI);

      // Update the bot position icon
      const y = this.activeBot === botName ? 0.01 : 0;
      this.bots[botName].icon.position.set(
        this.bots[botName].position.x,
        y,
        -this.bots[botName].position.y
      );
      this.bots[botName].icon.rotation.z = this.bots[botName].heading;
      this.bots[botName].icon.visible = true;
    } else {
      // Bot position unknown, the icon should be removed from display!
      this.bots[botName].position.x = null;
      this.bots[botName].position.y = null;
      this.bots[botName].icon.visible = false;
    }

    // Update the bot waypoint icon
    if (waypointMsg.x && waypointMsg.y) {
      const y = this.activeBot === botName ? -0.1 : -0.11;
      this.bots[botName].waypoint.position.set(
        waypointMsg.x,
        y,
        -waypointMsg.y
      );
      this.bots[botName].waypoint.visible = true;
    }
  }

  onData(msg) {
    if (msg._topic_name === "/tf") {
      this.activeBot = msg.active_bot === "GEOSURVEY" ? "surveyor" : "digger";
      this.updateBotPosition("surveyor", msg.surveyor, msg.surveyor_waypoint);
      this.updateBotPosition("digger", msg.digger, msg.digger_waypoint);
    } else if (msg.__comp) {
      sessionStorage.setItem("lastPclMsg", JSON.stringify(msg));
      this.decodeAndRenderCompressed(msg);
    } else {
      console.warn("Uncompressed pointclouds are not supported");
    }
  }

  _base64decode(base64) {
    var binary_string = window.atob(base64);
    var len = binary_string.length;
    var bytes = new Uint8Array(len);
    for (var i = 0; i < len; i++) {
      bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes.buffer;
  }

  // TOOD: - Support rendering of uncompressed pointclouds
  decodeAndRenderCompressed(msg) {
    // decodes a uint16 lossy-compressed point cloud
    // basic explanation of algorithm:
    // - keep only x,y,z fields and throw away the rest
    // - throw away rows containing nans
    // - compress each number into a uint16 from 0 to 65535
    //   where 0 is the minimum value over the whole set and 65535 is the max value over the set
    //   so for example if the x values range from -95 m to 85 m, we encode x into a uint16 where
    //   0 represents -95 and 65535 represents 85
    // - provide the actual bounds (i.e. [-95, 85]) in a separate bounds field so it can be
    //   scaled back correctly by the decompressor (this function)

    let bounds = msg._data_uint16.bounds;
    let points_bytes = this._base64decode(msg._data_uint16.points);
    let points_view = new DataView(points_bytes);
    let points = new Float32Array(Math.round(points_bytes.byteLength / 2));

    let xrange = bounds[1] - bounds[0];
    let xmin = bounds[0];
    let yrange = bounds[3] - bounds[2];
    let ymin = bounds[2];
    let zrange = bounds[5] - bounds[4];
    let zmin = bounds[4];

    for (let i = 0; i < points_bytes.byteLength / 6; i++) {
      let offset = i * 6;
      points[3 * i] =
        (points_view.getUint16(offset, true) / 65535) * xrange + xmin;
      points[3 * i + 1] =
        (points_view.getUint16(offset + 2, true) / 65535) * yrange + ymin;
      points[3 * i + 2] =
        (points_view.getUint16(offset + 4, true) / 65535) * zrange + zmin;
    }

    // Add color to the points based on elevation
    const colors = [];
    for (let i = 0; i < points.length; i += 3) {
      const y = points[i + 2];
      const hue = ((y - 0) * (1 - 0)) / (0 + 3) + 0;
      let color = new THREE.Color();
      color.setHSL(hue, 1.0, 0.5);
      colors.push(color.r, color.g, color.b);
    }

    this.pointsBuffer.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(colors, 3)
    );
    this.pointsBuffer.setAttribute(
      "position",
      new THREE.BufferAttribute(points, 3)
    );
    this.pointsBuffer.rotateX(-Math.PI / 2);
  }

  getBotToGoalAngle(botName) {
    if (
      this.bots[botName].position.x == null ||
      this.bots[botName].waypoint.position.x == null
    ) {
      return null;
    }

    const dx =
      this.bots[botName].waypoint.position.x - this.bots[botName].position.x;
    const dy =
      this.bots[botName].waypoint.position.z + this.bots[botName].position.y;
    return -Math.atan2(dy, dx);
  }
}

function rotationToQuaternion(rotation) {
  return new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w);
}

function quaternionToEuler(quaternion) {
  return new THREE.Euler().setFromQuaternion(quaternion);
}

WaypointPointCloudViewer.friendlyName = "WaypointPointCloud";

WaypointPointCloudViewer.supportedTypes = ["sensor_msgs/msg/PointCloud2"];

WaypointPointCloudViewer.maxUpdateRate = 1.0;

Viewer.registerViewer(WaypointPointCloudViewer);
