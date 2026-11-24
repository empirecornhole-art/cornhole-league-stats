"use client";

import { useEffect, useRef } from "react";

// Slow, liquid ember-colored flow behind the hero. One fullscreen fragment
// shader (domain-warped noise), no library. Cheap on purpose: rendered at a
// fraction of the screen resolution (it's soft anyway), paused when scrolled
// off-screen or the tab is hidden, a single still frame under reduced motion,
// and nothing at all if WebGL is unavailable (the CSS glow behind it remains).

const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes;
uniform float uTime;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.02; a *= 0.5; }
  return v;
}

void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p = uv * vec2(uRes.x / uRes.y, 1.0) * 1.6;
  float t = uTime * 0.09;

  vec2 q = vec2(fbm(p + t), fbm(p + vec2(5.2, 1.3) - t));
  vec2 r = vec2(fbm(p + 3.0 * q + vec2(1.7, 9.2) + t * 1.4),
                fbm(p + 3.0 * q + vec2(8.3, 2.8) - t * 1.2));
  float f = fbm(p + 3.0 * r);

  // Thin bright ridges where the flow folds over itself.
  float ridge = smoothstep(0.55, 0.9, f) * 0.6 + smoothstep(0.35, 0.75, length(q)) * 0.25;

  vec3 bg = vec3(0.051, 0.047, 0.043);
  vec3 ember = vec3(0.941, 0.290, 0.133);
  vec3 col = mix(bg, ember * 0.7, ridge * 0.8);

  // Keep the bottom and edges calm so text and the next section stay clean.
  float mask = smoothstep(0.0, 0.55, uv.y) * smoothstep(0.0, 0.18, uv.x) * (1.0 - smoothstep(0.82, 1.0, uv.x));
  gl_FragColor = vec4(clamp(mix(bg, col, mask), 0.0, 1.0), 1.0);
}
`;

export default function FluidBackground({ className = "" }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { antialias: false, alpha: false, powerPreference: "low-power" });
    if (!gl) return;

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
    };
    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;
    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(program, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(program, "uRes");
    const uTime = gl.getUniformLocation(program, "uTime");

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    // Render at ~40% of CSS pixels: the flow is blurry by nature.
    const scale = 0.4;
    let frame = 0;
    let visible = true;
    let running = false;
    const t0 = performance.now();

    const resize = () => {
      const w = Math.max(1, Math.round(canvas.clientWidth * scale));
      const h = Math.max(1, Math.round(canvas.clientHeight * scale));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
      gl.uniform2f(uRes, canvas.width, canvas.height);
    };

    const draw = (now: number) => {
      gl.uniform1f(uTime, reduced.matches ? 12 : (now - t0) / 1000 + 12);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const loop = (now: number) => {
      draw(now);
      frame = requestAnimationFrame(loop);
    };

    const update = () => {
      const shouldRun = visible && !document.hidden && !reduced.matches;
      if (shouldRun && !running) {
        running = true;
        frame = requestAnimationFrame(loop);
      } else if (!shouldRun && running) {
        running = false;
        cancelAnimationFrame(frame);
      }
      if (!shouldRun) {
        resize();
        draw(performance.now());
      }
    };

    resize();
    update();

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      update();
    });
    observer.observe(canvas);
    const onResize = () => {
      resize();
      if (!running) draw(performance.now());
    };
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", update);
    reduced.addEventListener("change", update);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", update);
      reduced.removeEventListener("change", update);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden className={`pointer-events-none ${className}`} />;
}
