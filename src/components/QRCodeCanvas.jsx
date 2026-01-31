// src/components/QRCodeCanvas.jsx
import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

export default function QRCodeCanvas({ value, size = 200 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (canvasRef.current && value) {
      QRCode.toCanvas(
        canvasRef.current,
        value,
        {
          width: size,
          margin: 2,
          color: {
            dark: '#3B82F6', // Primary blue
            light: '#FFFFFF', // White
          },
        },
        (error) => {
          if (error) console.error('QR Code generation failed:', error);
        }
      );
    }
  }, [value, size]);

  return (
    <div className="inline-block bg-white p-4 rounded-lg shadow-sm">
      <canvas ref={canvasRef} />
    </div>
  );
}
