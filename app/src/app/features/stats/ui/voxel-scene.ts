import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { VoxelGrid } from '../../../shared/util/geo/geo-types';
import { PROVINCE_SHORT_NAME } from '../../../shared/util/korea-regions';
import { buildBlockLayout } from '../util/block-layout';
import { terrainTile } from '../util/terrain-tiles';
import { visibleMarkers } from '../util/visible-markers';
import { visitColor, type VisitPalette } from '../util/visit-style';
import type { MapLabel, RegionMapMarker } from '../model/map-marker';

/** Exact shared tile edges, merged prisms, and render-on-demand navigation. */
export class VoxelScene {
  private readonly renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-70, 70, 85, -85, 0.1, 1000);
  private readonly controls: OrbitControls;
  private readonly observer: ResizeObserver;
  private readonly material = new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0, vertexColors: true });
  private readonly shadowGeometry = new THREE.PlaneGeometry(1000, 1000);
  private readonly shadowMaterial = new THREE.ShadowMaterial({ color: '#91b7cb', opacity: 0.10 });
  private mesh?: THREE.Mesh;
  private pickRegions: (string | null)[] = [];
  private readonly anchors = new Map<string, THREE.Vector3>();
  private markerPoints: { marker: RegionMapMarker; point: THREE.Vector3 }[] = [];
  private temporary: THREE.Vector3 | null = null;
  private temporaryRegion: string | null = null;
  private start: { x: number; y: number; pointer: number; dragged: boolean } | null = null;
  private readonly raycaster = new THREE.Raycaster();
  private frame: number | null = null;
  private disposed = false;
  private selectedMarker: string | null = null;

  constructor(private readonly host: HTMLElement,
    private readonly labels: (labels: MapLabel[]) => void,
    private readonly select: (region: string | null, temporary: boolean) => void,
    private readonly palette: VisitPalette) {
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    host.appendChild(this.renderer.domElement);
    // ACESFilmic은 흰 지형을 회색으로 눌러 바다와 구분되지 않게 만든다.
    // 색을 그대로 통과시키고 광량으로만 밝기를 맞춘다.
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#e8f3fb', 1.55));
    this.scene.add(new THREE.AmbientLight('#ffffff', 0.62));
    const sun = new THREE.DirectionalLight('#fffdf6', 1.15);
    sun.position.set(-75, 150, -65);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -125, right: 125, top: 125, bottom: -125, near: 1, far: 420 });
    sun.shadow.bias = -0.0002;
    sun.shadow.normalBias = 0.035;
    sun.shadow.radius = 3;
    this.scene.add(sun);
    const floor = new THREE.Mesh(this.shadowGeometry, this.shadowMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.08;
    floor.receiveShadow = true;
    this.scene.add(floor);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableRotate = false;
    this.controls.minZoom = 0.75;
    this.controls.maxZoom = 4;
    this.controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
    this.controls.addEventListener('change', this.render);
    this.renderer.domElement.addEventListener('pointerdown', this.pointerDown);
    this.renderer.domElement.addEventListener('pointermove', this.pointerMove);
    this.renderer.domElement.addEventListener('pointerup', this.pointerUp);
    this.renderer.domElement.addEventListener('pointercancel', this.pointerCancel);
    this.observer = new ResizeObserver(this.resize);
    this.observer.observe(host);
    this.reset();
  }

  setData(grid: VoxelGrid, counts: ReadonlyMap<string, number>, markers: readonly RegionMapMarker[] = []): void {
    this.renderer.shadowMap.needsUpdate = true;
    if (this.mesh) { this.scene.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh = undefined; }
    const layout = buildBlockLayout(grid, counts, 14 / grid.cellSize);
    const { minX, maxX, minY, maxY } = grid.bounds;
    const scale = 145 / Math.max(grid.cellSize, maxY - minY);
    const side = grid.cellSize * scale;
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;
    const pieces: THREE.BufferGeometry[] = [];
    const color = new THREE.Color();
    this.pickRegions = [];
    this.anchors.clear();
    const tops = new Map<object, number>();
    for (const column of layout.columns) {
      const tile = terrainTile(column.cell);
      // The outline is not shrunk or rounded in plan: neighbors share the exact edge.
      const shape = new THREE.Shape(tile.outline.map(p => new THREE.Vector2(p.x * side, -p.y * side)));
      const jitter = Math.sin(column.cell.col * 12.9898 + column.cell.row * 78.233) * 43758.5453;
      const texture = jitter - Math.floor(jitter);
      const landHeight = side * (1.05 + texture * 0.3);
      const peak = column.visitRegion && layout.anchors.get(column.visitRegion)?.cell === column.cell;
      const greenHeight = column.height * 0.72 * (peak ? 1 : 0.65 + texture * 0.35);
      const top = landHeight + greenHeight;
      tops.set(column.cell, top);
      const add = (height: number, bottom: number, fill: string, owner: string | null) => {
        const piece = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, steps: 1, curveSegments: 1 });
        piece.rotateX(-Math.PI / 2);
        piece.translate((column.cell.x - midX) * scale, bottom, (column.cell.y - midY) * scale);
        const vertices = piece.getAttribute('position').count;
        const colors = new Float32Array(vertices * 3);
        color.set(fill);
        for (let i = 0; i < vertices; i++) color.toArray(colors, i * 3);
        piece.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        for (let i = 0; i < vertices / 3; i++) this.pickRegions.push(owner);
        pieces.push(piece);
      };
      add(landHeight, 0, this.palette.land, column.cell.regionCode);
      if (greenHeight > 0) add(greenHeight, landHeight, visitColor(column.strength, this.palette), column.visitRegion);
    }
    if (pieces.length) {
      this.mesh = new THREE.Mesh(mergeGeometries(pieces), this.material);
      this.mesh.castShadow = true;
      this.mesh.receiveShadow = true;
      this.scene.add(this.mesh);
      for (const piece of pieces) piece.dispose();
      this.mesh.updateMatrixWorld();
    }
    for (const [code, anchor] of layout.anchors) {
      this.anchors.set(code, new THREE.Vector3((anchor.cell.x - midX) * scale, tops.get(anchor.cell) ?? 0, (anchor.cell.y - midY) * scale));
    }
    this.markerPoints = markers.flatMap(marker => {
      const anchor = this.anchors.get(marker.id);
      return anchor ? [{ marker, point: anchor.clone().add(new THREE.Vector3(0, 0.5, 0)) }] : [];
    });
    if (this.temporaryRegion && this.temporary) this.temporary = this.anchors.get(this.temporaryRegion)?.clone().add(new THREE.Vector3(0, 0.5, 0)) ?? null;
    this.render();
  }

  clearTemporary(): void { this.temporary = null; this.render(); }
  setSelectedMarker(id: string | null): void { this.selectedMarker = id; this.render(); }
  reset(): void {
    this.temporary = null;
    this.camera.position.set(24, 185, 135);
    this.controls.target.set(0, 0, 0);
    this.camera.zoom = 1;
    this.camera.updateProjectionMatrix();
    this.controls.update();
    this.resize();
  }
  focus(code: string): void {
    const anchor = this.anchors.get(code);
    if (anchor) this.focusPoint(anchor);
  }
  focusMarker(id: string): void {
    const point = id === 'temporary' ? this.temporary : this.markerPoints.find(m => m.marker.id === id)?.point;
    if (point) this.focusPoint(point);
  }
  private focusPoint(point: THREE.Vector3): void {
    const target = new THREE.Vector3(point.x, 0, point.z);
    this.camera.position.add(target.clone().sub(this.controls.target));
    this.controls.target.copy(target);
    this.camera.zoom = 2.2;
    this.camera.updateProjectionMatrix();
    this.controls.update();
    this.render();
  }
  zoom(factor: number): void {
    this.camera.zoom = THREE.MathUtils.clamp(this.camera.zoom * factor, 0.75, 4);
    this.camera.updateProjectionMatrix();
    this.render();
  }
  private readonly resize = (): void => {
    const { clientWidth: w, clientHeight: h } = this.host;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    // 지형 높이는 약 145단위다. 반높이를 그 절반 가까이 두어야 한반도가
    // 화면을 채운다. 값이 크면 지형이 작아지고 바다 여백만 넓어진다.
    const halfHeight = Math.max(62, 44 * h / w);
    this.camera.left = -halfHeight * w / h;
    this.camera.right = halfHeight * w / h;
    this.camera.top = halfHeight;
    this.camera.bottom = -halfHeight;
    this.camera.updateProjectionMatrix();
    this.render();
  };
  private readonly render = (): void => {
    if (this.disposed || this.frame !== null) return;
    this.frame = requestAnimationFrame(this.draw);
  };
  private readonly draw = (): void => {
    this.frame = null;
    if (this.disposed) return;
    this.renderer.render(this.scene, this.camera);
    const w = this.host.clientWidth, h = this.host.clientHeight;
    const points = this.markerPoints.map(({marker,point}) => ({id:marker.id,name:marker.name,point,temporary:false}));
    if (this.temporary) points.push({id:'temporary',name:PROVINCE_SHORT_NAME[this.temporaryRegion ?? ''] ?? '',point:this.temporary,temporary:true});
    this.labels(visibleMarkers(points.map(marker => {
      const p = marker.point.clone().project(this.camera);
      return {id:marker.id,name:marker.name,temporary:marker.temporary,x:(p.x+1)*w/2,y:(1-p.y)*h/2};
    }).filter(p => p.x >= 12 && p.x <= w-12 && p.y >= 30 && p.y <= h-8), this.camera.zoom, this.selectedMarker));
  };
  private readonly pointerDown = (event: PointerEvent): void => {
    if (!event.isPrimary || event.button !== 0) { this.start = null; return; }
    this.start = { x: event.clientX, y: event.clientY, pointer: event.pointerId, dragged: false };
  };
  private readonly pointerMove = (event: PointerEvent): void => {
    if (this.start?.pointer === event.pointerId && Math.hypot(event.clientX-this.start.x,event.clientY-this.start.y)>5) this.start.dragged = true;
  };
  private readonly pointerCancel = (): void => { this.start = null; };
  private readonly pointerUp = (event: PointerEvent): void => {
    const start = this.start;
    this.start = null;
    if (!this.mesh || !start || start.pointer !== event.pointerId || start.dragged || event.button !== 0) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.raycaster.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1),this.camera);
    const hit = this.raycaster.intersectObject(this.mesh)[0];
    if (!hit) { this.temporary = null; this.select(null,false); this.render(); return; }
    const code = hit.faceIndex == null ? null : this.pickRegions[hit.faceIndex];
    if (!code) return;
    const saved = this.markerPoints.some(marker => marker.marker.id === code);
    this.temporaryRegion = saved ? null : code;
    this.temporary = saved ? null : this.anchors.get(code)?.clone().add(new THREE.Vector3(0, 0.5, 0)) ?? null;
    this.select(code, !saved);
    this.render();
  };
  destroy(): void {
    this.disposed = true;
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    this.controls.removeEventListener('change',this.render);
    this.controls.dispose();
    this.renderer.domElement.removeEventListener('pointerdown',this.pointerDown);
    this.renderer.domElement.removeEventListener('pointermove',this.pointerMove);
    this.renderer.domElement.removeEventListener('pointerup',this.pointerUp);
    this.renderer.domElement.removeEventListener('pointercancel',this.pointerCancel);
    this.mesh?.geometry.dispose();
    this.material.dispose();
    this.shadowGeometry.dispose();
    this.shadowMaterial.dispose();
    this.scene.traverse(object => { if (object instanceof THREE.DirectionalLight) object.shadow.dispose(); });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
