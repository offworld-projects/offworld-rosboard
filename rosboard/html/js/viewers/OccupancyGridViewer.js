class OccupancyGridViewer extends Viewer {
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
        this.camera = new THREE.PerspectiveCamera(75, document.body.clientWidth / document.body.clientHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer();
        this.renderer.setSize(document.body.clientWidth, document.body.clientHeight);
        this.camera.position.set(0, 100, 0);
        this.camera.lookAt(0, 0, 0);
        this.raycaster = new THREE.Raycaster();
        this.pointer = new THREE.Vector2();

        // Set up the arcball controls
        this.controls = new THREE.ArcballControls(this.camera, this.renderer.domElement, this.scene, false);
        this.controls.setGizmosVisible(false);
        this.mouseDownX, this.mouseDownY;

        // Set up the bot position indicator icon
        this.gridMesh = null;
        this.mapFrame;
        this.botPositionX, this.botPositionY, this.botHeading;
        const botIconTexture = new THREE.TextureLoader().load("icons/surveyor_position_indicator.png");
        botIconTexture.magFilter = THREE.NearestFilter;
        botIconTexture.minFilter = THREE.NearestFilter;
        this.botPositionIcon = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), new THREE.MeshBasicMaterial({ map: botIconTexture, transparent: true }));
        this.botPositionIcon.position.set(0, 0, 0);
        this.botPositionIcon.rotation.x = -Math.PI / 2;
        this.botPositionIcon.visible = false;

        this.scene.add(this.botPositionIcon);
        
        const axisHelper = new THREE.AxesHelper(5);
        this.scene.add(axisHelper);

        // Invisible plane to intersect with the raycaster
        const planeY = 0;

        const onMouseDown = (event) => {
            // Later used to determine if the mouse has moved since the mouse down event
            this.mouseDownX = event.clientX;
            this.mouseDownY = event.clientY;
        }


        const onMouseUp = (event) => {
            // Make sure that the mouse has not moved since the mouse down event
            // If it did, the user is probably just dragging the screen around to pan the map, so we won't send an event
            if (this.mouseDownX == event.clientX && this.mouseDownY == event.clientY) {
                // Calculate normalized device coordinates (NDC) from mouse coordinates
                this.pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
                this.pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;

                // Update the raycaster's origin and direction based on the camera and mouse
                this.raycaster.setFromCamera(this.pointer, this.camera);

                // Intersect the ray with the imaginary plane at the desired Z-coordinate
                var intersectionPoint = new THREE.Vector3();
                this.raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), planeY), intersectionPoint);

                // Convert threejs coordinates to map frame coordinates
                const mapFramePoint = { x: intersectionPoint.x * this.map_resolution, y: -intersectionPoint.z * this.map_resolution };

                // Send event to parent DOM object
                if (mapFramePoint != null && this.mapFrame != null) {
                    if (confirm("Move to (" + mapFramePoint.x + ", " + mapFramePoint.y + ") in frame " + this.mapFrame + "?")) {
                        currentTransport.sendOpRequest({ op: "NAV.MOVE_TO", args: { x: mapFramePoint.x, y: mapFramePoint.y, frame: this.mapFrame } });
                    }
                }
            }
        }

        const animate = () => {
            requestAnimationFrame(animate);
            // If the canvas size does not match the size of the <body>,
            // the canvas draw buffer size and display size will be updated to match it.
            const bodyWidth = document.body.clientWidth;
            const bodyHeight = document.body.clientHeight;
            this.renderer.setSize(bodyWidth, bodyHeight);
            this.camera.aspect = bodyWidth / bodyHeight;
            this.camera.updateProjectionMatrix();

            // Add surveyor position icon
            if (this.botPositionX != null && this.botPositionY != null) {
                this.botPositionIcon.position.set(this.botPositionX / this.map_resolution, 0.1, this.botPositionY / this.map_resolution);
                this.botPositionIcon.rotation.z = this.botHeading;
            }

            // Lock rotation to a circle around the scene Y-axis
            this.controls.camera.rotation.x = -Math.PI / 2;
            this.controls.camera.rotation.y = 0;

            // Update threejs scene
            this.controls.update();
            this.renderer.render(this.scene, this.camera);
        }

        document.addEventListener('mousedown', onMouseDown);
        document.addEventListener('mouseup', onMouseUp);
        $(this.renderer.domElement).appendTo(this.card.content);
        animate();
    }


    onData(msg) {
        // When a new texture arrives, we'll clean up the old geometry and texture
        if (this.gridMesh != null && this.gridMesh.geometry != null) { this.gridMesh.geometry.dispose(); }
        if (this.gridMesh != null && this.gridMesh.material != null) { this.gridMesh.material.dispose(); }

        // Create a PlaneGeometry with the occupancy map image as its texture
        const base64ImageData = msg._data_jpeg;
        let texture = new THREE.TextureLoader().load("data:image/jpeg;base64," + base64ImageData);
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        let material = new THREE.MeshBasicMaterial({ map: texture });
        let geometry = new THREE.PlaneGeometry(msg.info.width, msg.info.height);

        // If not already present, add the mesh to the scene
        if (this.gridMesh == null) {
            this.gridMesh = new THREE.Mesh(geometry, material);
            this.gridMesh.rotation.x = -Math.PI / 2;
            this.scene.add(this.gridMesh);
        }

        // Update the plane geometry and material to match the new texture
        this.gridMesh.geometry = geometry;
        this.gridMesh.material = material;
        this.gridMesh.updateMatrix();
        this.gridMesh.needsUpdate = true;
        this.map_resolution = msg.info.resolution;
        this.mapFrame = msg.header.frame_id;

        // If TF was in the message, we'll save it to display the bot position icon
        if (msg._transform != null) {
            this.botPositionX = msg._transform.position.x
            this.botPositionY = msg._transform.position.y
            const quaternion = messageToQuaternion(msg);
            const euler = quaternionToEuler(quaternion);
            this.botHeading = (euler.z + 180) % 360;
            this.botPositionIcon.visible = true;

            // Since we currently only have a local costmap, we'll move the map texture to center underneath the bot's current position
            if (this.gridMesh != null) {
                this.gridMesh.position.x = this.botPositionX / this.map_resolution;
                this.gridMesh.position.z = this.botPositionY / this.map_resolution;
            }
        } else {
            // Bot position unknown, the icon should be removed from display!
            this.botPositionX = null;
            this.botPositionY = null;
            this.botPositionIcon.visible = false;
        }
    }
}

function messageToQuaternion(message) {
    rotation = message._transform.rotation
    return new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w);
}

function quaternionToEuler(quaternion) {
    return new THREE.Euler().setFromQuaternion(quaternion);
}

OccupancyGridViewer.friendlyName = "OccupancyGrid";

OccupancyGridViewer.supportedTypes = [
    "nav_msgs/msg/OccupancyGrid",
];

OccupancyGridViewer.maxUpdateRate = 1.0;

Viewer.registerViewer(OccupancyGridViewer);
