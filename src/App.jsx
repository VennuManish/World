import React from "react";
import EarthGlobe from "./EarthGlobe.jsx";
import SolarSystem from "./SolarSystem.jsx";
export default function App() {
  return <main className="app-shell">
    <header className="topbar">
      <a className="brand" href="/" aria-label="Satellite Tracking home">
        <span className="brand-mark"><span>O</span></span>
        <span><strong>SATELLITE <span>TRACKING</span></strong><small>SPACE DOMAIN AWARENESS</small></span>
      </a>
      <div className="topbar-center"><span className="nav-indicator"/> GLOBAL TRACKING NETWORK</div>
      <div className="topbar-right"><i className="live-dot"/> SYSTEM ONLINE <span className="topbar-divider"/> MISSION CONTROL</div>
    </header>
    <section className="hero">
      <div className="hero-copy-block">
        <p className="eyebrow"><span className="eyebrow-line"/> ORBITAL INTELLIGENCE PLATFORM <span className="hero-version">OPS / 01</span></p>
        <h1>Eyes on <span>every orbit.</span></h1>
        <p className="hero-copy">Track satellites around Earth, inspect live orbital telemetry, and journey outward through an interactive view of our solar system.</p>
      </div>
      <div className="hero-chip"><i className="live-dot"/> LIVE TRACKING <span className="hero-chip-divider"/> TLE + SGP4</div>
    </section>
    <EarthGlobe />
    <SolarSystem />
    <footer className="footer"><span>SATELLITE TRACKING / SOLAR SYSTEM EXPLORER</span><span>SATELLITE TELEMETRY IS ESTIMATED FROM PUBLIC TLE DATA · PLANETARY MODEL IS ILLUSTRATIVE · NOT FOR NAVIGATION</span></footer>
  </main>;
}
