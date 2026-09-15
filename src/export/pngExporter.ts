export interface ExportPngOptions {
  scale?: number;
  customWidth?: number;
  transparentRouteOnly?: boolean;
  filename?: string;
}

/**
 * Exports the map as a high-resolution PNG image
 */
export async function exportMapAsPNG(
  svgElementId: string = 'travel-map-svg',
  options: ExportPngOptions = {}
): Promise<void> {
  const originalSvg = document.getElementById(svgElementId) as SVGSVGElement | null;
  if (!originalSvg) {
    alert('未找到地图画布 SVG');
    return;
  }

  const {
    scale = 2,
    customWidth,
    transparentRouteOnly = false,
    filename = 'travel-map.png'
  } = options;

  // Clone SVG
  const clonedSvg = originalSvg.cloneNode(true) as SVGSVGElement;
  clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clonedSvg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

  // Handle transparent route only mode
  if (transparentRouteOnly) {
    const ocean = clonedSvg.querySelector('#ocean-background');
    if (ocean) ocean.remove();
    const countries = clonedSvg.querySelector('#countries-layer');
    if (countries) countries.remove();
  }

  const baseWidth = originalSvg.viewBox.baseVal.width || originalSvg.clientWidth || 1200;
  const baseHeight = originalSvg.viewBox.baseVal.height || originalSvg.clientHeight || 800;

  // Determine output resolution
  let targetWidth = baseWidth * scale;
  let targetHeight = baseHeight * scale;

  if (customWidth && customWidth > 100) {
    const ratio = baseHeight / baseWidth;
    targetWidth = customWidth;
    targetHeight = Math.round(customWidth * ratio);
  }

  clonedSvg.setAttribute('width', String(targetWidth));
  clonedSvg.setAttribute('height', String(targetHeight));

  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(clonedSvg);
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const img = new Image();

  return new Promise((resolve, reject) => {
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(url);
          reject(new Error('Canvas 2D context not available'));
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Draw image
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
        URL.revokeObjectURL(url);

        canvas.toBlob(pngBlob => {
          if (!pngBlob) {
            reject(new Error('Failed to generate PNG blob'));
            return;
          }
          const downloadUrl = URL.createObjectURL(pngBlob);
          const a = document.createElement('a');
          a.href = downloadUrl;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(downloadUrl);
          resolve();
        }, 'image/png');
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };

    img.onerror = err => {
      URL.revokeObjectURL(url);
      reject(err);
    };

    img.src = url;
  });
}