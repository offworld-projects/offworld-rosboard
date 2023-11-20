"use strict";


class OccupancyGridViewer extends Viewer {
    /**
    * Gets called when Viewer is first initialized.
    * @override
    **/
    onCreate() {
        super.onCreate();
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color("#181818");
        this.camera = new THREE.PerspectiveCamera(75, document.body.clientWidth / document.body.clientHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer();
        this.renderer.setSize(document.body.clientWidth, document.body.clientHeight);
        this.camera.position.set(0, 0, 100);
        this.camera.lookAt(0, 0, 0);
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
        this.controls.mouseButtons.MIDDLE = THREE.MOUSE.DOLLY;
        this.controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;

        this.controls.touches.ONE = THREE.TOUCH.PAN;
        this.controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;

        const animate = () => {
            requestAnimationFrame(animate);
            // If the canvas size does not match the size of the <body>,
            // the canvas draw buffer size and display size will be updated to match it.
            const bodyWidth = document.body.clientWidth;
            const bodyHeight = document.body.clientHeight;

            this.renderer.setSize(bodyWidth, bodyHeight);
            this.camera.aspect = bodyWidth / bodyHeight;
            this.camera.updateProjectionMatrix();
            this.controls.update();
            this.renderer.render(this.scene, this.camera);
        }

        $(this.renderer.domElement).appendTo(this.card.content);
        animate();
    }


    onData(msg) {
        const base64ImageData = msg._data_jpeg;
        let texture = new THREE.TextureLoader().load("data:image/jpeg;base64," + base64ImageData);
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter; 
        let material = new THREE.MeshBasicMaterial({ map: texture });
        let geometry = new THREE.PlaneGeometry(msg.info.width, msg.info.height);
        let mesh = new THREE.Mesh(geometry, material);
        this.scene.add(mesh);
        this.renderer.render(this.scene, this.camera);
    }
}

OccupancyGridViewer.friendlyName = "OccupancyGrid";

OccupancyGridViewer.supportedTypes = [
    "nav_msgs/msg/OccupancyGrid",
];

OccupancyGridViewer.maxUpdateRate = 1.0;

Viewer.registerViewer(OccupancyGridViewer);
