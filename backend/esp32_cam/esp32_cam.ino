#include "esp_camera.h"
#include <WiFi.h>
#include <WebServer.h>

// ======================================================
// WIFI CONFIG
// ======================================================

// Use 2.4GHz WiFi only
const char* ssid = "abumuzzammil";
const char* password = "11111111";

// ======================================================
// XIAO ESP32S3 SENSE CAMERA PINS (official pin map)
// ======================================================

#define PWDN_GPIO_NUM     -1
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM     10
#define SIOD_GPIO_NUM     40
#define SIOC_GPIO_NUM     39

#define Y9_GPIO_NUM       48
#define Y8_GPIO_NUM       11
#define Y7_GPIO_NUM       12
#define Y6_GPIO_NUM       14
#define Y5_GPIO_NUM       16
#define Y4_GPIO_NUM       18
#define Y3_GPIO_NUM       17
#define Y2_GPIO_NUM       15

#define VSYNC_GPIO_NUM    38
#define HREF_GPIO_NUM     47
#define PCLK_GPIO_NUM     13

// ======================================================
// WEB SERVER
// ======================================================

WebServer server(80);
WiFiServer streamServer(81);
WiFiClient streamClient;
unsigned long lastFrameMs = 0;

// ======================================================
// ALERT OUTPUTS
// ======================================================

// LED -> GPIO2 (D1) | Buzzer -> GPIO4 (D3)
#define LED_PIN 2
#define BUZZER_PIN 4

void handle_led_on() {
  digitalWrite(LED_PIN, HIGH);
  server.send(200, "text/plain", "ok");
}

void handle_led_off() {
  digitalWrite(LED_PIN, LOW);
  server.send(200, "text/plain", "ok");
}

void handle_buzzer_on() {
  digitalWrite(BUZZER_PIN, HIGH);
  server.send(200, "text/plain", "ok");
}

void handle_buzzer_off() {
  digitalWrite(BUZZER_PIN, LOW);
  server.send(200, "text/plain", "ok");
}

// ======================================================
// MJPEG STREAM
// ======================================================

void sendStreamHeader(WiFiClient &client) {
  client.print("HTTP/1.1 200 OK\r\n");
  client.print("Content-Type: multipart/x-mixed-replace; boundary=frame\r\n\r\n");
}

void sendFrame(WiFiClient &client) {
  camera_fb_t * fb = esp_camera_fb_get();
  if (!fb) {
    return;
  }

  client.printf("--frame\r\n");
  client.printf("Content-Type: image/jpeg\r\n");
  client.printf("Content-Length: %u\r\n\r\n", fb->len);
  client.write(fb->buf, fb->len);
  client.print("\r\n");

  esp_camera_fb_return(fb);
}

// ======================================================
// START SERVER
// ======================================================

void startCameraServer() {
  server.on("/flash_on", HTTP_GET, handle_led_on);
  server.on("/flash_off", HTTP_GET, handle_led_off);
  server.on("/buzzer_on", HTTP_GET, handle_buzzer_on);
  server.on("/buzzer_off", HTTP_GET, handle_buzzer_off);
  server.begin();
  streamServer.begin();

  Serial.println("Camera server started");
}

// ======================================================
// SETUP
// ======================================================

void setup() {
  Serial.begin(115200);

  Serial.println();
  Serial.println("Booting...");

  pinMode(LED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);
  digitalWrite(BUZZER_PIN, LOW);

  // ======================================================
  // CAMERA CONFIG
  // ======================================================

  camera_config_t config;

  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;

  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;

  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;

  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;

  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;

  config.xclk_freq_hz = 20000000;

  // ======================================================
  // IMPORTANT SETTINGS
  // ======================================================

    config.pixel_format = PIXFORMAT_JPEG;
    config.frame_size = FRAMESIZE_VGA;   // 640x480 — much better for YOLO detection
    config.grab_mode = CAMERA_GRAB_LATEST;

  if (psramFound()) {
    config.fb_location = CAMERA_FB_IN_PSRAM;
      config.jpeg_quality = 10;   // Higher quality (lower number = better)
      config.fb_count = 2;
  } else {
    config.fb_location = CAMERA_FB_IN_DRAM;
      config.jpeg_quality = 16;
      config.fb_count = 1;
  }

  // ======================================================
  // INIT CAMERA
  // ======================================================

  esp_err_t err = esp_camera_init(&config);

  if (err != ESP_OK) {
    Serial.printf("Camera init failed with error 0x%x\n", err);

    while (true) {
      delay(1000);
    }
  }

  Serial.println("Camera initialized");

  // ======================================================
  // WIFI CONNECT
  // ======================================================

  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  WiFi.begin(ssid, password);

  Serial.print("Connecting to WiFi");

  int retries = 0;

  while (WiFi.status() != WL_CONNECTED && retries < 40) {
    delay(500);
    Serial.print(".");

    retries++;
  }

  // ======================================================
  // WIFI FAILED
  // ======================================================

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println();
    Serial.println("WiFi FAILED");

    Serial.print("WiFi Status Code: ");
    Serial.println(WiFi.status());

    Serial.println("CHECK:");
    Serial.println("1. Password");
    Serial.println("2. 2.4GHz WiFi");
    Serial.println("3. Hotspot settings");

    while (true) {
      delay(1000);
    }
  }

  // ======================================================
  // WIFI SUCCESS
  // ======================================================

  Serial.println();
  Serial.println("WiFi connected!");

  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());

  // ======================================================
  // START SERVER
  // ======================================================

  startCameraServer();

  Serial.println("Camera Stream Ready!");
  Serial.println();
  Serial.print("Open Browser: http://");
  Serial.println(WiFi.localIP());
}

// ======================================================
// LOOP
// ======================================================

void loop() {
  server.handleClient();
  if (!streamClient || !streamClient.connected()) {
    WiFiClient candidate = streamServer.available();
    if (candidate) {
      streamClient = candidate;
      sendStreamHeader(streamClient);
      Serial.println("Stream client connected");
    }
  }

  if (streamClient && streamClient.connected()) {
    // Stream frames as fast as the camera and WiFi allow
    sendFrame(streamClient);
  }

  // Small 1ms delay to yield CPU to WiFi stack
  delay(1);
}
