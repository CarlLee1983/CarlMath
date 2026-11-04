import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export interface SurfaceDimensions {
  length: number;
  width: number;
  height: number;
}

export interface SurfaceRenderer {
  /** 0 is a closed cuboid; 1 is its flat, nonoverlapping cross net. */
  update(dimensions: SurfaceDimensions, openness: number): void;
  resetView(): void;
  setView(view: 'front' | 'top' | 'side'): void;
  /** Factors above 1 zoom in; factors below 1 zoom out. */
  zoomBy(factor: number): void;
  dispose(): void;
}

/** Six rigid faces, joined by five real edge pivots. No animation loop is needed. */
export function createSurfaceRenderer(host: HTMLElement, onFailure: () => void): SurfaceRenderer {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  } catch {
    queueMicrotask(onFailure);
    return { update() {}, resetView() {}, setView() {}, zoomBy() {}, dispose() {} };
  }
  const canvas = renderer.domElement;
  canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;';
  // The classroom retains a semantic description and a labelled 2D net.
  canvas.setAttribute('aria-hidden', 'true');
  host.append(canvas);
  renderer.setClearColor(0, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffffff, 2.4));
  const light = new THREE.DirectionalLight(0xffffff, 2);
  light.position.set(6, 10, 8);
  scene.add(light);
  const camera = new THREE.PerspectiveCamera(36, 1, 0.01, 500);
  const direction = new THREE.Vector3(1.1, 1.6, 1.7).normalize();
  camera.position.copy(direction);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = false;
  controls.enablePan = false;
  controls.zoomSpeed = 0.75;
  controls.rotateSpeed = 0.65;
  // Both sides can be inspected. A top preset is useful for the flat net.
  controls.minPolarAngle = 0;
  controls.maxPolarAngle = Math.PI;
  const model = new THREE.Group();
  scene.add(model);
  const hinges = {
    back: new THREE.Group(), front: new THREE.Group(),
    left: new THREE.Group(), right: new THREE.Group(), top: new THREE.Group(),
  };
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];
  let current: SurfaceDimensions | undefined;
  let disposed = false;
  let failed = false;
  let frame = 0;
  let measuredWidth = 0;
  let measuredHeight = 0;
  const bounds = new THREE.Box3();
  const sphere = new THREE.Sphere();
  const probe = document.createElement('span');
  probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;';
  probe.setAttribute('aria-hidden', 'true');
  host.append(probe);
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = colorCanvas.height = 1;
  const colorContext = colorCanvas.getContext('2d', { willReadFrequently: true });

  function tokenColor(token: string): string {
    probe.style.color = `var(${token})`;
    const css = getComputedStyle(probe).color;
    // Resolve light-dark(), oklch(), etc. with the browser, not Three's CSS subset.
    if (!colorContext) return css;
    colorContext.clearRect(0, 0, 1, 1);
    colorContext.fillStyle = css;
    colorContext.fillRect(0, 0, 1, 1);
    const [r, g, b] = colorContext.getImageData(0, 0, 1, 1).data;
    return `rgb(${r}, ${g}, ${b})`;
  }

  function readPalette() {
    return { fill: tokenColor('--accent-soft'), card: tokenColor('--card'), foreground: tokenColor('--fg'), grid: tokenColor('--line') };
  }
  let palette = readPalette();

  function refreshTheme() {
    if (disposed) return;
    const next = readPalette();
    if (JSON.stringify(next) === JSON.stringify(palette)) return;
    palette = next;
    // Recreate the labelled textures without changing hinge pose or camera/zoom.
    try { if (current) rebuild(current); } catch { fail(); return; }
    scheduleRender();
  }

  function scheduleRender() {
    if (disposed || frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (disposed || !measuredWidth || !measuredHeight) return;
      try { renderer.render(scene, camera); } catch { fail(); }
    });
  }

  function fail() {
    if (disposed || failed) return;
    failed = true;
    dispose();
    onFailure();
  }

  function clearFaces() {
    model.clear();
    Object.values(hinges).forEach((hinge) => hinge.clear());
    geometries.splice(0).forEach((geometry) => geometry.dispose());
    materials.splice(0).forEach((material) => material.dispose());
    textures.splice(0).forEach((texture) => texture.dispose());
  }

  function addFace(parent: THREE.Group, width: number, depth: number, x: number, z: number, label: string) {
    const image = document.createElement('canvas');
    // Integral grid spacing represents exactly one square centimetre.
    image.width = width * 128;
    image.height = depth * 128;
    const ctx = image.getContext('2d');
    if (!ctx) throw new Error('Face labels require a 2D canvas.');
    ctx.fillStyle = palette.fill;
    ctx.fillRect(0, 0, image.width, image.height);
    ctx.strokeStyle = palette.grid;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= width; i++) {
      ctx.moveTo(i * 128, 0); ctx.lineTo(i * 128, image.height);
    }
    for (let i = 0; i <= depth; i++) {
      ctx.moveTo(0, i * 128); ctx.lineTo(image.width, i * 128);
    }
    ctx.stroke();
    const fontSize = Math.min(42, image.width / 6.5);
    const labelWidth = Math.min(image.width - 12, Math.max(108, fontSize * 6));
    const labelHeight = fontSize * 2.8;
    ctx.fillStyle = palette.card;
    ctx.fillRect((image.width - labelWidth) / 2, (image.height - labelHeight) / 2, labelWidth, labelHeight);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = palette.foreground;
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.fillText(label, image.width / 2, image.height / 2 - fontSize * 0.65);
    ctx.font = `${fontSize * 0.8}px sans-serif`;
    ctx.fillText(`${width} × ${depth} cm`, image.width / 2, image.height / 2 + fontSize * 0.6);
    const texture = new THREE.CanvasTexture(image);
    texture.colorSpace = THREE.SRGBColorSpace;
    textures.push(texture);
    // Separate back UVs keep the labels readable from inside as well as outside.
    const backTexture = texture.clone();
    backTexture.wrapS = THREE.RepeatWrapping;
    backTexture.repeat.x = -1;
    backTexture.offset.x = 1;
    textures.push(backTexture);
    const frontMaterial = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.9, side: THREE.FrontSide });
    const backMaterial = new THREE.MeshStandardMaterial({ map: backTexture, roughness: 0.9, side: THREE.BackSide });
    materials.push(frontMaterial, backMaterial);
    const geometry = new THREE.PlaneGeometry(width, depth);
    geometry.rotateX(-Math.PI / 2);
    geometries.push(geometry);
    const front = new THREE.Mesh(geometry, frontMaterial);
    const back = new THREE.Mesh(geometry, backMaterial);
    front.position.set(x, 0, z);
    back.position.copy(front.position);
    parent.add(front, back);
    const edgeGeometry = new THREE.EdgesGeometry(geometry);
    const edgeMaterial = new THREE.LineBasicMaterial({ color: palette.foreground });
    geometries.push(edgeGeometry);
    materials.push(edgeMaterial);
    const edge = new THREE.LineSegments(edgeGeometry, edgeMaterial);
    edge.position.copy(front.position);
    parent.add(edge);
  }

  function rebuild({ length: l, width: w, height: h }: SurfaceDimensions) {
    clearFaces();
    addFace(model, l, w, 0, 0, '1 底面');
    model.add(hinges.back, hinges.front, hinges.left, hinges.right);
    hinges.back.position.set(0, 0, -w / 2);
    hinges.front.position.set(0, 0, w / 2);
    hinges.left.position.set(-l / 2, 0, 0);
    hinges.right.position.set(l / 2, 0, 0);
    addFace(hinges.back, l, h, 0, -h / 2, '4 後面');
    addFace(hinges.front, l, h, 0, h / 2, '3 前面');
    addFace(hinges.left, h, w, -h / 2, 0, '5 左面');
    addFace(hinges.right, h, w, h / 2, 0, '6 右面');
    hinges.back.add(hinges.top);
    hinges.top.position.set(0, 0, -h);
    addFace(hinges.top, l, w, 0, -w / 2, '2 上面');
  }

  function fitCamera(reset = false) {
    if (disposed || !current) return;
    if (!reset) direction.copy(camera.position).sub(controls.target).normalize();
    model.updateMatrixWorld(true);
    bounds.setFromObject(model).getBoundingSphere(sphere);
    const radius = Math.max(0.5, sphere.radius);
    const vertical = THREE.MathUtils.degToRad(camera.fov / 2);
    const horizontal = Math.atan(Math.tan(vertical) * camera.aspect);
    // The bounding sphere fits in both axes at any aspect ratio and any orbit.
    const distance = radius / Math.sin(Math.min(vertical, horizontal)) * 1.14;
    controls.target.copy(sphere.center);
    camera.position.copy(sphere.center).addScaledVector(direction, distance);
    controls.minDistance = radius * 1.1;
    controls.maxDistance = distance * 3;
    camera.near = Math.max(0.01, radius / 100);
    camera.far = Math.max(100, distance * 5 + radius);
    camera.updateProjectionMatrix();
    controls.update();
    scheduleRender();
  }

  function update(dimensions: SurfaceDimensions, openness: number) {
    if (disposed) return;
    const bounded = (n: number) => Number.isFinite(n) ? Math.max(1, Math.min(8, Math.round(n))) : 1;
    const next = { length: bounded(dimensions.length), width: bounded(dimensions.width), height: bounded(dimensions.height) };
    const changed = !current || next.length !== current.length || next.width !== current.width || next.height !== current.height;
    current = next;
    try { if (changed) rebuild(next); } catch { fail(); return; }
    const amount = Number.isFinite(openness) ? THREE.MathUtils.clamp(openness, 0, 1) : 0;
    const angle = (1 - amount) * Math.PI / 2;
    hinges.back.rotation.x = angle;
    hinges.front.rotation.x = -angle;
    hinges.left.rotation.z = -angle;
    hinges.right.rotation.z = angle;
    hinges.top.rotation.x = angle;
    fitCamera();
  }

  function resize() {
    if (disposed) return;
    const { width, height } = host.getBoundingClientRect();
    if (width <= 0 || height <= 0) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    if (width === measuredWidth && height === measuredHeight && ratio === renderer.getPixelRatio()) return;
    measuredWidth = width;
    measuredHeight = height;
    renderer.setPixelRatio(ratio);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    fitCamera();
  }

  function resetView() {
    if (disposed) return;
    direction.set(1.1, 1.6, 1.7).normalize();
    fitCamera(true);
  }

  function setView(view: 'front' | 'top' | 'side') {
    if (disposed) return;
    if (view === 'front') direction.set(0, 0, 1);
    else if (view === 'side') direction.set(1, 0, 0);
    else direction.set(0, 1, 0);
    fitCamera(true);
  }

  function zoomBy(factor: number) {
    if (disposed || !Number.isFinite(factor) || factor <= 0) return;
    const offset = camera.position.clone().sub(controls.target);
    offset.setLength(THREE.MathUtils.clamp(offset.length() / factor, controls.minDistance, controls.maxDistance));
    camera.position.copy(controls.target).add(offset);
    controls.update();
    scheduleRender();
  }

  function contextLost(event: Event) { event.preventDefault(); fail(); }
  const observer = new ResizeObserver(resize);
  const themeObserver = new MutationObserver(refreshTheme);
  const darkMode = window.matchMedia('(prefers-color-scheme: dark)');
  function dispose() {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(frame);
    observer.disconnect();
    themeObserver.disconnect();
    darkMode.removeEventListener('change', refreshTheme);
    window.removeEventListener('resize', resize);
    canvas.removeEventListener('webglcontextlost', contextLost);
    controls.removeEventListener('change', scheduleRender);
    controls.dispose();
    clearFaces();
    scene.clear();
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
    probe.remove();
  }
  canvas.addEventListener('webglcontextlost', contextLost);
  controls.addEventListener('change', scheduleRender);
  observer.observe(host);
  const attributes = { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] };
  themeObserver.observe(document.documentElement, attributes);
  themeObserver.observe(document.body, attributes);
  themeObserver.observe(host, attributes);
  darkMode.addEventListener('change', refreshTheme);
  window.addEventListener('resize', resize);
  update({ length: 3, width: 2, height: 2 }, 0);
  resetView();
  resize();
  return { update, resetView, setView, zoomBy, dispose };
}
