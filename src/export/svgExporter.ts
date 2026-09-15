/**
 * Exports the map SVG element as a standalone vector .svg file
 */
export function exportMapAsSVG(svgElementId: string = 'travel-map-svg', filename: string = 'travel-map.svg') {
  const originalSvg = document.getElementById(svgElementId) as SVGSVGElement | null;
  if (!originalSvg) {
    alert('未找到地图画布 SVG');
    return;
  }

  // Clone SVG node
  const clonedSvg = originalSvg.cloneNode(true) as SVGSVGElement;

  // Add standard XML attributes
  clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clonedSvg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

  // Serialize to string
  const serializer = new XMLSerializer();
  let svgString = serializer.serializeToString(clonedSvg);

  // Prepend XML declaration
  if (!svgString.startsWith('<?xml')) {
    svgString = '<?xml version="1.0" standalone="no"?>\r\n' + svgString;
  }

  // Create blob and download
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}