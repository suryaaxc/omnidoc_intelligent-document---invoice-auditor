import React, { useState } from 'react';
import { ZoomIn, ZoomOut, RotateCw, Maximize2, Download, FileText } from 'lucide-react';

interface DocumentViewerProps {
  fileUrl: string;
  fileName: string;
  fileType: string;
  fileSize: number;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function DocumentViewer({ fileUrl, fileName, fileType, fileSize }: DocumentViewerProps) {
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const isPdf = fileType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf');

  const handleZoomIn = () => setZoom((z) => Math.min(240, z + 20));
  const handleZoomOut = () => setZoom((z) => Math.max(50, z - 20));
  const handleReset = () => {
    setZoom(100);
    setRotation(0);
  };
  const handleRotate = () => setRotation((r) => (r + 90) % 360);

  return (
    <div className="flex h-full flex-col bg-[#0E131F]">
      {/* Viewer Toolbar */}
      <div className="flex items-center justify-between gap-4 border-b border-slate-800/80 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <FileText className="h-4 w-4 shrink-0 text-slate-400" />
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-slate-200">{fileName}</p>
            <p className="text-[11px] text-slate-500 tabular-nums">
              {isPdf ? 'PDF Document' : 'Image Document'} · {formatBytes(fileSize)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {!isPdf && (
            <>
              <button
                type="button"
                onClick={handleZoomOut}
                title="Zoom out"
                aria-label="Zoom out"
                className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100 cursor-pointer"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </button>
              <span className="w-11 text-center font-mono text-xs text-slate-300 tabular-nums">
                {zoom}%
              </span>
              <button
                type="button"
                onClick={handleZoomIn}
                title="Zoom in"
                aria-label="Zoom in"
                className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100 cursor-pointer"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={handleRotate}
                title="Rotate 90 degrees"
                aria-label="Rotate 90 degrees"
                className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100 cursor-pointer"
              >
                <RotateCw className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={handleReset}
                title="Reset view"
                aria-label="Reset view"
                className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100 cursor-pointer"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}

          <a
            href={fileUrl}
            download={fileName}
            title="Download original file"
            aria-label="Download original file"
            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100"
          >
            <Download className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      {/* Document Viewport */}
      <div className="relative flex-1 overflow-auto bg-[#090D15] p-5">
        {isPdf ? (
          <div className="flex h-full min-h-[560px] w-full flex-col overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
            <iframe
              src={`${fileUrl}#toolbar=1&navpanes=0`}
              title={`PDF Preview of ${fileName}`}
              className="h-full w-full flex-1 border-0"
            />
          </div>
        ) : (
          <div className="flex min-h-full items-start justify-center">
            <div
              className="origin-top transition-transform duration-150 ease-out"
              style={{
                width: `${zoom}%`,
                maxWidth: zoom <= 100 ? '680px' : 'none',
              }}
            >
              <img
                src={fileUrl}
                alt={`Preview of ${fileName}`}
                referrerPolicy="no-referrer"
                style={{
                  transform: `rotate(${rotation}deg)`,
                }}
                className="h-auto w-full rounded-md border border-slate-700/60 bg-white shadow-2xl transition-transform duration-150"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
