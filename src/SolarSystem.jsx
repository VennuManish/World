import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import STARFIELD_TEXTURE from "../node_modules/three-globe/example/img/night-sky.png?url";
import MOON_SURFACE_TEXTURE from "../node_modules/globe.gl/example/moon-landing-sites/lunar_surface.jpg?url";
import { GROUPS, calculateSatellite, fetchSatelliteRecords } from "./satelliteData.js";
const EARTH_SURFACE_TEXTURE = "/images/nasa-blue-marble-2048.jpg";

const BODIES = [
  { name: "Mercury", type: "Terrestrial planet", color: 0x9a8b7a, size: 0.2, orbit: 2.2, year: "88 Earth days", day: "58.6 Earth days", distance: "0.39 AU", description: "The smallest planet and the closest world to the Sun." },
  { name: "Venus", type: "Terrestrial planet", color: 0xe7b878, size: 0.32, orbit: 3.2, year: "225 Earth days", day: "243 Earth days", distance: "0.72 AU", description: "A bright, cloud-covered world with an exceptionally dense atmosphere." },
  { name: "Earth", type: "Terrestrial planet", color: 0x4b9de8, size: 0.34, orbit: 4.3, year: "365.25 days", day: "23 hours 56 minutes", distance: "1.00 AU", description: "Our home planet, and the only known world with life on its surface." },
  { name: "Mars", type: "Terrestrial planet", color: 0xd66c4c, size: 0.27, orbit: 5.5, year: "687 Earth days", day: "24 hours 37 minutes", distance: "1.52 AU", description: "A cold desert world with polar ice caps and the largest volcano in the solar system." },
  { name: "Jupiter", type: "Gas giant", color: 0xd6a77d, size: 0.82, orbit: 8, year: "11.86 Earth years", day: "9 hours 56 minutes", distance: "5.20 AU", description: "The largest planet, known for its immense storms and many moons." },
  { name: "Saturn", type: "Gas giant", color: 0xd9c38a, size: 0.69, orbit: 10.8, year: "29.45 Earth years", day: "10 hours 42 minutes", distance: "9.58 AU", description: "A gas giant surrounded by a spectacular system of icy rings." },
  { name: "Uranus", type: "Ice giant", color: 0x8bd5d7, size: 0.49, orbit: 13.3, year: "84 Earth years", day: "17 hours 14 minutes", distance: "19.2 AU", description: "An ice giant that rotates on its side, giving it extreme seasons." },
  { name: "Neptune", type: "Ice giant", color: 0x527fe3, size: 0.47, orbit: 15.6, year: "164.8 Earth years", day: "16 hours 6 minutes", distance: "30.1 AU", description: "A distant, windy ice giant at the edge of the planetary system." }
];
const MOONS_BY_PLANET = {
  Earth: [
    { name: "Moon", period: 27.3217, orbitFactor: 2.2, color: 0xcbd5df }
  ],
  Mars: [
    { name: "Phobos", period: 0.3189, orbitFactor: 2.76, distanceKm: "9,376 km", diameterKm: "22.2 km", description: "The larger inner moon races around Mars in less than eight hours. Its orbit is slowly decaying, and it is expected to break apart or impact Mars in the distant future.", color: 0xb7a18f },
    { name: "Deimos", period: 1.263, orbitFactor: 6.92, distanceKm: "23,463 km", diameterKm: "12.4 km", description: "The smaller outer moon has a smooth, dusty appearance and moves slowly away from Mars over time.", color: 0xc7b4a1 }
  ],
  Jupiter: [
    { name: "Io", period: 1.769, orbitFactor: 1.7, color: 0xf0c45e },
    { name: "Europa", period: 3.551, orbitFactor: 2.05, color: 0xd8c8a5 },
    { name: "Ganymede", period: 7.155, orbitFactor: 2.5, color: 0x9d8c7d },
    { name: "Callisto", period: 16.689, orbitFactor: 3, color: 0x776b63 }
  ],
  Saturn: [
    { name: "Mimas", period: 0.942, orbitFactor: 1.65, color: 0xbac0bd },
    { name: "Enceladus", period: 1.37, orbitFactor: 1.9, color: 0xe5e7e5 },
    { name: "Tethys", period: 1.888, orbitFactor: 2.15, color: 0xcfd3d2 },
    { name: "Dione", period: 2.737, orbitFactor: 2.4, color: 0xb8b9b3 },
    { name: "Rhea", period: 4.518, orbitFactor: 2.7, color: 0xc5c2b8 },
    { name: "Titan", period: 15.945, orbitFactor: 3.1, color: 0xd49b50 },
    { name: "Iapetus", period: 79.321, orbitFactor: 3.55, color: 0x99908a }
  ],
  Uranus: [
    { name: "Miranda", period: 1.413, orbitFactor: 1.65, color: 0xb5c1bd },
    { name: "Ariel", period: 2.52, orbitFactor: 2, color: 0xc5c9bf },
    { name: "Umbriel", period: 4.144, orbitFactor: 2.35, color: 0x7b8180 },
    { name: "Titania", period: 8.706, orbitFactor: 2.75, color: 0xa9a69d },
    { name: "Oberon", period: 13.463, orbitFactor: 3.15, color: 0x8f8c87 }
  ],
  Neptune: [
    { name: "Triton", period: 5.877, orbitFactor: 2.15, color: 0xb8c2d2 },
    { name: "Proteus", period: 1.122, orbitFactor: 1.7, color: 0x777b82 }
  ]
};
const PLANET_IMAGES = {
  Mercury: [{
    src: "https://images-assets.nasa.gov/image/PIA12051/PIA12051~orig.jpg",
    title: "A Global View of Mercury Surface",
    credit: "NASA / Johns Hopkins APL / Smithsonian / Carnegie",
    id: "PIA12051"
  }],
  Venus: [{
    src: "https://images-assets.nasa.gov/image/PIA00007/PIA00007~medium.jpg",
    title: "Magellan radar view of Venus",
    credit: "NASA / JPL / USGS",
    id: "PIA00007"
  }, {
    src: "https://images-assets.nasa.gov/image/PIA00255/PIA00255~medium.jpg",
    title: "Magellan radar map of western Venus",
    credit: "NASA / JPL",
    id: "PIA00255"
  }],
  Earth: [{
    src: "https://images-assets.nasa.gov/image/as17-148-22727/as17-148-22727~medium.jpg",
    title: "Earth seen by the Apollo 17 crew",
    credit: "NASA / Johnson Space Center",
    id: "as17-148-22727"
  }, {
    src: "/images/nasa-blue-marble-2048.jpg",
    title: "Blue Marble global Earth",
    credit: "NASA Goddard Space Flight Center",
    id: "blue-marble"
  }],
  Mars: [{
    src: "https://images-assets.nasa.gov/image/PIA02653/PIA02653~medium.jpg",
    title: "Mars Daily Global Image",
    credit: "NASA / JPL / MSSS",
    id: "PIA02653"
  }, {
    src: "https://images-assets.nasa.gov/image/PIA03221/PIA03221~small.jpg",
    title: "Global view of Mars from Mars Odyssey",
    credit: "NASA / JPL",
    id: "PIA03221"
  }],
  Jupiter: [{
    src: "https://images-assets.nasa.gov/image/PIA20895/PIA20895~orig.jpg",
    title: "Jupiter's north polar region",
    credit: "NASA / JPL-Caltech / SwRI / MSSS",
    id: "PIA20895"
  }, {
    src: "https://images-assets.nasa.gov/image/PIA25726/PIA25726~large.jpg",
    title: "Jupiter and Io together",
    credit: "NASA / JPL-Caltech / SwRI / MSSS",
    id: "PIA25726"
  }],
  Saturn: [{
    src: "https://images-assets.nasa.gov/image/PIA06538/PIA06538~orig.jpg",
    title: "The Adventure Ahead",
    credit: "NASA / JPL / Space Science Institute",
    id: "PIA06538"
  }, {
    src: "https://images-assets.nasa.gov/image/PIA14858/PIA14858~small.jpg",
    title: "Enceladus geysers observed by Cassini",
    credit: "NASA / JPL-Caltech / Space Science Institute",
    id: "PIA14858"
  }],
  Uranus: [{
    src: "https://images-assets.nasa.gov/image/PIA01391/PIA01391~orig.jpg",
    title: "Uranus",
    credit: "NASA / JPL",
    id: "PIA01391"
  }, {
    src: "https://images-assets.nasa.gov/image/PIA01487/PIA01487~medium.jpg",
    title: "Uranus far-flung rings",
    credit: "NASA / JPL",
    id: "PIA01487"
  }],
  Neptune: [{
    src: "https://images-assets.nasa.gov/image/PIA02210/PIA02210~orig.jpg",
    title: "Neptune",
    credit: "NASA / JPL",
    id: "PIA02210"
  }, {
    src: "https://images-assets.nasa.gov/image/PIA01539/PIA01539~small.jpg",
    title: "Neptune's south pole",
    credit: "NASA / JPL",
    id: "PIA01539"
  }]
};
const MOON_IMAGES = {
  Phobos: [{
    src: "https://images-assets.nasa.gov/image/PIA22249/PIA22249~large.jpg",
    title: "Phobos thermal image",
    credit: "NASA / JPL-Caltech / ASU",
    id: "PIA22249"
  }],
  Deimos: [{
    src: "https://images-assets.nasa.gov/image/PIA12290/PIA12290~orig.jpg",
    title: "Deimos observed by Opportunity",
    credit: "NASA / JPL / Cornell / Texas A&M",
    id: "PIA12290"
  }, {
    src: "https://images-assets.nasa.gov/image/PIA05518/PIA05518~orig.jpg",
    title: "Deimos and Phobos eclipse the Sun",
    credit: "NASA / JPL / Cornell",
    id: "PIA05518"
  }]
};
const FEATURED_MOON_COUNT = Object.values(MOONS_BY_PLANET).reduce((count, moons) => count + moons.length, 0);
const SIMULATION_DAYS = 365;
const PLANET_DAY_MS = 86400000;
const MISSION_COLORS = {
  "Parker Solar Probe": "#ff8b5e",
  "Solar Orbiter": "#ffb86c",
  BepiColombo: "#d8c17b",
  MESSENGER: "#aebac8",
  Akatsuki: "#f08aa3",
  "Mars Reconnaissance Orbiter": "#ff806e",
  "Mars Odyssey": "#e9a16f",
  Juno: "#85c7ff",
  "Europa Clipper": "#b59aff",
  JUICE: "#70d5c8",
  Cassini: "#d8c17b",
  "Voyager 2": "#ffc978"
};
const PLANET_TEXTURE_PALETTES = {
  Mercury: ["#4b4946", "#77716b", "#aaa095", "#69635d"],
  Venus: ["#a8743f", "#d0a566", "#eed3a2", "#bd8d52"],
  Mars: ["#743a2d", "#a84f36", "#d2764d", "#e49b6d", "#563c35"],
  Jupiter: ["#9d684b", "#d6aa81", "#f0d4ab", "#ba8060", "#eee0c9"],
  Saturn: ["#a28257", "#dec998", "#f0e0b8", "#c5a775"],
  Uranus: ["#5cabb1", "#8bd5d7", "#b0e7e2", "#75c3c8"],
  Neptune: ["#153c85", "#2858ad", "#477bd0", "#6596e2"]
};

function NasaImageGallery({ images, label, alt }) {
  const [imageIndex, setImageIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const image = images[imageIndex];
  const sourceUrl = `https://images.nasa.gov/details/${image.id}`;

  return <figure className={`nasa-image-card${failed ? " image-failed" : ""}`}>
    {failed
      ? <a className="nasa-image-fallback" href={sourceUrl} target="_blank" rel="noreferrer">
        Image unavailable · open NASA archive
      </a>
      : <a className="nasa-image-link" href={sourceUrl} target="_blank" rel="noreferrer" aria-label={`Open ${image.title} in the NASA image archive`}>
        <img src={image.src} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(true)}/>
        <span className="nasa-image-open">OPEN IMAGE ↗</span>
      </a>}
    <figcaption>
      <span>{label} · {image.title}</span>
      <small>{image.credit}</small>
    </figcaption>
    {images.length > 1 && <div className="nasa-gallery-controls">
      <button type="button" onClick={() => { setFailed(false); setImageIndex(index => Math.max(0, index - 1)); }} disabled={imageIndex === 0} aria-label={`Previous ${label.toLowerCase()} image`}>←</button>
      <span>{String(imageIndex + 1).padStart(2, "0")} / {String(images.length).padStart(2, "0")}</span>
      <button type="button" onClick={() => { setFailed(false); setImageIndex(index => Math.min(images.length - 1, index + 1)); }} disabled={imageIndex === images.length - 1} aria-label={`Next ${label.toLowerCase()} image`}>→</button>
    </div>}
  </figure>;
}

function createCanvasTexture(canvas) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function createPlanetSurfaceTexture(body) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  if (!context) throw new Error(`Unable to create ${body.name} surface texture.`);
  const palette = PLANET_TEXTURE_PALETTES[body.name];
  if (!palette) throw new Error(`No procedural surface palette exists for ${body.name}.`);
  let seed = body.name.split("").reduce((value, character) => value + character.charCodeAt(0), 0);
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const gasGiant = ["Jupiter", "Saturn", "Uranus", "Neptune"].includes(body.name);
  if (gasGiant || body.name === "Venus") {
    for (let y = 0; y < canvas.height; y += 1) {
      const bands = y / (body.name === "Jupiter" ? 23 : 32) + Math.sin(y * 0.035) * 0.65;
      const color = palette[Math.floor(Math.abs(bands)) % palette.length];
      context.fillStyle = color;
      context.fillRect(0, y, canvas.width, 1);
    }
    for (let index = 0; index < 2600; index += 1) {
      const x = random() * canvas.width;
      const y = random() * canvas.height;
      context.fillStyle = palette[Math.floor(random() * palette.length)];
      context.globalAlpha = 0.04 + random() * 0.13;
      context.fillRect(x, y, 2 + random() * 60, 1 + random() * 3);
    }
    context.globalAlpha = 1;
    if (body.name === "Jupiter") {
      const storm = context.createRadialGradient(690, 318, 4, 690, 318, 72);
      storm.addColorStop(0, "#f1aa78");
      storm.addColorStop(0.65, "#c66d51");
      storm.addColorStop(1, "rgba(157, 83, 62, 0)");
      context.fillStyle = storm;
      context.beginPath();
      context.ellipse(690, 318, 78, 34, -0.08, 0, Math.PI * 2);
      context.fill();
    }
    if (body.name === "Neptune") {
      context.fillStyle = "rgba(12, 35, 81, 0.55)";
      context.beginPath();
      context.ellipse(330, 246, 56, 24, -0.16, 0, Math.PI * 2);
      context.fill();
    }
  } else {
    context.fillStyle = palette[1];
    context.fillRect(0, 0, canvas.width, canvas.height);
    for (let index = 0; index < 2200; index += 1) {
      const x = random() * canvas.width;
      const y = random() * canvas.height;
      const radius = 1 + random() * (body.name === "Mercury" ? 12 : 7);
      context.fillStyle = palette[Math.floor(random() * palette.length)];
      context.globalAlpha = 0.08 + random() * 0.24;
      context.beginPath();
      context.ellipse(x, y, radius, radius * (0.25 + random() * 0.2), 0, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = "rgba(24, 22, 21, 0.35)";
      context.lineWidth = 1;
      context.stroke();
    }
    if (body.name === "Mars") {
      context.globalAlpha = 0.7;
      context.fillStyle = "#e5bea0";
      context.fillRect(0, 0, canvas.width, 13);
      context.fillRect(0, canvas.height - 13, canvas.width, 13);
    }
    context.globalAlpha = 1;
  }
  return createCanvasTexture(canvas);
}

function createSunSurfaceTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Unable to create the Sun surface texture.");
  const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#ffdd82");
  gradient.addColorStop(0.45, "#ff9f38");
  gradient.addColorStop(1, "#ffcc67");
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
  for (let index = 0; index < 1600; index += 1) {
    const x = (index * 379) % canvas.width;
    const y = (index * 197) % canvas.height;
    context.fillStyle = index % 3 ? "rgba(255, 246, 183, 0.12)" : "rgba(194, 54, 18, 0.13)";
    context.beginPath();
    context.ellipse(x, y, 5 + (index % 16), 2 + (index % 8), 0, 0, Math.PI * 2);
    context.fill();
  }
  return createCanvasTexture(canvas);
}

function createSaturnRingTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Unable to create Saturn's ring texture.");
  for (let x = 0; x < canvas.width; x += 1) {
    const gap = (x > 130 && x < 155) || (x > 465 && x < 502) || (x > 748 && x < 762);
    const band = Math.sin(x * 0.14) * 0.12 + Math.sin(x * 0.037) * 0.16;
    const opacity = gap ? 0.08 : Math.max(0.25, 0.78 + band);
    context.fillStyle = `rgba(${205 + Math.floor(band * 45)}, ${181 + Math.floor(band * 30)}, ${135 + Math.floor(band * 24)}, ${opacity})`;
    context.fillRect(x, 0, 1, canvas.height);
  }
  return createCanvasTexture(canvas);
}

function createSunGlowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Unable to create the Sun's glow texture.");
  const gradient = context.createRadialGradient(128, 128, 24, 128, 128, 128);
  gradient.addColorStop(0, "rgba(255, 248, 206, 0.8)");
  gradient.addColorStop(0.28, "rgba(255, 185, 70, 0.5)");
  gradient.addColorStop(0.65, "rgba(255, 126, 32, 0.15)");
  gradient.addColorStop(1, "rgba(255, 96, 24, 0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
  return createCanvasTexture(canvas);
}

function createAtmosphereMaterial(color) {
  return new THREE.ShaderMaterial({
    uniforms: { glowColor: { value: new THREE.Color(color) } },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vViewPosition = -viewPosition.xyz;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 glowColor;
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      void main() {
        float rim = pow(1.0 - max(dot(normalize(vNormal), normalize(vViewPosition)), 0.0), 2.4);
        gl_FragColor = vec4(glowColor, rim * 0.72);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    depthWrite: false
  });
}

function interpolatePlanetPosition(body, dayOffset) {
  if (!body?.positions?.length) return null;
  const offset = THREE.MathUtils.clamp(dayOffset, 0, body.positions.length - 1);
  const index = Math.min(Math.floor(offset), body.positions.length - 2);
  const fraction = offset - index;
  const start = body.positions[index];
  const end = body.positions[index + 1];
  return {
    x: THREE.MathUtils.lerp(start.x, end.x, fraction),
    y: THREE.MathUtils.lerp(start.y, end.y, fraction),
    z: THREE.MathUtils.lerp(start.z, end.z, fraction)
  };
}

function createOrbit(radius, color = 0x52758d) {
  const points = Array.from({ length: 181 }, (_, index) => {
    const angle = (index / 180) * Math.PI * 2;
    return new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
  });
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.19 });
  return new THREE.LineLoop(geometry, material);
}

function getDisplayOrbitRadius(distanceAu) {
  const normalizedDistance = Math.max(distanceAu, 0.387);
  return 1.8 + Math.min(normalizedDistance * 2.8, 26);
}

function vectorToScenePosition(position) {
  const distanceAu = Math.hypot(position.x, position.y, position.z);
  const displayRadius = getDisplayOrbitRadius(distanceAu);
  return new THREE.Vector3(position.x, position.z, -position.y).normalize().multiplyScalar(displayRadius);
}

function spacecraftToScenePosition(mission, position, index, ephemeris) {
  if (mission.frame !== "planet") return vectorToScenePosition(position);
  const parent = ephemeris?.bodies.find(body => body.name === mission.target);
  const parentPosition = interpolatePlanetPosition(parent, index);
  if (!parentPosition) return null;
  return vectorToScenePosition(parentPosition).add(new THREE.Vector3(position.x, position.z, -position.y).multiplyScalar(1600));
}

function createLabelSprite(text, color = "#eaf4ff") {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Unable to create solar-system name label.");
  context.fillStyle = "rgba(3, 9, 20, 0.88)";
  context.fillRect(12, 26, 488, 76);
  context.strokeStyle = color;
  context.globalAlpha = 0.6;
  context.strokeRect(12, 26, 488, 76);
  context.globalAlpha = 1;
  context.fillStyle = color;
  context.font = "600 42px Arial, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, 256, 64, 460);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    toneMapped: false
  }));
  sprite.userData.ownedTexture = texture;
  sprite.scale.set(Math.min(3.2, Math.max(0.9, text.length * 0.16)), 0.4, 1);
  sprite.renderOrder = 10;
  return sprite;
}

export default function SolarSystem() {
  const host = useRef(null);
  const satelliteLayer = useRef(null);
  const satelliteRecords = useRef([]);
  const satelliteRecordsGroup = useRef("");
  const lastSatelliteRefreshRequest = useRef(0);
  const orbitControls = useRef(null);
  const bodyPlanets = useRef(new Map());
  const moonObjects = useRef([]);
  const planetFocused = useRef(false);
  const selectedBodyNameRef = useRef("Earth");
  const pendingPlanetFocus = useRef("");
  const spacecraftLayer = useRef(null);
  const spacecraftMarkers = useRef([]);
  const focusedBodyName = useRef("Earth");
  const focusedMoonName = useRef("");
  const solarCamera = useRef(null);
  const earthFocused = useRef(false);
  const focusedSpacecraftName = useRef("");
  const hoveredSpacecraftName = useRef("");
  const selectedSpacecraftName = useRef("");
  const planetEphemerisRef = useRef(null);
  const planetDayOffsetRef = useRef(0);
  const spacecraftDataRef = useRef(null);
  const [selectedName, setSelectedName] = useState("Earth");
  const [spacecraftData, setSpacecraftData] = useState(null);
  const [spacecraftError, setSpacecraftError] = useState("");
  const [isLoadingSpacecraft, setIsLoadingSpacecraft] = useState(true);
  const [spacecraftRefresh, setSpacecraftRefresh] = useState(0);
  const [selectedSpacecraft, setSelectedSpacecraft] = useState("");
  const [showNasaEyes, setShowNasaEyes] = useState(false);
  const [selectedMoonName, setSelectedMoonName] = useState("Moon");
  const [planetEphemeris, setPlanetEphemeris] = useState(null);
  const [planetDataError, setPlanetDataError] = useState("");
  const [isLoadingPlanetData, setIsLoadingPlanetData] = useState(true);
  const [planetRefresh, setPlanetRefresh] = useState(0);
  const [planetDayOffset, setPlanetDayOffset] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [simulationSpeed, setSimulationSpeed] = useState(1);
  const [satelliteGroup, setSatelliteGroup] = useState("active");
  const [satelliteStatus, setSatelliteStatus] = useState("Loading CelesTrak data…");
  const [satelliteError, setSatelliteError] = useState("");
  const [satelliteFormat, setSatelliteFormat] = useState("OMM");
  const [satelliteStale, setSatelliteStale] = useState(false);
  const [satelliteUpdatedAt, setSatelliteUpdatedAt] = useState(null);
  const [isLoadingSatellites, setIsLoadingSatellites] = useState(false);
  const [satelliteRefresh, setSatelliteRefresh] = useState(0);
  const [renderedSatelliteCount, setRenderedSatelliteCount] = useState(0);
  const selected = BODIES.find(body => body.name === selectedName) || BODIES[2];
  const selectedMoons = MOONS_BY_PLANET[selected.name] || [];
  const selectedMoon = selectedMoons.find(moon => moon.name === selectedMoonName) || null;
  const selectedMoonImage = MOON_IMAGES[selectedMoon?.name] || null;
  const targetMissions = spacecraftData?.missions || [];
  focusedBodyName.current = selectedName;

  useEffect(() => {
    const controller = new AbortController();
    setIsLoadingPlanetData(true);
    setPlanetDataError("");
    const params = new URLSearchParams();
    if (planetRefresh > 0) params.set("refresh", "true");
    const query = params.size ? `?${params}` : "";
    fetch(`/api/planet-positions${query}`, { signal: controller.signal })
      .then(async response => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.details || payload.error || `Planet data API error ${response.status}`);
        return payload;
      })
      .then(data => {
        if (controller.signal.aborted) return;
        if (!Array.isArray(data.bodies) || data.bodies.length !== BODIES.length) {
          throw new Error("JPL Horizons returned an incomplete set of planet positions.");
        }
        setPlanetEphemeris(data);
        setPlanetDayOffset(0);
        setIsPlaying(false);
      })
      .catch(error => {
        if (error.name !== "AbortError") setPlanetDataError(error.message || "Unable to load live planetary positions.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoadingPlanetData(false);
      });
    return () => controller.abort();
  }, [planetRefresh]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setPlanetRefresh(value => value + 1);
    }, 30 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoadingSpacecraft(true);
    setSpacecraftError("");
    const query = spacecraftRefresh > 0 ? "?refresh=true" : "";
    fetch(`/api/spacecraft-trajectories${query}`, { signal: controller.signal })
      .then(async response => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.details || payload.error || `Spacecraft data API error ${response.status}`);
        return payload;
      })
      .then(data => {
        if (controller.signal.aborted) return;
        if (!Array.isArray(data.missions) || !data.missions.length) {
          throw new Error("JPL Horizons returned no supported spacecraft trajectories.");
        }
        setSpacecraftData(data);
        setSelectedSpacecraft(current => data.missions.some(mission => mission.name === current) ? current : "");
      })
      .catch(error => {
        if (error.name !== "AbortError") setSpacecraftError(error.message || "Unable to load JPL spacecraft trajectories.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoadingSpacecraft(false);
      });
    return () => controller.abort();
  }, [spacecraftRefresh]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setSpacecraftRefresh(value => value + 1);
    }, 30 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    planetEphemerisRef.current = planetEphemeris;
    planetDayOffsetRef.current = planetDayOffset;
  }, [planetEphemeris, planetDayOffset]);

  useEffect(() => {
    spacecraftDataRef.current = spacecraftData;
  }, [spacecraftData]);

  useEffect(() => {
    selectedSpacecraftName.current = selectedSpacecraft;
  }, [selectedSpacecraft]);

  useEffect(() => {
    if (!isPlaying || !planetEphemeris) return undefined;
    let lastTick = performance.now();
    const interval = window.setInterval(() => {
      const now = performance.now();
      const elapsedSeconds = (now - lastTick) / 1000;
      lastTick = now;
      setPlanetDayOffset(current => {
        const next = current + elapsedSeconds * simulationSpeed;
        if (next >= SIMULATION_DAYS) setIsPlaying(false);
        return Math.min(next, SIMULATION_DAYS);
      });
    }, 100);
    return () => window.clearInterval(interval);
  }, [isPlaying, planetEphemeris, simulationSpeed]);

  useEffect(() => {
    const controller = new AbortController();
    const forceRefresh = lastSatelliteRefreshRequest.current !== satelliteRefresh;
    lastSatelliteRefreshRequest.current = satelliteRefresh;
    if (satelliteRecordsGroup.current !== satelliteGroup) {
      satelliteRecords.current = [];
      satelliteRecordsGroup.current = satelliteGroup;
      setRenderedSatelliteCount(0);
    }
    setIsLoadingSatellites(true);
    setSatelliteError("");
    setSatelliteStatus(satelliteRefresh ? "Refreshing CelesTrak data…" : "Loading CelesTrak data…");
    fetchSatelliteRecords(satelliteGroup, controller.signal, "celestrak", forceRefresh)
      .then(data => {
        if (controller.signal.aborted) return;
        satelliteRecords.current = data.satellites;
        setSatelliteFormat(data.format || "TLE");
        setSatelliteStale(Boolean(data.stale));
        setSatelliteError(data.stale ? data.warning || "Using saved satellite data; the latest provider refresh failed." : "");
        setSatelliteUpdatedAt(data.fetchedAt);
        setSatelliteStatus(data.stale
          ? `Using saved ${data.providerName} data`
          : `Loaded ${data.count.toLocaleString()} ${GROUPS.find(group => group.id === satelliteGroup)?.name || "satellites"} from ${data.providerName}`);
      })
      .catch(error => {
        if (error.name !== "AbortError") {
          setSatelliteError(error.message || "Unable to load CelesTrak data.");
          setSatelliteStatus("CelesTrak data unavailable");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoadingSatellites(false);
      });
    return () => controller.abort();
  }, [satelliteGroup, satelliteRefresh]);

  useEffect(() => {
    const refreshDelay = satelliteError || satelliteStale ? 5 * 60 * 1000 : 2 * 60 * 60 * 1000 + 60 * 1000;
    const timeout = window.setTimeout(() => setSatelliteRefresh(value => value + 1), refreshDelay);
    return () => window.clearTimeout(timeout);
  }, [satelliteError, satelliteStale]);

  useEffect(() => {
    if (showNasaEyes || !host.current) return undefined;

    const scene = new THREE.Scene();
    const ownedTextures = [];
    const textureLoader = new THREE.TextureLoader();
    const starfieldTexture = textureLoader.load(STARFIELD_TEXTURE);
    starfieldTexture.mapping = THREE.EquirectangularReflectionMapping;
    starfieldTexture.colorSpace = THREE.SRGBColorSpace;
    const earthTexture = textureLoader.load(EARTH_SURFACE_TEXTURE);
    earthTexture.colorSpace = THREE.SRGBColorSpace;
    earthTexture.anisotropy = 8;
    const moonTexture = textureLoader.load(MOON_SURFACE_TEXTURE);
    moonTexture.colorSpace = THREE.SRGBColorSpace;
    const sunTexture = createSunSurfaceTexture();
    const sunGlowTexture = createSunGlowTexture();
    const saturnRingTexture = createSaturnRingTexture();
    ownedTextures.push(starfieldTexture, earthTexture, moonTexture, sunTexture, sunGlowTexture, saturnRingTexture);
    scene.background = starfieldTexture;
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 180);
    camera.position.set(0, 15, 27);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    host.current.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    orbitControls.current = controls;
    solarCamera.current = camera;
    controls.enableDamping = true;
    controls.dampingFactor = 0.055;
    controls.minDistance = 1.3;
    controls.maxDistance = 60;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.target.set(0, 0, 0);

    scene.add(new THREE.AmbientLight(0x8799bb, 0.4));
    const sunlight = new THREE.PointLight(0xffe1a3, 180, 90, 1.35);
    sunlight.position.set(0, 0, 0);
    scene.add(sunlight);

    const rimLight = new THREE.DirectionalLight(0x89b3ff, 1.1);
    rimLight.position.set(-18, 14, 12);
    scene.add(rimLight);

    const sun = new THREE.Mesh(
      new THREE.SphereGeometry(1.08, 48, 48),
      new THREE.MeshBasicMaterial({ map: sunTexture, toneMapped: false })
    );
    scene.add(sun);
    const sunCorona = new THREE.Sprite(new THREE.SpriteMaterial({
      map: sunGlowTexture,
      color: 0xffb347,
      transparent: true,
      opacity: 0.82,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false
    }));
    sunCorona.scale.set(5.8, 5.8, 1);
    sunCorona.renderOrder = 1;
    scene.add(sunCorona);
    const sunLabel = createLabelSprite("Sun", "#ffd879");
    sunLabel.position.set(0, 1.45, 0);
    scene.add(sunLabel);
    const sunGlow = new THREE.Mesh(
      new THREE.SphereGeometry(1.3, 32, 32),
      new THREE.MeshBasicMaterial({
        color: 0xffa72b,
        transparent: true,
        opacity: 0.18,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        depthWrite: false,
        toneMapped: false
      })
    );
    scene.add(sunGlow);
    const planetaryOrbitLines = [];

    const starPositions = new Float32Array(3600);
    for (let index = 0; index < starPositions.length; index += 3) {
      starPositions[index] = (Math.random() - 0.5) * 100;
      starPositions[index + 1] = (Math.random() - 0.5) * 65;
      starPositions[index + 2] = (Math.random() - 0.5) * 100;
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    const stars = new THREE.Points(starGeometry, new THREE.PointsMaterial({
      color: 0xb7d5ee,
      size: 0.07,
      transparent: true,
      opacity: 0.78,
      sizeAttenuation: true
    }));
    scene.add(stars);
    const asteroidPositions = new Float32Array(1800 * 3);
    for (let index = 0; index < asteroidPositions.length; index += 3) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 6.15 + Math.random() * 1.2;
      asteroidPositions[index] = Math.cos(angle) * radius;
      asteroidPositions[index + 1] = (Math.random() - 0.5) * 0.2;
      asteroidPositions[index + 2] = Math.sin(angle) * radius;
    }
    const asteroidGeometry = new THREE.BufferGeometry();
    asteroidGeometry.setAttribute("position", new THREE.BufferAttribute(asteroidPositions, 3));
    const asteroidBelt = new THREE.Points(asteroidGeometry, new THREE.PointsMaterial({
      color: 0xd0ad88,
      size: 0.025,
      transparent: true,
      opacity: 0.76,
      sizeAttenuation: true,
      depthWrite: false
    }));
    scene.add(asteroidBelt);
    const missionLayer = new THREE.Group();
    missionLayer.name = "JPL spacecraft trajectories";
    scene.add(missionLayer);
    spacecraftLayer.current = missionLayer;

    const markerCanvas = document.createElement("canvas");
    markerCanvas.width = 32;
    markerCanvas.height = 32;
    const markerContext = markerCanvas.getContext("2d");
    if (!markerContext) throw new Error("Unable to create satellite marker texture.");
    const markerGradient = markerContext.createRadialGradient(16, 16, 1, 16, 16, 15);
    markerGradient.addColorStop(0, "rgba(255,255,255,1)");
    markerGradient.addColorStop(0.45, "rgba(255,255,255,0.95)");
    markerGradient.addColorStop(1, "rgba(255,255,255,0)");
    markerContext.fillStyle = markerGradient;
    markerContext.fillRect(0, 0, 32, 32);
    const markerTexture = new THREE.CanvasTexture(markerCanvas);

    const planets = BODIES.map((body, index) => {
      const planetaryOrbit = createOrbit(body.orbit, index % 2 ? 0x64758f : 0x4d8292);
      scene.add(planetaryOrbit);
      planetaryOrbitLines.push(planetaryOrbit);
      const pivot = new THREE.Group();
      scene.add(pivot);
      const surfaceTexture = body.name === "Earth" ? earthTexture : createPlanetSurfaceTexture(body);
      if (surfaceTexture !== earthTexture) ownedTextures.push(surfaceTexture);
      const planet = new THREE.Mesh(
        new THREE.SphereGeometry(body.size, 32, 32),
        new THREE.MeshStandardMaterial({
          color: 0xffffff,
          map: surfaceTexture,
          roughness: 0.9,
          metalness: 0,
          emissive: body.name === "Earth" ? 0x18324a : body.color,
          emissiveIntensity: body.name === "Earth" ? 0.025 : 0.018
        })
      );
      planet.userData.bodyName = body.name;
      planet.position.x = body.orbit;
      pivot.add(planet);
      const atmosphereColors = { Venus: 0xffc87c, Earth: 0x54b8ff, Mars: 0xff785d, Neptune: 0x4f8dff };
      if (atmosphereColors[body.name]) {
        const atmosphere = new THREE.Mesh(
          new THREE.SphereGeometry(body.size * 1.1, 32, 32),
          createAtmosphereMaterial(atmosphereColors[body.name])
        );
        planet.add(atmosphere);
      }
      const planetLabel = createLabelSprite(body.name);
      planetLabel.position.copy(planet.position);
      planetLabel.position.y += body.size + 0.32;
      pivot.add(planetLabel);
      bodyPlanets.current.set(body.name, planet);
      const bodyMoons = MOONS_BY_PLANET[body.name] || [];
      for (const [moonIndex, moon] of bodyMoons.entries()) {
        const orbitRadius = body.size * moon.orbitFactor;
        const orbitGroup = new THREE.Group();
        orbitGroup.position.copy(planet.position);
        orbitGroup.rotation.x = 0.16 + moonIndex * 0.11;
        orbitGroup.rotation.z = moonIndex % 2 ? 0.09 : -0.07;
        orbitGroup.add(createOrbit(orbitRadius, moon.color));
        pivot.add(orbitGroup);

        const moonMesh = new THREE.Mesh(
          new THREE.SphereGeometry(Math.max(0.055, body.size * 0.16), 16, 16),
          new THREE.MeshStandardMaterial({ color: moon.color, map: moonTexture, roughness: 0.96, emissive: moon.color, emissiveIntensity: 0.1 })
        );
        moonMesh.position.x = orbitRadius;
        moonMesh.userData.bodyName = body.name;
        moonMesh.userData.moonName = moon.name;
        orbitGroup.add(moonMesh);
        const moonLabel = createLabelSprite(moon.name, `#${moon.color.toString(16).padStart(6, "0")}`);
        moonLabel.position.set(orbitRadius, Math.max(0.12, body.size * 0.3), 0);
        moonLabel.visible = false;
        orbitGroup.add(moonLabel);
        moonObjects.current.push({
          bodyName: body.name,
          moon,
          orbitGroup,
          orbitLine: orbitGroup.children.find(child => child.isLineLoop),
          mesh: moonMesh,
          label: moonLabel,
          phase: moonIndex * 0.85
        });
      }

      if (body.name === "Earth") {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(2500 * 3), 3));
        geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(2500 * 3), 3));
        geometry.setDrawRange(0, 0);
        const markers = new THREE.Points(geometry, new THREE.PointsMaterial({
          map: markerTexture,
          size: 8,
          sizeAttenuation: false,
          vertexColors: true,
          transparent: true,
          alphaTest: 0.08,
          opacity: 1,
          depthWrite: false
        }));
        planet.add(markers);
        satelliteLayer.current = markers;
      }

      if (body.name === "Saturn") {
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(body.size * 1.2, body.size * 2.55, 128),
          new THREE.MeshBasicMaterial({
            map: saturnRingTexture,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.92,
            depthWrite: false
          })
        );
        ring.rotation.x = Math.PI / 2.35;
        planet.add(ring);
      }
      return { body, pivot, planet, planetLabel, speed: 0.035 / Math.sqrt(body.orbit) };
    });

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let pointerDownPosition = null;
    const onPointerDown = event => {
      if (event.button !== 0) return;
      pointerDownPosition = { x: event.clientX, y: event.clientY };
    };
    const onPointerUp = event => {
      if (!pointerDownPosition) return;
      const moved = Math.hypot(event.clientX - pointerDownPosition.x, event.clientY - pointerDownPosition.y);
      pointerDownPosition = null;
      if (moved > 5) return;
      const bounds = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        -((event.clientY - bounds.top) / bounds.height) * 2 + 1
      );
      raycaster.setFromCamera(pointer, camera);
      const missionHit = raycaster.intersectObjects(
        spacecraftMarkers.current.map(({ marker }) => marker).filter(marker => marker.visible),
        false
      )[0];
      if (missionHit) {
        const mission = spacecraftMarkers.current.find(({ marker }) => marker === missionHit.object)?.mission;
        if (mission) {
          setSelectedSpacecraft(mission.name);
          if (BODIES.some(body => body.name === mission.target)) {
            selectedBodyNameRef.current = mission.target;
            setSelectedName(mission.target);
          }
          focusedSpacecraftName.current = mission.name;
          focusedMoonName.current = "";
          planetFocused.current = false;
          earthFocused.current = false;
          controls.target.copy(missionHit.object.position);
          const viewDirection = camera.position.clone().sub(controls.target).normalize();
          camera.position.copy(controls.target).addScaledVector(viewDirection, 2.6);
          controls.update();
        }
        return;
      }
      const interactiveBodies = [
        ...planets.map(({ planet }) => planet),
        ...moonObjects.current.flatMap(({ orbitGroup }) => orbitGroup.children.filter(child => child.isMesh))
      ];
      const hit = raycaster.intersectObjects(interactiveBodies)[0];
      if (hit) {
        const { bodyName, moonName } = hit.object.userData;
        selectedBodyNameRef.current = bodyName;
        focusedMoonName.current = "";
        setSelectedName(bodyName);
        setSelectedMoonName(moonName || MOONS_BY_PLANET[bodyName]?.[0]?.name || "");
        setSelectedSpacecraft("");
        focusOnPlanet(bodyName);
      }
    };
    const onPointerMove = event => {
      const bounds = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        -((event.clientY - bounds.top) / bounds.height) * 2 + 1
      );
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(
        spacecraftMarkers.current.map(({ marker }) => marker).filter(marker => marker.visible),
        false
      )[0];
      hoveredSpacecraftName.current = hit?.object.userData.missionName || "";
      renderer.domElement.style.cursor = hit ? "pointer" : "grab";
    };
    const onPointerLeave = () => {
      hoveredSpacecraftName.current = "";
      renderer.domElement.style.cursor = "grab";
    };
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerleave", onPointerLeave);

    const resizeObserver = new ResizeObserver(() => {
      if (!host.current) return;
      const { width, height } = host.current.getBoundingClientRect();
      if (!width || !height) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    });
    resizeObserver.observe(host.current);

    let frameId;
    const animate = timestamp => {
      frameId = window.requestAnimationFrame(animate);
      const elapsed = timestamp / 1000;
      const focusedPlanetMode = planetFocused.current;
      const focusedPlanetName = focusedBodyName.current;
      sun.rotation.y = elapsed * 0.08;
      sunGlow.rotation.y = -elapsed * 0.045;
      asteroidBelt.rotation.y = elapsed * 0.0015;
      sun.visible = !focusedPlanetMode;
      sunCorona.visible = !focusedPlanetMode;
      sunLabel.visible = !focusedPlanetMode;
      sunGlow.visible = !focusedPlanetMode;
      asteroidBelt.visible = !focusedPlanetMode;
      planetaryOrbitLines.forEach(orbit => { orbit.visible = !focusedPlanetMode; });
      if (spacecraftLayer.current) spacecraftLayer.current.visible = !focusedPlanetMode;
      sunCorona.material.opacity = 0.76 + Math.sin(elapsed * 1.6) * 0.06;
      const liveEphemeris = planetEphemerisRef.current;
      const dayOffset = planetDayOffsetRef.current;
      planets.forEach(({ body, pivot, planet, planetLabel, speed }, index) => {
        const isFocusedPlanet = focusedPlanetMode && body.name === focusedPlanetName;
        pivot.visible = !focusedPlanetMode || isFocusedPlanet;
        planet.scale.setScalar(isFocusedPlanet ? 2.3 : 1);
        const bodyEphemeris = liveEphemeris?.bodies.find(candidate => candidate.name === body.name);
        const livePosition = interpolatePlanetPosition(bodyEphemeris, dayOffset);
        if (livePosition) {
          const distanceAu = Math.hypot(livePosition.x, livePosition.y, livePosition.z);
          const displayRadius = 1.8 + 3 * Math.log(Math.max(distanceAu, 0.387) / 0.387);
          planet.position.set(livePosition.x, livePosition.z, -livePosition.y).normalize().multiplyScalar(displayRadius);
          pivot.rotation.y = 0;
        } else {
          pivot.rotation.y = elapsed * speed + index * 0.7;
        }
        planetLabel.position.copy(planet.position);
        planetLabel.position.y += body.size * (isFocusedPlanet ? 2.3 : 1) + 0.32;
        planet.rotation.y += 0.003;
      });
      moonObjects.current.forEach(({ bodyName, moon, orbitGroup, orbitLine, mesh, label, phase }) => {
        const planet = bodyPlanets.current.get(bodyName);
        if (!planet) return;
        const isFocusedMoonSystem = focusedPlanetMode && bodyName === focusedPlanetName;
        orbitGroup.visible = !focusedPlanetMode || isFocusedMoonSystem;
        orbitGroup.position.copy(planet.position);
        orbitGroup.rotation.y = phase + dayOffset * (Math.PI * 2 / moon.period);
        const isSelectedPlanet = bodyName === selectedBodyNameRef.current;
        orbitLine.material.opacity = isSelectedPlanet ? 0.68 : 0.13;
        label.visible = isSelectedPlanet;
        mesh.scale.setScalar(isFocusedMoonSystem ? 1.6 : 1);
        mesh.material.emissiveIntensity = isSelectedPlanet ? 0.28 : 0.1;
      });
      for (const { mission, marker, label } of spacecraftMarkers.current) {
        const emphasized = mission.name === focusedSpacecraftName.current ||
          mission.name === hoveredSpacecraftName.current ||
          mission.name === selectedSpacecraftName.current;
        const path = spacecraftLayer.current?.children.find(
          object => object.userData.missionName === mission.name
        );
        if (path) path.material.opacity = emphasized ? 0.78 : 0.12;
        if (dayOffset > mission.positions.length - 1) {
          marker.visible = false;
          label.visible = false;
          continue;
        }
        const missionPosition = interpolatePlanetPosition(mission, dayOffset);
        if (!missionPosition) {
          marker.visible = false;
          continue;
        }
        marker.visible = true;
        if (mission.frame === "planet") {
          const parent = bodyPlanets.current.get(mission.target);
          if (!parent) continue;
          const relativePosition = new THREE.Vector3(missionPosition.x, missionPosition.z, -missionPosition.y);
          marker.position.copy(parent.getWorldPosition(new THREE.Vector3())).addScaledVector(relativePosition, 1200);
        } else {
          marker.position.copy(vectorToScenePosition(missionPosition));
        }
        label.visible = marker.visible && (
          mission.name === focusedSpacecraftName.current ||
          mission.name === hoveredSpacecraftName.current ||
          mission.name === selectedSpacecraftName.current
        );
      }
      const focusedSpacecraft = spacecraftMarkers.current.find(({ mission }) => mission.name === focusedSpacecraftName.current);
      if (focusedSpacecraft?.marker.visible && solarCamera.current) {
        const targetDelta = focusedSpacecraft.marker.position.clone().sub(controls.target);
        camera.position.add(targetDelta);
        controls.target.add(targetDelta);
      } else if (earthFocused.current && bodyPlanets.current.has(focusedBodyName.current) && solarCamera.current) {
        const focusedPlanetPosition = bodyPlanets.current.get(focusedBodyName.current).getWorldPosition(new THREE.Vector3());
        const targetDelta = focusedPlanetPosition.sub(controls.target);
        camera.position.add(targetDelta);
        controls.target.add(targetDelta);
      } else if (focusedMoonName.current && solarCamera.current) {
        const focusedMoon = moonObjects.current.find(({ moon }) => moon.name === focusedMoonName.current)?.mesh;
        if (focusedMoon) {
          const focusedMoonPosition = focusedMoon.getWorldPosition(new THREE.Vector3());
          const targetDelta = focusedMoonPosition.sub(controls.target);
          camera.position.add(targetDelta);
          controls.target.add(targetDelta);
        }
      }
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerleave", onPointerLeave);
      controls.dispose();
      markerTexture.dispose();
      satelliteLayer.current = null;
      orbitControls.current = null;
      bodyPlanets.current.clear();
      moonObjects.current = [];
      spacecraftLayer.current = null;
      spacecraftMarkers.current = [];
      solarCamera.current = null;
      earthFocused.current = false;
      focusedSpacecraftName.current = "";
      focusedMoonName.current = "";
      hoveredSpacecraftName.current = "";
      selectedSpacecraftName.current = "";
      planetEphemerisRef.current = null;
      spacecraftDataRef.current = null;
      scene.traverse(object => {
        object.geometry?.dispose();
        object.userData.ownedTexture?.dispose();
        if (Array.isArray(object.material)) object.material.forEach(material => material.dispose());
        else object.material?.dispose();
      });
      ownedTextures.forEach(texture => texture.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [showNasaEyes]);

  useEffect(() => {
    const layer = spacecraftLayer.current;
    if (!layer) return;
    while (layer.children.length) {
      const object = layer.children[0];
      layer.remove(object);
      object.traverse(child => {
        child.geometry?.dispose();
        child.userData.ownedTexture?.dispose();
        if (Array.isArray(child.material)) child.material.forEach(material => material.dispose());
        else child.material?.dispose();
      });
    }
    spacecraftMarkers.current = [];
    if (!spacecraftData || !planetEphemeris) return;

    for (const mission of spacecraftData.missions) {
      if (mission.positions.length < 2) continue;
      const color = new THREE.Color(MISSION_COLORS[mission.name] || "#ffffff");
      const pathPoints = mission.positions
        .map((position, index) => spacecraftToScenePosition(mission, position, index, planetEphemeris))
        .filter(Boolean);
      if (pathPoints.length > 1) {
        const path = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(pathPoints),
          new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.12 })
        );
        path.userData.missionName = mission.name;
        layer.add(path);
      }
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.095, 16, 16),
        new THREE.MeshBasicMaterial({ color, toneMapped: false })
      );
      marker.userData.missionName = mission.name;
      marker.visible = false;
      const label = createLabelSprite(mission.name, MISSION_COLORS[mission.name]);
      label.position.set(0, 0.24, 0);
      label.visible = false;
      marker.add(label);
      layer.add(marker);
      spacecraftMarkers.current.push({ mission, marker, label });
    }
  }, [spacecraftData, planetEphemeris]);

  useEffect(() => {
    const updateMarkers = () => {
      const markers = satelliteLayer.current;
      if (!markers) return;

      const positions = markers.geometry.attributes.position;
      const colors = markers.geometry.attributes.color;
      const visibleRecords = satelliteRecords.current.slice(0, 2500);
      let count = 0;
      const now = new Date();

      for (const record of visibleRecords) {
        try {
          const satellite = calculateSatellite(record, now);
          if (!satellite) continue;
          const latitude = THREE.MathUtils.degToRad(satellite.lat);
          const longitude = THREE.MathUtils.degToRad(satellite.lng);
          const altitudeScale = THREE.MathUtils.clamp(satellite.altitudeKm / 36000, 0, 1);
          const radius = 0.34 * (1.16 + altitudeScale * 1.7);
          positions.setXYZ(
            count,
            Math.sin(longitude) * Math.cos(latitude) * radius,
            Math.sin(latitude) * radius,
            Math.cos(longitude) * Math.cos(latitude) * radius
          );
          const color = satellite.orbitType === "LEO" ? 0x2dd4bf : satellite.orbitType === "MEO" ? 0xfbbf24 : 0xa78bfa;
          colors.setXYZ(count, ((color >> 16) & 255) / 255, ((color >> 8) & 255) / 255, (color & 255) / 255);
          count += 1;
        } catch (error) {
          console.error(`Unable to calculate CelesTrak satellite ${record.noradId}:`, error);
        }
      }
      positions.needsUpdate = true;
      colors.needsUpdate = true;
      markers.geometry.setDrawRange(0, count);
      markers.geometry.computeBoundingSphere();
      setRenderedSatelliteCount(count);
    };

    updateMarkers();
    const interval = window.setInterval(updateMarkers, 15000);
    return () => window.clearInterval(interval);
  }, [satelliteGroup, satelliteUpdatedAt]);

  const focusOnPlanet = name => {
    const controls = orbitControls.current;
    const camera = solarCamera.current;
    const planet = bodyPlanets.current.get(name);
    if (!controls || !camera || !planet) return;

    earthFocused.current = true;
    focusedSpacecraftName.current = "";
    focusedMoonName.current = "";
    focusedBodyName.current = name;
    planet.getWorldPosition(controls.target);
    const viewDirection = camera.position.clone().sub(controls.target).normalize();
    const body = BODIES.find(candidate => candidate.name === name);
    const outerMoonOrbit = Math.max(0, ...(MOONS_BY_PLANET[name] || []).map(moon => body.size * moon.orbitFactor));
    const framingDistance = (outerMoonOrbit + body.size * 2.3) * 2.5;
    planetFocused.current = true;
    camera.position.copy(controls.target).addScaledVector(viewDirection, Math.max(name === "Earth" ? 2.8 : 3.4, framingDistance));
    controls.update();
    host.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };
  const focusOnSelectedPlanet = () => focusOnPlanet(selected.name);
  const choosePlanet = name => {
    selectedBodyNameRef.current = name;
    focusedMoonName.current = "";
    setSelectedName(name);
    setSelectedMoonName(MOONS_BY_PLANET[name]?.[0]?.name || "");
    setSelectedSpacecraft("");
    if (showNasaEyes) {
      pendingPlanetFocus.current = name;
      setShowNasaEyes(false);
    } else {
      focusOnPlanet(name);
    }
  };
  useEffect(() => {
    if (showNasaEyes || !pendingPlanetFocus.current) return;
    const name = pendingPlanetFocus.current;
    pendingPlanetFocus.current = "";
    focusOnPlanet(name);
  }, [showNasaEyes]);
  const focusOnSpacecraft = mission => {
    const controls = orbitControls.current;
    const camera = solarCamera.current;
    const marker = spacecraftMarkers.current.find(item => item.mission.name === mission.name)?.marker;
    if (!controls || !camera || !marker?.visible) return;

    earthFocused.current = false;
    planetFocused.current = false;
    focusedMoonName.current = "";
    focusedSpacecraftName.current = mission.name;
    controls.target.copy(marker.position);
    const viewDirection = camera.position.clone().sub(controls.target).normalize();
    camera.position.copy(controls.target).addScaledVector(viewDirection, 2.6);
    controls.update();
  };

  const resetSolarView = () => {
    const controls = orbitControls.current;
    const camera = solarCamera.current;
    if (!controls || !camera) return;
    earthFocused.current = false;
    planetFocused.current = false;
    focusedSpacecraftName.current = "";
    focusedMoonName.current = "";
    controls.target.set(0, 0, 0);
    camera.position.set(0, 15, 27);
    controls.update();
  };
  const focusOnSelectedMoon = () => {
    const controls = orbitControls.current;
    const camera = solarCamera.current;
    const moon = moonObjects.current.find(({ bodyName, moon }) =>
      bodyName === selected.name && moon.name === selectedMoon?.name
    )?.mesh;
    if (!controls || !camera || !moon) return;

    earthFocused.current = false;
    planetFocused.current = true;
    focusedBodyName.current = selected.name;
    focusedSpacecraftName.current = "";
    focusedMoonName.current = selectedMoon.name;
    const moonPosition = moon.getWorldPosition(new THREE.Vector3());
    controls.target.copy(moonPosition);
    const viewDirection = camera.position.clone().sub(controls.target).normalize();
    camera.position.copy(controls.target).addScaledVector(viewDirection, 1.1);
    controls.update();
  };
  const simulationDate = planetEphemeris
    ? new Date(Date.parse(`${planetEphemeris.startDate}T00:00:00Z`) + planetDayOffset * PLANET_DAY_MS)
    : null;
  const selectedPosition = interpolatePlanetPosition(
    planetEphemeris?.bodies.find(body => body.name === selected.name),
    planetDayOffset
  );

  return <section className="solar-system tracker" aria-labelledby="solar-system-title">
    <div className="section-heading">
      <div>
        <p className="eyebrow">BEYOND EARTH ORBIT</p>
        <h2 id="solar-system-title">Explore the solar system</h2>
        <p className="muted">Explore NASA/JPL Eyes on the Solar System, or switch to the local view for live JPL planet positions, spacecraft tracks, and featured moons.</p>
      </div>
      <div className="status-pill"><i className="status-dot"/> SUN + 8 PLANETS · {FEATURED_MOON_COUNT} MOONS</div>
    </div>
    <div className="solar-layout">
      <div className="solar-view">
        <div className="solar-view-top">
          <span>{showNasaEyes ? "NASA / JPL · EYES ON THE SOLAR SYSTEM" : <><i className="solar-sun-key"/> SUN <span className="solar-key-divider">·</span> PLANET NAMES <span className="solar-key-divider">·</span> SPACECRAFT LABELS ON HOVER / TRACK</>}</span>
          <div className="solar-view-actions">
            <button type="button" className="globe-control" aria-pressed={showNasaEyes} onClick={() => setShowNasaEyes(true)}>NASA Eyes</button>
            <button type="button" className="globe-control" aria-pressed={!showNasaEyes} onClick={() => setShowNasaEyes(false)}>Local data view</button>
            {!showNasaEyes && <>
              <button type="button" className="globe-control" onClick={focusOnSelectedPlanet}>Focus {selected.name}{selectedMoons.length ? " + moons" : selected.name === "Earth" ? " + satellites" : ""}</button>
              <button type="button" className="globe-control" onClick={resetSolarView}>Full system</button>
            </>}
          </div>
        </div>
        <div className="planet-selection">
          <p className="planet-selection-label">SELECT A PLANET <span>· FOCUS ITS MOONS &amp; ORBITS</span></p>
          <div className="planet-picker" role="group" aria-label="Select an individual planet">
            {BODIES.map(body => <button
              key={body.name}
              type="button"
              className={`planet-button${body.name === selectedName ? " selected" : ""}`}
              onClick={() => choosePlanet(body.name)}
              aria-pressed={body.name === selectedName}
            >
              <span className="planet-dot" style={{ "--planet-color": `#${body.color.toString(16).padStart(6, "0")}` }}/>
              {body.name}
            </button>)}
          </div>
        </div>
        {showNasaEyes && <div className="nasa-eyes-frame">
          <iframe
            title="NASA Eyes on the Solar System interactive 3D experience"
            src="https://eyes.nasa.gov/apps/solar-system/#/home"
            allow="fullscreen; xr-spatial-tracking"
            loading="eager"
            referrerPolicy="strict-origin-when-cross-origin"
          >NASA Eyes could not be embedded. <a href="https://eyes.nasa.gov/apps/solar-system/#/home" target="_blank" rel="noreferrer">Open NASA Eyes on the Solar System</a>.</iframe>
        </div>}
        {showNasaEyes && <p className="solar-view-note nasa-eyes-credit">Interactive 3D solar-system experience and planetary imagery by NASA/JPL. <a href="https://eyes.nasa.gov/apps/solar-system/#/home" target="_blank" rel="noreferrer">Open NASA Eyes in a new tab</a>.</p>}
        {!showNasaEyes && <>
        <div className="solar-canvas" ref={host} role="img" aria-label="Interactive three-dimensional model with names for the Sun and all eight planets, plus spacecraft markers"/>
        <div className="planet-simulation">
          <div className="planet-simulation-actions">
            <button
              type="button"
              className="button"
              disabled={!planetEphemeris || isLoadingPlanetData}
              onClick={() => {
                if (planetDayOffset >= SIMULATION_DAYS) setPlanetDayOffset(0);
                setIsPlaying(value => !value);
              }}
            >
              {isPlaying ? "Pause" : planetDayOffset >= SIMULATION_DAYS ? "Replay" : "Play"}
            </button>
            <label className="planet-speed">
              <span>SIMULATION SPEED</span>
              <select value={simulationSpeed} onChange={event => setSimulationSpeed(Number(event.target.value))}>
                <option value="1">1 day / second</option>
                <option value="7">7 days / second</option>
                <option value="30">30 days / second</option>
              </select>
            </label>
            <button
              type="button"
              className="globe-control planet-refresh"
              disabled={isLoadingPlanetData}
              onClick={() => setPlanetRefresh(value => value + 1)}
            >
              {isLoadingPlanetData ? "Loading planet data…" : "↻ Refresh live positions"}
            </button>
            <span className="planet-data-status" aria-live="polite">
              {planetDataError
                ? `JPL Horizons unavailable: ${planetDataError}`
                : planetEphemeris
                  ? `${planetEphemeris.source}${planetEphemeris.stale ? " · saved ephemeris" : ""} · updated ${new Date(planetEphemeris.fetchedAt).toLocaleString()}`
                  : "Loading live positions for all eight planets from JPL Horizons…"}
            </span>
          </div>
          <label className="planet-timeline">
            <span>SIMULATION DATE</span>
            <input
              type="range"
              min="0"
              max={SIMULATION_DAYS}
              step="0.1"
              value={planetDayOffset}
              disabled={!planetEphemeris}
              onChange={event => {
                setIsPlaying(false);
                setPlanetDayOffset(Number(event.target.value));
              }}
            />
            <b>{simulationDate ? simulationDate.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "Waiting for live positions"}</b>
          </label>
        </div>
        <div className="spacecraft-panel">
          <div className="spacecraft-panel-heading">
            <div>
              <span>SPACECRAFT ACROSS THE SOLAR SYSTEM</span>
              <small>Current JPL tracks plus named historic missions</small>
            </div>
            <button
              type="button"
              className="globe-control"
              disabled={isLoadingSpacecraft}
              onClick={() => setSpacecraftRefresh(value => value + 1)}
            >
              {isLoadingSpacecraft ? "Loading…" : "↻ Refresh missions"}
            </button>
          </div>
          <p className={`spacecraft-status${spacecraftError ? " error" : ""}`} aria-live="polite">
            {spacecraftError
              ? `JPL Horizons spacecraft data unavailable: ${spacecraftError}`
              : spacecraftData
                ? `${spacecraftData.source} · trajectory updated ${new Date(spacecraftData.fetchedAt).toLocaleString()}${spacecraftData.stale ? " · using saved data" : ""}`
                : "Loading supported spacecraft trajectories from JPL Horizons…"}
          </p>
          {targetMissions.length
            ? <div className="spacecraft-list">{targetMissions.map(mission => {
              const color = MISSION_COLORS[mission.name] || "#ffffff";
              const hasLiveTrack = mission.positions.length > 1;
              return <button
                key={mission.name}
                type="button"
                className={`spacecraft-card${selectedSpacecraft === mission.name ? " selected" : ""}${hasLiveTrack ? "" : " historical"}`}
                style={{ "--mission-color": color }}
                disabled={!hasLiveTrack}
                onMouseEnter={() => {
                  if (hasLiveTrack) hoveredSpacecraftName.current = mission.name;
                }}
                onMouseLeave={() => {
                  if (hoveredSpacecraftName.current === mission.name) hoveredSpacecraftName.current = "";
                }}
                onClick={() => {
                  setSelectedSpacecraft(mission.name);
                  if (BODIES.some(body => body.name === mission.target)) setSelectedName(mission.target);
                  focusOnSpacecraft(mission);
                }}
                aria-pressed={selectedSpacecraft === mission.name}
                aria-label={`${mission.name}, ${mission.displayTarget}. ${mission.status}${hasLiveTrack ? ", track spacecraft" : ", historic mission without a live track"}`}
              >
                <i className="mission-dot"/>
                <span><b>{mission.name}</b><small>{mission.displayTarget} · {mission.status}</small></span>
                <small>{hasLiveTrack ? `${mission.positions.length} DAYS · TRACK` : "HISTORIC"}</small>
              </button>;
            })}</div>
            : <p className="spacecraft-empty">Mission names and trajectories will appear when JPL Horizons data has loaded.</p>}
        </div>
        <div className="solar-satellite-controls">
          <label className="solar-group-field" htmlFor="solar-satellite-group">
            <span>CELESTRAK SATELLITE GROUP</span>
            <select id="solar-satellite-group" value={satelliteGroup} onChange={event => setSatelliteGroup(event.target.value)}>
              {GROUPS.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}
            </select>
          </label>
          <button type="button" className="button refresh-button solar-refresh" disabled={isLoadingSatellites} onClick={() => setSatelliteRefresh(value => value + 1)}>
            {isLoadingSatellites ? "Updating…" : "↻ Update CelesTrak"}
          </button>
          <span className="solar-satellite-status" aria-live="polite">
            {satelliteError ? satelliteError : `${satelliteStatus} · ${renderedSatelliteCount.toLocaleString()} positions updated every 15 sec`}
          </span>
          {satelliteUpdatedAt && <span className="solar-updated-at">{satelliteFormat} {new Date(satelliteUpdatedAt).toLocaleString()}</span>}
        </div>
        <p className="solar-view-note">Local data view: planet surfaces and moon orbits are illustrative; positions and active spacecraft tracks use JPL Horizons. Historic mission names have no current-position markers. Planet sizes, distances, and orbit guides are not to scale. Up to 2,500 CelesTrak satellites can be displayed around Earth.</p>
        </>}
      </div>
      <aside className="solar-inspector" aria-live="polite">
        <p className="eyebrow">PLANET SELECTED</p>
        <h3>{selected.name}</h3>
        <p className="solar-body-type">{selected.type}</p>
        <p className="solar-description">{selected.description}</p>
        <p className="nasa-gallery-heading"><span>NASA IMAGE ARCHIVE</span><small>MISSION PHOTOGRAPHY · TAP IMAGE FOR SOURCE</small></p>
        <div className={`nasa-imagery${selectedMoonImage ? " has-moon-image" : ""}`} aria-label={`NASA imagery for ${selected.name}${selectedMoonImage ? ` and ${selectedMoon.name}` : ""}`}>
          <NasaImageGallery
            key={selected.name}
            images={PLANET_IMAGES[selected.name]}
            label="PLANET"
            alt={`${selected.name} imagery from NASA`}
          />
          {selectedMoonImage && <NasaImageGallery
            key={selectedMoon.name}
            images={selectedMoonImage}
            label="MOON"
            alt={`${selectedMoon.name} imagery from NASA`}
          />}
        </div>
        <p className="nasa-gallery-credit">Images from the <a href="https://images.nasa.gov/" target="_blank" rel="noreferrer">NASA Image and Video Library</a>. Image titles and mission credits shown with each photo.</p>
        <div className="solar-facts">
          <div><small>ORBITAL PERIOD</small><b>{selected.year}</b></div>
          <div><small>ROTATION</small><b>{selected.day}</b></div>
          <div><small>LIVE DISTANCE FROM SUN</small><b>{selectedPosition ? `${Math.hypot(selectedPosition.x, selectedPosition.y, selectedPosition.z).toFixed(3)} AU` : "Loading"}</b></div>
          <div><small>LIVE HELIOCENTRIC X / Y / Z (AU)</small><b>{selectedPosition ? `${selectedPosition.x.toFixed(3)} / ${selectedPosition.y.toFixed(3)} / ${selectedPosition.z.toFixed(3)}` : "Loading"}</b></div>
          <div><small>AVG. DISTANCE FROM SUN</small><b>{selected.distance}</b></div>
          <div><small>FEATURED NATURAL MOONS</small><b>{selectedMoons.length}{selectedMoons.length ? ` · ${selectedMoons.length} shown` : " · none known"}</b></div>
          {selectedMoon && <>
            <div><small>SELECTED MOON</small><b>{selectedMoon.name}</b></div>
            <div><small>ORBITAL PERIOD</small><b>{selectedMoon.period} Earth days</b></div>
          </>}
        </div>
        <div className="moon-picker" aria-label={`Featured natural moons of ${selected.name}`}>
          <div className="moon-picker-heading">
            <span>{selectedMoons.length ? `FEATURED MOONS · ${selectedMoons.length}` : "NATURAL MOONS · 0"}</span>
            <button type="button" className="globe-control" onClick={selected.name === "Mars" && selectedMoon ? focusOnSelectedMoon : focusOnSelectedPlanet}>
              {selected.name === "Mars" && selectedMoon ? `Focus ${selectedMoon.name}` : `Focus ${selected.name}`}
            </button>
          </div>
          {selectedMoons.length
            ? <div className="moon-list">{selectedMoons.map(moon => <button
              key={moon.name}
              type="button"
              className={`moon-button${moon.name === selectedMoonName ? " selected" : ""}`}
              onClick={() => {
                setSelectedMoonName(moon.name);
                if (focusedMoonName.current) focusedMoonName.current = moon.name;
              }}
              aria-pressed={moon.name === selectedMoonName}
            >
              <span className="moon-dot" style={{ "--moon-color": `#${moon.color.toString(16).padStart(6, "0")}` }}/>
              <span>{moon.name}</span>
              <small>{moon.period} d</small>
            </button>)}</div>
            : <p className="moon-empty">No natural moons are currently known for {selected.name}.</p>}
        </div>
        {selected.name === "Mars" && selectedMoon && <section className="mars-moon-profile" aria-label={`${selectedMoon.name} facts`}>
          <p className="eyebrow">MARS MOON PROFILE</p>
          <h4>{selectedMoon.name}</h4>
          <p>{selectedMoon.description}</p>
          <div className="mars-moon-facts">
            <div><small>MEAN DIAMETER</small><b>{selectedMoon.diameterKm}</b></div>
            <div><small>ORBIT FROM MARS</small><b>{selectedMoon.distanceKm}</b></div>
            <div><small>ORBITAL PERIOD</small><b>{selectedMoon.period < 1 ? `${(selectedMoon.period * 24).toFixed(1)} hours` : `${selectedMoon.period} days`}</b></div>
          </div>
        </section>}
      </aside>
    </div>
  </section>;
}
