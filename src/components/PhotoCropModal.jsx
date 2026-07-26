import React, { useEffect, useRef, useState } from "react";
import { Icon } from "./Common.jsx";

const STAGE_SIZE = 280;
const OUTPUT_SIZE = 480;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

// Keeps the image covering the circular stage at the current zoom, so dragging can never pull it
// away and expose empty background behind the crop circle.
function clampOffset(offset, scale, imgSize) {
  const maxX = Math.max(0, (imgSize.width * scale - STAGE_SIZE) / 2);
  const maxY = Math.max(0, (imgSize.height * scale - STAGE_SIZE) / 2);
  return {
    x: Math.min(maxX, Math.max(-maxX, offset.x)),
    y: Math.min(maxY, Math.max(-maxY, offset.y)),
  };
}

// Lets the user pan and zoom a just-picked image before it becomes their profile picture, then
// bakes that framing into a fixed-size circular JPEG. `file` is the raw picked File; onSave
// receives the cropped result as a File (so callers can treat it exactly like the original pick).
export default function PhotoCropModal({ file, onCancel, onSave }) {
  const [imgUrl, setImgUrl] = useState("");
  const [imgSize, setImgSize] = useState(null);
  const [baseScale, setBaseScale] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const dragRef = useRef(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImgUrl(url);
    const img = new Image();
    img.onload = () => {
      const cover = Math.max(STAGE_SIZE / img.naturalWidth, STAGE_SIZE / img.naturalHeight);
      setImgSize({ width: img.naturalWidth, height: img.naturalHeight });
      setBaseScale(cover);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const scale = baseScale * zoom;

  function handlePointerDown(e) {
    if (!imgSize) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, originX: offset.x, originY: offset.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e) {
    if (!dragRef.current || !imgSize) return;
    const next = {
      x: dragRef.current.originX + (e.clientX - dragRef.current.startX),
      y: dragRef.current.originY + (e.clientY - dragRef.current.startY),
    };
    setOffset(clampOffset(next, scale, imgSize));
  }

  function handlePointerUp() {
    dragRef.current = null;
  }

  function handleZoomChange(e) {
    const nextZoom = Number(e.target.value);
    setZoom(nextZoom);
    if (imgSize) setOffset((prev) => clampOffset(prev, baseScale * nextZoom, imgSize));
  }

  async function handleSave() {
    if (!imgSize) return;
    setError("");
    setSaving(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      const ctx = canvas.getContext("2d");
      const ratio = OUTPUT_SIZE / STAGE_SIZE;

      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = imgUrl;
      });

      ctx.save();
      ctx.beginPath();
      ctx.arc(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.translate(OUTPUT_SIZE / 2 + offset.x * ratio, OUTPUT_SIZE / 2 + offset.y * ratio);
      ctx.scale(scale * ratio, scale * ratio);
      ctx.drawImage(img, -imgSize.width / 2, -imgSize.height / 2);
      ctx.restore();

      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
      const cropped = new File([blob], "avatar.jpg", { type: "image/jpeg" });
      await onSave(cropped);
    } catch {
      setError("Couldn't process that photo. Try again.");
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-card fade-up" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title serif">Adjust your photo</div>
          <button className="icon-btn" onClick={onCancel} aria-label="Close" disabled={saving}>
            <Icon name="close" />
          </button>
        </div>
        <div className="modal-body">
          {error && <div className="auth-error" style={{ marginBottom: 12 }}>{error}</div>}
          <div
            className="crop-stage"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            {imgUrl && imgSize && (
              <img
                src={imgUrl}
                alt=""
                draggable={false}
                className="crop-stage-img"
                style={{
                  width: imgSize.width,
                  height: imgSize.height,
                  transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                }}
              />
            )}
            <div className="crop-stage-mask" />
          </div>
          <div className="crop-zoom-row">
            <Icon name="remove" />
            <input
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={0.01}
              value={zoom}
              onChange={handleZoomChange}
              disabled={!imgSize || saving}
            />
            <Icon name="add" />
          </div>
          <p className="profile-hint">Drag to reposition, use the slider to zoom.</p>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
            <button type="button" className="link-btn" onClick={onCancel} disabled={saving}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving || !imgSize}>
              {saving ? "Saving…" : "Save photo"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
