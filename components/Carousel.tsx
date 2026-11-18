"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function Carousel({
  slides,
  intervalMs = 7000,
}: {
  slides: React.ReactNode[];
  intervalMs?: number;
}) {
  const [indexBruto, setIndex] = useState(0);
  const index = slides.length ? indexBruto % slides.length : 0;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const restartTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, intervalMs);
  }, [intervalMs, slides.length]);

  useEffect(() => {
    restartTimer();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [restartTimer]);

  function goTo(i: number) {
    setIndex((i + slides.length) % slides.length);
    restartTimer();
  }

  return (
    <div className="relative grid rounded-xl overflow-hidden border border-border bg-white lg:block lg:h-full lg:min-h-[420px]">
      {slides.map((slide, i) => (
        <div
          key={i}
          className="col-start-1 row-start-1 transition-opacity duration-700 ease-in-out lg:absolute lg:inset-0"
          style={{ opacity: i === index ? 1 : 0, pointerEvents: i === index ? "auto" : "none" }}
          aria-hidden={i !== index}
        >
          {slide}
        </div>
      ))}

      {slides.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => goTo(index - 1)}
            aria-label="Slide anterior"
            className="absolute left-2 top-[100px] -translate-y-1/2 lg:top-1/2 z-10 bg-black/25 hover:bg-black/40 text-white rounded-full p-1.5 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => goTo(index + 1)}
            aria-label="Próximo slide"
            className="absolute right-2 top-[100px] -translate-y-1/2 lg:top-1/2 z-10 bg-black/25 hover:bg-black/40 text-white rounded-full p-1.5 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <div className="row-start-2 flex items-center justify-center gap-1.5 py-2.5 lg:absolute lg:bottom-3 lg:left-0 lg:right-0 lg:py-0 z-10">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Ir para o slide ${i + 1}`}
                className={
                  "h-1.5 rounded-full transition-all " +
                  (i === index ? "w-5 bg-white" : "w-1.5 bg-white/50 hover:bg-white/75")
                }
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
