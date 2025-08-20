(function (root) {
  root.MSG = {
    SNAPSHOT_REQUEST: "snapshot:request",
    SNAPSHOT_OK:      "snapshot:ok",
    SNAPSHOT_ERROR:   "snapshot:error",
    FRAME_ANALYZED:   "frame:analyzed",
    WORKER_READY:     "worker:ready",
    DRAW_OVERLAYS:    "draw:overlays",
    REGISTER_CANVAS:  "canvas:register",
    RESIZE_CANVAS:    "canvas:resize",
  };
})(typeof self !== "undefined" ? self : window);
