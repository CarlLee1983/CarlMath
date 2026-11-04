import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export interface GeometryDimensions {
  length: number;
  width: number;
  height: number;
  visibleLayers: number;
}

export interface GeometryRenderer {
  update(dimensions: GeometryDimensions): void;
  resetView(): void;
  setView(view: 'front' | 'top' | 'side'): void;
  /** Factors above 1 zoom in; factors below 1 zoom out. */
  zoomBy(factor: number): void;
  dispose(): void;
}

/** Each grid cell represents one cubic centimetre. Render only when something changes. */
export function createGeometryRenderer(host: HTMLElement, onFailure: () => void): GeometryRenderer {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  } catch {
    queueMicrotask(onFailure);
    return { update() {}, resetView() {}, setView() {}, zoomBy() {}, dispose() {} };
  }

  const canvas = renderer.domElement;
  canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;';
  // The containing classroom supplies an equivalent, live text description.
  canvas.setAttribute('aria-hidden', 'true');
  host.append(canvas);
  renderer.setClearColor(0, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 200);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = false;
  controls.enablePan = false;
  controls.maxPolarAngle = Math.PI / 2;
  controls.minPolarAngle = 0;
  controls.zoomSpeed = 0.75;
  controls.rotateSpeed = 0.65;
  scene.add(new THREE.AmbientLight(0xffffff, 2));
  const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
  keyLight.position.set(6, 10, 8);
  scene.add(keyLight);

  // Narrow seams show individual cells; slightly wider horizontal seams expose layers
  // even in monochrome. Cell centres remain exactly one unit apart on every axis.
  const cubeGeometry = new THREE.BoxGeometry(0.975, 0.955, 0.975);
  const cubeEdges = new THREE.EdgesGeometry(cubeGeometry);
  const edgeMaterial = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.42 });
  const gridMaterial = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.5 });
  const layerMaterials = Array.from({ length: 8 }, () => new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0 }));
  const layers = layerMaterials.map((material) => {
    const mesh = new THREE.InstancedMesh(cubeGeometry, material, 64);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.count = 0;
    scene.add(mesh);
    return mesh;
  });
  let edges = new THREE.LineSegments(new THREE.BufferGeometry(), edgeMaterial);
  let grid = new THREE.LineSegments(new THREE.BufferGeometry(), gridMaterial);
  scene.add(edges, grid);
  let current: GeometryDimensions = { length: 3, width: 2, height: 2, visibleLayers: 2 };
  let disposed = false;
  let failed = false;
  let frame = 0;
  let measuredWidth = 0;
  let measuredHeight = 0;
  const matrix = new THREE.Matrix4();
  const direction = new THREE.Vector3(1.25, 0.95, 1.5).normalize();
  const probe = document.createElement('span');
  probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;';
  probe.setAttribute('aria-hidden', 'true');
  host.append(probe);
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = colorCanvas.height = 1;
  const colorContext = colorCanvas.getContext('2d', { willReadFrequently: true });

  function tokenColor(token: string): THREE.Color {
    probe.style.color = `var(${token})`;
    const css = getComputedStyle(probe).color;
    // Resolve light-dark(), oklch(), etc. through the browser rather than a CSS subset.
    if (colorContext) {
      colorContext.clearRect(0, 0, 1, 1);
      colorContext.fillStyle = css;
      colorContext.fillRect(0, 0, 1, 1);
      const [r, g, b] = colorContext.getImageData(0, 0, 1, 1).data;
      return new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);
    }
    return new THREE.Color(css);
  }

  function refreshTheme() {
    if (disposed) return;
    const accent = tokenColor('--accent');
    const foreground = tokenColor('--fg');
    layerMaterials.forEach((material, index) => {
      material.color.copy(accent).lerp(foreground, index % 2 === 0 ? 0.03 : 0.23);
    });
    edgeMaterial.color.copy(foreground);
    gridMaterial.color.copy(tokenColor('--line'));
    scheduleRender();
  }

  function fail() {
    if (failed || disposed) return;
    failed = true;
    dispose();
    onFailure();
  }

  function scheduleRender() {
    if (disposed || frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (disposed || !measuredWidth || !measuredHeight) return;
      try {
        renderer.render(scene, camera);
      } catch {
        fail();
      }
    });
  }

  function fitCamera(reset = false) {
    if (!reset) direction.copy(camera.position).sub(controls.target).normalize();
    // Fit the enclosing sphere for every orbit and either portrait or landscape hosts.
    const radius = Math.hypot(current.length, current.width, current.height) / 2;
    const vertical = THREE.MathUtils.degToRad(camera.fov / 2);
    const horizontal = Math.atan(Math.tan(vertical) * camera.aspect);
    const distance = radius / Math.sin(Math.min(vertical, horizontal)) * 1.16;
    controls.target.set(0, current.height / 2, 0);
    camera.position.copy(controls.target).addScaledVector(direction, distance);
    controls.minDistance = radius * 1.35;
    controls.maxDistance = distance * 3;
    camera.near = Math.max(0.01, radius / 100);
    camera.far = Math.max(100, distance * 5 + radius);
    camera.updateProjectionMatrix();
    controls.update();
    scheduleRender();
  }

  function resize() {
    if (disposed) return;
    const { width, height } = host.getBoundingClientRect();
    if (width <= 0 || height <= 0) return;
    if (measuredWidth === width && measuredHeight === height && renderer.getPixelRatio() === Math.min(window.devicePixelRatio || 1, 2)) return;
    measuredWidth = width;
    measuredHeight = height;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    fitCamera();
  }

  function update(dimensions: GeometryDimensions) {
    if (disposed) return;
    const bounded = (value: number) => Number.isFinite(value) ? Math.max(1, Math.min(8, Math.round(value))) : 1;
    const length = bounded(dimensions.length);
    const width = bounded(dimensions.width);
    const height = bounded(dimensions.height);
    const visibleLayers = Math.min(height, bounded(dimensions.visibleLayers));
    const dimensionsChanged = length !== current.length || width !== current.width || height !== current.height;
    current = { length, width, height, visibleLayers };
    const positions: number[] = [];
    const edgePositions = cubeEdges.getAttribute('position');
    layers.forEach((mesh, y) => {
      mesh.count = y < visibleLayers ? length * width : 0;
      mesh.visible = y < visibleLayers;
      if (!mesh.visible) return;
      for (let x = 0; x < length; x++) {
        for (let z = 0; z < width; z++) {
          const px = x - (length - 1) / 2;
          const py = y + 0.5;
          const pz = z - (width - 1) / 2;
          matrix.makeTranslation(px, py, pz);
          mesh.setMatrixAt(x * width + z, matrix);
          for (let vertex = 0; vertex < edgePositions.count; vertex++) {
            positions.push(edgePositions.getX(vertex) + px, edgePositions.getY(vertex) + py, edgePositions.getZ(vertex) + pz);
          }
        }
      }
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    });
    edges.geometry.dispose();
    edges.geometry = new THREE.BufferGeometry();
    edges.geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const gridPositions: number[] = [];
    for (let x = 0; x <= length; x++) gridPositions.push(x - length / 2, -0.025, -width / 2, x - length / 2, -0.025, width / 2);
    for (let z = 0; z <= width; z++) gridPositions.push(-length / 2, -0.025, z - width / 2, length / 2, -0.025, z - width / 2);
    grid.geometry.dispose();
    grid.geometry = new THREE.BufferGeometry();
    grid.geometry.setAttribute('position', new THREE.Float32BufferAttribute(gridPositions, 3));
    if (dimensionsChanged) fitCamera();
    scheduleRender();
  }

  function resetView() {
    if (disposed) return;
    direction.set(1.25, 0.95, 1.5).normalize();
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
    const distance = THREE.MathUtils.clamp(offset.length() / factor, controls.minDistance, controls.maxDistance);
    camera.position.copy(controls.target).add(offset.setLength(distance));
    controls.update();
    scheduleRender();
  }

  function contextLost(event: Event) {
    event.preventDefault();
    fail();
  }
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
    layers.forEach((mesh) => mesh.dispose());
    cubeGeometry.dispose();
    cubeEdges.dispose();
    edges.geometry.dispose();
    grid.geometry.dispose();
    layerMaterials.forEach((material) => material.dispose());
    edgeMaterial.dispose();
    gridMaterial.dispose();
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
  update(current);
  refreshTheme();
  resetView();
  resize();
  return { update, resetView, setView, zoomBy, dispose };
}
