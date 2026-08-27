import html2canvas from 'html2canvas';

export const captureElement = async (elementId: string, fileName = 'watch-party-moment.png'): Promise<string | null> => {
  const targetElement = document.getElementById(elementId);
  if (!targetElement) {
    console.error(`Element with id "${elementId}" not found.`);
    return null;
  }

  try {
    const canvas = await html2canvas(targetElement, {
      useCORS: true,
      allowTaint: true,
      backgroundColor: null,
      logging: false,
    });

    const imageDataUrl = canvas.toDataURL('image/png');
    return imageDataUrl;
  } catch (error) {
    console.error('Failed to capture screenshot:', error);
    return null;
  }
};

export const downloadImage = (dataUrl: string, fileName = 'watch-party-moment.png') => {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};