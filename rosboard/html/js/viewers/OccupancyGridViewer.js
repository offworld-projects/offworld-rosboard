"use strict";

class OccupancyGridViewer extends Viewer {
    /**
    * Gets called when Viewer is first initialized.
    * @override
    **/
    onCreate() {
        super.onCreate();
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera( 75, document.body.clientWidth / document.body.clientHeight, 0.1, 1000 );
        this.renderer = new THREE.WebGLRenderer();
        this.renderer.setSize(document.body.clientWidth, document.body.clientHeight);
        this.camera.position.z = 5;
        this.currentMesh = null;
        
        const geometry = new THREE.BoxGeometry( 1, 1, 1 );
        const material = new THREE.MeshBasicMaterial( { color: 0x00ff00 } );
        const cube = new THREE.Mesh( geometry, material ); 
        this.scene.add( cube );
        this.camera.position.z = 5;

        const animate = () => { 
            requestAnimationFrame( animate );
            // If the canvas size does not match the size of the <body>,
            // the canvas draw buffer size and display size will be updated to match it.
            const bodyWidth = document.body.clientWidth;
            const bodyHeight = document.body.clientHeight;

            cube.rotation.x += 0.01;
            cube.rotation.y += 0.01;
        
            this.renderer.setSize(bodyWidth, bodyHeight);
            this.camera.aspect = bodyWidth / bodyHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.render(this.scene, this.camera);
        }

        $(this.renderer.domElement).appendTo(this.card.content);
        animate();
    }


    onData(msg) {
        var texture = new THREE.TextureLoader().load("data:image/jpeg;base64," + msg._data_jpeg);
        var material = new THREE.MeshBasicMaterial({ map: texture });
        var geometry = new THREE.PlaneGeometry(20, 20);
        var mesh = new THREE.Mesh(geometry, material);
        
        if(this.currentMesh != null) {
            this.scene.remove(this.currentMesh);
        }
        this.currentMesh = mesh;
        this.scene.remove()
        this.scene.add(this.currentMesh);
        this.renderer.render(this.scene, this.camera);
    }
}

OccupancyGridViewer.friendlyName = "OccupancyGrid";

OccupancyGridViewer.supportedTypes = [
    "nav_msgs/msg/OccupancyGrid",
];

OccupancyGridViewer.maxUpdateRate = 1.0;

Viewer.registerViewer(OccupancyGridViewer);
