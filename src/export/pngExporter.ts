export interface ExportPngOptions {
  scale?: number;
  customWidth?: number;
  transparentRouteOnly?: boolean;
  filename?: string;
}

/**
 * Exports the map as a high-resolution PNG image.
 * Supports compositing MapLibre WebGL canvas with SVG Travel Overlay.
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
    filename = 'travel-map.png',
  } = options;

  const mapLibreCanvas = document.querySelector(
    '#maplibre-canvas-container canvas'
  ) as HTMLCanvasElement | null;

  const clonedSvg = originalSvg.cloneNode(true) as SVGSVGElement;
  clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clonedSvg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

  if (transparentRouteOnly) {
    clonedSvg.querySelector('#ocean-background')?.remove();
    clonedSvg.querySelector('#polar-countries')?.remove();
  } else {
    // Inlining blob URLs if any image exists (ImageMap mode)
    const imgEls = clonedSvg.querySelectorAll('image');
    for (const imgEl of Array.from(imgEls)) {
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
          console.warn('Could not convert blob URL to data URL for PNG export', e);
        }
      }
    }
  }

  const baseWidth = originalSvg.viewBox.baseVal.width || originalSvg.clientWidth || 1200;
  const baseHeight = originalSvg.viewBox.baseVal.height || originalSvg.clientHeight || 800;

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

        // 1. If MapLibre WebGL canvas exists and not transparent overlay, composite basemap canvas first
        if (mapLibreCanvas && !transparentRouteOnly) {
          try {
            ctx.drawImage(mapLibreCanvas, 0, 0, targetWidth, targetHeight);
          } catch (e) {
            console.warn('Could not draw MapLibre canvas to export context', e);
          }
        }

        // 2. Draw SVG Travel Overlay (Route, Marker, Label)
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
        URL.revokeObjectURL(url);

        // 3. Attribution overlay for MapLibre
        if (mapLibreCanvas && !transparentRouteOnly) {
          ctx.font = '11px sans-serif';
          ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
          ctx.textAlign = 'right';
          ctx.fillText('© OpenStreetMap contributors | OpenFreeMap', targetWidth - 12, targetHeight - 10);
        }

        canvas.toBlob((pngBlob) => {
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

    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };

    img.src = url;
  });
}