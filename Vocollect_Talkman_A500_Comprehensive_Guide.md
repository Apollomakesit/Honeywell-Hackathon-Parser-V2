# Honeywell Vocollect Talkman A500 — Comprehensive Technical Reference

> **Document scope:** Everything the Talkman A500 does, how it works, what data flows in and out, how voice recognition is built and maintained, potential failure modes, and how diagnostic patterns map to specific root causes.

---

## Table of Contents

1. [What the Device Is](#1-what-the-device-is)
2. [Primary Use Cases](#2-primary-use-cases)
3. [How the System Works — End-to-End](#3-how-the-system-works--end-to-end)
4. [Voice Recognition Engine — Patterns & Training](#4-voice-recognition-engine--patterns--training)
5. [Data Sent and Received](#5-data-sent-and-received)
6. [Hardware Architecture](#6-hardware-architecture)
7. [Wireless & Connectivity Stack](#7-wireless--connectivity-stack)
8. [LED Status Patterns — Full Reference](#8-led-status-patterns--full-reference)
9. [Operator Commands & Voice Control](#9-operator-commands--voice-control)
10. [Charger System & Battery Management](#10-charger-system--battery-management)
11. [Vehicle Mounted Talkman (VMT) Configuration](#11-vehicle-mounted-talkman-vmt-configuration)
12. [Potential Issues, Failure Modes & Troubleshooting](#12-potential-issues-failure-modes--troubleshooting)
13. [Error Codes — Numbered & Spoken](#13-error-codes--numbered--spoken)
14. [Accessories & Peripherals](#14-accessories--peripherals)
15. [Hardware Specifications](#15-hardware-specifications)
16. [Compliance & Regulatory](#16-compliance--regulatory)
17. [Support & RMA Procedures](#17-support--rma-procedures)

---

## 1. What the Device Is

The **Vocollect Talkman A500** is a wearable, hands-free voice terminal manufactured by Honeywell (Vocollect Solutions division). It is an industrial-grade rugged device designed to enable **voice-directed work (VDW)** in warehouses, distribution centers, factory floors, and vehicle-mounted (forklift) environments.

It sits in a product family alongside the T1, T2-series, T5-series, and A700-series devices, but the A500 is positioned as a high-performance model with:

- A more powerful processor than previous generations
- More onboard memory
- A more robust wireless radio
- Native support for **VoiceCatalyst** (Honeywell's advanced voice software platform)
- Bluetooth support for display devices, headsets, and peripherals
- IP67 enclosure rating — fully dustproof and waterproof

The device is worn on a belt clip or shoulder harness, always on the operator's right side, buttons facing up, connectors facing toward the operator's back. It is fundamentally a **voice I/O terminal** — it speaks instructions to the operator and listens to spoken responses to advance work tasks.

---

## 2. Primary Use Cases

The Talkman A500 is designed for industrial environments where hands must remain free during work:

| Use Case | How the Device Is Used |
|---|---|
| **Warehouse Order Picking** | Device speaks bin locations, quantities, and check digits; operator confirms picks by voice |
| **Factory Floor Inspection** | Device guides operator through inspection checklists via voice prompts |
| **Inventory Counting** | Operator speaks count quantities back to the device |
| **Shipping & Receiving** | Device directs put-away locations and confirms receipt of goods |
| **Vehicle-Mounted Operations** | Device mounted on forklifts/pallet jacks, powered by vehicle battery, operator interacts via headset while driving |
| **Multi-system Integration** | Device connects to WMS (Warehouse Management Systems) via Wi-Fi for real-time task data |

The core design philosophy is that operators should never need to look at a screen or use their hands — all interaction is via voice. The device **leaves hands free** to inspect items, pick products, drive vehicles, or repair defects.

---

## 3. How the System Works — End-to-End

### System Architecture

The Talkman A500 operates as a thin client in a larger Vocollect ecosystem:

```
[WMS / Host System]
        ↕  (Network / Wi-Fi)
[VoiceConsole Server]
        ↕  (Wi-Fi 802.11 a/b/g/n)
[Talkman A500 Device]
        ↕  (Bluetooth or wired)
[SRX/SRX2 Headset + Microphone]
        ↕  (Audio)
[Operator]
```

### Startup Sequence

1. Operator presses **Play/Pause** button to power on
2. Device LED cycles through red → flashing red/green → solid → blinking red → solid green
3. Device performs a **background noise sample** — operator must stay quiet for a few seconds
4. Device says: *"Current operator is [name]. Please keep quiet for a few seconds."*
5. Device connects to VoiceConsole via Wi-Fi and loads the current operator's voice templates and task
6. Device begins providing work instructions immediately after successful load

### Task Execution Loop

The core runtime loop is simple and continuous:

1. Device speaks a prompt/instruction to the operator (e.g., "Go to aisle 14, bin B")
2. Operator performs the physical action
3. Device prompts for a confirmation response (e.g., "Say the check digit")
4. Operator speaks the response
5. Voice recognition engine matches the spoken word against trained templates
6. If matched: task advances; response is logged as an Output Data Record (ODR)
7. If not matched: device repeats the prompt or asks operator to try again
8. ODRs are transmitted to VoiceConsole / host system in real time or batched

### Boot Continuation (After Proper Power-Off)

When the device was properly shut down and is rebooted, it resumes intelligently:

- Performs background noise sample
- **Continues at the exact point in the task where the operator left off**
- Transmits any templates that had not been sent before shutdown
- Transmits any output data records not yet sent to the host
- Downloads any lookup tables not yet received from the host

This state persistence prevents data loss and task regression during normal shift transitions.

---

## 4. Voice Recognition Engine — Patterns & Training

### Adaptive Speech Recognition

The device uses **Vocollect Adaptive Speech Recognition™**, which:

- Builds a **per-operator voice template** — a personal acoustic model for each worker
- Accounts for **changes in speaking patterns over time** (fatigue, illness, accent drift)
- Adjusts for **environmental changes** (noisy vs. quiet zones, cold storage, outdoor docks)
- Continuously improves recognition accuracy through use

### What Gets Recognized

The device recognizes a **closed vocabulary** — a finite set of words and phrases specific to the loaded task. This is not open-domain speech recognition. The vocabulary is defined in the task configuration (`.vcf` file) and consists of:

- Numeric confirmations (check digits, quantities, locations)
- Task-specific command words defined by the workflow
- Universal system commands ("Say again", "Talkman sleep", "Talkman backup", etc.)

### Pattern Recognition Process

1. **Noise sampling** — device samples ambient background noise before work begins; this baseline is used to filter environmental sound from operator speech
2. **Template matching** — incoming audio is compared against the operator's trained templates for each vocabulary word
3. **Confidence scoring** — recognition engine scores the match; below-threshold matches prompt a retry
4. **Adaptive refinement** — templates update passively over time to reflect the operator's current voice patterns

### Template Training — Initial Enrollment

Every new operator must train templates before using the system. Training options:

**Device-Only Training:**
- Device speaks each vocabulary word aloud
- Operator repeats each word at least 4 times
- Device builds acoustic templates from the repetitions
- Ends with: *"Creating voice templates. Please wait."* → *"Finished creating voice templates."*

**Visual Training Device (Recommended):**
- QTERM-G55 (for T5/T2) or browser-based display (for A500/A700) shows words on screen
- Operator reads words visually — produces more natural speech than listening and repeating
- Reduces training artifacts caused by over-enunciation

**VoiceConsole Display Training:**
- Words appear on a computer screen during the training session (VoiceConsole 3.0+ / VoiceCatalyst MP 1.0+)

**Printed Word List Method:**
- Supervisor prints vocabulary list from VoiceConsole
- Commonly misheard or confusing words are circled
- Operator reviews the list before training to familiarize themselves

### Template Training Data Flow

```
Operator speaks vocabulary words
        ↓
A500 captures audio samples (×4+ per word)
        ↓
Device builds local acoustic templates
        ↓
Templates sent to VoiceConsole host
        ↓
Templates stored per operator, retrievable on any device
        ↓
On login: device downloads operator's templates from VoiceConsole
```

### Retraining & Vocabulary Updates

- Operators can retrain individual words if recognition degrades
- During retraining, templates are **buffered locally** and sent to host when complete
- If a forced reset (battery removal) occurs during retraining: **all templates in buffer are automatically sent to the host on next boot** — operator should not press any buttons until this completes

---

## 5. Data Sent and Received

### Data the Device Receives (Inbound)

| Data Type | Source | Purpose |
|---|---|---|
| **Voice Application / Task File** | VoiceConsole | The workflow logic — what prompts to give, what responses to accept |
| **Operator Templates** | VoiceConsole | Operator's personal voice acoustic model |
| **Lookup Tables (LUTs)** | VoiceConsole / Host | Reference data used during task execution (e.g., valid bin locations, item lists) |
| **Task Configuration File (`.vcf`)** | VoiceConsole | Task parameters including port settings, training device settings, self-test mode |
| **Device Profile / Configuration** | VoiceConsole | Network settings, device parameters, radio configuration |
| **Software Updates (VoiceClient/VoiceCatalyst)** | VoiceConsole (via charger) | Firmware and voice application software |
| **Easy Configuration Profiles** | Neighbor device in charger | Initial Wi-Fi and device config distributed over serial connection between charger bays |

### Data the Device Sends (Outbound)

| Data Type | Destination | Purpose |
|---|---|---|
| **Output Data Records (ODRs)** | VoiceConsole / Host WMS | Work confirmations — picks, counts, inspections completed |
| **Voice Templates** | VoiceConsole | New or retrained operator acoustic models |
| **Operator Response Data** | Host system | Real-time workflow progress, spoken responses |
| **Log Files / Crash Dumps** | VoiceConsole | Diagnostic data for troubleshooting |
| **Battery Status Data** | VoiceConsole | Battery performance, temperature, pack identification (via custom electronics in the battery) |
| **Process History Data** | VoiceConsole | Historical operational records, task completion metrics |
| **Error Reports** | VoiceConsole | Error codes and spoken error events (triggered by "Talkman report problem" command) |

### Battery Data Specifically

The A500/T5 high-performance battery contains **custom electronics** that actively report:
- Current battery performance metrics
- Temperature readings
- Pack identification (serial/ID)

This data is surfaced in VoiceConsole and can trigger warnings at specific voltage thresholds:
- **First warning:** 3,450 mV
- **Critical warning:** 3,350 mV → triggers automatic device shutdown

### Data Persistence During Power Events

- Data collected but not yet transmitted is **stored locally** before shutdown (when properly powered off via Play/Pause hold)
- On next boot, all pending ODRs and templates are automatically transmitted before resuming work
- **Forced reset (battery removal while on):** all unsent data in memory is **permanently lost**

---

## 6. Hardware Architecture

### Physical Layout

| Component | Description |
|---|---|
| **Battery** | High-performance lithium-ion, pin-out design (different from T2 flush contacts), 3.7V / 19 WHr |
| **Battery Release Button** | Spring-loaded; must be depressed to remove battery |
| **Maintenance Port** | Red port — audio out + RS-232 serial; used for QTERM training device connection and direct serial configuration |
| **Headset Port** | Yellow port — connects wired SRX headset |
| **Play/Pause Button** | Yellow button — power on/off, noise sample trigger |
| **Operator Button** | Navigation and selection |
| **Plus (+) Button** | Volume up, menu scroll up |
| **Minus (−) Button** | Volume down, menu scroll down |
| **Belt Clip** | Integrated; device worn on right side |
| **LED Indicator** | Multi-color (green, red, amber/yellow, blue) status indicator |

### Dimensions & Weight

| Property | Value |
|---|---|
| Weight (device only) | 6.31 oz / 178.89 g |
| Weight (with battery) | 11.01 oz / 312.13 g |
| Length | 5.5" / 13.97 cm |
| Width | 2.63" / 6.68 cm |
| Depth | 1.7" / 4.3 cm |

### Environmental Ratings

| Property | Value |
|---|---|
| Operating Temperature | -22°F to 122°F (-30°C to 50°C) |
| Storage Temperature | -30°F to 140°F (-34°C to 60°C) |
| Enclosure Rating | IP67 (dustproof + waterproof) |
| Humidity | 100% condensing |
| Drop Tested | 25 drops from 5 ft + 10 drops from 6 ft onto polished concrete; 10 drops at -20°F |
| Shock/Vibration | MIL STD-810F compliant |

---

## 7. Wireless & Connectivity Stack

### Wi-Fi

The A500 supports multiple radio variants:
- **TT-800:** 802.11 a/b/g
- **TT-801:** 802.11 b/g
- **TT-802:** 802.11 a/b/g/n (most capable model)

The A500 (TAP802-01) operates in both **2.4 GHz and 5 GHz ISM bands**. In EU environments, 5 GHz channels 36–64 are restricted to indoor use, and the device must be paired with access points that have radar detection (DFS) enabled.

Wi-Fi is used for:
- Downloading task files, operator templates, lookup tables
- Uploading ODRs (work confirmations) in real time
- Logging to VoiceConsole
- Software updates (primarily when docked in charger)
- Easy Configuration profile distribution

### Bluetooth

The A500 includes a Bluetooth module (CSR BlueCore 6 in most models) used for:
- Connecting to **SRX2 wireless headset**
- Connecting to **Pidion BM-170 display device**
- Connecting to **external Bluetooth barcode scanners** (via `BT_SCAN` port in task configuration)

Bluetooth LED states on the device (blue indicator):
- **Off:** Bluetooth disabled
- **On solid:** Discovering
- **Fast blink:** Paging
- **Slow blink:** Connected
- **Series of blinks:** Device is discoverable

### Serial (RS-232)

The maintenance port supports RS-232 for:
- Direct device configuration (bypassing Wi-Fi)
- QTERM visual training device connection
- Easy Configuration via serial daisy-chain through charger bays

---

## 8. LED Status Patterns — Full Reference

### Device LED (A500)

#### Green Indicator

| State | Meaning |
|---|---|
| On (solid) | Device is on and operating normally |
| Fast blink | Device is in a charger |
| Slow blink | Device in sleep mode (not charging) OR voice application selection menu active OR software loading |

#### Red Indicator

| State | Meaning |
|---|---|
| On briefly | Device is turning on OR turning off |
| On continuously | Error — contact system administrator |
| Blinking | Retrieving/loading operator from VoiceConsole OR retrieving/loading voice application OR software loading |

#### Amber/Yellow Indicator

| State | Meaning |
|---|---|
| Off | Wi-Fi disabled |
| Fast blink | Wi-Fi on but not connected |
| Slow blink | Wi-Fi on and connecting to wireless network |

#### Blue Indicator (Bluetooth)

| State | Meaning |
|---|---|
| Off | Bluetooth off |
| On solid | Discovering |
| Fast blink | Paging |
| Slow blink | Connected |
| Series of blinks | Device is discoverable |

### Charger LED (A500/T5 — Lower Pair, Device Slots)

| Left Indicator | Right Indicator | Meaning |
|---|---|---|
| Off | Off | Troubleshoot — potential charger fault |
| Green | Green | Battery fully charged and ready |
| Red | Off | Battery charging in progress |
| Blinking Red | Off | Battery may not be correctly seated OR charger fault |
| Off | Yellow | Battery may not be seated correctly OR battery too hot/cold |

### Easy Configuration Power LED (Charger)

| State | Meaning |
|---|---|
| Alternating green/yellow | Easy Configuration operation in progress — do not remove devices |
| Solid green | All devices configured and ready |

---

## 9. Operator Commands & Voice Control

### Universal Voice Commands (Available at Any Time)

| Spoken Command | Action |
|---|---|
| `"Say again"` | Repeats the current prompt |
| `"Talkman sleep"` | Puts device into sleep mode |
| `"Talkman wake up"` | Wakes device from sleep |
| `"Talkman backup"` | Erases previous response to re-answer the same prompt (VoiceClient only) |
| `"Talkman battery status"` | Reports remaining battery charge (VoiceCatalyst 2.0+ only) |
| `"Talkman help"` | Speaks instructions for responding to the current prompt OR lists valid vocabulary words |
| `"Talkman report problem"` | Flags a problem and sends a snapshot of the log file to VoiceConsole (VoiceCatalyst 1.2+ only) |
| `"Talkman louder"` | Increases voice volume |
| `"Talkman softer"` | Decreases voice volume |
| `"Talkman continue"` | Returns to work after adjusting volume |

### Button-Accessible Settings Menu

Accessed via Operator button → then +/− to scroll:

| Menu Item | Function |
|---|---|
| Change Operator | Switch to a different operator profile |
| Change Task | Load a different voice application |
| Change Speed | Adjust TTS speed (faster/slower) |
| Change Pitch | Adjust TTS pitch (higher/lower) |
| Change Speaker | Toggle between male and female TTS voice |

### Voice Adjustments

- **Volume:** Via voice commands OR +/− buttons (device always acknowledges "louder"/"softer" and reports "This is loudest"/"This is softest" at limits)
- **Pitch:** Adjustable for certain languages and voice packs only
- **Speed:** Full range from slowest to fastest; device announces each step
- **Gender:** Male or female TTS speaker selectable

---

## 10. Charger System & Battery Management

### T5/A500 10-Bay Combination Charger

- Stores 5 devices + 5 individual batteries simultaneously (10 batteries total)
- Charges batteries in-device and standalone
- Distributes Easy Configuration profiles via serial connection between bays
- Can be wall-mounted (wall bracket kit available)
- A device that has been active for more than 8 hours will automatically cycle off/on after 5 minutes in charger (prevents continuous-on degradation)

### Charging Behavior

1. Insert device (disconnected from headset) into charger slot — press down then back until click
2. LED on device begins blinking green = charging in progress
3. LED on charger slot turns red (left indicator) = charging
4. When both charger LEDs turn green = fully charged and ready
5. Solid red on device LED continuously = error, contact administrator

### Battery Warm-Up (Cold Environments)

Batteries used in cold environments will not charge until they warm up. Approximate warm-up times:

| Battery Temperature | Warm-Up Time |
|---|---|
| -4°C / 24.8°F | ~6 minutes |
| -10°C / 14.0°F | ~10 minutes |
| -20°C / -4°F | ~22 minutes |
| -30°C / -22°F | ~30 minutes |

### Battery Safety Rules

- Only use Honeywell-authorized batteries — unauthorized batteries void warranty and can cause fire/explosion
- Never remove battery while device LED is still on
- Never force battery into compartment — listen for click confirmation
- Battery contacts should never be bent or manipulated
- For cold-environment storage: remove battery and store at room temperature with normal humidity
- Do not leave battery connected to charger for extended periods — degrades battery life

### Easy Configuration (Charger-Based Config Distribution)

Easy Configuration allows one configured device to distribute its profile to all other devices in the same charger bay:

1. One "master" device is placed in the **transmit bay** (first bay on the right — off-white latch)
2. Unconfigured devices placed in remaining bays (dark gray latches)
3. Device profile must have `"distributable"="1"` set in Advanced Device Settings in VoiceConsole
4. LED sequence on unconfigured devices:
   - Flash green → can't reach VoiceConsole
   - Flash orange → listening for profile broadcast
   - Flash green briefly → receiving profile
   - Solid red → rebooting with new config
   - Blink green → ready to use

**Requires DHCP server.** Static IP configurations will cause all devices to share the same IP — avoid in production.

---

## 11. Vehicle Mounted Talkman (VMT) Configuration

### Overview

The A500 VMT is the A500 device mounted to a warehouse vehicle (forklift, motorized pallet jack) using a battery adapter connected to the vehicle's power system. The device operates identically to a belt-worn configuration but is powered by the vehicle's battery through a DC-DC converter.

### Power Architecture

```
Vehicle Battery (12V/24V or 36V/48V)
        ↓
Fused Input Cable
        ↓
Power Supply Module (9-36V or 18-60V DC input → 13.2V DC output)
        ↓
Battery Adapter (BT-710)
        ↓
A500 Device (in battery slot)
```

- Two power supply models: 9-36V DC input (12V/24V vehicles) and 18-60V DC input (36V/48V vehicles)
- Output must be **13.2V DC** — power supply handles conversion
- Fusing: 2A 250V SLO BLO fuses recommended, located as close to power source as possible
- Vocollect recommends **unswitched power** so the device remains powered even when vehicle is briefly switched off

### Mount Types

- **Screw On Mount:** Bolted to a stationary surface
- **Clamp Mount:** Clamped to stationary surface (can also be bolted)
- **Claw Mount:** Clamped to oddly-shaped, horizontal, or vertical surfaces

All mounts use RAM Mounting Systems hardware (1" ball system). Additional RAM parts can be purchased for custom positioning.

### VMT Best Practices

- Do not remove VMT devices frequently — cables and battery adapters are not designed for regular disconnection
- When removal is necessary, the battery adapter docks in the side of the VMT holder (not unplugged from the cable)
- Mount the device where it does not obstruct driver view or vehicle controls
- Recessed mounting is ideal for protection, but must not block Wi-Fi/Bluetooth antennas
- Lock arm parts in place with 1/4" #20 nylon lock nut to prevent vibration loosening
- Secure all cabling with cable ties — snagged cables can cause accidents

### VMT Troubleshooting Flow

1. Verify vehicle battery is charged and vehicle starts normally
2. Confirm VMT powers on when vehicle is on (if installed after key switch)
3. Swap with a known-working Talkman — if substitute works, original device needs service
4. Swap battery adapter with known-working adapter — if VMT works, original adapter needs replacement
5. Open power supply lid, test input voltage vs. vehicle system voltage
6. Test output voltage — should be ~13.2V DC
7. If input OK but output bad → power supply needs replacement
8. Check battery adapter output: outermost points should read ~3.9-4.2V DC
9. Check fuses on input cable — replace if blown; if they immediately blow again, check for short circuit

---

## 12. Potential Issues, Failure Modes & Troubleshooting

### No Audio Through Headset

**Pattern:** Device appears to be on, but operator hears nothing.

Diagnostic steps in order:
1. Verify battery is fully charged
2. Verify headset is properly connected to yellow port
3. Test headset on a known-working device
4. Test a different headset on the problematic device
5. Power cycle the device (off → on)
6. Full reboot
7. If SRX/SRX2: verify headset is Bluetooth-paired to the device
8. If headset is broken → RMA

**Root cause pattern:** Steps 3 & 4 together isolate whether the fault is in the headset or the device. If a different headset works on the same device, the original headset is the failure point.

---

### Scanner Will Not Scan

**Pattern:** External barcode scanner physically scanning but Talkman not receiving input.

Key diagnostic checks:
- Verify task is configured to use `BT_SCAN` port in task advanced settings (VoiceConsole)
- Check VoiceConsole Peripherals Paired status — if "searching," the Bluetooth address is wrong
- If scanner beeps multiple times after scan = not connected
- If scanner beeps once (successful) but Talkman ignores input = task termination characters mismatch (should be CR/LF)
- If Talkman was asleep during a scan attempt, it may ignore subsequent scans — toggle device off/on

---

### Device Beeps Every Few Seconds

**Pattern:** Continuous intermittent beeping without clear error message.

- Wait a few minutes — this is normal during active host communication
- If beeping persists beyond a few minutes → check device logs in VoiceConsole
- Root cause: typically a communication/network issue with the host

---

### Device Will Not Load a Voice Application

**Pattern:** Device is on and connected, but task won't load.

Diagnostic steps:
1. Retry loading the application from VoiceConsole
2. Verify device is properly seated in charger (software downloads happen via charger in some configs)
3. Check VoiceConsole for error messages
4. Confirm device is within Wi-Fi range of an access point
5. Verify `ChangeTaskEnabled` parameter is set to `1` in device config
6. Full reboot
7. Enable debug mode and inspect logs

---

### Device Will Not Load Operator Template

**Pattern:** Operator logged in but templates won't load.

Diagnostic steps:
1. Ensure correct operator selection procedure was followed
2. Verify the operator has completed voice template training
3. Confirm Wi-Fi coverage at device location
4. Full reboot

---

### Device Keeps Shutting Off

**Pattern:** Device powers off unexpectedly during use.

Diagnostic steps:
1. Replace battery with a fully charged one
2. Verify battery is correctly installed (listen for click)
3. Inspect battery compartment for physical damage — if damaged, RMA device
4. Check VoiceConsole for crash dump files associated with the device's serial number

**Root cause pattern:** The most common cause is battery failure (worn cells that drop voltage quickly under load). Crash dump files in VoiceConsole can indicate whether shutdown was caused by software fault vs. power event.

---

### Device Will Not Turn On

1. Check that battery is correctly seated
2. Confirm battery is fully charged
3. If neither resolves → RMA

---

### Device Does Not Respond to Button Presses

1. Confirm battery is charged
2. Full reboot
3. If unresolved → RMA (likely hardware failure in button membrane or internal circuitry)

---

### Charger Issues

| Symptom | Likely Cause | Resolution |
|---|---|---|
| No LEDs when device/battery inserted | No power, bad contacts, or charger fault | Check AC power; clean contacts; try another slot |
| Battery slot LEDs blink red immediately | Mechanical alignment issue in slot | Check slot alignment (credit card shouldn't fit between pegs and pocket edge); clean contacts |
| LEDs blink red 1.5-3s after insertion | Battery fault or charger fault | Isolate battery vs. charger by testing other batteries; if battery-specific and battery is old, dispose |
| LEDs blink red after 3+ seconds | Battery end-of-life or charger fault | Isolate; old batteries should be disposed |
| All red LEDs flashing simultaneously | One device or battery causing charger-wide fault | Remove devices one by one, power-cycle charger; last removed device before problem resolves is the culprit |
| All amber LEDs flashing in circular pattern | Charger hardware failure | Cannot be customer-resolved; charger must be replaced |
| Power LED flashing amber (not solid green) | Normal — Easy Configuration is active (`DISTRIBUTABLE=1` set on master device) | No action required; wait for configuration to complete |

---

### Recognition Problems / Poor Accuracy

**Pattern:** Device frequently fails to recognize operator's speech, asks for repeats constantly.

Common causes and fixes:
- **Dirty headset contacts or windscreen:** Clean contacts with isopropyl alcohol; replace windscreen (recommended every 90 days)
- **Excessive background noise:** Ambient noise exceeds training conditions — retrain templates in the actual work environment
- **Operator illness or voice change:** Retrain affected vocabulary words
- **TCO connector contamination:** Dirty Talkman Connector (TCO) contacts cause intermittent connection, static, and recognition problems — clean with isopropyl alcohol, then soft eraser for corrosion

---

### Data Loss Scenarios

| Trigger | Data Lost |
|---|---|
| Battery removed while LED is on (forced reset) | All in-memory data — ODRs, in-progress task state |
| Device shut off while LED is blinking red | Device may not be in a stable state to resume; potential task corruption |
| Flash memory full (error 0x2112) | Device cannot write new data; must upload collected data immediately |
| Low flash memory (0x1602/0x1603) | Warning state; collect data to host before all storage is consumed |

---

## 13. Error Codes — Numbered & Spoken

### Key Numbered Error Codes (VoiceConsole Display)

| Code | Description | Resolution |
|---|---|---|
| 0x0206 | Battery getting low | Change battery |
| 0x0207 | Battery getting low — change now | Change battery immediately |
| 0x0208 | Battery critically low — powering off | Replace battery after shutdown |
| 0x0602 | Noise sampling failed | Retry; check headset |
| 0x0603 | Noise sampling timed out | Retry; reboot |
| 0x0605 | Invalid operator file name | Check operator file in VoiceConsole |
| 0x060e | Cannot train words — insufficient flash memory | Free up flash; reboot |
| 0x0802 | Speech output failed to initialize | Check crash dump; reboot; reload VoiceClient |
| 0x0804 | Audio system failure | Check crash dump; reboot; reload VoiceClient |
| 0x1202 | Task not loaded — no task name | Reload task |
| 0x1204 | Operator load failed | Check VoiceConsole; reboot |
| 0x1205 | Corrupted operator data | Reload operator |
| 0x1212 | Corrupt task file | Reload task; reboot; reload VoiceClient |
| 0x1402 | Communications: receive error | Reboot; reload VoiceClient |
| 0x1403 | Communications: send error | Reboot; reload VoiceClient |
| 0x1410 | Network transport registration failed | Reload task; check ODR/LUT socket settings |
| 0x1417 | Bad FTP command | Reboot; reload VoiceClient |
| 0x1425 | Socket host name or IP bad | Verify task's ODR/LUT host and service info |
| 0x1602 | Warning: low flash memory | Go to coverage area; upload data; reboot |
| 0x1603 | Warning: low flash memory — upload now | Urgent — dock device in charger immediately |
| 0x2112 | Flash is full — powering off | Recover data; reboot; reload VoiceClient |
| 0x2115 | Flash out of space | Same as above |

### Key Spoken Error Messages (Heard Through Headset)

| Spoken Message | Resolution |
|---|---|
| "Battery is very low. Powering off." | Change battery immediately after shutdown |
| "Cannot load operator while sending templates." | Wait for template transmission to complete |
| "Corrupt task file. Task load failed." | Reload task; reboot; reload VoiceClient |
| "Corrupted operator data." | Reload operator |
| "Failed to load lookup table. Task load failed." | Move to better Wi-Fi coverage; reload task |
| "Flash is full. Please wait while Talkman turns off." | Move to coverage; reboot; place in charger |
| "Noise sampling procedure failed." | Retry noise sample; go to quieter location; try different headset |
| "Noise sampling procedure timed out." | Retry; reboot |
| "Operator load failed." | Move to coverage; reboot; reload VoiceClient |
| "Self test mode set, but no script file found." | Edit task config: change `selftest=1` to `selftest=0` |
| "Unable to receive input data." | Reboot; reload VoiceClient |
| "Unable to send output data." | Reboot; reload VoiceClient |
| "Unable to train words. Not enough free flash memory." | Let device sleep; reboot; reload VoiceClient |
| "Warning, low flash memory! You must upload data now!" | Move to coverage; dock in charger immediately |

---

## 14. Accessories & Peripherals

### Pidion BM-170 Display

A touchscreen Bluetooth display device that pairs with the A500 (VoiceCatalyst only) for use cases where visual context supplements voice:

- Connects via Bluetooth to the A500
- Displays screens from the running voice application
- Has rocker switch (volume), power button, back button, options menu, and joypad
- Useful for complex workflows where visual confirmation is needed alongside voice

Connection procedure: Turn on A500 → Turn on Pidion → Press "Connect to a Voice Device" → Select device serial number from list → Confirm.

### SRX / SRX2 Wireless Headset

- Bluetooth headset with attached microphone
- Paired with A500 for wireless operation
- Adapts to operator speaking patterns using Adaptive Speech Recognition™
- Windscreen should be replaced every 90 days for optimal recognition

### Wearables

| Accessory | Function |
|---|---|
| T5/A500 Adjustable Shoulder Harness | Alternative to belt; adjustable chest straps (regular: 32"-48"; large: 41"-66") |
| T5/A500 Belt with Clip (sizes XS–XXXL) | Primary wearing option; nylon construction; YKK velcro |
| Elastomer-SKIN Cover (ThermoPlastic Elastomer) | Protective cover; not required but prolongs device life; extends battery life in freezer environments; does not need to be removed for charging |
| EXO Skeleton Cover | Additional drop protection; full access to all features |

### QTERM-G55 Visual Training Device

- Liquid-crystal screen displays vocabulary words during operator enrollment
- Connected via RS-232 to the red maintenance port
- Must use device software version 3.1+ for Thai TTS support
- Baud rate: 9600 (fixed in VoiceClient 1.x and 3.x)

---

## 15. Hardware Specifications

### A500 Device Specifications

| Spec | Value |
|---|---|
| Weight (no battery) | 6.31 oz / 178.89 g |
| Weight (with battery) | 11.01 oz / 312.13 g |
| Length | 5.5" / 13.97 cm |
| Width | 2.63" / 6.68 cm |
| Depth | 1.7" / 4.3 cm |
| Ports | Headset (yellow), Maintenance/serial + audio out (red) |
| Operating Temp | -22°F to 122°F (-30°C to 50°C) |
| Storage Temp | -30°F to 140°F (-34°C to 60°C) |
| Drop Rating | 25 drops from 5 ft + 10 drops from 6 ft; also 10 drops at -20°F |
| Enclosure | IP67 |
| Humidity | 100% condensing |
| Shock/Vibration | MIL STD-810F |

### Battery Specifications (BT-700-2)

| Spec | Value |
|---|---|
| Weight | 4.7 oz / 133.24 g |
| Cells | 2x lithium-ion |
| Voltage | 3.7V |
| Energy | 19 WHr |
| Operating Temp | -40°C to 55°C |
| Storage Temp | Per standard Li-ion guidelines |
| Enclosure | IP67 |
| Humidity | 95% non-condensing |
| Shock | MIL STD 810F |
| First Warning Voltage | 3,450 mV |
| Critical Warning Voltage | 3,350 mV |

### 10-Bay Combination Charger Specifications

| Spec | Value |
|---|---|
| Length | 21.21" / 53.9 cm |
| Depth | 6.64" / 16.9 cm |
| Height | 6.12" / 15.5 cm |
| Input Voltage | 100-250 VAC |
| Input Current | 2.4A max |
| Line Frequency | 50-60 Hz |
| Power Supply Output | 97.5W (15V × 6.5A) |
| Operating Temp | 50-140°F (10-40°C) |
| Storage Temp | -22-158°F (-30-70°C) |
| Humidity | 90% non-condensing |

---

## 16. Compliance & Regulatory

### FCC (United States)

- Class B digital device — FCC Part 15 compliant
- Does not require user license or authorization
- User modifications void operating authority

### RF Exposure

- Complies with ICNIRP, IEEE C95.1, FCC OET Bulletin 65, Canada RSS-102, CENELEC limits
- Internal low-power radio — radiated output far below FCC/IC/EU exposure limits
- A500 model SAR values (TT-800-1-1): 0.148 W/kg (1g avg), 0.062 W/kg (10g avg)

### EU / CE Marking

- A500 (TAP802-01): Compliant with Directive 2014/53/EU (RED)
- Operates in 2.4 GHz and 5 GHz ISM bands
- 5 GHz indoor-only restriction applies across all EU/EFTA member states (channels 36-64)
- France outdoor restriction: 10 mW e.i.r.p. in 2454-2483.5 MHz band
- Italy requires general authorization if operating outside owner's premises
- Must use VoiceCatalyst 2.1.1+ or VoiceClient 3.9.1+ for EU 5 GHz compliance on A500

### RoHS Compliance

- All Honeywell-manufactured products shipped after January 1, 2012 comply with EU RoHS2 (Directive 2011/65/EU)
- Maximum concentrations: Lead ≤0.1%, Hexavalent chromium ≤0.1%, PBB ≤0.1%, PBDE ≤0.1%, Cadmium ≤0.01%

### Canadian Compliance (IC)

- Complies with Industry Canada license-exempt RSS standards
- Must not cause interference; must accept interference received

### Bluetooth Regulatory

- Bluetooth word mark and logos owned by Bluetooth SIG, Inc. — used by Honeywell under license

---

## 17. Support & RMA Procedures

### Information Needed Before Contacting Support

- Talkman device model (e.g., A500 TT-802)
- Headset model (e.g., SRX2)
- Barcode scanner type (if applicable)
- VoiceClient or VoiceCatalyst version (from VoiceConsole)
- VoiceConsole version
- Device log files (enable logging in VoiceConsole → Device Management → Devices → Enable Logging)

### Questions to Prepare

- Was a previous support request for this issue closed unresolved?
- How many users are affected?
- How frequently does the issue occur?
- What is the current workaround?
- When did the issue first appear?
- What business impact is occurring?
- Has anything changed in the environment recently?

### Enabling Device Logging

VoiceConsole 2.x: Activate the "Enable" checkbox in the Logging section of device properties.
VoiceConsole 3.x+: Edit Device → Logging Enabled dropdown → set to "Enabled."

Export log file from Device Properties and send to Technical Support.

### RMA Process

1. Email `ACSHSMVocollectRMA@honeywell.com` with: customer contact, company name, address, phone, fax
2. Include: quantity, product description, serial number, software version, problem description, warranty/ESP/Depot Express status, PO number if applicable
3. Receive RMA number — include on shipping label
4. Remove and retain: ear pads, mounting discs, cables, cord clips (consumables slow repair turnaround)
5. Pack individually in anti-static bubble bags; do not use foam peanuts as sole packing material
6. Ship to: Honeywell, 4250 Old William Penn Highway, Monroeville, PA 15146-1622

### Support Contacts

| Region | Phone | Email |
|---|---|---|
| United States | +1 866-862-7877 | vocollectsupport@honeywell.com |
| Americas (ex-US), AU, NZ | +1 412-829-8145 opt 3, opt 1 | vocollectsupport@honeywell.com |
| EMEA | +44 (0) 1628 55 2902 | vocollectEMEA@honeywell.com |
| Japan & Korea | +813 6730 7234 | vocollectJapan@honeywell.com |

---

*This document was synthesized from the Honeywell Vocollect Talkman A500 Product Guide (104 pages, confidential for Honeywell resellers and customers). All equipment design and technical information is the confidential property of Honeywell International Inc.*
