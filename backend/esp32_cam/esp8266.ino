#include <ESP8266WiFi.h>

#define TRIG_PIN D1
#define ECHO_PIN D2
#define LED_PIN  D5

const char* ssid = "abumuzzammil";
const char* password = "11111111";

WiFiServer server(80);

bool detected = false;
float distance = 0;
float detectedDistance = 0;  // ✅ Frozen at the moment of detection

void setup() {
  Serial.begin(9600);

  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(LED_PIN, OUTPUT);

  WiFi.begin(ssid, password);
  Serial.print("🔄 Connecting to WiFi");

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\n✅ Connected to WiFi!");
  IPAddress ip = WiFi.localIP();
  Serial.print("📡 ESP IP: ");
  Serial.println(ip);
  Serial.print("🌐 http://");
  Serial.println(ip);

  server.begin();
}

void loop() {

  // ================= SENSOR =================
  long duration;

  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);

  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  duration = pulseIn(ECHO_PIN, HIGH, 30000);

  if (duration == 0) {
    distance = -1;
  } else {
    distance = duration * 0.034 / 2;
  }

  // 🎯 Only trigger alert for objects within 45 cm
  if (!detected && distance > 0 && distance <= 45) {
    detected = true;
    detectedDistance = distance;  // ✅ Freeze the distance at detection moment
    digitalWrite(LED_PIN, HIGH);
    Serial.print("🚨 ALERT TRIGGERED — Object at ");
    Serial.print(detectedDistance);
    Serial.println(" cm");
  }

  delay(100);

  // ================= SERVER =================
  WiFiClient client = server.available();
  if (!client) return;

  while (!client.available()) delay(1);

  String request = client.readStringUntil('\r');
  client.flush();

  // -------- STATUS API --------
  if (request.indexOf("/status") != -1) {
    client.println("HTTP/1.1 200 OK");
    client.println("Content-Type: application/json");
    client.println("Access-Control-Allow-Origin: *");
    client.println("Connection: close");
    client.println();
    client.println("{\"status\":\"ok\"}");
    return;
  }

  // -------- DATA API --------
  if (request.indexOf("/data") != -1) {

    // ✅ Send detectedDistance when alert is active, live distance otherwise
    float reportDistance = (detected && detectedDistance > 0) ? detectedDistance : distance;

    String json = "{";
    json += "\"distance\":";
    json += (reportDistance < 0 ? "null" : String(reportDistance));
    json += ",\"alert\":";
    json += (detected ? "true" : "false");
    json += "}";

    client.println("HTTP/1.1 200 OK");
    client.println("Content-Type: application/json");
    client.println("Access-Control-Allow-Origin: *");
    client.println("Access-Control-Allow-Methods: GET, OPTIONS");
    client.println("Access-Control-Allow-Headers: Content-Type");
    client.println("Connection: close");
    client.println();
    client.println(json);

    return;
  }

  // -------- RESET --------
  if (request.indexOf("/reset") != -1) {
    detected = false;
    detectedDistance = 0;  // ✅ Clear frozen distance on reset
    digitalWrite(LED_PIN, LOW);

    client.println("HTTP/1.1 200 OK");
    client.println("Access-Control-Allow-Origin: *");
    client.println("Connection: close");
    client.println();
    client.println("OK");

    Serial.println("🔄 RESET FROM WEBSITE");
    return;
  }

  // -------- DEFAULT PAGE --------
  client.println("HTTP/1.1 200 OK");
  client.println("Content-Type: text/html");
  client.println("Access-Control-Allow-Origin: *");
  client.println("Connection: close");
  client.println();
  client.println("<h2>ESP8266 Running</h2>");
}
