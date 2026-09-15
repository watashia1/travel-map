/**
 * Exports the map SVG element as a standalone vector .svg file
 * Automatically converts image hrefs to embedded Data URLs if needed
 */
export async function exportMapAsSVG(
  svgElementId: string = 'travel-map-svg',
  filename: string = 'travel-map.svg',
  transparentOverlayOnly: boolean = false
) {
  const originalSvg = document.getElementById(svgElementId) as SVGSVGElement | null;
  if (!originalSvg) {
    alert('未找到地图画布 SVG');
    return;
  }

  // Clone SVG node
  const clonedSvg = originalSvg.cloneNode(true) as SVGSVGElement;

  clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clonedSvg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

  if (transparentOverlayOnly) {
    clonedSvg.querySelector('#ocean-background')?.remove();
    clonedSvg.querySelector('#basemap-layer')?.remove();
  } else {
    // If there is an <image> element in basemap-layer with an object URL, convert to base64 data url
    const imgEl = clonedSvg.querySelector('#basemap-layer image') as SVGImageElement | null;
    if (imgEl) {
      const href = imgEl.getAttribute('href') || imgEl.getAttribute('xlink:href');
      if (href && href.startsWith('blob:')) {
        try {
          const res = await fetch(href);
          const blob = await res.blob();
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          imgEl.setAttribute('href', dataUrl);
        } catch (e) {
          console.warn('Could not convert blob URL to data URL for SVG export', e);
        }
      }
    }
  }

  // Serialize to string
  const serializer = new XMLSerializer();
  let svgString = serializer.serializeToString(clonedSvg);

  if (!svgString.startsWith('<?xml')) {
    svgString = '<?xml version="1.0" standalone="no"?>\r\n' + svgString;
  }

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