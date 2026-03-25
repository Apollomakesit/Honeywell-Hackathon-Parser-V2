# GTS Hackathon 2026

## Team

- Team: EMEA

## Objective

Develop a log parser solution using any tool available that you are skilled in (C family, Excel/VB, Python/Scripting, etc.). You are free to use any available AI tool.

Tools developed should be able to process logs and extract relevant information based on requirements.

## Deliverables

1. A functional parser
2. Concept presentation

## You Will Receive

- Input data (a couple of log files)
- Log data info to be analyzed (a couple of device logs containing various events such as communication, etc., either on a single line or spread across several lines. You will need to identify the start and end of each event and detect any anomalies based on some guidance that will be provided with logs)

## Judging Criteria

### Quality Of Presentation

- PPT should explain the solution without the need to be live presented
- Presentation should be clear and concise

### Solution Evaluation

- Easy to use
- Scalable (configuration changes, further development)
- Underline offending values
- Additional reporting capabilities (for example: output/summary presented as web page, PDF, etc.)

## Analysis Focus Areas

### 1. Measure Battery Drain And Temperature Over Time

- Battery runtime (`Battery runtime 123 minutes`)
- Battery percent remaining (`Battery percent remaining: 32`)
- Battery temperature (`[Temperature: 9.7deg C]`)
- Energy consumption (`[EnergyConsumption: -3435 mAh]`)

### 2. Wi-Fi Signal Issues Over Time

- Signal strength (`SURVEY: Signal Strength: 32% ( 30 29 30 30 34 32 31 31 34 43 )`)
- Roamed RSSI (`AP MON: ROAMED from AP 48:4A:E9:CD:6C:D4 to AP 48:4A:E9:CD:42:D4`)
- Connection failed (`Connection Failed`)

## Log Format

Example:

```text
(2/28/24 2:31:24 PM CET) 14:14:50.300 - 43775256: followed by event information
```

Field meaning:

- Server date and time: `(2/28/24 2:31:24 PM CET)`
- Device time: `14:14:50.300`
- Device tick: `43775256` (incremental until next restart)

## Additional Log Metadata At The Start Of The Log

- Log Start Time: example `2/28/24 2:30:53 PM CET`
- Log Stop Time: example `2/29/24 2:31:47 PM CET`
- Log Type: `standard`
- Terminal Name: `7623205329`
- Terminal Serial Number: `7623205329`
- Firmware Version: `VCL-20231214123659_V4.7.1.no_NO_12`
- IP Address: `192.168.0.10`

## Logs Location

- `America Team I | GTS Hackathon | Microsoft Teams`

## Emails Regarding Competition

### Initial Team Email

Hello Team,

Are you ready?!

Please find the info below. Feel free to contact me directly if you have any questions. I will schedule daily check meeting with each team apart.

- General Teams Channel: `General | GTS Hackathon | Microsoft Teams`, chat can be used to discuss with all the participants.
- For collaboration you can use your own Team space below (private, only specific team members have access).
- Logs data and instructions: `Repository | GTS Hackathon | Microsoft Teams`

### Teams

- APAC: Shinde Gaurav, Pawan Khiradkar, Rohan Vilas Khade, Swapnil Gunge
- EMEA: Alex Stoica, George Cuclea, Vlaicu Ioan Stefan, Pedro Lopez, Ugur Burak Han
- America I: Alberto Morales Moreno, Jose Munoz, Rayon Thomas, Fernando Chavarria Garcia, Isaac Garcia Martinez
- America II: Seki Hudson, Alex Rivera, Balaji KJ, Jose De Jesus Rodriguez

For a full experience, I will let you organize yourself (contact each other, evaluate the time/effort and organize the work, split the tasks: presentation, research, etc.).

Success,

Mihai

### Event Email

From: Andrei, Mihai
Sent: Friday, March 20, 2026 2:51 PM
To: Andrei, Mihai <Mihai.Andrei@Honeywell.com>
Subject: GTS Hackathon - 23 - 27 March
Importance: High

Hello team,

Thank you for your interest on GTS Hackathon. Please find below more details about the event.

#### Event Objective

Develop a log parser solution using any tool available that you are skilled in (C family, Excel/VB, Python/Scripting etc.). You are free to use any available AI tool.

Tools developed should be able to process logs and extract relevant information based on requirements.

#### Event Deliverables

1. A functional parser
2. Concept presentation

#### Event Inputs

- Input data (a couple of log files)
- Log data info to be analyzed (a couple of device logs containing various events such as communication, etc., either on a single line or spread across several lines. You will need to identify the start and end of each event and detect any anomalies based on some guidance that will be provided with logs)

#### Judging

##### Presentation Evaluation

- PPT should explain the solution without the need to be live presented, clear and concise

##### Solution Evaluation Criteria

- Easy to use
- Scalable (configuration changes, further development)
- Underline offending values
- Additional reporting capabilities (for example: output/summary presented as web page, PDF, etc.)

#### Team Members

Monday morning, you will receive by mail the names of the team members and access to logs.

#### Time Allocation

The hours of commitment depend on each team member's availability. Teams need to organize themselves and divide tasks. The goal is to provide a full hackathon/project experience.

#### Deadline

End time: Friday, 27 March EOD. The project should be sent via email to Mihai.

I will set daily checkpoints with the teams.

Thank you,

Mihai Andrei
Honeywell | INDUSTRIAL AUTOMATION

## Workspace Note

- The Linux device logs in this repository are the primary input set for the new parser.
- The example log parser is guidance only.
- The new data log parser is intended to be deployed on Railway.
