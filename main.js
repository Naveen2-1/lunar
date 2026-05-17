import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ── Mobile Detection & Config ────────────────────────────────────
const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (window.innerWidth <= 768);
let performanceMode = isMobile; // auto-enable on mobile, togglable

const mobileConfig = {
  starCount:       isMobile ? 1500 : 6000,
  craterLimit:     isMobile ? 50 : 200,
  shadowMapSize:   isMobile ? 1024 : 4096,
  pixelRatio:      isMobile ? Math.min(window.devicePixelRatio, 1.5) : window.devicePixelRatio,
  earthSegments:   isMobile ? 32 : 64,
  markerSegments:  isMobile ? 8 : 16,
  glowSegments:    isMobile ? 8 : 16,
};

// ── Globals ──────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000); 

const earthPos = new THREE.Vector3(-6, 0, 0);

const defaultCameraPos = new THREE.Vector3(-10, 2, 2);
const defaultTargetPos = new THREE.Vector3().copy(earthPos);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, isMobile ? 0.5 : 0.1, 1000);
camera.position.copy(defaultCameraPos);

const renderer = new THREE.WebGLRenderer({ antialias: !isMobile, alpha: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(mobileConfig.pixelRatio);
renderer.outputColorSpace = THREE.SRGBColorSpace; 
renderer.shadowMap.enabled = !isMobile;
renderer.shadowMap.type = isMobile ? THREE.BasicShadowMap : THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = isMobile ? 0.12 : 0.08;
controls.enablePan = false;
controls.minDistance = isMobile ? 1.5 : 1.0;
controls.maxDistance = isMobile ? 12 : 20;
controls.target.copy(defaultTargetPos);
if (isMobile) {
  controls.rotateSpeed = 0.8;
  controls.zoomSpeed = 1.2;
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE };
}

// ── Celestial Hierarchy ─────────────────────────────────────────
let globalMoonSurface = null; 
let moonMaterial = null; 
const moonGroup = new THREE.Group();
const moonOrbitRadius = 6;
scene.add(moonGroup);

// ── Background Starfield ─────────────────────────────────────────
let starfieldMesh = null;
function createStarfield() {
  const starsGeometry = new THREE.BufferGeometry();
  const starsCount = mobileConfig.starCount;
  const posArray = new Float32Array(starsCount * 3);

  for(let i = 0; i < starsCount * 3; i+=3) {
    const r = 50 + Math.random() * 150; 
    const theta = 2 * Math.PI * Math.random();
    const phi = Math.acos(2 * Math.random() - 1);
    
    posArray[i] = r * Math.sin(phi) * Math.cos(theta);
    posArray[i+1] = r * Math.sin(phi) * Math.sin(theta);
    posArray[i+2] = r * Math.cos(phi);
  }

  starsGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
  
  const starsMaterial = new THREE.PointsMaterial({
    color: 0xffffff,
    size: isMobile ? 0.2 : 0.15,
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true
  });

  starfieldMesh = new THREE.Points(starsGeometry, starsMaterial);
  scene.add(starfieldMesh);
}
createStarfield();

// ── Earth Setup ──────────────────────────────────────────────────
const earthGeometry = new THREE.SphereGeometry(1, mobileConfig.earthSegments, mobileConfig.earthSegments);
const earthTexture = new THREE.TextureLoader().load(
  "https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg"
);
const earthMaterial = new THREE.MeshStandardMaterial({
  map: earthTexture
});
const earth = new THREE.Mesh(earthGeometry, earthMaterial);
earth.position.copy(earthPos);
earth.castShadow = !isMobile;
earth.receiveShadow = !isMobile;
scene.add(earth);

// Earth Clouds Layer (skip on mobile for performance)
let clouds = null;
if (!isMobile) {
  const cloudGeometry = new THREE.SphereGeometry(1.02, 64, 64);
  const cloudTexture = new THREE.TextureLoader().load(
    "https://threejs.org/examples/textures/planets/earth_clouds_1024.png"
  );
  const cloudMaterial = new THREE.MeshStandardMaterial({
    map: cloudTexture,
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  clouds = new THREE.Mesh(cloudGeometry, cloudMaterial);
  earth.add(clouds);
}

// ── Lighting / Simple Sun ─────────────────────────────────────────
const ambientLight = new THREE.AmbientLight(0xffffff, 0.05); 
scene.add(ambientLight);

// Stable non-mesh Directional Sun system
const sunLight = new THREE.DirectionalLight(0xffffff, 2);
sunLight.position.set(10, 0, 0);
sunLight.castShadow = !isMobile;
sunLight.shadow.mapSize.width = mobileConfig.shadowMapSize;
sunLight.shadow.mapSize.height = mobileConfig.shadowMapSize;
sunLight.shadow.camera.near = 0.1;
sunLight.shadow.camera.far = 40; 
sunLight.shadow.camera.left = -10;
sunLight.shadow.camera.right = 10;
sunLight.shadow.camera.top = 10;
sunLight.shadow.camera.bottom = -10;
sunLight.shadow.bias = -0.001;
scene.add(sunLight);

const rimLight = new THREE.DirectionalLight(0x88ccff, 0.15); 
rimLight.position.set(-15, -3, -5);
scene.add(rimLight);

function latLonToVector3(lat, lon, radius) {
  const phi   = (90 - lat) * Math.PI / 180;
  const theta = (lon + 180) * Math.PI / 180;
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z =  (radius * Math.sin(phi) * Math.sin(theta));
  const y =  (radius * Math.cos(phi));
  return new THREE.Vector3(x, y, z);
}

// ── Scientific Datasets ──────────────────────────────────────────
// Missions loaded dynamically from data/missions.json
let missions = [];

let craterSpritesList = [];

const maria = [
  { name: "Mare Tranquillitatis", lat: 8.5, lon: 31.4 },
  { name: "Mare Imbrium", lat: 32.8, lon: -15.6 },
  { name: "Oceanus Procellarum", lat: 18.4, lon: -57.4 }
];

const roverPaths = [
  {
    name: "Lunokhod 1",
    path: [
      { lat: 38.24, lon: -37.00 },
      { lat: 38.3, lon: -37.2 },
      { lat: 38.4, lon: -37.5 }
    ],
    color: "#ff4444",
    year: 1970
  }
];

const markers = []; 
const markerMeshes = []; 
let moonRadius = 1.5;
const gridGroup = new THREE.Group();
const roversGroup = new THREE.Group();

// ── Application State (Inspect Mode) ──────────────────────────────
let activeFilter = 'ALL';
let orbitAngle = 0;
let isPaused = false;

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let hoveredMarkerObj = null;
let selectedMarker = null;
let frameCount = 0; // for throttled raycasting on mobile
let userIsTouching = false; // track active touch for raycasting guard
let frame = 0; // animation throttle counter

// Touch state listeners (global)
window.addEventListener('touchstart', () => { userIsTouching = true; }, { passive: true });
window.addEventListener('touchend', () => { userIsTouching = false; }, { passive: true });

// ── UI Elements ──────────────────────────────────────────────────
const tooltip = document.getElementById('tooltip');
const resumeBtn = document.getElementById('resume-orbit-btn');
const phaseDisplayEl = document.getElementById('top-phase-display');
const eclipseDisplayEl = document.getElementById('top-eclipse-display');
const signalDisplayEl = document.getElementById('top-signal-display');

const filterButtons = document.querySelectorAll('.filter-btn');

// ── Generate Scientific Overlays ──────────────────────────────────
function createGrid(radius) {
  const gridRadius = radius * 1.001;
  const lineMat = new THREE.LineBasicMaterial({ color: 0x4da6ff, transparent: true, opacity: 0.1 });
  const equatorMat = new THREE.LineBasicMaterial({ color: 0x00ccff, transparent: true, opacity: 0.3, linewidth: 1 });
  const primeMeridianMat = new THREE.LineBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.3, linewidth: 1 });

  for (let lat = -75; lat <= 75; lat += 15) {
    const points = [];
    for (let lon = -180; lon <= 180; lon += 5) {
      points.push(latLonToVector3(lat, lon, gridRadius));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    gridGroup.add(new THREE.LineLoop(geo, lat === 0 ? equatorMat : lineMat));
  }

  for (let lon = -180; lon < 180; lon += 15) {
    const points = [];
    for (let lat = -90; lat <= 90; lat += 5) {
      points.push(latLonToVector3(lat, lon, gridRadius));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    gridGroup.add(new THREE.Line(geo, lon === 0 ? primeMeridianMat : lineMat));
  }
}

function createTextSprite(text, colorHex, fontSize = 36, stroke = true, transparent = true) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext('2d');

  context.font = `bold ${fontSize}px Inter, sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  
  if (stroke) {
    context.lineWidth = 6;
    context.strokeStyle = 'rgba(0,0,0,0.9)';
    context.strokeText(text, canvas.width / 2, canvas.height / 2);
  }

  context.fillStyle = new THREE.Color(colorHex).getStyle();
  context.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const spriteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: transparent, depthTest: false });
  return new THREE.Sprite(spriteMaterial);
}

function processScientificData(radius) {
  maria.forEach(m => {
    const pos = latLonToVector3(m.lat, m.lon, radius * 1.01);
    const sprite = createTextSprite(m.name, "#6688ff", 32, false);
    sprite.scale.set(0.8, 0.2, 1);
    sprite.position.copy(pos);
    sprite.material.opacity = 0.5; 
    moonGroup.add(sprite);
  });

  roverPaths.forEach(r => {
    const points = r.path.map(p => latLonToVector3(p.lat, p.lon, radius * 1.005));
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({ color: new THREE.Color(r.color).getHex(), transparent: true, opacity: 0.9, linewidth: 2 });
    const line = new THREE.Line(geo, mat);
    line.userData = { year: r.year }; 
    roversGroup.add(line);
  });
}

// Generate Craters dynamically from JSON payload
function fetchCratersDataset(radius) {
  fetch("craters.json")
    .then(res => res.json())
    .then(data => {
      data.forEach((c, i) => {
        // Prevent overwhelming DOM if payload is massively large
        if (i > mobileConfig.craterLimit) return; 
        
        const pos = latLonToVector3(c.lat, c.lon, radius * 1.002);
        const geo = new THREE.SphereGeometry(0.005, 8, 8);
        const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(pos);
        moonGroup.add(mesh);

        const sprite = createTextSprite(c.name, "#ffffff", 24, true);
        sprite.scale.set(0.35, 0.0875, 1);
        sprite.position.copy(pos);
        sprite.position.multiplyScalar(1.02); 
        sprite.material.opacity = 0;
        moonGroup.add(sprite);
        craterSpritesList.push(sprite);
      });
    }).catch(err => console.log("Failed to load craters:", err));
}

function createMarker(m, radius) {
  const markerRadius = radius * 1.02;
  const pos = latLonToVector3(m.lat, m.lon, markerRadius);
  
  const group = new THREE.Group();
  group.position.copy(pos);
  group.userData = { mission: m }; 
  group.scale.setScalar(1);

  const geo = isMobile
    ? new THREE.IcosahedronGeometry(0.012, 0)
    : new THREE.SphereGeometry(0.012, 16, 16); 
  const coreMat = new THREE.MeshStandardMaterial({
    color: m.color,
    emissive: m.color,
    emissiveIntensity: 0.8,
    roughness: 0.3,
    metalness: 0.2,
    depthWrite: false
  });
  const coreMesh = new THREE.Mesh(geo, coreMat);
  coreMesh.userData = { 
    name: m.name, 
    mission: m, 
    type: 'marker', 
    baseColorHex: new THREE.Color(m.color).getHex(),
    targetEmissiveIntensity: 0.6
  };
  group.add(coreMesh);

  // Invisible larger hit-area mesh for easier touch tapping
  const invisibleMaterial = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false
  });
  const raycastGeo = new THREE.SphereGeometry(0.05, 8, 8);
  const raycastMesh = new THREE.Mesh(raycastGeo, invisibleMaterial);
  raycastMesh.userData = coreMesh.userData;
  group.add(raycastMesh);
  markerMeshes.push(raycastMesh);

  const glowGeo = isMobile
    ? new THREE.IcosahedronGeometry(0.02, 0)
    : new THREE.SphereGeometry(0.02, 16, 16);
  const glowMat = new THREE.MeshBasicMaterial({ 
    color: m.color, 
    transparent: true, 
    opacity: 0.25,
    depthWrite: false
  });
  const glowMesh = new THREE.Mesh(glowGeo, glowMat);
  group.add(glowMesh);

  markers.push({
    group,
    core: coreMesh,
    hitMesh: raycastMesh,
    glow: glowMesh,
    baseColorHex: new THREE.Color(m.color).getHex(),
    timeOffset: Math.random() * Math.PI * 2
  });

  return group;
}

// ── Load Moon GLB ────────────────────────────────────────────────
const loader = new GLTFLoader();
loader.load('./models/moon.glb', (gltf) => {
  globalMoonSurface = gltf.scene;

  globalMoonSurface.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
      if (!moonMaterial) moonMaterial = child.material;
    }
  });

  const box = new THREE.Box3().setFromObject(globalMoonSurface);
  const center = box.getCenter(new THREE.Vector3());
  globalMoonSurface.position.sub(center);

  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const desiredScale = 3 / maxDim;
  globalMoonSurface.scale.setScalar(desiredScale);

  moonGroup.add(globalMoonSurface);
  moonGroup.add(gridGroup);
  moonGroup.add(roversGroup);

  const scaledBox = new THREE.Box3().setFromObject(globalMoonSurface);
  moonRadius = scaledBox.getSize(new THREE.Vector3()).x / 2;

  createGrid(moonRadius);
  processScientificData(moonRadius);
  fetchCratersDataset(moonRadius);

  // Load missions from external JSON
  fetch('data/missions.json')
    .then(res => res.json())
    .then(loadedMissions => {
      missions = loadedMissions;
      missions.forEach((m) => {
        moonGroup.add(createMarker(m, moonRadius));
      });
      updateVisibleMissions();
      
      // Mark Moon as loaded and check if scene is ready
      moonGLBLoaded = true;
      checkSceneReady();
    })
    .catch(err => console.error('Failed to load missions:', err));

}, undefined, (err) => {
  console.error('Failed to load Moon model:', err);
});

// ── State Updates & Interaction Bindings ─────────────────────────
function updateVisibleMissions() {
  markers.forEach(m => {
    const isOrgValid = activeFilter === 'ALL' || m.group.userData.mission.org === activeFilter;
    if (isOrgValid) {
      m.group.visible = true;
    } else {
      m.group.visible = false;
    }
  });

  roversGroup.children.forEach(r => {
    r.visible = true;
  });

  if (selectedMarker && !selectedMarker.parent.visible) resumeOrbit();
  if (hoveredMarkerObj && !hoveredMarkerObj.parent.visible) clearHover();
}

filterButtons.forEach(btn => {
  btn.addEventListener('click', (e) => {
    filterButtons.forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    activeFilter = e.target.getAttribute('data-org');
    updateVisibleMissions();
  });
});

function clearHover() {
  if (hoveredMarkerObj) {
    if (hoveredMarkerObj !== selectedMarker) {
      hoveredMarkerObj.scale.setScalar(1);
    }
    hoveredMarkerObj = null;
    tooltip.classList.remove('visible');
    document.body.style.cursor = 'default';
  }
}

function clearSelection() {
  if (selectedMarker) {
    selectedMarker.scale.setScalar(1);
    const dataRef = markers.find(m => m.core === selectedMarker || m.hitMesh === selectedMarker);
    if (dataRef) {
      if (dataRef.core.userData) dataRef.core.userData.targetEmissiveIntensity = 0.6;
    }
    
    document.getElementById("infoPanel").style.display = "none";
    selectedMarker = null;
  }
}

function resumeOrbit() {
  if (!isPaused) return;

  isPaused = false;
  clearSelection();
  resumeBtn.classList.remove('visible');

  // Fade lights back to full
  if (window.gsap) {
    gsap.to(sunLight, { intensity: 2.0, duration: 1.0 });
    
    gsap.killTweensOf(controls.target);
    gsap.killTweensOf(camera.position);

    gsap.to(camera.position, {
      duration: 1.5,
      x: defaultCameraPos.x,
      y: defaultCameraPos.y,
      z: defaultCameraPos.z,
      ease: "power2.inOut",
      onComplete: () => {
        controls.enabled = true;
      }
    });

    gsap.to(controls.target, {
      duration: 1.5,
      x: defaultTargetPos.x,
      y: defaultTargetPos.y,
      z: defaultTargetPos.z,
      ease: "power2.inOut",
      onUpdate: () => controls.update()
    });
  } else {
    sunLight.intensity = 2.0;
    camera.position.copy(defaultCameraPos);
    controls.target.copy(defaultTargetPos);
    controls.update();
  }
}

resumeBtn.addEventListener('click', resumeOrbit);
window.addEventListener('dblclick', resumeOrbit);

// ── Touch Support ────────────────────────────────────────────────
if (isMobile) {
  // Double-tap to resume orbit
  let lastTapTime = 0;
  renderer.domElement.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTapTime < 300) {
      resumeOrbit();
    }
    lastTapTime = now;
  });

  // Touch-based click for markers
  renderer.domElement.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    mouse.x = (touch.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1;
  }, { passive: true });
}

window.addEventListener('mousemove', (e) => {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

  if (tooltip.classList.contains('visible')) {
    tooltip.style.left = e.clientX + 'px';
    tooltip.style.top = (e.clientY - 30) + 'px';
  }
});

// ── Auto-detect local mission images by naming convention ────────
function getMissionImages(missionName) {
  const base = missionName
    .replace(/\s+/g, '_')
    .replace(/'/g, '')
    .replace(/-/g, '_')
    .toLowerCase();

  const suffixes = ['a', 'b', 'c', 'd', 'e', 'f'];
  return suffixes.map(s => `images/${base}${s}.jpg`);
}

// ── Advanced Image Viewer State ─────────────────────────────────
let currentImages = [];
let currentIndex = 0;
let slideshowInterval = null;

function showNextImage() {
  if (currentImages.length === 0) return;
  currentIndex = (currentIndex + 1) % currentImages.length;
  updateMainImage();
}

function showPrevImage() {
  if (currentImages.length === 0) return;
  currentIndex = (currentIndex - 1 + currentImages.length) % currentImages.length;
  updateMainImage();
}

function updateMainImage() {
  const imgEl = document.getElementById("missionImage");
  imgEl.src = currentImages[currentIndex];
  imgEl.onerror = () => {
    imgEl.src = "images/default.jpg";
    imgEl.onerror = null;
  };
  // Update gallery active state
  const gallery = document.getElementById("imageGallery");
  gallery.querySelectorAll(".gallery-thumb").forEach((t, i) => {
    t.classList.toggle("active", i === currentIndex);
  });
  // Update fullscreen if open
  const viewer = document.getElementById("fullscreenViewer");
  if (viewer.style.display === "flex") {
    document.getElementById("fullscreenImg").src = currentImages[currentIndex];
    document.getElementById("fsCounter").textContent = `${currentIndex + 1} / ${currentImages.length}`;
  }
}

// ── Swipe support on main image ─────────────────────────────────
{
  const imgEl = document.getElementById("missionImage");
  let swipeStartX = 0;
  imgEl.addEventListener("touchstart", (e) => {
    swipeStartX = e.touches[0].clientX;
  }, { passive: true });
  imgEl.addEventListener("touchend", (e) => {
    const endX = e.changedTouches[0].clientX;
    const diff = endX - swipeStartX;
    if (diff > 50) showPrevImage();
    else if (diff < -50) showNextImage();
  });
}

// ── Fullscreen Viewer ───────────────────────────────────────────
{
  const viewer = document.getElementById("fullscreenViewer");
  const fullImg = document.getElementById("fullscreenImg");
  const imgEl = document.getElementById("missionImage");

  // Click main image → open fullscreen
  imgEl.addEventListener("click", (e) => {
    e.stopPropagation();
    if (currentImages.length === 0) return;
    fullImg.src = currentImages[currentIndex];
    document.getElementById("fsCounter").textContent = `${currentIndex + 1} / ${currentImages.length}`;
    viewer.style.display = "flex";
  });

  // Fullscreen swipe
  let fsSwipeX = 0;
  fullImg.addEventListener("touchstart", (e) => {
    fsSwipeX = e.touches[0].clientX;
  }, { passive: true });
  fullImg.addEventListener("touchend", (e) => {
    const diff = e.changedTouches[0].clientX - fsSwipeX;
    if (diff > 50) showPrevImage();
    else if (diff < -50) showNextImage();
  });

  // Nav buttons
  document.getElementById("fsNext").addEventListener("click", (e) => { e.stopPropagation(); showNextImage(); });
  document.getElementById("fsPrev").addEventListener("click", (e) => { e.stopPropagation(); showPrevImage(); });

  // Close
  document.getElementById("fsClose").addEventListener("click", (e) => { e.stopPropagation(); viewer.style.display = "none"; });
  viewer.addEventListener("click", () => { viewer.style.display = "none"; });

  // Keyboard nav in fullscreen
  window.addEventListener("keydown", (e) => {
    if (viewer.style.display !== "flex") return;
    if (e.key === "ArrowRight") showNextImage();
    else if (e.key === "ArrowLeft") showPrevImage();
    else if (e.key === "Escape") viewer.style.display = "none";
  });
}

// ── Slideshow Toggle ────────────────────────────────────────────
{
  const btn = document.getElementById("slideshowBtn");
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (slideshowInterval) {
      clearInterval(slideshowInterval);
      slideshowInterval = null;
      btn.textContent = "▶ Slide";
      btn.classList.remove("playing");
    } else {
      if (currentImages.length <= 1) return;
      btn.textContent = "⏹ Stop";
      btn.classList.add("playing");
      slideshowInterval = setInterval(() => {
        showNextImage();
      }, 2000);
    }
  });
}

function showMissionInfo(marker) {
  const data = marker.userData.mission;
  document.getElementById("missionName").innerText = data.name;
  document.getElementById("missionAgency").innerText = data.agency_full || (data.org + " | " + data.year);
  document.getElementById("missionCoords").innerText = "Lat: " + data.lat + "°, Lon: " + data.lon + "°";
  document.getElementById("missionDesc").innerText = data.description;

  // New extended fields
  document.getElementById("missionType").innerText = data.type || "—";
  document.getElementById("missionYear").innerText = data.year || "—";
  document.getElementById("missionDuration").innerText = data.duration || "—";
  document.getElementById("missionAchievement").innerText = data.achievement || "—";

  // Status with color badge
  const statusEl = document.getElementById("missionStatus");
  const status = (data.status || "Unknown").toLowerCase();
  statusEl.innerHTML = `<span class="status-badge status-${status}">${data.status || "Unknown"}</span>`;

  // Stop any running slideshow
  if (slideshowInterval) {
    clearInterval(slideshowInterval);
    slideshowInterval = null;
    const ssBtn = document.getElementById("slideshowBtn");
    ssBtn.textContent = "▶ Slide";
    ssBtn.classList.remove("playing");
  }

  // ── Build validated image list ────────────────────────────────
  const imgEl = document.getElementById("missionImage");
  const gallery = document.getElementById("imageGallery");

  // Keep the slideshow button, clear thumbs
  const slideshowBtnEl = document.getElementById("slideshowBtn");
  gallery.innerHTML = "";
  gallery.appendChild(slideshowBtnEl);

  imgEl.style.display = "block";
  currentImages = [];
  currentIndex = 0;

  const localCandidates = getMissionImages(data.name);
  let loadedCount = 0;
  let totalChecked = 0;
  const totalCandidates = localCandidates.length + (data.image ? 1 : 0);

  function onAllChecked() {
    if (currentImages.length === 0) {
      currentImages = ["images/default.jpg"];
    }
    imgEl.src = currentImages[0];
    imgEl.onerror = () => { imgEl.src = "images/default.jpg"; imgEl.onerror = null; };

    // Auto-start slideshow if multiple images
    if (currentImages.length > 1) {
      slideshowInterval = setInterval(() => {
        showNextImage();
      }, 2500);
      slideshowBtnEl.textContent = "⏹ Stop";
      slideshowBtnEl.classList.add("playing");
    }
  }

  // Probe each local image
  localCandidates.forEach((src, i) => {
    const probe = new Image();
    probe.onload = () => {
      currentImages.push(src);
      // Add thumbnail
      const thumb = document.createElement("img");
      thumb.src = src;
      thumb.className = "gallery-thumb";
      thumb.onclick = () => {
        currentIndex = currentImages.indexOf(src);
        updateMainImage();
        // Pause slideshow on manual pick
        if (slideshowInterval) {
          clearInterval(slideshowInterval);
          slideshowInterval = null;
          slideshowBtnEl.textContent = "▶ Slide";
          slideshowBtnEl.classList.remove("playing");
        }
      };
      gallery.insertBefore(thumb, slideshowBtnEl);
      totalChecked++;
      if (totalChecked === totalCandidates) onAllChecked();
    };
    probe.onerror = () => {
      totalChecked++;
      if (totalChecked === totalCandidates) onAllChecked();
    };
    probe.src = src;
  });

  // Also probe remote URL
  if (data.image && data.image.startsWith("http")) {
    const remoteProbe = new Image();
    remoteProbe.onload = () => {
      currentImages.push(data.image);
      const thumb = document.createElement("img");
      thumb.src = data.image;
      thumb.className = "gallery-thumb";
      thumb.title = "Online source";
      thumb.onclick = () => {
        currentIndex = currentImages.indexOf(data.image);
        updateMainImage();
        if (slideshowInterval) {
          clearInterval(slideshowInterval);
          slideshowInterval = null;
          slideshowBtnEl.textContent = "▶ Slide";
          slideshowBtnEl.classList.remove("playing");
        }
      };
      gallery.insertBefore(thumb, slideshowBtnEl);
      totalChecked++;
      if (totalChecked === totalCandidates) onAllChecked();
    };
    remoteProbe.onerror = () => {
      totalChecked++;
      if (totalChecked === totalCandidates) onAllChecked();
    };
    remoteProbe.src = data.image;
  }

  // Pause slideshow on user touch/click on main image
  imgEl.addEventListener("touchstart", function pauseSlide() {
    if (slideshowInterval) {
      clearInterval(slideshowInterval);
      slideshowInterval = null;
      slideshowBtnEl.textContent = "▶ Slide";
      slideshowBtnEl.classList.remove("playing");
    }
    imgEl.removeEventListener("touchstart", pauseSlide);
  }, { passive: true });

  // ── Enhanced Lighting Status (Day / Terminator / Night) ───────
  const markerWorldPos = marker.getWorldPosition(new THREE.Vector3());
  const moonWorldPos = moonGroup.position;
  const normal = markerWorldPos.clone().sub(moonWorldPos).normalize();
  const sunDir = sunLight.position.clone().normalize();
  
  const dot = normal.dot(sunDir);
  let lightLabel, lightClass;
  if (dot > 0.2) {
    lightLabel = "☀️ Daylight";
    lightClass = "light-day";
    document.getElementById("missionLight").innerText = "🌕 Daytime";
  } else if (dot > -0.2) {
    lightLabel = "🌗 Terminator";
    lightClass = "light-terminator";
    document.getElementById("missionLight").innerText = "🌗 Twilight";
  } else {
    lightLabel = "🌑 Night";
    lightClass = "light-night";
    document.getElementById("missionLight").innerText = "🌑 Night";
  }

  const lightingEl = document.getElementById("lightingStatus");
  lightingEl.innerHTML = `<span class="lighting-badge ${lightClass}">${lightLabel}</span>`;

  // Emissive highlight state handled by click handler and animate loop
  // (smooth transition between selected (1.5) and unselected (0.6))

  // Distance Calc (Static for Pause)
  const earthWorldPos = earth.getWorldPosition(new THREE.Vector3());
  const distance = moonWorldPos.distanceTo(earthWorldPos); 
  const scaledDistance = Math.round(distance * 100000);
  document.getElementById("missionDistance").innerText = "📡 " + scaledDistance + " km";

  document.getElementById("infoPanel").style.display = "block";
}

function handleRaycast(clientX, clientY, eventTarget) {
  if (eventTarget.id === 'resume-orbit-btn') return;
  if (eventTarget.classList && eventTarget.classList.contains('filter-btn')) return;
  if (eventTarget.closest && eventTarget.closest('#fullscreenViewer')) return;
  if (eventTarget.closest && eventTarget.closest('#infoPanel')) return;
  if (eventTarget.closest && eventTarget.closest('#perf-mode-btn')) return;
  if (eventTarget.closest && eventTarget.closest('#timelineBtn')) return;

  mouse.x = (clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  const visibleMeshes = markerMeshes.filter(m => m.parent.visible);
  const intersectsMarkers = raycaster.intersectObjects(visibleMeshes, true);
  const intersectsMoon = globalMoonSurface ? raycaster.intersectObject(globalMoonSurface, true) : [];

  if (intersectsMarkers.length > 0) {
    const marker = intersectsMarkers[0].object;
    console.log("Clicked marker:", marker.userData.name, marker);

    if (selectedMarker && selectedMarker !== marker) clearSelection();
    selectedMarker = marker;
    isPaused = true; 

    // Set all markers to default target intensity
    markers.forEach(m => {
      if (m.core.userData) m.core.userData.targetEmissiveIntensity = 0.6;
    });

    resumeBtn.classList.add('visible');
    if (window.gsap) gsap.to(sunLight, { intensity: 1.0, duration: 1.0 });

    const dataRef = markers.find(m => m.core === selectedMarker || m.hitMesh === selectedMarker);
    if (dataRef) {
      if (dataRef.core.userData) dataRef.core.userData.targetEmissiveIntensity = 1.5;
    }

    focusOnMarker(marker);
    showMissionInfo(marker);

  } else if (intersectsMoon.length > 0 && intersectsMarkers.length === 0) {
    if (!isPaused) {
      isPaused = true;
      resumeBtn.classList.add('visible');
      if (window.gsap) gsap.to(sunLight, { intensity: 1.0, duration: 1.0 });
      clearSelection();
    }
  }
}

window.addEventListener('click', (event) => {
  handleRaycast(event.clientX, event.clientY, event.target);
});

window.addEventListener("touchstart", (event) => {
  if (event.touches.length > 0) {
    const touch = event.touches[0];
    handleRaycast(touch.clientX, touch.clientY, event.target);
  }
}, { passive: false });

function focusOnMarker(marker) {
  controls.enabled = false;

  const worldPos = new THREE.Vector3();
  marker.getWorldPosition(worldPos);

  const moonPos = moonGroup.position;
  const direction = worldPos.clone().sub(moonPos).normalize();
  const distance = 2.5; 
  const cameraTargetPos = moonPos.clone().add(direction.multiplyScalar(distance));

  if (window.gsap) {
    gsap.killTweensOf(camera.position);
    gsap.killTweensOf(controls.target);

    gsap.to(camera.position, {
      duration: 1.5,
      x: cameraTargetPos.x,
      y: cameraTargetPos.y,
      z: cameraTargetPos.z,
      ease: "power2.out",
      onComplete: () => {
        controls.enabled = true;
      }
    });

    controls.target.copy(worldPos);
    
    gsap.to(controls.target, {
      duration: 1.5,
      x: worldPos.x,
      y: worldPos.y,
      z: worldPos.z,
      ease: "power2.out",
      onUpdate: () => controls.update()
    });
  } else {
    camera.position.copy(cameraTargetPos);
    controls.target.copy(worldPos);
    controls.update();
    controls.enabled = true;
  }
}

window.addEventListener('keydown', (e) => {
  const key = e.key;
  if (key.toLowerCase() === 'g') {
    gridGroup.visible = !gridGroup.visible;
  }
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ── Performance Mode Toggle Logic ────────────────────────────────
const perfToggleBtn = document.getElementById('perf-mode-btn');
const fpsCounter = document.getElementById('fps-counter');
let lastFpsTime = performance.now();
let fpsFrames = 0;

function applyPerformanceMode(enabled) {
  performanceMode = enabled;
  renderer.shadowMap.enabled = !enabled;
  gridGroup.visible = !enabled;
  if (starfieldMesh) starfieldMesh.material.opacity = enabled ? 0.3 : 0.6;
  markers.forEach(m => { m.glow.visible = !enabled; });
  craterSpritesList.forEach(s => { if (enabled) { s.visible = false; s.material.opacity = 0; } });
  if (fpsCounter) fpsCounter.style.display = enabled ? 'block' : 'none';
  if (perfToggleBtn) {
    perfToggleBtn.textContent = enabled ? '⚡ Perf: ON' : '⚡ Perf: OFF';
    perfToggleBtn.classList.toggle('active', enabled);
  }
}

if (perfToggleBtn) {
  perfToggleBtn.addEventListener('click', () => {
    applyPerformanceMode(!performanceMode);
  });
}

// Auto-enable perf mode on mobile after load
if (isMobile) {
  window.addEventListener('load', () => applyPerformanceMode(true));
}

// ── Loading Screen & Hero Section UI ────────────────────────────
const loadingScreen = document.getElementById('loadingScreen');
const heroSection = document.getElementById('heroSection');
const enterExperienceBtn = document.getElementById('enterExperienceBtn');
const loadingText = document.getElementById('loadingText');

let sceneReady = false;
let moonGLBLoaded = false;

const loadingMessages = [
  "Initializing Lunar Systems...",
  "Loading Moon Surface...",
  "Mapping Apollo Missions...",
  "Preparing Interactive Atlas..."
];

let currentMessageIndex = 0;
let messageChangeTime = 0;

function updateLoadingMessage() {
  const now = Date.now();
  if (now - messageChangeTime > 1200) {
    currentMessageIndex = (currentMessageIndex + 1) % loadingMessages.length;
    loadingText.textContent = loadingMessages[currentMessageIndex];
    messageChangeTime = now;
  }
}

function hideLoadingScreen() {
  if (loadingScreen && !loadingScreen.classList.contains('hidden')) {
    loadingScreen.classList.add('hidden');
    sceneReady = true;
  }
}

// Enter Experience button handler
if (enterExperienceBtn) {
  enterExperienceBtn.addEventListener('click', () => {
    if (heroSection) {
      heroSection.classList.add('hidden');
    }
  });
}

// Hide loading screen when all systems are ready
function checkSceneReady() {
  if (globalMoonSurface && moonGLBLoaded && !sceneReady) {
    // Give 800ms for final renders
    setTimeout(hideLoadingScreen, 800);
  }
}

// ── Render Loop ──────────────────────────────────────────────────
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  frame++;
  frameCount++;

  // Update loading screen messages if not yet hidden
  if (!sceneReady) {
    updateLoadingMessage();
  }

  // Mobile animation throttle: skip every other frame to reduce GPU load
  if (isMobile && frame % 2 === 0) {
    return;
  }

  const time = clock.getElapsedTime();

  // FPS counter (performance mode)
  if (performanceMode && fpsCounter) {
    fpsFrames++;
    const now = performance.now();
    if (now - lastFpsTime >= 1000) {
      fpsCounter.textContent = `${fpsFrames} FPS`;
      fpsFrames = 0;
      lastFpsTime = now;
    }
  }

  // 1. Earth Orbit System
  if (!isPaused) {
    orbitAngle += 0.002;
    moonGroup.position.set(
      earthPos.x + Math.cos(orbitAngle) * moonOrbitRadius,
      earthPos.y, 
      earthPos.z + Math.sin(orbitAngle) * moonOrbitRadius
    );
    
    moonGroup.lookAt(earthPos);
    earth.rotation.y += 0.001;
    if (clouds) clouds.rotation.y += 0.0015;
  }

  // 2. Realtime Eclipse Calculation & Earth/Moon Distance Signalling
  const earthToSunDir = sunLight.position.clone().normalize();
  const earthToMoonDir = moonGroup.position.clone().sub(earthPos).normalize();
  const alignment = earthToMoonDir.dot(earthToSunDir);
  
  if (alignment < -0.98) {
    eclipseDisplayEl.innerText = "Eclipse: Lunar 🔴";
    eclipseDisplayEl.style.color = "#ff4444";
    if (moonMaterial) moonMaterial.color.setHex(0x552222);
  } else if (alignment > 0.98) {
    eclipseDisplayEl.innerText = "Eclipse: Solar 🌑";
    eclipseDisplayEl.style.color = "#ffaa00";
    if (moonMaterial) moonMaterial.color.setHex(0xffffff);
    earthMaterial.color.setHex(0xaaaaaa);
  } else {
    eclipseDisplayEl.innerText = "Eclipse: None";
    eclipseDisplayEl.style.color = "#888888";
    if (moonMaterial) moonMaterial.color.setHex(0xffffff);
    earthMaterial.color.setHex(0xffffff);
  }

  // Distance computation
  const distUnits = moonGroup.position.distanceTo(earthPos);
  const signalDelay = ((distUnits * 100000) / 300000).toFixed(2);
  signalDisplayEl.innerText = `Signal Delay: ${signalDelay}s`;

  // Phase computation
  let phaseAngle = orbitAngle % (2 * Math.PI);
  if (phaseAngle < 0) phaseAngle += 2 * Math.PI;

  let phaseText = "New Moon";
  if (phaseAngle > Math.PI * 0.25 && phaseAngle < Math.PI * 0.75) phaseText = "First Quarter";
  else if (phaseAngle >= Math.PI * 0.75 && phaseAngle <= Math.PI * 1.25) phaseText = "Full Moon";
  else if (phaseAngle > Math.PI * 1.25 && phaseAngle < Math.PI * 1.75) phaseText = "Last Quarter";
  phaseDisplayEl.innerText = `Phase: ${phaseText}`;

  // 3. Smart Dynamic Craters LOD Rendering (skip in perf mode)
  if (!performanceMode) {
    const camDistToMoon = camera.position.distanceTo(moonGroup.position);
    craterSpritesList.forEach(sprite => {
      if (camDistToMoon < 4.0) {
        sprite.material.opacity = THREE.MathUtils.lerp(sprite.material.opacity, 1.0, 0.1);
        sprite.visible = true;
      } else if (camDistToMoon > 6.0) {
        sprite.material.opacity = THREE.MathUtils.lerp(sprite.material.opacity, 0.0, 0.1);
        if (sprite.material.opacity < 0.01) sprite.visible = false;
      }
    });
  }

  // 4. Hover Raycasting (only when touching on mobile, throttled every 3rd frame)
  const shouldRaycast = !isMobile || (userIsTouching && frameCount % 3 === 0);
  if (shouldRaycast) {
    if (!isMobile || userIsTouching) {
      raycaster.setFromCamera(mouse, camera);
    }
    const visibleMeshes = markerMeshes.filter(m => m.parent.visible);
    const intersects = raycaster.intersectObjects(visibleMeshes, true);

    if (intersects.length > 0) {
      const obj = intersects[0].object;
      if (hoveredMarkerObj !== obj && obj !== selectedMarker) {
        clearHover(); 
        hoveredMarkerObj = obj;
        
        hoveredMarkerObj.scale.setScalar(1.5); 
        
        const mData = hoveredMarkerObj.userData.mission;
        tooltip.innerHTML = `<strong>${mData.name} (${mData.org})</strong><br><span style="color:#aaa;">Lat: ${mData.lat}°<br>Lon: ${mData.lon}°</span>`;
        if (!isMobile) tooltip.classList.add('visible');
      }
      document.body.style.cursor = 'pointer';
    } else {
      clearHover();
    }
  }

  // 5. Marker Interactions & Animations
  markers.forEach(m => {
    if (!m.group.visible) return;

    if (!performanceMode) {
      const pulse = 1 + 0.25 * Math.sin(time * 3 + m.timeOffset);
      m.glow.scale.setScalar(pulse);
    }
    
    if (selectedMarker) {
      const isSelected = (m.core === selectedMarker || m.hitMesh === selectedMarker);
      if (isSelected) {
        m.core.scale.setScalar(1.5);
        if (!performanceMode) m.glow.material.opacity = 0.6;
      } else {
        m.core.scale.setScalar(1.0);
        if (!performanceMode) m.glow.material.opacity = 0.1;
      }
    } else {
      const isHovered = (hoveredMarkerObj === m.core || hoveredMarkerObj === m.hitMesh);
      if (!isHovered) {
        m.core.scale.setScalar(1.0);
      }
      if (!performanceMode) m.glow.material.opacity = 0.25;
    }

    // Smooth lighting transition for emissiveIntensity
    if (m.core.material && m.core.userData && m.core.userData.targetEmissiveIntensity !== undefined) {
      const current = m.core.material.emissiveIntensity;
      const target = m.core.userData.targetEmissiveIntensity;
      m.core.material.emissiveIntensity += (target - current) * 0.1;
    }
  });

  controls.update(); 
  renderer.render(scene, camera);
}

animate();
