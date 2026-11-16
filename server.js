const http = require("http");
const https = require("https");
const net = require("net");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PROXY_HOST = "127.0.0.1";
const PROXY_PORT = 8080;

const ADMIN_HOST = "127.0.0.1";
const ADMIN_PORT = 3000;

const DATA_DIRECTORY = __dirname;
const DASHBOARD_FILE = path.join(DATA_DIRECTORY, "dashboard.html");

const BLOCKED_DOMAINS_FILE = path.join(
    DATA_DIRECTORY,
    "blocked-domains.json"
);

const COMPLETED_CONNECTIONS_FILE = path.join(
    DATA_DIRECTORY,
    "completed-connections.json"
);

const FAILED_CONNECTIONS_FILE = path.join(
    DATA_DIRECTORY,
    "failed-connections.json"
);

const BLOCKED_CONNECTIONS_FILE = path.join(
    DATA_DIRECTORY,
    "blocked-connections.json"
);

const activeConnections = new Map();

function initializeJsonFile(filePath) {
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, "[]", "utf8");
    }
}

function readJsonFile(filePath) {
    try {
        const fileContent = fs.readFileSync(filePath, "utf8");
        const parsedContent = JSON.parse(fileContent);

        return Array.isArray(parsedContent) ? parsedContent : [];
    } catch (error) {
        return [];
    }
}

function writeJsonFile(filePath, data) {
    fs.writeFileSync(
        filePath,
        JSON.stringify(data, null, 4),
        "utf8"
    );
}

function initializeFiles() {
    initializeJsonFile(BLOCKED_DOMAINS_FILE);
    initializeJsonFile(COMPLETED_CONNECTIONS_FILE);
    initializeJsonFile(FAILED_CONNECTIONS_FILE);
    initializeJsonFile(BLOCKED_CONNECTIONS_FILE);
}

function normalizeDomain(domainInput) {
    if (typeof domainInput !== "string") {
        return null;
    }

    const trimmedInput = domainInput.trim();

    if (!trimmedInput) {
        return null;
    }

    try {
        const inputWithProtocol = trimmedInput.includes("://")
            ? trimmedInput
            : `http://${trimmedInput}`;

        const parsedUrl = new URL(inputWithProtocol);
        const normalizedDomain = parsedUrl.hostname
            .toLowerCase()
            .replace(/\.$/, "");

        if (!normalizedDomain) {
            return null;
        }

        return normalizedDomain;
    } catch (error) {
        return null;
    }
}

function isDomainBlocked(domain) {
    const blockedDomains = readJsonFile(BLOCKED_DOMAINS_FILE);

    return blockedDomains.some((blockedDomain) => {
        const normalizedBlockedDomain = normalizeDomain(blockedDomain);

        return (
            normalizedBlockedDomain &&
            (
                domain === normalizedBlockedDomain ||
                domain.endsWith(`.${normalizedBlockedDomain}`)
            )
        );
    });
}

function createConnectionRecord(website) {
    return {
        website,
        ipAddress: null,
        connectionId: crypto.randomUUID(),
        startTime: new Date().toISOString(),
        endTime: null,
        duration: null,
        dataSent: 0,
        dataReceived: 0,
        status: "active"
    };
}

function saveConnection(record) {
    let filePath;

    if (record.status === "completed") {
        filePath = COMPLETED_CONNECTIONS_FILE;
    } else if (record.status === "failed") {
        filePath = FAILED_CONNECTIONS_FILE;
    } else if (record.status === "blocked") {
        filePath = BLOCKED_CONNECTIONS_FILE;
    } else {
        return;
    }

    const savedConnections = readJsonFile(filePath);
    savedConnections.push(record);

    writeJsonFile(filePath, savedConnections);
}

function finishConnection(record, status) {
    if (record.status !== "active") {
        return;
    }

    record.status = status;
    record.endTime = new Date().toISOString();

    const startTime = new Date(record.startTime).getTime();
    const endTime = new Date(record.endTime).getTime();

    record.duration = Math.max(0, endTime - startTime);

    activeConnections.delete(record.connectionId);
    saveConnection(record);
}

function blockConnection(record) {
    record.status = "blocked";
    record.endTime = new Date().toISOString();
    record.duration = 0;

    saveConnection(record);
}

function getRequestUrl(request) {
    try {
        if (request.url.startsWith("http://") ||
            request.url.startsWith("https://")) {
            return new URL(request.url);
        }

        const host = request.headers.host;

        if (!host) {
            return null;
        }

        return new URL(request.url, `http://${host}`);
    } catch (error) {
        return null;
    }
}

function handleHttpRequest(request, response) {
    const targetUrl = getRequestUrl(request);

    if (!targetUrl) {
        response.writeHead(400);
        response.end("Invalid proxy request");
        return;
    }

    const domain = targetUrl.hostname.toLowerCase();
    const connectionRecord = createConnectionRecord(domain);

    if (isDomainBlocked(domain)) {
        blockConnection(connectionRecord);

        response.writeHead(403, {
            "Content-Type": "text/plain"
        });
        response.end("This website is blocked");
        return;
    }

    activeConnections.set(
        connectionRecord.connectionId,
        connectionRecord
    );

    const requestModule = targetUrl.protocol === "https:"
        ? https
        : http;

    const requestOptions = {
        hostname: targetUrl.hostname,
        port: targetUrl.port || (
            targetUrl.protocol === "https:" ? 443 : 80
        ),
        method: request.method,
        path: `${targetUrl.pathname}${targetUrl.search}`,
        headers: { ...request.headers }
    };

    delete requestOptions.headers["proxy-connection"];
    delete requestOptions.headers["proxy-authorization"];

    let responseFinished = false;

    const upstreamRequest = requestModule.request(
        requestOptions,
        (upstreamResponse) => {
            if (upstreamResponse.socket &&
                upstreamResponse.socket.remoteAddress) {
                connectionRecord.ipAddress =
                    upstreamResponse.socket.remoteAddress;
            }

            response.writeHead(
                upstreamResponse.statusCode || 502,
                upstreamResponse.headers
            );

            upstreamResponse.on("data", (chunk) => {
                connectionRecord.dataReceived += chunk.length;
                response.write(chunk);
            });

            upstreamResponse.on("end", () => {
                response.end();
            });

            upstreamResponse.on("error", () => {
                response.destroy();
                finishConnection(connectionRecord, "failed");
            });
        }
    );

    upstreamRequest.on("error", () => {
        if (!response.headersSent) {
            response.writeHead(502);
            response.end("Unable to connect to destination");
        } else {
            response.destroy();
        }

        finishConnection(connectionRecord, "failed");
    });

    request.on("data", (chunk) => {
        connectionRecord.dataSent += chunk.length;
        upstreamRequest.write(chunk);
    });

    request.on("end", () => {
        upstreamRequest.end();
    });

    request.on("error", () => {
        upstreamRequest.destroy();
        finishConnection(connectionRecord, "failed");
    });

    response.on("finish", () => {
        responseFinished = true;
        finishConnection(connectionRecord, "completed");
    });

    response.on("close", () => {
        if (!responseFinished) {
            upstreamRequest.destroy();
            finishConnection(connectionRecord, "failed");
        }
    });
}

function getConnectTarget(requestUrl) {
    try {
        const targetUrl = new URL(`http://${requestUrl}`);
        const port = Number(targetUrl.port) || 443;

        return {
            hostname: targetUrl.hostname,
            port
        };
    } catch (error) {
        return null;
    }
}

function handleConnectRequest(request, clientSocket, head) {
    const target = getConnectTarget(request.url);

    if (!target) {
        clientSocket.end(
            "HTTP/1.1 400 Bad Request\r\n\r\n"
        );
        return;
    }

    const connectionRecord = createConnectionRecord(
        target.hostname.toLowerCase()
    );

    if (isDomainBlocked(connectionRecord.website)) {
        blockConnection(connectionRecord);

        clientSocket.end(
            "HTTP/1.1 403 Forbidden\r\n" +
            "Connection: close\r\n\r\n"
        );
        return;
    }

    activeConnections.set(
        connectionRecord.connectionId,
        connectionRecord
    );

    const destinationSocket = net.connect(
        target.port,
        target.hostname
    );

    let connectionFinished = false;
    let connectionFailed = false;

    function finishTunnel(status) {
        if (connectionFinished) {
            return;
        }

        connectionFinished = true;
        finishConnection(connectionRecord, status);
    }

    destinationSocket.on("connect", () => {
        connectionRecord.ipAddress =
            destinationSocket.remoteAddress || null;

        clientSocket.write(
            "HTTP/1.1 200 Connection Established\r\n" +
            "Proxy-Agent: Local-Forward-Proxy\r\n\r\n"
        );

        if (head && head.length > 0) {
            connectionRecord.dataSent += head.length;
            destinationSocket.write(head);
        }

        clientSocket.on("data", (chunk) => {
            connectionRecord.dataSent += chunk.length;
        });

        destinationSocket.on("data", (chunk) => {
            connectionRecord.dataReceived += chunk.length;
        });

        clientSocket.pipe(destinationSocket);
        destinationSocket.pipe(clientSocket);
    });

    destinationSocket.on("error", () => {
        connectionFailed = true;

        clientSocket.end(
            "HTTP/1.1 502 Bad Gateway\r\n\r\n"
        );

        finishTunnel("failed");
    });

    clientSocket.on("error", () => {
        connectionFailed = true;
        destinationSocket.destroy();
        finishTunnel("failed");
    });

    clientSocket.on("close", () => {
        destinationSocket.end();

        finishTunnel(
            connectionFailed ? "failed" : "completed"
        );
    });

    destinationSocket.on("close", () => {
        if (!clientSocket.destroyed) {
            clientSocket.end();
        }

        finishTunnel(
            connectionFailed ? "failed" : "completed"
        );
    });
}

function startProxyServer() {
    const proxyServer = http.createServer(handleHttpRequest);

    proxyServer.on("connect", handleConnectRequest);

    proxyServer.listen(PROXY_PORT, PROXY_HOST, () => {
        console.log(
            `Proxy server running at http://${PROXY_HOST}:${PROXY_PORT}`
        );
    });
}

function sendJson(response, statusCode, data) {
    response.writeHead(statusCode, {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
    });

    response.end(JSON.stringify(data));
}

function readRequestBody(request) {
    return new Promise((resolve, reject) => {
        let body = "";

        request.on("data", (chunk) => {
            body += chunk.toString();
        });

        request.on("end", () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (error) {
                reject(error);
            }
        });

        request.on("error", reject);
    });
}

function getAllConnections(filePath) {
    return readJsonFile(filePath);
}

function getAllRecordedConnections() {
    return [
        ...getAllConnections(COMPLETED_CONNECTIONS_FILE),
        ...getAllConnections(FAILED_CONNECTIONS_FILE),
        ...getAllConnections(BLOCKED_CONNECTIONS_FILE)
    ];
}

function getAnalytics() {
    const completedConnections =
        getAllConnections(COMPLETED_CONNECTIONS_FILE);

    const failedConnections =
        getAllConnections(FAILED_CONNECTIONS_FILE);

    const blockedConnections =
        getAllConnections(BLOCKED_CONNECTIONS_FILE);

    const activeConnectionList =
        Array.from(activeConnections.values());

    const allConnections = [
        ...completedConnections,
        ...failedConnections,
        ...blockedConnections,
        ...activeConnectionList
    ];

    const totalDataSent = allConnections.reduce(
        (total, connection) => total + connection.dataSent,
        0
    );

    const totalDataReceived = allConnections.reduce(
        (total, connection) => total + connection.dataReceived,
        0
    );

    const blockedDomains = readJsonFile(BLOCKED_DOMAINS_FILE);

    return {
        totalConnections: allConnections.length,
        activeConnections: activeConnectionList.length,
        allowedConnections:
            allConnections.length - blockedConnections.length,
        blockedConnections: blockedConnections.length,
        completedConnections: completedConnections.length,
        failedConnections: failedConnections.length,
        totalDataSent,
        totalDataReceived,
        blockedDomains: blockedDomains.length
    };
}

function getLatestConnections(connections) {
    return connections.slice(-50).reverse();
}

async function handleAdminApi(request, response, requestPath) {
    if (request.method === "GET" &&
        requestPath === "/api/blocklist") {
        sendJson(response, 200, {
            blockedDomains: readJsonFile(BLOCKED_DOMAINS_FILE)
        });
        return;
    }

    if (request.method === "POST" &&
        requestPath === "/api/block") {
        let requestBody;

        try {
            requestBody = await readRequestBody(request);
        } catch (error) {
            sendJson(response, 400, {
                success: false,
                message: "Invalid JSON body"
            });
            return;
        }

        const domain = normalizeDomain(requestBody.domain);

        if (!domain) {
            sendJson(response, 400, {
                success: false,
                message: "Please enter a valid domain"
            });
            return;
        }

        const blockedDomains = readJsonFile(BLOCKED_DOMAINS_FILE);

        const alreadyBlocked = blockedDomains.some(
            (item) => normalizeDomain(item) === domain
        );

        if (!alreadyBlocked) {
            blockedDomains.push(domain);
            writeJsonFile(BLOCKED_DOMAINS_FILE, blockedDomains);
        }

        sendJson(response, 200, {
            success: true,
            domain,
            message: alreadyBlocked
                ? "Domain is already blocked"
                : "Domain blocked successfully"
        });
        return;
    }

    if (request.method === "POST" &&
        requestPath === "/api/allow") {
        let requestBody;

        try {
            requestBody = await readRequestBody(request);
        } catch (error) {
            sendJson(response, 400, {
                success: false,
                message: "Invalid JSON body"
            });
            return;
        }

        const domain = normalizeDomain(requestBody.domain);

        if (!domain) {
            sendJson(response, 400, {
                success: false,
                message: "Please enter a valid domain"
            });
            return;
        }

        const blockedDomains = readJsonFile(BLOCKED_DOMAINS_FILE);

        const updatedDomains = blockedDomains.filter(
            (item) => normalizeDomain(item) !== domain
        );

        const domainWasBlocked =
            updatedDomains.length !== blockedDomains.length;

        writeJsonFile(BLOCKED_DOMAINS_FILE, updatedDomains);

        sendJson(response, 200, {
            success: true,
            domain,
            message: domainWasBlocked
                ? "Domain allowed successfully"
                : "Domain was not in the blocklist"
        });
        return;
    }

    if (request.method === "GET" &&
        requestPath === "/api/analytics") {
        sendJson(response, 200, getAnalytics());
        return;
    }

    if (request.method === "GET" &&
        requestPath === "/api/active-connections") {
        const connections =
            Array.from(activeConnections.values());

        sendJson(
            response,
            200,
            getLatestConnections(connections)
        );
        return;
    }

    if (request.method === "GET" &&
        requestPath === "/api/completed-connections") {
        sendJson(
            response,
            200,
            getLatestConnections(
                getAllConnections(COMPLETED_CONNECTIONS_FILE)
            )
        );
        return;
    }

    if (request.method === "GET" &&
        requestPath === "/api/failed-connections") {
        sendJson(
            response,
            200,
            getLatestConnections(
                getAllConnections(FAILED_CONNECTIONS_FILE)
            )
        );
        return;
    }

    if (request.method === "GET" &&
        requestPath === "/api/blocked-connections") {
        sendJson(
            response,
            200,
            getLatestConnections(
                getAllConnections(BLOCKED_CONNECTIONS_FILE)
            )
        );
        return;
    }

    sendJson(response, 404, {
        success: false,
        message: "Endpoint not found"
    });
}

function startAdminServer() {
    const adminServer = http.createServer(
        async (request, response) => {
            const requestUrl = new URL(
                request.url,
                `http://${request.headers.host}`
            );

            if (request.method === "GET" &&
                requestUrl.pathname === "/") {
                fs.readFile(DASHBOARD_FILE, "utf8", (error, html) => {
                    if (error) {
                        response.writeHead(500);
                        response.end("Unable to load dashboard");
                        return;
                    }

                    response.writeHead(200, {
                        "Content-Type": "text/html"
                    });
                    response.end(html);
                });

                return;
            }

            if (requestUrl.pathname.startsWith("/api/")) {
                await handleAdminApi(
                    request,
                    response,
                    requestUrl.pathname
                );
                return;
            }

            response.writeHead(404);
            response.end("Not found");
        }
    );

    adminServer.listen(ADMIN_PORT, ADMIN_HOST, () => {
        console.log(
            `Admin server running at http://${ADMIN_HOST}:${ADMIN_PORT}`
        );
    });
}

initializeFiles();
startProxyServer();
startAdminServer();
