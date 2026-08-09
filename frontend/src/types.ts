export interface SensorStatus {
  distance: number | null;
  alert: boolean;
  online: boolean;
}

export interface DetectionStatus {
  detected: boolean;
  animal: string | null;
  confidence: number | null;
  timestamp: string | null;
}

export interface ControlStateResponse {
  success: boolean;
  device: string;
  state: boolean;
  message: string;
}

export interface HardwareControlStatus {
  led: boolean;
  buzzer: boolean;
}

export interface AppSettings {
  esp8266_ip: string;
  camera_ip: string;
  polling_interval_ms: number;
  selected_animal: string;
  auto_mode: boolean;
  confidence_threshold: number;
  camera_source: 'esp' | 'webcam' | 'demo';
  simulation_mode: boolean;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  animal: string | null;
  confidence: number | null;
  distance: number | null;
  alert: boolean;
  led_state: boolean;
  buzzer_state: boolean;
  action_taken: string;
}

export const ANIMAL_CLASSES = [
  { id: 'dog', label: 'Dog 🐶' },
  { id: 'cat', label: 'Cat 🐱' },
  { id: 'cow', label: 'Cow 🐄' },
  { id: 'horse', label: 'Horse 🐎' },
  { id: 'sheep', label: 'Sheep 🐑' },
  { id: 'elephant', label: 'Elephant 🐘' },
  { id: 'bear', label: 'Bear 🐻' },
  { id: 'zebra', label: 'Zebra 🦓' },
  { id: 'giraffe', label: 'Giraffe 🦒' },
  { id: 'bird', label: 'Bird 🐦' },
];
