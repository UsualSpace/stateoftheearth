import './App.css';
import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';

import {useState, useEffect} from "react";

type LatLonAltPosition = {
  longitude: number;
  latitude: number;
  altitdue: number;
};

type ECEFPosition = {
  x: number;
  y: number;
  z: number;
};

type AirCraftData = {
  icao24: string;
  longitude: number;
  latitude: number;
  altitude: number;
};

type AirCraftEstimate = {
  estimatedPosition: ECEFPosition;
  trueNextPosition: ECEFPosition;
  truePrevPosition: ECEFPosition;
  deltaTime: number;
  data: AirCraftData;
};

function LLAToECEF(longitude: number, latitude: number, altitude: number): ECEFPosition {
  //https://en.wikipedia.org/wiki/Geographic_coordinate_conversion#From_geodetic_to_ECEF_coordinates
  
  function N(phi: number): number = {
    const a = 0;
    const b = 0;
    const ee = 1.0 - ((b * b) / (a * a));
    const cotcot = 
    return a / Math.sqrt(1.0 - (ee / 1 + cot))
  }
}

function ECEFToLLA(x: number, y: number, z: number): LatLonAltPosition {

}

class StateInterpolator {
  #aviationState: Map<string, AirCraftEstimate>;
  #previousElapsedTime: number;

  constructor() {
    this.#aviationState = new Map<string, AirCraftEstimate>();
    this.#previousElapsedTime = 0;
  }

  updateStateEstimate(elapsedTime: number) {
    const deltaTime = elapsedTime - this.#previousElapsedTime;
    this.#previousElapsedTime = elapsedTime;

    
    
    requestAnimationFrame(this.updateStateEstimate);
  }

  getEstimatedAviationState() {

  }

  getEstimatedMaritimeState() {

  }

  getEstimatedSatelliteState() {

  }

}

function App() {
  const [aviationCache, setAviationCache] = useState(new Map<string, AirCraftData>());

  useEffect(() => {
    const eventSource = new EventSource(`${import.meta.env.VITE_STATEOFTHEEARTH_API_URL}/events`);
    console.log("Registered aviation stream")
        
    // Listen for messages from the server
    eventSource.addEventListener("aviation_data", (event: MessageEvent) => {
      console.log("received aviation data")
      const delta = JSON.parse(event.data);

      console.log(delta)

      const next = new Map<string, AirCraftData>();

      for(const aircraft of delta.create) next.set(aircraft.icao24, aircraft);
      for(const aircraft of delta.update) next.set(aircraft.icao24, aircraft);
      for(const icao24 of delta.delete) next.delete(icao24);

      setAviationCache(next);
    });

    // Log connection error
    eventSource.onerror = function(event) {
        console.log('Error occurred:', event);
    };
  }, []);


  return (
    <MapContainer center={[51.505, -0.09]} zoom={13} scrollWheelZoom={true} preferCanvas={true}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {[...aviationCache.entries()]
      .filter(([, v]) => Number.isFinite(v.latitude) && Number.isFinite(v.longitude))
      .map(([key, v]) => (
        <Marker key={key} position={[v.latitude, v.longitude]}>
          <Popup>{key}</Popup>
        </Marker>
      ))}

    </MapContainer>
  );
}

export default App;