#include <ESP8266WiFi.h>          //https://github.com/esp8266/Arduino
#include <ArduinoJson.h>          //https://github.com/bblanchon/ArduinoJson
#include <WebSocketsClient.h>
#include "I2Cdev.h"
#include "MPU6050.h"
#include "Wire.h"
#include <vector>

MPU6050 accelgyro;
int16_t ax, ay, az;
int16_t gx, gy, gz;
unsigned long cont=1;

WebSocketsClient webSocket;
const char* ssid     = "sensor";
const char* password = "1234567278";
const char* ws_server = "148.226.154.107";
int ws_port = 3000;

//flag for sending data
bool ban = false;

unsigned long previousMillis = 0;
const long interval = 10;

struct SensorData {
   const char* ID;
   int16_t aX;
   int16_t aY;
   int16_t aZ;
   int16_t gX;
   int16_t gY;
   int16_t gZ;
   unsigned long prevMillis;
   int16_t conta;
};

const int BUFFER_SIZE = JSON_OBJECT_SIZE(2) + JSON_ARRAY_SIZE(42);

static std::vector<struct SensorData> vData(5);
int counter = 0;

void setup() {
  // put your setup code here, to run once:
  Serial.begin(115200);
  Serial.println();

  //connect to WiFi
  setupWiFi();

  //Configure connection to mpu6050
  setupMPU();

  //Configure ws connection
  webSocket.begin(ws_server, ws_port);
  webSocket.onEvent(webSocketEvent);

  vData.clear();
}

void setupWiFi(){
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("");
  Serial.println("WiFi connected");  
  Serial.println("IP address: ");
  Serial.println(WiFi.localIP());
}

void setupMPU(){
  Wire.begin();
  Serial.println("Initializing I2C devices...");
  accelgyro.initialize();
  //changing sensitivity
  accelgyro.setFullScaleAccelRange(MPU6050_ACCEL_FS_16);
  accelgyro.setFullScaleGyroRange(MPU6050_GYRO_FS_2000);
  // verify connection
  Serial.println("Testing device connections...");
  Serial.println(accelgyro.testConnection() ? "MPU6050 connection successful" : "MPU6050 connection failed");

  //Add calibration offsets
  //Sensor 1 - 4G
  accelgyro.setXAccelOffset(-4396);
  accelgyro.setYAccelOffset(-1897);
  accelgyro.setZAccelOffset(1111);
  accelgyro.setXGyroOffset(58);
  accelgyro.setYGyroOffset(-26);
  accelgyro.setZGyroOffset(12);
}


void webSocketEvent(WStype_t type, uint8_t * payload, size_t lenght) {
  switch(type) {
    case WStype_DISCONNECTED:
      Serial.println("[WSc] Disconnected!");
      break;
    case WStype_CONNECTED:
      Serial.println("[WSc] Connected");
      break;
    case WStype_TEXT:
      ban = !ban;
      break;
  }
}

String serialize(){
    StaticJsonBuffer<BUFFER_SIZE> jsonBuffer;
    JsonObject& root = jsonBuffer.createObject();
    root["ID"] = vData[0].ID;
    JsonArray& lect = root.createNestedArray("lectures");
    for(int x=0; x < 5; x++){
      lect.add(vData[x].aX);
      lect.add(vData[x].aY);
      lect.add(vData[x].aZ);
      lect.add(vData[x].gX);
      lect.add(vData[x].gY);
      lect.add(vData[x].gZ);
      lect.add(vData[x].prevMillis);
      lect.add(vData[x].conta);
    }
    String JSON;
    root.printTo(JSON);
    return JSON;
}

void sendData(){
  String json = serialize();
  webSocket.sendTXT(json);
  //Serial.println(json);
  vData.clear();
  counter=0;
}

void loop() {
  // put your main code here, to run repeatedly:
  webSocket.loop();
  unsigned long currentMillis = millis();
  if(currentMillis - previousMillis >= interval) {
    previousMillis = currentMillis;
    if(ban){
      accelgyro.getMotion6(&ax, &ay, &az, &gx, &gy, &gz);
      SensorData data = {"2", ax, ay, az, gx, gy, gz, previousMillis, cont};
      vData.push_back(data);
      counter++;
      cont++;
      if(counter==5){
        sendData();
      }
    }
  }
}
