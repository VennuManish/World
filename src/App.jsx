import React from "react";
import EarthGlobe from "./EarthGlobe.jsx";
import SolarSystem from "./SolarSystem.jsx";
export default function App() {
  return <main className="app-shell">
    <header className="topbar">
      <a className="brand" href="/" aria-label="Satellite, Debris and Rocket Body Tracking home">
        <span className="brand-mark"><span>O</span></span>
        <span><strong>SATELLITE <span>TRACKING</span></strong><small>DEBRIS · ROCKET BODIES · ORBITS</small></span>
      </a>
      <div className="topbar-center"><span className="nav-indicator"/> GLOBAL TRACKING NETWORK</div>
      <div className="topbar-right"><i className="live-dot"/> SYSTEM ONLINE <span className="topbar-divider"/> MISSION CONTROL</div>
    </header>
    <section className="hero">
      <div className="hero-copy-block">
        <p className="eyebrow"><span className="eyebrow-line"/> SATELLITE & DEBRIS TRACKING <span className="hero-version">OPS / 01</span></p>
        <h1>Eyes on <span>every orbit.</span></h1>
        <p className="hero-copy">Track satellites, rocket bodies, and orbital debris around Earth. Inspect current coordinates and orbital telemetry, predict passes, and explore the solar system.</p>
      </div>
      <div className="hero-chip"><i className="live-dot"/> LIVE TRACKING <span className="hero-chip-divider"/> TLE + SGP4</div>
    </section>
    <EarthGlobe />
    <SolarSystem />
    <footer className="footer"><span>SATELLITE · DEBRIS · ROCKET BODY TRACKING</span><span>INDEPENDENT TRACKING TOOL · PUBLIC ORBITAL DATA · NOT AFFILIATED WITH SPACE-TRACK · NOT FOR NAVIGATION</span></footer>
  </main>;
}
