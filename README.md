# Forward Proxy Server with Website Access Control

## 1. Project Overview

The Forward Proxy Server is a simple application that works as an intermediary between a user's web browser and the internet.

It allows users to control which websites can be accessed through their browser.

The application provides an admin dashboard where users can:

- Block websites and their subdomains.
- Allow previously blocked websites.
- View websites being accessed.
- Monitor active connections.
- View completed, failed, and blocked connections.
- View connection statistics and network traffic analytics.

The application runs locally on the user's computer and consists of two separate servers:

1. **Proxy Server:** Handles browser requests and controls website access.
2. **Admin Server:** Provides the dashboard, manages blocked domains, and displays analytics.

### Main Objective

To provide a simple local forward proxy server that monitors internet connections, blocks selected domains and subdomains, and maintains records of website access.

---

## 2. Technology Stack

The project uses Node.js and its built-in modules. No external npm libraries or frameworks are required.

### Backend Technologies

| Technology | Purpose |
|---|---|
| Node.js | Server-side runtime environment |
| HTTP | Handling HTTP requests and admin dashboard requests |
| HTTPS | Forwarding HTTPS requests |
| Net | Establishing TCP connections for HTTPS tunneling |
| FS | Reading and writing JSON files |
| Path | Managing file paths |
| Crypto | Generating unique connection IDs |

### Frontend Technologies

| Technology | Purpose |
|---|---|
| HTML5 | Dashboard structure |
| Vanilla JavaScript | Dashboard functionality |
| Fetch API | Communicating with admin endpoints |
| DOM API | Updating dashboard content dynamically |

**CSS is not used.** The dashboard uses plain HTML elements and browser-default styling.

---

## 3. Project Architecture

The application follows a two-server architecture.

### Components

**1. Proxy Server**

- Runs on `localhost:8080`.
- Receives HTTP and HTTPS requests from the browser.
- Checks whether the requested domain is blocked.
- Forwards allowed requests to their destination.
- Maintains active connection records.
- Saves completed, failed, and blocked connection records.

**2. Admin Server**

- Runs on `localhost:3000`.
- Serves the admin dashboard.
- Provides API endpoints.
- Manages the blocked-domain list.
- Provides connection information and analytics.

**3. Admin Dashboard**

- Displays connection analytics.
- Displays blocked domains.
- Allows users to block and allow domains.
- Displays active, completed, failed, and blocked connections.
- Refreshes information automatically.

### Architecture Diagram

```text
                  USER
                   |
                   |
              WEB BROWSER
                   |
                   |
          Configured Proxy Settings
                   |
                   |
          PROXY SERVER :8080
                   |
          +--------+--------+
          |                 |
      HTTP Request      HTTPS CONNECT
          |                 |
          |                 |
     Domain Check       Domain Check
          |                 |
          +--------+--------+
                   |
             Blocked?
              /       \
            YES        NO
             |          |
          Reject     Forward Request
                        |
                        |
                     INTERNET
                        |
                        |
                  Destination
                    Website


              ADMIN SERVER :3000
                      |
                      |
                DASHBOARD
                      |
             +--------+--------+
             |                 |
          REST APIs        HTML Page
             |
      +------+-------+
      |      |       |
   Block   Allow  Analytics
   Domain  Domain    |
                     |
             Connection Records
                     |
              JSON Data Files
```

### Server Communication

The browser communicates with the proxy server for internet access.

The dashboard communicates with the admin server for management and monitoring.

The admin server reads and updates the JSON files. The proxy server maintains active connections in memory and writes connection records to their respective JSON files.

Both servers run inside the same Node.js application process.

---

## 4. Project Directory Structure

The project contains six files.

```text
proxy-server/
│
├── server.js
│
├── dashboard.html
│
├── blocked-domains.json
│
├── completed-connections.json
│
├── failed-connections.json
│
└── blocked-connections.json
```

### File Description

**1. server.js**

This is the main application file.

It contains the implementation of both servers.

Responsibilities:

- Initialize JSON files.
- Start the proxy server.
- Start the admin server.
- Handle HTTP requests.
- Handle HTTPS CONNECT requests.
- Check blocked domains.
- Maintain active connections.
- Record connection information.
- Provide admin API endpoints.
- Calculate analytics.

**2. dashboard.html**

This file contains the admin dashboard.

Responsibilities:

- Display analytics.
- Display blocked domains.
- Provide block and allow domain controls.
- Display connection tables.
- Communicate with admin APIs.
- Refresh dashboard information automatically.

**3. blocked-domains.json**

Stores the list of domains blocked by the user.

Example:

```json
[
    "facebook.com",
    "instagram.com",
    "youtube.com"
]
```

**4. completed-connections.json**

Stores successfully completed connections.

**5. failed-connections.json**

Stores connections that failed because of connection or communication errors.

**6. blocked-connections.json**

Stores connection attempts rejected because their requested domains were blocked.

All connection files store JSON arrays.

---

## 5. Server Configuration

The application runs two HTTP servers.

| Server | Host | Port |
|---|---|---|
| Proxy Server | 127.0.0.1 | 8080 |
| Admin Server | 127.0.0.1 | 3000 |

### Proxy Server

Address:

`http://127.0.0.1:8080`

The browser uses this server as its forward proxy.

### Admin Server

Address:

`http://127.0.0.1:3000`

The user accesses this address to open the dashboard.

Both servers run simultaneously when `server.js` is executed.

---

## 6. Working of the Proxy Server

The proxy server sits between the browser and the destination website.

Whenever the browser requests a website, the request first reaches the proxy server.

The proxy checks the requested domain against the blocked-domain list.

### Step-by-Step Working

1. The user opens a website in the browser.
2. The browser sends its request to the configured proxy server.
3. The proxy server extracts the requested domain.
4. The proxy checks whether the domain is present in the blocked-domain list.
5. If the domain is blocked, the proxy rejects the request.
6. If the domain is allowed, the proxy forwards the request to the destination website.
7. The destination website sends its response through the proxy.
8. The proxy forwards the response to the browser.
9. Connection statistics are updated.
10. When the connection ends, its record is saved in the appropriate JSON file.

### Request Flow

```text
Browser Request
      |
      v
Proxy Server
      |
      v
Extract Domain
      |
      v
Check Blocklist
      |
      v
Is Domain Blocked?
      |
   +--+--+
   |     |
  YES    NO
   |     |
   v     v
 Reject  Create Active Record
   |     |
   |     v
   |   Forward Request
   |     |
   |     v
   |   Receive Response
   |     |
   |     v
   |   Forward to Browser
   |     |
   |     v
   |   Connection Ends
   |     |
   |     v
   |   Save Completed Record
   |
   v
Save Blocked Record
```

---

## 7. HTTP Request Handling

HTTP requests are handled using Node.js's built-in HTTP module.

When the browser sends an HTTP request:

1. The proxy extracts the destination URL.
2. It extracts the hostname from the URL.
3. It checks the hostname against the blocked-domain list.
4. If blocked, it returns an HTTP 403 Forbidden response.
5. Otherwise, it creates an outgoing HTTP request.
6. The outgoing request is sent to the destination website.
7. The destination response is forwarded to the browser.

The proxy also records:

- Requested website.
- Destination IP address, when available.
- Connection ID.
- Start time.
- End time.
- Duration.
- Data sent.
- Data received.
- Connection status.

For HTTP connections, data sent and received are counted from the request and response bodies.

---

## 8. HTTPS Request Handling

HTTPS traffic is handled using the HTTP CONNECT method.

The CONNECT method establishes a TCP tunnel between the browser and the destination server.

### How HTTPS CONNECT Works

1. The browser sends a CONNECT request to the proxy.
2. The request contains the destination hostname and port.
3. The proxy extracts the hostname.
4. The proxy checks whether the hostname is blocked.
5. If blocked, the proxy returns HTTP 403 Forbidden.
6. Otherwise, the proxy establishes a TCP connection with the destination server.
7. After successful connection, the proxy returns HTTP 200 Connection Established.
8. The browser and destination server communicate through the established tunnel.
9. The proxy forwards data in both directions.
10. When the tunnel closes, the connection record is saved.

### HTTPS Architecture

```text
Browser
   |
   | CONNECT example.com:443
   |
   v
Proxy Server
   |
   | Check Domain
   |
   v
Destination Server
   |
   | TCP Connection
   |
   v
200 Connection Established
   |
   |
   +=====================+
   |                     |
   |   Encrypted Tunnel  |
   |                     |
   +=====================+
   |                     |
 Browser              Website
```

### HTTPS Encryption

The proxy does not decrypt HTTPS traffic.

It only forwards encrypted data between the browser and destination server.

Therefore, it can monitor connection information and data transfer sizes but cannot read the actual HTTPS webpage content.

---

## 9. Domain and Subdomain Blocking

The application supports domain-level and subdomain-level blocking.

When a domain is blocked, its subdomains are also blocked.

For example, blocking:

`facebook.com`

Also blocks:

- `www.facebook.com`
- `m.facebook.com`
- `login.facebook.com`
- `accounts.facebook.com`

However, it does not block:

`notfacebook.com`

### Blocking Logic

The application uses two conditions:

1. The requested domain exactly matches the blocked domain.
2. The requested domain ends with a dot followed by the blocked domain.

Conceptually:

```javascript
domain === blockedDomain ||
domain.endsWith("." + blockedDomain)
```

This ensures that unrelated domains are not accidentally blocked.

### Allowing a Domain

When a user allows a domain:

1. The domain is normalized.
2. The application searches for an exact matching entry in the blocklist.
3. The matching entry is removed.
4. The updated blocklist is saved.

Allowing a parent domain removes that parent entry but does not remove separately blocked child domains.

---

## 10. Connection Management

The application maintains active connections using an in-memory JavaScript Map.

```javascript
const activeConnections = new Map();
```

Each active connection is stored using its unique connection ID as the key.

### Connection Lifecycle

A connection can have one of the following statuses:

| Status | Meaning |
|---|---|
| active | Connection is currently running |
| completed | Connection finished successfully |
| failed | Connection encountered an error |
| blocked | Connection was rejected by the blocklist |

### Connection Lifecycle Diagram

```text
New Request
    |
    v
Domain Check
    |
    +----------+
    |          |
 Blocked     Allowed
    |          |
    v          v
 Blocked     Active
 Record      Record
               |
               v
         Connection Ends
               |
          +----+----+
          |         |
       Success    Error
          |         |
          v         v
      Completed   Failed
       Record     Record
```

### Important Storage Rule

Active connections are maintained only in memory.

They are not written to any JSON file.

When a connection finishes, it is removed from the active Map and saved to the appropriate JSON file.

---

## 11. Connection Record Structure

Each connection contains the following information:

| Field | Description |
|---|---|
| website | Requested destination domain |
| ipAddress | Destination IP address, when available |
| connectionId | Unique connection identifier |
| startTime | Time when the connection started |
| endTime | Time when the connection ended |
| duration | Total connection duration in milliseconds |
| dataSent | Bytes sent from browser towards destination |
| dataReceived | Bytes received from destination |
| status | Connection status |

### Example Connection Record

```json
{
    "website": "example.com",
    "ipAddress": "93.184.216.34",
    "connectionId": "unique-connection-id",
    "startTime": "2026-11-16T10:00:00.000Z",
    "endTime": "2026-11-16T10:00:05.000Z",
    "duration": 5000,
    "dataSent": 1200,
    "dataReceived": 8500,
    "status": "completed"
}
```

Connection IDs are generated using Node.js's built-in Crypto module.

The duration is calculated using the difference between the end time and start time.

---

## 12. Data Storage Mechanism

The project uses JSON files for persistent storage.

There is no database.

### Storage Responsibilities

| Data | Storage |
|---|---|
| Blocked domains | blocked-domains.json |
| Active connections | In-memory Map |
| Completed connections | completed-connections.json |
| Failed connections | failed-connections.json |
| Blocked connections | blocked-connections.json |

### Saving Connection Records

When a connection finishes:

- Completed connections are saved in `completed-connections.json`.
- Failed connections are saved in `failed-connections.json`.
- Blocked connections are saved in `blocked-connections.json`.

The application reads the existing JSON array, adds the new record, and writes the updated array back to the file.

This allows connection information to remain available after restarting the application.

Active connections are not persistent and are lost when the application stops.

---

## 13. Admin Dashboard

The admin dashboard provides a centralized interface for monitoring and controlling the proxy server.

It is available at:

`http://localhost:3000`

The dashboard contains the following sections.

### A. Analytics Section

Displays:

1. Number of total connections.
2. Number of active connections.
3. Number of allowed connections.
4. Number of blocked connections.
5. Number of completed connections.
6. Number of failed connections.
7. Total data sent.
8. Total data received.
9. Number of blocked domains.

### B. Blocked Domains Section

Displays all currently blocked domains.

Example:

```text
Blocked Domains

facebook.com
instagram.com
youtube.com
```

### C. Block Domain Section

Contains:

- Text input for entering a domain.
- Block button.
- Result message.

When the user clicks Block:

1. The dashboard sends a POST request to `/api/block`.
2. The admin server validates the domain.
3. The domain is added to the blocklist.
4. The updated JSON file is saved.
5. A success or error message is displayed.

### D. Allow Domain Section

Contains:

- Text input for entering a domain.
- Allow button.
- Result message.

When the user clicks Allow:

1. The dashboard sends a POST request to `/api/allow`.
2. The admin server validates the domain.
3. The matching entry is removed from the blocklist.
4. The updated JSON file is saved.
5. A result message is displayed.

### E. Active Connections Table

Displays:

- Website.
- IP address.
- Connection ID.
- Start time.
- Data sent.
- Data received.

### F. Completed Connections Table

Displays:

- Website.
- IP address.
- Connection ID.
- Start time.
- End time.
- Duration.
- Data sent.
- Data received.

### G. Failed Connections Table

Displays:

- Website.
- IP address.
- Connection ID.
- Start time.

### H. Blocked Connections Table

Displays:

- Website.
- IP address.
- Connection ID.
- Start time.

### Automatic Dashboard Refresh

The dashboard refreshes its information every 2 seconds.

It uses JavaScript's `setInterval()` function to periodically request updated information from the admin server.

---

## 14. Admin Server API Endpoints

All API endpoints are handled by the admin server running on port 3000.

### 1. Get Blocked Domains

**Endpoint:**

`GET /api/blocklist`

**Purpose:**

Returns the list of currently blocked domains.

**Example Response:**

```json
{
    "blockedDomains": [
        "facebook.com",
        "instagram.com"
    ]
}
```

### 2. Block a Domain

**Endpoint:**

`POST /api/block`

**Purpose:**

Adds a domain to the blocked-domain list.

**Request Body:**

```json
{
    "domain": "facebook.com"
}
```

**Example Response:**

```json
{
    "success": true,
    "domain": "facebook.com",
    "message": "Domain blocked successfully"
}
```

### 3. Allow a Domain

**Endpoint:**

`POST /api/allow`

**Purpose:**

Removes a domain from the blocked-domain list.

**Request Body:**

```json
{
    "domain": "facebook.com"
}
```

**Example Response:**

```json
{
    "success": true,
    "domain": "facebook.com",
    "message": "Domain allowed successfully"
}
```

### 4. Get Analytics

**Endpoint:**

`GET /api/analytics`

**Purpose:**

Returns overall proxy statistics.

**Example Response:**

```json
{
    "totalConnections": 100,
    "activeConnections": 5,
    "allowedConnections": 90,
    "blockedConnections": 10,
    "completedConnections": 80,
    "failedConnections": 5,
    "totalDataSent": 50000,
    "totalDataReceived": 200000,
    "blockedDomains": 3
}
```

### 5. Get Active Connections

**Endpoint:**

`GET /api/active-connections`

**Purpose:**

Returns currently active connections.

Maximum records returned: 50.

### 6. Get Completed Connections

**Endpoint:**

`GET /api/completed-connections`

**Purpose:**

Returns the latest completed connections.

Maximum records returned: 50.

### 7. Get Failed Connections

**Endpoint:**

`GET /api/failed-connections`

**Purpose:**

Returns the latest failed connections.

Maximum records returned: 50.

### 8. Get Blocked Connections

**Endpoint:**

`GET /api/blocked-connections`

**Purpose:**

Returns the latest blocked connections.

Maximum records returned: 50.

### Endpoint Summary

| Method | Endpoint | Purpose |
|---|---|---|
| GET | /api/blocklist | Get blocked domains |
| POST | /api/block | Block a domain |
| POST | /api/allow | Allow a domain |
| GET | /api/analytics | Get analytics |
| GET | /api/active-connections | Get active connections |
| GET | /api/completed-connections | Get completed connections |
| GET | /api/failed-connections | Get failed connections |
| GET | /api/blocked-connections | Get blocked connections |

---

## 15. Analytics Calculation

The analytics section calculates statistics using active connections and saved connection records.

### Total Connections

Total number of active, completed, failed, and blocked connection records.

### Active Connections

Number of connections currently present in the in-memory Map.

### Allowed Connections

Calculated as:

```text
Total Connections - Blocked Connections
```

### Blocked Connections

Total number of records stored in `blocked-connections.json`.

### Completed Connections

Total number of records stored in `completed-connections.json`.

### Failed Connections

Total number of records stored in `failed-connections.json`.

### Total Data Sent

Sum of the `dataSent` values across active and recorded connections.

### Total Data Received

Sum of the `dataReceived` values across active and recorded connections.

### Number of Blocked Domains

Total number of entries in `blocked-domains.json`.

---

## 16. How to Run the Application

### Step 1: Install Node.js

Install Node.js on your computer.

### Step 2: Open the Project Directory

Open a terminal inside the `proxy-server` directory.

### Step 3: Start the Application

Execute:

```bash
node server.js
```

Both servers start automatically.

Expected output:

```text
Proxy server running at http://127.0.0.1:8080
Admin server running at http://127.0.0.1:3000
```

### Step 4: Open the Admin Dashboard

Open the following address in your browser:

`http://localhost:3000`

### Step 5: Configure Browser Proxy Settings

Configure your browser to use the local proxy.

| Setting | Value |
|---|---|
| HTTP Proxy | 127.0.0.1 |
| HTTP Port | 8080 |
| HTTPS Proxy | 127.0.0.1 |
| HTTPS Port | 8080 |

### Step 6: Start Using the Application

Now you can:

- Browse websites through the proxy.
- Block unwanted domains.
- Allow previously blocked domains.
- Monitor active connections.
- View completed, failed, and blocked connections.
- Monitor network traffic statistics.

### Step 7: Stop the Application

Press:

```text
Ctrl + C
```

Both servers will stop.

---

## 17. Important Characteristics

- The application runs locally on the computer.
- Both servers run in the same Node.js process.
- No external npm libraries are required.
- No database is required.
- HTTP and HTTPS traffic are supported.
- HTTPS traffic remains encrypted.
- HTTPS connections use the CONNECT method.
- Domain and subdomain blocking is supported.
- Active connections are maintained in memory.
- Completed, failed, and blocked connections are stored in JSON files.
- The dashboard automatically refreshes every 2 seconds.
- Only the latest 50 records are displayed in each connection table.
- The JSON files retain all saved connection records.
- The admin dashboard and proxy server use separate ports.

---

## 18. Project Limitations

The current implementation is intentionally simple.

1. **No authentication:** The dashboard does not have a login system.
2. **Local access:** Both servers listen on the localhost interface.
3. **No database:** JSON files are used for persistent storage.
4. **No HTTPS inspection:** Encrypted HTTPS content cannot be viewed.
5. **No user identification:** The application does not maintain separate records for different browser users.
6. **No connection persistence:** Active connections are lost if the application stops unexpectedly.
7. **No historical data filtering:** The dashboard displays the latest 50 records without search or filtering.
8. **No automatic cleanup:** Completed, failed, and blocked JSON files continue growing as records are added.
9. **Basic traffic accounting:** HTTP body bytes and HTTPS tunnel bytes are counted differently. HTTP headers are not included in the HTTP body counters.
10. **Basic proxy implementation:** Advanced proxy features such as authentication, caching, and detailed connection-pool management are not implemented.

---

## 19. Conclusion

The Forward Proxy Server is a lightweight website access-control and monitoring application developed using Node.js and vanilla JavaScript.

It provides two main functionalities: controlling access to websites and monitoring internet connections.

The proxy server handles HTTP and HTTPS traffic, checks requested domains against a blocklist, forwards allowed requests, and maintains connection records.

The admin server provides APIs and a dashboard for managing blocked domains and viewing analytics.

By using Node.js built-in modules and JSON-based storage, the application keeps its architecture simple, lightweight, and easy to understand.
