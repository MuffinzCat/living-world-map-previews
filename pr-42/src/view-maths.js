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
