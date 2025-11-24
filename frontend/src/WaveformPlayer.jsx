import React, { useEffect, useRef } from "react";
import WaveSurfer from "wavesurfer.js";

export default function WaveformPlayer({ audioURL }) {
  const containerRef = useRef(null);
  const wavesurferRef = useRef(null);

  useEffect(() => {
    if (audioURL && containerRef.current) {
      wavesurferRef.current = WaveSurfer.create({
        container: containerRef.current,
        waveColor: "#334155",
        progressColor: "#06b6d4",
        cursorColor: "#c084fc",
        height: 70,
        barWidth: 2,
        responsive: true,
      });

      wavesurferRef.current.load(audioURL);
    }

    return () => {
      if (wavesurferRef.current) wavesurferRef.current.destroy();
    };
  }, [audioURL]);

  const togglePlay = () => {
    if (wavesurferRef.current) {
      wavesurferRef.current.playPause();
    }
  };

  if (!audioURL) return null;

  return (
    <div className="w-full">
      <div ref={containerRef} className="rounded-lg overflow-hidden bg-slate-900" />
      <button
        onClick={togglePlay}
        className="mt-2 px-3 py-1 rounded-lg bg-cyan-500 text-slate-900 text-xs hover:bg-cyan-400 transition"
      >
        Play / Pause
      </button>
    </div>
  );
}
