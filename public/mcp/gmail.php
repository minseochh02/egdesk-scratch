<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Function to call Electron app's HTTP API for Gmail
function callElectronGmailAPI() {
    $electronUrl = 'http://localhost:3333/api/gmail';
    
    // Create stream context with timeout
    $context = stream_context_create([
        'http' => [
            'method' => 'GET',
            'timeout' => 10,
            'header' => 'Content-Type: application/json',
            'ignore_errors' => true
        ]
    ]);
    
    $result = @file_get_contents($electronUrl, false, $context);
    
    if ($result === false) {
        return [
            'success' => false,
            'error' => 'Cannot connect to Electron app',
            'message' => 'Please ensure the Electron app is running and you are signed in with Google',
            'electron_url' => $electronUrl,
            'timestamp' => date('Y-m-d H:i:s')
        ];
    }
    
    $data = json_decode($result, true);
    if ($data === null) {
        return [
            'success' => false,
            'error' => 'Invalid response from Electron app',
            'raw_response' => substr($result, 0, 200),
            'timestamp' => date('Y-m-d H:i:s')
        ];
    }
    
    return $data;
}

// Call the Electron app's Gmail API
$response = callElectronGmailAPI();

echo json_encode($response, JSON_PRETTY_PRINT);
?>
