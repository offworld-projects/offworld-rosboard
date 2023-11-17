"use strict";

// import * as THREE from '../three';

class OccupancyGridViewer extends Viewer {
    /**
    * Gets called when Viewer is first initialized.
    * @override
    **/
    onCreate() {
        console.log("Created occupancy viewer")

        super.onCreate();
    }

    onData(msg) {
        console.log(msg);
    }
}

OccupancyGridViewer.friendlyName = "OccupancyGrid";

OccupancyGridViewer.supportedTypes = [
    "nav_msgs/msg/OccupancyGrid",
];

OccupancyGridViewer.maxUpdateRate = 1.0;

Viewer.registerViewer(OccupancyGridViewer);
