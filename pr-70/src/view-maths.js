export function panView(startView, startClient, currentClient, viewportSize) {
  const scaleX = startView.width / viewportSize.width;
  const scaleY = startView.height / viewportSize.height;
  return {
    ...startView,
    x: startView.x - (currentClient.x - startClient.x) * scaleX,
    y: startView.y - (currentClient.y - startClient.y) * scaleY
  };
}

export function zoomView(view, factor, anchor) {
  const width = view.width * factor;
  const height = view.height * factor;
  return {
    x: anchor.x - (anchor.x - view.x) * factor,
    y: anchor.y - (anchor.y - view.y) * factor,
    width,
    height
  };
}

export function fitAuthoredMap(bounds, viewportSize, padding = 80) {
  const safePadding = Number.isFinite(padding) && padding >= 0 ? padding : 80;
  if (!bounds) return { x: -600, y: -400, width: 1200, height: 800 };

  const width = Math.max(1, bounds.right - bounds.left);
  const height = Math.max(1, bounds.bottom - bounds.top);
  if (!Number.isFinite(viewportSize?.width) || !Number.isFinite(viewportSize?.height) ||
      viewportSize.width <= 0 || viewportSize.height <= 0) {
    return {
      x: bounds.left - width / 2 - safePadding,
      y: bounds.top - height / 2 - safePadding,
      width: width + safePadding * 2,
      height: height + safePadding * 2
    };
  }

  const paddedWidth = width + safePadding * 2;
  const paddedHeight = height + safePadding * 2;
  const scale = Math.min(viewportSize.width / paddedWidth, viewportSize.height / paddedHeight);
  const fitWidth = viewportSize.width / scale;
  const fitHeight = viewportSize.height / scale;
  const centerX = (bounds.left + bounds.right) / 2;
  const centerY = (bounds.top + bounds.bottom) / 2;
  return {
    x: centerX - fitWidth / 2,
    y: centerY - fitHeight / 2,
    width: fitWidth,
    height: fitHeight
  };
}
