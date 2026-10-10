# Syllabus: Internet of Things and Robotics

**Course:** Internet of Things and Robotics
**Level:** B.Tech
**Suggested credits:** 3–4
**Prerequisites:** Python, basic circuits (Ohm's law), school-level trigonometry and matrices, basic probability.
**Progression:** circuits → sensors → microcontrollers → networks → cloud/data → security → kinematics → control → perception → planning → capstone.

**Running project: the "Smart Greenhouse Rover".** A small differential-drive robot patrols a greenhouse. It reads soil-moisture and temperature sensors and publishes them over MQTT to a dashboard. It also plans a path to plants that need water. Each unit adds one layer to it.

**Hardware policy:** simulation-first. Every lab runs in Python (numpy) or in the Wokwi simulator. Each lab has an optional "on a real ESP32 kit" box. Firmware logic is tested on a host computer; hardware input/output is not executed in this course material.

---

## Unit 1 — Foundations of IoT and Robotics
- What IoT is; the 4-layer architecture (device, edge, network, cloud)
- What a robot is: the sense–think–act loop
- Types of robots (arms, mobile robots, drones)
- Application domains (agriculture, health, industry, smart city)
- System requirements: latency, energy, cost, reliability
- Safety and ethics

**Practical:** simulate a sense–think–act loop (a thermostat) in Python.
**Project:** system sketch and requirements table.

## Unit 2 — Electronics for Embedded Systems
- Voltage, current, resistance; Ohm and Kirchhoff laws
- Voltage divider; pull-up and pull-down resistors
- LED current-limiting resistor
- Power and energy; batteries (mAh, runtime); logic levels
- PWM and duty cycle; transistor as a switch; H-bridge motor driver
- ADC and DAC (resolution, quantisation error)

**Practical:** compute a node's power budget and battery life.
**Project:** power budget and motor-driver sizing.

## Unit 3 — Sensors and Actuators
- Sensor specifications: range, resolution, accuracy, precision, noise, drift
- Calibration by linear least squares
- Sampling, Nyquist and aliasing
- Moving-average and first-order low-pass filters
- Common sensors: temperature, humidity, soil moisture, light, IMU, ultrasonic, IR
- Actuators: DC motor, servo, stepper, relay; wheel encoders

**Practical:** calibrate and filter a noisy simulated sensor.
**Project:** calibrated soil-moisture and temperature readings.

## Unit 4 — Microcontrollers and Embedded Programming
- MCU vs single-board computer (Arduino, ESP32, Raspberry Pi)
- GPIO, interrupts, timers
- The super-loop vs an RTOS
- Finite-state machines; button debouncing
- Serial buses: UART, I2C, SPI
- Deep sleep and duty-cycling for energy
- MicroPython vs Arduino C++

**Practical:** debounced button and LED state machine (Wokwi ESP32).
**Project:** sensor-node firmware as a finite-state machine.

## Unit 5 — Networking and IoT Communication Protocols
- TCP/IP layers seen from IoT
- Wireless options (Wi-Fi, BLE, Zigbee, LoRaWAN, NB-IoT) compared by range, data rate and power
- HTTP/REST vs MQTT vs CoAP
- MQTT publish/subscribe: brokers, topics and wildcards, QoS 0/1/2, retained messages, last will, keep-alive
- Packet structure

**Practical:** a small MQTT broker and client in Python, checked against the real paho-mqtt client.
**Project:** the node publishes telemetry.

## Unit 6 — IoT Data, Cloud and Edge Computing
- Payload formats (JSON, CBOR size)
- Time-series data; storage and dashboards
- Edge vs cloud: latency, bandwidth, cost; aggregation at the edge
- Anomaly detection: threshold, z-score, EWMA; alerts
- The digital-twin idea

**Practical:** a telemetry dashboard with alerts (Flask).
**Project:** a greenhouse dashboard.

## Unit 7 — IoT Security and Privacy
- Threat modelling (STRIDE); attack surfaces of a device
- Default passwords and the Mirai botnet case study
- TLS in brief
- Authentication and message integrity (HMAC)
- Secure boot and signed over-the-air (OTA) updates
- Network segmentation; data privacy; security checklists

**Practical:** forge, then block, a tampered MQTT command using HMAC.
**Project:** hardened node.

## Unit 8 — Robot Kinematics
- Degrees of freedom; coordinate frames
- 2-D rotation matrices and homogeneous transforms
- Forward kinematics of a 2-link arm; inverse kinematics (closed form, elbow up/down)
- Workspace; Jacobian and singularities
- Differential-drive kinematics; wheel odometry and its drift

**Practical:** animate a 2-link arm reaching targets.
**Project:** the rover's motion model and odometry.

## Unit 9 — Control Systems for Robots
- DC-motor first-order model (time constant, gain): only the dynamics PID needs
- Open vs closed loop; on/off control and hysteresis
- P, PI, PID control
- Step-response metrics: rise time, overshoot, settling time, steady-state error
- Tuning (manual, Ziegler–Nichols); integral windup
- Discrete-time implementation; heading and line following

**Practical:** a PID tuner on a simulated motor.
**Project:** wheel-speed and heading control.
*Out of scope:* full rigid-body manipulator dynamics (named only).

## Unit 10 — Perception and Localisation
- Noise as a Gaussian; Bayes' rule for robots
- Histogram (grid) localisation
- The 1-D Kalman filter (predict/update) and its 2-D extension
- Sensor fusion (encoder + IMU)
- Range sensors (ultrasonic, IR, LiDAR) and their errors
- Occupancy-grid mapping
- Overview of SLAM and of camera-based perception

**Practical:** Kalman filter on a simulated rover.
**Project:** fused pose estimate and occupancy map.

## Unit 11 — Path Planning, Navigation and ROS
- Configuration space; grid graphs
- BFS, Dijkstra, A* (admissible heuristics); obstacle inflation
- Reactive obstacle avoidance; pure-pursuit path following
- ROS 2 concepts: nodes, topics, services, actions, tf, launch files
- Simulators (Gazebo, Webots): overview

**Practical:** A* and pure pursuit in simulation.
**Project:** the rover reaches dry plants and avoids obstacles.

## Unit 12 — Capstone: Smart Greenhouse Rover
- Integrate every layer into one system test
- Measure task success rate, coverage, energy used, message latency and loss; compare against a baseline
- Write the report
- Ten alternative capstone briefs

---

## Laboratory component (14 labs)

| Lab | Experiment |
| --- | --- |
| 1 | Python and a sense–think–act simulation |
| 2 | Circuits and power budget |
| 3 | Sensor calibration and filtering |
| 4 | ESP32 GPIO and finite-state machine (Wokwi) |
| 5 | I2C sensor read (Wokwi) |
| 6 | MQTT publish/subscribe |
| 7 | Dashboard and alerts |
| 8 | HMAC-secured commands |
| 9 | Arm kinematics |
| 10 | Differential-drive odometry |
| 11 | PID motor control |
| 12 | Kalman localisation |
| 13 | A* navigation |
| 14 | Capstone |

## Tools and technologies
Python, numpy, matplotlib, MicroPython, Arduino IDE, Wokwi, MQTT (Mosquitto / paho-mqtt), Flask, Git. ROS 2 and Gazebo as an overview.

## Assessment
- Internal / continuous assessment: 30%
- Laboratory: 20%
- Mid-semester examination: 15%
- End-semester examination: 25%
- Capstone / project: 10%

## Capstone project ideas
Smart irrigation · air-quality network · line-following delivery robot · warehouse inventory robot · fall-detection wearable · smart parking · energy monitor · 2-link drawing arm · self-balancing robot (simulated) · swarm patrol (simulated).
